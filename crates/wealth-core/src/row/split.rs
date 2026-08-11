//! A stored split line, and the whole line set of one parent.
//!
//! # Why splits get their own row module
//!
//! `transaction_splits` is the only child table in the schema whose rows are
//! *money*. Tags are a set of strings; splits carry signed amounts that must sum
//! to their parent (S-1), and two of them can be halves of transfers (S-9,
//! S-10). A row type that renders those amounts through [`Money`] is what keeps
//! the audit payload, the verb's return value and the differential harness all
//! looking at the same decimal string rather than three roundings of one number.
//!
//! # The order is `sort_order`, then `id`
//!
//! The cloud's split writer embeds the line set in its audit entry with
//! `jsonb_agg(... ORDER BY s.sort_order)`, and `sort_order` is not unique — two
//! lines can share one, and the pre-split fixtures in this repo start at 0. In
//! Postgres a tie is then resolved by whatever order the executor felt like.
//! Locally that would make the audit chain's hash depend on a scan order, so the
//! tie-break is spelled out. It is a deliberate, recorded strengthening: the
//! cloud's ordering is *a* valid one, this one is the same ordering plus a rule
//! for the case the cloud leaves open.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;

/// One line of a split, as stored.
///
/// Field order is the serialised order, for the reason
/// [`crate::row::TransactionRow`] gives: two runs of the same verb must produce
/// byte-identical audit payloads or the hash chain means nothing.
#[derive(Debug, Clone, Serialize)]
pub struct SplitRow {
    /// Primary key.
    pub id: String,
    /// The split parent.
    pub transaction_id: String,
    /// Owner. Copied from the parent by the writer; never taken from the caller.
    pub user_id: String,
    /// A category id as text, or a legacy sentinel. TEXT with no foreign key,
    /// exactly as `transactions.category` (R-3).
    pub category: String,
    /// Signed, and signed by its **own** category's direction rather than the
    /// parent's — one split may legitimately mix an expense line with an income
    /// line (TS-M3). The writer stores what it is given; the sign is decided
    /// where the line is composed.
    pub amount: Money,
    /// Free text for this line.
    pub memo: Option<String>,
    /// Display position, 1-based, assigned by the writer from payload order.
    pub sort_order: i64,
    /// The account on the other side, when this line is a transfer leg.
    pub transfer_account_id: Option<String>,
    /// The counterpart transaction, when the leg is linked. A line with a target
    /// and no link is an **unmatched** leg: the other side exists somewhere and
    /// has not been recognised yet.
    pub linked_transfer_id: Option<String>,
}

/// Read every line of one split, in display order.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_lines(connection: &Connection, transaction_id: &str) -> CoreResult<Vec<SplitRow>> {
    let mut statement = connection.prepare(
        "SELECT id, transaction_id, user_id, category, amount_minor, memo, sort_order,
                transfer_account_id, linked_transfer_id
           FROM transaction_splits
          WHERE transaction_id = ?1
          ORDER BY sort_order, id",
    )?;
    let rows = statement.query_map(params![transaction_id], |record| {
        Ok(SplitRow {
            id: record.get(0)?,
            transaction_id: record.get(1)?,
            user_id: record.get(2)?,
            category: record.get(3)?,
            amount: Money::from_minor(record.get(4)?),
            memo: record.get(5)?,
            sort_order: record.get(6)?,
            transfer_account_id: record.get(7)?,
            linked_transfer_id: record.get(8)?,
        })
    })?;

    let mut lines = Vec::new();
    for line in rows {
        lines.push(line?);
    }
    Ok(lines)
}

/// A split line as the app lists it: every column this table holds.
///
/// # Why this is not [`SplitRow`] widened
///
/// The same decision [`crate::row::account`] makes, for the same reason, and it
/// is worth repeating because a reviewer's first instinct is to merge them.
/// [`SplitRow`] is the line set the split writer embeds in its AUDIT entry —
/// `jsonb_agg(...)` in the cloud, a serialised `Vec<SplitRow>` here — and that
/// payload is compared field by field across two engines. `created_at` and
/// `updated_at` are two clocks in two processes and never equal, so putting them
/// in that comparison would turn a passing surface red for no gain.
///
/// A READER cannot be narrower, because what a read projects is what the cloud's
/// own query projects and both split reads are `.select('*')` — the whole row,
/// eleven columns, timestamps included. The app's own mapper
/// (`transactionService.mapSplitRow`) reads eight of them and ignores three; that
/// is the app's business, not the port's. Answering with less than the query
/// answers with would be this crate deciding, on the app's behalf, that a column
/// will never be wanted.
#[derive(Debug, Clone, Serialize)]
pub struct ListedSplit {
    /// Primary key.
    pub id: String,
    /// The split parent. The whole-store read's first sort key.
    pub transaction_id: String,
    /// Owner. The line's OWN owner — see [`list_owned`].
    pub user_id: String,
    /// A category id as text, or a legacy sentinel (R-3).
    pub category: String,
    /// Signed, by its own category's direction rather than the parent's.
    pub amount: Money,
    /// Free text for this line.
    pub memo: Option<String>,
    /// Display position. The second sort key, and NOT unique.
    pub sort_order: i64,
    /// The account on the other side, when this line is a transfer leg.
    pub transfer_account_id: Option<String>,
    /// The counterpart transaction, when the leg is linked.
    pub linked_transfer_id: Option<String>,
    /// When the line was made.
    pub created_at: String,
    /// When it last changed.
    pub updated_at: String,
}

/// Every column [`ListedSplit`] carries, in its serialised order.
const LISTED_COLUMNS: &str = "id, transaction_id, user_id, category, amount_minor, memo,
        sort_order, transfer_account_id, linked_transfer_id, created_at, updated_at";

/// The statement [`list_owned`] prepares, and the ONLY copy of it. Public for
/// the reason [`crate::row::list_owned_sql`] gives: a plan assertion written
/// against a copy of a query is an assertion that survives the query changing.
#[must_use]
pub fn list_owned_sql() -> String {
    format!(
        "SELECT {LISTED_COLUMNS}
           FROM transaction_splits
          WHERE user_id = ?1
          ORDER BY transaction_id, sort_order, id"
    )
}

/// The statement [`list_for_parent`] prepares.
#[must_use]
pub fn list_for_parent_sql() -> String {
    format!(
        "SELECT {LISTED_COLUMNS}
           FROM transaction_splits
          WHERE transaction_id = ?1
            AND user_id = ?2
          ORDER BY sort_order, id"
    )
}

/// Every split line this login owns, parent by parent, in display order.
///
/// The port of `transactionService.getAllTransactionSplits`:
/// `.select('*').eq('user_id', …).order('transaction_id').order('sort_order')`,
/// paged only because PostgREST caps a response at 1,000 rows — a cap a file
/// does not have, and the reason DESIGN calls a local boot ONE crossing.
///
/// # The owner is the LINE's owner, which is not always the parent's
///
/// `.eq('user_id', userId)` names `transaction_splits.user_id`, and so does the
/// cloud's RLS policy on this table. Those two are usually the same person as
/// the parent's owner and the schema does not require it — the harness has a
/// fixture, `myLineOnTheirParent`, built precisely because `merge_categories`
/// walks parents by one and lines by the other. Filtering on the parent instead
/// would be a different question with the same name.
///
/// # The tie-break is this crate's own
///
/// `sort_order` is not unique — two lines can share one, and the pre-split
/// fixtures in this repo start at 0 — so the cloud's two keys leave ties, and in
/// Postgres a tie is resolved by whatever the executor felt like. `id` goes
/// behind them for the reason [`crate::verbs::reads`] gives for all of them: a
/// list that is drawn is a list that gets re-drawn.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_owned(connection: &Connection, user_id: &str) -> CoreResult<Vec<ListedSplit>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql, 50k lines):
    //   SEARCH transaction_splits USING INDEX idx_splits_user_display (user_id=?)
    //
    // No temp B-tree. `idx_splits_user_display (user_id, transaction_id,
    // sort_order, id)` was ADDED for this read and the measurement that bought
    // it is in [`crate::verbs::reads`]: without it the plan is a search on
    // `idx_splits_user_cat` followed by USE TEMP B-TREE FOR ORDER BY, which is a
    // sort of the whole line set on every boot.
    let mut statement = connection.prepare(&list_owned_sql())?;
    collect(&mut statement, params![user_id])
}

/// One parent's lines, in display order, and only if they are this login's.
///
/// The port of `transactionService.getTransactionSplits(transactionId)`:
/// `.select('*').eq('transaction_id', …).order('sort_order')`.
///
/// # The owner is a LOCAL addition, and it is not optional
///
/// That query names no owner at all — the cloud has RLS underneath it, and the
/// policy on this table is `user_id = requesting_user_id()`, so the filter is
/// there, it is simply not written in the client. A file has no RLS and can hold
/// more than one login's rows (a restore from an account that had two, or the
/// harness's own second user), so the same guard has to be written down. It is
/// the same argument [`crate::verbs::reads`] makes for every read taking a
/// required owner, and here it is not defence in depth: it is the only gate.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_for_parent(
    connection: &Connection,
    user_id: &str,
    transaction_id: &str,
) -> CoreResult<Vec<ListedSplit>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH transaction_splits USING INDEX idx_splits_user_display
    //          (user_id=? AND transaction_id=?)
    //
    // The index added for [`list_owned`] serves this read better than the one
    // written for it: `idx_splits_user_display (user_id, transaction_id,
    // sort_order, id)` is this query's two bound columns followed by its two
    // sort keys, so nothing is sorted at all. Before it, the plan was
    // `idx_splits_transaction` plus `USE TEMP B-TREE FOR LAST TERM OF ORDER BY`
    // — the tie-break sorted within each run of equal `sort_order`, which is
    // lines inside one parent and was accepted on slice 15's argument.
    let mut statement = connection.prepare(&list_for_parent_sql())?;
    collect(&mut statement, params![transaction_id, user_id])
}

/// The one mapper both reads share, because they differ by a WHERE clause and a
/// second copy of eleven columns is a second place to forget one.
fn collect(
    statement: &mut rusqlite::Statement<'_>,
    bound: impl rusqlite::Params,
) -> CoreResult<Vec<ListedSplit>> {
    let rows = statement.query_map(bound, |record| {
        Ok(ListedSplit {
            id: record.get(0)?,
            transaction_id: record.get(1)?,
            user_id: record.get(2)?,
            category: record.get(3)?,
            amount: Money::from_minor(record.get(4)?),
            memo: record.get(5)?,
            sort_order: record.get(6)?,
            transfer_account_id: record.get(7)?,
            linked_transfer_id: record.get(8)?,
            created_at: record.get(9)?,
            updated_at: record.get(10)?,
        })
    })?;

    let mut lines = Vec::new();
    for line in rows {
        lines.push(line?);
    }
    Ok(lines)
}
