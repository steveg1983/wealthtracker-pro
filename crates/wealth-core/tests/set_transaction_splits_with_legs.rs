//! Integration tests for the split writer, against the real vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`:
//! twenty-nine specs, every one of them running the same payload against the
//! live Postgres RPC and this verb. What is here is the half that has no
//! Postgres counterpart to compare against, and one thing in particular —
//!
//! # The claim this file exists to prove
//!
//! The verb's module documentation asserts that
//! `set_transaction_splits_with_legs` does **not** need `_rpc_guard('leg')`, and
//! that is a claim about SQLite triggers rather than about the RPC. There is
//! nothing to run against Postgres: `trg_protect_linked_leg` and
//! `trg_protect_linked_leg_delete` are local constraints with no cloud twin (the
//! cloud enforces S-9 and S-10 procedurally, inside the very function being
//! ported). So the proof has to be here, and it has to be *behavioural*: drive
//! every write shape the verb makes at a linked leg and show the triggers stay
//! silent — then break the verb's own rule and show they do not.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::error::CoreError;
use wealth_core::verbs::{
    set_transaction_splits_with_legs, SetTransactionSplitsWithLegs,
    SetTransactionSplitsWithLegsResult,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const HOLIDAY: &str = "a0000000-0000-0000-0000-000000000003";
const DOLLARS: &str = "a0000000-0000-0000-0000-00000000000d";
const SOMEONE_ELSES: &str = "a0000000-0000-0000-0000-000000000009";
const OUTGOINGS: &str = "c0000000-0000-0000-0000-000000000002";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const PARENT: &str = "70000000-0000-0000-0000-000000000001";
const COUNTERPART: &str = "70000000-0000-0000-0000-000000000009";
const LEG_LINE: &str = "50000000-0000-0000-0000-000000000001";
const PLAIN_LINE: &str = "50000000-0000-0000-0000-000000000002";

fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES
               ('{OWNER}', 'harness@example.test'),
               ('{STRANGER}', 'stranger@example.test');
             INSERT INTO categories (id, user_id, name, type, level) VALUES
               ('c0000000-0000-0000-0000-000000000001', '{OWNER}', 'Transfer', 'both', 'type'),
               ('{OUTGOINGS}', '{OWNER}', 'Outgoings', 'expense', 'type');
             INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{WEEKLY_SHOP}', '{OWNER}', 'Weekly shop', 'expense', 'sub', '{OUTGOINGS}');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor) VALUES
               ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0),
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 0, 0),
               ('{HOLIDAY}', '{OWNER}', 'Holiday fund', 'savings', 0, 0),
               ('{SOMEONE_ELSES}', '{STRANGER}', 'Not yours', 'checking', 0, 0);
             INSERT INTO accounts (id, user_id, name, type, currency, balance_minor, initial_balance_minor)
             VALUES ('{DOLLARS}', '{OWNER}', 'Dollars', 'checking', 'USD', 0, 0);
             INSERT INTO transactions
               (id, user_id, account_id, description, amount_minor, type, date, category, notes)
             VALUES
               ('{PARENT}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense', '2024-03-01',
                '{WEEKLY_SHOP}', 'parent notes');",
        ))
        .expect("fixture");
    connection
}

/// A split of −15.00 (a LINKED transfer leg, filed under the To/From category)
/// and −10.00, with the counterpart in Rainy day and both balances honest.
fn with_a_linked_leg(connection: &Connection) {
    with_a_leg_filed_under(connection, &transfer_category(connection, RAINY_DAY));
}

/// The same shape, but with the leg filed under an ORDINARY category — the MS
/// Money importer's population, and the only way to reach
/// `split_leg_target_locked`.
fn with_a_leg_filed_ordinarily(connection: &Connection) {
    with_a_leg_filed_under(connection, WEEKLY_SHOP);
}

fn with_a_leg_filed_under(connection: &Connection, category: &str) {
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{PARENT}';
             INSERT INTO transactions
               (id, user_id, account_id, description, amount_minor, type, date, transfer_account_id)
             VALUES ('{COUNTERPART}', '{OWNER}', '{RAINY_DAY}', 'Counterpart', 1500, 'transfer',
                     '2024-03-01', '{EVERYDAY}');
             UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '{RAINY_DAY}';
             INSERT INTO transaction_splits
               (id, transaction_id, user_id, category, amount_minor, sort_order,
                transfer_account_id, linked_transfer_id)
             VALUES ('{LEG_LINE}', '{PARENT}', '{OWNER}', '{category}',
                     -1500, 0, '{RAINY_DAY}', '{COUNTERPART}');
             INSERT INTO transaction_splits
               (id, transaction_id, user_id, category, amount_minor, sort_order)
             VALUES ('{PLAIN_LINE}', '{PARENT}', '{OWNER}', '{WEEKLY_SHOP}', -1000, 1);
             UPDATE transactions SET linked_transfer_split_id = '{LEG_LINE}'
              WHERE id = '{COUNTERPART}';
             DELETE FROM _rpc_guard;"
        ))
        .expect("leg fixture");
}

/// An UNLINKED leg: a line carrying a target whose counterpart is gone.
fn with_an_unlinked_leg(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{PARENT}';
             INSERT INTO transaction_splits
               (id, transaction_id, user_id, category, amount_minor, sort_order, transfer_account_id)
             VALUES ('{LEG_LINE}', '{PARENT}', '{OWNER}', '{WEEKLY_SHOP}', -1500, 0, '{RAINY_DAY}');
             INSERT INTO transaction_splits
               (id, transaction_id, user_id, category, amount_minor, sort_order)
             VALUES ('{PLAIN_LINE}', '{PARENT}', '{OWNER}', '{WEEKLY_SHOP}', -1000, 1);
             DELETE FROM _rpc_guard;"
        ))
        .expect("unlinked fixture");
}

/// The To/From category an account minted when it was inserted. Its id is
/// generated by a trigger, so no test may name one.
fn transfer_category(connection: &Connection, account: &str) -> String {
    connection
        .query_row(
            "SELECT id FROM categories WHERE account_id = ?1 AND is_transfer_category = 1",
            [account],
            |row| row.get(0),
        )
        .expect("transfer category")
}

fn command(payload: serde_json::Value) -> SetTransactionSplitsWithLegs {
    serde_json::from_value(payload).expect("command")
}

fn run(
    connection: &mut Connection,
    payload: serde_json::Value,
) -> SetTransactionSplitsWithLegsResult {
    set_transaction_splits_with_legs(connection, command(payload))
        .expect("the verb should have accepted this")
}

fn refuse(connection: &mut Connection, payload: serde_json::Value) -> CoreError {
    match set_transaction_splits_with_legs(connection, command(payload)) {
        Err(error) => error,
        // `expect_err` would need `Debug` on the result type, which would mean
        // deriving it on a struct that carries every row this verb wrote.
        Ok(_) => panic!("the verb should have refused this"),
    }
}

fn balance(connection: &Connection, account: &str) -> i64 {
    connection
        .query_row(
            "SELECT balance_minor FROM accounts WHERE id = ?1",
            [account],
            |row| row.get(0),
        )
        .expect("balance")
}

fn identity(connection: &Connection, account: &str) -> i64 {
    connection
        .query_row(
            "SELECT a.balance_minor - (a.initial_balance_minor
                      + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                                   WHERE t.account_id = a.id), 0))
               FROM accounts a WHERE a.id = ?1",
            [account],
            |row| row.get(0),
        )
        .expect("identity")
}

fn count(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect("count")
}

fn every_balance_identity_holds(connection: &Connection) {
    for account in [EVERYDAY, RAINY_DAY, HOLIDAY, DOLLARS, SOMEONE_ELSES] {
        assert_eq!(identity(connection, account), 0, "B-1 must hold for {account}");
    }
}

// ── The claim: this verb needs the split guard and not the leg guard ────────

#[test]
fn a_pinned_leg_can_move_and_be_re_memoed_without_the_leg_guard() {
    // MEASURED, not reasoned: if `trg_protect_linked_leg` fired on the writes
    // this verb makes to a linked line, this call would come back
    // `split_leg_locked` and the whole "no leg guard" argument would be wrong.
    let mut connection = fixture();
    with_a_linked_leg(&connection);
    let leg = transfer_category(&connection, RAINY_DAY);

    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
                { "id": LEG_LINE, "category": leg, "amount": "-15.00",
                  "transfer_account_id": RAINY_DAY, "memo": "moved and re-memoed" },
            ],
        }),
    );

    assert_eq!(result.splits.len(), 2);
    let moved = result
        .splits
        .iter()
        .find(|line| line.id == LEG_LINE)
        .expect("the leg survives");
    assert_eq!(moved.sort_order, 2, "position is not structural");
    assert_eq!(moved.memo.as_deref(), Some("moved and re-memoed"));
    assert_eq!(moved.amount.minor(), -1_500, "and nothing else moved");
    assert_eq!(moved.linked_transfer_id.as_deref(), Some(COUNTERPART));
    assert!(result.counterparts.is_empty(), "nothing was minted");
    every_balance_identity_holds(&connection);
}

#[test]
fn the_guard_this_verb_holds_is_split_and_it_is_given_back() {
    let mut connection = fixture();
    run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "category": OUTGOINGS, "amount": "-10.00" },
            ],
        }),
    );

    // A flag left behind would silently disable S-5 for every later write on
    // this file — which is exactly what the trigger is there to prevent.
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);
}

#[test]
fn the_split_guard_is_given_back_after_a_refusal_too() {
    let mut connection = fixture();
    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-99.00",
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "category": OUTGOINGS, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "split_total_mismatch");
    // The guard is taken and released inside the same transaction as the writes
    // it authorises, so a rollback takes it with them.
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM transaction_splits"), 0);
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
}

#[test]
fn without_the_split_guard_the_parent_is_read_only() {
    // The control. The same UPDATE the verb makes, made by hand with no guard,
    // to show the trigger the verb is standing down is real and does fire.
    let connection = fixture();
    let error = connection
        .execute(
            "UPDATE transactions SET is_split = 1, category = '' WHERE id = ?1",
            [PARENT],
        )
        .expect_err("the protection trigger must fire");
    assert!(
        error.to_string().contains("is_split can only change through"),
        "{error}"
    );
}

#[test]
fn without_the_leg_guard_a_real_leg_edit_is_still_refused_by_the_file() {
    // The other control, and the reason the verb is allowed to hold no leg
    // guard: the trigger it does not stand down still refuses the write the verb
    // never makes. A future edit that added `amount_minor` to the pinned branch's
    // SET list would be stopped by the file even if the reviewer missed it.
    let connection = fixture();
    with_a_linked_leg(&connection);
    let error = connection
        .execute(
            "UPDATE transaction_splits SET amount_minor = -1600 WHERE id = ?1",
            [LEG_LINE],
        )
        .expect_err("S-9 must fire");
    assert!(error.to_string().contains("split_leg_locked"), "{error}");
}

// ── The happy paths ────────────────────────────────────────────────────────

#[test]
fn a_plain_split_files_the_parent_at_its_lines() {
    let mut connection = fixture();
    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-15.00", "memo": "bread" },
                { "category": OUTGOINGS, "amount": "-10.00" },
            ],
        }),
    );

    assert!(result.is_split);
    assert_eq!(result.split_count, 2);
    assert_eq!(result.amount.minor(), -2_500);
    assert_eq!(result.transaction.category.as_deref(), Some(""), "S-4");
    assert!(result.transaction.is_split);
    assert_eq!(result.splits[0].sort_order, 1);
    assert_eq!(result.splits[1].sort_order, 2);
    assert_eq!(result.splits[0].memo.as_deref(), Some("bread"));
    // The total did not change, so no balance moved.
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    every_balance_identity_holds(&connection);
}

#[test]
fn a_split_that_changes_the_total_moves_the_account_by_the_difference() {
    let mut connection = fixture();
    run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-20.00" },
                { "category": OUTGOINGS, "amount": "-20.00" },
            ],
        }),
    );

    assert_eq!(balance(&connection, EVERYDAY), -4_000);
    every_balance_identity_holds(&connection);
    assert_eq!(
        count(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log WHERE entity = 'account'"
        ),
        1,
        "the balance move is audited"
    );
}

#[test]
fn one_split_may_hold_lines_that_run_in_opposite_directions() {
    // TS-M3. The writer stores the sign it is given; a refund line inside a
    // spend does not have its sign taken from its parent.
    let mut connection = fixture();
    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-30.00" },
                { "category": OUTGOINGS, "amount": "5.00" },
            ],
        }),
    );

    assert_eq!(result.splits[0].amount.minor(), -3_000);
    assert_eq!(result.splits[1].amount.minor(), 500);
    assert_eq!(result.amount.minor(), -2_500);
    every_balance_identity_holds(&connection);
}

#[test]
fn a_line_that_becomes_a_leg_gets_its_other_side_made() {
    let mut connection = fixture();
    let leg = transfer_category(&connection, RAINY_DAY);
    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "category": leg, "amount": "-15.00",
                  "transfer_account_id": RAINY_DAY, "memo": "to savings" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );

    assert_eq!(result.counterparts.len(), 1);
    let counterpart = &result.counterparts[0];
    // Opposite of the LINE, never of the parent — the parent's total includes
    // the other lines and is supposed to differ.
    assert_eq!(counterpart.amount.minor(), 1_500);
    assert_eq!(counterpart.account_id, RAINY_DAY);
    assert_eq!(counterpart.kind, "transfer");
    assert_eq!(counterpart.date, "2024-03-01");
    assert_eq!(counterpart.description, "Corner shop");
    assert_eq!(counterpart.notes.as_deref(), Some("to savings"));
    assert!(!counterpart.is_cleared);
    assert_eq!(counterpart.transfer_account_id.as_deref(), Some(EVERYDAY));
    assert_eq!(counterpart.linked_transfer_id.as_deref(), Some(PARENT));
    // T-6: it files under the OTHER account's To/From category.
    assert_eq!(
        counterpart.category.as_deref(),
        Some(transfer_category(&connection, EVERYDAY).as_str())
    );
    // T-11: the pair is navigable from either end.
    assert_eq!(
        counterpart.linked_transfer_split_id.as_deref(),
        Some(result.splits[0].id.as_str())
    );
    assert_eq!(
        result.splits[0].linked_transfer_id.as_deref(),
        Some(counterpart.id.as_str())
    );

    assert_eq!(balance(&connection, RAINY_DAY), 1_500);
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    every_balance_identity_holds(&connection);
}

#[test]
fn a_leg_with_no_memo_inherits_the_parents_notes() {
    let mut connection = fixture();
    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-15.00", "transfer_account_id": RAINY_DAY },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(result.counterparts[0].notes.as_deref(), Some("parent notes"));
}

#[test]
fn two_legs_into_one_account_mint_two_rows_and_move_it_twice() {
    let mut connection = fixture();
    let leg = transfer_category(&connection, RAINY_DAY);
    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "category": leg, "amount": "-15.00", "transfer_account_id": RAINY_DAY },
                { "category": leg, "amount": "-10.00", "transfer_account_id": RAINY_DAY },
            ],
        }),
    );

    assert_eq!(result.counterparts.len(), 2);
    assert_eq!(balance(&connection, RAINY_DAY), 2_500);
    every_balance_identity_holds(&connection);
    // Each account move is its own audit entry, and the second one's `before`
    // is the first one's `after` — which is only true because the account row is
    // re-read per line rather than once.
    assert_eq!(
        count(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log WHERE entity = 'account'"
        ),
        2
    );
    assert_eq!(
        count(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log
              WHERE entity = 'account'
                AND json_extract(after_data, '$.balance') = '25.00'"
        ),
        1
    );
    assert_eq!(
        count(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log
              WHERE entity = 'account'
                AND json_extract(before_data, '$.balance') = '15.00'"
        ),
        1
    );
}

#[test]
fn re_sending_the_same_lines_mints_nothing_and_changes_nothing() {
    let mut connection = fixture();
    with_a_linked_leg(&connection);
    let leg = transfer_category(&connection, RAINY_DAY);
    let before_rows = count(&connection, "SELECT COUNT(*) FROM transactions");

    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": LEG_LINE, "category": leg, "amount": "-15.00",
                  "transfer_account_id": RAINY_DAY },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );

    assert!(result.counterparts.is_empty(), "no second counterpart");
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM transactions"), before_rows);
    assert_eq!(balance(&connection, RAINY_DAY), 1_500, "not 3000");
    every_balance_identity_holds(&connection);
}

#[test]
fn an_unlinked_leg_re_sent_at_the_same_target_is_left_for_the_matching_sweep() {
    // A line with a target and no link is a leg whose counterpart was deleted.
    // Minting a new one here would duplicate a movement of money that already
    // happened.
    let mut connection = fixture();
    with_an_unlinked_leg(&connection);

    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": LEG_LINE, "category": WEEKLY_SHOP, "amount": "-15.00",
                  "transfer_account_id": RAINY_DAY },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );

    assert!(result.counterparts.is_empty());
    assert_eq!(balance(&connection, RAINY_DAY), 0);
    assert!(result.splits[0].linked_transfer_id.is_none());
    assert_eq!(result.splits[0].transfer_account_id.as_deref(), Some(RAINY_DAY));
}

#[test]
fn re_pointing_an_unlinked_leg_mints_at_the_new_target() {
    let mut connection = fixture();
    with_an_unlinked_leg(&connection);

    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": LEG_LINE, "category": WEEKLY_SHOP, "amount": "-15.00",
                  "transfer_account_id": HOLIDAY },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );

    assert_eq!(result.counterparts.len(), 1);
    assert_eq!(result.counterparts[0].account_id, HOLIDAY);
    assert_eq!(balance(&connection, HOLIDAY), 1_500);
    assert_eq!(balance(&connection, RAINY_DAY), 0);
    every_balance_identity_holds(&connection);
}

#[test]
fn a_line_that_loses_its_target_keeps_its_money_and_loses_the_leg() {
    let mut connection = fixture();
    with_an_unlinked_leg(&connection);

    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": LEG_LINE, "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );

    assert!(result.splits[0].transfer_account_id.is_none());
    assert_eq!(result.splits[0].amount.minor(), -1_500);
    assert!(result.counterparts.is_empty());
}

#[test]
fn an_ordinary_line_can_be_dropped_while_a_leg_stays() {
    let mut connection = fixture();
    with_a_linked_leg(&connection);
    let leg = transfer_category(&connection, RAINY_DAY);

    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": LEG_LINE, "category": leg, "amount": "-15.00",
                  "transfer_account_id": RAINY_DAY },
                { "category": WEEKLY_SHOP, "amount": "-5.00" },
                { "category": OUTGOINGS, "amount": "-5.00" },
            ],
        }),
    );

    assert_eq!(result.split_count, 3);
    assert_eq!(
        count(
            &connection,
            &format!("SELECT COUNT(*) FROM transaction_splits WHERE id = '{PLAIN_LINE}'")
        ),
        0,
        "the ordinary line went"
    );
    every_balance_identity_holds(&connection);
}

#[test]
fn a_split_writes_one_audit_row_at_its_parent_carrying_both_line_sets() {
    let mut connection = fixture();
    with_a_linked_leg(&connection);
    let leg = transfer_category(&connection, RAINY_DAY);

    run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": LEG_LINE, "category": leg, "amount": "-15.00",
                  "transfer_account_id": RAINY_DAY },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00", "memo": "new" },
            ],
        }),
    );

    assert_eq!(
        count(
            &connection,
            &format!(
                "SELECT COUNT(*) FROM financial_audit_log
                  WHERE entity = 'transaction' AND entity_id = '{PARENT}' AND action = 'update'
                    AND json_array_length(before_data, '$.splits') = 2
                    AND json_array_length(after_data, '$.splits') = 2"
            )
        ),
        1,
        "U-4: audited at the parent, with the whole line set on both sides"
    );
    assert_eq!(
        count(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log
              WHERE json_extract(after_data, '$.splits[1].memo') = 'new'"
        ),
        1
    );
}

// ── The refusals that have no differential twin worth spending a spec on ───

#[test]
fn every_named_refusal_leaves_the_ledger_exactly_as_it_was() {
    let cases: Vec<(&str, serde_json::Value)> = vec![
        ("splits_not_an_array", serde_json::json!("nope")),
        ("split_needs_two_lines", serde_json::json!([])),
        (
            "split_line_needs_a_category",
            serde_json::json!([{ "amount": "-15.00" }, { "category": WEEKLY_SHOP, "amount": "-10.00" }]),
        ),
        (
            "split_line_needs_an_amount",
            serde_json::json!([{ "category": WEEKLY_SHOP }, { "category": WEEKLY_SHOP, "amount": "-10.00" }]),
        ),
        (
            "unknown_category",
            serde_json::json!([
                { "category": "no-such-category", "amount": "-15.00" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "account_not_found_or_not_owned",
            serde_json::json!([
                { "category": WEEKLY_SHOP, "amount": "-15.00", "transfer_account_id": SOMEONE_ELSES },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "transfer_needs_two_accounts",
            serde_json::json!([
                { "category": WEEKLY_SHOP, "amount": "-15.00", "transfer_account_id": EVERYDAY },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "transfer_currency_mismatch",
            serde_json::json!([
                { "category": WEEKLY_SHOP, "amount": "-15.00", "transfer_account_id": DOLLARS },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "split_line_not_found",
            serde_json::json!([
                { "id": "50000000-0000-0000-0000-0000000000ff", "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "split_line_id_repeated",
            serde_json::json!([
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "unknown_field",
            serde_json::json!([
                { "category": WEEKLY_SHOP, "amount": "-15.00", "memmo": "a typo" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "amount_must_be_a_string",
            serde_json::json!([
                { "category": WEEKLY_SHOP, "amount": -15 },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ]),
        ),
        (
            "amount_not_representable",
            serde_json::json!([
                { "category": WEEKLY_SHOP, "amount": "-15.005" },
                { "category": WEEKLY_SHOP, "amount": "-9.995" },
            ]),
        ),
    ];

    for (code, splits) in cases {
        let mut connection = fixture();
        let error = refuse(
            &mut connection,
            serde_json::json!({ "id": PARENT, "user_id": OWNER, "splits": splits }),
        );
        assert_eq!(error.code(), code, "{error}");
        // Nothing was written, on every one of them.
        assert_eq!(
            count(&connection, "SELECT COUNT(*) FROM transaction_splits"),
            0,
            "{code} left split lines behind"
        );
        assert_eq!(balance(&connection, EVERYDAY), -2_500, "{code} moved money");
        assert_eq!(
            count(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
            0,
            "{code} wrote an audit row for a write that did not happen"
        );
        every_balance_identity_holds(&connection);
    }
}

#[test]
fn the_pinned_leg_refusals_fire_in_the_rpcs_order() {
    // Amount beats target beats category — MEASURED on the reference cluster
    // with payloads that break two at once. Reproduced here because the SAME
    // payload has to produce the SAME first error on both engines, or the
    // sentence the user reads depends on where the app is running.
    let mut connection = fixture();
    with_a_leg_filed_ordinarily(&connection);
    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                // Wrong amount AND wrong target AND wrong category.
                { "id": LEG_LINE, "category": OUTGOINGS, "amount": "-16.00",
                  "transfer_account_id": HOLIDAY },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-9.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "split_leg_amount_locked");
    assert!(
        error.to_string().contains("has to stay -15.00"),
        "the refusal names the amount it is pinned to: {error}"
    );

    let mut connection = fixture();
    with_a_leg_filed_ordinarily(&connection);
    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                { "id": LEG_LINE, "category": OUTGOINGS, "amount": "-15.00",
                  "transfer_account_id": HOLIDAY },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "split_leg_target_locked");
    assert!(error.to_string().contains("Rainy day"), "{error}");

    let mut connection = fixture();
    with_a_leg_filed_ordinarily(&connection);
    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                { "id": LEG_LINE, "category": OUTGOINGS, "amount": "-15.00",
                  "transfer_account_id": RAINY_DAY },
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "split_leg_category_locked");
}

#[test]
fn a_leg_that_is_dropped_is_named_by_the_account_it_transfers_to() {
    let mut connection = fixture();
    with_a_linked_leg(&connection);
    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                { "id": PLAIN_LINE, "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "split_leg_line_removed");
    assert!(
        error.to_string().contains("transferring to \"Rainy day\""),
        "{error}"
    );
    // And the leg is still there, with its counterpart.
    assert_eq!(
        count(
            &connection,
            &format!("SELECT COUNT(*) FROM transaction_splits WHERE id = '{LEG_LINE}'")
        ),
        1
    );
    every_balance_identity_holds(&connection);
}

#[test]
fn a_transfer_still_cannot_be_split() {
    let mut connection = fixture();
    connection
        .execute(
            "UPDATE transactions SET type = 'transfer', transfer_account_id = ?1 WHERE id = ?2",
            [RAINY_DAY, PARENT],
        )
        .expect("make it a transfer");
    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "transfer_cannot_be_split");
}

#[test]
fn somebody_elses_split_is_refused_by_name() {
    let mut connection = fixture();
    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": STRANGER,
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-15.00" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "transaction_not_found");
}

#[test]
fn a_parent_can_no_longer_be_filed_against_somebody_elses_account_at_all() {
    // WAS: `a_parent_filed_against_somebody_elses_account_refuses_rather_than_
    //       losing_the_money`, until 2026-08-08.
    //
    // That test drove REFUSAL 21 OF 21 — the second
    // `account_not_found_or_not_owned` in this verb, the one a port is most
    // likely to drop because it looks like a copy of the first. The first is
    // about the account a LEG points at; this one is about the account the
    // PARENT sits in, it fires at the very end, and it was reachable only
    // through "the pairing neither schema forbids": this user's transaction
    // sitting against an account they do not own.
    //
    // Both schemas forbid it now (schema.sql "THE OWNERSHIP PAIRING"; cloud
    // 20260808170000), so the fixture cannot be planted and the branch cannot
    // be reached. This test measures the refusal that replaced it.
    //
    // The refusal itself stays in the verb, unweakened. The reasoning behind it
    // has not expired: a writer that stored the lines and skipped an
    // unreachable balance move would leave B-1 broken permanently and silently,
    // which is the shape AUDIT3 §3 measured on the create path. What has
    // changed is that the state which reached it can no longer be written.
    //
    // The differential twin is scripts/local-sqlite/specs/r12-a-row-cannot-be-
    // moved-onto-a-strangers-account.spec.mjs, which also proves the key holds
    // on UPDATE — the direction that matters here, because a split writer edits
    // a row that already exists.
    let connection = fixture();

    let planted = connection.execute_batch(&format!(
        "INSERT INTO transactions
           (id, user_id, account_id, description, amount_minor, type, date, category)
         VALUES ('70000000-0000-0000-0000-00000000000f', '{OWNER}', '{SOMEONE_ELSES}',
                 'Filed against a stranger', -1000, 'expense', '2024-05-01', '{WEEKLY_SHOP}');"
    ));
    let error = planted.expect_err("the ownership key must refuse this row");
    assert!(
        error.to_string().contains("FOREIGN KEY constraint failed"),
        "expected the ownership key, got: {error}"
    );

    // And the same is true of moving a row that already exists: the split
    // writer's world is edits, so this is the direction that would have to be
    // closed for the branch to stay unreachable.
    let moved = connection.execute_batch(&format!(
        "UPDATE transactions SET account_id = '{SOMEONE_ELSES}' WHERE id = '{PARENT}';"
    ));
    let error = moved.expect_err("the ownership key must refuse the move too");
    assert!(
        error.to_string().contains("FOREIGN KEY constraint failed"),
        "expected the ownership key, got: {error}"
    );

    assert_eq!(balance(&connection, SOMEONE_ELSES), 0);
    every_balance_identity_holds(&connection);
}

#[test]
fn a_leg_filed_under_a_to_from_category_must_name_the_same_account() {
    let mut connection = fixture();
    let rainy = transfer_category(&connection, RAINY_DAY);

    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                { "category": rainy, "amount": "-15.00" },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "split_leg_not_declared");

    let error = refuse(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "splits": [
                { "category": rainy, "amount": "-15.00", "transfer_account_id": HOLIDAY },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(error.code(), "split_leg_category_mismatch");
}

#[test]
fn a_leg_may_be_filed_under_an_ordinary_category() {
    // The converse of S-8 is deliberately NOT required, and this is the
    // population that depends on it: the MS Money importer filed 86 legs under
    // the Unassigned bucket. Demanding a To/From category here would make
    // exactly the splits this writer exists to unblock uneditable again.
    let mut connection = fixture();
    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "category": WEEKLY_SHOP, "amount": "-15.00", "transfer_account_id": RAINY_DAY },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(result.counterparts.len(), 1);
    assert_eq!(result.splits[0].category, WEEKLY_SHOP);
}

#[test]
fn a_whitespace_id_is_a_new_line_and_a_whitespace_memo_is_no_memo() {
    let mut connection = fixture();
    let result = run(
        &mut connection,
        serde_json::json!({
            "id": PARENT,
            "user_id": OWNER,
            "expected_amount": "-25.00",
            "splits": [
                { "id": "  ", "category": WEEKLY_SHOP, "amount": "-15.00", "memo": "   " },
                { "category": WEEKLY_SHOP, "amount": "-10.00" },
            ],
        }),
    );
    assert_eq!(result.split_count, 2);
    assert!(result.splits[0].memo.is_none());
    assert_ne!(result.splits[0].id, "  ");
}
