//! `clear_forecast_adjustment` — a category goes back to following the base.
//!
//! The undo of [`super::set_forecast_adjustment`], and like a suggestion's
//! restore it is a real DELETE rather than a tombstone: an absent row IS the
//! state "no adjustment — the scenario reads the base average", so nothing
//! about the row needs remembering. Clearing a category that holds no
//! adjustment is a no-op, not an error — the caller asked for a state, and
//! the state is already so.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;

/// The command: whose adjustment, on which category.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClearForecastAdjustment {
    /// Owner.
    pub user_id: String,
    /// The category going back to the base.
    pub category_id: String,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct ClearForecastAdjustmentResult {
    /// 1 when an adjustment was removed, 0 when there was none to remove.
    pub removed: i64,
}

/// Remove one category's scenario figure, if it holds one.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the write fails.
#[allow(clippy::needless_pass_by_value)]
pub fn clear_forecast_adjustment(
    connection: &mut Connection,
    command: ClearForecastAdjustment,
) -> CoreResult<ClearForecastAdjustmentResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;

    let removed = transaction.execute(
        "DELETE FROM forecast_adjustments WHERE user_id = ?1 AND category_id = ?2",
        params![command.user_id, command.category_id],
    )?;

    transaction.commit()?;

    Ok(ClearForecastAdjustmentResult {
        // One row at most — the pair is UNIQUE — so the cast cannot wrap.
        removed: i64::try_from(removed).unwrap_or(i64::MAX),
    })
}
