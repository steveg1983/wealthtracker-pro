//! Reading a stored row back out, in the canonical shape everything else
//! compares against.
//!
//! # Why money leaves as a string
//!
//! Every money field is serialised through [`Money`], so it leaves this crate as
//! `"-12.34"` and never as a JSON number. That is what makes the differential
//! harness able to compare a SQLite row (`-1234` minor units) against a Postgres
//! row (`numeric(20,2)`, which casts to text as `-12.34`) without either side
//! going through a float on the way.
//!
//! # Why the row is read back rather than reconstructed
//!
//! The audit's `after` has to be what storage holds — column defaults, triggers
//! and all — or the log records what the caller asked for rather than what
//! happened. `to_jsonb(v_tx)` in the cloud RPCs is the same decision: it
//! serialises the `RETURNING` row.
//!
//! # One module per entity the audit log can name
//!
//! `financial_audit_log.entity` is free text in both engines, and between them
//! the RPCs put five things in it: `transaction`, `account`, the split (through
//! the split writer's embedded line set), `budget` and `recurring_transaction`.
//! Each has its own reader here, because each is a different set of columns and a
//! shared "row" type would be a union that is wrong for all five.
//!
//! The last three arrived with `merge_categories`, which is the first verb to
//! write outside the transaction/account pair — and the first to audit a
//! `category`, which is why [`category`] now carries a row type as well as the
//! two *questions* the write verbs ask about one.

pub mod account;
pub mod budget;
pub mod category;
pub mod recurring;
pub mod split;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;

/// A transaction as stored.
///
/// Field order is the serialised order (`serde_json` is built with
/// `preserve_order`), so two runs of the same verb produce byte-identical audit
/// payloads and the hash chain means something.
#[derive(Debug, Clone, Serialize)]
// Six booleans, because the table has six boolean columns. `struct_excessive_bools`
// is advice about designing an API; this is not a designed API, it is a row, and
// collapsing `is_cleared`/`is_split`/`archived` into a state enum would invent a
// state machine the schema does not have and make every differential assertion a
// translation.
#[allow(clippy::struct_excessive_bools)]
pub struct TransactionRow {
    /// Primary key.
    pub id: String,
    /// Owner.
    pub user_id: String,
    /// The account whose balance this row moved.
    pub account_id: String,
    /// Payee or description, as entered or as the file stated it.
    pub description: String,
    /// Signed amount, as a decimal string.
    pub amount: Money,
    /// `income` | `expense` | `transfer`.
    #[serde(rename = "type")]
    pub kind: String,
    /// `YYYY-MM-DD`.
    pub date: String,
    /// Category id or legacy sentinel. TEXT with no foreign key (R-3).
    pub category: Option<String>,
    /// The category foreign key, which is the one that gets nulled.
    pub category_id: Option<String>,
    /// Free text.
    pub notes: Option<String>,
    /// Feed-supplied merchant.
    pub merchant_name: Option<String>,
    /// Feed-supplied.
    pub location_city: Option<String>,
    /// Feed-supplied.
    pub location_country: Option<String>,
    /// Feed-supplied.
    pub payment_channel: Option<String>,
    /// Part of a recurring series.
    pub is_recurring: bool,
    /// Reconciled against a statement.
    pub is_cleared: bool,
    /// Is this row a split parent?
    pub is_split: bool,
    /// Archived out of the live register.
    pub archived: bool,
    /// The bank's own order within a day.
    pub statement_sequence: Option<i64>,
    /// Has a human vouched for `category`?
    pub category_confirmed: bool,
    /// The other account, when this row is a transfer.
    pub transfer_account_id: Option<String>,
    /// The counterpart row, when the pair is linked.
    pub linked_transfer_id: Option<String>,
    /// The counterpart split line, when the leg lives on one.
    pub linked_transfer_split_id: Option<String>,
    /// File-import provenance.
    pub import_source: Option<String>,
    /// File-import provenance.
    pub import_source_id: Option<String>,
    /// Bank-feed provenance.
    pub external_transaction_id: Option<String>,
    /// Opaque labels and references. Money is banned from it by CHECK.
    pub metadata: serde_json::Value,
    /// Tags, which are a child table locally and a `text[]` in the cloud.
    pub tags: Vec<String>,
}

/// Read one transaction and its tags.
///
/// # Errors
/// [`crate::error::CoreError`] if the row is absent or the read fails.
pub fn read_transaction(connection: &Connection, id: &str) -> CoreResult<TransactionRow> {
    let mut row = connection.query_row(
        "SELECT id, user_id, account_id, description, amount_minor, type, date,
                category, category_id, notes, merchant_name, location_city,
                location_country, payment_channel, is_recurring, is_cleared,
                is_split, archived, statement_sequence, category_confirmed,
                transfer_account_id, linked_transfer_id, linked_transfer_split_id,
                import_source, import_source_id, external_transaction_id, metadata
           FROM transactions
          WHERE id = ?1",
        params![id],
        |record| {
            let metadata_text: String = record.get(26)?;
            Ok(TransactionRow {
                id: record.get(0)?,
                user_id: record.get(1)?,
                account_id: record.get(2)?,
                description: record.get(3)?,
                amount: Money::from_minor(record.get(4)?),
                kind: record.get(5)?,
                date: record.get(6)?,
                category: record.get(7)?,
                category_id: record.get(8)?,
                notes: record.get(9)?,
                merchant_name: record.get(10)?,
                location_city: record.get(11)?,
                location_country: record.get(12)?,
                payment_channel: record.get(13)?,
                is_recurring: record.get::<_, i64>(14)? != 0,
                is_cleared: record.get::<_, i64>(15)? != 0,
                is_split: record.get::<_, i64>(16)? != 0,
                archived: record.get::<_, i64>(17)? != 0,
                statement_sequence: record.get(18)?,
                category_confirmed: record.get::<_, i64>(19)? != 0,
                transfer_account_id: record.get(20)?,
                linked_transfer_id: record.get(21)?,
                linked_transfer_split_id: record.get(22)?,
                import_source: record.get(23)?,
                import_source_id: record.get(24)?,
                external_transaction_id: record.get(25)?,
                metadata: serde_json::from_str(&metadata_text).unwrap_or(serde_json::Value::Null),
                tags: Vec::new(),
            })
        },
    )?;

    let mut statement = connection
        .prepare("SELECT tag FROM transaction_tags WHERE transaction_id = ?1 ORDER BY tag")?;
    let tags = statement.query_map(params![id], |record| record.get::<_, String>(0))?;
    for tag in tags {
        row.tags.push(tag?);
    }
    Ok(row)
}

/// Read one transaction, but only if it belongs to this user — and `None` rather
/// than an error when it does not.
///
/// The port of the shape every transfer RPC opens with:
///
/// ```sql
/// SELECT * INTO v FROM public.transactions
///  WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id);
/// IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found';
/// ```
///
/// Two things are load-bearing and neither is obvious:
///
/// * **`p_user_id IS NULL` stands the guard down.** It is defence in depth on top
///   of RLS, not the only gate, so a call that names no owner is legitimate and
///   the RPCs all default the argument to NULL. Locally there is no RLS, so this
///   is the *whole* gate — which is why every verb passes it through rather than
///   quietly requiring an owner.
/// * **The refusal is the caller's to phrase.** `repair_claimed_transfer` raises
///   `transaction_not_found` three times with three different HINTs, one per
///   role, and that is the only thing telling the user *which* of the three rows
///   went. So this returns `None` and each caller names the row.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_owned_transaction(
    connection: &Connection,
    id: &str,
    user_id: Option<&str>,
) -> CoreResult<Option<TransactionRow>> {
    let owned: Option<i64> = connection
        .query_row(
            "SELECT 1 FROM transactions
              WHERE id = ?1
                AND (?2 IS NULL OR user_id = ?2)",
            params![id, user_id],
            |record| record.get(0),
        )
        .optional()?;
    if owned.is_none() {
        return Ok(None);
    }
    read_transaction(connection, id).map(Some)
}
