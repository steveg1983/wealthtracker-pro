//! `create_goal` — a plan for money, and the figure it is allowed to start at.
//!
//! # What it is a port OF
//!
//! `planningService.createGoal` (`:323-340`):
//!
//! ```text
//! const startingAmount = goal.currentAmount ?? 0;
//! const row = goalToDb({ ...goal, progress: startingAmount }, userId);
//! .from('goals').insert(row).select().single()
//! ```
//!
//! No RPC. `goals` is one of the tables the cloud writes DIRECTLY over PostgREST
//! — PHASE3-PLAN D-2, argued in full at the head of [`super`].
//!
//! # A GOAL STARTS AT THE MONEY ALREADY PUT BY
//!
//! Those first two lines are the whole of contract rule 49, and they are worth
//! reading slowly because the version that got them wrong was in production.
//!
//! `progress` and `currentAmount` are ONE quantity with two names — the column is
//! `current_amount` and `goalFromDb` answers both fields from it — and the seam
//! is explicit that a goal's opening figure is not like a budget's `spent`: *"a
//! budget's `spent` is summed from the ledger and can never be the caller's to
//! state; a goal's progress is a figure nobody else knows — money already set
//! aside before the goal was written down. So it is not absent, it is DERIVED
//! FROM `currentAmount`, and a goal created saying £250 is already put by starts
//! at £250 rather than at zero."*
//!
//! The version that hard-coded zero *"did not merely round down — it lost the
//! opening figure DIFFERENTLY in each engine, banking it in one and discarding it
//! in the other"* (contract.ts, rule 49), which is exactly the class of
//! difference the seam exists to catch.
//!
//! **Where the rule lives here, and why.** `goalToDb`'s own precedence is
//! `progress ?? currentAmount`, and `createGoal` sets `progress` from
//! `currentAmount ?? 0` before calling it — so by the time a row reaches the
//! table there is ONE key, `current_amount`, and both app fields have collapsed
//! into it. That collapse is app-field assembly and it lives in
//! `mappers/writes.ts` beside the account create's `openingBalance || balance ||
//! 0`, which folds two app fields into one column for the same reason. What lives
//! HERE is the column: `current_amount` unstated means the column's own default,
//! which is `0` in both engines — so "a goal set for something not yet saved for
//! begins at zero" is the DEFAULT rather than a literal this verb writes, and
//! there is no branch anywhere that could hard-code a zero over a stated figure.
//!
//! # `completed_at` FOLLOWS `status`, ALWAYS
//!
//! `goalToDb`'s last unusual line, and this one IS here rather than in the
//! mapper, because it involves the clock and the clock is the file's:
//!
//! ```text
//! if (row.status !== undefined) {
//!   if (row.status === 'completed') row.completed_at = g.completedAt ?? new Date().toISOString();
//!   else                            row.completed_at = null;
//! } else if (g.completedAt !== undefined) {
//!   row.completed_at = g.completedAt;
//! }
//! ```
//!
//! The rule the mapper's own comment states is *"the achievement date follows the
//! status, always: stamped when a goal completes, cleared if it is ever reopened,
//! so the two can never disagree"*. A `completed_at` on an active goal is a
//! contradiction the goals page would render as a finished goal that is not
//! finished, and the cloud has no constraint stopping one — this is where both
//! engines are stopped from writing one.
//!
//! # THE FALSY PAIR, AGAIN
//!
//! `row.account_id = g.accountId || null` and `row.contribution_frequency =
//! g.contributionFrequency || null`. **Falsy, not nullish** — an empty string
//! becomes SQL NULL rather than being stored — which is the same surprise
//! [`super::create_category`] reproduces for `parent_id`, and for the same
//! reason: `''` in `account_id` is a goal pointing at an account that cannot
//! exist. Reproduced with [`crate::wire::null_if_empty`].
//!
//! `account_id` has a second rule here that the cloud gained in the same
//! migration this file's key is a twin of: `FOREIGN KEY (account_id, user_id)
//! REFERENCES accounts(id, user_id)`, R-12 — a goal cannot count a stranger's
//! account on either engine.
//!
//! # `metadata` CARRIES THREE APP FIELDS AND NO COLUMN OF THEIR OWN
//!
//! `type`, `linkedAccountIds` and `contributionAmount` never got columns, so
//! `goalToDb` puts them in the `jsonb` blob — merged over whatever is stored,
//! never rebuilt, which is [`super::update_goal`]'s problem rather than this
//! one's (a create has nothing to merge over). The blob crosses the wire as an
//! object and is stored as it arrives.
//!
//! **`contributionAmount` is money living in a blob, on both engines**, and it is
//! named here rather than discovered later: DESIGN.md §5 divergence 9 is exactly
//! this shape, and the CHECK that bans it (`transactions_no_money_in_metadata`)
//! covers `transactions` alone. Nothing in the app writes the field today —
//! `GoalModal` sets `linkedAccountIds` and never this — so what the port carries
//! is a field of the app's type with no writer. The day it gets one it wants a
//! column, in both schemas, and not a wider CHECK.
//!
//! # It audits — DIVERGENCE 10
//!
//! One `goal/create` entry, chained, in the same transaction; the cloud writes
//! none. [`super::create_budget`] carries the argument in full, including
//! PHASE1-PLAN §2.2, which named `goals.target_amount` and `goals.current_amount`
//! as two of the four figures U-1 was false of.
//!
//! # No guard, measured
//!
//! An INSERT into `goals`. `schema.sql` has no trigger on that table (the cloud's
//! `update_goals_updated_at` is `BEFORE UPDATE` and has no local twin, which is
//! why the verbs write `updated_at` themselves), and
//! `trg_unnest_account_references` — the one trigger that touches this table — is
//! `BEFORE DELETE ON accounts`. `tests/planning_writes.rs` asserts the guard table
//! empty across a create.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::goal::{self, GoalRow};
use crate::wire::{null_if_empty, Flag};

/// The status a goal is born with when the caller states none — the column's own
/// default, on both engines, written out because [`resolve_completion`] has to
/// know what the status WILL be to decide the date beside it.
const DEFAULT_STATUS: &str = "active";

/// The status that stamps a completion date.
pub(super) const COMPLETED: &str = "completed";

/// One goal as `goalToDb` sends it, plus the owner.
///
/// Every column that mapper can produce and not one more: it is a WHITELIST, so
/// a key it has no line for never reaches the cloud's table either.
/// `deny_unknown_fields` is this crate's usual strengthening and here it is also
/// parity — `mappers/writes.ts` filters the same way and says so.
///
/// `progress`, `isActive` and `achieved` are NOT here, and their absence is the
/// point: each is an app field that collapses into a column before the payload
/// exists (`current_amount` and `status`), and a verb that accepted both spellings
/// would be a verb that can be told two different things about one column.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GoalDraft {
    /// Client-minted, or minted here when absent — B-5.
    #[serde(default)]
    pub id: Option<String>,
    /// As shown. `NOT NULL` in both engines with no default, so an absent one is
    /// refused by the TABLE — which is where the cloud refuses it too.
    #[serde(default)]
    pub name: Option<String>,
    /// Free text.
    #[serde(default)]
    pub description: Option<String>,
    /// What is being saved towards. `NOT NULL`, no default.
    #[serde(default)]
    pub target_amount: Option<Money>,
    /// What has already been put by. Defaults to the column's zero — see the
    /// module docs, which is where rule 49 lives.
    #[serde(default)]
    pub current_amount: Option<Money>,
    /// `YYYY-MM-DD`. A goal with no date has no deadline.
    #[serde(default)]
    pub target_date: Option<String>,
    /// A category id as text.
    #[serde(default)]
    pub category: Option<String>,
    /// `low` | `medium` | `high`, enumerated by CHECK in both engines.
    #[serde(default)]
    pub priority: Option<String>,
    /// `active` | `completed` | `paused` | `canceled`. Defaults to 'active'.
    #[serde(default)]
    pub status: Option<String>,
    /// When it was reached. Follows `status` — see the module docs.
    #[serde(default)]
    pub completed_at: Option<String>,
    /// The account this goal counts. `|| null`, and R-12 says it must be this
    /// owner's.
    #[serde(default)]
    pub account_id: Option<String>,
    /// `daily` | `weekly` | … , when the goal contributes automatically.
    /// `|| null`.
    #[serde(default)]
    pub contribution_frequency: Option<String>,
    /// Does it? Defaults false.
    #[serde(default)]
    pub auto_contribute: Option<Flag>,
    /// Display only.
    #[serde(default)]
    pub icon: Option<String>,
    /// Display only.
    #[serde(default)]
    pub color: Option<String>,
    /// The three app fields that never got columns. Defaults to the column's
    /// `'{}'`.
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

/// The command: one goal, and whose.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateGoal {
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// The goal, flattened into the command so the payload is the object
    /// `goalToDb` produces plus the owner — which is what the cloud's insert row
    /// literally is.
    #[serde(flatten)]
    pub goal: GoalDraft,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct CreateGoalResult {
    /// The goal as stored — the same projection `list_goals` answers with, so a
    /// caller can put it straight into state without re-reading.
    pub answer: GoalRow,
    /// Dense sequence number of the audit row written for this create.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Store one goal and audit it — one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for `boolean_invalid` or a rule the file enforced —
/// `goals_status_check`, `goals_priority_check`,
/// `goals_contribution_frequency_check`, `goals_money_bounded`, the target-date
/// shape, the accounts or users foreign key, a `NOT NULL` column nobody filled
/// in; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn create_goal(connection: &mut Connection, command: CreateGoal) -> CoreResult<CreateGoalResult> {
    // Everything that can refuse without touching the file, before the file is
    // touched.
    let auto_contribute = super::create_account::resolve_flag(
        command.goal.auto_contribute.as_ref(),
        false,
        "auto_contribute",
    )?;

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let id = super::minted_uuid(command.goal.id.as_deref());
    // An unstated status is the column's default, and `completed_at` has to
    // follow whatever the status WILL be — so the default is named rather than
    // left to the column, and then written out with it.
    let status = command
        .goal
        .status
        .as_deref()
        .unwrap_or(DEFAULT_STATUS)
        .to_owned();
    let completed_at = resolve_completion(&status, command.goal.completed_at.as_deref(), &now);

    transaction.execute(
        "INSERT INTO goals (
           id, user_id, name, description, target_amount_minor, current_amount_minor,
           target_date, category, priority, status, account_id,
           contribution_frequency, auto_contribute, icon, color, completed_at,
           metadata, created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, COALESCE(?6, 0),
           ?7, ?8, ?9, ?10, ?11,
           ?12, ?13, ?14, ?15, ?16,
           COALESCE(?17, '{}'), ?18, ?18
         )",
        params![
            id,
            command.user_id,
            command.goal.name,
            command.goal.description,
            command.goal.target_amount.map(Money::minor),
            command.goal.current_amount.map(Money::minor),
            null_if_empty(command.goal.target_date.as_deref()),
            command.goal.category,
            command.goal.priority,
            status,
            null_if_empty(command.goal.account_id.as_deref()),
            null_if_empty(command.goal.contribution_frequency.as_deref()),
            i64::from(auto_contribute),
            command.goal.icon,
            command.goal.color,
            completed_at,
            command.goal.metadata.as_ref().map(ToString::to_string),
            now,
        ],
    )?;

    // Read back rather than reconstructed, for the reason `create_transaction`
    // states about `to_jsonb(v_tx)`: the audit's `after` and the caller's answer
    // must be what storage holds, defaults and CHECKs and all.
    let stored = read_back(&transaction, &id, &command.user_id)?;
    let entry = audit::write(
        &transaction,
        &command.user_id,
        "goal",
        &id,
        Action::Create,
        None,
        Some(&super::json_of(&stored)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(CreateGoalResult {
        answer: stored,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The stored goal, or the refusal for a row that vanished between writing it
/// and reading it back — unreachable, and named rather than unwrapped.
pub(super) fn read_back(
    transaction: &rusqlite::Transaction<'_>,
    id: &str,
    user_id: &str,
) -> CoreResult<GoalRow> {
    goal::read_owned(transaction, id, Some(user_id))?.ok_or_else(|| {
        CoreError::refuse(
            NOT_FOUND,
            "the goal disappeared between writing it and reading it back",
        )
    })
}

/// The code every goal verb refuses a missing row under.
pub(super) const NOT_FOUND: &str = "goal_not_found";

/// The prose a person reads when one does. `DataServiceImpl.updateGoal`'s own
/// sentence — see [`super::create_budget::NOT_FOUND_MESSAGE`] for why the words
/// come from there rather than from a Postgres function.
pub(super) const NOT_FOUND_MESSAGE: &str = "Goal not found";

/// The refusal itself, so three verbs cannot word it three ways.
pub(super) fn not_found() -> CoreError {
    CoreError::Refused(Refusal::named(NOT_FOUND, NOT_FOUND_MESSAGE).with_hint(
        "That goal no longer exists, or is not yours. Reload the goals and try again.",
    ))
}

/// `completed_at` for a goal that is about to hold `status`.
///
/// The mapper's rule, in one place for both writers: completed stamps the date
/// the caller gave or NOW, and anything else clears it. See the module docs for
/// why the two can never be allowed to disagree.
pub(super) fn resolve_completion(status: &str, stated: Option<&str>, now: &str) -> Option<String> {
    if status == COMPLETED {
        Some(
            null_if_empty(stated)
                .unwrap_or(now)
                .to_owned(),
        )
    } else {
        None
    }
}
