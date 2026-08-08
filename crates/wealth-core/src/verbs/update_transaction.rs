//! `update_transaction` — the port of `update_transaction_atomic`.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260808100000_category_provenance.sql:282-375`. Five
//! migrations have redefined this function:
//!
//! | migration | change |
//! | --- | --- |
//! | `20260610140000:81` | the original: the SET list + relative balance moves |
//! | `20260610150000:126` | adds the `write_financial_audit` call (U-1) |
//! | `20260612110000:15` | adds `p_user_id` — the IDOR guard, and `transaction_not_found` with it |
//! | `20260707120000:28` | adds `is_cleared` to the SET list, after the reconciliation incident |
//! | `20260808100000:282` | adds `category_confirmed` and its three-way CASE |
//!
//! Traced by grep across all sixty-two migration files; nothing else redefines
//! it. `20260805145035_repair_claimed_transfer.sql:50-70` deliberately did *not*
//! widen it, and says why: *"update_transaction_atomic is the busiest RPC in the
//! schema. Widening it …"*
//!
//! # The four behaviours, and why guessing produces a data-loss bug
//!
//! AUDIT3 §1 is the reason this file is long. The documented contract (TS-T3,
//! canonical #41) says *"present-and-empty clears, absent is ignored"*. That is
//! true of **two** fields out of fifteen. The RPC actually has four behaviours,
//! and one of them is the exact opposite of the documented one.
//!
//! MEASURED on the reference cluster, 2026-08-08, one call per cell — AUDIT3's
//! table was read-and-reasoned and its §11 asked for exactly this:
//!
//! | field | absent | `"k": ""` | `"k": null` |
//! | --- | --- | --- | --- |
//! | `description` | keep | **sets `''`** | keep |
//! | `type` | keep | **raises** — `transactions_type_check` | keep |
//! | `amount` | keep | **raises** — `invalid input syntax for type numeric` | keep |
//! | `date` | keep | **raises** — `… for type date` | keep |
//! | `account_id` | keep | **KEEPS the old account** | keep |
//! | `category` | keep | sets `''` | sets NULL |
//! | `category_confirmed` | three-way, below | **raises** — `… for type boolean` | keep |
//! | `notes` | keep | sets `''` | sets NULL |
//! | `tags` | keep | keep (not an array) | keep (not an array) |
//! | `is_recurring` | keep | **raises** | keep |
//! | `is_cleared` | keep | **raises** | keep |
//! | `transfer_account_id` | keep | **NULL — clears** | **NULL — clears** |
//! | `metadata` | keep | sets the JSON string `""` | sets JSON `null` |
//! | `category_id` | keep | **NULL — clears** | **NULL — clears** |
//! | `merchant_name` | keep | sets `''` | sets NULL |
//!
//! Three corrections to AUDIT3's table fell out of executing it:
//!
//! * `type: ''` **raises**; AUDIT3 predicted "sets the empty string". It would,
//!   were it not for `transactions_type_check`. The prediction was right about
//!   the RPC and wrong about the table, which is the same thing to a caller.
//! * `metadata` was not in the table at all. It is a `p ? 'k'` field whose
//!   value is taken with `->` rather than `->>`, so `""` stores a JSON *string*
//!   and `null` stores JSON *null*. Neither is ignored.
//! * `category_confirmed` is listed as **not settable**, which was true of
//!   `20260707120000`. `20260808100000` made it settable. The allow-list is
//!   fifteen fields now, not fourteen.
//!
//! `account_id` is the row that would have caused a data-loss bug:
//! `COALESCE(NULLIF(p->>'account_id','')::uuid, account_id)` turns
//! present-and-empty into *keep the old account*. A port that implemented TS-T3
//! uniformly would null an account reference the cloud preserves — and
//! `transactions.account_id` is `NOT NULL`, so it would not even fail cleanly.
//!
//! # The one place this verb is deliberately stricter than the cloud (D-7)
//!
//! `update_transaction_atomic` sets exactly those fifteen columns and **silently
//! discards every other key**. MEASURED: `archived`, `is_split`,
//! `linked_transfer_id`, `statement_sequence`, `user_id` and a plain typo
//! (`amont`) all return a row unchanged, with no error.
//!
//! The silence is the hazard, and the file that introduced `is_cleared` records
//! the incident it caused (`20260707120000:5-11`): *"the reconciliation page's
//! cleared checkbox silently did nothing (the RPC 'succeeded' without touching
//! is_cleared) … so a reconciliation difference could never reach zero."* The
//! same silence is how the `is_cleared` regression in `create_transaction_atomic`
//! survived a month.
//!
//! So [`TransactionPatch`] carries `deny_unknown_fields`: locally an
//! unrecognised key is a **refusal**. That is a DECLARED divergence, pinned from
//! both sides by
//! `verb-specs/update-transaction-a-key-outside-the-allow-list-is-discarded-by-the-cloud.spec.mjs`,
//! which is what makes AUDIT3's proposed D-7 executable rather than a note.
//!
//! It costs nothing in fidelity that matters: the columns behind those keys have
//! dedicated verbs (`link_transfer_pair`, `set_transaction_archived`,
//! `set_transactions_cleared`, the split writer) exactly so that a
//! general-purpose update surface cannot break mutual linkage. Refusing the key
//! enforces the same rule the cloud enforces, out loud.
//!
//! # Balance: relative, in SQL, and asserted (B-1, B-2)
//!
//! The RPC moves money in two shapes and this port keeps both:
//!
//! * same account, amount changed — `balance = balance + (new − old)`;
//! * account changed — `balance = balance − old` on the way out and
//!   `balance = balance + new` on the way in, two statements, each asserted.
//!
//! The delta is arithmetic on the **transaction's own amounts**, never on a
//! balance: no balance is ever read into Rust. Every one of the three sites
//! reads `changes()` and refuses `account_not_found_or_not_owned`, because
//! Postgres's `IF NOT FOUND` is free and SQLite's silence is not (AUDIT3 §3
//! measured a transaction landing whose amount never reached any balance, with
//! no error raised).
//!
//! # What this verb does NOT do, having read the RPC's body
//!
//! * **It does not hold `_rpc_guard('split')`.** A split parent's amount, type,
//!   category and `is_split` are protected by triggers here
//!   (`schema.sql` §"Split parents are read-only outside the split writers",
//!   the port of `protect_split_transaction_fields`, `20260713100000:67-105`)
//!   and by the same procedural checks in the cloud. Both engines refuse; the
//!   guard belongs to the split writer, and holding it here would quietly turn
//!   this verb into one.
//! * **It does not touch the transfer link.** `linked_transfer_id` and
//!   `linked_transfer_split_id` are not in the allow-list, so a general edit can
//!   never strand a pair (T-7). That is the cloud's design and it survives here
//!   as a refusal rather than as silence.
//! * **It does not resolve a transfer category.** As with the create verb, T-6
//!   lives in `create_transfer_counterpart`.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::{self, TransactionRow};
use crate::wire::{is_calendar_date, Field, Flag};

/// The command.
///
/// The RPC takes three positional arguments — `(p_id, p, p_user_id)` — and this
/// takes one JSON object with the same three things in it, because the
/// differential harness sends **one payload to both engines** and the Postgres
/// driver unpacks it into the call. If the two engines needed different commands
/// they would not be implementations of the same verb.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateTransaction {
    /// `p_id`. Which row.
    pub id: String,
    /// `p_user_id`. Absent means "name no owner".
    ///
    /// In the cloud that falls back to RLS, which is a property of a shared
    /// database. A local file belongs to one person and has no RLS, so absent
    /// means the ownership clause is simply not applied. The outcome is the same
    /// on both engines for every caller that states it — and every caller
    /// should, which is why `transactionService.ts:343-356` has `requireOwnerId`.
    #[serde(default)]
    pub user_id: Option<String>,
    /// `p`. The fields to change.
    #[serde(default)]
    pub patch: TransactionPatch,
}

/// The fifteen settable columns, each in the three states `jsonb` can present.
///
/// `deny_unknown_fields` is the declared divergence; see the module docs.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransactionPatch {
    /// `COALESCE(p->>'description', description)`. `''` is a value.
    #[serde(default)]
    pub description: Field<String>,
    /// `COALESCE(p->>'type', type)`. `''` reaches the CHECK and is refused.
    #[serde(default, rename = "type")]
    pub kind: Field<String>,
    /// `COALESCE((p->>'amount')::numeric, amount)`. Moves the balance.
    #[serde(default)]
    pub amount: Field<Money>,
    /// `COALESCE((p->>'date')::date, date)`.
    #[serde(default)]
    pub date: Field<String>,
    /// `COALESCE(NULLIF(p->>'account_id','')::uuid, account_id)` — the row where
    /// present-and-empty **keeps** the old value. Moves two balances.
    #[serde(default)]
    pub account_id: Field<String>,
    /// `CASE WHEN p ? 'category' THEN p->>'category' ELSE category END`.
    #[serde(default)]
    pub category: Field<String>,
    /// The three-way CASE. See [`confirmed_after`].
    #[serde(default)]
    pub category_confirmed: Field<Flag>,
    /// `CASE WHEN p ? 'notes' THEN p->>'notes' ELSE notes END`.
    #[serde(default)]
    pub notes: Field<String>,
    /// Replaced only when present **and** a JSON array — `jsonb_typeof(p->'tags')
    /// = 'array'`. Anything else, `""` and `null` included, is ignored.
    ///
    /// Typed as raw JSON rather than `Vec<String>` on purpose: a `Vec` would
    /// make `"tags": ""` a deserialiser error, and the cloud accepts and ignores
    /// it.
    #[serde(default)]
    pub tags: Field<serde_json::Value>,
    /// `COALESCE((p->>'is_recurring')::boolean, is_recurring)`.
    #[serde(default)]
    pub is_recurring: Field<Flag>,
    /// `COALESCE((p->>'is_cleared')::boolean, is_cleared)`.
    #[serde(default)]
    pub is_cleared: Field<Flag>,
    /// `CASE WHEN p ? … THEN NULLIF(p->>…,'')::uuid ELSE … END` — one of the two
    /// fields the `''`-clears contract is actually true of, and the one the
    /// application depends on (`strandedTransferActions.ts:57`).
    #[serde(default)]
    pub transfer_account_id: Field<String>,
    /// `CASE WHEN p ? 'metadata' THEN p->'metadata' ELSE metadata END`. `->`,
    /// not `->>`: the value is stored as JSON, so `""` stores a JSON string.
    #[serde(default)]
    pub metadata: Field<serde_json::Value>,
    /// The other field the `''`-clears contract is true of.
    #[serde(default)]
    pub category_id: Field<String>,
    /// `CASE WHEN p ? 'merchant_name' THEN p->>'merchant_name' ELSE … END`.
    #[serde(default)]
    pub merchant_name: Field<String>,
}

/// What the verb hands back: the row as it now stands, and the audit entry.
#[derive(Debug, Serialize)]
pub struct UpdateTransactionResult {
    /// The row as stored after the edit, money as decimal strings.
    pub transaction: TransactionRow,
    /// Dense sequence number of the audit row written for this update.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Edit one transaction, move whatever balances that implies, and audit it — all
/// in one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for a named refusal or a constraint the file enforced;
/// [`CoreError::Storage`] for a fault.
// Consumed, not borrowed, for the same reason as the create verb: this writes an
// audit row and moves a balance, and `&command` invites doing it twice.
#[allow(clippy::needless_pass_by_value)]
pub fn update_transaction(
    connection: &mut Connection,
    command: UpdateTransaction,
) -> CoreResult<UpdateTransactionResult> {
    let patch = &command.patch;

    // Everything that can refuse without touching the file, before the file is
    // touched. Postgres gets this free — its casts abort the statement — and
    // here it is an ordering decision that has to be made on purpose.
    if let Some(date) = patch.date.value() {
        if !is_calendar_date(date) {
            return Err(CoreError::Refused(
                Refusal::named(
                    "date_invalid",
                    &format!("date must be a real calendar date as YYYY-MM-DD: {date:?}"),
                )
                .with_hint("Postgres refuses this too, as an invalid input syntax for type date."),
            ));
        }
    }
    let is_recurring = resolve_flag(&patch.is_recurring, "is_recurring")?;
    let is_cleared = resolve_flag(&patch.is_cleared, "is_cleared")?;
    let category_confirmed = resolve_flag(&patch.category_confirmed, "category_confirmed")?;

    // BEGIN IMMEDIATE: the write lock up front, which is what makes the
    // read-then-update below equivalent to the cloud's SELECT … FOR UPDATE.
    // SQLite has one writer, so nothing can interleave between them.
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    // The ownership gate, and the RPC's own refusal for failing it. Scoped
    // exactly as `WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id)`.
    match transaction.query_row(
        "SELECT 1 FROM transactions
          WHERE id = ?1
            AND (?2 IS NULL OR user_id = ?2)",
        params![command.id, command.user_id],
        |row| row.get::<_, i64>(0),
    ) {
        Ok(_) => {}
        // The RPC's own refusal, and deliberately the same one for "no such
        // row" and "somebody else's row": telling the two apart would confirm
        // that an id exists to a caller who may not see it.
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(CoreError::Refused(
                Refusal::named("transaction_not_found", "transaction_not_found").with_hint(
                    "The transaction does not exist or does not belong to this user.",
                ),
            ))
        }
        Err(error) => return Err(error.into()),
    }

    let before = row::read_transaction(&transaction, &command.id)?;

    let changed = apply_patch(
        &transaction,
        &command,
        Flags {
            is_recurring,
            is_cleared,
            category_confirmed,
        },
        &before,
        &now,
    )?;
    // `id` is the primary key and the row was just proven to exist, so more than
    // one is unreachable and zero would mean the WHERE clause had drifted from
    // the one that found it. Asserting is free; a silent no-op edit is not.
    if changed != 1 {
        return Err(CoreError::refuse(
            "transaction_not_found",
            "the row disappeared between finding it and editing it",
        ));
    }

    replace_tags(&transaction, &command.id, &patch.tags)?;

    let after = row::read_transaction(&transaction, &command.id)?;

    move_balances(&transaction, &before, &after, &now)?;

    let before_json = serde_json::to_string(&before)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;
    let after_json = serde_json::to_string(&after)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;

    let entry = audit::write(
        &transaction,
        &after.user_id,
        "transaction",
        &command.id,
        Action::Update,
        Some(&before_json),
        Some(&after_json),
        &now,
    )?;

    transaction.commit()?;

    Ok(UpdateTransactionResult {
        transaction: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The three booleans, resolved out of their text casts before anything is
/// written.
#[derive(Debug, Clone, Copy)]
struct Flags {
    is_recurring: Option<bool>,
    is_cleared: Option<bool>,
    category_confirmed: Option<bool>,
}

/// `(p->>'k')::boolean` for a field that may be absent or JSON null.
///
/// Absent and null both yield `None`, which every one of these three fields
/// treats as "leave it alone" — `COALESCE(NULL, old)` for the first two, and the
/// first branch of the three-way CASE for the third.
fn resolve_flag(field: &Field<Flag>, name: &str) -> CoreResult<Option<bool>> {
    match field.value() {
        None => Ok(None),
        Some(flag) => flag.resolve().map(Some).map_err(|message| {
            CoreError::Refused(
                Refusal::named("boolean_invalid", &format!("{name}: {message}")).with_hint(
                    "Postgres refuses this too, as an invalid input syntax for type boolean.",
                ),
            )
        }),
    }
}

/// The single UPDATE, expression for expression against the RPC's SET list.
///
/// One statement rather than a SET list assembled in Rust, for two reasons that
/// are not style. A statement built by concatenation is a SQL surface, and this
/// crate has none (DESIGN.md §6.4). And the RPC's own shape — `CASE WHEN … THEN
/// … ELSE <column> END` — is what makes "leave it alone" mean *the stored value*
/// rather than *the value this process read a moment ago*; reproducing it
/// literally is the only way to be sure the two agree.
///
/// The bare column names on the right-hand side are the **old** row's values, in
/// both engines, per the SQL standard for `UPDATE … SET`. VERIFIED in SQLite:
/// `UPDATE t SET a='new', b=CASE WHEN 'new' IS NOT a THEN 1 ELSE 0 END` leaves
/// `b = 1`. `category_confirmed`'s second branch depends on it entirely.
fn apply_patch(
    transaction: &rusqlite::Transaction<'_>,
    command: &UpdateTransaction,
    flags: Flags,
    before: &TransactionRow,
    now: &str,
) -> CoreResult<usize> {
    let patch = &command.patch;
    let metadata = metadata_text(&patch.metadata);

    Ok(transaction.execute(
        "UPDATE transactions SET
           description         = CASE WHEN ?1  THEN ?2  ELSE description END,
           type                = CASE WHEN ?3  THEN ?4  ELSE type END,
           amount_minor        = CASE WHEN ?5  THEN ?6  ELSE amount_minor END,
           date                = CASE WHEN ?7  THEN ?8  ELSE date END,
           account_id          = CASE WHEN ?9  THEN ?10 ELSE account_id END,
           category            = CASE WHEN ?11 THEN ?12 ELSE category END,
           category_confirmed  = CASE
                                   WHEN ?13 THEN ?14
                                   WHEN ?11 AND ?12 IS NOT category THEN 1
                                   ELSE category_confirmed END,
           notes               = CASE WHEN ?15 THEN ?16 ELSE notes END,
           is_recurring        = CASE WHEN ?17 THEN ?18 ELSE is_recurring END,
           is_cleared          = CASE WHEN ?19 THEN ?20 ELSE is_cleared END,
           transfer_account_id = CASE WHEN ?21 THEN ?22 ELSE transfer_account_id END,
           metadata            = CASE WHEN ?23 THEN ?24 ELSE metadata END,
           category_id         = CASE WHEN ?25 THEN ?26 ELSE category_id END,
           merchant_name       = CASE WHEN ?27 THEN ?28 ELSE merchant_name END,
           updated_at          = ?29
         WHERE id = ?30",
        params![
            // COALESCE class: absent and JSON null are the same thing, so
            // "present" here means "a value arrived".
            patch.description.value().is_some(),
            patch.description.value(),
            patch.kind.value().is_some(),
            patch.kind.value(),
            patch.amount.value().is_some(),
            patch.amount.value().map(|amount| amount.minor()),
            patch.date.value().is_some(),
            patch.date.value(),
            // …plus a NULLIF, which is why `""` here KEEPS the old account.
            non_empty(&patch.account_id).is_some(),
            non_empty(&patch.account_id),
            // `p ? 'k'` class: the key being there is the whole test, and a
            // JSON null stores NULL.
            patch.category.is_present(),
            patch.category.value(),
            // The three-way CASE. Branch 1 is "the caller stated it", which the
            // cloud spells `p ? 'category_confirmed'` — so a stated JSON null
            // still takes this branch and COALESCEs to the old value, and
            // branch 2 is NOT reached. Reproduced exactly.
            patch.category_confirmed.is_present(),
            i64::from(flags.category_confirmed.unwrap_or(before.category_confirmed)),
            patch.notes.is_present(),
            patch.notes.value(),
            flags.is_recurring.is_some(),
            flags.is_recurring.map(i64::from),
            flags.is_cleared.is_some(),
            flags.is_cleared.map(i64::from),
            // `p ? 'k'` + NULLIF: present-and-empty clears. These two fields,
            // and only these two, are what TS-T3 actually describes.
            patch.transfer_account_id.is_present(),
            non_empty(&patch.transfer_account_id),
            patch.metadata.is_present(),
            metadata,
            patch.category_id.is_present(),
            non_empty(&patch.category_id),
            patch.merchant_name.is_present(),
            patch.merchant_name.value(),
            now,
            command.id,
        ],
    )?)
}

/// `NULLIF(p->>'k','')` — a value, unless it is the empty string.
fn non_empty(field: &Field<String>) -> Option<&str> {
    match field.value().map(String::as_str) {
        Some("") | None => None,
        Some(text) => Some(text),
    }
}

/// `p->'metadata'` as the TEXT the column stores.
///
/// `->` yields the JSON *value*, so a JSON null becomes the four characters
/// `null` (a valid JSON document, and `json_valid('null')` is 1 — VERIFIED),
/// not SQL NULL. The column is `NOT NULL`; binding SQL NULL here would be a
/// constraint violation where the cloud stores a JSON null quite happily.
fn metadata_text(field: &Field<serde_json::Value>) -> String {
    match field {
        Field::Absent | Field::Null => "null".to_owned(),
        Field::Value(value) => value.to_string(),
    }
}

/// `text[]` became a child table, so replacing the array is a delete and a
/// re-insert.
///
/// Only when the key is present **and** its value is a JSON array — the port of
/// `CASE WHEN p ? 'tags' AND jsonb_typeof(p->'tags') = 'array' THEN … ELSE tags
/// END`. An empty array is a real instruction (remove every tag) and is not the
/// same as an absent key.
fn replace_tags(
    transaction: &rusqlite::Transaction<'_>,
    id: &str,
    tags: &Field<serde_json::Value>,
) -> CoreResult<()> {
    let Some(serde_json::Value::Array(items)) = tags.value() else {
        return Ok(());
    };

    transaction.execute(
        "DELETE FROM transaction_tags WHERE transaction_id = ?1",
        params![id],
    )?;
    let mut insert = transaction
        .prepare("INSERT OR IGNORE INTO transaction_tags (transaction_id, tag) VALUES (?1, ?2)")?;
    for item in items {
        // jsonb_array_elements_text renders every element as text, so a number
        // in the array becomes its own spelling rather than an error.
        let tag = match item {
            serde_json::Value::String(text) => text.clone(),
            other => other.to_string(),
        };
        insert.execute(params![id, tag])?;
    }
    Ok(())
}

/// The balance arithmetic, in the RPC's own two shapes.
///
/// `INSERT OR IGNORE` above and this below are the only places the two engines'
/// data models actually differ, and neither difference is arithmetic.
fn move_balances(
    transaction: &rusqlite::Transaction<'_>,
    before: &TransactionRow,
    after: &TransactionRow,
    now: &str,
) -> CoreResult<()> {
    if before.account_id == after.account_id {
        if after.amount == before.amount {
            return Ok(());
        }
        // Arithmetic on the transaction's own two amounts — never on a balance.
        // The balance itself is only ever `balance = balance + ?`, in SQL.
        let delta = after
            .amount
            .minor()
            .checked_sub(before.amount.minor())
            .ok_or_else(|| {
                CoreError::refuse(
                    "amount_out_of_range",
                    "the difference between the old and new amounts does not fit in minor units",
                )
            })?;
        return shift(transaction, &after.account_id, &after.user_id, delta, now);
    }

    // Moved between accounts: reverse the old effect where it was, apply the new
    // effect where it now is. Two statements, two asserts, exactly as
    // 20260808100000:349-367.
    let out = before.amount.minor().checked_neg().ok_or_else(|| {
        CoreError::refuse(
            "amount_out_of_range",
            "the old amount has no negation in minor units",
        )
    })?;
    shift(transaction, &before.account_id, &before.user_id, out, now)?;
    shift(
        transaction,
        &after.account_id,
        &after.user_id,
        after.amount.minor(),
        now,
    )
}

/// One relative balance move, with the assert Postgres gives away for free.
fn shift(
    transaction: &rusqlite::Transaction<'_>,
    account_id: &str,
    user_id: &str,
    delta: i64,
    now: &str,
) -> CoreResult<()> {
    let moved = transaction.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor + ?1,
                updated_at = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![delta, now, account_id, user_id],
    )?;
    if moved != 1 {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    }
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{metadata_text, non_empty, TransactionPatch};
    use crate::wire::Field;

    #[test]
    fn non_empty_is_the_rpcs_nullif_and_nothing_more() {
        assert_eq!(non_empty(&Field::Absent), None);
        assert_eq!(non_empty(&Field::Null), None);
        assert_eq!(non_empty(&Field::Value(String::new())), None);
        assert_eq!(non_empty(&Field::Value("x".to_owned())), Some("x"));
    }

    #[test]
    fn metadata_null_is_the_json_document_not_sql_null() {
        assert_eq!(metadata_text(&Field::Null), "null");
        assert_eq!(metadata_text(&Field::Absent), "null");
        assert_eq!(
            metadata_text(&Field::Value(serde_json::json!(""))),
            "\"\"",
            "an empty string stores a JSON string, as p->'metadata' does"
        );
        assert_eq!(
            metadata_text(&Field::Value(serde_json::json!({"k": 1}))),
            "{\"k\":1}"
        );
    }

    #[test]
    fn a_key_outside_the_allow_list_is_refused_rather_than_discarded() {
        // D-7 in one assertion. The cloud discards these silently; see the
        // module docs for why the local edition will not.
        for key in [
            "archived",
            "is_split",
            "linked_transfer_id",
            "statement_sequence",
            "user_id",
            "amont",
        ] {
            let json = format!(r#"{{"{key}": null}}"#);
            let error = serde_json::from_str::<TransactionPatch>(&json)
                .expect_err("an unknown key must refuse");
            assert!(error.to_string().contains(key), "{key}: {error}");
        }
    }

    #[test]
    fn the_patch_defaults_to_changing_nothing() {
        let patch: TransactionPatch = serde_json::from_str("{}").expect("empty patch");
        assert_eq!(patch.description, Field::Absent);
        assert_eq!(patch.account_id, Field::Absent);
        assert!(!patch.category.is_present());
    }
}
