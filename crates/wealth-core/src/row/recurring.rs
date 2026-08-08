//! A recurring template, as an audit entry has to record it.
//!
//! # The one table in this crate whose owner column is a different KIND of id
//!
//! `recurring_transactions.user_id` is the **Clerk** id in the cloud — text, not
//! the uuid every other table here uses — and `merge_categories` says so in as
//! many words (`20260805214322:319-325`), along with the consequence: its rows
//! *"cannot be scoped by v\_owner"*, so the loop that moves them matches on the
//! category id alone. That is safe *"because a category id is a globally unique
//! uuid, so matching on it can only reach this owner's templates"*.
//!
//! Locally the column is `TEXT NOT NULL REFERENCES users(id)` — the same uuid as
//! everything else, because there is no Clerk in a local file and a second kind
//! of identity would be an import of a problem rather than of a behaviour. So the
//! local edition *could* scope the loop by owner, and deliberately does not: the
//! verb reproduces the cloud's selection, not a tightening of it. The two
//! selections agree on every row that can actually exist (the uniqueness argument
//! above holds locally too), and where they might not, the port is the one that
//! matches.
//!
//! MEASURED (`probe-cat1.sh`, `x4`): the reference cluster moves such a template
//! and writes one `recurring_transaction/update` entry for it.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;

/// A recurring template as stored, in the serialised order.
#[derive(Debug, Clone, Serialize)]
pub struct RecurringRow {
    /// Primary key.
    pub id: String,
    /// Owner. The Clerk id in the cloud, a `users(id)` uuid locally — see the
    /// module docs.
    pub user_id: String,
    /// The account the generated rows land in. Nullable in both engines.
    pub account_id: Option<String>,
    /// Payee or description for every row this template makes.
    pub description: String,
    /// Signed amount.
    pub amount: Money,
    /// `income` | `expense`. A template cannot be a transfer in either engine.
    #[serde(rename = "type")]
    pub kind: String,
    /// A category id as text, `NOT NULL` — the only one of the four reference
    /// surfaces a merge moves that cannot be blank.
    pub category: String,
    /// `daily` | `weekly` | … — enumerated by CHECK in both engines.
    pub frequency: String,
    /// First occurrence.
    pub start_date: String,
    /// Last occurrence, when the series ends.
    pub end_date: Option<String>,
    /// The next one due.
    pub next_date: String,
    /// A paused template stays in the file and makes nothing.
    pub is_active: bool,
    /// Does it write the row itself, or only propose it?
    pub auto_create: bool,
    /// When the row was made.
    pub created_at: String,
    /// When it last changed.
    pub updated_at: String,
}

/// Read one recurring template, whole.
///
/// # Errors
/// [`crate::error::CoreError`] if the row is absent or the read fails.
pub fn read(connection: &Connection, id: &str) -> CoreResult<RecurringRow> {
    Ok(connection.query_row(
        "SELECT id, user_id, account_id, description, amount_minor, type, category,
                frequency, start_date, end_date, next_date, is_active, auto_create,
                created_at, updated_at
           FROM recurring_transactions
          WHERE id = ?1",
        params![id],
        |record| {
            Ok(RecurringRow {
                id: record.get(0)?,
                user_id: record.get(1)?,
                account_id: record.get(2)?,
                description: record.get(3)?,
                amount: Money::from_minor(record.get(4)?),
                kind: record.get(5)?,
                category: record.get(6)?,
                frequency: record.get(7)?,
                start_date: record.get(8)?,
                end_date: record.get(9)?,
                next_date: record.get(10)?,
                is_active: record.get::<_, i64>(11)? != 0,
                auto_create: record.get::<_, i64>(12)? != 0,
                created_at: record.get(13)?,
                updated_at: record.get(14)?,
            })
        },
    )?)
}
