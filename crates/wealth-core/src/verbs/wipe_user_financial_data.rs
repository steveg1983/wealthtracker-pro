//! `wipe_user_financial_data` — the port of "delete everything".
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260807083000_user_data_restore.sql:143-211`. Defined
//! once, never redefined.
//!
//! # The refusal order, measured rather than read
//!
//! Two refusals, and which one fires first is part of the contract because a
//! caller with neither a phrase nor an owner must be told about the phrase — the
//! thing they can fix — and not about an identity problem they cannot. MEASURED
//! on the reference cluster:
//!
//! ```text
//! confirm = NULL,   owner = named   -> wipe_not_confirmed
//! confirm = wrong,  owner = named   -> wipe_not_confirmed
//! confirm = right,  owner = none    -> owner_unknown
//! confirm = wrong,  owner = none    -> wipe_not_confirmed     <- the order
//! ```
//!
//! The phrase is compared with `IS DISTINCT FROM`, so it is exact: case, spacing
//! and all. `localBackupService.LOCAL_WIPE_CONFIRMATION` holds the same literal
//! *"so both engines ask the same"*.
//!
//! # Accounts first, and what the returned counts really say
//!
//! X-3. Deleting categories while their accounts are still there raises
//! `transfer_category_protected` — MEASURED here too, on this schema:
//! `DELETE FROM categories` first is REFUSED, and 5 categories are left standing.
//! Accounts first means each To/From category arrives at C-5's trigger with its
//! account row already gone, so the guard's `EXISTS` is false and it stands down.
//!
//! The consequence for the numbers this returns is worth stating, because they
//! are not what a reader expects. MEASURED on the reference cluster, on a fixture
//! holding two accounts, one transaction and five categories:
//!
//! ```text
//! {"accounts": 2, "transactions": 0, "categories": 3, "budgets": 0, "goals": 0, "investments": 0}
//! ```
//!
//! **Zero transactions**, because the account delete already cascaded them away,
//! and **three** categories rather than five, because the two To/From rows went
//! with their accounts. Each number is an honest report of what ITS OWN statement
//! removed, and none of them is a report of what the operation removed. That is
//! reproduced exactly rather than improved on — but not by `changes()`; see the
//! measurement beside the delete helper for the one place SQLite and Postgres
//! genuinely disagree about how many rows a statement took.
//!
//! # The guard, and the schema defect this verb found
//!
//! `verbs/mod.rs` recorded, before this verb existed, that the wipe owes
//! `_rpc_guard('leg')`. It does, and MEASURED confirms it: without the guard,
//! `DELETE FROM accounts` on a file holding one split transfer leg raises
//! `split_leg_line_removed`, and `_rpc_guard('split')` does not help.
//!
//! What the obligation did not know is that the guard alone was not enough
//! either. `trg_unnest_account_references` nulls `transfer_account_id` in a BEFORE
//! DELETE trigger, which leaves the row half-cleared for one statement — and
//! `transactions_linked_has_target`, a CHECK this schema has and the cloud does
//! not, refuses that state. So "delete everything" was refused outright on any
//! file containing a single linked transfer, which is every real file. The fix is
//! in `schema.sql` (the trigger now clears the LINK before the target, exactly as
//! Postgres's two independent key actions do a moment later) and is pinned by
//! `specs/t8-deleting-an-account-unlinks-the-transfer-that-pointed-at-it` and
//! `specs/r5-deleting-an-account-unlinks-the-split-leg-that-pointed-at-it`.
//!
//! # What it does NOT delete
//!
//! * **The audit log.** MEASURED on both engines: the rows this verb writes, and
//!   every row written before it, survive. That is the point — the log is the only
//!   thing that can still say what was there.
//! * **The `users` row.** The login stays; only its financial data goes.
//! * **`recurring_transactions`, in the cloud.** The RPC has no DELETE for them
//!   and the cloud table has no foreign key on `account_id`, so MEASURED they
//!   survive a cloud wipe. Locally `recurring_transactions.account_id` IS a
//!   foreign key with ON DELETE CASCADE, so a template naming an account goes with
//!   it and one naming no account stays. A DECLARED divergence, and the local
//!   behaviour is the one that leaves less wreckage: a template pointing at an
//!   account that no longer exists is a scheduled payment into nothing.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row;

/// The exact phrase. `localBackupService.LOCAL_WIPE_CONFIRMATION` and the RPC's
/// own literal, so all three ask for the same words.
pub const CONFIRMATION: &str = "DELETE EVERYTHING";

/// The command. The RPC's two arguments.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WipeUserFinancialData {
    /// `p_confirm`. Compared exactly.
    #[serde(default)]
    pub confirm: Option<String>,
    /// `p_user_id`.
    #[serde(default)]
    pub user_id: Option<String>,
}

/// Per-table counts, spelled and ordered as the RPC's jsonb spells them.
#[derive(Debug, Serialize)]
pub struct WipeCounts {
    /// Accounts deleted. Their transactions, To/From categories and holdings go
    /// with them and are counted by none of the fields below.
    pub accounts: i64,
    /// Transactions the account delete did NOT already take. Zero on any file
    /// where every transaction belongs to an account, which is every file.
    pub transactions: i64,
    /// Categories left after the To/From rows cascaded.
    pub categories: i64,
    /// Budgets deleted.
    pub budgets: i64,
    /// Goals deleted. Their contributions cascade.
    pub goals: i64,
    /// Holdings deleted. Their movements cascade.
    pub investments: i64,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct WipeUserFinancialDataResult {
    /// The RPC's own return value.
    pub answer: WipeCounts,
    /// Dense sequence number of the LAST audit row written, or `None` when there
    /// was nothing to audit.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit_seq: Option<i64>,
}

/// Erase this login's financial data so a backup can be restored into it.
///
/// # Errors
/// [`CoreError::Refused`] for `wipe_not_confirmed`, `owner_unknown`, or a rule
/// the file enforced; [`CoreError::Storage`] for a fault.
// Long, and deliberately not split. The RPC is one function whose ORDER is its
// whole contract — audit before deleting, accounts before categories, the guard
// around all of it — and every extraction that has been tried moves one of those
// statements somewhere a reader has to go and find it.
#[allow(clippy::too_many_lines)]
#[allow(clippy::needless_pass_by_value)]
pub fn wipe_user_financial_data(
    connection: &mut Connection,
    command: WipeUserFinancialData,
) -> CoreResult<WipeUserFinancialDataResult> {
    // Both refusals are decided BEFORE a transaction is opened: neither depends
    // on the file's contents, and the order between them is the measured one.
    if command.confirm.as_deref() != Some(CONFIRMATION) {
        return Err(CoreError::Refused(
            Refusal::named(
                "wipe_not_confirmed",
                "this erases every account, transaction, budget and goal in this login — the \
                 caller must pass the exact confirmation phrase",
            )
            .with_hint(&format!("The phrase is {CONFIRMATION}, exactly.")),
        ));
    }
    let Some(owner) = command.user_id.clone() else {
        return Err(CoreError::refuse(
            "owner_unknown",
            "could not establish which account to clear",
        ));
    };

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    // ── R-5. Held only where a split line is actually a transfer leg. ───────
    // A guard that is always on is not a guard: this one stands two protection
    // triggers down across the largest delete in the product, and it should do
    // so only on the files that need it.
    let guarded: i64 = transaction.query_row(
        "SELECT EXISTS (
           SELECT 1 FROM transaction_splits WHERE user_id = ?1 AND linked_transfer_id IS NOT NULL
         )",
        params![owner],
        |row| row.get(0),
    )?;
    if guarded != 0 {
        transaction.execute("INSERT OR IGNORE INTO _rpc_guard VALUES ('leg')", [])?;
    }

    // ── The per-row audit, BEFORE deleting, while the rows still exist to
    //    describe. Transactions then accounts, the RPC's own order.
    //
    // ORDER BY id is a local strengthening: the cloud's cursors have no ORDER BY
    // and the row order it writes in is whatever the executor picks. Here the
    // order is part of the hash chain, so it has to be one somebody can
    // reproduce.
    let ids = |sql: &str| -> CoreResult<Vec<String>> {
        let mut statement = transaction.prepare(sql)?;
        let rows = statement.query_map(params![owner], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for id in rows {
            out.push(id?);
        }
        Ok(out)
    };

    let mut last_seq = None;
    for id in ids("SELECT id FROM transactions WHERE user_id = ?1 ORDER BY id")? {
        let before = row::read_transaction(&transaction, &id)?;
        let payload = super::json_of(&before)?;
        let entry = audit::write(
            &transaction,
            &owner,
            "transaction",
            &id,
            Action::Delete,
            Some(&payload),
            None,
            &now,
        )?;
        last_seq = Some(entry.seq);
    }
    for id in ids("SELECT id FROM accounts WHERE user_id = ?1 ORDER BY id")? {
        let Some(before) = row::account::read_owned(&transaction, &id, &owner)? else {
            continue;
        };
        let payload = super::json_of(&before)?;
        let entry = audit::write(
            &transaction,
            &owner,
            "account",
            &id,
            Action::Delete,
            Some(&payload),
            None,
            &now,
        )?;
        last_seq = Some(entry.seq);
    }

    // ── The deletes, in the RPC's order. Accounts first is X-3. ─────────────
    //
    // The number reported is the count of rows the statement is ABOUT to remove,
    // read a statement earlier under the same predicate — not `changes()`. That
    // is a departure from this crate's usual discipline and it was forced by a
    // measurement:
    //
    //   postgres  DELETE FROM categories WHERE user_id = …  ROW_COUNT 3
    //   sqlite    the same statement                        changes()  2
    //
    // The fixture holds Outgoings and its child Weekly shop. SQLite deletes rows
    // one at a time, so `categories.parent_id ON DELETE CASCADE` takes Weekly
    // shop while the statement is still walking towards it, and the row is gone
    // before it can be counted. Postgres computes the statement's row set first
    // and counts all three. Both engines end with the same rows deleted; only the
    // number differs, and SQLite's is an artifact of execution order rather than
    // a fact about the data.
    //
    // Three was the honest answer: this number is shown to a user as "categories
    // erased", and it is also what the cloud reports. The `changes()` assert this
    // replaces is not lost — it is replaced by a STRONGER one, below, which
    // checks that the table holds none of this login's rows afterwards. That
    // catches everything a row count would and one thing it would not: a DELETE
    // that removed the rows it counted while a trigger put one back.
    let delete = |table: &str| -> CoreResult<i64> {
        let counted: i64 = transaction.query_row(
            &format!("SELECT COUNT(*) FROM {table} WHERE user_id = ?1"),
            params![owner],
            |row| row.get(0),
        )?;
        transaction.execute(&format!("DELETE FROM {table} WHERE user_id = ?1"), params![owner])?;
        let left: i64 = transaction.query_row(
            &format!("SELECT COUNT(*) FROM {table} WHERE user_id = ?1"),
            params![owner],
            |row| row.get(0),
        )?;
        if left != 0 {
            return Err(CoreError::refuse(
                "wipe_incomplete",
                &format!("{left} row(s) of {table} survived a wipe that should have taken them"),
            ));
        }
        Ok(counted)
    };

    let answer = WipeCounts {
        accounts: delete("accounts")?,
        transactions: delete("transactions")?,
        categories: delete("categories")?,
        budgets: delete("budgets")?,
        goals: delete("goals")?,
        investments: delete("investments")?,
    };

    // Counted by nothing, exactly as the RPC counts them by nothing: these are
    // UI state, and a number telling a user how many dismissed suggestions they
    // just lost is not a number anybody wants.
    for table in ["suggestion_dismissals", "dashboard_layouts", "widget_preferences", "notifications"] {
        delete(table)?;
    }

    if guarded != 0 {
        transaction.execute("DELETE FROM _rpc_guard WHERE flag = 'leg'", [])?;
    }
    transaction.commit()?;

    Ok(WipeUserFinancialDataResult { answer, audit_seq: last_seq })
}
