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
//! # A gap this read found, named rather than papered over
//!
//! The cloud's `suggestion_dismissals_kind_known` CHECK admits seven kinds
//! (`transfer-pair`, `transfer-leg`, `stranded`, `duplicate`, `payee-merchant`,
//! `payee-line`, `payee-hidden`) and `scripts/local-sqlite/schema.sql` admits
//! the first four — the three payee kinds arrived in the cloud after the local
//! mirror was written. Nothing in THIS module is affected (a read returns what
//! is stored, and a payee dismissal cannot be stored), but a restore of a cloud
//! backup carrying one would be refused by the CHECK, whole, which is
//! `restore_user_chunk`'s all-or-nothing rule doing exactly what it says.
//! Recorded here because a read of a table is where the table's admissible
//! values get looked up, and this is the note the next person needs.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::CoreResult;

/// A dismissal as the app lists it, with its subjects back in an array.
#[derive(Debug, Clone, Serialize)]
pub struct DismissalRow {
    /// Primary key.
    pub id: String,
    /// `transfer-pair` | `transfer-leg` | `stranded` | `duplicate` — the four
    /// this file admits. See the module docs about the cloud's seven.
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
    let mut subjects = connection.prepare(
        "SELECT transaction_id
           FROM suggestion_dismissal_subjects
          WHERE dismissal_id = ?1
          ORDER BY role_order",
    )?;
    for dismissal in &mut dismissals {
        let found = subjects.query_map(params![dismissal.id], |record| record.get::<_, String>(0))?;
        for id in found {
            dismissal.subject_ids.push(id?);
        }
    }
    Ok(dismissals)
}
