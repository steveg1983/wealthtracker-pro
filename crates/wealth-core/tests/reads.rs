//! Integration tests for the six read verbs.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`: seventeen
//! specs, each running one payload against the query the cloud actually issues
//! and against this crate, and comparing the two answers element by element.
//! What is here is the half with **no cloud counterpart to compare against**:
//!
//! 1. **The tie-break.** Every read orders by the cloud's key and then by `id`,
//!    and the second key is this crate's own — the cloud states none, so its
//!    answer under a tie is an artefact of a query plan and there is nothing to
//!    be differential about. It still has to be true, because a list that is
//!    drawn is a list that gets re-drawn.
//! 2. **A file holding two logins.** The cloud has RLS; a local file has
//!    nothing but the owner in the payload, and a restore can genuinely leave a
//!    second login's rows in one. The reads must not see them.
//! 3. **The refusals that happen before a connection is touched** — an unknown
//!    field, and a missing owner. Both are serde's, and both are the reason the
//!    owner is a `String` rather than an `Option<String>` here.
//! 4. **An empty file**, on all six verbs at once, which is a shape assertion:
//!    `[]` and not `null`, under the key the app reads.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::command::{parse, Command};
use wealth_core::db;
use wealth_core::verbs::{
    list_accounts, list_budgets, list_categories, list_closed_accounts, list_goals,
    list_suggestion_dismissals, OwnedRead,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";
const SAME_INSTANT: &str = "2024-01-01T00:00:00.000Z";

fn owner(user_id: &str) -> OwnedRead {
    OwnedRead { user_id: user_id.to_owned() }
}

/// An empty file with one login in it, and the Transfer root C-3's trigger
/// looks for.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO categories (id, user_id, name, type, level)
               VALUES ('{TRANSFER_ROOT}', '{OWNER}', 'Transfer', 'both', 'type');"
        ))
        .expect("fixture");
    connection
}

/// A second login, with one of everything, all of it created at the same
/// instant as this login's so a read that ignored the owner would interleave.
fn a_stranger_with_everything(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, created_at, updated_at)
               VALUES ('a0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours',
                       'checking', '{SAME_INSTANT}', '{SAME_INSTANT}');
             INSERT INTO categories (id, user_id, name, type, level, created_at, updated_at)
               VALUES ('c0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours',
                       'expense', 'detail', '{SAME_INSTANT}', '{SAME_INSTANT}');
             INSERT INTO budgets (id, user_id, name, amount_minor, period, start_date,
                                  created_at, updated_at)
               VALUES ('b0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours', 100,
                       'monthly', '2024-01-01', '{SAME_INSTANT}', '{SAME_INSTANT}');
             INSERT INTO goals (id, user_id, name, target_amount_minor, created_at, updated_at)
               VALUES ('90000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours', 100,
                       '{SAME_INSTANT}', '{SAME_INSTANT}');
             INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key, dismissed_at)
               VALUES ('d0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'duplicate',
                       'theirs', '{SAME_INSTANT}');"
        ))
        .expect("stranger");
}

/// Two accounts of this login's, opened in the same recorded instant.
fn two_accounts_at_one_instant(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO accounts (id, user_id, name, type, created_at, updated_at) VALUES
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', '{SAME_INSTANT}', '{SAME_INSTANT}'),
               ('{EVERYDAY}',  '{OWNER}', 'Everyday', 'checking', '{SAME_INSTANT}', '{SAME_INSTANT}');"
        ))
        .expect("accounts");
}

// ── The tie-break ───────────────────────────────────────────────────────────

#[test]
fn two_accounts_opened_in_the_same_instant_come_back_in_id_order() {
    let connection = fixture();
    two_accounts_at_one_instant(&connection);

    let answered = list_accounts(&connection, owner(OWNER)).expect("read");
    let ids: Vec<&str> = answered.answer.accounts.iter().map(|a| a.id.as_str()).collect();

    // Inserted Rainy day first and Everyday second; `created_at` cannot separate
    // them, so the answer is by id — which is Everyday's, ending 0001.
    assert_eq!(ids, vec![EVERYDAY, RAINY_DAY]);
}

#[test]
fn the_same_file_read_twice_answers_in_the_same_order() {
    let connection = fixture();
    two_accounts_at_one_instant(&connection);

    let first = list_accounts(&connection, owner(OWNER)).expect("read");
    let again = list_accounts(&connection, owner(OWNER)).expect("read");
    let ids = |answered: &wealth_core::verbs::Answered<wealth_core::verbs::Accounts>| {
        answered.answer.accounts.iter().map(|a| a.id.clone()).collect::<Vec<_>>()
    };

    // The property the tie-break exists for: a list that is drawn is a list that
    // gets re-drawn, and two accounts created in one second must not swap places
    // between renders.
    assert_eq!(ids(&first), ids(&again));
}

#[test]
fn two_categories_at_one_level_with_one_name_are_still_ordered() {
    let connection = fixture();
    // `ux_categories_user_name_parent` makes two identical names impossible
    // under one parent, so the tie is reached the only way it can be: same
    // level, same name, different parents.
    connection
        .execute_batch(&format!(
            "INSERT INTO categories (id, user_id, name, type, level) VALUES
               ('c0000000-0000-0000-0000-0000000000b2', '{OWNER}', 'Bills', 'expense', 'type');
             INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('c0000000-0000-0000-0000-0000000000d2', '{OWNER}', 'Water', 'expense', 'detail',
                'c0000000-0000-0000-0000-0000000000b2'),
               ('c0000000-0000-0000-0000-0000000000d1', '{OWNER}', 'Water', 'expense', 'detail',
                '{TRANSFER_ROOT}');"
        ))
        .expect("categories");

    let answered = list_categories(&connection, owner(OWNER)).expect("read");
    let waters: Vec<&str> = answered
        .answer
        .categories
        .iter()
        .filter(|c| c.name == "Water")
        .map(|c| c.id.as_str())
        .collect();

    assert_eq!(
        waters,
        vec![
            "c0000000-0000-0000-0000-0000000000d1",
            "c0000000-0000-0000-0000-0000000000d2"
        ]
    );
}

// ── A file holding two logins ───────────────────────────────────────────────

#[test]
fn a_second_logins_rows_are_in_the_file_and_not_in_the_answer() {
    let connection = fixture();
    a_stranger_with_everything(&connection);

    // Every one of these is empty, and every one of them would be non-empty if
    // the owner were left off the WHERE clause. There is no RLS in a file.
    assert!(list_accounts(&connection, owner(OWNER)).expect("read").answer.accounts.is_empty());
    assert!(list_budgets(&connection, owner(OWNER)).expect("read").answer.budgets.is_empty());
    assert!(list_goals(&connection, owner(OWNER)).expect("read").answer.goals.is_empty());
    assert!(list_suggestion_dismissals(&connection, owner(OWNER))
        .expect("read")
        .answer
        .suggestion_dismissals
        .is_empty());

    // Categories are the one table this fixture starts non-empty (C-3's trigger
    // needs the Transfer root), so the assertion is that the stranger's is not
    // among them rather than that there are none.
    let categories = list_categories(&connection, owner(OWNER)).expect("read");
    let owners: Vec<&str> = categories.answer.categories.iter().map(|c| c.user_id.as_str()).collect();
    assert_eq!(owners, vec![OWNER]);
}

#[test]
fn the_strangers_own_read_answers_with_the_strangers_rows() {
    let connection = fixture();
    a_stranger_with_everything(&connection);

    // The other half of the same property: scoping is a filter, not a refusal,
    // and a file with two logins in it answers each of them correctly.
    let accounts = list_accounts(&connection, owner(STRANGER)).expect("read");
    assert_eq!(accounts.answer.accounts.len(), 1);
    assert_eq!(accounts.answer.accounts[0].name, "Not yours");
}

// ── An empty file ───────────────────────────────────────────────────────────

#[test]
fn a_file_with_nothing_in_it_answers_with_empty_lists() {
    let connection = fixture();
    connection
        .execute_batch(&format!("DELETE FROM categories WHERE user_id = '{OWNER}';"))
        .expect("empty");

    assert!(list_accounts(&connection, owner(OWNER)).expect("read").answer.accounts.is_empty());
    assert!(list_closed_accounts(&connection, owner(OWNER))
        .expect("read")
        .answer
        .closed_accounts
        .is_empty());
    assert!(list_categories(&connection, owner(OWNER)).expect("read").answer.categories.is_empty());
    assert!(list_budgets(&connection, owner(OWNER)).expect("read").answer.budgets.is_empty());
    assert!(list_goals(&connection, owner(OWNER)).expect("read").answer.goals.is_empty());
    assert!(list_suggestion_dismissals(&connection, owner(OWNER))
        .expect("read")
        .answer
        .suggestion_dismissals
        .is_empty());
}

#[test]
fn an_empty_answer_serialises_as_an_empty_array_under_its_own_key() {
    let connection = fixture();
    let answered = list_budgets(&connection, owner(OWNER)).expect("read");

    // The shape matters as much as the emptiness: the far side maps
    // `answer.budgets`, and `null` there is a different bug from `[]` — one is
    // "no budgets" and the other is "this read does not work".
    assert_eq!(
        serde_json::to_string(&answered).expect("json"),
        r#"{"answer":{"budgets":[]}}"#
    );
}

// ── The refusals that never reach a connection ──────────────────────────────

#[test]
fn a_read_with_no_owner_is_refused_before_a_file_is_opened() {
    // The reads take a `String`, not an `Option<String>`: a read with the owner
    // left off would answer with every login in the file, and locally there is
    // no RLS behind it to narrow the answer afterwards.
    let refusal = parse(r#"{"verb":"list_accounts","payload":{}}"#).expect_err("refused");
    let json = serde_json::to_string(&refusal).expect("json");
    assert!(json.contains("missing field"), "{json}");
    assert!(json.contains("user_id"), "{json}");
}

#[test]
fn a_read_carrying_a_filter_is_refused_by_name() {
    // `deny_unknown_fields` is what makes "none of them takes a filter" a fact
    // about the code rather than a claim about it: the day somebody sends
    // `{"is_active": true}`, they are told, rather than quietly served
    // everything.
    let refusal =
        parse(r#"{"verb":"list_accounts","payload":{"user_id":"x","is_active":true}}"#)
            .expect_err("refused");
    let json = serde_json::to_string(&refusal).expect("json");
    assert!(json.contains("unknown_field"), "{json}");
    assert!(json.contains("is_active"), "{json}");
}

#[test]
fn every_read_in_this_slice_parses_to_its_own_variant() {
    // Six verb strings, six variants. The dispatch's exhaustiveness is the
    // compiler's business; what the compiler cannot check is that the STRINGS
    // are the ones the port will send.
    let parsed = |verb: &str| {
        parse(&format!(r#"{{"verb":"{verb}","payload":{{"user_id":"{OWNER}"}}}}"#)).expect(verb)
    };
    assert!(matches!(parsed("list_accounts"), Command::ListAccounts(_)));
    assert!(matches!(parsed("list_closed_accounts"), Command::ListClosedAccounts(_)));
    assert!(matches!(parsed("list_categories"), Command::ListCategories(_)));
    assert!(matches!(parsed("list_budgets"), Command::ListBudgets(_)));
    assert!(matches!(parsed("list_goals"), Command::ListGoals(_)));
    assert!(matches!(
        parsed("list_suggestion_dismissals"),
        Command::ListSuggestionDismissals(_)
    ));
}

// ── The two shapes SQLite spells differently from the cloud ─────────────────

#[test]
fn a_dismissals_subjects_come_back_in_role_order_not_insertion_order() {
    let connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO accounts (id, user_id, name, type) VALUES
               ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking');
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor,
                                       type, date) VALUES
               ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', 0, 'expense', '2024-03-01'),
               ('70000000-0000-0000-0000-000000000002', '{OWNER}', '{EVERYDAY}', 'Other', 0,
                'expense', '2024-03-02'),
               ('70000000-0000-0000-0000-000000000003', '{OWNER}', '{EVERYDAY}', 'Third', 0,
                'expense', '2024-03-03');
             INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key, dismissed_at)
               VALUES ('d0000000-0000-0000-0000-0000000000d1', '{OWNER}', 'transfer-pair',
                       'a|b', '{SAME_INSTANT}');
             -- Two things are deliberately wrong with this order, because a
             -- fixture that got either right would pass on a port that read the
             -- child table as a set: the rows are WRITTEN middle, last, first,
             -- and the roles run OPPOSITE to the ids. An earlier version of this
             -- test had roles ascending with ids, and a mutation that ordered by
             -- transaction_id passed it.
             INSERT INTO suggestion_dismissal_subjects (dismissal_id, transaction_id, role_order)
               VALUES ('d0000000-0000-0000-0000-0000000000d1',
                       '70000000-0000-0000-0000-000000000002', 1),
                      ('d0000000-0000-0000-0000-0000000000d1', '{CORNER_SHOP}', 2),
                      ('d0000000-0000-0000-0000-0000000000d1',
                       '70000000-0000-0000-0000-000000000003', 0);"
        ))
        .expect("dismissal");

    let answered = list_suggestion_dismissals(&connection, owner(OWNER)).expect("read");
    assert_eq!(
        answered.answer.suggestion_dismissals[0].subject_ids,
        vec![
            "70000000-0000-0000-0000-000000000003".to_owned(),
            "70000000-0000-0000-0000-000000000002".to_owned(),
            CORNER_SHOP.to_owned(),
        ],
    );
}

#[test]
fn a_dismissal_with_no_subjects_carries_an_empty_array_not_a_null() {
    let connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key, dismissed_at)
               VALUES ('d0000000-0000-0000-0000-0000000000d1', '{OWNER}', 'stranded',
                       'nothing', '{SAME_INSTANT}');"
        ))
        .expect("dismissal");

    let answered = list_suggestion_dismissals(&connection, owner(OWNER)).expect("read");
    let json = serde_json::to_string(&answered.answer.suggestion_dismissals[0]).expect("json");
    // The cloud's column is `uuid[] NOT NULL DEFAULT '{}'`, so an empty list is
    // what a reader gets there; a child table with no rows must say the same.
    assert!(json.contains(r#""subject_ids":[]"#), "{json}");
}

#[test]
fn the_threshold_crosses_as_a_percentage_and_the_money_beside_it_as_money() {
    let connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO budgets (id, user_id, name, amount_minor, period, start_date,
                                  spent_minor, alert_threshold_bp)
               VALUES ('b0000000-0000-0000-0000-000000000001', '{OWNER}', 'Food', 12345,
                       'monthly', '2024-01-01', 6789, 4250);"
        ))
        .expect("budget");

    let answered = list_budgets(&connection, owner(OWNER)).expect("read");
    let budget = &answered.answer.budgets[0];

    // 4250 basis points of a percent is 42.50%, which is what `numeric(5,2)`
    // holds in the cloud and casts to. The rendering is money.rs's, and the two
    // beside it are money — proving that one integer scale did not leak into
    // the other.
    assert_eq!(budget.alert_threshold, "42.50");
    assert_eq!(budget.amount.to_decimal_string(), "123.45");
    assert_eq!(budget.spent.to_decimal_string(), "67.89");
}
