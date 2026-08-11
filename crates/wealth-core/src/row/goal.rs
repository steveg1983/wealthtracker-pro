//! A goal, as the app lists it — and, since slice 22, as an audit entry records
//! it.
//!
//! # The entity that arrived with no audit twin, and then got one
//!
//! Every other module under [`crate::row`] arrived because a verb had to write
//! an audit entry about that row. This one arrived because a verb had to ANSWER
//! with it, and it said so: *"no verb audits a goal: nothing in the cloud schema
//! writes `financial_audit_log` for one, `PlanningService` inserts, updates and
//! deletes `goals` directly, and the local edition ports the absence rather than
//! inventing a log the cloud does not keep."*
//!
//! **The first half of that is still true and the conclusion is now the other
//! way round.** It was written when this crate's only goal verb was a READ, so
//! "no verb audits a goal" was an observation rather than a decision. Slice 22
//! gave goals three writers, and the decision that governs them was taken before
//! any of this was built: PHASE1-PLAN §2.2 traced U-1 (*"every financial write
//! emits an audit row"*) against `planningService`, found it TRUE of accounts,
//! transactions and splits and FALSE of `budgets.amount`, `budgets.spent`,
//! `goals.target_amount` and `goals.current_amount`, and ruled that *"the local
//! edition fixes it. Budgets and goals are audited"* — because the reason U-1
//! exists is the compliance answer to "what changed that figure", and a goal's
//! target is a figure a person will ask that about.
//!
//! So there is still one type here and it is still the whole row — which is what
//! `.select('*')` returns, which is what `goalFromDb` is written against, and
//! which is also exactly what an entry's `before`/`after` need. A budget needed
//! two projections because its threshold is stored in one spelling and read in
//! another ([`crate::row::budget`] says why); a goal has no such column, so one
//! type serves both readers and there is nothing to keep in step.
//!
//! The divergence that follows is DECLARED rather than discovered: DESIGN.md §5
//! row 10, *"no audit row for a budget or a goal / one per write"*, and
//! [`crate::verbs::create_budget`] carries the argument in full.
//!
//! # The two fields that are not columns
//!
//! `goalFromDb` reads three of the app's `Goal` fields out of `metadata`
//! (`type`, `linkedAccountIds`, `contributionAmount`) because they never got
//! columns of their own, and it reads two more — `isActive` and `achieved` —
//! out of `status`. Neither is this crate's business: the column is carried
//! whole and the far side derives what it derives. A crate that unpacked
//! `metadata.type` into a field of its own would be deciding what the app's
//! goal *is*, which is DESIGN §6.3's other side of the line.
//!
//! `metadata` is `jsonb` in the cloud and TEXT-with-`json_valid` here, and money
//! is banned from it by CHECK in both — which is why `contributionAmount`
//! riding in it is a fact worth knowing and not one this module has to defend
//! against: an amount that reached `metadata` would have been refused at the
//! write.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;

/// The nineteen columns, in the order [`row_of`] reads them.
///
/// One string, because three readers use it and a fourth is one slice away: a
/// column added to one copy and not the others is read at the wrong index by the
/// ones that were not edited, which SQLite reports as a type error somewhere
/// unrelated or, worse, not at all.
const COLUMNS: &str = "id, user_id, name, description, target_amount_minor, current_amount_minor,
        target_date, category, priority, status, account_id,
        contribution_frequency, auto_contribute, icon, color, completed_at,
        metadata, created_at, updated_at";

/// A goal as stored, in the serialised order.
#[derive(Debug, Clone, Serialize)]
pub struct GoalRow {
    /// Primary key.
    pub id: String,
    /// Owner.
    pub user_id: String,
    /// As shown.
    pub name: String,
    /// Free text.
    pub description: Option<String>,
    /// What is being saved towards.
    pub target_amount: Money,
    /// What has been put by. The app calls this `progress` as well as
    /// `currentAmount`; they are one figure and this is it.
    pub current_amount: Money,
    /// `YYYY-MM-DD`, when there is a date.
    pub target_date: Option<String>,
    /// A category id as text, when the goal is filed under one.
    pub category: Option<String>,
    /// `low` | `medium` | `high`.
    pub priority: Option<String>,
    /// `active` | `completed` | `paused` | `canceled`. The app's `isActive` and
    /// `achieved` are both derived from this, on the far side.
    pub status: String,
    /// The account this goal counts.
    pub account_id: Option<String>,
    /// `daily` | `weekly` | … , when the goal contributes automatically.
    pub contribution_frequency: Option<String>,
    /// Does it?
    pub auto_contribute: bool,
    /// Display only.
    pub icon: Option<String>,
    /// Display only.
    pub color: Option<String>,
    /// When it was reached. Cleared if the goal is ever reopened.
    pub completed_at: Option<String>,
    /// Opaque labels, and the three app fields that never got columns. Money is
    /// banned from it by CHECK.
    pub metadata: serde_json::Value,
    /// When the row was made. The list's sort key.
    pub created_at: String,
    /// When it last changed.
    pub updated_at: String,
}

/// Every goal this login has, oldest first.
///
/// The port of `planningService.getGoals`: `.select('*')`, `.eq('user_id', …)`,
/// `.order('created_at', { ascending: true })`. Like the budgets read, there is
/// no `status` filter — a paused or completed goal stays in the list, or the
/// page could not show a person what they have finished.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_all(connection: &Connection, user_id: &str) -> CoreResult<Vec<GoalRow>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH goals USING INDEX idx_goals_user (user_id=?)
    //   USE TEMP B-TREE FOR ORDER BY
    let mut statement = connection.prepare(&format!(
        "SELECT {COLUMNS}
           FROM goals
          WHERE user_id = ?1
          ORDER BY created_at, id"
    ))?;
    let rows = statement.query_map(params![user_id], row_of)?;

    let mut goals = Vec::new();
    for goal in rows {
        goals.push(goal?);
    }
    Ok(goals)
}

/// Read one goal, scoped to an owner.
///
/// The `.eq('id', …).eq('user_id', …)` pair every one of `planningService`'s
/// goal writes carries, and `None` is the port of `.single()` finding nothing.
/// An absent owner applies no ownership clause — the decision
/// [`crate::verbs::update_transaction`] documents at length.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_owned(
    connection: &Connection,
    id: &str,
    user_id: Option<&str>,
) -> CoreResult<Option<GoalRow>> {
    Ok(connection
        .query_row(
            &format!(
                "SELECT {COLUMNS}
                   FROM goals
                  WHERE id = ?1
                    AND (?2 IS NULL OR user_id = ?2)"
            ),
            params![id, user_id],
            row_of,
        )
        .optional()?)
}

/// One record of that nineteen-column SELECT as a [`GoalRow`].
fn row_of(record: &rusqlite::Row<'_>) -> rusqlite::Result<GoalRow> {
    let metadata_text: String = record.get(16)?;
    Ok(GoalRow {
        id: record.get(0)?,
        user_id: record.get(1)?,
        name: record.get(2)?,
        description: record.get(3)?,
        target_amount: Money::from_minor(record.get(4)?),
        current_amount: Money::from_minor(record.get(5)?),
        target_date: record.get(6)?,
        category: record.get(7)?,
        priority: record.get(8)?,
        status: record.get(9)?,
        account_id: record.get(10)?,
        contribution_frequency: record.get(11)?,
        auto_contribute: record.get::<_, i64>(12)? != 0,
        icon: record.get(13)?,
        color: record.get(14)?,
        completed_at: record.get(15)?,
        metadata: serde_json::from_str(&metadata_text).unwrap_or(serde_json::Value::Null),
        created_at: record.get(17)?,
        updated_at: record.get(18)?,
    })
}
