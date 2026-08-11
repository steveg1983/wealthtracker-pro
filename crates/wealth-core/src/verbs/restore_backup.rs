//! `restore_backup` — a whole file, poured back, in ONE transaction.
//!
//! # Why this exists beside [`super::restore_user_chunk`]
//!
//! It is not a second implementation. Every row it inserts goes through
//! `restore_user_chunk`'s own [`insert_rows`](super::restore_user_chunk), and
//! every link it closes goes through `finalize_user_restore`'s own
//! [`close_the_links`](super::finalize_user_restore) — the same two functions,
//! called from one transaction instead of from N+1.
//!
//! What is new is the SHAPE, and the shape is the divergence:
//!
//! ```text
//!                       cloud                        this file
//! ─────────────────     ──────────────────────────   ────────────────────────
//! how it arrives        ~34 HTTP calls, chunked at   one call
//!                       500 rows
//! atomicity (B-10)      each chunk commits on its    one transaction
//!                       own; a failure halfway
//!                       leaves the login PARTLY
//!                       POPULATED
//! the second pass       a separate RPC, so a         inside the same
//!                       failure between them leaves  transaction as the rows
//!                       every transfer unpaired
//! recovery              "wipe and retry"             nothing to recover from
//! ```
//!
//! The cloud chunks because a 50k-transaction dataset is tens of megabytes and
//! one request that size is a cliff waiting to be hit on the one operation a
//! user cannot afford to have fail. Locally there is no request, so there is no
//! cliff, so there is nothing to buy with the non-atomicity — and X-7 / R-16 say
//! so: *"Restore is chunked, not atomic | Restore is one transaction."*
//!
//! Two consequences worth stating rather than discovering:
//!
//! * **`transactions.linked_transfer_id` never has to be seen unpaired.** R-11:
//!   this schema declares the transactions↔splits cycle's keys `DEFERRABLE
//!   INITIALLY DEFERRED`, so the whole file — rows AND links — closes at one
//!   COMMIT. The cloud cannot do this; nothing in that schema is deferrable,
//!   which is what `finalize_user_restore` exists for.
//! * **A refusal leaves the store EXACTLY as it was.** Not "nearly", and not
//!   "recoverable by running the wipe again". `contract.ts`'s *"refuses to
//!   restore over a store that still holds something, and changes nothing"*
//!   compares the whole store before and after, byte for byte.
//!
//! # The emptiness precondition is asked ONCE, before anything
//!
//! The cloud checks it on the `accounts` chunk and only there — MEASURED: a
//! `transactions` chunk sent into a login that already holds data is not
//! refused. That is not a rule, it is what one-chunk-at-a-time leaves it
//! possible to check, and `backupService.RESTORE_STEPS` puts accounts first
//! partly to make it fire.
//!
//! Here the whole file arrives at once, so the question is asked once, at the
//! top, about the file rather than about a chunk. It is strictly stronger: a
//! file whose `accounts` section is empty — a ledger of nothing but categories,
//! or a hand-trimmed file — would land ON TOP of a populated store in the cloud
//! and is refused here. Stated as a divergence rather than smuggled in, because
//! it is a case where the port refuses what the cloud accepts, and that is
//! normally a bug in a port. It is allowed here for the reason the seam gives:
//! *"A restore REPLACES; it does not merge"*, and the emptiness check is the
//! whole of what makes it safe to attempt.
//!
//! # The chunk ORDER is still the caller's, and still load-bearing
//!
//! One call does not mean one unordered heap. The chunks are applied in the
//! order given, which must be `backupService.RESTORE_STEPS`':
//!
//! * **accounts first**, because `trg_create_transfer_category_for_account`
//!   stands itself down while the login has no type-level Transfer category —
//!   so a restore that inserted categories first would have the trigger MINT a
//!   To/From category for every account and then insert the file's own beside
//!   it. Two To/From categories for one account is not cosmetic: the transfer
//!   picker offers the same account twice under two ids and half the history is
//!   filed under the one the other half does not use. Contract rule 84 is that
//!   sentence as a test.
//! * **categories level by level**, so `parent_id` always resolves.
//! * **parents before children** everywhere else.
//!
//! The verb does not re-order them, and deliberately does not check: the order
//! is the FILE FORMAT's, shared with two other engines, and a crate that
//! imposed its own would be a third opinion about what a backup is.
//!
//! # No guard, on the same measurement
//!
//! `restore_user_chunk`'s answer, unchanged and for the same reason: every split
//! protection in this schema is `BEFORE UPDATE OF` and a restore only INSERTs.
//! The link pass DOES update, and it holds `_rpc_guard('restore')` for exactly
//! its own duration — inside this transaction, set and cleared by
//! `close_the_links`, which is where that flag has always lived.

use rusqlite::{Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::backup::Dropped;
use crate::db;
use crate::error::{CoreError, CoreResult};

use super::finalize_user_restore::{close_the_links, record_the_restore, RestoreLinks};
use super::restore_user_chunk::{insert_rows, is_empty, rows_of, target_not_empty, Chunk};

/// The command: the whole file, in the order the format says to apply it.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RestoreBackup {
    /// One entry per restore STEP, in step order. The same `Chunk` the chunked
    /// verb takes, so a caller cannot be holding two shapes of the same thing.
    pub chunks: Vec<Chunk>,
    /// `links`, as the backup file spells it. Applied in this same transaction.
    #[serde(default)]
    pub links: RestoreLinks,
    /// Every restored row is re-owned to this login (X-6).
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What a finished restore did, in the shape the seam reports it.
#[derive(Debug, Serialize)]
pub struct RestoreBackupAnswer {
    /// Rows inserted PER CHUNK, in the order the chunks were given.
    ///
    /// A list rather than a total, and that is the seam's requirement rather
    /// than a convenience: `RestoreOutcome.restored` is *"rows the database
    /// reported inserting, per step, in restore order"*, and the restore screen
    /// prints it step by step. A single total would make the local edition the
    /// one engine whose progress report could not be drawn.
    ///
    /// It is positional, and the position is the caller's own chunk list, so
    /// nothing here has to know what a step is CALLED — the labels belong to the
    /// format, in TypeScript, where both other engines already read them.
    pub inserted: Vec<i64>,
    /// Accounts whose parent was patched by the link pass.
    pub accounts_relinked: i64,
    /// Transactions whose transfer link was patched by the link pass.
    pub transactions_relinked: i64,
    /// Figures the file carried that this ledger has nowhere to keep, named.
    ///
    /// Per COLUMN, never per table — see the port, which keeps it out of the
    /// seam's `notStoredLocally` for exactly that reason.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub dropped: Vec<Dropped>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct RestoreBackupResult {
    /// The projection the port answers the seam with.
    pub answer: RestoreBackupAnswer,
    /// Dense sequence number of the single audit row a restore writes.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Pour a whole backup file into an empty ledger, or change nothing at all.
///
/// # Errors
/// [`CoreError::Refused`] for `owner_unknown`, `restore_target_not_empty`,
/// `rows_not_an_array`, `restore_entity_unknown`, or `restore_row_refused`
/// naming the row a rule stopped; [`CoreError::Storage`] for a fault. Every one
/// of them leaves the file exactly as it was.
#[allow(clippy::needless_pass_by_value)]
pub fn restore_backup(
    connection: &mut Connection,
    command: RestoreBackup,
) -> CoreResult<RestoreBackupResult> {
    let Some(owner) = command.user_id.clone() else {
        return Err(CoreError::refuse(
            "owner_unknown",
            "could not establish which login to restore into",
        ));
    };

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    // Once, about the whole file, before a single row. See the module docs for
    // why this is stronger than the cloud's per-chunk test and why that is
    // allowed to be a divergence.
    if !is_empty(&transaction, &owner)? {
        return Err(target_not_empty());
    }

    let mut inserted: Vec<i64> = Vec::with_capacity(command.chunks.len());
    let mut dropped: Vec<Dropped> = Vec::new();

    for chunk in &command.chunks {
        let rows = rows_of(chunk)?;
        // An empty chunk beats the entity whitelist here too, and it must: the
        // caller sends one chunk per STEP and a ledger with no goals sends an
        // empty `goal_contributions`. Counting it as zero rather than skipping
        // it keeps `inserted` positional, which is what the labels are matched
        // against.
        if rows.is_empty() {
            inserted.push(0);
            continue;
        }
        inserted.push(insert_rows(&transaction, &chunk.entity, rows, &owner, &mut dropped)?);
    }

    // The second pass, in the same transaction as the first. This is the whole
    // of B-10 for this engine.
    let links = close_the_links(&transaction, &command.links, &owner)?;
    let entry = record_the_restore(&transaction, &owner, &links, &now)?;

    transaction.commit()?;

    Ok(RestoreBackupResult {
        answer: RestoreBackupAnswer {
            inserted,
            accounts_relinked: links.accounts_relinked,
            transactions_relinked: links.transactions_relinked,
            dropped,
        },
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::RestoreBackup;

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<RestoreBackup>(r#"{"chunks":[],"link":{}}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("link"), "{error}");
    }

    #[test]
    fn a_file_with_no_links_section_restores() {
        // Old files have no such key, and `remapBackupIds` can legitimately
        // produce an empty one. Neither may be a refusal: the links are a
        // second pass over rows that are already in.
        let command = serde_json::from_str::<RestoreBackup>(r#"{"chunks":[],"user_id":"u"}"#)
            .expect("links defaults to empty");
        assert!(command.links.account_parents.is_empty());
        assert!(command.links.transaction_links.is_empty());
    }
}
