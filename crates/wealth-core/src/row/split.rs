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
