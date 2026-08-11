//! `delete_transaction` — the port of `delete_transaction_atomic`.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260610150000_financial_audit_log.sql:207-243`. Traced
//! by grep across all sixty-two migration files: this function has been
//! redefined exactly once, and only to add the audit write.
//!
//! | migration | change |
//! | --- | --- |
//! | `20260610140000:162` | the original: delete + `balance = balance − amount` + `p_user_id` |
//! | `20260610150000:207` | adds the `write_financial_audit` call (U-1) |
//!
//! Two later files mention it without changing it:
//! `20260612110000:4` records that delete *already* took `p_user_id` when update
//! did not (which is why the update verb's IDOR guard is a separate migration
//! and this one's is original), and `20260725120000:314` restates its grants.
//!
//! # The obligation that was written down before this verb existed (R-5)
//!
//! `verbs/mod.rs` carries it, and `PHASE1-PLAN.md`'s addendum §A is where it was
//! measured:
//!
//! > SQLite applies `ON DELETE SET NULL` as an **UPDATE of the child row**, and
//! > that UPDATE fires `trg_protect_linked_leg`, which raises `split_leg_locked`.
//!
//! Postgres allows the same delete and clears the link. So without a guard the
//! local file refuses a delete the cloud performs — and the trap is worse than a
//! divergence, because the message the user is shown for the *first* refusal is
//! *"delete that transfer first, then edit the split"*, and that remedy is
//! itself the refused operation. A user following the app's own instruction hits
//! a dead end.
//!
//! This verb therefore holds `_rpc_guard('leg')` across the delete, and only
//! then. MEASURED, both engines, 2026-08-08:
//!
//! ```text
//! sqlite, no guard   REFUSED  split_leg_locked
//! sqlite, guard      OK       split line survives, its link CLEARED
//! postgres           OK       split line survives, its link CLEARED
//! ```
//!
//! ## The half of the obligation the addendum had not seen
//!
//! The addendum says the guard is needed *"iff a split line links to it"*. That
//! is one of the two directions this delete can touch a leg, and the second was
//! found while writing this verb:
//!
//! * **inbound** — some split line elsewhere has `linked_transfer_id = <this
//!   row>`. Deleting it fires SET NULL on that line: an UPDATE, and
//!   `trg_protect_linked_leg` raises. This is the addendum's case.
//! * **outbound** — *this row* is a split parent and one of its own lines is a
//!   leg. Deleting it CASCADEs those lines away, and
//!   `trg_protect_linked_leg_delete` raises `split_leg_line_removed`.
//!
//! MEASURED: Postgres accepts the second too, so a guard that covered only the
//! first would leave "delete a split transaction that has a transfer line"
//! working in the cloud and refused locally — an ordinary thing to do, silently
//! divergent.
//!
//! The trigger's stated fear ("the transaction on the other side would be left
//! pointing at a line that no longer exists") is not what happens on this path:
//! `transactions.linked_transfer_split_id` is itself `ON DELETE SET NULL`, so
//! the counterpart is *stranded*, exactly as T-8 intends, not left pointing at a
//! ghost. That trigger exists to stop the **split writer** removing a leg line
//! while its parent survives, which is a different operation. So the guard is
//! held for both directions and the two engines agree; the reasoning is recorded
//! here because it extends an obligation somebody else wrote down.
//!
//! ## Why the guard is conditional rather than always held
//!
//! Holding it unconditionally would be simpler and would also work. It is
//! conditional because a guard that is always on is not a guard: an ordinary
//! delete has no business standing down a protection trigger, and the day this
//! verb grows a second statement, the narrow version is what refuses to let it
//! touch a leg by accident.
//!
//! # What a delete does NOT do
//!
//! * **It does not delete an account, a category or a split's siblings by
//!   hand.** `transaction_splits.transaction_id` and `transaction_tags` cascade;
//!   `suggestion_dismissals` are pruned by `trg_prune_suggestion_dismissals`
//!   (the port of `20260806180000:156-170`). All of that is the file's job and
//!   none of it is repeated here.
//! * **It does not unlink the other half of a transfer.** It does not have to:
//!   `linked_transfer_id` is `ON DELETE SET NULL` in both engines, so the
//!   survivor becomes an ordinary unlinked transfer — the *deliberate*
//!   stranding, `20260716100000:27-29`: *"deleting one side never leaves the
//!   survivor pointing at a ghost (it simply becomes an unlinked transfer
//!   again, eligible for re-linking)"*.
//! * **It does not archive instead.** Archiving is `set_transaction_archived`.
//!   Deleting means deleting.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::{self, TransactionRow};

/// The command. The RPC's two arguments, `(p_id, p_user_id)`, as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteTransaction {
    /// `p_id`. Which row.
    pub id: String,
    /// `p_user_id`. Absent means "name no owner"; see the update verb's note on
    /// what that means locally.
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back: the row that was deleted, and its audit entry.
#[derive(Debug, Serialize)]
pub struct DeleteTransactionResult {
    /// The row as it stood immediately before the delete — the RPC returns the
    /// same thing, and it is what `before_data` in the audit log holds.
    pub transaction: TransactionRow,
    /// Dense sequence number of the audit row written for this delete.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Delete one transaction, reverse its effect on its account, and audit it — all
/// in one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for a named refusal or a constraint the file enforced;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn delete_transaction(
    connection: &mut Connection,
    command: DeleteTransaction,
) -> CoreResult<DeleteTransactionResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    // The cloud does this as one `DELETE … RETURNING *` with `IF NOT FOUND`.
    // Locally it is a read and then a delete, which is equivalent under
    // BEGIN IMMEDIATE (one writer, nothing can interleave) and necessary
    // anyway: the audit row's `before` has to be what storage held.
    match transaction.query_row(
        "SELECT 1 FROM transactions
          WHERE id = ?1
            AND (?2 IS NULL OR user_id = ?2)",
        params![command.id, command.user_id],
        |row| row.get::<_, i64>(0),
    ) {
        Ok(_) => {}
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(CoreError::Refused(
                Refusal::named("transaction_not_found", "transaction_not_found").with_hint(
                    "The transaction does not exist or does not belong to this user.",
                ),
            ))
        }
        Err(error) => return Err(error.into()),
    }

    let before = row::read_transaction(&transaction, &command.id)?;

    // ── R-5. The leg guard, held only where the design says. ────────────────
    let guarded = touches_a_transfer_leg(&transaction, &command.id)?;
    if guarded {
        transaction.execute("INSERT OR IGNORE INTO _rpc_guard VALUES ('leg')", [])?;
    }

    let removed = transaction.execute(
        "DELETE FROM transactions
          WHERE id = ?1
            AND (?2 IS NULL OR user_id = ?2)",
        params![command.id, command.user_id],
    )?;

    if guarded {
        // Inside the same transaction as the delete it authorised, so a refusal
        // anywhere below rolls the flag back with everything else. A stray row
        // is impossible rather than merely unlikely (schema.sql §6).
        transaction.execute("DELETE FROM _rpc_guard WHERE flag = 'leg'", [])?;
    }

    // `id` is the primary key, so more than one is unreachable and zero would
    // mean the row went between finding it and deleting it. The same assert the
    // create verb makes, for the same reason: SQLite reports zero changed rows
    // and raises nothing at all.
    if removed != 1 {
        return Err(CoreError::refuse(
            "transaction_not_found",
            "the row disappeared between finding it and deleting it",
        ));
    }

    // ── B-2. Reverse the effect, relatively, in SQL. ────────────────────────
    let restored = transaction.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor - ?1,
                updated_at = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![before.amount.minor(), now, before.account_id, before.user_id],
    )?;
    if restored != 1 {
        // Reachable: a transaction whose `user_id` is this caller but whose
        // account belongs to somebody else. Neither schema forbids that pairing,
        // and without this assert the row would vanish while the balance it was
        // part of kept its money — a permanent, silent B-1 violation produced by
        // a faithful-looking port of B-2 (AUDIT3 §3).
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    }

    let before_json = serde_json::to_string(&before)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;

    let entry = audit::write(
        &transaction,
        &before.user_id,
        "transaction",
        &command.id,
        Action::Delete,
        Some(&before_json),
        // U-6: a delete has no `after`. The local table's
        // `audit_delete_has_no_after` check says so too.
        None,
        &now,
    )?;

    transaction.commit()?;

    Ok(DeleteTransactionResult {
        transaction: before,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// Would deleting this row make SQLite touch a linked split leg?
///
/// Both directions, for the reason set out in the module docs:
///
/// * a line somewhere else points AT this row — SET NULL, an UPDATE, and
///   `trg_protect_linked_leg`;
/// * this row is a split parent one of whose OWN lines is a leg — CASCADE, a
///   DELETE, and `trg_protect_linked_leg_delete`.
///
/// One query rather than two: the answer is a single boolean and the two clauses
/// are the same fact about the same table.
pub(super) fn touches_a_transfer_leg(
    transaction: &rusqlite::Transaction<'_>,
    id: &str,
) -> CoreResult<bool> {
    let touches: i64 = transaction.query_row(
        "SELECT EXISTS (
           SELECT 1 FROM transaction_splits
            WHERE linked_transfer_id = ?1
               OR (transaction_id = ?1 AND linked_transfer_id IS NOT NULL)
         )",
        params![id],
        |row| row.get(0),
    )?;
    Ok(touches != 0)
}
