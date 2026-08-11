//! `update_account` — the port of a PostgREST `UPDATE`, not of a function.
//!
//! # What it is a port OF
//!
//! `accountService.updateAccount` (`src/services/api/accountService.ts:289-336`):
//! `mapAccountToDb(await this.cardSafeUpdates(id, updates, userId))` sent as
//! `.from('accounts').update(…).eq('id', id)[.eq('user_id', userId)]`. There is
//! no `update_account_atomic`; `accounts` is written directly, so what is ported
//! is that write — its column map, its card rule and its owner clause.
//! PHASE3-PLAN D-2, and [`crate::verbs::create_account`] carries the full
//! argument for why a table with no RPC still needs a verb here.
//!
//! # ONE presence rule for eighteen fields, and that is the cloud's own
//!
//! `update_transaction` needed four behaviours and a measured table to tell them
//! apart, because `update_transaction_atomic` is a hand-written function whose
//! SET list mixes `COALESCE`, `p ? 'k'` and `NULLIF` per column. This has none of
//! that. `mapAccountToDb` is eleven lines and its whole rule is:
//!
//! > `undefined` means "leave this alone" and is dropped; `null` means "clear
//! > the stored value" and is kept.
//!
//! So there is exactly one class here — the `p ? 'k'` class — and every field
//! follows it: **the key being present is the whole test, and a JSON null stores
//! NULL.** Where the column is `NOT NULL` in this file (`name`, `type`,
//! `currency`, `is_active`, `initial_balance_minor`) a stated null is refused by
//! the file rather than smoothed over here. That is a DECLARED divergence and it
//! is the schema's, not this verb's: the cloud left four of those columns
//! nullable and `schema.sql` did not, on the grounds that an account with no
//! name and no currency is not a state worth being able to reach.
//!
//! # THERE IS NO `balance`, AND SAYING SO BY NAME IS THE POINT
//!
//! `mapAccountToDb` will happily send `balance`, because `AccountUpdate` is a
//! `Partial<Account>` and `Account` has one. That makes the cloud's account
//! update an **absolute balance setter** — the exact thing `verbs/mod.rs` opens
//! by saying this crate does not have, and the thing `accountService.ts:403-412`
//! removed two other methods for being.
//!
//! This verb refuses it by name: `account_balance_is_derived`. Not as an unknown
//! field — the key is accepted into the patch struct precisely so the refusal can
//! say what the rule is and what to do instead, because a caller told
//! "unknown field: balance" will reasonably conclude the field is misspelled.
//!
//! What DOES move a balance here is an edit of the OPENING balance, and it moves
//! it in SQL, relative, in the same statement:
//!
//! ```text
//! initial_balance_minor = <new>
//! balance_minor         = balance_minor + (<new> − initial_balance_minor)
//! ```
//!
//! Both right-hand sides see the OLD row (the SQL standard for `UPDATE … SET`,
//! and VERIFIED in SQLite by `update_transaction`'s own note), so the two lines
//! together add the same delta to both sides of B-1 and leave it true —
//! `link_bank_account_snap`'s rebase, arrived at from the other end. The CLOUD
//! does not do this: it sets `initial_balance` and leaves `balance` where it was,
//! so correcting an opening balance in the cloud silently breaks the ledger
//! identity by the size of the correction. MEASURED, and declared.
//!
//! # The card rule, and the type this write leaves behind
//!
//! `accountNumberUpdateForStorage(updates, storedType)`: an absent account
//! number is untouched; a present one is cut to its last four **iff the account
//! will be a card once this write lands** — the payload's type when it carries
//! one, the stored type otherwise. The cloud reads the stored type back with a
//! second round trip and REFUSES the write if it cannot
//! (`readStoredAccountType`, *"truncating on a guess would destroy a real
//! 8-digit bank number"*). Here the row is already in hand inside the
//! transaction, so the failure mode the cloud has to guard against cannot arise.
//!
//! Unlike the create, an empty account number is NOT collapsed to NULL:
//! `accountNumberUpdateForStorage` applies `keepLastFour` and nothing else, so
//! `""` clears the field to an empty string on both engines. The two helpers
//! really do differ there and the difference is reproduced rather than tidied.
//!
//! # C-4 rides along, and is not implemented here
//!
//! Renaming an account renames its To/From category; closing one hides it. Both
//! are `trg_sync_transfer_category_for_account`
//! (`schema.sql`, port of `20260708140000:90-119`), fired by this UPDATE, and
//! collision-guarded there — a rename into a name another category already holds
//! keeps the old category name rather than aborting the rename. Nothing in this
//! verb knows about any of it, which is what makes it parity with the cloud
//! trigger rather than a second implementation of it.
//!
//! # No guard, measured
//!
//! An UPDATE of `accounts`. Every `trg_protect_split_*` is `BEFORE UPDATE OF` a
//! column on `transactions`; C-5 is `BEFORE DELETE` on `categories`. What fires
//! is `trg_sync_transfer_category_for_account` (wanted) and
//! `trg_accounts_updated_at`, which stands down of its own accord because this
//! verb writes `updated_at` itself. `tests/account_family.rs` asserts the guard
//! table empty across a rename rather than reasoning about it.

use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::admission::account_identifiers::keep_last_four;
use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, ListedAccount};
use crate::wire::{Field, Flag};

use super::create_account::resolve_flag_field;

/// The command.
///
/// `(p_id, p, p_user_id)` in the shape every verb here uses, so the differential
/// harness can send ONE payload to both engines.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateAccount {
    /// Which account.
    pub id: String,
    /// Whose. Absent means "name no owner", which in the cloud falls back to
    /// RLS and here means the ownership clause is simply not applied — the same
    /// decision `update_transaction` documents at length.
    #[serde(default)]
    pub user_id: Option<String>,
    /// The fields to change.
    #[serde(default)]
    pub patch: AccountPatch,
}

/// The settable columns, each in the three states `jsonb` can present.
///
/// Every one of them is the `p ? 'k'` class — see the module docs. The two that
/// are not plain assignments are `initial_balance` (which moves the balance with
/// it) and `account_number` (the card rule).
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccountPatch {
    /// As shown. Renames the To/From category, through C-4.
    #[serde(default)]
    pub name: Field<String>,
    /// `checking` | `savings` | … The app's 'current' is renamed by the CLIENT,
    /// in both editions; the CHECK judges whatever arrives.
    #[serde(default, rename = "type")]
    pub kind: Field<String>,
    /// ISO 4217, three upper-case letters — `accounts_currency_shaped`.
    #[serde(default)]
    pub currency: Field<String>,
    /// THE REFUSAL. Present here only so it can be refused by name; see the
    /// module docs. Typed as raw JSON because its value is never read.
    #[serde(default)]
    pub balance: Field<serde_json::Value>,
    /// The opening balance. Moves `balance` by the difference, in SQL.
    #[serde(default)]
    pub initial_balance: Field<Money>,
    /// Closed accounts stay in the file and out of the pickers. C-4 mirrors it
    /// onto the To/From category.
    #[serde(default)]
    pub is_active: Field<Flag>,
    /// The bank, as shown.
    #[serde(default)]
    pub institution: Field<String>,
    /// Sterling sort code.
    #[serde(default)]
    pub sort_code: Field<String>,
    /// Cut to four digits for a card. See the module docs.
    #[serde(default)]
    pub account_number: Field<String>,
    /// `YYYY-MM-DD`, or the ISO instant `toISOString()` produces for one.
    #[serde(default)]
    pub opening_balance_date: Field<String>,
    /// `YYYY-MM-DD`: everything on or before this is archived out of the
    /// register. A view flag; it never moves a balance.
    #[serde(default)]
    pub archive_through_date: Field<String>,
    /// Free text.
    #[serde(default)]
    pub notes: Field<String>,
    /// Does a low balance raise an alert?
    #[serde(default)]
    pub low_balance_alert_enabled: Field<Flag>,
    /// The figure it raises one below.
    #[serde(default)]
    pub low_balance_threshold: Field<Money>,
    /// The bank's own figure. COMPARED against, never added to — writing it
    /// here does not touch `balance`, which is B-6.
    #[serde(default)]
    pub bank_balance: Field<Money>,
    /// `YYYY-MM-DD`: the day the bank's figure was true.
    #[serde(default)]
    pub bank_balance_date: Field<String>,
    /// `YYYY-MM-DD`: the last statement this account was reconciled against.
    #[serde(default)]
    pub last_reconciled_date: Field<String>,
    /// The ending balance that reconciliation settled against. The column this
    /// file gained in slice 20; `row/account.rs` carries why.
    #[serde(default)]
    pub last_reconciled_balance: Field<Money>,
    /// The investment account a cash sleeve belongs to. Self-referential and
    /// owner-scoped by a composite foreign key, so a stranger's account is
    /// refused by the file.
    #[serde(default)]
    pub parent_account_id: Field<String>,
}

/// What the verb hands back: the row as it now stands, and the audit entry.
#[derive(Debug, Serialize)]
pub struct UpdateAccountResult {
    /// The account as stored after the edit — the same projection a read
    /// answers with, so the caller can put it straight into state.
    pub answer: ListedAccount,
    /// Dense sequence number of the audit row written for this update.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Edit one account, move its balance if its opening balance moved, and audit
/// it — all in one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for `account_not_found_or_not_owned`,
/// `account_balance_is_derived`, `date_invalid`, `boolean_invalid`, or a rule the
/// file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn update_account(
    connection: &mut Connection,
    command: UpdateAccount,
) -> CoreResult<UpdateAccountResult> {
    let patch = &command.patch;

    // Everything that can refuse without touching the file, before the file is
    // touched.
    if patch.balance.is_present() {
        return Err(CoreError::Refused(
            Refusal::named(
                "account_balance_is_derived",
                "an account's balance is its opening balance plus its transactions, so it cannot \
                 be set directly",
            )
            .with_hint(
                "Correct the opening balance instead, or add the transaction that accounts for \
                 the difference — either way the register will add up to the figure on screen.",
            ),
        ));
    }
    let days = Days {
        opening_balance: day_field(&patch.opening_balance_date, "opening_balance_date")?,
        archive_through: day_field(&patch.archive_through_date, "archive_through_date")?,
        bank_balance: day_field(&patch.bank_balance_date, "bank_balance_date")?,
        last_reconciled: day_field(&patch.last_reconciled_date, "last_reconciled_date")?,
    };
    let flags = Flags {
        is_active: resolve_flag_field(&patch.is_active, "is_active")?,
        low_balance_alert_enabled: resolve_flag_field(
            &patch.low_balance_alert_enabled,
            "low_balance_alert_enabled",
        )?,
    };

    // BEGIN IMMEDIATE: the write lock up front, so the read-then-update below is
    // the cloud's `SELECT … FOR UPDATE` without the lock it has nothing to add.
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let Some(before) = read_scoped(&transaction, &command.id, command.user_id.as_deref())? else {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    };

    let changed = apply_patch(&transaction, &command, &before, &days, flags, &now)?;
    // `id` is the primary key and the row was just proven to exist, so more than
    // one is unreachable and zero would mean the WHERE clause had drifted from
    // the one that found it. SQLite reports zero changed rows and raises nothing
    // at all, which is the silence this crate refuses to leave.
    if changed != 1 {
        return Err(CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between finding it and editing it",
        ));
    }

    let after = account::read_listed(&transaction, &command.id, &before.user_id)?.ok_or_else(
        || {
            CoreError::refuse(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                "the account disappeared between editing it and reading it back",
            )
        },
    )?;

    let entry = audit::write(
        &transaction,
        &after.user_id,
        "account",
        &command.id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(UpdateAccountResult {
        answer: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The four `date` columns, already validated. Absent and null are both `None`
/// here; the patch's own `is_present` is what tells them apart in the statement.
struct Days {
    opening_balance: Option<String>,
    archive_through: Option<String>,
    bank_balance: Option<String>,
    last_reconciled: Option<String>,
}

/// The two booleans, already cast out of their text form.
#[derive(Debug, Clone, Copy)]
struct Flags {
    is_active: Option<bool>,
    low_balance_alert_enabled: Option<bool>,
}

/// The single UPDATE, column for column against `mapAccountToDb`'s output.
///
/// One statement rather than a SET list assembled in Rust, for
/// `update_transaction`'s two reasons: a statement built by concatenation is a
/// SQL surface and this crate has none (DESIGN.md §6.4), and `ELSE <column>` is
/// what makes "leave it alone" mean *the stored value* rather than *what this
/// process read a moment ago*.
fn apply_patch(
    transaction: &rusqlite::Transaction<'_>,
    command: &UpdateAccount,
    before: &ListedAccount,
    days: &Days,
    flags: Flags,
    now: &str,
) -> CoreResult<usize> {
    let patch = &command.patch;
    // The card rule needs the type the row will HAVE once this lands: the
    // payload's when it states one, the stored one otherwise.
    let resulting_type = patch.kind.value().map_or(before.kind.as_str(), String::as_str);
    let account_number = patch
        .account_number
        .value()
        .map(|value| keep_last_four_if_card(value, resulting_type));

    Ok(transaction.execute(
        "UPDATE accounts SET
           name                          = CASE WHEN ?1  THEN ?2  ELSE name END,
           type                          = CASE WHEN ?3  THEN ?4  ELSE type END,
           currency                      = CASE WHEN ?5  THEN ?6  ELSE currency END,
           initial_balance_minor         = CASE WHEN ?7  THEN ?8  ELSE initial_balance_minor END,
           -- B-1, both sides moved by one delta. The right-hand side reads the
           -- OLD initial_balance_minor, so this is `balance + (new - old)` and
           -- never an absolute assignment.
           balance_minor                 = CASE WHEN ?7
                                                THEN balance_minor + (?8 - initial_balance_minor)
                                                ELSE balance_minor END,
           is_active                     = CASE WHEN ?9  THEN ?10 ELSE is_active END,
           institution                   = CASE WHEN ?11 THEN ?12 ELSE institution END,
           sort_code                     = CASE WHEN ?13 THEN ?14 ELSE sort_code END,
           account_number                = CASE WHEN ?15 THEN ?16 ELSE account_number END,
           opening_balance_date          = CASE WHEN ?17 THEN ?18 ELSE opening_balance_date END,
           archive_through_date          = CASE WHEN ?19 THEN ?20 ELSE archive_through_date END,
           notes                         = CASE WHEN ?21 THEN ?22 ELSE notes END,
           low_balance_alert_enabled     = CASE WHEN ?23 THEN ?24 ELSE low_balance_alert_enabled END,
           low_balance_threshold_minor   = CASE WHEN ?25 THEN ?26 ELSE low_balance_threshold_minor END,
           bank_balance_minor            = CASE WHEN ?27 THEN ?28 ELSE bank_balance_minor END,
           bank_balance_date             = CASE WHEN ?29 THEN ?30 ELSE bank_balance_date END,
           last_reconciled_date          = CASE WHEN ?31 THEN ?32 ELSE last_reconciled_date END,
           last_reconciled_balance_minor = CASE WHEN ?33 THEN ?34 ELSE last_reconciled_balance_minor END,
           parent_account_id             = CASE WHEN ?35 THEN ?36 ELSE parent_account_id END,
           updated_at                    = ?37
         WHERE id = ?38",
        params![
            patch.name.is_present(),
            patch.name.value(),
            patch.kind.is_present(),
            patch.kind.value(),
            patch.currency.is_present(),
            patch.currency.value(),
            patch.initial_balance.is_present(),
            patch.initial_balance.value().map(|amount| amount.minor()),
            patch.is_active.is_present(),
            flags.is_active.map(i64::from),
            patch.institution.is_present(),
            patch.institution.value(),
            patch.sort_code.is_present(),
            patch.sort_code.value(),
            patch.account_number.is_present(),
            account_number,
            patch.opening_balance_date.is_present(),
            days.opening_balance,
            patch.archive_through_date.is_present(),
            days.archive_through,
            patch.notes.is_present(),
            patch.notes.value(),
            patch.low_balance_alert_enabled.is_present(),
            flags.low_balance_alert_enabled.map(i64::from),
            patch.low_balance_threshold.is_present(),
            patch.low_balance_threshold.value().map(|amount| amount.minor()),
            patch.bank_balance.is_present(),
            patch.bank_balance.value().map(|amount| amount.minor()),
            patch.bank_balance_date.is_present(),
            days.bank_balance,
            patch.last_reconciled_date.is_present(),
            days.last_reconciled,
            patch.last_reconciled_balance.is_present(),
            patch.last_reconciled_balance.value().map(|amount| amount.minor()),
            patch.parent_account_id.is_present(),
            patch.parent_account_id.value(),
            now,
            command.id,
        ],
    )?)
}

/// The row, scoped exactly as `.eq('id', id)[.eq('user_id', userId)]`.
///
/// An absent owner names no owner: the local twin of the cloud falling back to
/// RLS, and the same `?2 IS NULL OR user_id = ?2` shape `update_transaction`
/// uses. Shared by [`update_account`] and [`super::close_account`], because two
/// copies of an ownership clause are two chances to write one of them wrongly.
pub(super) fn read_scoped(
    connection: &Connection,
    id: &str,
    user_id: Option<&str>,
) -> CoreResult<Option<ListedAccount>> {
    let owner: Option<String> = connection
        .query_row(
            "SELECT user_id FROM accounts WHERE id = ?1 AND (?2 IS NULL OR user_id = ?2)",
            params![id, user_id],
            |row| row.get(0),
        )
        .optional()?;
    match owner {
        None => Ok(None),
        Some(owner) => account::read_listed(connection, id, &owner),
    }
}

/// `keepLastFour` when the account will be a card, the value untouched
/// otherwise — `accountNumberUpdateForStorage`, and deliberately WITHOUT the
/// create helper's empty-to-NULL collapse. See the module docs.
fn keep_last_four_if_card(value: &str, resulting_type: &str) -> String {
    if resulting_type == super::create_account::CARD_ACCOUNT_TYPE {
        keep_last_four(value)
    } else {
        value.to_owned()
    }
}

/// A calendar day out of a patch field, or nothing.
///
/// A stated JSON null clears the column and is not a date to validate; a stated
/// value goes through the same two-spelling rule the create uses.
fn day_field(field: &Field<String>, name: &str) -> CoreResult<Option<String>> {
    match field.value() {
        None => Ok(None),
        Some(value) => super::create_account::calendar_day(value, name),
    }
}
