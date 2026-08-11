//! `delete_budget` — a real delete, and an id naming nothing is not an error.
//!
//! # What it is a port OF
//!
//! `planningService.deleteBudget` (`:289-300`), whose whole body is:
//!
//! ```text
//! .from('budgets').delete().eq('id', id).eq('user_id', userId)
//! ```
//!
//! No RPC; PHASE3-PLAN D-2, and [`super::create_budget`] carries the argument for
//! why a table the cloud writes directly still needs a verb here.
//!
//! # A REAL DELETE, WHICH AN ACCOUNT NEVER GETS
//!
//! The seam draws the line and gives the reason: *"A budget holds no money and
//! nothing is filed against it, so removing one leaves no hole in the ledger"* —
//! where an account's `deleteAccount` is a soft close, because a deleted account
//! is a hole in a ledger. Nothing points at a budget in either schema: it names a
//! category, and no row names it.
//!
//! # AN ID NAMING NOTHING IS A SUCCESSFUL NOTHING
//!
//! There is no `.single()` on that query, so a delete matching no row is a
//! successful call that did nothing — and the seam asks for exactly that, in the
//! same words it uses for a dismissal: *"a double-click, or a second device that
//! got there first, must not turn a decision into an error message"*. Both of the
//! app's own implementations agree; `DataServiceImpl.deleteBudget`'s local branch
//! writes the list back unchanged. This verb answers `deleted: 0` rather than
//! refusing.
//!
//! That is the opposite of [`super::update_budget`], which refuses
//! `budget_not_found`, and the difference is not a preference: the update's query
//! ends in `.single()` and this one does not. Two ports of two queries.
//!
//! # It audits, and the row it audits is the row that went
//!
//! One `budget/delete` entry with a `before` and no `after`, read WHOLE before
//! the delete — which is the only moment it can be read. See
//! [`super::create_budget`] for the family's argument (PHASE1-PLAN §2.2,
//! DESIGN.md §5 divergence 10) and note the shape it buys here: a budget's
//! delete entry is the one record of what the limit was, and the compliance
//! question *"what changed that figure"* has no other answer once the row is
//! gone.
//!
//! An id naming nothing writes NO entry, for the same reason it is not an error:
//! nothing happened.
//!
//! # No guard, measured
//!
//! A DELETE from `budgets`. `schema.sql` has no trigger on that table and no
//! foreign key points at it, so nothing cascades and nothing is examined.
//! `tests/planning_writes.rs` asserts the guard table empty across a delete.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::CoreResult;
use crate::row::budget;

use super::DeleteAnswer;

/// The command. The two arguments the client's `.delete().eq().eq()` carries.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteBudget {
    /// Which budget.
    pub id: String,
    /// Whose. Absent names no owner — see [`super::update_transaction`].
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct DeleteBudgetResult {
    /// The count, in the object shape the harness compares a verb on.
    pub answer: DeleteAnswer,
}

/// Remove one budget.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] for a fault. There is no refusal: an id
/// naming nothing is a successful nothing.
#[allow(clippy::needless_pass_by_value)]
pub fn delete_budget(
    connection: &mut Connection,
    command: DeleteBudget,
) -> CoreResult<DeleteBudgetResult> {
    // BEGIN IMMEDIATE before the first read, as every writing verb here does:
    // the row is read and then acted on, and nothing may change between the two.
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let owner = command.user_id.as_deref();

    let Some(before) = budget::read_owned(&write, &command.id, owner)? else {
        // An id naming nothing, or naming somebody else's budget. Not an error:
        // see the module docs.
        write.commit()?;
        return Ok(DeleteBudgetResult {
            answer: DeleteAnswer { deleted: 0 },
        });
    };

    let now = db::now(&write)?;
    // Scoped by owner again, not because the read above left a gap — it did not
    // — but because a DELETE that names one id and no owner is one edit away
    // from being a DELETE that names none.
    let removed = write.execute(
        "DELETE FROM budgets WHERE id = ?1 AND (?2 IS NULL OR user_id = ?2)",
        params![command.id, owner],
    )?;

    if removed > 0 {
        audit::write(
            &write,
            &before.user_id,
            "budget",
            &command.id,
            Action::Delete,
            Some(&super::json_of(&before)?),
            None,
            &now,
        )?;
    }

    write.commit()?;

    Ok(DeleteBudgetResult {
        answer: DeleteAnswer {
            deleted: super::count(removed)?,
        },
    })
}
