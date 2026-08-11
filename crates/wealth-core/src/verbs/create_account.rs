//! `create_account` — the first verb in this crate whose oracle is a
//! TypeScript writer rather than a Postgres function.
//!
//! # What it is a port OF, and why there is no function to name
//!
//! `accountService.createAccount` (`src/services/api/accountService.ts:223-287`)
//! — a PostgREST `INSERT` the client builds, column by column, and sends. There
//! is no `create_account_atomic` and there never has been: `accounts` is one of
//! the tables the cloud writes directly, so what is ported is the WRITE ITSELF,
//! its column list and its defaulting, exactly as [`crate::verbs::reads`] ports
//! a `.select()` rather than a function.
//!
//! That is PHASE3-PLAN D-2, and it is the reason the verb has to exist at all:
//! DESIGN.md §6.4 leaves no SQL door, so a table with no verb is a table the
//! local edition cannot write. `verbs/mod.rs` says of the category family that
//! "a verb here would be a port of nothing" — true of the *cloud*, and the
//! sentence has to be read the other way round for a device: with no RPC and no
//! SQL string, no verb means no accounts.
//!
//! The differential oracle follows: `lib/verb-postgres.mjs` performs the same
//! INSERT through `psql`, transcribed from that TypeScript key for key and
//! default for default, the way the READS table transcribes a query.
//!
//! # THE ONE FIGURE, AND THE CLOUD DEFECT IT DECLINES TO COPY
//!
//! The cloud's insert sends TWO amounts:
//!
//! ```text
//! balance:         account.balance || 0
//! initial_balance: account.openingBalance || account.balance || 0
//! ```
//!
//! B-1 says `balance = initial_balance + Σ(transactions.amount)`, and a brand-new
//! account has no transactions — so those two lines are only consistent while the
//! caller sends one figure. When it sends two, the cloud stores an account whose
//! balance no row justifies. MEASURED against the contract suite's own fixture
//! (`balance: 250.50`, `openingBalance: 200`): the cloud stores 250.50 and 200,
//! `account_balances()` computes 200, and the two disagree by 50.50 for ever.
//! Nothing in the cloud notices, because the cloud has no `verify_integrity`.
//!
//! **This verb takes one figure.** `initial_balance` is the account's whole
//! truth at birth and `balance` is set equal to it, in the same INSERT. There is
//! no `balance` argument, which is the same absence `verbs/mod.rs` opens by
//! describing: *"There is no way to set an absolute figure because there is no
//! function that takes one."* A create is the one moment an account's balance is
//! established and it is established as the opening balance, which is what the
//! app's own call site already does —
//! `AppContextSupabase.addAccount:894-897` sets
//! `balance = initialBalance || balance || 0` before it calls the seam, so in
//! production the two figures are always the same number and this divergence is
//! unobservable. It is declared anyway, in `contract.ts`'s
//! `ACCOUNT_BALANCE_AT_BIRTH` table, because a fixture can send two.
//!
//! The PORT does the `||` chain (`openingBalance ?? balance ?? 0`, falsy-wise,
//! exactly as the cloud's writer spells it) and hands the winner over as
//! `initial_balance`. Which of two contradictory figures wins is a decision
//! about a payload, and it belongs on the side that has the payload's own type.
//!
//! # The card rule moves INTO the ledger, and that is deliberate
//!
//! The cloud applies `accountNumberForStorage` in the service, above the write.
//! A rule enforced above the write is a rule the next writer forgets — which is
//! the entire history of this field (`accountService.ts:107-120`: *"The account
//! forms trim before they save, but a form only covers the callers that remember
//! it"*). Locally there is one door into the file and this is it, so the rule is
//! applied HERE, from [`crate::admission::account_identifiers::keep_last_four`],
//! which is already the port of `keepLastFour` and already proved by nineteen
//! admission specs.
//!
//! Same outcome on both engines, therefore, and one fewer place to forget: a
//! credit account's number is its last four digits, whatever a form, an importer
//! or a restored backup supplies, because *"anything stored reaches that
//! person's backups and their JSON export"* (the seam's own words, `contract.ts`
//! rule B-7).
//!
//! # C-3 is not in this file, and that is the point
//!
//! Every account gets a `To/From <name>` category on INSERT. In the cloud that
//! is a trigger (`create_transfer_category_for_account`, `20260708140000:34-82`)
//! and locally it is a trigger too (`schema.sql`'s
//! `trg_create_transfer_category_for_account`). This verb writes one row and the
//! FILE mints the second, which is parity with the cloud by construction rather
//! than by a second implementation that has to be kept in step.
//!
//! It also means the trigger's two stand-down conditions apply to this verb
//! unchanged, and both matter:
//!
//! * **no Transfer type anchor, no category.** A brand-new file has no
//!   categories until `seed_categories` (slice 21) runs, and an account created
//!   before then gets no To/From row. That is the cloud's behaviour verbatim
//!   ("categories seed lazily; a parentless category renders as junk") and it is
//!   what makes a restore's account-first order safe (R-6).
//! * **one already there, no second.** The `NOT EXISTS` guard is what stops a
//!   restore that inserts accounts and then the backup's own To/From rows from
//!   ending with two. `verify_integrity` reports either failure by name —
//!   `account_missing_transfer_category` and
//!   `account_multiple_transfer_categories`.
//!
//! # No guard, measured
//!
//! An INSERT into `accounts`. `trg_create_transfer_category_for_account` fires
//! and inserts a category; `trg_accounts_updated_at` is `BEFORE UPDATE` and does
//! not. Nothing in the `_rpc_guard` family watches an account INSERT — every
//! `trg_protect_split_*` is `BEFORE UPDATE OF` a column on `transactions`, and
//! C-5 is `BEFORE DELETE` on `categories`. `tests/account_family.rs` asserts the
//! guard table empty across a successful create rather than reasoning about it,
//! which is the rule `verbs/mod.rs` sets for every verb.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::admission::account_identifiers::keep_last_four;
use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, ListedAccount};
use crate::wire::{null_if_empty, Field, Flag};

/// The account type whose number is a CARD number. The one value
/// `isCardAccountType` tests for (`accountNumberInput.ts:46`).
pub(super) const CARD_ACCOUNT_TYPE: &str = "credit";

/// `type` when the caller states none — `mappedType || 'checking'`.
const DEFAULT_TYPE: &str = "checking";

/// `currency` when the caller states none — `account.currency || 'GBP'`.
const DEFAULT_CURRENCY: &str = "GBP";

/// The command.
///
/// One field per column the cloud's writer sends, plus the two it forgets and
/// the seam requires (see [`CreateAccount::low_balance_alert_enabled`]).
/// `deny_unknown_fields` is the same local strengthening every verb here
/// carries: a key nobody reads is a key silently discarded, and `balance` is
/// the one somebody will try — it is refused by name as an unknown field, with
/// the accepted list printed beside it.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAccount {
    /// Client-minted, or minted here when absent — B-5, the same shape
    /// `create_transaction` uses. The cloud's column defaults to
    /// `uuid_generate_v4()`; a caller that supplies one is naming a row it is
    /// about to reference.
    #[serde(default)]
    pub id: Option<String>,
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// `NOT NULL` in both engines. Also what the To/From category is named
    /// after, by the trigger, in the same statement.
    pub name: String,
    /// `checking` | `savings` | … — enumerated by CHECK in both engines. The
    /// app's word for a current account is 'current' and the column's is
    /// 'checking'; the rename is the CLIENT's, in both editions
    /// (`accountService.ts:225`, `mappers/columns.ts`'s `accountType` kind), so
    /// this stores what it is given and the CHECK judges it.
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    /// ISO 4217. `|| 'GBP'`, which is also the column default.
    #[serde(default)]
    pub currency: Option<String>,
    /// What the account held before any transaction in this file — and, on a
    /// file with none, what it holds. See the module docs: there is no second
    /// money argument.
    #[serde(default)]
    pub initial_balance: Option<Money>,
    /// `account.isActive !== undefined ? account.isActive : true`.
    #[serde(default)]
    pub is_active: Option<Flag>,
    /// `|| null` — an empty string is not a value.
    #[serde(default)]
    pub institution: Option<String>,
    /// `|| null`. A card has no sort code; nothing here enforces that, because
    /// the cloud does not either and an account may be re-typed later.
    #[serde(default)]
    pub sort_code: Option<String>,
    /// `accountNumberForStorage(…, isCardAccountType(type)) ?? null` — see the
    /// module docs for why the rule is applied in the ledger rather than above
    /// it.
    #[serde(default)]
    pub account_number: Option<String>,
    /// `YYYY-MM-DD`, or the ISO instant `toISOString()` produces for one. See
    /// [`calendar_day`].
    #[serde(default)]
    pub opening_balance_date: Option<String>,
    /// `|| null`.
    #[serde(default)]
    pub notes: Option<String>,
    /// NOT sent by the cloud's writer, and sent here.
    ///
    /// The column exists in both engines (`20260709140000`); it is the CLIENT
    /// that leaves it out of a create, so an account created in the cloud with
    /// an alert configured arrives with the alert off and needs a second write
    /// to fix. The seam's contract says a create gives back every field it was
    /// given, and the incident behind that rule is precisely this field
    /// (`accountMapping.ts:13-16`: *"Account Settings turned the alert OFF when
    /// the user saved something else"*). A device file is the only store there
    /// is, so dropping it here would lose it outright.
    #[serde(default)]
    pub low_balance_alert_enabled: Option<Flag>,
    /// The figure the alert fires below. Not sent by the cloud's writer either,
    /// and sent here for the same reason.
    #[serde(default)]
    pub low_balance_threshold: Option<Money>,
}

/// What the verb hands back: the whole stored row, and the audit entry that had
/// to commit with it.
#[derive(Debug, Serialize)]
pub struct CreateAccountResult {
    /// The account as stored — [`ListedAccount`], the same projection
    /// `list_accounts` answers with, so a caller can put it straight into state
    /// without re-reading. That is B-7.
    pub answer: ListedAccount,
    /// Dense sequence number of the audit row written for this create.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Insert one account, mint its To/From category (through the file's own
/// trigger) and audit it — all in one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for a named refusal or a rule the file enforced —
/// `accounts_type_check`, `accounts_currency_shaped`, `accounts_dates_shaped`,
/// `accounts_balance_bounded`, or the users foreign key;
/// [`CoreError::Storage`] for a fault.
// Consumed rather than borrowed, for the reason every write verb here gives:
// it writes an audit row, and `&command` is an invitation to do it twice.
#[allow(clippy::needless_pass_by_value)]
pub fn create_account(
    connection: &mut Connection,
    command: CreateAccount,
) -> CoreResult<CreateAccountResult> {
    // Everything that can refuse without touching the file, before the file is
    // touched — the ordering Postgres gets free from its casts.
    let opening_balance_date = match command.opening_balance_date.as_deref() {
        None => None,
        Some(value) => calendar_day(value, "opening_balance_date")?,
    };
    let is_active = resolve_flag(command.is_active.as_ref(), true, "is_active")?;
    let low_balance_alert_enabled = resolve_flag(
        command.low_balance_alert_enabled.as_ref(),
        false,
        "low_balance_alert_enabled",
    )?;

    let id = null_if_empty(command.id.as_deref())
        .map_or_else(|| uuid::Uuid::new_v4().to_string(), ToOwned::to_owned);
    let kind = null_if_empty(command.kind.as_deref()).unwrap_or(DEFAULT_TYPE);
    let currency = null_if_empty(command.currency.as_deref()).unwrap_or(DEFAULT_CURRENCY);
    let opening = command.initial_balance.unwrap_or(Money::from_minor(0));
    let account_number = account_number_for_storage(command.account_number.as_deref(), kind);

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    transaction.execute(
        // `balance_minor` and `initial_balance_minor` are bound to the SAME
        // parameter. Not a shortcut — it is B-1 written as a statement: an
        // account with no transactions has a balance equal to its opening
        // balance, and there is no way to express anything else here.
        "INSERT INTO accounts (
           id, user_id, name, type, currency,
           balance_minor, initial_balance_minor,
           is_active, institution, sort_code, account_number,
           opening_balance_date, notes,
           low_balance_alert_enabled, low_balance_threshold_minor,
           created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5,
           ?6, ?6,
           ?7, ?8, ?9, ?10,
           ?11, ?12,
           ?13, ?14,
           ?15, ?15
         )",
        params![
            id,
            command.user_id,
            command.name,
            kind,
            currency,
            opening.minor(),
            i64::from(is_active),
            null_if_empty(command.institution.as_deref()),
            null_if_empty(command.sort_code.as_deref()),
            account_number,
            opening_balance_date,
            null_if_empty(command.notes.as_deref()),
            i64::from(low_balance_alert_enabled),
            command.low_balance_threshold.map(Money::minor),
            now,
        ],
    )?;

    // Read the row back rather than reconstructing it: the audit's `after` must
    // be what storage holds, defaults, triggers and all — the same rule
    // `create_transaction` states about `to_jsonb(v_tx)`.
    let stored = account::read_listed(&transaction, &id, &command.user_id)?.ok_or_else(|| {
        CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between writing it and reading it back",
        )
    })?;

    let entry = audit::write(
        &transaction,
        &command.user_id,
        "account",
        &id,
        Action::Create,
        None,
        Some(&super::json_of(&stored)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(CreateAccountResult {
        answer: stored,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// `accountNumberForStorage(value, isCardAccountType(type))`, in the ledger.
///
/// A card's number is its last four digits and nothing else; a bank number is
/// trimmed and stored whole. Either way an empty result is NULL rather than an
/// empty string, because the column means "no number recorded" by being absent.
pub(super) fn account_number_for_storage(value: Option<&str>, kind: &str) -> Option<String> {
    let stored = if kind == CARD_ACCOUNT_TYPE {
        keep_last_four(value.unwrap_or_default())
    } else {
        value.unwrap_or_default().trim().to_owned()
    };
    if stored.is_empty() {
        None
    } else {
        Some(stored)
    }
}

/// A calendar day, from the two spellings the cloud's own writer can produce.
///
/// `accountService.createAccount` sends
/// `openingBalanceDate instanceof Date ? .toISOString() : … || null` into a
/// Postgres `date` column, so the value that actually arrives is either
/// `YYYY-MM-DD` or a full ISO instant that the cast truncates. `schema.sql`'s
/// column is TEXT with `LIKE '____-__-__'`, which would refuse the second — so
/// the truncation happens here, on the same separator, and the result is then
/// held to [`crate::wire::is_calendar_date`] rather than to the shape test
/// alone. That is the same local strengthening `create_transaction` applies to
/// `date`: Postgres refuses 31 February for its own reasons and a CHECK of
/// underscores does not.
///
/// An empty string is `NULLIF`'d to nothing, exactly as `|| null` does.
pub(super) fn calendar_day(value: &str, field: &str) -> CoreResult<Option<String>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let day = trimmed.split('T').next().unwrap_or(trimmed);
    if !crate::wire::is_calendar_date(day) {
        return Err(CoreError::Refused(
            Refusal::named(
                "date_invalid",
                &format!("{field} must be a real calendar date as YYYY-MM-DD: {value:?}"),
            )
            .with_hint("Postgres refuses this too, as an invalid input syntax for type date."),
        ));
    }
    Ok(Some(day.to_owned()))
}

/// `COALESCE((p->>'k')::boolean, <fallback>)`, with the field's name in the
/// refusal so a caller can tell which boolean it was.
pub(super) fn resolve_flag(flag: Option<&Flag>, fallback: bool, field: &str) -> CoreResult<bool> {
    Flag::resolve_or(flag, fallback).map_err(|message| boolean_invalid(field, &message))
}

/// The same cast, for a PATCH field rather than a create argument.
///
/// `None` covers both absence and a stated JSON null, and the caller keeps them
/// apart itself (`Field::is_present`) — the update's presence rule is about the
/// KEY, and a null is a null whatever type the column is.
pub(super) fn resolve_flag_field(field: &Field<Flag>, name: &str) -> CoreResult<Option<bool>> {
    match field.value() {
        None => Ok(None),
        Some(flag) => flag
            .resolve()
            .map(Some)
            .map_err(|message| boolean_invalid(name, &message)),
    }
}

fn boolean_invalid(field: &str, message: &str) -> CoreError {
    CoreError::Refused(
        Refusal::named("boolean_invalid", &format!("{field}: {message}"))
            .with_hint("Postgres refuses this too, as an invalid input syntax for type boolean."),
    )
}
