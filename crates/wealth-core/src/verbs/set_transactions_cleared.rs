//! `set_transactions_cleared` — the tick, which settles nothing.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260810200000_marking_is_not_reconciling.sql:143-183`,
//! which is the LIVE definition. It is a RESTATEMENT of
//! `20260707120000_reconciliation_cleared_rpcs.sql`'s function, unchanged except
//! for one `CASE`, and the `CASE` is the whole of the C/R split on the write
//! side. The client calls it at one place
//! (`transactionService.setTransactionsCleared`), from the reconciliation
//! screen's checkbox, its "Mark all", and the register's Space key.
//!
//! # THE TWO STATES, AND WHY THIS VERB OWNS ONLY ONE OF THEM
//!
//! Microsoft Money kept both against a transaction while you balanced an
//! account:
//!
//! | | what it is | what sets it |
//! | --- | --- | --- |
//! | **C** — `is_cleared` | a working note. Tick rows off the statement as you read it; the marks survive closing the window and coming back next week; nothing about the account has been settled | this verb, and every bank import |
//! | **R** — `is_reconciled` | committed, against a statement ending balance stated up front | [`super::finalize_reconciliation`] and nothing else |
//!
//! This schema had ONE flag doing both jobs, so *"Mark all cleared" WAS the
//! reconciliation*: leave the screen and the account showed nothing left to do.
//! The migration's own summary of the owner's words: marking *"should just be a
//! HOLDING state — leave the screen and those transactions are still yet to be
//! reconciled. It is Finalize Reconciliation that should complete things."*
//!
//! # The CASE, and the one thing it is NOT free to do
//!
//! ```sql
//! is_reconciled = CASE WHEN p_cleared THEN COALESCE(is_reconciled, is_cleared)
//!                      ELSE false END
//! ```
//!
//! Two rules in one expression, and `src/utils/transactionReconciliation.ts`
//! (`reconciledAfterMarking`) is where the app states the same pair:
//!
//! * **marking KEEPS whatever the row said about commitment.** Marking a
//!   committed row changes nothing about the commitment.
//! * **UNMARKING CLEARS IT.** A row that is not ticked cannot be a row a
//!   statement was balanced against, and the pair (committed, unmarked) would
//!   put the cleared balance and the reconciled set permanently out of step.
//!
//! `COALESCE` rather than a bare read, and the migration says why: a NULL means
//! *"ask `is_cleared`"*, and the rows this loop touches are BY DEFINITION the
//! ones whose `is_cleared` is changing — so writing the resolved answer down is
//! what stops the ambiguity outliving the change.
//!
//! **The right-hand side reads the row BEFORE the update, on both engines.** In
//! Postgres an UPDATE's SET expressions see the old row; here the old row is
//! [`row::TransactionRow`], read at the top of the loop, and the resolution is
//! `before.is_reconciled.unwrap_or(before.is_cleared)`. Written as one
//! expression in one place for the same reason the SQL is: two spellings of a
//! three-valued rule is how the two drift.
//!
//! **What this file's own CHECK does to the marking branch, stated so the next
//! reader does not think the branch is dead.** `transactions_reconciled_implies_
//! cleared` means a local row with `is_cleared = 0` can only carry
//! `is_reconciled` 0 or NULL, and the loop only selects rows whose `is_cleared`
//! is about to change — so on a marking call the COALESCE always resolves to
//! `false` HERE, while in the cloud it can resolve to `true` for a row the
//! update RPC left committed-but-unmarked. The branch is not dead: it is what
//! turns a pre-split NULL into an explicit `false`, which is the whole reason
//! the migration wrote a CASE instead of `is_reconciled = false`.
//!
//! # Which rows it touches
//!
//! `is_cleared IS DISTINCT FROM p_cleared` is in the CURSOR, not in the update,
//! so a row already in the requested state is not selected: no write, no audit
//! entry, and — the part that matters for a file — no movement of `updated_at`,
//! so re-ticking a ticked row cannot make it look freshly edited to a backup
//! diff. The owner clause is in the cursor too, so a foreign row is skipped in
//! silence rather than refused; that is the bulk-verb shape
//! [`super::apply_category_to_uncategorized`] and
//! [`super::confirm_transaction_categories`] already have, and it is deliberate
//! — a stale list of ids must not fail a whole tick.
//!
//! # Balance-neutral, and the sweep it now consults without firing
//!
//! Two flags and a timestamp. No amount, no account, no sign.
//!
//! It writes `is_reconciled` on every row it touches, so
//! `trg_sweep_reconciled_into_archive` IS consulted on every mark and every
//! unmark — and stands down every time, because the trigger fires only on a
//! transition TO 1 and this verb never writes 1. That is the fix the split
//! bought: under the old trigger, ticking a row dated before its account's
//! cutoff made the row VANISH from the very list the ticking happens on, and a
//! row you cannot see is a row you cannot untick.
//!
//! # Which guard it holds: none, and measured
//!
//! `is_cleared`, `is_reconciled` and `updated_at`. Every split protection in
//! `schema.sql` is `BEFORE UPDATE OF <column>` over a list of `is_split`,
//! `amount_minor`, `type` and `category`; none of the three appears in any of
//! them. `tests/reconciliation_family.rs` asserts the guard table empty across a
//! marking call rather than reasoning about it.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::row::{self, WrittenTransaction};
use crate::wire::Flag;

/// The command: `(p_ids, p_cleared, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetTransactionsCleared {
    /// `p_ids`. Every row being ticked, or unticked.
    #[serde(default)]
    pub ids: Option<Vec<String>>,
    /// `p_cleared`. Which way. Required, because the RPC's argument has no
    /// default and a call that did not say would be a call that could mean
    /// either.
    pub cleared: Flag,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The RPC returns a bare integer. The count is named `changed` rather than
/// `cleared` on purpose: this verb also UNticks, and a key called `cleared`
/// carrying "3" after an unmarking call would be read as three rows now ticked.
#[derive(Debug, Serialize)]
pub struct SetTransactionsClearedResult {
    /// The FIRST row named, as stored after the call.
    pub transaction: Option<WrittenTransaction>,
    /// How many rows really changed. A row already in the requested state is
    /// not written and is not counted.
    pub changed: i64,
    /// Those rows, as stored, in the order they were written (by id).
    pub transactions: Vec<WrittenTransaction>,
    /// Dense sequence number of the LAST audit row written, when any was.
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    pub audit_row_hash: Option<String>,
}

/// Mark rows off against a statement, or take the mark back.
///
/// # Errors
/// [`CoreError::InvalidCommand`] if `cleared` is not a boolean;
/// [`CoreError::Storage`] for a fault. There is no named refusal: an id nobody
/// has, and an id belonging to somebody else, are both skipped, which is what
/// makes the count the number of rows that really changed.
#[allow(clippy::needless_pass_by_value)]
pub fn set_transactions_cleared(
    connection: &mut Connection,
    command: SetTransactionsCleared,
) -> CoreResult<SetTransactionsClearedResult> {
    let cleared = command
        .cleared
        .resolve()
        .map_err(|message| CoreError::InvalidCommand(format!("cleared: {message}")))?;

    let named = command.ids.clone().unwrap_or_default();
    if named.is_empty() {
        return Ok(SetTransactionsClearedResult {
            transaction: None,
            changed: 0,
            transactions: Vec::new(),
            audit_seq: None,
            audit_row_hash: None,
        });
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    let mut written = Vec::new();
    let mut entry = None;
    for id in super::distinct_ids(&named) {
        let Some(before) = row::read_owned_transaction(&write, id, owner)? else {
            continue;
        };
        // `is_cleared IS DISTINCT FROM p_cleared`, in the cursor.
        if before.is_cleared == cleared {
            continue;
        }

        // The CASE, resolved against the row as it stands BEFORE the write —
        // which is what the SQL does and why it is spelled with a COALESCE.
        let reconciled = if cleared {
            before.is_reconciled.unwrap_or(before.is_cleared)
        } else {
            false
        };

        let changed = write.execute(
            "UPDATE transactions
                SET is_cleared    = ?1,
                    is_reconciled = ?2,
                    updated_at    = ?3
              WHERE id = ?4",
            params![i64::from(cleared), i64::from(reconciled), now, before.id],
        )?;
        if changed != 1 {
            return Err(CoreError::refuse(
                "transaction_not_found",
                "a transaction being marked disappeared between finding it and writing it",
            ));
        }
        let after = row::read_transaction(&write, &before.id)?;

        entry = Some(audit::write(
            &write,
            &after.user_id,
            "transaction",
            &after.id,
            Action::Update,
            Some(&super::json_of(&before)?),
            Some(&super::json_of(&after)?),
            &now,
        )?);
        // The result projection, taken beside the audit rather than instead of
        // it: `after` is what the audit above serialised and this adds the one
        // column the answer needs and the chain does not.
        written.push(row::written(&write, after)?);
    }

    let first = named
        .first()
        .map(|id| row::read_owned_transaction(&write, id, None))
        .transpose()?
        .flatten()
        .map(|row| row::written(&write, row))
        .transpose()?;

    let count = super::count(written.len())?;

    write.commit()?;

    Ok(SetTransactionsClearedResult {
        transaction: first,
        changed: count,
        transactions: written,
        audit_seq: entry.as_ref().map(|entry| entry.seq),
        audit_row_hash: entry.map(|entry| entry.row_hash),
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::SetTransactionsCleared;

    #[test]
    fn which_way_is_not_optional() {
        // The RPC's argument has no default, so a payload that does not say is
        // a payload that could mean either — and silently marking would be the
        // worse of the two guesses.
        let error = serde_json::from_str::<SetTransactionsCleared>(r#"{"ids":["a"]}"#)
            .expect_err("a marking call must say which way");
        assert!(error.to_string().contains("cleared"), "{error}");
    }

    #[test]
    fn the_committed_flag_is_not_an_argument() {
        // Marking may never set the commitment directly: that is finalize's, and
        // a verb that accepted it would be a second door to Money's R.
        let error = serde_json::from_str::<SetTransactionsCleared>(
            r#"{"ids":["a"],"cleared":true,"is_reconciled":true}"#,
        )
        .expect_err("there is nowhere to put a commitment");
        assert!(error.to_string().contains("`is_reconciled`"), "{error}");
    }
}
