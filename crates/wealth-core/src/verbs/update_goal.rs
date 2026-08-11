//! `update_goal` — the port of a PostgREST `UPDATE`, of the `.single()` on the
//! end of it, and of the read-modify-write in front of it that keeps three
//! fields from deleting each other.
//!
//! # What it is a port OF
//!
//! `planningService.updateGoal` (`:342-377`): a conditional `select('metadata')`
//! and then
//!
//! ```text
//! .from('goals').update(goalToDb(updates, undefined, existingMetadata))
//!   .eq('id', id).eq('user_id', userId).select().single()
//! ```
//!
//! No RPC. PHASE3-PLAN D-2; [`super::create_goal`] carries the family's argument.
//!
//! # THIS IS ALSO THE CONTRIBUTION PATH, AND IT SETS RATHER THAN ADDS
//!
//! Contract rule 50, and the seam states it as an instruction to implementers
//! because getting it wrong is invisible until a bar draws past its own end:
//! *"putting money towards a goal arrives here as an ordinary update carrying the
//! new `progress`. That figure has ALREADY been added up and capped against the
//! target by the caller, so this operation SETS what it is given and never adds
//! to what is stored. An implementation that treated the field as an increment
//! would push a goal past its own target."*
//!
//! There is nothing to do about that here and that is the point: the UPDATE below
//! is `current_amount_minor = ?`, never `current_amount_minor + ?`. It is stated
//! anyway because this crate's balance verbs are all `balance = balance ± delta`
//! (B-2 forbids an absolute setter for an ACCOUNT), and a reader who has just
//! come from those has every reason to expect the same shape here. A goal's
//! progress is not a ledger balance: no transaction justifies it, nothing derives
//! it, and the seam says the caller has already done the arithmetic.
//!
//! # ONE presence rule, and it is `goalToDb`'s
//!
//! `undefined` is dropped, anything else — `null` included — is sent, so every
//! field is the `p ? 'k'` class [`super::update_account`] describes. Where the
//! column is `NOT NULL` (`name`, `target_amount`, `current_amount`, `status`,
//! `auto_contribute`, `metadata`) a stated null is refused by the file, on both
//! engines.
//!
//! # `metadata` IS MERGED, NEVER REBUILT — AND THAT WAS A BUG WITH A DATE ON IT
//!
//! Three unrelated app fields share one `jsonb` column (`type`,
//! `linkedAccountIds`, `contributionAmount`), and until 2026-08 the cloud's
//! mapper rebuilt the object from whatever the update happened to mention. The
//! consequence is recorded in `planningService.ts` in one sentence: *"Editing a
//! goal's type deleted its linked accounts."*
//!
//! The fix there is a second round trip — read the stored blob, spread the update
//! over it — taken *"only [for] the updates that actually touch metadata"*. Here
//! it is free: the row is already read, inside the same transaction, because the
//! audit entry's `before` needs it. So the merge is `{...stored, ...stated}`,
//! done in Rust over `serde_json::Map`, which is the same SHALLOW spread the
//! mapper does.
//!
//! Shallow, deliberately, and not `json_patch()`: SQLite's is RFC 7396, which
//! merges nested objects recursively and DELETES a key whose value is null. The
//! cloud's spread replaces a nested object wholesale and stores the null. Neither
//! difference is reachable through today's three fields, and a second merge
//! semantic that agrees by accident is exactly what
//! `mappers/columns.ts` calls *"two conversions that are each wrong in the same
//! way"*.
//!
//! # `completed_at` STILL FOLLOWS `status`
//!
//! [`super::create_goal::resolve_completion`], reused, with one extra branch the
//! create cannot reach: an update that states NO status leaves the column alone
//! unless it states `completed_at` itself, which is the mapper's `else if`. So
//! reopening a completed goal clears its date in the same statement that reopens
//! it, and the two can never disagree.
//!
//! # A GOAL THAT IS NOT THERE IS REFUSED
//!
//! `.single()` again, and [`super::delete_goal`] again does not have it. The seam:
//! *"A goal that is not there is refused BY NAME rather than created, and the
//! refusal leaves the store exactly as it was"* — which the read-before-write
//! makes structural rather than careful.
//!
//! # It audits — DIVERGENCE 10
//!
//! One `goal/update` entry, `before` and `after`. See [`super::create_budget`].
//!
//! # No guard, measured
//!
//! An UPDATE of `goals`. No trigger on that table locally; the cloud's
//! `update_goals_updated_at` is why this verb writes `updated_at` itself.
//! `tests/planning_writes.rs` asserts the guard table empty across an edit.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;
use crate::row::goal::{self, GoalRow};
use crate::wire::{null_if_empty, Field, Flag};

use super::create_account::resolve_flag_field;
use super::create_goal::{not_found, resolve_completion, NOT_FOUND};

/// The command.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateGoal {
    /// Which goal.
    pub id: String,
    /// Whose. Absent means "name no owner" — see [`super::update_transaction`].
    #[serde(default)]
    pub user_id: Option<String>,
    /// The fields to change.
    #[serde(default)]
    pub patch: GoalPatch,
}

/// The settable columns, each in the three states `jsonb` can present.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GoalPatch {
    /// As shown.
    #[serde(default)]
    pub name: Field<String>,
    /// Free text.
    #[serde(default)]
    pub description: Field<String>,
    /// What is being saved towards.
    #[serde(default)]
    pub target_amount: Field<Money>,
    /// What has been put by. SET, never added to — see the module docs.
    #[serde(default)]
    pub current_amount: Field<Money>,
    /// `YYYY-MM-DD`.
    #[serde(default)]
    pub target_date: Field<String>,
    /// A category id as text.
    #[serde(default)]
    pub category: Field<String>,
    /// `low` | `medium` | `high`.
    #[serde(default)]
    pub priority: Field<String>,
    /// `active` | `completed` | `paused` | `canceled`. Drags `completed_at` with
    /// it.
    #[serde(default)]
    pub status: Field<String>,
    /// When it was reached. Only honoured on its own when no status is stated.
    #[serde(default)]
    pub completed_at: Field<String>,
    /// The account this goal counts. `''` clears it.
    #[serde(default)]
    pub account_id: Field<String>,
    /// `daily` | `weekly` | … . `''` clears it.
    #[serde(default)]
    pub contribution_frequency: Field<String>,
    /// Does it contribute automatically?
    #[serde(default)]
    pub auto_contribute: Field<Flag>,
    /// Display only.
    #[serde(default)]
    pub icon: Field<String>,
    /// Display only.
    #[serde(default)]
    pub color: Field<String>,
    /// The three app fields with no columns. MERGED over what is stored.
    #[serde(default)]
    pub metadata: Field<serde_json::Value>,
}

/// What the verb hands back: the row as it now stands, and the audit entry.
#[derive(Debug, Serialize)]
pub struct UpdateGoalResult {
    /// The goal as stored after the edit — the whole row, so the caller can
    /// replace its copy with the answer.
    pub answer: GoalRow,
    /// Dense sequence number of the audit row written for this update.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Edit one goal and audit it — one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for `goal_not_found`, `boolean_invalid`, or a rule the
/// file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn update_goal(connection: &mut Connection, command: UpdateGoal) -> CoreResult<UpdateGoalResult> {
    let auto_contribute = resolve_flag_field(&command.patch.auto_contribute, "auto_contribute")?;

    // BEGIN IMMEDIATE: the write lock up front, so the read-then-update below is
    // the cloud's `SELECT … FOR UPDATE` without the lock it has nothing to add —
    // and here it is what makes the metadata merge safe as well as the edit.
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let owner = command.user_id.as_deref();
    let Some(before) = goal::read_owned(&transaction, &command.id, owner)? else {
        return Err(not_found());
    };

    let completion = completion_for(&command.patch, &before.status, &now);
    let metadata = merged_metadata(&command.patch, &before);
    let changed = apply(
        &transaction,
        &command,
        auto_contribute,
        &completion,
        metadata.as_deref(),
        &now,
    )?;
    // Unreachable, and named rather than silent: see [`super::update_budget`].
    if changed != 1 {
        return Err(CoreError::refuse(
            NOT_FOUND,
            "the goal disappeared between finding it and editing it",
        ));
    }

    let after = super::create_goal::read_back(&transaction, &command.id, &before.user_id)?;

    let entry = audit::write(
        &transaction,
        &before.user_id,
        "goal",
        &command.id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(UpdateGoalResult {
        answer: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// What `completed_at` becomes, in the mapper's three cases.
///
/// `None` means the column is not mentioned at all — the `ELSE completed_at` arm
/// of the statement below.
struct Completion {
    /// Is the column written?
    stated: bool,
    /// To what, when it is.
    value: Option<String>,
}

fn completion_for(patch: &GoalPatch, stored_status: &str, now: &str) -> Completion {
    if patch.status.is_present() {
        // A stated null status is refused by the column; resolving it against
        // the STORED status here would put a date on a row the file is about to
        // reject anyway, so the falls-through case is the stored one and the
        // refusal still happens where it belongs.
        let status = patch.status.value().map_or(stored_status, String::as_str);
        return Completion {
            stated: true,
            value: resolve_completion(status, patch.completed_at.value().map(String::as_str), now),
        };
    }
    if patch.completed_at.is_present() {
        return Completion {
            stated: true,
            value: patch.completed_at.value().map(ToOwned::to_owned),
        };
    }
    Completion {
        stated: false,
        value: None,
    }
}

/// `{...stored, ...stated}` as TEXT, or `None` when the patch says nothing about
/// metadata.
///
/// A stated null is not a merge: the column is `NOT NULL` on both engines, so it
/// travels as a null and the file refuses it, which is what the cloud does too.
fn merged_metadata(patch: &GoalPatch, before: &GoalRow) -> Option<String> {
    let stated = patch.metadata.value()?;
    let mut merged = match &before.metadata {
        serde_json::Value::Object(stored) => stored.clone(),
        _ => serde_json::Map::new(),
    };
    if let serde_json::Value::Object(incoming) = stated {
        for (key, value) in incoming {
            merged.insert(key.clone(), value.clone());
        }
    } else {
        // Not an object: stored as it stands, exactly as a spread of a
        // non-object would be. `json_valid` is what judges it.
        return Some(stated.to_string());
    }
    Some(serde_json::Value::Object(merged).to_string())
}

/// The single UPDATE, column for column against `goalToDb`'s output.
///
/// One statement rather than a SET list assembled in Rust — see
/// [`super::update_transaction`] for the two reasons.
fn apply(
    transaction: &rusqlite::Transaction<'_>,
    command: &UpdateGoal,
    auto_contribute: Option<bool>,
    completion: &Completion,
    metadata: Option<&str>,
    now: &str,
) -> CoreResult<usize> {
    let patch = &command.patch;
    // `|| null` on the two link columns, applied to the STATED value only: an
    // absent key is still absence, and a stated `null` is still null.
    let account_id = patch
        .account_id
        .value()
        .and_then(|value| null_if_empty(Some(value)));
    let contribution_frequency = patch
        .contribution_frequency
        .value()
        .and_then(|value| null_if_empty(Some(value)));

    Ok(transaction.execute(
        "UPDATE goals SET
           name                   = CASE WHEN ?1  THEN ?2  ELSE name END,
           description            = CASE WHEN ?3  THEN ?4  ELSE description END,
           target_amount_minor    = CASE WHEN ?5  THEN ?6  ELSE target_amount_minor END,
           current_amount_minor   = CASE WHEN ?7  THEN ?8  ELSE current_amount_minor END,
           target_date            = CASE WHEN ?9  THEN ?10 ELSE target_date END,
           category               = CASE WHEN ?11 THEN ?12 ELSE category END,
           priority               = CASE WHEN ?13 THEN ?14 ELSE priority END,
           status                 = CASE WHEN ?15 THEN ?16 ELSE status END,
           completed_at           = CASE WHEN ?17 THEN ?18 ELSE completed_at END,
           account_id             = CASE WHEN ?19 THEN ?20 ELSE account_id END,
           contribution_frequency = CASE WHEN ?21 THEN ?22 ELSE contribution_frequency END,
           auto_contribute        = CASE WHEN ?23 THEN ?24 ELSE auto_contribute END,
           icon                   = CASE WHEN ?25 THEN ?26 ELSE icon END,
           color                  = CASE WHEN ?27 THEN ?28 ELSE color END,
           metadata               = CASE WHEN ?29 THEN ?30 ELSE metadata END,
           updated_at             = ?31
         WHERE id = ?32",
        params![
            patch.name.is_present(),
            patch.name.value(),
            patch.description.is_present(),
            patch.description.value(),
            patch.target_amount.is_present(),
            patch.target_amount.value().map(|money| money.minor()),
            patch.current_amount.is_present(),
            patch.current_amount.value().map(|money| money.minor()),
            patch.target_date.is_present(),
            null_if_empty(patch.target_date.value().map(String::as_str)),
            patch.category.is_present(),
            patch.category.value(),
            patch.priority.is_present(),
            patch.priority.value(),
            patch.status.is_present(),
            patch.status.value(),
            completion.stated,
            completion.value,
            patch.account_id.is_present(),
            account_id,
            patch.contribution_frequency.is_present(),
            contribution_frequency,
            patch.auto_contribute.is_present(),
            auto_contribute.map(i64::from),
            patch.icon.is_present(),
            patch.icon.value(),
            patch.color.is_present(),
            patch.color.value(),
            patch.metadata.is_present(),
            metadata,
            now,
            command.id,
        ],
    )?)
}
