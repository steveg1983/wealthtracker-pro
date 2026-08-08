//! An account, as an audit entry has to record it.
//!
//! # Why this exists at all
//!
//! Until the split writer, every verb in this crate audited exactly one entity:
//! the transaction. `set_transaction_splits_with_legs` audits **three** —
//! the split parent, each counterpart it mints, and the `accounts` row each
//! balance move touches (`20260806094058:411-415`, `:467-469`). The cloud writes
//! `to_jsonb(v_acct)`, the whole row, before and after. An audit entry that
//! recorded only "a balance changed" would not say *from what*, which is the
//! half that makes the log evidence.
//!
//! # A projection, not the whole row
//!
//! `accounts` has thirty columns locally and a balance move touches two of them
//! (`balance_minor`, `updated_at`). This carries the money, the identity and the
//! currency — everything a reader needs to check the arithmetic and nothing that
//! would make the entry a copy of the account's marketing details. That is the
//! same decision [`crate::row::TransactionRow`] makes, and for the same reason:
//! the audit payload is compared field by field by the differential harness, so
//! every field in it is a field two engines have to agree about.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;

/// An account as stored, in the shape the audit log records.
#[derive(Debug, Clone, Serialize)]
pub struct AccountRow {
    /// Primary key.
    pub id: String,
    /// Owner.
    pub user_id: String,
    /// As shown, and as the To/From category is named after.
    pub name: String,
    /// `checking` | `savings` | … — enumerated by CHECK in both engines.
    #[serde(rename = "type")]
    pub kind: String,
    /// ISO 4217. Locally `NOT NULL DEFAULT 'GBP'`; the cloud's column is
    /// nullable, which is why the currency guard tolerates a missing one.
    pub currency: String,
    /// The ledger balance. B-1: `initial_balance + Σ(transactions.amount)`.
    pub balance: Money,
    /// What the account held before any transaction in this file.
    pub initial_balance: Money,
    /// Closed accounts stay in the file and out of the pickers.
    pub is_active: bool,
}

/// Read one account, but only if it belongs to this user.
///
/// `None` is the port of the cloud's `IF NOT FOUND` after
/// `SELECT … WHERE id = … AND user_id = …`: it deliberately does not distinguish
/// "no such account" from "somebody else's account", because telling them apart
/// confirms an id exists to a caller who may not see it.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_owned(
    connection: &Connection,
    id: &str,
    user_id: &str,
) -> CoreResult<Option<AccountRow>> {
    Ok(connection
        .query_row(
            "SELECT id, user_id, name, type, currency, balance_minor,
                    initial_balance_minor, is_active
               FROM accounts
              WHERE id = ?1
                AND user_id = ?2",
            params![id, user_id],
            |record| {
                Ok(AccountRow {
                    id: record.get(0)?,
                    user_id: record.get(1)?,
                    name: record.get(2)?,
                    kind: record.get(3)?,
                    currency: record.get(4)?,
                    balance: Money::from_minor(record.get(5)?),
                    initial_balance: Money::from_minor(record.get(6)?),
                    is_active: record.get::<_, i64>(7)? != 0,
                })
            },
        )
        .optional()?)
}

/// An account's name, for a refusal that has to say which account it means.
///
/// The port of `COALESCE((SELECT a.name FROM accounts a WHERE a.id = …),
/// 'another account')`, which is how every leg refusal in
/// `20260806094058` names the other side. The fallback matters: the id may point
/// at an account that has since been deleted, and *"the line transferring to
/// another account"* is still a sentence, where *"the line transferring to "*
/// is not.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn name_or_another(connection: &Connection, id: Option<&str>) -> CoreResult<String> {
    let Some(id) = id else {
        return Ok("another account".to_owned());
    };
    let name: Option<String> = connection
        .query_row(
            "SELECT name FROM accounts WHERE id = ?1",
            params![id],
            |record| record.get(0),
        )
        .optional()?;
    Ok(name.unwrap_or_else(|| "another account".to_owned()))
}
