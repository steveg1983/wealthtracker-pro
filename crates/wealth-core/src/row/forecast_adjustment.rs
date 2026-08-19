//! `forecast_adjustments` — the scenario's stated deviations from the base.
//!
//! One row per category the user has ADJUSTED in the forecast scenario
//! (`20260819150000` in the cloud, the same table here): the monthly figure
//! the scenario uses in place of the twelve-month base average. Holds no
//! ledger data and changes no figure — the scenario READS the base and lays
//! these on top, and Budget is only ever written by the explicit stage-2
//! promotion, which does not exist yet.
//!
//! # Why relational, not a document
//!
//! The backup format's reason, measured rather than tasted: `remapBackupIds`
//! rewrites uuid COLUMNS, id arrays and named arrays inside a jsonb value —
//! never the KEYS of a jsonb object. A document keyed by category ids would
//! restore verbatim into a login whose categories carry fresh ids and
//! silently adjust nothing. As a column the reference remaps, dangles
//! loudly, and `ON DELETE CASCADE` takes an adjustment away with its
//! category — a judgment about a category that no longer exists judges
//! nothing.
//!
//! # `monthly_minor` is pennies, in both engines
//!
//! A `bigint` there and an `INTEGER` here — the one representation of money
//! the two engines hold identically, so this figure crosses the seam without
//! a scale conversion anywhere. A magnitude: the category's own
//! income/expense type says which side it lands on.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::CoreResult;

/// The column list every read here selects, in the order `row_of` reads it.
const COLUMNS: &str = "id, user_id, category_id, monthly_minor, created_at, updated_at";

/// One adjustment, exactly as the table holds it.
#[derive(Debug, Clone, Serialize)]
pub struct ForecastAdjustmentRow {
    /// Primary key. Client-minted or verb-minted — B-5, like every id here.
    pub id: String,
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// The category whose monthly figure the scenario overrides. CASCADEs.
    pub category_id: String,
    /// The scenario's monthly figure for that category, in pennies.
    pub monthly_minor: i64,
    /// When the adjustment was first stated.
    pub created_at: String,
    /// When it last changed — the one honest remnant of its edit history.
    pub updated_at: String,
}

fn row_of(row: &rusqlite::Row<'_>) -> rusqlite::Result<ForecastAdjustmentRow> {
    Ok(ForecastAdjustmentRow {
        id: row.get(0)?,
        user_id: row.get(1)?,
        category_id: row.get(2)?,
        monthly_minor: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

/// Every adjustment this login has stated, oldest first.
///
/// `created_at, id` — the crate's own list order and its stated tie-break
/// (see [`crate::verbs::reads`]), not that it shows: the page draws these
/// into a map keyed by category, so the order is for determinism rather than
/// for a reader.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
pub fn list_all(
    connection: &Connection,
    user_id: &str,
) -> CoreResult<Vec<ForecastAdjustmentRow>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {COLUMNS}
           FROM forecast_adjustments
          WHERE user_id = ?1
          ORDER BY created_at, id"
    ))?;
    let rows = statement.query_map(params![user_id], row_of)?;

    let mut adjustments = Vec::new();
    for adjustment in rows {
        adjustments.push(adjustment?);
    }
    Ok(adjustments)
}

/// The adjustment one (owner, category) pair holds, if any — the read-back
/// the upsert answers with, so the caller sees what storage holds rather
/// than what the verb intended.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
pub fn read_for_category(
    connection: &Connection,
    user_id: &str,
    category_id: &str,
) -> CoreResult<Option<ForecastAdjustmentRow>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {COLUMNS}
           FROM forecast_adjustments
          WHERE user_id = ?1 AND category_id = ?2"
    ))?;
    let mut rows = statement.query_map(params![user_id, category_id], row_of)?;
    rows.next().transpose().map_err(Into::into)
}
