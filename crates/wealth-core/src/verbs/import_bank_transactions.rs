//! `import_bank_transactions` — the port of `import_bank_transactions_atomic`,
//! the bank feed's whole write path.
//!
//! # Why it is here at all, given there is no local feed
//!
//! DESIGN.md §9.1 puts cloud↔local sync out of scope, so a local file will
//! probably never hold a live TrueLayer connection. The verb is still ported,
//! for two reasons that are about the file rather than about the feed:
//!
//! * **A restored cloud backup carries feed-created accounts and feed-written
//!   rows.** `connection_id`, `external_transaction_id` and `external_provider`
//!   are columns in `schema.sql` precisely so a restore is lossless, and the
//!   rules that produced those values have to exist somewhere the local edition
//!   can state them.
//! * **B-4's first-import rebase lives here and nowhere else.** It is the only
//!   place in the schema where an import moves `initial_balance` instead of
//!   `balance`, and understanding it is a precondition for reasoning about any
//!   restored feed account.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260829170000_a_backfill_is_the_syncs_decision_not_each_chunks.sql`.
//! Traced by grep across every migration — the resolution
//! `src/test/feedImportLatestDefinition.test.ts` performs mechanically:
//!
//! | migration | change |
//! | --- | --- |
//! | `20260613090000` | the original: dedupe, the backfill rebase, per-account balances, audit |
//! | `20260708100000` | payee memory, inline |
//! | `20260722140000:53` | payee memory moved into `payee_memory_category`, and the rule changed from most-RECENT to most-COMMON |
//! | `20260807180000` | `is_cleared` false — the feed does not pre-clear |
//! | `20260808100000:552` | provenance: a payee-memory guess is `category_confirmed = false` |
//! | `20260810090000:604` | `needs_review` true — *"nobody has seen this row; it did not exist until now"* |
//! | `20260828180000` | `category` and `tags` from a rule-stamped row — but patched from the WRONG base, reverting the three rows above |
//! | `20260829120000` | the repair: the current body restated from the right base, plus `tags` |
//! | `20260829170000` | the caller's `backfill` stamp outranks the per-call table look; contradictions refuse |
//!
//! `20260725120000:253` only re-grants it, and `20260808150000:67-71` says in as
//! many words that it does not touch either import RPC.
//!
//! The last row is the same slice-19 port lag the file importer carried, closed
//! here in the same commit for the same reason: the two importers are one rule
//! about arriving rows, and a version of it that held in one of them would be a
//! feed whose rows come in silently while a file's come in bold.
//!
//! # B-4, the first-import rebase — and the precondition it needs (TS-F7)
//!
//! The rule, decided per account and **before that account's first insert of the
//! call**:
//!
//! ```text
//! no transaction in this account carries an external_transaction_id
//!     -> BACKFILL:    initial_balance := initial_balance − Σ(amounts)
//!     -> otherwise:   INCREMENTAL:  balance := balance + Σ(amounts)
//! ```
//!
//! It is arithmetically a rebase, not an override: B-1 says
//! `balance = initial_balance + Σ(amount)`, so subtracting the batch's sum from
//! `initial_balance` while the batch adds the same sum to `Σ` leaves the identity
//! exactly where it was. MEASURED on the reference cluster
//! (`scratchpad/local-core/probe-ingest2.sh`), on an account seeded
//! `balance = initial_balance = 100.00` with no history, importing `−12.00`:
//!
//! ```text
//! first import   balance 100.00 -> 100.00   initial 100.00 -> 112.00   B-1 holds
//! second import  balance 100.00 ->  88.00   initial unchanged          B-1 holds
//! ```
//!
//! Three things about that decision, each measured because each is a place a
//! port goes wrong:
//!
//! * **It is decided once per account and cached for the call.** Two rows for one
//!   account in one request both rebase; the second does not see the first and
//!   flip to incremental. (`f-rebase-decided-once-per-account`.)
//! * **Only feed provenance counts as history.** A file-imported row carrying
//!   `import_source`/`import_source_id` does NOT make the account "already fed",
//!   so the next feed sync still rebases. That is the deliberate separation
//!   `20260808140000:127-135` describes from the other side: writing OFX ids into
//!   `external_transaction_id` *"would make an imported statement masquerade as a
//!   bank-fed account and suppress the first real sync's initial_balance
//!   rebase"*. (`f-file-import-does-not-count-as-history`.)
//! * **The existence test is not scoped by user.** It asks about the ACCOUNT.
//!   Under the composite ownership key an account's rows all share its owner, so
//!   the two readings coincide; it is written the cloud's way anyway.
//!
//! Since `20260829170000` a row may also carry the CALLER's verdict as a
//! `backfill` boolean, which outranks the table. The reason is the cloud's
//! chunking: its handler splits a sync into 200-row calls, and the per-call
//! table answer is right for chunk 1 and wrong for every chunk after — their
//! rows are equally embodied in the provider's snapshot, but by then the
//! account has feed history and the self-decide arm reads INCREMENTAL,
//! drifting the balance by those chunks' sum. The handler now asks the
//! table's question once for the whole sync and stamps every row; a stamp
//! that contradicts the arm already chosen for the account in one call is
//! refused whole (`backfill_stamp_conflict`, both engines — pinned by
//! `f-a-caller-stamp-outranks-the-accounts-own-history` and its siblings).
//! Unstamped rows behave exactly as this section describes.
//!
//! ## The precondition, which is TS-F7 and is NOT satisfied by the feed
//!
//! The rebase is only *correct* if `initial_balance` was the account's opening
//! balance before the imported window. `api/banking/sync-accounts.ts:255-273`
//! seeds a feed-created account with `balance = bank_balance = initial_balance =
//! the snapshot`, i.e. with `initial_balance` set to TODAY's figure rather than
//! to any opening balance. The first import then subtracts only the window the
//! provider returned — 90 days for most connections — so what lands in
//! `initial_balance` is "the balance 90 days ago", and every transaction older
//! than the window is missing from both sides of the identity.
//!
//! **B-1 still holds** — the arithmetic is self-consistent, which is what makes
//! this hard to see — but `initial_balance` is a plug rather than a fact, and the
//! account is out by its own unimported history. That is TS-F7, recorded here
//! because this verb is where the plug is written and because a local edition
//! that ever gains a feed will inherit it. This port does not fix it: fixing it
//! is a change to the cloud's account-seeding, not to this function, and a local
//! edition that quietly disagreed would stop being a port.
//!
//! # Payee memory, and the tie-break the cloud does not have
//!
//! `payee_memory_category` (`20260722140000:22-43`) is:
//!
//! ```sql
//! GROUP BY category
//! ORDER BY COUNT(*) DESC, MAX(date) DESC, MAX(created_at) DESC
//! LIMIT 1
//! ```
//!
//! — the category this payee is most often filed under in **this account**, for
//! **this direction**, with transfers and the two transfer sentinels excluded and
//! the `Bank transaction` fallback description excluded as a sentinel rather than
//! a payee. All of that is measured (`probe-ingest2.sh` §4) and all of it is
//! ported literally.
//!
//! **Below `MAX(created_at)` there is no rule, and it is not safe to invent one
//! quietly.** MEASURED (`probe-ingest4.sh`), on a genuine three-way tie — same
//! count, same date, same `created_at`, which is what two rows written by one
//! import look like:
//!
//! ```text
//! {Aaa, Zzz}          inserted Aaa first -> Zzz     inserted Zzz first -> Zzz
//! {Groceries, Fuel}   inserted Gro first -> Fuel    inserted Fuel first -> Groceries
//! ```
//!
//! Repeatable, and not a rule: not id order, not insert order, not either
//! consistently. It is the plan's grouping order surfacing, which is exactly the
//! kind of answer a port must not copy because there is nothing to copy. So this
//! verb adds **`, category ASC`** as a fourth and final key. That is a **local
//! strengthening where the cloud has no rule**, not a divergence from one, and it
//! is the reason no differential spec constructs a total tie — a spec that did
//! would be asserting an artefact. The ties the cloud DOES specify (count, then
//! date, then `created_at`) are each pinned by a spec.
//!
//! The normalisation is `upper(btrim(description))` in the cloud and the
//! generated column `description_norm` (`upper(trim(description))`) here, which
//! is the same expression and is what makes `idx_txn_payee` answer the question.
//! SQLite's `upper()` is ASCII-only; so is the reference cluster's, because it is
//! SQL_ASCII. MEASURED both ways in this round (`CAF\xc3\xa9 FIXTURE` on the
//! cluster, `CAFé FIXTURE` in SQLite), and the divergence against a UTF8
//! Supabase remains unobservable locally — the existing tripwire
//! `specs/x1-upper-matches-only-because-the-reference-pg-is-sql-ascii` is what
//! fails the day the cluster's encoding changes, and nothing here weakens it.
//!
//! **Payee memory reads archived rows.** MEASURED
//! (`probe-ingest3.sh` `memory-reads-an-archived-row`): an archived row still
//! teaches. Reproduced without comment, because the helper's WHERE clause has no
//! `archived` term and adding one would be a change of behaviour wearing a port's
//! clothes.
//!
//! # Provenance: three cases, one table
//!
//! `20260808100000:624-643`, and each row of this table is a measured case:
//!
//! | the row | `category` | `category_confirmed` |
//! | --- | --- | --- |
//! | states a category | that one | **true** — the provider or the caller said it |
//! | states none, payee memory finds one | the guess | **false** — the app guessed |
//! | states none, payee memory finds none | NULL | **true** — a blank has nothing to vouch for |
//!
//! The third row is the one that looks wrong and is not: an unconfirmed blank
//! would put rows with no category into the "check these suggestions" list, where
//! there is nothing to look at.
//!
//! # The ownership check, and the hole in it
//!
//! There is no ownership check before the inserts. `p_user_id` is written as
//! every row's `user_id`, and the account is verified only in the SECOND loop,
//! which visits accounts that actually received rows. MEASURED, and worth
//! stating because it is a real hole rather than a curiosity:
//!
//! ```text
//! a stranger's account, rows land       -> refused, transactions_account_id_user_fkey
//! a stranger's account, all rows skipped -> ACCEPTED, {inserted 0, skipped 1}
//! ```
//!
//! So a caller can probe whether a given `(account, external id)` pair already
//! exists in somebody else's account and be told "skipped" rather than "no". In
//! the cloud that is bounded by the function being service-role only with exactly
//! one caller (`api/banking/sync-transactions.ts`). It is ported as measured; the
//! composite key `transactions_account_id_user_fkey` is what stops anything being
//! written, on both engines, and it is the same key in `schema.sql`.
//!
//! # The dedupe, and its three scopes
//!
//! Two mechanisms, and they are not the same one twice:
//!
//! * the `EXISTS` test, scoped to the **account** and the external id, ignoring
//!   `connection_id` and the owner. It also catches repeats **within one
//!   request**, because rows inserted earlier in the call are visible to it —
//!   MEASURED (`f-two-identical-ids-in-one-request` → `{inserted 1, skipped 1}`);
//! * `ON CONFLICT (connection_id, external_transaction_id) WHERE
//!   external_transaction_id IS NOT NULL DO NOTHING`, which the migration
//!   describes as race handling. MEASURED: with `connection_id` NULL it can never
//!   fire, because NULLs are distinct in a unique index on both engines — so the
//!   `EXISTS` test is doing all the work on any row without a connection.
//!
//! A row with **no** external id is deduped by neither and always inserts.
//! MEASURED: two such rows in one request produce two rows.
//!
//! # The guard: none, and measured
//!
//! Same measurement as [`super::import_transactions`], and for the same reason:
//! nothing on `transactions` fires on INSERT, and the `accounts` UPDATE is
//! watched only by `trg_sync_transfer_category_for_account` (`AFTER UPDATE OF
//! name, is_active`) and `trg_accounts_updated_at`, which stands down because
//! this verb writes `updated_at` itself. Asserted behaviourally, with the guard
//! table read empty after the call.

use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, AccountRow};
use crate::wire::{is_calendar_date, null_if_empty};

/// The description the sync handler uses when a provider sends none. A
/// sentinel, not a payee: matching on it would fuse unrelated merchants into one
/// mega-payee (`20260722140000:116-119`).
const SENTINEL_DESCRIPTION: &str = "BANK TRANSACTION";

/// The command. `(p_user_id, p_rows)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportBankTransactions {
    /// `p_user_id`. Service-role only in the cloud; every row must agree with it.
    pub user_id: String,
    /// `p_rows`. Raw JSON so the RPC's first refusal — *"p_rows must be a jsonb
    /// array"* — stays reachable from a payload, and so the per-row parse stays
    /// inside the loop where the cloud does it.
    #[serde(default)]
    pub rows: Option<serde_json::Value>,
}

/// One feed row, as the RPC reads it.
///
/// `deny_unknown_fields` is the crate's declared local strengthening, carried
/// here for the reason it is carried on every other verb.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BankRow {
    /// `(r->>'user_id')::uuid`. Checked against `p_user_id` before anything else
    /// this row could do. Absent counts as a mismatch — MEASURED: a row with no
    /// `user_id` is refused with the same sentence as a row naming a stranger.
    #[serde(default)]
    pub user_id: Option<String>,
    /// `(r->>'account_id')::uuid`.
    #[serde(default)]
    pub account_id: Option<String>,
    /// `NULLIF(r->>'connection_id','')::uuid`.
    #[serde(default)]
    pub connection_id: Option<String>,
    /// `r->>'external_transaction_id'`. The provider's own id, and the whole of
    /// the dedupe.
    #[serde(default)]
    pub external_transaction_id: Option<String>,
    /// `r->>'external_provider'`. Enumerated by CHECK in both engines.
    #[serde(default)]
    pub external_provider: Option<String>,
    /// `r->>'description'`. `NOT NULL` in both engines.
    pub description: String,
    /// `(r->>'amount')::numeric`.
    pub amount: Money,
    /// `r->>'type'`.
    #[serde(rename = "type")]
    pub kind: String,
    /// `(r->>'date')::date`.
    pub date: String,
    /// `COALESCE(r->'metadata', 'null'::jsonb)` — note that the fallback is JSON
    /// **null**, not `{}`, which is what the file-import path leaves behind.
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    /// `NULLIF(btrim(COALESCE(r->>'category','')),'')`. A category the row
    /// arrives with is not this function's guess.
    #[serde(default)]
    pub category: Option<String>,
    /// `r->'backfill'` (20260829170000): the CALLER's backfill verdict,
    /// decided once for the sync it split into chunks. Present, it outranks
    /// the table — the caller saw the whole sync, this call sees one chunk of
    /// it. Contradicting the arm already chosen for the account in this call
    /// refuses the whole call (`backfill_stamp_conflict`); the cloud also
    /// refuses a non-boolean stamp by name (`backfill_stamp_not_boolean`),
    /// where this ledger's refusal is serde's type error — the crate-wide
    /// malformed-type divergence every field carries.
    #[serde(default)]
    pub backfill: Option<bool>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct ImportBankTransactionsResult {
    /// The projection both engines are compared on — the RPC's own jsonb.
    pub answer: FeedAnswer,
    /// Dense sequence number of the audit row that closes the batch — the last
    /// `account/update`, or `None` when nothing landed. Local-only.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit_row_hash: Option<String>,
}

/// `{inserted, skipped}` — and no `idempotent`, because this path's idempotency
/// is a property of the provider's ids rather than of the request.
#[derive(Debug, Serialize)]
pub struct FeedAnswer {
    /// Rows that landed.
    pub inserted: i64,
    /// Rows this account already held under the same provider id, plus rows a
    /// concurrent writer got to first.
    pub skipped: i64,
}

/// What one account accumulated during the loop.
struct AccountEffect {
    /// Decided BEFORE this account's first insert, and not revisited — from
    /// the row's `backfill` stamp when the caller sent one, from the table
    /// when it did not. A later stamp may only agree.
    backfill: bool,
    /// Σ of the amounts that actually landed.
    sum: i64,
    /// Did anything land at all?
    ///
    /// The cloud's accumulator only ever gains a key when a row is INSERTED
    /// (`v_sums` is written after `RETURNING`), so an account whose rows were all
    /// skipped never reaches the balance loop. Locally the map is keyed earlier —
    /// the backfill answer has to be cached before the first insert — so the
    /// "did anything land" question is recorded rather than inferred from the
    /// key's presence. A batch whose amounts happen to sum to zero DID land rows
    /// and must still be visited: it writes an audit row and an `updated_at`
    /// bump, exactly as the cloud does for a `+0` movement.
    landed_any: bool,
}

/// Import a feed's rows across however many accounts they name, in one
/// transaction.
///
/// # Errors
/// [`CoreError::Refused`] for the row-owner mismatch, the account refusal, or a
/// rule the file enforced — including `transactions_account_id_user_fkey`, which
/// is what actually stops a row landing in a stranger's account;
/// [`CoreError::InvalidCommand`] for a row this ledger cannot read;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn import_bank_transactions(
    connection: &mut Connection,
    command: ImportBankTransactions,
) -> CoreResult<ImportBankTransactionsResult> {
    let Some(serde_json::Value::Array(elements)) = command.rows.as_ref() else {
        return Err(CoreError::refuse(
            "rows_not_an_array",
            "p_rows must be a jsonb array",
        ));
    };

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    let mut inserted = 0_i64;
    let mut skipped = 0_i64;
    // BTreeMap, not HashMap, and the choice is behavioural: the cloud walks its
    // accumulator with `jsonb_each_text`, which visits jsonb object keys in
    // jsonb's own order — length, then bytes. Every key here is a 36-character
    // uuid, so that order IS ascending byte order, which is what a BTreeMap
    // gives. MEASURED (`probe-ingest4.sh`): the two `account/update` audit rows
    // come out in ascending account-id order whichever order the rows arrived
    // in. Iterating a HashMap here would make the audit log's order depend on a
    // hash seed.
    let mut effects: BTreeMap<String, AccountEffect> = BTreeMap::new();

    for element in elements {
        let row: BankRow =
            serde_json::from_value(element.clone()).map_err(|error| super::row_error(&error))?;

        // Refusal 1, per row and before that row does anything at all.
        if row.user_id.as_deref() != Some(command.user_id.as_str()) {
            return Err(CoreError::refuse(
                "row user_id does not match p_user_id",
                "row user_id does not match p_user_id",
            ));
        }
        let account_id = row.account_id.clone().unwrap_or_default();

        // Backfill detection MUST precede the account's first insert of this
        // call — the whole story is on `decide_backfill`.
        decide_backfill(&write, &mut effects, &account_id, row.backfill)?;

        // Account-scoped dedupe. The handler pre-filters per connection; this
        // also catches re-imports after a reconnect under a new connection_id,
        // and repeats within this very request.
        if let Some(external) = row.external_transaction_id.as_deref() {
            if already_here(&write, &account_id, external)? {
                skipped = skipped.saturating_add(1);
                continue;
            }
        }

        let (category, category_confirmed) = categorise(&write, &account_id, &row)?;

        let id = uuid::Uuid::new_v4().to_string();
        let landed = insert_row(
            &write,
            &id,
            &command.user_id,
            &row,
            category.as_deref(),
            category_confirmed,
            &now,
        )?;
        if landed == 0 {
            // Lost a concurrent race; the row already exists.
            skipped = skipped.saturating_add(1);
            continue;
        }

        let stored = crate::row::read_transaction(&write, &id)?;
        audit::write(
            &write,
            &command.user_id,
            "transaction",
            &id,
            Action::Create,
            None,
            Some(&super::json_of(&stored)?),
            &now,
        )?;

        // `effects` was populated for this account a few lines above, so the
        // entry is there. Written as a lookup rather than an unwrap because this
        // crate has no panic path on data.
        if let Some(effect) = effects.get_mut(&account_id) {
            effect.sum = effect.sum.checked_add(row.amount.minor()).ok_or_else(|| {
                CoreError::refuse(
                    "amount_out_of_range",
                    "that batch sums to more than this ledger can count",
                )
            })?;
            effect.landed_any = true;
        }
        inserted = inserted.saturating_add(1);
    }

    // The per-account balance effect, audited, inside the same transaction. Only
    // accounts that actually received rows are visited — which is also where the
    // ownership check lives, and why an account whose rows were all skipped is
    // never checked at all.
    let mut last: Option<audit::AuditEntry> = None;
    for (account_id, effect) in &effects {
        if !effect.landed_any {
            continue;
        }
        last = Some(apply_effect(
            &write,
            &command.user_id,
            account_id,
            effect,
            &now,
        )?);
    }

    write.commit()?;

    Ok(ImportBankTransactionsResult {
        answer: FeedAnswer { inserted, skipped },
        audit_seq: last.as_ref().map(|entry| entry.seq),
        audit_row_hash: last.map(|entry| entry.row_hash),
    })
}

/// The arm this account's batch takes — decided BEFORE its first insert of
/// the call, defended against contradiction on every row after.
///
/// "No previously imported bank transaction exists for this account" is the
/// table's answer, and it is only asked when the row carries no verdict of
/// its own. A row may stamp the CALLER's verdict as `backfill`
/// (20260829170000) — the caller saw the WHOLE sync, this call sees one
/// chunk of it, and the cloud's handler splits at 200 rows, which is how a
/// first sync used to rebase its first chunk and then drift the balance by
/// every later one. A stamp outranks the table; a stamp that contradicts the
/// arm already chosen for this account in this call is the split-batch bug
/// itself, refused whole rather than landed quietly.
fn decide_backfill(
    write: &rusqlite::Transaction<'_>,
    effects: &mut BTreeMap<String, AccountEffect>,
    account_id: &str,
    stamp: Option<bool>,
) -> CoreResult<()> {
    if let Some(effect) = effects.get(account_id) {
        if let Some(stamp) = stamp {
            if stamp != effect.backfill {
                return Err(CoreError::refuse(
                    "backfill_stamp_conflict",
                    "backfill_stamp_conflict",
                ));
            }
        }
        return Ok(());
    }
    let backfill = match stamp {
        Some(stamp) => stamp,
        None => !has_feed_history(write, account_id)?,
    };
    effects.insert(
        account_id.to_owned(),
        AccountEffect {
            backfill,
            sum: 0,
            landed_any: false,
        },
    );
    Ok(())
}

/// Does this account already hold a row the feed wrote?
///
/// Deliberately not scoped by user, because the cloud's is not. Under
/// `transactions_account_id_user_fkey` every row in an account shares its
/// owner, so the two readings cannot differ.
fn has_feed_history(write: &rusqlite::Transaction<'_>, account_id: &str) -> CoreResult<bool> {
    let found: Option<i64> = write
        .query_row(
            "SELECT 1 FROM transactions
              WHERE account_id = ?1 AND external_transaction_id IS NOT NULL
              LIMIT 1",
            params![account_id],
            |row| row.get(0),
        )
        .optional()?;
    Ok(found.is_some())
}

/// The `EXISTS` dedupe: this account, this provider id, any connection.
fn already_here(
    write: &rusqlite::Transaction<'_>,
    account_id: &str,
    external: &str,
) -> CoreResult<bool> {
    let found: Option<i64> = write
        .query_row(
            "SELECT 1 FROM transactions
              WHERE account_id = ?1 AND external_transaction_id = ?2
              LIMIT 1",
            params![account_id, external],
            |row| row.get(0),
        )
        .optional()?;
    Ok(found.is_some())
}

/// The category this row will carry, and whether anybody has vouched for it.
fn categorise(
    write: &rusqlite::Transaction<'_>,
    account_id: &str,
    row: &BankRow,
) -> CoreResult<(Option<String>, bool)> {
    // `NULLIF(btrim(COALESCE(r->>'category','')),'')`.
    let stated = row
        .category
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    if stated.is_some() {
        return Ok((stated, true));
    }

    if row.description.trim().to_uppercase() == SENTINEL_DESCRIPTION {
        return Ok((None, true));
    }

    let guess = payee_memory_category(write, account_id, &row.description, &row.kind)?;
    // Only if the guess actually produced something. Payee memory returning
    // nothing leaves the row blank, and a blank is not a suggestion.
    let confirmed = guess.is_none();
    Ok((guess, confirmed))
}

/// The port of `payee_memory_category(p_account_id, p_description, p_type)`.
///
/// Every clause is the cloud's, in the cloud's order, with one addition stated
/// in the module documentation: `category ASC` as a fourth ordering key, because
/// the cloud has no rule below `MAX(created_at)` and its answer there is an
/// artefact of the plan rather than a decision.
///
/// `description_norm` is the generated column `upper(trim(description))`, which
/// is `upper(btrim(t.description))` spelled once so the index can answer it —
/// MEASURED: `SEARCH transactions USING INDEX idx_txn_payee`.
///
/// `MAX` over `date` and `created_at` is `MAX` over TEXT, which for `YYYY-MM-DD`
/// and ISO-8601-Z is chronological order. Verified rather than assumed.
fn payee_memory_category(
    write: &rusqlite::Transaction<'_>,
    account_id: &str,
    description: &str,
    kind: &str,
) -> CoreResult<Option<String>> {
    let category: Option<String> = write
        .query_row(
            "SELECT t.category
               FROM transactions t
              WHERE t.account_id = ?1
                AND t.description_norm = upper(trim(?2))
                AND t.type = ?3
                AND t.type <> 'transfer'
                AND t.category IS NOT NULL AND trim(t.category) <> ''
                AND t.category NOT IN ('transfer-in', 'transfer-out')
              GROUP BY t.category
              ORDER BY COUNT(*) DESC, MAX(t.date) DESC, MAX(t.created_at) DESC, t.category ASC
              LIMIT 1",
            params![account_id, description, kind],
            |row| row.get(0),
        )
        .optional()?;
    Ok(category)
}

/// The INSERT, column for column, with the partial-index conflict clause the
/// cloud uses for the race.
#[allow(clippy::too_many_arguments)]
fn insert_row(
    write: &rusqlite::Transaction<'_>,
    id: &str,
    user_id: &str,
    row: &BankRow,
    category: Option<&str>,
    category_confirmed: bool,
    now: &str,
) -> CoreResult<usize> {
    if !is_calendar_date(&row.date) {
        return Err(CoreError::Refused(
            Refusal::named(
                "date_invalid",
                &format!(
                    "date must be a real calendar date as YYYY-MM-DD: {:?}",
                    row.date
                ),
            )
            .with_hint("Postgres refuses this too, as an invalid input syntax for type date."),
        ));
    }

    let metadata = row
        .metadata
        .as_ref()
        .map_or_else(|| "null".to_owned(), ToString::to_string);

    let changes = write.execute(
        "INSERT INTO transactions (
           id, user_id, account_id, connection_id, external_transaction_id,
           external_provider, description, amount_minor, type, date, metadata,
           is_cleared, category, category_confirmed, needs_review,
           created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5,
           ?6, ?7, ?8, ?9, ?10, ?11,
           0, ?12, ?13, 1,
           ?14, ?14
         )
         ON CONFLICT (connection_id, external_transaction_id)
           WHERE external_transaction_id IS NOT NULL
           DO NOTHING",
        params![
            id,
            user_id,
            row.account_id,
            null_if_empty(row.connection_id.as_deref()),
            row.external_transaction_id,
            row.external_provider,
            row.description,
            row.amount.minor(),
            row.kind,
            row.date,
            metadata,
            category,
            i64::from(category_confirmed),
            now,
        ],
    )?;
    Ok(changes)
}

/// One account's balance effect: the rebase, or the ordinary movement.
fn apply_effect(
    write: &rusqlite::Transaction<'_>,
    user_id: &str,
    account_id: &str,
    effect: &AccountEffect,
    now: &str,
) -> CoreResult<audit::AuditEntry> {
    // The cloud's `SELECT … FOR UPDATE` + `IF NOT FOUND`. This is the ONLY
    // ownership check in the function, and it runs after the inserts.
    let Some(before) = account::read_owned(write, account_id, user_id)? else {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    };

    // B-2 in both arms: relative, in SQL, never read-modify-write. The backfill
    // arm moves `initial_balance` and the incremental arm moves `balance`, and
    // the ledger identity survives both — see the module documentation.
    let moved = if effect.backfill {
        write.execute(
            "UPDATE accounts
                SET initial_balance_minor = initial_balance_minor - ?1,
                    updated_at            = ?2
              WHERE id = ?3 AND user_id = ?4",
            params![effect.sum, now, account_id, user_id],
        )?
    } else {
        write.execute(
            "UPDATE accounts
                SET balance_minor = balance_minor + ?1,
                    updated_at    = ?2
              WHERE id = ?3 AND user_id = ?4",
            params![effect.sum, now, account_id, user_id],
        )?
    };
    if moved != 1 {
        return Err(CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between locking it and moving its balance",
        ));
    }

    let after = account::read_owned(write, account_id, user_id)?.ok_or_else(|| {
        CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between moving its balance and reading it back",
        )
    })?;

    audit_account(write, user_id, account_id, &before, &after, now)
}

fn audit_account(
    write: &rusqlite::Transaction<'_>,
    user_id: &str,
    account_id: &str,
    before: &AccountRow,
    after: &AccountRow,
    now: &str,
) -> CoreResult<audit::AuditEntry> {
    audit::write(
        write,
        user_id,
        "account",
        account_id,
        Action::Update,
        Some(&super::json_of(before)?),
        Some(&super::json_of(after)?),
        now,
    )
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{BankRow, ImportBankTransactions, SENTINEL_DESCRIPTION};
    use serde_json::json;

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<ImportBankTransactions>(
            r#"{"user_id":"u","transactions":[]}"#,
        )
        .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("`transactions`"), "{error}");
    }

    #[test]
    fn a_row_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_value::<BankRow>(json!({
            "user_id": "u", "account_id": "a", "description": "Shop", "amount": "-1.00",
            "type": "expense", "date": "2024-05-01", "externa1_transaction_id": "typo",
        }))
        .expect_err("a twelfth key must refuse");
        assert!(error.to_string().contains("`externa1_transaction_id`"), "{error}");
    }

    #[test]
    fn a_row_will_not_take_money_as_a_json_number() {
        let error = serde_json::from_value::<BankRow>(json!({
            "user_id": "u", "account_id": "a", "description": "Shop", "amount": -1.0,
            "type": "expense", "date": "2024-05-01",
        }))
        .expect_err("a JSON number is a binary float");
        assert!(error.to_string().contains("amount_must_be_a_string"), "{error}");
    }

    #[test]
    fn the_sentinel_is_matched_case_and_space_insensitively() {
        for spelling in ["Bank transaction", "  bank TRANSACTION  ", "BANK TRANSACTION"] {
            assert_eq!(spelling.trim().to_uppercase(), SENTINEL_DESCRIPTION, "{spelling}");
        }
        assert_ne!("Bank transactions".trim().to_uppercase(), SENTINEL_DESCRIPTION);
    }

    #[test]
    fn a_backfill_stamp_reads_as_a_boolean_and_absent_as_none() {
        let stamped: BankRow = serde_json::from_value(json!({
            "user_id": "u", "account_id": "a", "description": "Shop", "amount": "-1.00",
            "type": "expense", "date": "2024-05-01", "backfill": false,
        }))
        .expect("a boolean stamp deserialises");
        assert_eq!(stamped.backfill, Some(false));

        let unstamped: BankRow = serde_json::from_value(json!({
            "user_id": "u", "account_id": "a", "description": "Shop", "amount": "-1.00",
            "type": "expense", "date": "2024-05-01",
        }))
        .expect("the stamp is optional");
        assert_eq!(unstamped.backfill, None);
    }

    #[test]
    fn a_backfill_stamp_that_is_not_a_boolean_is_refused_as_a_type_error() {
        // The cloud refuses this by name (backfill_stamp_not_boolean); here it
        // is serde's type error — the crate-wide malformed-type divergence.
        let error = serde_json::from_value::<BankRow>(json!({
            "user_id": "u", "account_id": "a", "description": "Shop", "amount": "-1.00",
            "type": "expense", "date": "2024-05-01", "backfill": "true",
        }))
        .expect_err("a string is not a verdict");
        // serde's sentence, not the cloud's name — from_value reports the type
        // without the field's path.
        assert!(error.to_string().contains("expected a boolean"), "{error}");
    }

    #[test]
    fn an_absent_owner_on_a_row_is_a_mismatch_not_a_default() {
        let row: BankRow = serde_json::from_value(json!({
            "account_id": "a", "description": "Shop", "amount": "-1.00",
            "type": "expense", "date": "2024-05-01",
        }))
        .expect("the key is optional to deserialise");
        assert_eq!(row.user_id, None);
    }
}
