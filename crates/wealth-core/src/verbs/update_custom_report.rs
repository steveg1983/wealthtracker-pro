//! `update_custom_report` — an edit to saved work, and the one patch in this
//! crate that deliberately does NOT merge.
//!
//! # What it is a port OF
//!
//! An `UPDATE … .eq('id', id).eq('user_id', userId).select().single()` straight
//! over PostgREST, against the table
//! `20260812140000_reports_outlive_the_browser.sql` created. No RPC;
//! PHASE3-PLAN D-2, and [`super::create_custom_report`] carries the family's
//! argument along with the reason this verb has a Postgres twin younger than the
//! feature it serves.
//!
//! # `components` AND `filters` REPLACE WHOLESALE — CONTRAST WITH `update_goal`
//!
//! This is the decision in the file, and it is the opposite of the one taken next
//! door, so it is argued rather than assumed.
//!
//! [`super::update_goal`] MERGES `metadata`: it reads the stored blob inside the
//! transaction and spreads the patch over it, because that column is a shared
//! bag holding three unrelated app fields (`type`, `linkedAccountIds`,
//! `contributionAmount`) and rebuilding it from whatever an update happened to
//! mention had a consequence with a date on it — *"Editing a goal's type deleted
//! its linked accounts."*
//!
//! Neither of this table's blobs is that shape, and a merge would be actively
//! wrong on both:
//!
//! * **`components` is an ORDERED LIST.** There is no key-by-key spread of an
//!   array that means anything. Index-wise merging would make removing the third
//!   block impossible — a shorter list would leave the tail of the old one
//!   standing — and reordering blocks, which is the commonest edit a report
//!   builder makes, would silently do nothing at all. The user's gesture is
//!   *"the report is now these blocks, in this order"*, and the only faithful
//!   translation of it is an assignment.
//! * **`filters` is a SINGLE COHERENT SCOPE.** Its keys are not independent
//!   settings: `dateRange: 'custom'` is meaningless without
//!   `customStartDate`/`customEndDate`, and a merge that dropped a key while
//!   changing another would leave a report claiming a custom range with no
//!   dates in it. Clearing a narrowing — going back to "all accounts" — is
//!   expressed by sending the object WITHOUT `accounts`, and under a merge that
//!   is the one edit a user cannot make: the old array would survive every
//!   update forever.
//!
//! So both columns are `CASE WHEN ?present THEN ?value ELSE column END` with the
//! stated document bound whole, and the three-state [`Field`] is what keeps
//! "leave the components alone" apart from "the components are now empty" —
//! `Field::Absent` writes nothing, `Field::Value(json!([]))` writes an empty
//! list. The third state, a stated `null`, is refused by the column: both are
//! `NOT NULL` on both engines, which is what the cloud does with the same
//! payload.
//!
//! Recorded here rather than in a commit message because the pull towards a
//! merge is strong — the neighbouring verb does it, and both files are "a jsonb
//! column being patched" if you read only the types.
//!
//! # ONE presence rule, and it is the family's
//!
//! `undefined` is dropped, anything else — `null` included — is sent, which is
//! the `p ? 'k'` class [`super::update_account`] describes. Where the column is
//! `NOT NULL` (all four of them here) a stated null is refused by the file, on
//! both engines. Not one field of this patch has a falsy-to-null rule, which is
//! the first patch in the crate that can say so: there is no id column here to
//! be set to `''` by mistake.
//!
//! # A REPORT THAT IS NOT THERE IS REFUSED, BY NAME
//!
//! `.single()`, and [`super::delete_custom_report`] again does not have it —
//! the same asymmetry the budget and goal pairs carry. The refusal is
//! `custom_report_not_found` / *"Custom report not found"*, and the
//! read-before-write makes "the refusal leaves the store exactly as it was"
//! structural rather than careful.
//!
//! # It audits — DIVERGENCE 10
//!
//! One `custom_report/update` entry, `before` and `after`, and for this table
//! the entry is worth more than the usual: `before` holds the whole previous
//! definition, so an edit that replaced the components with the wrong list is
//! recoverable from the log. That is the wholesale replacement's other side, and
//! the reason the two decisions belong in one file.
//!
//! # No guard, measured
//!
//! An UPDATE of `custom_reports`. No trigger on that table locally at all, which
//! is why this verb writes `updated_at` itself (the cloud has
//! `update_custom_reports_updated_at` doing it BEFORE UPDATE).
//! `tests/custom_report_writes.rs` asserts the guard table empty across an edit.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::row::custom_report::{self, CustomReportRow};
use crate::wire::Field;

use super::create_custom_report::{not_found, NOT_FOUND};

/// The command.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateCustomReport {
    /// Which report.
    pub id: String,
    /// Whose. Absent means "name no owner" — see [`super::update_transaction`].
    #[serde(default)]
    pub user_id: Option<String>,
    /// The fields to change.
    #[serde(default)]
    pub patch: CustomReportPatch,
}

/// The settable columns, each in the three states `jsonb` can present.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CustomReportPatch {
    /// As shown. A blank or whitespace-only name is refused by the table.
    #[serde(default)]
    pub name: Field<String>,
    /// Free text. `''` is a value here and means an empty description; the
    /// column is `NOT NULL DEFAULT ''`, so there is no null to fall back to.
    #[serde(default)]
    pub description: Field<String>,
    /// The blocks, in render order. REPLACED wholesale — see the module docs for
    /// why this is not [`super::update_goal`]'s metadata merge.
    #[serde(default)]
    pub components: Field<serde_json::Value>,
    /// The scope. Replaced wholesale, for the same reason and one of its own.
    #[serde(default)]
    pub filters: Field<serde_json::Value>,
}

/// What the verb hands back: the row as it now stands, and the audit entry.
#[derive(Debug, Serialize)]
pub struct UpdateCustomReportResult {
    /// The report as stored after the edit — the whole row, so the caller can
    /// replace its copy with the answer.
    pub answer: CustomReportRow,
    /// Dense sequence number of the audit row written for this update.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Edit one saved report and audit it — one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for `custom_report_not_found` or a rule the file
/// enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn update_custom_report(
    connection: &mut Connection,
    command: UpdateCustomReport,
) -> CoreResult<UpdateCustomReportResult> {
    // BEGIN IMMEDIATE: the write lock up front, so the read-then-update below is
    // the cloud's `SELECT … FOR UPDATE` without the lock it has nothing to add.
    // Unlike `update_goal` there is no merge for it to protect — the columns are
    // assigned, not folded — so what it protects here is the audit's `before`
    // being the row this statement actually edited.
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let owner = command.user_id.as_deref();
    let Some(before) = custom_report::read_owned(&transaction, &command.id, owner)? else {
        return Err(not_found());
    };

    let changed = apply(&transaction, &command, &now)?;
    // Unreachable, and named rather than silent: see [`super::update_budget`].
    if changed != 1 {
        return Err(CoreError::refuse(
            NOT_FOUND,
            "the report disappeared between finding it and editing it",
        ));
    }

    let after = super::create_custom_report::read_back(&transaction, &command.id, &before.user_id)?;

    let entry = audit::write(
        &transaction,
        &before.user_id,
        "custom_report",
        &command.id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(UpdateCustomReportResult {
        answer: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The single UPDATE, column for column.
///
/// One statement rather than a SET list assembled in Rust — see
/// [`super::update_transaction`] for the two reasons.
fn apply(
    transaction: &rusqlite::Transaction<'_>,
    command: &UpdateCustomReport,
    now: &str,
) -> CoreResult<usize> {
    let patch = &command.patch;
    // The stated document, as the TEXT the column holds. `None` here covers both
    // absence and a stated null, and the `?present` flag beside it is what tells
    // them apart: absent leaves the column, null binds NULL and is refused by
    // `NOT NULL` — which is what the cloud's own UPDATE does with the same
    // payload.
    let components = patch.components.value().map(ToString::to_string);
    let filters = patch.filters.value().map(ToString::to_string);

    Ok(transaction.execute(
        "UPDATE custom_reports SET
           name        = CASE WHEN ?1 THEN ?2 ELSE name END,
           description = CASE WHEN ?3 THEN ?4 ELSE description END,
           components  = CASE WHEN ?5 THEN ?6 ELSE components END,
           filters     = CASE WHEN ?7 THEN ?8 ELSE filters END,
           updated_at  = ?9
         WHERE id = ?10",
        params![
            patch.name.is_present(),
            patch.name.value(),
            patch.description.is_present(),
            patch.description.value(),
            patch.components.is_present(),
            components,
            patch.filters.is_present(),
            filters,
            now,
            command.id,
        ],
    )?)
}
