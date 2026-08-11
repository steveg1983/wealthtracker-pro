//! `finalize_user_restore` — the second pass, and the one audit row a restore
//! writes.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260807083000_user_data_restore.sql:384-441`. Defined
//! once, never redefined.
//!
//! # Why it still exists locally, when the reason for it does not
//!
//! In the cloud this pass is a necessity: `accounts.parent_account_id` and the
//! `transactions ↔ transaction_splits` pair form cycles, no constraint in that
//! schema is DEFERRABLE, and so neither side can be inserted first. R-11. This
//! schema declares both of the cycle's keys `DEFERRABLE INITIALLY DEFERRED` and
//! `specs/r11-deferred-keys-close-the-transaction-split-cycle` proves one COMMIT
//! closes it, so the necessity is gone.
//!
//! The verb is ported anyway, for a reason that has nothing to do with
//! constraints: **the links are a separate payload in the backup file.**
//! `backupService.buildBackupBundle` writes `links.account_parents` and
//! `links.transaction_links` alongside the rows, and
//! `localBackupService.applyLinks` — the browser edition, which has no
//! constraints at all — applies them anyway *"because it is what
//! finalize_user_restore applies, and a file whose two copies disagree must
//! restore the same way on both engines rather than differently"*. That argument
//! is the whole case here too.
//!
//! # `updated_at`, and the one guard this family needs
//!
//! X-4. These are UPDATEs, and every UPDATE re-dates the row it touches — which
//! is why the cloud redefined `update_updated_at_column` in the same migration to
//! stand down while `app.restore_in_progress` is set. Locally the same exemption
//! is `_rpc_guard('restore')`, already in every `updated_at` trigger's WHEN
//! clause. MEASURED, both ways, on this schema:
//!
//! ```text
//! link update, no guard    -> updated_at 2026-08-08   (today)
//! link update, with guard  -> updated_at 2019-01-01   (the row's own date)
//! ```
//!
//! The consequence, in the migration's own words: *"a backup that returns a
//! decade of transfers dated today is not a backup"*.
//!
//! The guard is held UNCONDITIONALLY here, which is the opposite of the choice
//! [`super::delete_transaction`] and [`super::wipe_user_financial_data`] make
//! about `leg`, and for a reason: those two stand a PROTECTION down, so holding
//! it where it is not needed weakens a rule. This one stands a CONVENIENCE down —
//! a trigger whose only job is to stamp a timestamp on a row the writer did not
//! stamp — and every write this verb makes is a write that must keep its own
//! timestamp. There is no case where holding it is wrong.
//!
//! # Which rows it will not touch
//!
//! `AND user_id = v_owner`, and MEASURED: a link naming a row this login does not
//! have relinks nothing and refuses nothing — the count comes back 0. A NULL
//! parent is skipped by the RPC's own `IS NOT NULL` filter, and a transaction
//! link with both columns null by its `OR`, so neither is counted; both are
//! reproduced, because the counts are what the client reports to the user.
//!
//! A parent owned by somebody else is a different matter: MEASURED, the cloud
//! refuses it at `accounts_parent_account_id_user_fkey` — the composite key from
//! `20260808170000` — and this schema's twin refuses it too, by a name SQLite does
//! not give. Both refuse; only the wording differs.
//!
//! # The audit row, and the one place this deliberately does not match
//!
//! The cloud writes exactly one entry for the whole operation, and MEASURED it
//! has this shape:
//!
//! ```text
//! entity     account
//! entity_id  <the USER's id, not an account's>
//! action     update
//! before     NULL
//! after      {"event": "restore_completed", "accounts_relinked": n, "transactions_relinked": m}
//! ```
//!
//! An `update` with no `before`. The cloud's `financial_audit_log` has no
//! constraint on that pairing — MEASURED: its only CHECK is the action
//! enumeration. This schema has three, and `audit_update_has_both` is one of them
//! (U-6, listed in the canonical inventory as **local-only**): MEASURED, that
//! exact row is refused here with `CHECK constraint failed: audit_update_has_both`.
//!
//! So the local entry records the same fact, with the same entity, the same
//! entity_id and the same payload, under `create` instead of `update`. That is a
//! DECLARED divergence and it is the stricter reading rather than a workaround:
//! an audit entry claiming something was updated while refusing to say what it
//! was before is an entry that cannot answer the question the log exists for. A
//! restore completing is a fact that did not exist and now does, which is what
//! `create` means, and `audit_create_has_no_before` is satisfied by the same NULL
//! the cloud already writes.
//!
//! Recorded rather than fixed in the cloud, because changing a live audit row's
//! action is a migration with its own reasoning and this is a port.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};

/// One entry of `links.account_parents`.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccountParent {
    /// The child account.
    pub id: String,
    /// The account it nests under. A null is skipped, not written.
    #[serde(default)]
    pub parent_account_id: Option<String>,
}

/// One entry of `links.transaction_links`.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransactionLink {
    /// The row being relinked.
    pub id: String,
    /// Its counterpart transaction.
    #[serde(default)]
    pub linked_transfer_id: Option<String>,
    /// Its counterpart split line.
    #[serde(default)]
    pub linked_transfer_split_id: Option<String>,
}

/// `p_links`, as the backup file spells it.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RestoreLinks {
    /// Nested-account pairings.
    #[serde(default)]
    pub account_parents: Vec<AccountParent>,
    /// Transfer pairings, both kinds.
    #[serde(default)]
    pub transaction_links: Vec<TransactionLink>,
}

/// The command.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FinalizeUserRestore {
    /// `p_links`. Absent is an empty object, exactly as `p_links = NULL` is in
    /// the cloud — MEASURED: it relinks nothing and returns zeros.
    #[serde(default)]
    pub links: RestoreLinks,
    /// `p_user_id`.
    #[serde(default)]
    pub user_id: Option<String>,
}

/// The RPC's return value, key for key.
#[derive(Debug, Serialize)]
pub struct FinalizeAnswer {
    /// Accounts whose parent was patched.
    pub accounts_relinked: i64,
    /// Transactions whose transfer link was patched.
    pub transactions_relinked: i64,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct FinalizeUserRestoreResult {
    /// The projection both engines are compared on.
    pub answer: FinalizeAnswer,
    /// Dense sequence number of the single audit row.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Close the links a restore left open, without re-dating a single row.
///
/// # Errors
/// [`CoreError::Refused`] for `owner_unknown` or a rule the file enforced;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn finalize_user_restore(
    connection: &mut Connection,
    command: FinalizeUserRestore,
) -> CoreResult<FinalizeUserRestoreResult> {
    let Some(owner) = command.user_id.clone() else {
        return Err(CoreError::refuse(
            "owner_unknown",
            "could not establish which login to finalise",
        ));
    };

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let answer = close_the_links(&transaction, &command.links, &owner)?;
    let entry = record_the_restore(&transaction, &owner, &answer, &now)?;

    transaction.commit()?;

    Ok(FinalizeUserRestoreResult {
        answer,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The second pass itself, without the transaction around it.
///
/// Shared with [`super::restore_backup`], which runs it in the SAME transaction
/// as the inserts — which is the whole of divergence B-10 for this engine. The
/// pass is identical either way, and that is the point: *"the links travel in
/// the backup file as a separate payload, both engines must apply them the same
/// way, and a local edition that reached the same rows by a different route
/// would make the two files diverge in what they mean."* One route.
pub(super) fn close_the_links(
    transaction: &rusqlite::Transaction<'_>,
    links: &RestoreLinks,
    owner: &str,
) -> CoreResult<FinalizeAnswer> {
    // X-4. Set before the first UPDATE, cleared before the commit, so a refusal
    // anywhere below rolls the flag back with everything else.
    transaction.execute("INSERT OR IGNORE INTO _rpc_guard VALUES ('restore')", [])?;

    let mut accounts_relinked = 0_i64;
    for link in &links.account_parents {
        let Some(parent) = link.parent_account_id.as_deref() else { continue };
        let moved = transaction.execute(
            "UPDATE accounts
                SET parent_account_id = ?1
              WHERE id = ?2
                AND user_id = ?3",
            params![parent, link.id, owner],
        )?;
        accounts_relinked = accounts_relinked
            .checked_add(super::count(moved)?)
            .ok_or_else(too_many)?;
    }

    let mut transactions_relinked = 0_i64;
    for link in &links.transaction_links {
        if link.linked_transfer_id.is_none() && link.linked_transfer_split_id.is_none() {
            continue;
        }
        let moved = transaction.execute(
            "UPDATE transactions
                SET linked_transfer_id       = ?1,
                    linked_transfer_split_id = ?2
              WHERE id = ?3
                AND user_id = ?4",
            params![link.linked_transfer_id, link.linked_transfer_split_id, link.id, owner],
        )?;
        transactions_relinked = transactions_relinked
            .checked_add(super::count(moved)?)
            .ok_or_else(too_many)?;
    }

    transaction.execute("DELETE FROM _rpc_guard WHERE flag = 'restore'", [])?;

    Ok(FinalizeAnswer { accounts_relinked, transactions_relinked })
}

/// The one audit row a restore writes, whichever verb did the restoring.
///
/// Shared for the reason the entry exists: the log's answer to *"where did this
/// ledger come from"* must not depend on which door the file came through.
pub(super) fn record_the_restore(
    transaction: &rusqlite::Transaction<'_>,
    owner: &str,
    answer: &FinalizeAnswer,
    now: &str,
) -> CoreResult<crate::audit::AuditEntry> {
    let after = super::json_of(&serde_json::json!({
        "event": "restore_completed",
        "accounts_relinked": answer.accounts_relinked,
        "transactions_relinked": answer.transactions_relinked,
    }))?;
    audit::write(
        transaction,
        owner,
        "account",
        // The cloud puts the USER's id in an entity_id column that names an
        // account. Kept, because the entry is about the login rather than about
        // any one account, and changing it would make the two logs disagree
        // about which row a restore happened to.
        owner,
        // The divergence, and its reasoning, is in this module's header.
        Action::Create,
        None,
        Some(&after),
        now,
    )
}

fn too_many() -> CoreError {
    CoreError::refuse("amount_out_of_range", "that is more rows than this ledger can count")
}
