//! Integration tests for the planning family's six writes — `create_budget`,
//! `update_budget`, `delete_budget`, `create_goal`, `update_goal` and
//! `delete_goal` — against the real vendored schema.
//!
//! The differential proof for all six lives in `scripts/local-sqlite/verbs.mjs`,
//! where the same payload runs against `planningService`'s own INSERT, UPDATE and
//! DELETE transcribed into SQL. What is here is the half with **no Postgres
//! counterpart to compare against**:
//!
//! 1. **The audit trail.** The cloud writes none for either table — that is
//!    DESIGN.md §5 divergence 10, ruled in PHASE1-PLAN §2.2 before any of these
//!    verbs existed — so the entries have nothing to be compared against and
//!    everything to be asserted: the entity, the action, the before/after shape,
//!    and the chain they join.
//! 2. **The refusal's WORDS.** This is the first family in the crate whose
//!    refusal the cloud has no sentence for (PostgREST answers `PGRST116`), so
//!    the prose is the app's own and is asserted rather than inherited. Seam rule
//!    4 makes it the sentence on the screen.
//! 3. **The threshold as an integer.** `alert_threshold_bp` counts hundredths of
//!    a percent where the cloud has a `numeric(5,2)`; the round trip through that
//!    encoding, and the file's range CHECK, have no cloud twin.
//! 4. **What `delete_goal` does NOT do.** It leaves the contributions to the
//!    foreign key and writes them no entries, which is the opposite of
//!    `delete_category`'s decision about ITS cascade — a claim about an absence,
//!    and therefore one only a test can hold.
//! 5. **The metadata merge**, done in Rust over a `serde_json::Map`, including
//!    the two shapes a spec cannot send through both engines identically.
//! 6. **The guard table**, empty across all six, which is the claim
//!    `verbs/mod.rs`'s table makes for every verb and measures rather than
//!    reasons.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::money::Money;
use wealth_core::verbs::{
    create_budget, create_goal, delete_budget, delete_goal, update_budget, update_goal,
    BudgetDraft, BudgetPatch, CreateBudget, CreateGoal, DeleteBudget, DeleteGoal, GoalDraft,
    GoalPatch, UpdateBudget, UpdateGoal,
};
use wealth_core::wire::Field;

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const BUDGET: &str = "b0000000-0000-0000-0000-0000000000f1";
const GOAL: &str = "e0000000-0000-0000-0000-0000000000f1";

/// One login, one category to file a budget against, and one account.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES
               ('{OWNER}', 'harness@example.test'),
               ('{STRANGER}', 'stranger@example.test');
             INSERT INTO categories (id, user_id, name, type, level)
               VALUES ('{WEEKLY_SHOP}', '{OWNER}', 'Weekly shop', 'expense', 'detail');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', 0, 0);"
        ))
        .expect("fixture");
    connection
}

/// A budget draft with the columns the table insists on, and nothing else.
fn budget_draft(id: Option<&str>) -> BudgetDraft {
    BudgetDraft {
        id: id.map(ToOwned::to_owned),
        name: Some("Food".to_owned()),
        amount: Some(Money::parse("100.00").expect("amount")),
        period: Some("monthly".to_owned()),
        category: Some(WEEKLY_SHOP.to_owned()),
        start_date: Some("2024-01-01".to_owned()),
        ..BudgetDraft::default()
    }
}

/// A goal draft, likewise.
fn goal_draft(id: Option<&str>) -> GoalDraft {
    GoalDraft {
        id: id.map(ToOwned::to_owned),
        name: Some("Holiday".to_owned()),
        target_amount: Some(Money::parse("2000.00").expect("target")),
        ..GoalDraft::default()
    }
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

fn text(connection: &Connection, sql: &str) -> String {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

/// Every audit entry, as `entity/action` in write order.
fn trail(connection: &Connection) -> String {
    connection
        .query_row(
            "SELECT COALESCE((SELECT group_concat(entry, ',') FROM (
               SELECT entity || '/' || action AS entry
                 FROM financial_audit_log ORDER BY seq)), 'NONE')",
            [],
            |row| row.get(0),
        )
        .expect("trail")
}

/// The guard table, which must be empty after every verb: nothing in this family
/// touches a table any `_rpc_guard` flag protects, and that is measured rather
/// than reasoned about.
/// The `message` a refusal puts on the wire — what `command::respond` copies
/// into the envelope, and therefore the sentence `coreTransport` hands the UI.
///
/// Not `to_string()`: [`CoreError`]'s Display prefixes the code, which is right
/// for a log line and wrong for the assertion this family needs.
fn refusal_message(error: &wealth_core::error::CoreError) -> String {
    match error {
        wealth_core::error::CoreError::Refused(refusal) => refusal.message().to_owned(),
        other => panic!("expected a refusal, got {other}"),
    }
}

fn guards_held(connection: &Connection) -> i64 {
    scalar(connection, "SELECT COUNT(*) FROM _rpc_guard")
}

/// A budget already in the file, inserted as SQL rather than through the verb.
///
/// The audit table is immutable by trigger (U-3), so a fixture built by CALLING
/// the create would leave an entry no test could clear and every trail assertion
/// would have to subtract it. A fixture is a STATE, not a history.
fn seed_budget(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO budgets (id, user_id, name, amount_minor, period, category,
                                  start_date, alert_threshold_bp)
               VALUES ('{BUDGET}', '{OWNER}', 'Food', 10000, 'monthly', '{WEEKLY_SHOP}',
                       '2024-01-01', 8000);"
        ))
        .expect("seed budget");
}

/// A goal already in the file, likewise — 250.05 put by towards 2000.00, with
/// two of the three metadata-backed app fields set.
fn seed_goal(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor,
                                target_date, status, metadata)
               VALUES ('{GOAL}', '{OWNER}', 'Holiday', 200000, 25005, '2026-01-01', 'active',
                       '{{\"type\":\"savings\",\"linkedAccountIds\":[\"keep-me\"]}}');"
        ))
        .expect("seed goal");
}

// ── The audit trail, which the cloud has for neither table ───────────────────

#[test]
fn a_budgets_whole_life_is_audited() {
    let mut connection = fixture();

    create_budget(
        &mut connection,
        CreateBudget {
            user_id: OWNER.to_owned(),
            budget: budget_draft(Some(BUDGET)),
        },
    )
    .expect("create");
    update_budget(
        &mut connection,
        UpdateBudget {
            id: BUDGET.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: BudgetPatch {
                amount: Field::Value(Money::parse("150.00").expect("amount")),
                ..BudgetPatch::default()
            },
        },
    )
    .expect("update");
    delete_budget(
        &mut connection,
        DeleteBudget {
            id: BUDGET.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(
        trail(&connection),
        "budget/create,budget/update,budget/delete"
    );
    // U-6: a create has no `before`, a delete has no `after`, an update has both.
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log
              WHERE (action = 'create' AND before_data IS NULL AND after_data IS NOT NULL)
                 OR (action = 'update' AND before_data IS NOT NULL AND after_data IS NOT NULL)
                 OR (action = 'delete' AND before_data IS NOT NULL AND after_data IS NULL)"
        ),
        3
    );
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn a_goals_whole_life_is_audited() {
    let mut connection = fixture();

    create_goal(
        &mut connection,
        CreateGoal {
            user_id: OWNER.to_owned(),
            goal: goal_draft(Some(GOAL)),
        },
    )
    .expect("create");
    update_goal(
        &mut connection,
        UpdateGoal {
            id: GOAL.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: GoalPatch {
                current_amount: Field::Value(Money::parse("500.00").expect("current")),
                ..GoalPatch::default()
            },
        },
    )
    .expect("update");
    delete_goal(
        &mut connection,
        DeleteGoal {
            id: GOAL.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(trail(&connection), "goal/create,goal/update,goal/delete");
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn a_budget_entry_records_the_figure_that_moved() {
    // The whole reason U-1 was extended to this table: "what changed that
    // figure" has to be answerable from the entry alone.
    let mut connection = fixture();
    seed_budget(&connection);

    update_budget(
        &mut connection,
        UpdateBudget {
            id: BUDGET.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: BudgetPatch {
                amount: Field::Value(Money::parse("150.00").expect("amount")),
                ..BudgetPatch::default()
            },
        },
    )
    .expect("update");

    let before = text(
        &connection,
        "SELECT json_extract(before_data, '$.amount') FROM financial_audit_log",
    );
    let after = text(
        &connection,
        "SELECT json_extract(after_data, '$.amount') FROM financial_audit_log",
    );
    assert_eq!(before, "100.00");
    assert_eq!(after, "150.00");
}

#[test]
fn a_deleted_budget_is_reconstructable_from_its_entry() {
    // A delete is the case where the entry is the ONLY record: the row is gone.
    let mut connection = fixture();
    seed_budget(&connection);

    delete_budget(
        &mut connection,
        DeleteBudget {
            id: BUDGET.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM budgets"), 0);
    assert_eq!(
        text(
            &connection,
            "SELECT json_extract(before_data, '$.amount') || '/' ||
                    json_extract(before_data, '$.period') || '/' ||
                    json_extract(before_data, '$.category')
               FROM financial_audit_log"
        ),
        format!("100.00/monthly/{WEEKLY_SHOP}")
    );
}

#[test]
fn a_write_that_does_nothing_writes_no_entry() {
    // An id naming nothing is a successful nothing, and a trail that recorded it
    // would be a trail of deletions that never happened.
    let mut connection = fixture();
    seed_budget(&connection);
    seed_goal(&connection);

    let budget = delete_budget(
        &mut connection,
        DeleteBudget {
            id: "b0000000-0000-0000-0000-0000000000ff".to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");
    let goal = delete_goal(
        &mut connection,
        DeleteGoal {
            id: "e0000000-0000-0000-0000-0000000000ff".to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(budget.answer.deleted, 0);
    assert_eq!(goal.answer.deleted, 0);
    assert_eq!(trail(&connection), "NONE");
}

// ── The refusal's own words ──────────────────────────────────────────────────

#[test]
fn a_budget_that_is_not_there_is_refused_in_a_sentence_a_person_can_read() {
    // Seam rule 4: the `message` is the prose the UI renders. This family is the
    // first whose refusal the cloud has no words for — PostgREST's own answer is
    // `PGRST116: JSON object requested, multiple (or no) rows returned` — so the
    // sentence comes from the app's other implementation of the same operation,
    // `DataServiceImpl.updateBudget`, and is asserted here because nothing else
    // can hold it.
    let mut connection = fixture();
    seed_budget(&connection);

    let error = update_budget(
        &mut connection,
        UpdateBudget {
            id: "b0000000-0000-0000-0000-0000000000ff".to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: BudgetPatch {
                amount: Field::Value(Money::parse("1.00").expect("amount")),
                ..BudgetPatch::default()
            },
        },
    )
    .expect_err("a budget that is not there");

    assert_eq!(error.code(), "budget_not_found");
    // The `message` field of the envelope, which the transport turns into
    // `new Error(message)` verbatim — NOT the Display form, which prefixes the
    // code for a log line.
    assert_eq!(refusal_message(&error), "Budget not found");
    // And nothing moved: the judgement happens before the first write.
    assert_eq!(trail(&connection), "NONE");
    assert_eq!(text(&connection, "SELECT name FROM budgets"), "Food");
}

#[test]
fn a_goal_that_is_not_there_is_refused_in_a_sentence_a_person_can_read() {
    let mut connection = fixture();
    seed_goal(&connection);

    let error = update_goal(
        &mut connection,
        UpdateGoal {
            id: "e0000000-0000-0000-0000-0000000000ff".to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: GoalPatch {
                current_amount: Field::Value(Money::parse("1.00").expect("current")),
                ..GoalPatch::default()
            },
        },
    )
    .expect_err("a goal that is not there");

    assert_eq!(error.code(), "goal_not_found");
    assert_eq!(refusal_message(&error), "Goal not found");
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn somebody_elses_budget_is_the_same_refusal_as_one_that_does_not_exist() {
    // `.eq('id').eq('user_id')` cannot tell the two apart either, and telling a
    // caller which of the two it was would be telling them a budget exists.
    let mut connection = fixture();
    seed_budget(&connection);

    let error = update_budget(
        &mut connection,
        UpdateBudget {
            id: BUDGET.to_owned(),
            user_id: Some(STRANGER.to_owned()),
            patch: BudgetPatch {
                amount: Field::Value(Money::parse("1.00").expect("amount")),
                ..BudgetPatch::default()
            },
        },
    )
    .expect_err("not this login's budget");

    assert_eq!(error.code(), "budget_not_found");
    assert_eq!(
        text(&connection, "SELECT CAST(amount_minor AS TEXT) FROM budgets"),
        "10000"
    );
}

// ── The threshold, which is not money and is exact anyway ────────────────────

#[test]
fn a_threshold_round_trips_through_hundredths_of_a_percent() {
    let mut connection = fixture();

    let created = create_budget(
        &mut connection,
        CreateBudget {
            user_id: OWNER.to_owned(),
            budget: BudgetDraft {
                alert_threshold: Some("62.50".to_owned()),
                ..budget_draft(Some(BUDGET))
            },
        },
    )
    .expect("create");

    // Stored as an integer, answered as the decimal string the cloud's
    // numeric(5,2) casts to. No float exists on either path.
    assert_eq!(
        scalar(&connection, "SELECT alert_threshold_bp FROM budgets"),
        6250
    );
    assert_eq!(created.answer.alert_threshold, "62.50");
}

#[test]
fn an_unstated_threshold_is_eighty_percent_on_both_engines() {
    let mut connection = fixture();

    let created = create_budget(
        &mut connection,
        CreateBudget {
            user_id: OWNER.to_owned(),
            budget: budget_draft(Some(BUDGET)),
        },
    )
    .expect("create");

    assert_eq!(created.answer.alert_threshold, "80.00");
    assert_eq!(
        scalar(&connection, "SELECT alert_threshold_bp FROM budgets"),
        8000
    );
}

#[test]
fn a_threshold_finer_than_a_hundredth_of_a_percent_is_refused_by_name() {
    // Its own code, not `amount_malformed`: the quantity is not money, and
    // reporting it as an amount would send a reader looking for one.
    let mut connection = fixture();

    let error = create_budget(
        &mut connection,
        CreateBudget {
            user_id: OWNER.to_owned(),
            budget: BudgetDraft {
                alert_threshold: Some("80.005".to_owned()),
                ..budget_draft(Some(BUDGET))
            },
        },
    )
    .expect_err("three decimal places");

    assert_eq!(error.code(), "percentage_malformed");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM budgets"), 0);
}

#[test]
fn a_threshold_outside_nought_to_a_hundred_is_refused_by_the_file() {
    // `alert_threshold_bp BETWEEN 0 AND 10000`, a CHECK the cloud has no twin
    // for: `numeric(5,2)` accepts 999.99% happily.
    let mut connection = fixture();

    let error = create_budget(
        &mut connection,
        CreateBudget {
            user_id: OWNER.to_owned(),
            budget: BudgetDraft {
                alert_threshold: Some("150.00".to_owned()),
                ..budget_draft(Some(BUDGET))
            },
        },
    )
    .expect_err("a percentage past a hundred");

    assert!(
        error.to_string().contains("alert_threshold_bp"),
        "the file names the constraint it refused on: {error}"
    );
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM budgets"), 0);
}

// ── What `delete_goal` leaves to the key, and does not audit ─────────────────

#[test]
fn a_goals_contributions_go_with_it_and_are_not_audited_one_by_one() {
    // The decision `delete_goal`'s module docs argue against
    // `delete_category`'s: the cascade is the FILE's job here, the count is
    // goals-removed rather than rows-removed, and no entry is written for a row
    // this crate has no writer, reader or row module for.
    let mut connection = fixture();
    seed_goal(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO goal_contributions (id, goal_id, user_id, amount_minor, date) VALUES
               ('f0000000-0000-0000-0000-0000000000c1', '{GOAL}', '{OWNER}', 10000, '2024-02-01'),
               ('f0000000-0000-0000-0000-0000000000c2', '{GOAL}', '{OWNER}', 15005, '2024-03-01');"
        ))
        .expect("contributions");

    let removed = delete_goal(
        &mut connection,
        DeleteGoal {
            id: GOAL.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    // ONE. Not three.
    assert_eq!(removed.answer.deleted, 1);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM goal_contributions"),
        0
    );
    // ONE entry, and it is the goal's.
    assert_eq!(trail(&connection), "goal/delete");
    assert_eq!(guards_held(&connection), 0);
}

// ── The metadata merge ───────────────────────────────────────────────────────

#[test]
fn a_metadata_edit_is_merged_over_what_is_stored() {
    let mut connection = fixture();
    seed_goal(&connection);

    update_goal(
        &mut connection,
        UpdateGoal {
            id: GOAL.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: GoalPatch {
                metadata: Field::Value(serde_json::json!({ "type": "investment" })),
                ..GoalPatch::default()
            },
        },
    )
    .expect("update");

    assert_eq!(
        text(
            &connection,
            "SELECT json_extract(metadata, '$.type') || '/' ||
                    json_extract(metadata, '$.linkedAccountIds[0]') FROM goals"
        ),
        "investment/keep-me"
    );
}

#[test]
fn a_metadata_edit_that_states_no_metadata_leaves_the_blob_alone() {
    // The `ELSE metadata END` arm, which is what stops every ordinary edit —
    // renaming a goal, contributing to it — from blanking three app fields that
    // have no columns of their own.
    let mut connection = fixture();
    seed_goal(&connection);

    update_goal(
        &mut connection,
        UpdateGoal {
            id: GOAL.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: GoalPatch {
                name: Field::Value("Bigger holiday".to_owned()),
                ..GoalPatch::default()
            },
        },
    )
    .expect("update");

    assert_eq!(
        text(
            &connection,
            "SELECT json_extract(metadata, '$.type') || '/' ||
                    json_extract(metadata, '$.linkedAccountIds[0]') FROM goals"
        ),
        "savings/keep-me"
    );
}

// ── B-5, and the two defaults the writer fills in ────────────────────────────

#[test]
fn a_budget_with_no_id_is_given_one_that_is_usable_at_once() {
    let mut connection = fixture();

    let created = create_budget(
        &mut connection,
        CreateBudget {
            user_id: OWNER.to_owned(),
            budget: budget_draft(None),
        },
    )
    .expect("create");

    assert_eq!(created.answer.id.len(), 36);
    // Usable on the next line, which is B-5's whole claim.
    let edited = update_budget(
        &mut connection,
        UpdateBudget {
            id: created.answer.id.clone(),
            user_id: Some(OWNER.to_owned()),
            patch: BudgetPatch {
                notes: Field::Value("straight back at it".to_owned()),
                ..BudgetPatch::default()
            },
        },
    )
    .expect("edit the answer's id");
    assert_eq!(edited.answer.id, created.answer.id);
}

#[test]
fn a_budget_with_no_start_date_starts_today() {
    // A NOT NULL column being satisfied by the writer, off the file's own clock,
    // in the write's own transaction — which is the UTC day the cloud's
    // `new Date().toISOString().slice(0, 10)` also produces.
    let mut connection = fixture();

    let created = create_budget(
        &mut connection,
        CreateBudget {
            user_id: OWNER.to_owned(),
            budget: BudgetDraft {
                start_date: None,
                ..budget_draft(Some(BUDGET))
            },
        },
    )
    .expect("create");

    let today = text(&connection, "SELECT date('now')");
    assert_eq!(created.answer.start_date, today);
}

#[test]
fn a_goals_completion_date_can_never_disagree_with_its_status() {
    // Both directions of "the achievement date follows the status, always", in
    // one test because they are one rule.
    let mut connection = fixture();
    seed_goal(&connection);

    let finished = update_goal(
        &mut connection,
        UpdateGoal {
            id: GOAL.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: GoalPatch {
                status: Field::Value("completed".to_owned()),
                ..GoalPatch::default()
            },
        },
    )
    .expect("finish it");
    assert!(finished.answer.completed_at.is_some());

    let reopened = update_goal(
        &mut connection,
        UpdateGoal {
            id: GOAL.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: GoalPatch {
                status: Field::Value("active".to_owned()),
                ..GoalPatch::default()
            },
        },
    )
    .expect("reopen it");
    assert_eq!(reopened.answer.completed_at, None);
}
