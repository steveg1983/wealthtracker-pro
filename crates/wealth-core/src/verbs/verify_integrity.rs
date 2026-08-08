//! `verify_integrity` — the file's own answer to *"is any of this wrong?"*.
//!
//! # This one is not a port, and that had to be established rather than assumed
//!
//! Every other verb in this crate names the migration it is a port of. This one
//! cannot, because **there is no cloud counterpart at all**. TRACED, three ways,
//! before a line of it was written:
//!
//! ```text
//! grep -rn verify_integrity supabase/ api/ src/   -> nothing but schema.sql and its own specs
//! grep -rn "CREATE VIEW"    supabase/migrations/  -> no rows
//! grep -rln integrity       supabase/migrations/  -> two files, both prose in a comment
//! ```
//!
//! The nearest Postgres relatives are two one-off verification SELECTs that a
//! migration runs once and discards — `20260808090000:292-299` and
//! `20260807200000:100-110` — and both are B-1 alone. `schema.sql`'s own section
//! header used to claim *"each of these has a Postgres twin … so the differential
//! harness can compare violation NAMES across engines"*; that claim was wrong and
//! is corrected in the same change as this file.
//!
//! **So this verb is LOCAL-ONLY and has no differential oracle.** Its specs run
//! on SQLite alone and say so — `parity: 'not-comparable'`, the same declaration
//! the constraint harness already uses for a rule only one engine has. The design
//! always intended it that way: DESIGN.md calls the view *"the single
//! highest-leverage artifact in the local core"*, and the leverage comes from the
//! local edition having no RLS, no service role and no second implementation to
//! be checked against. The file has to be able to check itself.
//!
//! # Seventeen checks: fifteen rules and two suspicions
//!
//! `v_integrity_violations` is the whole implementation; this verb runs it,
//! orders it and counts it. Fifteen checks report `severity = 'violation'` — a
//! rule of the ledger that no constraint in either engine can hold — and two
//! report `warning`:
//!
//! | severity | check |
//! | --- | --- |
//! | violation | `balance_identity` (B-1) |
//! | violation | `split_sum`, `split_min_lines`, `orphan_split_lines` (S-1…S-3) |
//! | violation | `transfer_link_not_mutual`, `transfer_amounts_not_opposite`, `transfer_same_account` (T-1…T-3) |
//! | violation | `split_leg_amounts_not_opposite`, `split_leg_link_not_mutual` (T-4, T-5) |
//! | violation | `dangling_category_ref`, `dangling_split_category_ref` (R-3) |
//! | violation | `account_missing_transfer_category`, `account_multiple_transfer_categories` (C-3) |
//! | violation | `audit_chain_broken` (A-1) |
//! | violation | `account_nesting_too_deep` (I-1) |
//! | **warning** | `card_account_sign_implausible` (TS-F1/TS-F2) |
//! | **warning** | `bank_balance_implausible` (TS-I1/TS-I2) |
//!
//! The two warnings are PHASE1-PLAN §2.5's addendum, and they were added because
//! the fifteen were MEASURED not to catch what they are for
//! (`scratchpad/local-core/probe-integrity1.mjs`, cases 16 and 17: both ingest
//! disasters planted, nothing fired). They are heuristics — a credit card
//! genuinely can be in credit — which is why they are a separate severity rather
//! than a sixteenth and seventeenth rule, and why [`IntegrityReport::ok`] ignores
//! them.
//!
//! # Every check is proved to FIRE, and one of them can only be reached sideways
//!
//! A check nobody can plant is a check nobody can prove, so each of the
//! seventeen has a spec that plants its violation and reads it back. Sixteen are
//! plantable by ordinary SQL. `account_missing_transfer_category` is the
//! exception and it is worth writing down, because the obvious plant is refused
//! by the schema:
//!
//! ```text
//! DELETE the Transfer anchor, then add an account   -> REFUSED transfer_category_protected
//!   (the anchor's cascade reaches the EXISTING To/From rows, and C-5 stops it)
//! add an account for a login that never had an anchor -> planted
//! ```
//!
//! (MEASURED, `probe-integrity1.mjs`, cases `12` and `00 clean + a second
//! login`.) So the violation is reachable only forwards — by creating an account
//! whose owner has no Transfer anchor for C-3's trigger to hang the category
//! from — never by removing a category that already exists. That is C-5 and C-3
//! doing exactly their jobs, and it is why the spec for this check uses a second
//! login rather than a delete.
//!
//! # It writes nothing, audits nothing and opens no transaction
//!
//! The second verb in the crate with that shape, after
//! [`super::user_financial_data_is_empty`], and for the same reason: there is
//! nothing to be atomic about, and an audit entry recording that somebody asked
//! a question would be noise in a log whose whole value is that every line in it
//! is a change.
//!
//! It also takes **no owner**. Every other verb here is scoped to a login;
//! integrity is a property of the FILE. Three of the seventeen checks
//! (`audit_chain_broken`, and both halves of the C-3 pair through their trigger)
//! have no honest per-user reading at all, and a file whose stranger's rows are
//! corrupt is a corrupt file. A `user_id` argument would have to be ignored by a
//! third of the checks, which is worse than not having one.
//!
//! # The ORDER is part of the answer
//!
//! `UNION ALL` guarantees nothing about row order in either engine, and a report
//! whose rows move between runs cannot be diffed by a human or asserted by a
//! spec. The query orders by `check_name, entity, subject` — name first because
//! that is how a reader groups them, and the id last because it is the only part
//! that is arbitrary.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;

/// The severity a hard rule reports.
const VIOLATION: &str = "violation";

/// The command. It takes nothing, and the empty struct is the point — see the
/// module docs on why there is no owner.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VerifyIntegrity {}

/// One row of `v_integrity_violations`.
///
/// The field ORDER is the order the JSON carries, and specs assert against it;
/// `check` first because it is what a reader groups by.
#[derive(Debug, Serialize)]
pub struct Finding {
    /// `check_name` — the rule that fired, e.g. `balance_identity`.
    pub check: String,
    /// Which table [`Finding::id`] is a key of: `account`, `transaction`,
    /// `split_line` or `audit_entry`.
    pub entity: String,
    /// The subject's id, in that table.
    pub id: String,
    /// `violation` for a rule of the ledger, `warning` for a heuristic.
    pub severity: String,
    /// The sentence a person is shown.
    pub detail: String,
}

/// What the file says about itself.
#[derive(Debug, Serialize)]
pub struct IntegrityReport {
    /// True when nothing of severity `violation` fired. Warnings do not count —
    /// they are suspicions, and `v_integrity_ok` in `schema.sql` agrees.
    pub ok: bool,
    /// How many findings are rules.
    pub violations: i64,
    /// How many are suspicions.
    pub warnings: i64,
    /// Every finding, in `check_name, entity, subject` order.
    pub findings: Vec<Finding>,
}

/// The answer.
#[derive(Debug, Serialize)]
pub struct VerifyIntegrityResult {
    /// The projection the harness reads. `answer` rather than `transaction`
    /// because this verb returns no row of the ledger — the same shape the
    /// restore family uses.
    pub answer: IntegrityReport,
}

/// Check this file.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails. This verb has no
/// refusal: every file has an answer, and a file with nothing wrong with it
/// answers `ok`.
#[allow(clippy::needless_pass_by_value)]
pub fn verify_integrity(
    connection: &Connection,
    _command: VerifyIntegrity,
) -> CoreResult<VerifyIntegrityResult> {
    let mut statement = connection.prepare(
        "SELECT check_name, entity, subject, severity, detail
           FROM v_integrity_violations
          ORDER BY check_name, entity, subject",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(Finding {
            check: row.get(0)?,
            entity: row.get(1)?,
            id: row.get(2)?,
            severity: row.get(3)?,
            detail: row.get(4)?,
        })
    })?;

    let mut findings = Vec::new();
    for finding in rows {
        findings.push(finding?);
    }

    // Counted here rather than by a second query: two queries could see two
    // different files if anything wrote between them, and a report whose totals
    // disagree with its own list is worse than no report.
    let violations = super::count(
        findings
            .iter()
            .filter(|finding| finding.severity == VIOLATION)
            .count(),
    )?;
    let warnings = super::count(
        findings
            .iter()
            .filter(|finding| finding.severity != VIOLATION)
            .count(),
    )?;

    Ok(VerifyIntegrityResult {
        answer: IntegrityReport {
            ok: violations == 0,
            violations,
            warnings,
            findings,
        },
    })
}
