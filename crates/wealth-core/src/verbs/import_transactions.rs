//! `import_transactions` — the port of `import_transactions_atomic`, the RPC
//! behind every file import the app offers.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260808140000_file_import_idempotency.sql:234-402`.
//! Traced by grep across every migration; four definitions, and the newest is
//! the only one that counts:
//!
//! | migration | change |
//! | --- | --- |
//! | `20260709120000:20` | the original: the loop, one balance movement, one audit row per row |
//! | `20260808090000:162` | adds `statement_sequence` |
//! | `20260808100000:183` | adds `category_confirmed`, default true |
//! | `20260808140000:234` | adds provenance, `ON CONFLICT DO NOTHING`, the in-request duplicate refusal, and `{inserted, skipped, idempotent}` |
//!
//! `20260725120000:255` only re-grants it, and `20260808150000:67-71` says in as
//! many words that it does **not** touch either import RPC. So `140000` is live,
//! and everything below is a port of that body.
//!
//! # `idempotent` describes THE REQUEST, and this is not a quibble
//!
//! `20260808140000:389-395`:
//!
//! > `idempotent` answers ONE question, for the caller that is about to decide
//! > whether re-posting this request would be safe: did EVERY row of it carry an
//! > id that this database would refuse a second time? It is deliberately a
//! > statement about THIS REQUEST and not about this function's capabilities.
//!
//! So the expression is `v_rows > 0 AND v_keyed = v_rows`, and three answers
//! follow that a "does this function support idempotency" reading would get
//! wrong. MEASURED on the reference cluster, 2026-08-08
//! (`scratchpad/local-core/probe-ingest1.sh`):
//!
//! ```text
//! one keyed row                 -> {inserted 1, skipped 0, idempotent true}
//! one keyed + one unkeyed       -> {inserted 2, skipped 0, idempotent false}
//! []                            -> {inserted 0, skipped 0, idempotent false}
//! the same keyed chunk, twice   -> {inserted 0, skipped 1, idempotent true}
//! ```
//!
//! The empty request is the one that looks like a bug and is not: nothing was
//! keyed, so nothing about it is safe to re-post *on the strength of its keys*.
//!
//! # The refusal ORDER, measured, and the surprise in it
//!
//! Five refusals, and the order is part of the contract because four of them
//! fire before the account is even looked at. MEASURED, each pair made true at
//! once (`probe-ingest1.sh` §3):
//!
//! ```text
//! 1  p_rows must be a jsonb array
//! 2  import_provenance_incomplete
//! 3  import_provenance_duplicate_in_request
//! 4  import_provenance_too_long
//! 5  account_not_found_or_not_owned
//! 6  … then, per row and in array order, whatever the row itself will not store
//! ```
//!
//! **The surprise is 3 before 5.** A request aimed at an account this login does
//! not own, carrying a repeated key, is told about the key. That is a fact about
//! an account the caller cannot see — it learns its own request is malformed
//! before it learns it has no business here — and it is the cloud's behaviour, so
//! it is this verb's behaviour. It is also harmless in the way that matters: the
//! four provenance checks read only the payload, so nothing about the account,
//! its existence or its owner leaks through them.
//!
//! Refusal 6 is the one a section-wise reading gets wrong. A row whose amount,
//! date, type or boolean will not store aborts the call **from inside the loop**,
//! after earlier rows have already been inserted — and the whole transaction
//! rolls back, so those rows are not there afterwards. MEASURED
//! (`probe-ingest6.sh`): a good row followed by `"category_confirmed":"banana"`
//! leaves one row (the fixture's), the balance at its opening figure, and an
//! **empty** audit log. This port therefore does **not** hoist row parsing above
//! the provenance block, even though hoisting it would be tidier: doing so would
//! answer `invalid_command` where the cloud answers
//! `import_provenance_duplicate_in_request`, and that ordering was measured
//! rather than assumed (`probe-ingest5.sh` `e-duplicate-key-beats-a-bad-boolean`).
//!
//! # The idempotency the whole migration exists for
//!
//! `ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING`, inferred
//! from `transactions_import_source_unique`. The local schema carries the
//! matching index — `schema.sql:663`, `ux_txn_import_source`, UNIQUE and
//! deliberately **non-partial** — so no schema amendment was needed for this
//! port. Verified rather than assumed (`probe-ingest-sqlite.mjs`):
//!
//! ```text
//! ON CONFLICT (user_id, import_source, import_source_id)  -> inferred, changes=1
//! the same key again                                      -> changes=0, one row
//! three rows with NULL provenance                         -> 1/1/1, no collision
//! ON CONFLICT (import_source, import_source_id)           -> "does not match any
//!                                                            PRIMARY KEY or UNIQUE
//!                                                            constraint"
//! ```
//!
//! That last line is why the cloud's migration guards the index's shape before
//! trusting the inference: a partial or differently-shaped index does not fail
//! quietly, it fails every import. The same is true here.
//!
//! **The index is scoped by USER, not by account**, which is a behaviour rather
//! than an implementation detail: MEASURED, the same key posted to a *second
//! account of the same login* is skipped, and posted by a *different login* is
//! inserted. A file import that targets the wrong account cannot be repaired by
//! re-posting it at the right one under the same keys.
//!
//! # What a skipped row costs, which is nothing
//!
//! A refused insert returns no row, so it never reaches `v_sum` and never
//! reaches the audit write. `20260808140000:99-107` reasons about it and
//! verification 6 checks it; MEASURED here: a chunk that is entirely a re-post
//! inserts nothing, sums to zero, leaves `v_inserted` at 0 and therefore does not
//! run the balance UPDATE at all — so B-1 holds in both directions, the rows that
//! land move the balance and the rows that are refused never existed to move it.
//!
//! # The four column decisions that are not the create verb's
//!
//! This RPC and `create_transaction_atomic` look alike and disagree in four
//! places. Each is measured, and each is reproduced:
//!
//! | | this verb | `create_transaction` |
//! | --- | --- | --- |
//! | `category` | `NULLIF(…,'')` — `""` becomes NULL | stored verbatim, `""` included |
//! | `notes` | `NULLIF(…,'')` | stored verbatim |
//! | `id` | never accepted; the row's id is minted here | `COALESCE(NULLIF(p->>'id',''), gen_random_uuid())` |
//! | `account_id` | one argument for the whole call | per row |
//!
//! The last one is the security boundary and `20260709120000:14-18` says so:
//! *"account_id is taken from p_account_id (a file import targets one account),
//! not from the rows, so a caller can't scatter rows into accounts it doesn't
//! own."*
//!
//! # The guard: none, and measured
//!
//! MEASURED by listing the triggers rather than reading a comment
//! (`probe-ingest-sqlite.mjs`): `transactions` carries seven triggers and **not
//! one of them fires on INSERT** — every split protection is `BEFORE UPDATE OF`,
//! the archive sweep is `AFTER UPDATE OF is_cleared`, and the dismissal prune is
//! `AFTER DELETE`. On `accounts`, the balance UPDATE is watched only by
//! `trg_sync_transfer_category_for_account` (`AFTER UPDATE OF name, is_active` —
//! neither is written here) and `trg_accounts_updated_at`, which stands down of
//! its own accord because this verb writes `updated_at` itself. The guard table
//! is asserted empty across the whole call.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, AccountRow};
use crate::wire::{as_text, Flag, Ordinal};

/// The longest `import_source_id` the btree is asked to hold
/// (`20260808140000:305`).
const LONGEST_ID: usize = 200;
/// The longest `import_source` (`20260808140000:305`).
const LONGEST_SOURCE: usize = 60;

/// The command. `(p_user_id, p_account_id, p_rows)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportTransactions {
    /// `p_user_id`. Not optional: this function is service-role only in the
    /// cloud and every row it writes is written as this owner.
    pub user_id: String,
    /// `p_account_id`. One account for the whole call — the boundary that stops
    /// a caller scattering rows into accounts it does not own.
    pub account_id: String,
    /// `p_rows`.
    ///
    /// Raw JSON rather than a `Vec`, for the reason the split writer gives about
    /// `p_splits`: the RPC's first refusal is *"p_rows must be a jsonb array"*
    /// and a `Vec` would turn that into a deserialiser error under a different
    /// name. Keeping it raw also keeps the per-row parse **inside** the loop,
    /// which is where the cloud does it and is what preserves the measured
    /// refusal order.
    #[serde(default)]
    pub rows: Option<serde_json::Value>,
}

/// One row of the file, as the RPC reads it.
///
/// `deny_unknown_fields` is the same **declared local strengthening** the create,
/// update and split verbs carry: the cloud reads thirteen keys with `->>` and
/// silently discards a fourteenth, which is exactly how the `is_cleared`
/// regression went a month unnoticed. On this surface the cost of silence is
/// higher than anywhere else — a misspelled `import_source_id` turns an
/// idempotent import into a duplicating one and reports success — so a key
/// outside the thirteen is refused by name here and its differential spec
/// declares the difference.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportRow {
    /// `r->>'description'`. `NOT NULL` in both engines.
    pub description: String,
    /// `(r->>'amount')::numeric`. A decimal string; a JSON number is refused at
    /// the money boundary, because a JSON number is a binary float.
    pub amount: Money,
    /// `r->>'type'`. Enumerated by CHECK in both engines.
    #[serde(rename = "type")]
    pub kind: String,
    /// `(r->>'date')::date`.
    pub date: String,
    /// `NULLIF(r->>'category','')` — note the `NULLIF`, which
    /// `create_transaction_atomic` does **not** apply to this column.
    #[serde(default)]
    pub category: Option<String>,
    /// `NULLIF(r->>'notes','')`, same asymmetry.
    #[serde(default)]
    pub notes: Option<String>,
    /// `CASE WHEN r ? 'tags' AND jsonb_typeof(r->'tags') = 'array' THEN … ELSE
    /// NULL END`. Raw JSON, because "not an array" is a value the RPC accepts
    /// and turns into no tags at all — MEASURED: `"tags":"a"` stores NULL.
    #[serde(default)]
    pub tags: Option<serde_json::Value>,
    /// `COALESCE((r->>'is_recurring')::boolean, false)`.
    #[serde(default)]
    pub is_recurring: Option<Flag>,
    /// `COALESCE((r->>'is_cleared')::boolean, false)`.
    ///
    /// TS-I9: four sources, four cleared policies, and the decision is the
    /// caller's on this path. The bank feed always says false, OFX always says
    /// false, CSV says false, QIF forwards the file's own `C` flag and MS Money
    /// forwards `clearedStatus === 2`. This verb honours what it is told and
    /// defaults to false; it does not know which parser filled the field in.
    #[serde(default)]
    pub is_cleared: Option<Flag>,
    /// `NULLIF(r->>'statement_sequence','')::integer`. Absent stays NULL, and
    /// NULL means "unknown" — MEASURED: `0` stores as `0`, not as absent.
    #[serde(default)]
    pub statement_sequence: Option<Ordinal>,
    /// `COALESCE((r->>'category_confirmed')::boolean, true)`. False only from an
    /// importer that knows it guessed.
    #[serde(default)]
    pub category_confirmed: Option<Flag>,
    /// `NULLIF(btrim(r->>'import_source'),'')`.
    #[serde(default)]
    pub import_source: Option<serde_json::Value>,
    /// `NULLIF(btrim(r->>'import_source_id'),'')`.
    #[serde(default)]
    pub import_source_id: Option<serde_json::Value>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct ImportTransactionsResult {
    /// The projection both engines are compared on — the RPC's own jsonb, key
    /// for key.
    pub answer: ImportAnswer,
    /// Dense sequence number of the audit row that CLOSES the batch — the
    /// `account/update` entry, which is always last when anything landed — or
    /// `None` when nothing landed and there is no entry at all. Local-only, and
    /// outside the two-engine comparison for that reason.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit_row_hash: Option<String>,
}

/// `{inserted, skipped, idempotent}`.
#[derive(Debug, Serialize)]
pub struct ImportAnswer {
    /// Rows that landed. Each one moved the balance and wrote an audit entry.
    pub inserted: i64,
    /// Rows this user already held under the same import id. To the caller they
    /// ARE in the account; the count is the difference between "already landed"
    /// and "lost".
    pub skipped: i64,
    /// Was **this request** keyed end to end, and therefore safe to re-post?
    pub idempotent: bool,
}

/// The shape of the request's provenance, measured before anything is written.
#[derive(Debug)]
struct Provenance {
    rows: usize,
    keyed: usize,
}

/// Import one file's worth of rows into one account, in one transaction.
///
/// # Errors
/// [`CoreError::Refused`] for one of the five named refusals or a rule the file
/// enforced; [`CoreError::InvalidCommand`] for a row this ledger cannot read;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn import_transactions(
    connection: &mut Connection,
    command: ImportTransactions,
) -> CoreResult<ImportTransactionsResult> {
    // ── 1. The shape of the request. Before the file is opened. ─────────────
    let Some(serde_json::Value::Array(elements)) = command.rows.as_ref() else {
        return Err(CoreError::refuse(
            "rows_not_an_array",
            "p_rows must be a jsonb array",
        ));
    };

    // ── 2, 3, 4. The provenance block, whole, before the first insert. ───────
    let provenance = validate_provenance(elements)?;

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    // ── 5. The account. `SELECT … FOR UPDATE` in the cloud; SQLite has one
    // writer and BEGIN IMMEDIATE has already taken it, so the lock has nothing
    // to add. Reused as the "before" snapshot for the balance audit.
    let Some(before) = account::read_owned(&write, &command.account_id, &command.user_id)? else {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    };

    // ── 6. The loop, in array order. ────────────────────────────────────────
    let mut inserted = 0_i64;
    let mut skipped = 0_i64;
    let mut sum = 0_i64;
    let mut last: Option<audit::AuditEntry> = None;

    for element in elements {
        // Parsed HERE rather than up front, so that a row the ledger cannot read
        // is reported after the provenance block and not before it. The rows
        // ahead of it in the array have already been inserted at this point, and
        // the rollback is what removes them.
        let row: ImportRow =
            serde_json::from_value(element.clone()).map_err(|error| super::row_error(&error))?;

        let id = uuid::Uuid::new_v4().to_string();
        let landed = insert_row(&write, &id, &command, &row, &now)?;
        if landed == 0 {
            // This user already holds this exact source row. It is in the
            // account, it has already moved the balance once, and it must not
            // do so again.
            skipped = skipped.saturating_add(1);
            continue;
        }

        let stored = crate::row::read_transaction(&write, &id)?;
        last = Some(audit::write(
            &write,
            &command.user_id,
            "transaction",
            &id,
            Action::Create,
            None,
            Some(&super::json_of(&stored)?),
            &now,
        )?);

        sum = sum.checked_add(row.amount.minor()).ok_or_else(|| {
            CoreError::refuse(
                "amount_out_of_range",
                "that batch sums to more than this ledger can count",
            )
        })?;
        inserted = inserted.saturating_add(1);
    }

    // ── One balance effect for the whole batch, over the rows that landed. ───
    if inserted > 0 {
        last = Some(move_the_balance(
            &write, &command, &before, sum, &now,
        )?);
    }

    write.commit()?;

    Ok(ImportTransactionsResult {
        answer: ImportAnswer {
            inserted,
            skipped,
            // `v_rows > 0 AND v_keyed = v_rows`, spelled as the cloud spells it.
            idempotent: provenance.rows > 0 && provenance.keyed == provenance.rows,
        },
        audit_seq: last.as_ref().map(|entry| entry.seq),
        audit_row_hash: last.map(|entry| entry.row_hash),
    })
}

/// The provenance validation block, in the cloud's order.
///
/// Every check reads the PAYLOAD and nothing else, which is what makes running
/// them before the ownership check safe: none of them can report anything about
/// an account the caller may not see.
///
/// The reads are `->>` semantics — a JSON number arrives as its own spelling —
/// because that is what `e.value->>'import_source'` does. MEASURED:
/// `"import_source": 7` stores the text `7` and `"import_source": true` stores
/// `true`. Neither is a shape the app sends; both are reproduced because the
/// alternative is a typed field that refuses what the cloud accepts.
fn validate_provenance(elements: &[serde_json::Value]) -> CoreResult<Provenance> {
    let mut keyed = 0_usize;
    let mut half_keyed = 0_usize;
    let mut distinct: BTreeSet<(String, String)> = BTreeSet::new();
    let mut longest_id = 0_usize;
    let mut longest_source = 0_usize;

    for element in elements {
        let source = trimmed_key(element, "import_source");
        let id = trimmed_key(element, "import_source_id");

        // `max(length(i))` and `max(length(s))` are over ALL rows, not only the
        // keyed ones, which is why they are measured before the pair is judged.
        if let Some(value) = id.as_deref() {
            longest_id = longest_id.max(value.chars().count());
        }
        if let Some(value) = source.as_deref() {
            longest_source = longest_source.max(value.chars().count());
        }

        match (source, id) {
            (Some(source), Some(id)) => {
                keyed = keyed.saturating_add(1);
                distinct.insert((source, id));
            }
            (None, None) => {}
            _ => half_keyed = half_keyed.saturating_add(1),
        }
    }

    // A source with no id cannot be deduped and an id with no source cannot be
    // attributed; the table's own CHECK says the same thing, less legibly.
    if half_keyed > 0 {
        return Err(CoreError::refuse(
            "import_provenance_incomplete",
            &format!(
                "import_provenance_incomplete: {half_keyed} row(s) state one of import_source / \
                 import_source_id without the other. Send both or neither."
            ),
        ));
    }

    // The one failure mode ON CONFLICT DO NOTHING could turn into missing money:
    // two different rows under one id, the second discarded as a duplicate of
    // the first and counted as "already landed". That is a client bug, it is not
    // recoverable here, and it must never be quiet.
    if keyed > 0 && distinct.len() != keyed {
        return Err(CoreError::refuse(
            "import_provenance_duplicate_in_request",
            &format!(
                "import_provenance_duplicate_in_request: {keyed} keyed row(s) carry only {} \
                 distinct (import_source, import_source_id) pair(s). Two different rows sharing \
                 an id would be silently dropped as duplicates.",
                distinct.len()
            ),
        ));
    }

    // The index is a btree: an oversized key fails with an internal-sounding
    // error deep inside the insert loop. Refused here, by name.
    if longest_id > LONGEST_ID || longest_source > LONGEST_SOURCE {
        return Err(CoreError::refuse(
            "import_provenance_too_long",
            &format!(
                "import_provenance_too_long: import_source_id may be at most {LONGEST_ID} \
                 characters (longest here: {longest_id}) and import_source at most \
                 {LONGEST_SOURCE} (longest here: {longest_source})."
            ),
        ));
    }

    Ok(Provenance {
        rows: elements.len(),
        keyed,
    })
}

/// `NULLIF(btrim(e.value->>'k'), '')` — the trimmed key, or nothing at all.
///
/// Trimming happens BEFORE the distinct count and before storage, so ` fitid:1 `
/// and `fitid:1` are one key in both places. MEASURED: two rows carrying those
/// two spellings are refused as a duplicate, and a key stored through this path
/// comes back trimmed.
///
/// `str::trim` for `btrim`: Postgres's `btrim` defaults to the space character
/// alone and Rust's `trim` strips Unicode whitespace. An import key containing a
/// tab is not a shape either engine produces, and the wider test is the safer
/// one — the same argument [`super::is_blank_category`] carries.
fn trimmed_key(element: &serde_json::Value, key: &str) -> Option<String> {
    let raw = as_text(element.get(key).unwrap_or(&serde_json::Value::Null))?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

/// The INSERT, column for column against the live RPC's column list, with the
/// conflict clause that is the whole point of the migration this ports.
///
/// Returns the number of rows the statement actually inserted: `1`, or `0` when
/// the conflict clause swallowed it. SQLite reports that through `changes()` and
/// raises nothing, which is the same shape as the cloud's `RETURNING … INTO v_tx`
/// leaving `v_tx.id` NULL.
fn insert_row(
    write: &rusqlite::Transaction<'_>,
    id: &str,
    command: &ImportTransactions,
    row: &ImportRow,
    now: &str,
) -> CoreResult<usize> {
    let statement_sequence = match row.statement_sequence.as_ref().map(Ordinal::resolve) {
        None => None,
        Some(Ok(value)) => value,
        Some(Err(message)) => return Err(CoreError::InvalidCommand(message)),
    };
    let is_recurring = resolve_flag(row.is_recurring.as_ref(), false, "is_recurring")?;
    let is_cleared = resolve_flag(row.is_cleared.as_ref(), false, "is_cleared")?;
    let category_confirmed = resolve_flag(row.category_confirmed.as_ref(), true, "category_confirmed")?;

    if !crate::wire::is_calendar_date(&row.date) {
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

    // The same `NULLIF(btrim(…),'')` the provenance scan applied a moment ago,
    // and it has to BE the same or the scan would be counting keys the insert
    // does not store.
    let source = row.import_source.as_ref().and_then(trimmed_of);
    let source_id = row.import_source_id.as_ref().and_then(trimmed_of);

    let changes = write.execute(
        "INSERT INTO transactions (
           id, user_id, account_id, description, amount_minor, type, date,
           category, notes, is_recurring, is_cleared, statement_sequence,
           category_confirmed, import_source, import_source_id,
           created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, ?6, ?7,
           ?8, ?9, ?10, ?11, ?12,
           ?13, ?14, ?15,
           ?16, ?16
         )
         ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING",
        params![
            id,
            command.user_id,
            command.account_id,
            row.description,
            row.amount.minor(),
            row.kind,
            row.date,
            crate::wire::null_if_empty(row.category.as_deref()),
            crate::wire::null_if_empty(row.notes.as_deref()),
            i64::from(is_recurring),
            i64::from(is_cleared),
            statement_sequence,
            i64::from(category_confirmed),
            source,
            source_id,
            now,
        ],
    )?;

    if changes == 0 {
        return Ok(0);
    }

    // `text[]` became a child table. Same transaction, so a tag that will not
    // store takes the whole row with it, exactly as a rejected array element
    // would in Postgres. A `tags` value that is not an array is no tags at all —
    // the RPC's `CASE … ELSE NULL`.
    if let Some(serde_json::Value::Array(tags)) = row.tags.as_ref() {
        let mut insert =
            write.prepare("INSERT INTO transaction_tags (transaction_id, tag) VALUES (?1, ?2)")?;
        for tag in tags {
            insert.execute(params![id, as_text(tag)])?;
        }
    }

    Ok(1)
}

/// `NULLIF(btrim(x), '')` on a raw JSON value read with `->>`.
fn trimmed_of(value: &serde_json::Value) -> Option<String> {
    let text = as_text(value)?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

/// `COALESCE((r->>'k')::boolean, <fallback>)`, with the field's name in the
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

/// B-2. One movement for the whole batch, relative, in SQL, audited.
fn move_the_balance(
    write: &rusqlite::Transaction<'_>,
    command: &ImportTransactions,
    before: &AccountRow,
    sum: i64,
    now: &str,
) -> CoreResult<audit::AuditEntry> {
    let moved = write.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor + ?1,
                updated_at    = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![sum, now, command.account_id, command.user_id],
    )?;
    // Unreachable: the row was found under the same predicate a moment ago and
    // nothing can interleave inside BEGIN IMMEDIATE. Asserted because SQLite
    // reports zero changed rows and raises nothing at all, which is the failure
    // mode this crate refuses to leave silent.
    if moved != 1 {
        return Err(CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between locking it and moving its balance",
        ));
    }

    let after = account::read_owned(write, &command.account_id, &command.user_id)?.ok_or_else(
        || {
            CoreError::refuse(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                "the account disappeared between moving its balance and reading it back",
            )
        },
    )?;

    audit::write(
        write,
        &command.user_id,
        "account",
        &command.account_id,
        Action::Update,
        Some(&super::json_of(before)?),
        Some(&super::json_of(&after)?),
        now,
    )
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{validate_provenance, ImportRow, ImportTransactions};
    use serde_json::json;

    fn rows(value: &serde_json::Value) -> Vec<serde_json::Value> {
        value.as_array().expect("an array").clone()
    }

    #[test]
    fn an_empty_request_is_not_idempotent() {
        let shape = validate_provenance(&[]).expect("no rows, no refusal");
        assert!(!(shape.rows > 0 && shape.keyed == shape.rows));
    }

    #[test]
    fn a_wholly_keyed_request_is_idempotent_and_a_mixed_one_is_not() {
        let keyed = rows(&json!([{ "import_source": "ofx", "import_source_id": "a" }]));
        let shape = validate_provenance(&keyed).unwrap();
        assert!(shape.rows > 0 && shape.keyed == shape.rows);

        let mixed = rows(&json!([
            { "import_source": "ofx", "import_source_id": "a" },
            { "description": "no key" },
        ]));
        let shape = validate_provenance(&mixed).unwrap();
        assert!(!(shape.rows > 0 && shape.keyed == shape.rows));
    }

    #[test]
    fn a_blank_key_is_no_key_and_a_half_blank_one_is_a_refusal() {
        let both_blank = rows(&json!([{ "import_source": "  ", "import_source_id": "" }]));
        assert_eq!(validate_provenance(&both_blank).unwrap().keyed, 0);

        let half = rows(&json!([{ "import_source": "  ", "import_source_id": "k" }]));
        let error = validate_provenance(&half).expect_err("half a key is no key");
        assert_eq!(error.code(), "import_provenance_incomplete");
    }

    #[test]
    fn trimming_happens_before_the_distinct_count() {
        let two = rows(&json!([
            { "import_source": "ofx", "import_source_id": "k" },
            { "import_source": "ofx", "import_source_id": " k " },
        ]));
        let error = validate_provenance(&two).expect_err("one key wearing two spellings");
        assert_eq!(error.code(), "import_provenance_duplicate_in_request");
    }

    #[test]
    fn the_order_is_incomplete_then_duplicate_then_too_long() {
        let long = "x".repeat(201);
        let all_three = rows(&json!([
            { "import_source": "ofx" },
            { "import_source": "ofx", "import_source_id": "k" },
            { "import_source": "ofx", "import_source_id": "k" },
            { "import_source": "ofx", "import_source_id": long },
        ]));
        assert_eq!(
            validate_provenance(&all_three).unwrap_err().code(),
            "import_provenance_incomplete"
        );

        let two = rows(&json!([
            { "import_source": "ofx", "import_source_id": "k" },
            { "import_source": "ofx", "import_source_id": "k" },
            { "import_source": "ofx", "import_source_id": "x".repeat(201) },
        ]));
        assert_eq!(
            validate_provenance(&two).unwrap_err().code(),
            "import_provenance_duplicate_in_request"
        );
    }

    #[test]
    fn the_bounds_are_the_cloud_s_bounds_exactly() {
        let ok = rows(&json!([{ "import_source": "s".repeat(60), "import_source_id": "x".repeat(200) }]));
        assert!(validate_provenance(&ok).is_ok());

        let id = rows(&json!([{ "import_source": "ofx", "import_source_id": "x".repeat(201) }]));
        assert_eq!(
            validate_provenance(&id).unwrap_err().code(),
            "import_provenance_too_long"
        );

        let source = rows(&json!([{ "import_source": "s".repeat(61), "import_source_id": "k" }]));
        assert_eq!(
            validate_provenance(&source).unwrap_err().code(),
            "import_provenance_too_long"
        );
    }

    #[test]
    fn a_key_read_with_the_double_arrow_takes_a_number_as_its_own_spelling() {
        let numeric = rows(&json!([{ "import_source": 7, "import_source_id": "k" }]));
        assert_eq!(validate_provenance(&numeric).unwrap().keyed, 1);
    }

    #[test]
    fn a_scalar_element_carries_no_provenance_and_does_not_panic() {
        let odd = rows(&json!([7, null, "x", [1, 2]]));
        let shape = validate_provenance(&odd).expect("no provenance to be incomplete about");
        assert_eq!((shape.rows, shape.keyed), (4, 0));
    }

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<ImportTransactions>(
            r#"{"user_id":"u","account_id":"a","transactions":[]}"#,
        )
        .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("`transactions`"), "{error}");
    }

    #[test]
    fn a_row_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_value::<ImportRow>(json!({
            "description": "Coffee", "amount": "-4.25", "type": "expense",
            "date": "2024-05-01", "import_source_di": "typo",
        }))
        .expect_err("a fourteenth key must refuse");
        assert!(error.to_string().contains("`import_source_di`"), "{error}");
    }

    #[test]
    fn a_row_will_not_take_money_as_a_json_number() {
        let error = serde_json::from_value::<ImportRow>(json!({
            "description": "Coffee", "amount": -4.25, "type": "expense", "date": "2024-05-01",
        }))
        .expect_err("a JSON number is a binary float");
        assert!(error.to_string().contains("amount_must_be_a_string"), "{error}");
    }
}
