//! `set_forecast_adjustment` — state, or restate, one category's scenario figure.
//!
//! # What it is a port of
//!
//! The cloud's upsert onto `forecast_adjustments` (`20260819150000`): one row
//! per (owner, category), `ON CONFLICT` replacing the monthly figure, because
//! the scenario is a single stated figure per category rather than a history
//! of edits — `updated_at` is the history's one honest remnant.
//!
//! # A judgment, not authored work — so it does not audit
//!
//! The line `wipe_user_financial_data` draws between `custom_reports`
//! (counted, audited — work the person WROTE) and the dismissals (uncounted,
//! unaudited — records of how the ledger is READ) puts adjustments with the
//! dismissals, and this verb keeps that company: no audit entry, exactly as
//! [`super::dismiss_suggestion`] writes none. Nothing here is money moving —
//! the figure is a scenario's input, and the scenario changes no register.
//!
//! # The FILE refuses the bad category, not this verb
//!
//! `category_id` is a foreign key in both engines, so an adjustment naming a
//! category that does not exist is refused by the schema — surfaced as the
//! same `constraint_violated` refusal every foreign key here produces — and
//! this verb holds no second copy of that rule. `monthly_minor >= 0` is the
//! same story: a CHECK, in both engines.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::row::forecast_adjustment::{self, ForecastAdjustmentRow};

/// The command: which category, and what its scenario month costs or brings.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetForecastAdjustment {
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// The category being adjusted. A foreign key — the file judges it.
    pub category_id: String,
    /// The scenario's monthly figure, in pennies. `>= 0` by CHECK.
    pub monthly_minor: i64,
    /// Client-minted, or minted here when absent — B-5, the dismissal's rule:
    /// the differential harness needs to name the same row on both engines.
    /// Ignored when the pair already holds a row (the upsert keeps its id).
    #[serde(default)]
    pub id: Option<String>,
}

/// What the verb hands back: the row as storage now holds it.
#[derive(Debug, Serialize)]
pub struct SetForecastAdjustmentResult {
    /// The adjustment, read back rather than reconstructed.
    pub answer: ForecastAdjustmentRow,
}

/// State one category's scenario figure, replacing any earlier statement.
///
/// # Errors
/// [`CoreError::Refused`] for a rule the file enforced — the category or
/// users foreign key, or `monthly_minor >= 0`;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn set_forecast_adjustment(
    connection: &mut Connection,
    command: SetForecastAdjustment,
) -> CoreResult<SetForecastAdjustmentResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let id = super::minted_uuid(command.id.as_deref());

    transaction.execute(
        "INSERT INTO forecast_adjustments (
           id, user_id, category_id, monthly_minor, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT (user_id, category_id) DO UPDATE SET
           monthly_minor = excluded.monthly_minor,
           updated_at    = excluded.updated_at",
        params![id, command.user_id, command.category_id, command.monthly_minor, now],
    )?;

    // Read back, so the answer is what storage holds — including the ORIGINAL
    // id and created_at when the upsert landed on an existing row.
    let stored =
        forecast_adjustment::read_for_category(&transaction, &command.user_id, &command.category_id)?
            .ok_or_else(|| {
                CoreError::refuse(
                    "forecast_adjustment_not_found",
                    "the adjustment disappeared between writing it and reading it back",
                )
            })?;

    transaction.commit()?;

    Ok(SetForecastAdjustmentResult { answer: stored })
}
