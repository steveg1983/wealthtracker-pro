//! `delete_investment` — a position closed out, and the buys and sells that go
//! with it.
//!
//! # What it is a port OF
//!
//! `InvestmentService.remove` (`:302-315`):
//!
//! ```text
//! .from('investments').delete().eq('id', id).eq('user_id', userId)
//! ```
//!
//! No `.single()`, so an id naming nothing is a SUCCESSFUL NOTHING rather than a
//! refusal — the seam's rule for `deleteBudget` and `deleteGoal`, word for word:
//! *"a double-click, or a second device that got there first, must not turn a
//! decision into an error message."*
//!
//! # A REAL DELETE, unlike an account's
//!
//! `closeAccount` is soft in every engine because *"a deleted account is a hole
//! in a ledger"*. A holding is not: no transaction is filed against it, no
//! balance is derived from it, and the money the position represents lives in
//! the LEDGER — the investment↔cash account pair — which this row is a second,
//! clearly-labelled opinion about and never a component of. `investmentService.ts`
//! states that separation in its own header and it is why removing a holding
//! costs nothing but the holding.
//!
//! # THE CASCADE IS THE FILE'S
//!
//! `investment_transactions.investment_id` is `ON DELETE CASCADE` in both
//! schemas, so a position's buys and sells go with it. This verb deliberately
//! does not walk that cascade, count it or audit it — the decision
//! [`super::delete_goal`] takes about `goal_contributions` and for the same
//! reason: a buy is a different entity from the thing being deleted, so counting
//! it would make one number mean two things.
//!
//! **Nothing in this app writes `investment_transactions` today.** The table is
//! carried by the backup format and by both schemas; no screen, service or verb
//! inserts a row. The cascade is stated because a RESTORE can bring rows into
//! it, and because the day something does write one, this file's behaviour must
//! already be the right one rather than a thing somebody has to remember.
//!
//! # It audits — DIVERGENCE 10
//!
//! One `investment/delete` entry carrying the row as it was, chained, in the same
//! transaction, and ONLY when a row was actually removed. A delete of nothing
//! writes nothing, because an audit log whose whole value is that every line is a
//! change must not record a decision that had no effect.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::CoreResult;
use crate::row::investment;

use super::DeleteAnswer;

/// The command: which holding, and whose.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteInvestment {
    /// Which holding.
    pub id: String,
    /// Whose. Absent names no owner — see [`super::update_transaction`].
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct DeleteInvestmentResult {
    /// The count, in the object shape the harness compares a verb on.
    pub answer: DeleteAnswer,
}

/// Remove one holding.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] for a fault. There is no refusal: an id
/// naming nothing is a successful nothing.
#[allow(clippy::needless_pass_by_value)]
pub fn delete_investment(
    connection: &mut Connection,
    command: DeleteInvestment,
) -> CoreResult<DeleteInvestmentResult> {
    // BEGIN IMMEDIATE before the first read, as every writing verb here does.
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let owner = command.user_id.as_deref();

    let Some(before) = investment::read_owned(&write, &command.id, owner)? else {
        // An id naming nothing, or naming somebody else's holding. Not an error.
        write.commit()?;
        return Ok(DeleteInvestmentResult {
            answer: DeleteAnswer { deleted: 0 },
        });
    };

    let now = db::now(&write)?;
    // Scoped by owner again, not because the read above left a gap — it did not
    // — but because a DELETE that names one id and no owner is one edit away
    // from being a DELETE that names none.
    let removed = write.execute(
        "DELETE FROM investments WHERE id = ?1 AND (?2 IS NULL OR user_id = ?2)",
        params![command.id, owner],
    )?;

    if removed > 0 {
        audit::write(
            &write,
            &before.user_id,
            "investment",
            &command.id,
            Action::Delete,
            Some(&super::json_of(&before)?),
            None,
            &now,
        )?;
    }

    write.commit()?;

    Ok(DeleteInvestmentResult {
        answer: DeleteAnswer {
            deleted: super::count(removed)?,
        },
    })
}
