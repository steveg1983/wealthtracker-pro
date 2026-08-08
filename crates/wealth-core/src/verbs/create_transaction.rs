//! `create_transaction` — the port of `create_transaction_atomic`.
//!
//! # What it is a port OF
//!
//! The **live** definition, which is
//! `supabase/migrations/20260808150000_create_honours_is_cleared.sql:168-226`,
//! not the 2026-06 original at `20260610140000_atomic_transaction_rpcs.sql:25`.
//! Seven migrations have redefined this function; the ones that changed its
//! behaviour are:
//!
//! | migration | change |
//! | --- | --- |
//! | `20260610140000:25` | the original: insert + `balance = balance + amount` |
//! | `20260610150000:69` | adds the `write_financial_audit` call (U-1) |
//! | `20260707120000:117` | adds `is_cleared` to the column list |
//! | `20260808090000:99` | adds `statement_sequence` — **and drops `is_cleared` again**, see below |
//! | `20260808100000:119` | adds `category_confirmed`, default true |
//! | `20260808150000:168` | puts `is_cleared` back |
//!
//! # The regression this port found, and what happened to it
//!
//! `20260808090000_transaction_statement_sequence.sql:96-98` says it is
//! *"Identical to the definition in 20260610150000_financial_audit_log.sql
//! except for the statement_sequence column"*. It was rebased onto the wrong
//! base: the definition live at that moment was `20260707120000`'s, which had
//! `is_cleared` in its column list. The rebase therefore **silently removed the
//! `is_cleared` passthrough**, and `20260808100000` inherited the loss.
//!
//! Measured on the reference cluster, 2026-08-08: the live RPC called with
//! `"is_cleared": true` returned a row with `is_cleared = f`. The column's
//! default is `FALSE` (`20260310000200_add_reconciliation_columns.sql:13`), so
//! there was no error — the flag was simply dropped.
//!
//! The first port of this verb reproduced the bug deliberately, on the argument
//! that two editions disagreeing about whether a row stays reconciled is worse
//! than a documented shared defect. That argument has expired:
//! `20260808150000_create_honours_is_cleared.sql` repairs the cloud, so the
//! honest port is the fixed behaviour. **This verb honours `is_cleared`,
//! defaulting to false**, and
//! `verb-specs/create-transaction-honours-is-cleared-on-both-engines.spec.mjs`
//! proves both engines do.
//!
//! Note what "both engines" means and does not mean here: the migration is
//! written and applied to the **reference cluster**, which is what the harness
//! measures. Production lags until the owner applies it. That is expected and
//! it is the right order — the differential proof is what makes applying it
//! safe.
//!
//! # The rule most likely to be quietly lost (B-2)
//!
//! > `UPDATE accounts SET balance_minor = balance_minor + ?` — **in SQL**.
//!
//! Never read-modify-write. DESIGN.md §1.10 item 1: a local port that reads the
//! balance into Rust, adds, and writes it back is arithmetically identical *and
//! wrong* — it re-introduces the read-modify-write the cloud spent a migration
//! eliminating, and it is the seam through which floats came back last time.
//! There is no absolute balance setter in this crate, and there must not be one.
//!
//! # The assert SQLite forces that Postgres gives away
//!
//! Postgres's `IF NOT FOUND` after an UPDATE is free. SQLite reports zero
//! changed rows and raises nothing at all. So the port must read `changes()` and
//! refuse with the RPC's own name, `account_not_found_or_not_owned`. Without it
//! a transaction lands against an account whose balance never moves — B-1
//! broken, silently, on the first row.
//!
//! Note which case actually reaches it: `transactions.account_id` has a foreign
//! key to `accounts` in **both** engines, so an account that does not exist at
//! all fails at the INSERT. The `changes()` path is reachable only when the
//! account exists and belongs to **somebody else**, which is what the spec uses.
//!
//! # What this verb does NOT do, having read the RPC's body
//!
//! * **No transfer-category resolution.** A `type = 'transfer'` row is inserted
//!   with whatever `category` and `transfer_account_id` the caller sent. T-6
//!   ("each side files under the *other* account's To/From category") lives in
//!   `create_transfer_counterpart` (`20260716100000:121-137`), not here.
//! * **No counterpart, no link.** `linked_transfer_id` is not written, so T-1,
//!   T-3 and T-7 are not this verb's business.
//! * **No categorisation.** Payee memory (I-6) belongs to the import path.
//! * **No provenance logic beyond a default.** `category_confirmed` COALESCEs to
//!   `true`; the RPC does not look at whether a category was supplied, whether
//!   it changed, or who sent it. `20260808100000:114-118` states the intent:
//!   *"Default TRUE, so hand entry, the add-transaction form and every caller
//!   that says nothing keep behaving exactly as they do today; only an importer
//!   that knows it guessed sends false."*

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::{self, TransactionRow};
use crate::wire::{is_calendar_date, null_if_empty, Flag, Ordinal};

/// The command.
///
/// `deny_unknown_fields` is a **deliberate local strengthening**. The cloud
/// takes a `jsonb` blob and reads the keys it knows, so a key nobody reads is
/// silently discarded — which is precisely how the `is_cleared` regression above
/// went a month without being noticed. Here an unrecognised key is a refusal.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateTransaction {
    /// `COALESCE(NULLIF(p->>'id',''), gen_random_uuid())`.
    #[serde(default)]
    pub id: Option<String>,
    /// Owner. Compared against the account's owner by the balance UPDATE.
    pub user_id: String,
    /// The account whose balance moves.
    pub account_id: String,
    /// `NOT NULL` in both engines.
    pub description: String,
    /// Signed. Expenses negative, income positive — the convention
    /// `20260310000500_fix_expense_amount_signs.sql` normalised the data to.
    pub amount: Money,
    /// `income` | `expense` | `transfer`. Enumerated by CHECK in both engines.
    #[serde(rename = "type")]
    pub kind: String,
    /// `YYYY-MM-DD`.
    pub date: String,
    /// A category id, or a legacy sentinel. Stored verbatim, `''` included —
    /// the RPC does **not** `NULLIF` this one.
    #[serde(default)]
    pub category: Option<String>,
    /// Stored verbatim, as above.
    #[serde(default)]
    pub notes: Option<String>,
    /// `text[]` in the cloud; a child table locally (`transaction_tags`).
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    /// `COALESCE((p->>'is_recurring')::boolean, false)`. A [`Flag`] rather than
    /// a `bool` because `->>` hands the cast text: the cloud accepts
    /// `"is_recurring": "t"` and this must too.
    #[serde(default)]
    pub is_recurring: Option<Flag>,
    /// `NULLIF(..., '')`.
    #[serde(default)]
    pub transfer_account_id: Option<String>,
    /// `COALESCE(p->'metadata', '{}')`.
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    /// `NULLIF(..., '')`.
    #[serde(default)]
    pub category_id: Option<String>,
    /// Feed-supplied merchant. Carried, never derived.
    #[serde(default)]
    pub merchant_name: Option<String>,
    /// Feed-supplied.
    #[serde(default)]
    pub location_city: Option<String>,
    /// Feed-supplied.
    #[serde(default)]
    pub location_country: Option<String>,
    /// Feed-supplied.
    #[serde(default)]
    pub payment_channel: Option<String>,
    /// The bank's own order within a day. An ordinal, never a time.
    #[serde(default)]
    pub statement_sequence: Option<Ordinal>,
    /// `COALESCE(..., true)`. False only from an importer that knows it guessed.
    #[serde(default)]
    pub category_confirmed: Option<Flag>,
    /// `COALESCE(..., false)`. Reconciled against a statement.
    ///
    /// Dropped by the cloud between `20260808090000` and `20260808150000`; see
    /// the module documentation, which is the whole story.
    #[serde(default)]
    pub is_cleared: Option<Flag>,
}

/// What the verb hands back: the stored row, and the audit entry that had to
/// commit with it.
#[derive(Debug, Serialize)]
pub struct CreateTransactionResult {
    /// The row as stored, money as decimal strings.
    pub transaction: TransactionRow,
    /// Dense sequence number of the audit row written for this create.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Insert one transaction, move its account's balance, and audit it — all in one
/// SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for a named refusal or a constraint the file enforced;
/// [`CoreError::Storage`] for a fault.
// A command is consumed by executing it. Taking it by reference would leave the
// caller holding something that looks replayable and is not — this verb writes
// an audit row and moves a balance, and `&command` is an invitation to do it
// twice.
#[allow(clippy::needless_pass_by_value)]
pub fn create_transaction(
    connection: &mut Connection,
    command: CreateTransaction,
) -> CoreResult<CreateTransactionResult> {
    if !is_calendar_date(&command.date) {
        return Err(CoreError::Refused(
            Refusal::named(
                "date_invalid",
                &format!(
                    "date must be a real calendar date as YYYY-MM-DD: {:?}",
                    command.date
                ),
            )
            .with_hint("Postgres refuses this too, as an invalid input syntax for type date."),
        ));
    }
    let statement_sequence = match command.statement_sequence.as_ref().map(Ordinal::resolve) {
        None => None,
        Some(Ok(value)) => value,
        Some(Err(message)) => return Err(CoreError::InvalidCommand(message)),
    };

    // Every boolean the RPC reads goes through a Postgres text cast, so every
    // one of them can refuse. Resolved BEFORE the transaction opens: a refusal
    // here has written nothing, which is what the cloud's cast-in-the-INSERT
    // also achieves, by aborting the statement.
    let flags = Flags {
        is_recurring: resolve_flag(command.is_recurring.as_ref(), false, "is_recurring")?,
        is_cleared: resolve_flag(command.is_cleared.as_ref(), false, "is_cleared")?,
        category_confirmed: resolve_flag(
            command.category_confirmed.as_ref(),
            true,
            "category_confirmed",
        )?,
    };

    let id = null_if_empty(command.id.as_deref())
        .map_or_else(|| uuid::Uuid::new_v4().to_string(), ToOwned::to_owned);
    let metadata = command
        .metadata
        .as_ref()
        .map_or_else(|| "{}".to_owned(), ToString::to_string);

    // BEGIN IMMEDIATE: one verb, one transaction, and the write lock taken up
    // front so the audit chain's MAX(seq) read cannot be overtaken.
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    insert_row(
        &transaction,
        &id,
        &command,
        statement_sequence,
        flags,
        &metadata,
        &now,
    )?;

    // ── B-2. The balance moves in SQL, relative, or not at all. ─────────────
    let moved = transaction.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor + ?1,
                updated_at = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![
            command.amount.minor(),
            now,
            command.account_id,
            command.user_id
        ],
    )?;

    // The cloud's `IF NOT FOUND` only asks for "at least one". `id` is the
    // primary key, so more than one is unreachable; asserting exactly one is
    // free and turns a future WHERE-clause mistake into a refusal instead of a
    // second account silently moving.
    if moved != 1 {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    }

    // Read the row back rather than reconstructing it: the audit's `after` must
    // be what storage holds, defaults, triggers and all. `to_jsonb(v_tx)` in the
    // cloud is the same idea — it serialises the RETURNING row, not the input.
    let stored = row::read_transaction(&transaction, &id)?;
    let after = serde_json::to_string(&stored)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;

    let entry = audit::write(
        &transaction,
        &command.user_id,
        "transaction",
        &id,
        Action::Create,
        None,
        Some(&after),
        &now,
    )?;

    transaction.commit()?;

    Ok(CreateTransactionResult {
        transaction: stored,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The three booleans the RPC casts out of text, already resolved.
#[derive(Debug, Clone, Copy)]
struct Flags {
    is_recurring: bool,
    is_cleared: bool,
    category_confirmed: bool,
}

/// `COALESCE((p->>'k')::boolean, <fallback>)`, with the field's name in the
/// refusal so a caller can tell which of three booleans it was.
fn resolve_flag(flag: Option<&Flag>, fallback: bool, field: &str) -> CoreResult<bool> {
    Flag::resolve_or(flag, fallback).map_err(|message| {
        CoreError::Refused(
            Refusal::named("boolean_invalid", &format!("{field}: {message}")).with_hint(
                "Postgres refuses this too, as an invalid input syntax for type boolean.",
            ),
        )
    })
}

/// The INSERT, column for column against the live RPC's column list.
///
/// `created_at` and `updated_at` are bound to the same instant rather than left
/// to the column defaults, so that the row, the account's `updated_at` and the
/// audit row all carry one timestamp. In Postgres they would anyway —
/// `now()` is transaction-start time — while SQLite's `strftime('now')` is
/// *statement* time, so a whole imported file would otherwise get a spread of
/// values (DESIGN.md §7.6).
// The parameter list mirrors the RPC's column list, which is the point.
#[allow(clippy::too_many_arguments)]
fn insert_row(
    transaction: &rusqlite::Transaction<'_>,
    id: &str,
    command: &CreateTransaction,
    statement_sequence: Option<i64>,
    flags: Flags,
    metadata: &str,
    now: &str,
) -> CoreResult<()> {
    transaction.execute(
        "INSERT INTO transactions (
           id, user_id, account_id, description, amount_minor, type, date,
           category, notes, is_recurring, is_cleared, transfer_account_id,
           metadata, category_id, merchant_name, location_city, location_country,
           payment_channel, statement_sequence, category_confirmed,
           created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, ?6, ?7,
           ?8, ?9, ?10, ?11, ?12,
           ?13, ?14, ?15, ?16, ?17,
           ?18, ?19, ?20,
           ?21, ?21
         )",
        params![
            id,
            command.user_id,
            command.account_id,
            command.description,
            command.amount.minor(),
            command.kind,
            command.date,
            command.category,
            command.notes,
            i64::from(flags.is_recurring),
            i64::from(flags.is_cleared),
            null_if_empty(command.transfer_account_id.as_deref()),
            metadata,
            null_if_empty(command.category_id.as_deref()),
            command.merchant_name,
            command.location_city,
            command.location_country,
            command.payment_channel,
            statement_sequence,
            i64::from(flags.category_confirmed),
            now,
        ],
    )?;

    // text[] became a child table (`transaction_tags`). Same transaction, so a
    // tag that will not store takes the whole row with it, exactly as a rejected
    // array element would in Postgres.
    if let Some(tags) = command.tags.as_ref() {
        let mut insert = transaction
            .prepare("INSERT INTO transaction_tags (transaction_id, tag) VALUES (?1, ?2)")?;
        for tag in tags {
            insert.execute(params![id, tag])?;
        }
    }
    Ok(())
}
