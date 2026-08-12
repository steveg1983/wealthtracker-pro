//! A saved custom report, as the app lists it and as an audit entry records it.
//!
//! # The first entity here with no money in it at all
//!
//! Every other module under [`crate::row`] carries at least one
//! [`crate::money::Money`] field,
//! and the module that does not — [`crate::row::dismissal`] — is a record of
//! something a person REFUSED rather than something they made. This one is
//! neither: it is a piece of the user's own work, and it holds no figure
//! anywhere.
//!
//! That absence is load-bearing rather than incidental, and it is the reason
//! this file has no `use crate::money::Money` and must never gain one. A custom
//! report is a QUESTION about the ledger — which blocks, over which range,
//! narrowed to which accounts — and `customReportService` computes the answer
//! from `transactions` every time the report is generated. A figure stored HERE
//! would be a cached answer that the ledger can change underneath, and the
//! reports page would begin disagreeing with the register with nothing anywhere
//! to say why. It is R-1's rule reaching a table that has no balance in it: two
//! numbers are only worth having while they are arrived at independently, and a
//! report is not a second number, it is a second question.
//!
//! # One type, for the reader and for the log
//!
//! [`crate::row::budget`] needs two projections because its threshold is stored
//! in one spelling and read in another; the transaction needs three because the
//! audit, the boot and a write each ask something different. A custom report
//! needs one. The cloud's own query is `.select('*')`, the whole row is what the
//! page renders, and the whole row is exactly what an entry's `before`/`after`
//! need — so there is nothing here to keep in step, and no way for the reader
//! and the log to drift.
//!
//! # It audits, and the reasoning is NOT the planning family's
//!
//! Budgets and goals are audited because PHASE1-PLAN §2.2 found U-1 (*"every
//! financial write emits an audit row"*) false of four FIGURES, and a target
//! amount is a figure somebody will one day ask *"what changed that?"* about.
//! There is no figure here to ask it about, so that argument does not reach this
//! table and is not borrowed.
//!
//! What reaches it is the other half of what the log is for. A report is work
//! the person AUTHORED — an afternoon of composing, not a number the app
//! derived — and the question its entries answer is *"where did my report go?"*.
//! Nothing else can answer it: the cloud has no trail for this table either
//! (DESIGN.md §5 divergence 10, the same declared divergence the planning family
//! carries), the row itself is gone after a delete, and a report is precisely
//! the kind of thing somebody deletes by accident from a list. The entry carries
//! the components and the filters whole, so the answer is not merely *"it was
//! deleted at 14:02"* but the report itself.
//!
//! # The two columns this crate carries and does not read into
//!
//! `components` is a `ReportComponent[]` and `filters` is the object holding the
//! date range, the accounts, the categories and the tags. Both cross the wire as
//! real JSON — an array and an object, not strings holding JSON — and both are
//! carried WHOLE. Unpacking `components[0].type` into a field of its own would
//! be this crate deciding what a report IS, which is DESIGN §6.3's other side of
//! the line: the shape inside belongs to
//! `src/components/CustomReportBuilder.tsx`, so it can gain a key without a
//! migration, and the CHECK in `schema.sql` constrains only the container.
//!
//! `filters.accounts` and `filters.categories` hold row ids, and this module
//! does nothing about them on purpose. There is no foreign key to reach them, no
//! account column to pair under R-12, and no branch for this table in
//! `trg_unnest_account_references` — so a deleted account leaves a report still
//! naming it, and the report narrows to nothing for that account, exactly as the
//! cloud's jsonb does. The one thing that rewrites those ids is
//! `remapBackupIds` on the TypeScript side, which is the only place holding the
//! map from a backup file's ids to the fresh ones a restore mints;
//! [`crate::backup`] reproduces none of it, for the reason its own header gives.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::CoreResult;

/// The eight columns, in the order [`row_of`] reads them.
///
/// One string, because three readers use it — [`list_all`], [`read_owned`] and
/// the boot through the first of them — and a column added to one copy and not
/// the others is read at the wrong index by the ones that were not edited, which
/// SQLite reports as a type error somewhere unrelated or, on two adjacent TEXT
/// columns, not at all. `name` and `description` are adjacent TEXT columns.
const COLUMNS: &str = "id, user_id, name, description, components, filters,
        created_at, updated_at";

/// A saved report as stored, in the serialised order.
///
/// Field order is the serialised order (`serde_json` is built with
/// `preserve_order`), so two runs of the same verb produce byte-identical audit
/// payloads and the hash chain means something.
#[derive(Debug, Clone, Serialize)]
pub struct CustomReportRow {
    /// Primary key. The dashboard pins a report by it — `custom:<id>` in the
    /// pinned-reports preference — which is half of why a report is a row rather
    /// than a key in the preferences document.
    pub id: String,
    /// Owner.
    pub user_id: String,
    /// As shown in every list of reports. The one column here anything sorts or
    /// searches by, and `NOT NULL` with a blank-name CHECK in both engines.
    pub name: String,
    /// Free text. `NOT NULL DEFAULT ''` in both engines, so a reader never has
    /// to tell "no description" from "description unknown" — which is why this
    /// is a `String` where [`crate::row::goal::GoalRow::description`], whose
    /// column is nullable, is an `Option<String>`.
    pub description: String,
    /// `ReportComponent[]` — the blocks the report is made of, in the order they
    /// render. An ARRAY by CHECK on both engines; the shape inside is the
    /// client's.
    pub components: serde_json::Value,
    /// The report's scope: the date range, and which accounts, categories and
    /// tags it is narrowed to. An OBJECT by CHECK on both engines. It NAMES
    /// other rows and constrains none of them — see the module docs.
    pub filters: serde_json::Value,
    /// When the row was made. The list's sort key.
    pub created_at: String,
    /// When it last changed.
    pub updated_at: String,
}

/// Every saved report this login has, oldest first.
///
/// # The order is this crate's own, and it is NOT the cloud's
///
/// The cloud indexes `(user_id, updated_at DESC)` because its page lists reports
/// newest-edited first. This orders by `created_at, id`, which is the order
/// every other list in this crate uses and the order [`crate::verbs::reads`]
/// argues for at length: a list that is drawn is a list that gets re-drawn, and
/// `updated_at` moves under the reader's hands — renaming one report would
/// reshuffle the whole list on a page nobody else touched. Creation order does
/// not move. The `id` behind it is the stated tie-break, so two reports composed
/// in the same second have an order at all.
///
/// Like the budgets and goals reads there is no filter of any kind: a report
/// this login owns is in this answer.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_all(connection: &Connection, user_id: &str) -> CoreResult<Vec<CustomReportRow>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH custom_reports USING INDEX idx_custom_reports_user (user_id=?)
    //   USE TEMP B-TREE FOR ORDER BY
    //
    // The same shape as the budgets and goals reads, and accepted for the same
    // reason: the index has already cut the table to one owner's rows, and a
    // person has a handful of reports rather than a ledger of them. See
    // [`crate::verbs::reads`] for what would change that answer.
    let mut statement = connection.prepare(&format!(
        "SELECT {COLUMNS}
           FROM custom_reports
          WHERE user_id = ?1
          ORDER BY created_at, id"
    ))?;
    let rows = statement.query_map(params![user_id], row_of)?;

    let mut reports = Vec::new();
    for report in rows {
        reports.push(report?);
    }
    Ok(reports)
}

/// Read one saved report, scoped to an owner.
///
/// The `.eq('id', …).eq('user_id', …)` pair every one of the cloud's writes
/// carries, and `None` is what `.single()` finding nothing becomes. An absent
/// owner applies no ownership clause — the decision
/// [`crate::verbs::update_transaction`] documents at length, and the reason
/// every write verb passes the argument through rather than quietly requiring
/// one.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_owned(
    connection: &Connection,
    id: &str,
    user_id: Option<&str>,
) -> CoreResult<Option<CustomReportRow>> {
    Ok(connection
        .query_row(
            &format!(
                "SELECT {COLUMNS}
                   FROM custom_reports
                  WHERE id = ?1
                    AND (?2 IS NULL OR user_id = ?2)"
            ),
            params![id, user_id],
            row_of,
        )
        .optional()?)
}

/// One record of that eight-column SELECT as a [`CustomReportRow`].
///
/// The two blobs are parsed rather than carried as text, because the wire
/// contract is a real array and a real object: a caller that received
/// `"components": "[]"` would have to parse the crate's answer a second time,
/// and the two parses would be two chances to disagree about a document neither
/// side owns.
///
/// The fallback for an unparseable blob is the EMPTY CONTAINER of the right
/// kind, not [`serde_json::Value::Null`] as [`crate::row::goal`] uses for
/// `metadata`. The difference is what the far side does with the answer: a null
/// metadata blob is read with `?.`, while the reports page ITERATES `components`
/// and INDEXES INTO `filters`, so a null there is a crash on a page rather than
/// a missing label. It cannot happen through a write — the CHECK constrains the
/// container on both engines and the verbs go through it — which leaves the one
/// path that can put arbitrary bytes in the column: somebody editing the file
/// with a SQLite tool, which the local edition explicitly permits. An empty list
/// of components is an honest description of what such a row can be drawn as.
fn row_of(record: &rusqlite::Row<'_>) -> rusqlite::Result<CustomReportRow> {
    let components_text: String = record.get(4)?;
    let filters_text: String = record.get(5)?;
    Ok(CustomReportRow {
        id: record.get(0)?,
        user_id: record.get(1)?,
        name: record.get(2)?,
        description: record.get(3)?,
        components: serde_json::from_str(&components_text)
            .unwrap_or_else(|_| serde_json::Value::Array(Vec::new())),
        filters: serde_json::from_str(&filters_text)
            .unwrap_or_else(|_| serde_json::Value::Object(serde_json::Map::new())),
        created_at: record.get(6)?,
        updated_at: record.get(7)?,
    })
}
