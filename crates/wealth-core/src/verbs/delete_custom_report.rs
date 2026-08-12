//! `delete_custom_report` — one saved report, and the only copy of it.
//!
//! # What it is a port OF
//!
//! `.from('custom_reports').delete().eq('id', id).eq('user_id', userId)`, over
//! PostgREST against the table `20260812140000` created. No RPC;
//! PHASE3-PLAN D-2.
//!
//! An id naming nothing is a successful nothing, for the reason
//! [`super::delete_budget`] sets out at length: there is no `.single()` on that
//! query, so the cloud answers a delete of a row that is not there with an empty
//! result and no error, and the seam asks for idempotence by name. That covers
//! the stranger's report as well as the absent one — `read_owned` cannot see it,
//! so the answer is `deleted: 0` and the caller learns nothing about whether an
//! id they cannot see exists, which is the reasoning
//! [`crate::row::account::read_owned`] gives for not distinguishing "no such
//! account" from "not your account".
//!
//! **It is the one verb of this three where idempotence is worth a second
//! thought**, because [`super::update_custom_report`] refuses the same id by
//! name. That asymmetry is the family's, not this table's — the budget and goal
//! pairs carry it too — and it is the cloud's own shape rather than a decision
//! taken here: an update ends in `.single()` and a delete does not.
//!
//! # NOTHING CASCADES, AND NOTHING IS LEFT DANGLING EITHER
//!
//! [`super::delete_goal`] had to argue about `goal_contributions`, and
//! [`super::delete_category`] walks its own subtree. This verb has neither
//! problem: no table in `schema.sql` references `custom_reports`, so there is no
//! cascade to describe, no second entity to count and no child rows to audit.
//!
//! The reference that DOES exist points the other way and is not a key at all.
//! `filters.accounts` and `filters.categories` hold account and category ids as
//! opaque JSON, so deleting a report removes something that NAMED rows without
//! ever having constrained them, and no account, category or transaction is
//! touched. The one thing outside the ledger that points AT a report is the
//! dashboard's pinned-reports preference, which stores `custom:<id>`; that lives
//! in `user_preferences` and is deliberately not reached from here, for the
//! reason [`super::delete_goal`] gives about a goal's trophy — a store is not
//! the place to keep the rule about what the dashboard does with a pin whose
//! report has gone. The dashboard already renders an unknown pin as nothing.
//!
//! # WHAT THE ENTRY IS FOR, AND WHY IT MATTERS MORE HERE
//!
//! One `custom_report/delete` entry with a `before` and no `after`, read whole
//! before the delete — DESIGN.md §5 divergence 10, the shape
//! [`super::create_budget`] argues.
//!
//! For budgets and goals the entry answers *"what changed that figure?"*. Here
//! there is no figure, and the entry answers something the file otherwise could
//! not answer at all: the row was the ONLY copy of work a person composed by
//! hand, it is not derivable from the ledger the way every balance is, and a
//! report is exactly the kind of thing deleted from a list by a misplaced click.
//! `before` holds the components and the filters whole, so the log does not
//! merely record that a report went — it records the report.
//!
//! # No guard, measured
//!
//! A DELETE from `custom_reports`. No trigger on the table, no children,
//! and `trg_unnest_account_references` is `BEFORE DELETE ON accounts` — a
//! different table, and one this one has no key into.
//! `tests/custom_report_writes.rs` asserts the guard table empty across a
//! delete.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::CoreResult;
use crate::row::custom_report;

use super::DeleteAnswer;

/// The command. The two arguments the client's `.delete().eq().eq()` carries.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteCustomReport {
    /// Which report.
    pub id: String,
    /// Whose. Absent names no owner — see [`super::update_transaction`].
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct DeleteCustomReportResult {
    /// The count, in the object shape the harness compares a verb on.
    pub answer: DeleteAnswer,
}

/// Remove one saved report.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] for a fault. There is no refusal: an id
/// naming nothing — or naming somebody else's report — is a successful nothing.
#[allow(clippy::needless_pass_by_value)]
pub fn delete_custom_report(
    connection: &mut Connection,
    command: DeleteCustomReport,
) -> CoreResult<DeleteCustomReportResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let owner = command.user_id.as_deref();

    let Some(before) = custom_report::read_owned(&write, &command.id, owner)? else {
        write.commit()?;
        return Ok(DeleteCustomReportResult {
            answer: DeleteAnswer { deleted: 0 },
        });
    };

    let now = db::now(&write)?;
    let removed = write.execute(
        "DELETE FROM custom_reports WHERE id = ?1 AND (?2 IS NULL OR user_id = ?2)",
        params![command.id, owner],
    )?;

    if removed > 0 {
        audit::write(
            &write,
            &before.user_id,
            "custom_report",
            &command.id,
            Action::Delete,
            Some(&super::json_of(&before)?),
            None,
            &now,
        )?;
    }

    write.commit()?;

    Ok(DeleteCustomReportResult {
        answer: DeleteAnswer {
            deleted: super::count(removed)?,
        },
    })
}
