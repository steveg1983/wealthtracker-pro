//! `collect_backup` — every table this file holds, whole, as the file the user
//! downloads.
//!
//! # What it is a port OF, and why that sentence is different this time
//!
//! `backupService.collectBackupBundle` — the TypeScript that reads the cloud's
//! fifteen tables with `select('*')`, a page at a time, and hands the rows to
//! `buildBackupBundle`. There is no Postgres FUNCTION to port: the cloud's
//! collector is a client walking PostgREST, exactly as the account, category,
//! planning and dismissal families' writers are clients walking PostgREST
//! (PHASE3-PLAN D-2, argued at the head of [`crate::verbs`]).
//!
//! So this verb ports the READ half of that walk, and it ports **only** the read
//! half. What it does not touch is deliberate and is the whole reason the local
//! edition's file is the same file as the cloud's:
//!
//! ```text
//! collectBackupBundle          where it lives locally
//! ──────────────────────────   ─────────────────────────────────────────────
//! read every row of a table    HERE (crate::backup::read_rows)
//! buildBackupBundle            the PORT — the same TypeScript function the
//!                              cloud and browser editions call
//!   the format tag             ↑ its constant
//!   the schema version         ↑ its constant
//!   counts per entity          ↑ derived from the rows
//!   links.account_parents      ↑ read off the rows, by column name
//!   links.transaction_links    ↑ likewise
//!   the money-precision guard  ↑ findUnsafeMoneyValues
//! ```
//!
//! A Rust copy of `buildBackupBundle` would be a SECOND builder of one format,
//! and the format is the only thing making a backup portable between editions.
//! One builder, three engines — which is `localBackupService`'s own decision,
//! stated there in the same words: *"this module supplies rows from browser
//! storage and hands them to the same builder: one format, one validator, one id
//! remapper, two storage engines."* This makes it three.
//!
//! # Whole rows, and what "whole" costs to get wrong
//!
//! `dataPort.ts`: *"WHOLE ROWS, NOT APP STATE. The file has to be restorable,
//! and app state is a lossy picture of the store by design."* The rows here come
//! from [`crate::backup::read_rows`], which walks the same column tables the
//! restore walks, in reverse — so a column that can be restored can be
//! collected, by construction rather than by two lists agreeing.
//!
//! Three columns are in the file and NOT in those insert tables:
//! `accounts.parent_account_id`, `transactions.linked_transfer_id` and
//! `transactions.linked_transfer_split_id`. They are the cycles
//! `finalize_user_restore` closes on a second pass, and `buildBackupBundle`
//! reads them straight off the rows to build the `links` payload. A collect that
//! left them out would export a ledger whose every transfer came back unpaired
//! — silently, in the only copy.
//!
//! # It reads, and reads only
//!
//! No audit row, and that is the same answer [`super::restore_user_chunk`] gives
//! for the opposite reason. A restore writes nothing to the log because the
//! cloud's does not; a collect writes nothing because **taking a copy is not a
//! change to the ledger**, and an entry saying otherwise would put a row in the
//! hash chain for an operation that moved no money and altered no field. The
//! export screen's own record of "you took a backup" belongs to the app.
//!
//! # One transaction, DEFERRED, for [`super::load_boot`]'s reason
//!
//! Fifteen SELECTs are fifteen snapshots unless something makes them one, and
//! a file whose `transaction_splits` were read after an import that its
//! `transactions` predate is a file that will not restore: the lines would name
//! parents the backup does not contain. `DEFERRED` rather than `IMMEDIATE`
//! because this takes no write lock to do no writing — a backup must never be
//! the reason a write cannot start.
//!
//! # What it costs
//!
//! Fifteen table scans by `user_id`, plus one child lookup per transaction and
//! per dismissal. The child lookups are the shape worth naming: they are indexed
//! primary-key probes (`transaction_tags` is `WITHOUT ROWID` on
//! `(transaction_id, tag)`), and the alternative — one join emitting a row per
//! tag — would put the grouping in this file instead of in SQLite's index. Not
//! measured at the fifty-thousand-row size, because nothing yet calls this on a
//! ledger that size; when the desktop shell does, `tests/reads_at_scale.rs` is
//! where the number goes.

use rusqlite::{Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::backup::{self, Entity};
use crate::error::{CoreError, CoreResult};

/// The command. One argument, because a backup has exactly one question to ask.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectBackup {
    /// Whose ledger. Absent is refused rather than guessed — see below.
    #[serde(default)]
    pub user_id: Option<String>,
}

/// The rows, entity by entity, in `BACKUP_ENTITIES` order.
///
/// A `Map` rather than fifteen named fields: the port hands this straight to
/// `buildBackupBundle`, whose input is keyed by entity name, and fifteen fields
/// here would be a sixteenth place to spell the entity list. [`Entity::ALL`] is
/// that list, and it is walked rather than transcribed.
#[derive(Debug, Serialize)]
pub struct Collected {
    /// Entity name → every row of that table, whole, ordered by id.
    pub data: Map<String, Value>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct CollectBackupResult {
    /// The projection the port builds the file from.
    pub answer: Collected,
}

/// Read every table this login owns, whole, in one snapshot.
///
/// # Errors
/// [`CoreError::Refused`] with `owner_unknown` when no owner was named — the
/// same refusal [`super::restore_user_chunk`] gives, and for the sharper of the
/// two reasons the seam states: *"a backup taken against an unresolved identity
/// would hand a signed-in person a file made of whatever demo or imported data
/// their browser happens to hold, and they would find out on the day they needed
/// it."* [`CoreError::Storage`] for a fault, which is NOT softened into an empty
/// file: fifteen empty lists is what a new file legitimately collects to.
#[allow(clippy::needless_pass_by_value)]
pub fn collect_backup(
    connection: &mut Connection,
    command: CollectBackup,
) -> CoreResult<CollectBackupResult> {
    let Some(owner) = command.user_id.clone() else {
        return Err(CoreError::refuse(
            "owner_unknown",
            "could not establish whose ledger to back up",
        ));
    };

    let snapshot = connection.transaction_with_behavior(TransactionBehavior::Deferred)?;

    let mut data = Map::new();
    for entity in Entity::ALL {
        let rows = backup::read_rows(&snapshot, entity, &owner)?;
        // An entity with no rows is an empty array rather than a missing key,
        // which is `buildBackupBundle`'s rule and its reason: *"a reader should
        // not have to tell 'this user has no investments' apart from 'this
        // export forgot about investments'."*
        data.insert(entity.as_str().to_owned(), Value::Array(rows));
    }

    // Committed rather than dropped, for [`super::load_boot`]'s reason: dropping
    // rolls back, which for fifteen SELECTs releases the same lock and says a
    // different thing.
    snapshot.commit()?;

    Ok(CollectBackupResult { answer: Collected { data } })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::CollectBackup;

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<CollectBackup>(r#"{"userId":"x"}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("userId"), "{error}");
    }

    #[test]
    fn an_absent_owner_parses_and_is_refused_by_the_verb_rather_than_by_serde() {
        // The refusal has to be the VERB's, because `owner_unknown` is a
        // sentence a person reads. A serde error would arrive as
        // `invalid_command` and say "missing field `user_id`".
        let command = serde_json::from_str::<CollectBackup>("{}").expect("an empty object parses");
        assert!(command.user_id.is_none());
    }
}
