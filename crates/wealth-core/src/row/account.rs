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
//!
//! # And a SECOND projection, because a reader needs a different account
//!
//! [`ListedAccount`] is the whole row, and the two types are not a duplication
//! waiting to be merged. They answer different questions and the difference is
//! load-bearing in both directions:
//!
//! * [`AccountRow`]'s eight fields are the fields
//!   `link_bank_account_snap`'s answer is compared on, field by field, against
//!   the live RPC (`lib/verb-postgres.mjs` builds exactly those eight). Widening
//!   it would put `created_at` into that comparison — two clocks, two engines,
//!   never equal — and turn a passing differential surface red for no gain.
//! * [`ListedAccount`] cannot be narrower, because the app draws an account from
//!   it: `mapAccountFromDb` (`src/services/api/accountMapping.ts`) is written
//!   against `select('*')` and reads twenty of these columns, including the four
//!   an account's identity depends on (sort code, account number, institution,
//!   parent) and the three the reconciliation bar depends on.
//!
//! **Two columns the cloud has and this file does not**: `plaid_account_id` and
//! `plaid_connection_id`. A local file has no bank feed to carry an id for, so
//! both are an absence by design.
//!
//! There were THREE. `last_reconciled_balance` was the odd one out — a gap
//! rather than a decision, named here rather than papered over because
//! `mapAccountFromDb` reads it and treats a missing one as *never reconciled*,
//! which is a true statement about a file that cannot store it and a false one
//! about an account that has been. Slice 20 closed it: `schema.sql` now carries
//! `last_reconciled_balance_minor`, [`ListedAccount`] carries it below, and
//! [`crate::verbs::update_account`] can write it, because `AccountUpdate` — the
//! seam's own type for what an account edit may say — names it.

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

/// An account as the app lists it: every column this file holds, in the
/// serialised order.
///
/// Money leaves as a decimal string under the CLOUD's column name —
/// `balance`, not `balance_minor` — because the value is no longer minor units
/// once it is rendered, and because the one mapper on the far side
/// (`accountMapping.ts`, itself the fix for an era with two of them) is written
/// against those names. A local name on a rendered value would be a third
/// spelling of one field.
#[derive(Debug, Clone, Serialize)]
// Two booleans, because the table has two boolean columns. The reasoning
// `TransactionRow` gives: this is a row, not a designed API.
#[allow(clippy::struct_excessive_bools)]
pub struct ListedAccount {
    /// Primary key.
    pub id: String,
    /// Owner.
    pub user_id: String,
    /// As shown, and as the To/From category is named after.
    pub name: String,
    /// `checking` | `savings` | … — enumerated by CHECK in both engines. The
    /// app renames `checking` to `current` in its own mapper, not here.
    #[serde(rename = "type")]
    pub kind: String,
    /// ISO 4217.
    pub currency: String,
    /// The ledger balance. B-1: `initial_balance + Σ(transactions.amount)`.
    pub balance: Money,
    /// What the account held before any transaction in this file.
    pub initial_balance: Money,
    /// The bank's own figure. COMPARED against, never added to.
    pub bank_balance: Option<Money>,
    /// `YYYY-MM-DD`: the day the bank's figure was true.
    pub bank_balance_date: Option<String>,
    /// `YYYY-MM-DD`: the last statement this account was reconciled against.
    pub last_reconciled_date: Option<String>,
    /// The ending balance that reconciliation was settled against. `None` means
    /// none has ever been finalized — never zero, which is a real figure.
    pub last_reconciled_balance: Option<Money>,
    /// Does a low balance raise an alert?
    pub low_balance_alert_enabled: bool,
    /// The figure it raises one below.
    pub low_balance_threshold: Option<Money>,
    /// `YYYY-MM-DD`: the day `initial_balance` was true.
    pub opening_balance_date: Option<String>,
    /// `YYYY-MM-DD`: everything before this is archived out of the register.
    pub archive_through_date: Option<String>,
    /// The investment account this cash sleeve belongs to.
    pub parent_account_id: Option<String>,
    /// The bank, as shown.
    pub institution: Option<String>,
    /// Stored redacted for card types; the rule lives in the writer.
    pub account_number: Option<String>,
    /// Sterling sort code, when there is one.
    pub sort_code: Option<String>,
    /// Display only.
    pub icon: Option<String>,
    /// Display only.
    pub color: Option<String>,
    /// Free text.
    pub notes: Option<String>,
    /// Closed accounts stay in the file and out of the pickers.
    pub is_active: bool,
    /// Opaque labels. Money is banned from it by CHECK.
    pub metadata: serde_json::Value,
    /// When the row was made. The list's sort key.
    pub created_at: String,
    /// When it last changed. The app shows this as `lastUpdated`.
    pub updated_at: String,
}

/// Every column [`ListedAccount`] carries, in its serialised order.
const LISTED_COLUMNS: &str = "id, user_id, name, type, currency, balance_minor,
        initial_balance_minor, bank_balance_minor, bank_balance_date,
        last_reconciled_date, last_reconciled_balance_minor,
        low_balance_alert_enabled, low_balance_threshold_minor,
        opening_balance_date, archive_through_date, parent_account_id, institution,
        account_number, sort_code, icon, color, notes, is_active, metadata,
        created_at, updated_at";

/// The accounts a login can put a transaction against.
///
/// The port of `accountService.getAccounts`: `.eq('user_id', …)`,
/// `.eq('is_active', true)`, `.order('created_at', { ascending: true })`.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_open(connection: &Connection, user_id: &str) -> CoreResult<Vec<ListedAccount>> {
    list_by_activity(connection, user_id, true)
}

/// The accounts that have been closed, and only those.
///
/// The port of `accountService.getClosedAccounts`, which is the same query with
/// `.eq('is_active', false)`. Two functions rather than one flag, because the
/// two VERBS are two verbs (PHASE3-PLAN §3: *"two verbs, not a boolean
/// param — crate naming discipline"*) and a call site that reads
/// `list_closed(…)` cannot be misread the way `list(…, false)` can.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_closed(connection: &Connection, user_id: &str) -> CoreResult<Vec<ListedAccount>> {
    list_by_activity(connection, user_id, false)
}

/// The one query behind both, because the two differ by one bound value and a
/// second copy of twenty-five columns is a second place to forget one.
///
/// `ORDER BY created_at, id` — the second key is this crate's own and is NOT a
/// port of anything; [`crate::verbs::reads`] argues why every read here states
/// one.
fn list_by_activity(
    connection: &Connection,
    user_id: &str,
    is_active: bool,
) -> CoreResult<Vec<ListedAccount>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH accounts USING INDEX idx_accounts_user (user_id=?)
    //   USE TEMP B-TREE FOR ORDER BY
    //
    // The ONE thing interpolated into this statement is `LISTED_COLUMNS`, a
    // crate constant. Both values a caller supplies are bound parameters. That
    // distinction is DESIGN §6.4's whole point and it is worth spelling out
    // here, because `format!` in the same expression as SQL is exactly what a
    // reviewer should stop on.
    let mut statement = connection.prepare(&format!(
        "SELECT {LISTED_COLUMNS}
           FROM accounts
          WHERE user_id = ?1
            AND is_active = ?2
          ORDER BY created_at, id"
    ))?;
    let rows = statement.query_map(params![user_id, i64::from(is_active)], from_record)?;

    let mut accounts = Vec::new();
    for account in rows {
        accounts.push(account?);
    }
    Ok(accounts)
}

/// ONE account, whole, and only if it belongs to this user.
///
/// The twin of [`read_owned`] over the WIDE projection, and the two are not
/// interchangeable: that one exists so the audit payload of a balance move
/// carries eight comparable fields, this one exists so an account WRITE can
/// answer with the same object a read answers with. B-7 is why — *"the caller
/// puts it straight into app state without re-reading"* — and a create that
/// answered with the narrow projection would hand the settings modal an account
/// with no bank details, which is the exact field set B-7 was written after.
///
/// `None` for "no such account" and for "somebody else's", deliberately
/// undistinguished; [`read_owned`] gives the reason.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_listed(
    connection: &Connection,
    id: &str,
    user_id: &str,
) -> CoreResult<Option<ListedAccount>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH accounts USING INTEGER PRIMARY KEY (rowid=?)
    // — the primary key, so no index on user_id is consulted or wanted: the
    // owner clause is a filter on the one row, not a way of finding it.
    Ok(connection
        .query_row(
            &format!(
                "SELECT {LISTED_COLUMNS}
                   FROM accounts
                  WHERE id = ?1
                    AND user_id = ?2"
            ),
            params![id, user_id],
            from_record,
        )
        .optional()?)
}

/// One `accounts` record in [`LISTED_COLUMNS`] order, as a [`ListedAccount`].
///
/// Written once and shared by the list reads and the single read, because
/// twenty-six positional `record.get(n)` calls are the one thing in this file
/// that a second copy would get subtly wrong — and would get wrong SILENTLY,
/// since every neighbouring column is the same SQLite type.
fn from_record(record: &rusqlite::Row<'_>) -> rusqlite::Result<ListedAccount> {
    let metadata_text: String = record.get(23)?;
    Ok(ListedAccount {
        id: record.get(0)?,
        user_id: record.get(1)?,
        name: record.get(2)?,
        kind: record.get(3)?,
        currency: record.get(4)?,
        balance: Money::from_minor(record.get(5)?),
        initial_balance: Money::from_minor(record.get(6)?),
        bank_balance: record.get::<_, Option<i64>>(7)?.map(Money::from_minor),
        bank_balance_date: record.get(8)?,
        last_reconciled_date: record.get(9)?,
        last_reconciled_balance: record.get::<_, Option<i64>>(10)?.map(Money::from_minor),
        low_balance_alert_enabled: record.get::<_, i64>(11)? != 0,
        low_balance_threshold: record.get::<_, Option<i64>>(12)?.map(Money::from_minor),
        opening_balance_date: record.get(13)?,
        archive_through_date: record.get(14)?,
        parent_account_id: record.get(15)?,
        institution: record.get(16)?,
        account_number: record.get(17)?,
        sort_code: record.get(18)?,
        icon: record.get(19)?,
        color: record.get(20)?,
        notes: record.get(21)?,
        is_active: record.get::<_, i64>(22)? != 0,
        metadata: serde_json::from_str(&metadata_text).unwrap_or(serde_json::Value::Null),
        created_at: record.get(24)?,
        updated_at: record.get(25)?,
    })
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
