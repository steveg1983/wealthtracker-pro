//! `create_custom_report` — a question about the ledger, saved somewhere that
//! survives clearing a browser.
//!
//! # What it is a port OF
//!
//! `customReportService`'s save path as
//! `20260812140000_reports_outlive_the_browser.sql` re-homed it: an INSERT
//! straight into `custom_reports` over PostgREST, with RLS as the owner gate.
//! There is no RPC — this is PHASE3-PLAN D-2 again, the family argued in full at
//! the head of [`super`], and it is the seventh region of the data layer to
//! reach the seam that way.
//!
//! What it is a port of is unusual in one respect worth stating: until that
//! migration there was **nothing to port**. The builder wrote its output to
//! `window.localStorage`, under one key, on one machine, and the cloud had no
//! table for it at all. So this verb has a Postgres twin that is three days
//! older than it is, and the differential harness compares two implementations
//! of a thing neither engine had a month ago.
//!
//! # A REPORT IS A QUESTION, NEVER AN ANSWER
//!
//! The rule this file exists to keep, and the one a future edit is most likely
//! to break. A saved report holds the components it is made of and the filters
//! it runs under; the FIGURES are computed from `transactions` every time it is
//! generated. Nothing in this payload is money, there is no arithmetic anywhere
//! below, and `crate::money` is not imported — which is not an accident of this
//! entity being simple but the property that keeps the reports page and the
//! register agreeing. A stored total here would be a cache of an answer the
//! ledger can change underneath.
//!
//! The temptation is real enough that the cloud spent a constraint on it: the
//! obvious wrong use of this table is to keep the produced ROWS beside the
//! definition, and `custom_reports_definition_is_small` (256 KiB) is what fires
//! when somebody does. `schema.sql` records why the local twin has no such CHECK
//! and where a local file would catch it instead.
//!
//! # THE TWO BLOBS ARE BORN AS CONTAINERS, NOT AS NULL
//!
//! `components` defaults to `[]` and `filters` to `{}`, in both engines, and
//! both defaults are the COLUMN's rather than a literal this verb writes —
//! `COALESCE(?n, '[]')` and `COALESCE(?n, '{}')` reach the column only for a
//! caller that stated the key as null, which is the shape `create_goal` uses for
//! `metadata` and for the same reason: a default written in Rust is a second
//! copy of a rule the schema already holds, and the two drift the first time one
//! is edited.
//!
//! What that buys is worth naming, because it is the difference between an empty
//! report and a broken page. A report born with `null` components would be
//! iterated by the reports page and would throw; a report born with `[]` draws
//! as an empty report, which is exactly what a report nobody has added a block
//! to yet IS. The CHECK (`json_type(components) = 'array'`) is what makes that
//! true of every row and not merely of the ones this verb wrote.
//!
//! # `name` IS REFUSED BY THE TABLE, INCLUDING THE ONE MADE OF SPACES
//!
//! `NOT NULL` with no default, so an absent name is refused by the file — where
//! the cloud refuses it too — and `custom_reports_name_not_blank` catches the
//! one the builder's own `if (!name)` does not: `"   "`, which is truthy in
//! JavaScript and is a report the list cannot offer you. Neither refusal is
//! written here. Both are the schema's, on both engines, which is what makes
//! them true of a restore and of somebody with a SQLite prompt as well as of
//! this verb.
//!
//! # It audits — DIVERGENCE 10, reached by a different road
//!
//! One `custom_report/create` entry, chained, in the same transaction; the cloud
//! writes none. The planning family's argument does not apply here — PHASE1-PLAN
//! §2.2 named four FIGURES and this table has none — so the reason is the log's
//! other job. A report is work the person authored, the row is the only copy of
//! it, and *"where did my report go?"* is a question nothing else in the file can
//! answer once the row is gone. [`super::create_budget`] carries the shape of the
//! divergence; this verb carries its own reason for joining it.
//!
//! # No guard, measured
//!
//! An INSERT into `custom_reports`. `schema.sql` has no trigger on that table at
//! all — not an `updated_at` bump (this verb writes the column, as every verb in
//! the two TypeScript-writer families does) and no branch of
//! `trg_unnest_account_references`, which is `BEFORE DELETE ON accounts` and has
//! nothing to clear here: there is no `account_id` column. The account ids that
//! DO appear, inside `filters`, are opaque JSON the database does not constrain.
//! `tests/custom_report_writes.rs` asserts the guard table empty across a create.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::custom_report::{self, CustomReportRow};

/// One saved report as the builder sends it, plus the owner.
///
/// Every column the table has and not one more: it is a WHITELIST, and
/// `deny_unknown_fields` is this crate's usual strengthening. `created_at` and
/// `updated_at` are deliberately absent — the clock is the file's, and a caller
/// that could state either could date its own work. `writes.ts` records what
/// that costs the adoption, and why the alternative was worse.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CustomReportDraft {
    /// Client-minted, or minted here when absent — B-5.
    #[serde(default)]
    pub id: Option<String>,
    /// As shown. `NOT NULL` in both engines with no default, so an absent one is
    /// refused by the TABLE, which is where the cloud refuses it too.
    #[serde(default)]
    pub name: Option<String>,
    /// Free text. Defaults to the column's `''`.
    #[serde(default)]
    pub description: Option<String>,
    /// The blocks, in render order. Defaults to the column's `'[]'`.
    #[serde(default)]
    pub components: Option<serde_json::Value>,
    /// The scope. Defaults to the column's `'{}'`.
    #[serde(default)]
    pub filters: Option<serde_json::Value>,
}

/// The command: one report, and whose.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateCustomReport {
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// The report, flattened into the command so the payload is the row the
    /// cloud's insert literally is, plus the owner.
    #[serde(flatten)]
    pub report: CustomReportDraft,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct CreateCustomReportResult {
    /// The report as stored — the same projection `list_custom_reports` answers
    /// with, so a caller can put it straight into state without re-reading.
    pub answer: CustomReportRow,
    /// Dense sequence number of the audit row written for this create.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Store one saved report and audit it — one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for a rule the file enforced —
/// `custom_reports_name_not_blank`, either of the two container CHECKs, the
/// users foreign key, or the `NOT NULL` on a name nobody filled in;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn create_custom_report(
    connection: &mut Connection,
    command: CreateCustomReport,
) -> CoreResult<CreateCustomReportResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let id = super::minted_uuid(command.report.id.as_deref());

    transaction.execute(
        "INSERT INTO custom_reports (
           id, user_id, name, description, components, filters, created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, COALESCE(?4, ''), COALESCE(?5, '[]'), COALESCE(?6, '{}'), ?7, ?7
         )",
        params![
            id,
            command.user_id,
            command.report.name,
            command.report.description,
            command.report.components.as_ref().map(ToString::to_string),
            command.report.filters.as_ref().map(ToString::to_string),
            now,
        ],
    )?;

    // Read back rather than reconstructed, for the reason `create_transaction`
    // states about `to_jsonb(v_tx)`: the audit's `after` and the caller's answer
    // must be what storage holds, defaults and CHECKs and all. It matters more
    // here than usual — three of this row's six settable columns are defaults a
    // caller routinely leaves to the file.
    let stored = read_back(&transaction, &id, &command.user_id)?;
    let entry = audit::write(
        &transaction,
        &command.user_id,
        "custom_report",
        &id,
        Action::Create,
        None,
        Some(&super::json_of(&stored)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(CreateCustomReportResult {
        answer: stored,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The stored report, or the refusal for a row that vanished between writing it
/// and reading it back — unreachable, and named rather than unwrapped.
pub(super) fn read_back(
    transaction: &rusqlite::Transaction<'_>,
    id: &str,
    user_id: &str,
) -> CoreResult<CustomReportRow> {
    custom_report::read_owned(transaction, id, Some(user_id))?.ok_or_else(|| {
        CoreError::refuse(
            NOT_FOUND,
            "the report disappeared between writing it and reading it back",
        )
    })
}

/// The code every custom-report verb refuses a missing row under.
pub(super) const NOT_FOUND: &str = "custom_report_not_found";

/// The prose a person reads when one does. Written in the app's own voice
/// because the cloud has no sentence to inherit — PostgREST answers `PGRST116`
/// — which is the same reason [`super::create_budget::NOT_FOUND_MESSAGE`] gives
/// for taking its words from `DataServiceImpl` rather than from a Postgres
/// function.
pub(super) const NOT_FOUND_MESSAGE: &str = "Custom report not found";

/// The refusal itself, so three verbs cannot word it three ways.
pub(super) fn not_found() -> CoreError {
    CoreError::Refused(Refusal::named(NOT_FOUND, NOT_FOUND_MESSAGE).with_hint(
        "That report no longer exists, or is not yours. Reload the saved reports and try again.",
    ))
}
