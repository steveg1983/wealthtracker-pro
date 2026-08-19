//! A suggestion the user has told the sweeps to stop offering.
//!
//! # The array that is a table here
//!
//! `subject_ids` is `uuid[]` in the cloud with a GIN index; locally it is the
//! child table `suggestion_dismissal_subjects`, and `schema.sql` argues that
//! the child table is the better shape (the prune trigger becomes an indexed
//! join, and *"every id resolves in exactly one table"* becomes a foreign key
//! rather than a promise). Neither of those is visible from outside, and it must
//! stay that way: the app is handed an ARRAY, in the order the array was
//! written, because `SuggestionDismissal.subjectIds` is an array and a reader
//! that had to know about a child table would be a reader that knows about
//! SQLite.
//!
//! `role_order` is what makes that reassembly honest. The positions in a
//! dismissal's id list are ROLES — for a transfer pair, which row was the out
//! and which the in — so a set with no order would be a different fact.
//!
//! # Five columns, because the cloud's own read names five
//!
//! `suggestionDismissalService.list` does not `select('*')`: it names
//! `id, kind, subject_key, subject_ids, dismissed_at`, and `toDismissal` reads
//! exactly those. So this projects those, and not `user_id` — the owner is what
//! the caller asked WITH, and echoing it back would be one more field two
//! engines have to agree about for no reader's benefit.
//!
//! # A gap this read found, and slice 23 closed
//!
//! The cloud's `suggestion_dismissals_kind_known` CHECK admits seven kinds
//! (`transfer-pair`, `transfer-leg`, `stranded`, `duplicate`, `payee-merchant`,
//! `payee-line`, `payee-hidden`) and `scripts/local-sqlite/schema.sql` admitted
//! the first four — the three payee kinds arrived in the cloud after the local
//! mirror was written. Nothing in THIS module was affected (a read returns what
//! is stored, and a payee dismissal could not be stored), so it was recorded
//! here rather than fixed: a read of a table is where the table's admissible
//! values get looked up, and that was the note the next person needed.
//!
//! [`super::super::verbs::dismiss_suggestion`] is what made it reachable, and
//! the CHECK now admits all seven. The argument is the schema's, and it is the
//! one that closed `last_reconciled_balance_minor`: a value the seam's own type
//! carries and the file cannot hold is a write the local edition would have to
//! refuse while the cloud accepted it. What that had cost was not theoretical —
//! Settings → Payee cleanup dismisses all three payee kinds through the seam's
//! one door, so the whole screen would have failed to save on a local file, and
//! a backup carrying one payee dismissal would have been refused WHOLE on the
//! way back in.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::CoreResult;

/// A dismissal as the app lists it, with its subjects back in an array.
#[derive(Debug, Clone, Serialize)]
pub struct DismissalRow {
    /// Primary key.
    pub id: String,
    /// One of the nine `suggestion_dismissals_kind_known` admits: the four the
    /// transfer sweep makes (`transfer-pair`, `transfer-leg`, `stranded`,
    /// `duplicate`), the three Payee cleanup makes (`payee-merchant`,
    /// `payee-line`, `payee-hidden`), and the two recurring verdicts
    /// (`recurring-confirmed`, `recurring-not` — 20260817220000), and the
    /// forecast base's one-row exclusion (`forecast-excluded` —
    /// 20260819130000). See the module docs.
    pub kind: String,
    /// What was refused, as the sweep names it. Unique per (owner, kind).
    pub subject_key: String,
    /// The rows the refusal was about, in role order.
    pub subject_ids: Vec<String>,
    /// When it was refused. The list's sort key, newest first.
    pub dismissed_at: String,
}

/// Every dismissal this login has, newest first.
///
/// The port of `suggestionDismissalService.list`: the five named columns,
/// `.eq('user_id', …)`, `.order('dismissed_at', { ascending: false })`.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_all(connection: &Connection, user_id: &str) -> CoreResult<Vec<DismissalRow>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH suggestion_dismissals USING INDEX
    //          sqlite_autoindex_suggestion_dismissals_2 (user_id=?)
    //   USE TEMP B-TREE FOR ORDER BY
    //
    // That index is not one this file writes: it is the automatic index behind
    // `suggestion_dismissals_unique_subject UNIQUE (user_id, kind, subject_key)`,
    // whose leading column happens to be the one this read filters on. Worth
    // knowing before anybody reorders that constraint's columns for tidiness —
    // the day `user_id` stops leading it, this read becomes a full scan and
    // nothing else in the schema will say so.
    let mut statement = connection.prepare(
        "SELECT id, kind, subject_key, dismissed_at
           FROM suggestion_dismissals
          WHERE user_id = ?1
          ORDER BY dismissed_at DESC, id",
    )?;
    let rows = statement.query_map(params![user_id], |record| {
        Ok(DismissalRow {
            id: record.get(0)?,
            kind: record.get(1)?,
            subject_key: record.get(2)?,
            subject_ids: Vec::new(),
            dismissed_at: record.get(3)?,
        })
    })?;

    let mut dismissals = Vec::new();
    for dismissal in rows {
        dismissals.push(dismissal?);
    }

    // The subjects, one prepared statement re-bound per dismissal — the shape
    // `read_transaction` already uses for tags, and for the same reason: the
    // child rows are a handful per parent and the alternative is a join whose
    // result has to be un-flattened by hand.
    //
    // EXPLAIN QUERY PLAN:
    //   SEARCH suggestion_dismissal_subjects USING PRIMARY KEY (dismissal_id=?)
    let mut subjects = connection.prepare(SUBJECTS)?;
    for dismissal in &mut dismissals {
        let found = subjects.query_map(params![dismissal.id], |record| record.get::<_, String>(0))?;
        for id in found {
            dismissal.subject_ids.push(id?);
        }
    }
    Ok(dismissals)
}

/// The subject read, in ONE place because two callers now do it.
///
/// `ORDER BY role_order` is the whole of it: the positions are ROLES, so a
/// second copy of this query that omitted the clause would answer a different
/// question in one caller and the right one in the other — which is exactly the
/// drift a shared constant prevents.
const SUBJECTS: &str = "SELECT transaction_id
                          FROM suggestion_dismissal_subjects
                         WHERE dismissal_id = ?1
                         ORDER BY role_order";

/// One dismissal by the key that IDENTIFIES it, or `None`.
///
/// The natural key, not the primary key: `suggestion_dismissals_unique_subject`
/// is `(user_id, kind, subject_key)`, and that triple is what both write verbs
/// are handed — `dismiss_suggestion` to find the refusal it must not duplicate,
/// `restore_suggestion` to find the one it is undoing. Neither ever knows an
/// `id`, because the cloud's client never sends one either.
///
/// An absent `user_id` names no owner, exactly as it does everywhere else in the
/// crate. The unique constraint is per-login, so a key with no owner can
/// legitimately match more than one row; `LIMIT 1` after the same
/// `dismissed_at DESC, id` order [`list_all`] uses makes which one it is a
/// stated decision rather than whichever the file happened to reach first.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn find_by_subject(
    connection: &Connection,
    user_id: Option<&str>,
    kind: &str,
    subject_key: &str,
) -> CoreResult<Option<DismissalRow>> {
    let mut statement = connection.prepare(
        "SELECT id, kind, subject_key, dismissed_at
           FROM suggestion_dismissals
          WHERE (?1 IS NULL OR user_id = ?1) AND kind = ?2 AND subject_key = ?3
          ORDER BY dismissed_at DESC, id
          LIMIT 1",
    )?;
    let mut rows = statement.query_map(params![user_id, kind, subject_key], |record| {
        Ok(DismissalRow {
            id: record.get(0)?,
            kind: record.get(1)?,
            subject_key: record.get(2)?,
            subject_ids: Vec::new(),
            dismissed_at: record.get(3)?,
        })
    })?;

    let Some(found) = rows.next() else {
        return Ok(None);
    };
    let mut dismissal = found?;

    let mut subjects = connection.prepare(SUBJECTS)?;
    let found = subjects.query_map(params![dismissal.id], |record| record.get::<_, String>(0))?;
    for id in found {
        dismissal.subject_ids.push(id?);
    }
    Ok(Some(dismissal))
}
