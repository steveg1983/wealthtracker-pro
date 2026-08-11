//! `delete_goal` — one goal, the contributions the key takes with it, and the
//! trophy nobody here touches.
//!
//! # What it is a port OF
//!
//! `planningService.deleteGoal` (`:379-390`), whose whole body is:
//!
//! ```text
//! .from('goals').delete().eq('id', id).eq('user_id', userId)
//! ```
//!
//! No RPC; PHASE3-PLAN D-2. An id naming nothing is a successful nothing, for the
//! reason [`super::delete_budget`] sets out at length — there is no `.single()`
//! on that query, and the seam asks for idempotence by name.
//!
//! # THE CONTRIBUTIONS GO WITH IT, AND THE KEY IS WHAT TAKES THEM
//!
//! `goal_contributions.goal_id` is `ON DELETE CASCADE` in BOTH schemas
//! (`20251030003814:1780`; `schema.sql:1229`), so deleting a goal deletes the
//! record of money put towards it, and this verb does not walk them.
//!
//! **That is the opposite decision to [`super::delete_category`]'s**, which walks
//! its subtree deepest-first rather than letting `parent_id`'s cascade take the
//! children, so three things had to be checked before copying neither:
//!
//! * **the count.** The category delete walks because its cascade removes rows OF
//!   THE SAME KIND — a `deleted: 1` for a group of three would be a lie about the
//!   thing the verb is named after. A contribution is a different entity, and
//!   folding one into `deleted` would make the number mean two things at once.
//! * **the audit.** It walks so every removed category gets an entry, because a
//!   category is the start of a chain (every transaction filed under it holds its
//!   id) and `merge_categories` already audits the other end of that life. A
//!   contribution has no writer, no reader and no row module in this crate:
//!   nothing in the app has ever created one outside a restore. An entry for it
//!   would be a record of a row the ledger cannot otherwise produce, and the
//!   compliance question — *what happened to that goal* — is answered whole by
//!   the goal's own entry, which carries the row it was.
//! * **the refusal.** It walks so C-5's protection is reached directly rather
//!   than through a cascade. Nothing protects a contribution.
//!
//! So the cascade is the CLOUD's behaviour and it is left as the file's job. What
//! that costs is one thing this verb must not assume: `PRAGMA foreign_keys` is
//! ON, asserted at [`crate::db::configure`] by reading it back, and a spec
//! measures the contributions actually leaving rather than trusting the
//! declaration — `goal-delete-a-goals-contributions-go-with-it`, on both engines.
//!
//! # WHAT IT DOES NOT DO
//!
//! It does not forget the goal's trophy. The seam is explicit: *"the achievement
//! record kept beside the ledger … belongs to the caller that owns the
//! celebration, and it stays there deliberately: a store is not the place to put
//! the rule about what a completed goal feels like."*
//!
//! # It audits — DIVERGENCE 10
//!
//! One `goal/delete` entry with a `before` and no `after`, read whole before the
//! delete. [`super::create_budget`] carries the argument.
//!
//! # No guard, measured
//!
//! A DELETE from `goals`. The cascade reaches `goal_contributions`, which has no
//! trigger and no children of its own; `trg_unnest_account_references` is `BEFORE
//! DELETE ON accounts`, not on this table. `tests/planning_writes.rs` asserts the
//! guard table empty across a delete.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::CoreResult;
use crate::row::goal;

use super::DeleteAnswer;

/// The command. The two arguments the client's `.delete().eq().eq()` carries.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteGoal {
    /// Which goal.
    pub id: String,
    /// Whose. Absent names no owner — see [`super::update_transaction`].
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct DeleteGoalResult {
    /// The count, in the object shape the harness compares a verb on.
    pub answer: DeleteAnswer,
}

/// Remove one goal.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] for a fault. There is no refusal: an id
/// naming nothing is a successful nothing.
#[allow(clippy::needless_pass_by_value)]
pub fn delete_goal(
    connection: &mut Connection,
    command: DeleteGoal,
) -> CoreResult<DeleteGoalResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let owner = command.user_id.as_deref();

    let Some(before) = goal::read_owned(&write, &command.id, owner)? else {
        write.commit()?;
        return Ok(DeleteGoalResult {
            answer: DeleteAnswer { deleted: 0 },
        });
    };

    let now = db::now(&write)?;
    let removed = write.execute(
        "DELETE FROM goals WHERE id = ?1 AND (?2 IS NULL OR user_id = ?2)",
        params![command.id, owner],
    )?;

    if removed > 0 {
        audit::write(
            &write,
            &before.user_id,
            "goal",
            &command.id,
            Action::Delete,
            Some(&super::json_of(&before)?),
            None,
            &now,
        )?;
    }

    write.commit()?;

    Ok(DeleteGoalResult {
        answer: DeleteAnswer {
            deleted: super::count(removed)?,
        },
    })
}
