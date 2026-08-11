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
//!
//! # Reading is the second reason a module is here
//!
//! [`crate::verbs::reads`] answers with rows too, and it answers with THESE —
//! there is no second reader with a mapping of its own, which is PHASE3-PLAN
//! D-4's second reason for putting the reads in the crate at all: *"row mappers
//! already exist … money already leaves as decimal strings"*.
//!
//! What a read projects is what the CLOUD's own query projects, so that the
//! differential harness compares two answers to one question rather than two
//! questions. `.select('*')` means the whole row; a query that names its
//! columns (`suggestionDismissalService.list` names five) means those columns.
//!
//! Where that set is the set the audit already records, there is ONE type —
//! [`category::CategoryRow`] serves both. Where it is not, there are two, and
//! the module says which is which and why:
//!
//! * [`account`] — the audit entry is a deliberate eight-field projection whose
//!   width is load-bearing in `link_bank_account_snap`'s differential
//!   comparison; the reader needs the whole row.
//! * [`budget`] — the audit entry keeps `alert_threshold_bp` as stored; the
//!   reader gets it rendered, because the alternative is a division on the far
//!   side of the boundary.
//! * **the transaction** — [`TransactionRow`] is what the audit log records and
//!   [`ListedTransaction`] is what the boot reads, and the two are different
//!   sets in BOTH directions: the audit carries NINE columns the boot never asks
//!   for (the owner it has already filtered on, the feed's merchant, location
//!   and channel fields, the two file-import provenance ids, the feed's own id,
//!   and the metadata blob) and the boot carries THREE the audit has not got
//!   (`needs_review`, `created_at`, `updated_at`). Neither is a subset, so
//!   neither could serve as the other narrowed.
//! * [`split`] — the same shape again, and for the same two reasons at once:
//!   `SplitRow` is the line set the split writer embeds in its audit entry, and
//!   widening it to the reader's would put `created_at` into a payload two
//!   engines compare field by field.
//!
//! And two entities are here for the reader alone, with no audit twin, because
//! no verb in either engine audits one: [`goal`] and [`dismissal`].

pub mod account;
pub mod balance;
pub mod budget;
pub mod category;
pub mod dismissal;
pub mod goal;
pub mod recurring;
pub mod split;

use std::collections::HashMap;

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

/// A transaction as the boot reads it: the twenty-two columns the signed-in
/// load actually fetches, in the order it names them.
///
/// # This is not `SELECT *`, and the narrowing is the cloud's
///
/// `transactionService.ts`'s `BOOT_TRANSACTION_COLUMNS` is an EXPLICIT column
/// list with a measurement behind it: the wide table is thirty-two columns,
/// PostgREST sends a key for every one of them even when null, and across 51k
/// rows that was ~46 MB of which ~38% was columns nothing reads. The fields left
/// out — the metadata blob, `merchant_name`, `location_*`, `payment_channel`,
/// `external_transaction_id` and the two MS-Money provenance columns — *"have no
/// consumer"*, and the importer that does want the provenance re-queries it
/// rather than taking it from this array.
///
/// A local file has no bandwidth to save. It is narrowed anyway, and for a
/// better reason than bytes: what a read projects is what the cloud's own query
/// projects, so that the differential harness compares two answers to one
/// question. Widening this to `SELECT *` would make every spec assert seven
/// fields the app has never seen and would put the metadata blob — whose money
/// CHECK is a per-engine rule — into a cross-engine row comparison.
///
/// `user_id` is not here either, and that is the cloud's list too: *"the
/// redundant `user_id` we already filter on"*. It is a column the answer's own
/// question already fixed.
///
/// # `is_reconciled` is the column this file has not got
///
/// The cloud's boot list carries it (added by `20260810200000_marking_is_not_
/// reconciling.sql`, which split "marked" from "reconciled") and
/// `scripts/local-sqlite/schema.sql` has no such column — the same kind of gap
/// [`crate::row::account::ListedAccount`] records for `last_reconciled_balance`,
/// and named here rather than papered over because it is named where it BITES:
///
/// `src/utils/transactionReconciliation.ts` treats an absent `reconciled` as
/// *"ask `cleared`"*, which is the one-flag behaviour this app had until that
/// migration. So a local file does not lie about a row — it describes a ledger
/// in which marking and reconciling are the same act, which is what a file
/// without the column IS. The cloud's own fallback ladder
/// (`BOOT_TRANSACTION_COLUMNS_NO_RECONCILED`) does exactly this for a database
/// that has not had the migration applied yet. What is NOT true of a local file
/// is that the feature *lights up by itself the moment the migration lands*:
/// there is no migration to land until `schema.sql` grows the column, and the
/// day it does, this struct and the harness's oracle must grow it together.
#[derive(Debug, Clone, Serialize)]
// Six booleans, because six of the columns the boot reads are booleans. The
// reasoning is `TransactionRow`'s: this is a row, not a designed API.
#[allow(clippy::struct_excessive_bools)]
pub struct ListedTransaction {
    /// Primary key.
    pub id: String,
    /// The account whose balance this row moved.
    pub account_id: String,
    /// Signed amount, as a decimal string.
    pub amount: Money,
    /// Out of the live register, still in every total. See
    /// [`crate::row::balance`] for the half of that sentence that is money.
    pub archived: bool,
    /// Category id or legacy sentinel. TEXT with no foreign key (R-3).
    pub category: Option<String>,
    /// Has a human vouched for `category`?
    pub category_confirmed: bool,
    /// The category foreign key.
    pub category_id: Option<String>,
    /// When the row was made.
    pub created_at: String,
    /// `YYYY-MM-DD`. The list's first sort key.
    pub date: String,
    /// Payee or description, as entered or as the file stated it.
    pub description: String,
    /// Marked against a statement.
    pub is_cleared: bool,
    /// Part of a recurring series.
    pub is_recurring: bool,
    /// Is this row a split parent?
    pub is_split: bool,
    /// The counterpart row, when the pair is linked.
    pub linked_transfer_id: Option<String>,
    /// The counterpart split line, when the leg lives on one.
    pub linked_transfer_split_id: Option<String>,
    /// Did this row arrive from an import nobody has looked at yet?
    pub needs_review: bool,
    /// Free text.
    pub notes: Option<String>,
    /// The bank's own order within a day.
    pub statement_sequence: Option<i64>,
    /// Tags, which are a child table locally and a `text[]` in the cloud.
    pub tags: Vec<String>,
    /// `income` | `expense` | `transfer`.
    #[serde(rename = "type")]
    pub kind: String,
    /// When it last changed.
    pub updated_at: String,
    /// The other account, when this row is a transfer.
    pub transfer_account_id: Option<String>,
}

/// Every column [`ListedTransaction`] carries, in its serialised order — which
/// is `BOOT_TRANSACTION_COLUMNS`'s order, so the two lists can be read side by
/// side and the one difference (`is_reconciled`) seen rather than searched for.
const LISTED_COLUMNS: &str = "id, account_id, amount_minor, archived, category,
        category_confirmed, category_id, created_at, date, description, is_cleared,
        is_recurring, is_split, linked_transfer_id, linked_transfer_split_id,
        needs_review, notes, statement_sequence, type, updated_at, transfer_account_id";

/// The statement [`list_owned`] prepares, and the ONLY copy of it.
///
/// Public because `tests/reads_at_scale.rs` asserts this read's query plan at
/// 50,000 rows, and a plan assertion written against a *copy* of the query is
/// exactly how such an assertion goes on passing after the query it was written
/// for has changed. R-12 says a read that full-scans must turn a test red; that
/// is only true while the test and the reader are looking at one string.
///
/// It is not a door of the kind DESIGN §6.4 closes. That rule forbids a command
/// which ACCEPTS a SQL string from a caller; this takes no argument, touches no
/// connection and returns a constant.
#[must_use]
pub fn list_owned_sql() -> String {
    format!(
        "SELECT {LISTED_COLUMNS}
           FROM transactions
          WHERE user_id = ?1
          ORDER BY date DESC, id DESC"
    )
}

/// The statement [`owned_tags`] prepares. Public for [`list_owned_sql`]'s
/// reason: the tag pass is half of what a boot's transaction read costs, so its
/// plan is asserted too.
#[must_use]
pub fn owned_tags_sql() -> String {
    "SELECT tt.transaction_id, tt.tag
       FROM transaction_tags tt
       JOIN transactions t ON t.id = tt.transaction_id
      WHERE t.user_id = ?1
      ORDER BY tt.transaction_id, tt.tag"
        .to_owned()
}

/// Every transaction this login has, newest first.
///
/// # The order is a port, tie-break and all
///
/// `.order('date', {ascending: false}).order('id', {ascending: false})`, and the
/// second key carries the cloud's own comment: *"stable tiebreak for paging"*.
/// This is the one read in the crate whose tie-break needed no local decision —
/// the cloud states it, because without it a fetch spread over fifty-two pages
/// can hand the same row over twice and lose another.
///
/// # ARCHIVED ROWS ARE IN THIS ANSWER
///
/// The boot query filters on `user_id` and nothing else. Archiving is a VIEW
/// flag: the register hides an archived row, every total still counts it, and
/// the flag rides back as a column so the app can do the hiding in memory. A
/// port that "helpfully" added `AND archived = 0` here would take the rows out
/// of the client's own sum while [`crate::verbs::account_balances`] kept them in
/// its aggregate, and the two figures on the dashboard would stop agreeing —
/// which is R-1 arriving through the other door.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
pub fn list_owned(connection: &Connection, user_id: &str) -> CoreResult<Vec<ListedTransaction>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql, 50k rows):
    //   SEARCH transactions USING INDEX idx_txn_user_page (user_id=?)
    //
    // No temp B-tree: `idx_txn_user_page (user_id, date DESC, id DESC)` IS this
    // query's ORDER BY, which is why the index is spelled with both DESCs. At
    // 50k rows a sort here is not the tens of rows slice 15's five reads argued
    // about — see [`crate::verbs::reads`] for the measurement.
    //
    // The ONE thing interpolated is `LISTED_COLUMNS`, a crate constant; the
    // owner is a bound parameter (DESIGN §6.4).
    let mut statement = connection.prepare(&list_owned_sql())?;
    let rows = statement.query_map(params![user_id], |record| {
        Ok(ListedTransaction {
            id: record.get(0)?,
            account_id: record.get(1)?,
            amount: Money::from_minor(record.get(2)?),
            archived: record.get::<_, i64>(3)? != 0,
            category: record.get(4)?,
            category_confirmed: record.get::<_, i64>(5)? != 0,
            category_id: record.get(6)?,
            created_at: record.get(7)?,
            date: record.get(8)?,
            description: record.get(9)?,
            is_cleared: record.get::<_, i64>(10)? != 0,
            is_recurring: record.get::<_, i64>(11)? != 0,
            is_split: record.get::<_, i64>(12)? != 0,
            linked_transfer_id: record.get(13)?,
            linked_transfer_split_id: record.get(14)?,
            needs_review: record.get::<_, i64>(15)? != 0,
            notes: record.get(16)?,
            statement_sequence: record.get(17)?,
            tags: Vec::new(),
            kind: record.get(18)?,
            updated_at: record.get(19)?,
            transfer_account_id: record.get(20)?,
        })
    })?;

    let mut transactions = Vec::new();
    let mut at = HashMap::new();
    for transaction in rows {
        let transaction = transaction?;
        at.insert(transaction.id.clone(), transactions.len());
        transactions.push(transaction);
    }

    for (transaction_id, tag) in owned_tags(connection, user_id)? {
        if let Some(index) = at.get(&transaction_id) {
            if let Some(transaction) = transactions.get_mut(*index) {
                transaction.tags.push(tag);
            }
        }
    }
    Ok(transactions)
}

/// Every tag on every row of one login's, in ONE pass.
///
/// [`read_transaction`] reads a single row's tags with a query per row, which is
/// right for one row and catastrophic for fifty thousand: 50k round trips
/// through the same prepared statement is the N+1 that makes a read that should
/// take milliseconds take minutes. This is the same answer in one query, folded
/// into the list by the caller.
///
/// The ORDER matters and is the same one [`read_transaction`] uses — by tag —
/// because `transaction_tags` is a SET locally and a `text[]` in the cloud, and
/// a set has no order of its own to report. Both keys come free: the table is
/// `WITHOUT ROWID` with `PRIMARY KEY (transaction_id, tag)`, so its rows ARE
/// stored in this order and the plan below is a scan of the primary key rather
/// than a sort.
fn owned_tags(connection: &Connection, user_id: &str) -> CoreResult<Vec<(String, String)>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SCAN transaction_tags
    //   SEARCH transactions USING INDEX sqlite_autoindex_transactions_1 (id=?)
    //
    // A SCAN, and this is the one place in the read family where a scan is the
    // right plan rather than a bug report. `transaction_tags` holds one row per
    // TAG, not per transaction — a ledger of 50k rows carries a few thousand at
    // the very most, because a tag is something a person types — and the scan is
    // of a WITHOUT ROWID table, so it is a walk of the b-tree that is already in
    // the order this query wants. The alternative plan (drive from
    // `transactions`, search the tag table per row) does 50k index seeks to
    // avoid walking a few thousand rows.
    //
    // What would change that: a tag table that grew with the LEDGER rather than
    // with the user's vocabulary. It does not — see the measurement in
    // [`crate::verbs::reads`].
    let mut statement = connection.prepare(&owned_tags_sql())?;
    let rows = statement.query_map(params![user_id], |record| {
        Ok((record.get::<_, String>(0)?, record.get::<_, String>(1)?))
    })?;

    let mut tags = Vec::new();
    for tag in rows {
        tags.push(tag?);
    }
    Ok(tags)
}
