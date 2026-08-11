//! `restore_suggestion` — the refusal is DELETED, and that is the whole of what
//! "restore" means here.
//!
//! # What it is a port OF
//!
//! `SuggestionDismissalService.restore` (`:121-137`), whose whole body is:
//!
//! ```text
//! .from('suggestion_dismissals').delete()
//! .eq('user_id', userId).eq('kind', kind).eq('subject_key', subjectKey)
//! ```
//!
//! No RPC; PHASE3-PLAN D-2 again.
//!
//! # THE NAME IS THE ONE THING TO GET RIGHT ABOUT IT
//!
//! "Restore" restores the SUGGESTION, not the dismissal. There is no flag, no
//! `undismissed_at`, no soft delete and no tombstone: the row that recorded the
//! refusal is removed, and the next sweep finds nothing hiding its offer and
//! makes it again. The migration says why the table is shaped for exactly that
//! and nothing else — *"no UPDATE policy, because a dismissal is never edited: it
//! is created when the user refuses, and deleted when they change their mind"*
//! (`20260806180000:126-128`) — and `schema.sql` holds the same rule as
//! `trg_dismissals_no_update`, which would ABORT any attempt to flip a column
//! instead.
//!
//! It is therefore the opposite of [`super::close_account`], where the seam
//! renamed a "delete" that was really a hide. Here the delete is a delete, and
//! the two verbs are worth reading together: what decides it is whether anything
//! is filed against the row. A closed account still owns its transactions; a
//! dismissal owns nothing but its own subjects.
//!
//! # KEYED BY THE NATURAL KEY, NEVER BY ID
//!
//! `(user_id, kind, subject_key)` — the unique constraint, and the only thing the
//! caller has. The screen that offers "undo" is looking at a suggestion, not at a
//! dismissal row, and `subject_key` is canonical precisely so that a re-scan
//! reaching the same rows from the other end produces the same string. A verb
//! that took an id would be a verb the app could not call.
//!
//! # AN ID NAMING NOTHING IS A SUCCESSFUL NOTHING
//!
//! The cloud's query has no `.single()` and reports no count: restoring something
//! that was never dismissed resolves, and the seam asks for that by returning
//! `Promise<void>`. Same reasoning as [`super::delete_budget`], and the same
//! consequence — a double-click, or a second device that got there first, must
//! not turn a decision into an error message.
//!
//! The verb still reports the count internally, because the harness compares
//! answers and *"nothing happened"* and *"one row went"* are the two outcomes the
//! specs need to tell apart. The seam throws it away; a spec does not.
//!
//! # THE SUBJECTS GO WITH IT, BY THE KEY
//!
//! `suggestion_dismissal_subjects.dismissal_id` is `ON DELETE CASCADE`, so the
//! child rows leave with the parent and this verb does not walk them — the same
//! decision [`super::delete_goal`] makes about contributions, for the same
//! reason (a subject is a different entity, and folding it into `deleted` would
//! make one number mean two things). What that costs is one thing it must not
//! assume: `PRAGMA foreign_keys` is ON, asserted at [`crate::db::configure`] by
//! reading it back, and a spec MEASURES the subject rows leaving rather than
//! trusting the declaration.
//!
//! In the cloud there is nothing to cascade — the subjects are an array in the
//! row being deleted — so the two engines reach the same state by different
//! machinery, which is exactly the pair of facts a differential spec exists to
//! compare.
//!
//! # It does not audit
//!
//! [`super::dismiss_suggestion`] carries the argument: the trail answers *"what
//! happened to this money"* and a dismissal has none, on either engine. Asserted
//! rather than assumed — the specs measure the trail across a restore.
//!
//! # No guard, measured
//!
//! A DELETE from `suggestion_dismissals`. The cascade reaches
//! `suggestion_dismissal_subjects`, which has no trigger and no children of its
//! own; `trg_prune_suggestion_dismissals` is `BEFORE DELETE ON transactions`, not
//! on this table, and `trg_dismissals_no_update` is an UPDATE trigger.
//! `tests/dismissal_writes.rs` asserts the guard table empty across a restore.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;

use super::DeleteAnswer;

/// The command: the three `.eq()` arguments the cloud's delete carries.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RestoreSuggestion {
    /// Whose. Absent names no owner — see [`super::update_transaction`]. The
    /// seam always supplies one; the option exists because every owner-scoped
    /// verb in this crate spells it the same way, and a family where one verb
    /// required what the others made optional would be a family somebody gets
    /// wrong once.
    #[serde(default)]
    pub user_id: Option<String>,
    /// Which sort of offer was refused.
    pub kind: String,
    /// The canonical identity of the refused suggestion.
    pub subject_key: String,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct RestoreSuggestionResult {
    /// The count, in the object shape the harness compares a verb on. The seam
    /// discards it; see the module docs.
    pub answer: DeleteAnswer,
}

/// Undo a refusal, so the suggestion is offered again from the next scan.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] for a fault. There is no refusal: a key
/// naming nothing is a successful nothing.
#[allow(clippy::needless_pass_by_value)]
pub fn restore_suggestion(
    connection: &mut Connection,
    command: RestoreSuggestion,
) -> CoreResult<RestoreSuggestionResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let owner = command.user_id.as_deref();

    let removed = write.execute(
        "DELETE FROM suggestion_dismissals
               WHERE (?1 IS NULL OR user_id = ?1) AND kind = ?2 AND subject_key = ?3",
        params![owner, command.kind, command.subject_key],
    )?;

    write.commit()?;

    Ok(RestoreSuggestionResult {
        answer: DeleteAnswer {
            deleted: super::count(removed)?,
        },
    })
}
