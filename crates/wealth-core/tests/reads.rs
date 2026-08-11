//! Integration tests for the ten read verbs.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`: thirty-eight
//! specs, each running one payload against the query the cloud actually issues
//! — or, for `account_balances`, against the cloud FUNCTION itself — and
//! comparing the two answers element by element. What is here is the half with
//! **no cloud counterpart to compare against**:
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
//! 4. **An empty file**, on all ten verbs at once, which is a shape assertion:
//!    `[]` and not `null`, under the key the app reads.
//!
//! Slice 16's four added a fifth thing to the first item, and it is worth
//! naming: `account_balances` has no ORDER BY AT ALL in the cloud —
//! `GROUP BY` and nothing after it, because the client turns the answer into a
//! `Map` the moment it arrives. So the whole of its order, not just a tie-break,
//! is this crate's own, and there is nothing differential to say about it.
//! The plans and the wall times at fifty thousand rows are a separate file,
//! `reads_at_scale.rs`.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::command::{parse, Command};
use wealth_core::db;
use wealth_core::verbs::{
    account_balances, list_accounts, list_budgets, list_categories, list_closed_accounts,
    list_goals, list_suggestion_dismissals, list_transaction_splits, list_transactions, splits_for,
    OwnedRead, SplitsFor,
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

// ── Slice 16: the heavy four ────────────────────────────────────────────────

/// Two accounts, one row each, and a split whose two lines share a `sort_order`.
///
/// Everything a heavy read needs that the light ones did not: money to sum, a
/// parent to hang lines off, and a tie the cloud states no rule for.
fn a_small_ledger(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO accounts (id, user_id, name, type, balance_minor,
                                   initial_balance_minor, created_at, updated_at) VALUES
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 1000, 1000,
                '{SAME_INSTANT}', '{SAME_INSTANT}'),
               ('{EVERYDAY}',  '{OWNER}', 'Everyday', 'checking', -2500, 0,
                '{SAME_INSTANT}', '{SAME_INSTANT}');
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor,
                                       type, date, category, is_split)
               VALUES ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500,
                       'expense', '2024-03-01', '', 1);
             INSERT INTO transaction_splits (id, transaction_id, user_id, category,
                                             amount_minor, sort_order) VALUES
               ('50000000-0000-0000-0000-0000000000b2', '{CORNER_SHOP}', '{OWNER}',
                '{TRANSFER_ROOT}', -1000, 0),
               ('50000000-0000-0000-0000-0000000000b1', '{CORNER_SHOP}', '{OWNER}',
                '{TRANSFER_ROOT}', -1500, 0);"
        ))
        .expect("ledger");
}

#[test]
fn two_split_lines_sharing_a_sort_order_come_back_in_id_order() {
    let connection = fixture();
    a_small_ledger(&connection);

    let answered = list_transaction_splits(&connection, owner(OWNER)).expect("read");
    let ids: Vec<&str> = answered
        .answer
        .transaction_splits
        .iter()
        .map(|line| line.id.as_str())
        .collect();

    // `sort_order` is not unique — the pre-split fixtures in this repo start
    // every line at 0 — so the cloud's two keys leave this pair unordered, and
    // in Postgres the answer under a tie is whatever the executor felt like.
    // The `id` behind them is this crate's own; the b2 line was written FIRST
    // and must come back second.
    assert_eq!(
        ids,
        vec![
            "50000000-0000-0000-0000-0000000000b1",
            "50000000-0000-0000-0000-0000000000b2"
        ]
    );
}

#[test]
fn one_parents_lines_break_the_same_tie_the_same_way() {
    let connection = fixture();
    a_small_ledger(&connection);

    let answered = splits_for(
        &connection,
        SplitsFor { user_id: OWNER.to_owned(), transaction_id: CORNER_SHOP.to_owned() },
    )
    .expect("read");
    let ids: Vec<&str> = answered.answer.splits.iter().map(|line| line.id.as_str()).collect();

    // The two split reads share a tie-break because they share a table and an
    // idea of display order. A parent whose lines came back one way in the edit
    // modal and the other way in a report would be one bug reported twice.
    assert_eq!(
        ids,
        vec![
            "50000000-0000-0000-0000-0000000000b1",
            "50000000-0000-0000-0000-0000000000b2"
        ]
    );
}

#[test]
fn the_balances_come_back_by_account_id_because_the_cloud_states_no_order_at_all() {
    let connection = fixture();
    a_small_ledger(&connection);

    let answered = account_balances(&connection, owner(OWNER)).expect("read");
    let ids: Vec<&str> = answered
        .answer
        .account_balances
        .iter()
        .map(|balance| balance.account_id.as_str())
        .collect();

    // Rainy day is INSERTed first and Everyday's id sorts first. The RPC has no
    // ORDER BY whatsoever, so unlike every other read there is no cloud key with
    // a crate tie-break behind it: the whole order is stated here, and `id`
    // alone is enough because it is the group key.
    assert_eq!(ids, vec![EVERYDAY, RAINY_DAY]);
}

#[test]
fn a_second_logins_rows_are_in_the_file_and_not_in_any_of_the_heavy_answers() {
    let connection = fixture();
    a_small_ledger(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('a0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours',
                       'checking', -100, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor,
                                       type, date)
               VALUES ('70000000-0000-0000-0000-0000000000f9', '{STRANGER}',
                       'a0000000-0000-0000-0000-0000000000f9', 'Theirs', -100, 'expense',
                       '2024-03-01');"
        ))
        .expect("stranger");

    // There is no RLS in a file, so each of these is the whole gate. The balance
    // read is the one that would be noticed: a stranger's account in this answer
    // is a stranger's money in the dashboard's net worth.
    let listed = list_transactions(&connection, owner(OWNER)).expect("read");
    assert_eq!(listed.answer.transactions.len(), 1);
    assert_eq!(listed.answer.transactions[0].id, CORNER_SHOP);

    let balances = account_balances(&connection, owner(OWNER)).expect("read");
    let ids: Vec<&str> = balances
        .answer
        .account_balances
        .iter()
        .map(|balance| balance.account_id.as_str())
        .collect();
    assert_eq!(ids, vec![EVERYDAY, RAINY_DAY]);
}

#[test]
fn a_parent_of_mine_asked_for_by_a_stranger_answers_with_nothing() {
    let connection = fixture();
    a_small_ledger(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{STRANGER}', 'stranger@example.test');"
        ))
        .expect("stranger");

    let answered = splits_for(
        &connection,
        SplitsFor { user_id: STRANGER.to_owned(), transaction_id: CORNER_SHOP.to_owned() },
    )
    .expect("read");

    // `splits_for`'s owner is a LOCAL addition — the cloud's query names no
    // owner because RLS is underneath it. An empty answer rather than a refusal,
    // for the reason the account reader gives: telling "no such row" from "not
    // your row" confirms an id exists to a caller who may not see it.
    assert!(answered.answer.splits.is_empty());
}

#[test]
fn the_heavy_reads_of_an_empty_file_are_empty_arrays_under_their_own_keys() {
    let connection = fixture();

    // Four shapes, and the far side maps all four by name. `null` under any of
    // them is a different bug from `[]`: one says "nothing here" and the other
    // says "this read does not work".
    let transactions = list_transactions(&connection, owner(OWNER)).expect("read");
    assert_eq!(
        serde_json::to_string(&transactions).expect("json"),
        r#"{"answer":{"transactions":[]}}"#
    );
    let splits = list_transaction_splits(&connection, owner(OWNER)).expect("read");
    assert_eq!(
        serde_json::to_string(&splits).expect("json"),
        r#"{"answer":{"transaction_splits":[]}}"#
    );
    let one = splits_for(
        &connection,
        SplitsFor { user_id: OWNER.to_owned(), transaction_id: CORNER_SHOP.to_owned() },
    )
    .expect("read");
    assert_eq!(serde_json::to_string(&one).expect("json"), r#"{"answer":{"splits":[]}}"#);
    let balances = account_balances(&connection, owner(OWNER)).expect("read");
    assert_eq!(
        serde_json::to_string(&balances).expect("json"),
        r#"{"answer":{"account_balances":[]}}"#
    );
}

#[test]
fn the_heavy_reads_parse_to_their_own_variants_and_only_splits_for_takes_a_parent() {
    let parsed = |verb: &str| {
        parse(&format!(r#"{{"verb":"{verb}","payload":{{"user_id":"{OWNER}"}}}}"#)).expect(verb)
    };
    assert!(matches!(parsed("list_transactions"), Command::ListTransactions(_)));
    assert!(matches!(parsed("list_transaction_splits"), Command::ListTransactionSplits(_)));
    assert!(matches!(parsed("account_balances"), Command::AccountBalances(_)));

    let one = parse(&format!(
        r#"{{"verb":"splits_for","payload":{{"user_id":"{OWNER}","transaction_id":"{CORNER_SHOP}"}}}}"#
    ))
    .expect("splits_for");
    assert!(matches!(one, Command::SplitsFor(_)));
}

#[test]
fn splits_for_without_its_parent_is_refused_before_a_file_is_opened() {
    // The seam's `…For` suffix names a parent, and the payload requires one:
    // a `splits_for` that fell back to the whole store on a missing id would put
    // another transaction's money in the edit modal's box.
    let refusal =
        parse(&format!(r#"{{"verb":"splits_for","payload":{{"user_id":"{OWNER}"}}}}"#))
            .expect_err("refused");
    let json = serde_json::to_string(&refusal).expect("json");
    assert!(json.contains("missing field"), "{json}");
    assert!(json.contains("transaction_id"), "{json}");
}

#[test]
fn a_balance_read_carrying_a_date_filter_is_refused_by_name() {
    // `deny_unknown_fields` on the shared payload is what makes "none of them
    // takes a filter" a fact rather than a claim — and on THIS verb it is worth
    // a test of its own, because "balances as at a date" is the most plausible
    // thing anybody will one day try to send.
    let refusal = parse(&format!(
        r#"{{"verb":"account_balances","payload":{{"user_id":"{OWNER}","as_at":"2024-01-01"}}}}"#
    ))
    .expect_err("refused");
    let json = serde_json::to_string(&refusal).expect("json");
    assert!(json.contains("unknown_field"), "{json}");
    assert!(json.contains("as_at"), "{json}");
}

#[test]
fn a_balance_is_money_and_a_count_is_not() {
    let connection = fixture();
    a_small_ledger(&connection);

    let answered = account_balances(&connection, owner(OWNER)).expect("read");
    let json = serde_json::to_string(&answered.answer.account_balances[0]).expect("json");

    // The two numbers in this answer are different KINDS of number, and the
    // serialisation has to say so: the balance is a decimal string because it is
    // money and money.rs is the one place minor units become text, and the count
    // is a JSON number because it is a count. A port that rendered the count as
    // "1" would be inventing a currency for it; one that rendered the balance as
    // -2500 would be handing the client an integer to divide.
    assert!(json.contains(r#""balance":"-25.00""#), "{json}");
    assert!(json.contains(r#""txn_count":1"#), "{json}");
}
