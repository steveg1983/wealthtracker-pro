//! Integration tests for the delete verb, against the real vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`. What is
//! here is the half that needs no Postgres cluster — and, above all, the leg
//! guard, which is a purely local mechanism with no Postgres counterpart to
//! compare against: in the cloud there is nothing to stand down.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::verbs::{delete_transaction, DeleteTransaction, DeleteTransactionResult};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const SOMEONE_ELSES: &str = "a0000000-0000-0000-0000-000000000009";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const PARENT: &str = "70000000-0000-0000-0000-000000000001";
const COUNTERPART: &str = "70000000-0000-0000-0000-000000000009";
const LEG_LINE: &str = "50000000-0000-0000-0000-000000000001";
const PLAIN_LINE: &str = "50000000-0000-0000-0000-000000000002";
const FOREIGN_ROW: &str = "70000000-0000-0000-0000-00000000000f";

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
               ('c0000000-0000-0000-0000-000000000002', '{OWNER}', 'Outgoings', 'expense', 'type');
             INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{WEEKLY_SHOP}', '{OWNER}', 'Weekly shop', 'expense', 'sub',
                'c0000000-0000-0000-0000-000000000002');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor) VALUES
               ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0),
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 0, 0),
               ('{SOMEONE_ELSES}', '{STRANGER}', 'Not yours', 'checking', 0, 0);
             INSERT INTO transactions
               (id, user_id, account_id, description, amount_minor, type, date, category)
             VALUES
               ('{PARENT}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense', '2024-03-01',
                '{WEEKLY_SHOP}');",
        ))
        .expect("fixture");
    connection
}

/// The R-5 shape: the Corner shop row becomes a split of -15.00 (a transfer
/// leg) and -10.00, and the leg points at a +15.00 counterpart in Rainy day.
/// Both balances are kept honest so B-1 holds before the verb runs.
fn with_a_transfer_leg(connection: &Connection) {
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
             VALUES ('{LEG_LINE}', '{PARENT}', '{OWNER}',
                     (SELECT id FROM categories
                       WHERE account_id = '{RAINY_DAY}' AND is_transfer_category = 1),
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

fn command(id: &str, user_id: Option<&str>) -> DeleteTransaction {
    serde_json::from_value(match user_id {
        Some(user) => serde_json::json!({ "id": id, "user_id": user }),
        None => serde_json::json!({ "id": id }),
    })
    .expect("command")
}

fn run(connection: &mut Connection, command: DeleteTransaction) -> DeleteTransactionResult {
    delete_transaction(connection, command).expect("the verb should have accepted this")
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

#[test]
fn deleting_a_row_gives_its_amount_back_to_the_account() {
    let mut connection = fixture();
    let result = run(&mut connection, command(PARENT, Some(OWNER)));

    assert_eq!(result.transaction.amount.minor(), -2_500);
    assert_eq!(result.transaction.description, "Corner shop");
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM transactions"), 0);
    assert_eq!(balance(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, EVERYDAY), 0, "B-1 must hold");
}

#[test]
fn a_delete_writes_one_audit_row_with_a_before_and_no_after() {
    let mut connection = fixture();
    let result = run(&mut connection, command(PARENT, Some(OWNER)));

    let (action, before, after_is_null, seq, hash): (String, String, i64, i64, String) = connection
        .query_row(
            "SELECT action, before_data, after_data IS NULL, seq, row_hash
               FROM financial_audit_log",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .expect("exactly one audit row");

    assert_eq!(action, "delete");
    assert_eq!(after_is_null, 1, "U-6: a delete has no after");
    assert_eq!(seq, result.audit_seq);
    assert_eq!(hash, result.audit_row_hash);

    // The only surviving record that the row existed, and its money is a
    // decimal string in it.
    let before: serde_json::Value = serde_json::from_str(&before).expect("json");
    assert_eq!(before["amount"], serde_json::json!("-25.00"));
    assert_eq!(before["id"], serde_json::json!(PARENT));
}

#[test]
fn somebody_elses_row_is_refused_by_name_and_nothing_happens() {
    let mut connection = fixture();
    let error =
        delete_transaction(&mut connection, command(PARENT, Some(STRANGER))).expect_err("refuse");
    assert_eq!(error.code(), "transaction_not_found");
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM transactions"), 1);
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM financial_audit_log"), 0);
}

#[test]
fn a_row_that_does_not_exist_refuses_the_same_way() {
    let mut connection = fixture();
    let error = delete_transaction(
        &mut connection,
        command("70000000-0000-0000-0000-0000000000ff", Some(OWNER)),
    )
    .expect_err("refuse");
    assert_eq!(error.code(), "transaction_not_found");
}

#[test]
fn the_row_that_would_reach_no_account_cannot_be_written_at_all() {
    // WAS: `a_delete_whose_balance_write_reaches_no_account_refuses_and_keeps_
    //       the_row`, until 2026-08-08.
    //
    // That test drove the verb's `changes() != 1` assert on the only path that
    // reached it: a row this user owns, sitting against an account they do not.
    // AUDIT3 §3 measured what SQLite does without the assert — nothing at all:
    // the row vanishes and the balance keeps its money for ever.
    //
    // The pairing is now refused by the schema, on both engines
    // (schema.sql "THE OWNERSHIP PAIRING"; cloud 20260808170000). So the
    // fixture cannot be planted, and this test measures THAT instead — the
    // assert's guard is now a key, and a key is not something a later code path
    // can forget to apply.
    //
    // The assert stays in the verb, unweakened, for the day somebody adds a
    // write path that reaches a balance without going through this key. It is
    // second now, not gone. The differential twin of this is
    // scripts/local-sqlite/specs/r12-a-row-cannot-be-filed-against-a-strangers-
    // account.spec.mjs, which proves both engines refuse it and not merely this
    // one.
    let connection = fixture();
    let planted = connection.execute_batch(&format!(
        "INSERT INTO transactions
           (id, user_id, account_id, description, amount_minor, type, date)
         VALUES ('{FOREIGN_ROW}', '{OWNER}', '{SOMEONE_ELSES}', 'Filed against a stranger',
                 -1000, 'expense', '2024-05-01');"
    ));

    let error = planted.expect_err("the ownership key must refuse this row");
    assert!(
        error.to_string().contains("FOREIGN KEY constraint failed"),
        "expected the ownership key, got: {error}"
    );

    // Nothing landed, and the stranger's ledger is exactly as it was.
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM transactions"), 1);
    assert_eq!(balance(&connection, SOMEONE_ELSES), 0);
    assert_eq!(identity(&connection, SOMEONE_ELSES), 0, "B-1 holds");
    // The account IS there — so it is the OWNERSHIP half of the composite key
    // refusing this, not the existence half a single-column key already had.
    assert_eq!(
        count(
            &connection,
            &format!("SELECT COUNT(*) FROM accounts WHERE id = '{SOMEONE_ELSES}'")
        ),
        1
    );
}

#[test]
fn deleting_half_a_linked_transfer_unlinks_the_other_half() {
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions
               (id, user_id, account_id, description, amount_minor, type, date, transfer_account_id)
             VALUES
               ('70000000-0000-0000-0000-000000000004', '{OWNER}', '{EVERYDAY}', 'To savings',
                -1500, 'transfer', '2024-04-01', '{RAINY_DAY}'),
               ('70000000-0000-0000-0000-000000000005', '{OWNER}', '{RAINY_DAY}', 'From everyday',
                 1500, 'transfer', '2024-04-01', '{EVERYDAY}');
             UPDATE transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000005'
              WHERE id = '70000000-0000-0000-0000-000000000004';
             UPDATE transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000004'
              WHERE id = '70000000-0000-0000-0000-000000000005';
             UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '{EVERYDAY}';
             UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '{RAINY_DAY}';"
        ))
        .expect("pair fixture");

    run(
        &mut connection,
        command("70000000-0000-0000-0000-000000000004", Some(OWNER)),
    );

    let (survives, link): (i64, Option<String>) = connection
        .query_row(
            "SELECT COUNT(*), MAX(linked_transfer_id) FROM transactions
              WHERE id = '70000000-0000-0000-0000-000000000005'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("survivor");
    assert_eq!(survives, 1, "T-8: SET NULL, never CASCADE");
    assert_eq!(link, None, "the survivor is unlinked, not deleted");

    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(balance(&connection, RAINY_DAY), 1_500);
    assert_eq!(identity(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, RAINY_DAY), 0);
}

// ── R-5, both directions ────────────────────────────────────────────────────

#[test]
fn deleting_a_transaction_a_split_line_links_to_clears_the_line() {
    // The addendum's case: SET NULL on the split line is an UPDATE, and that
    // UPDATE fires trg_protect_linked_leg. Without the guard this whole verb
    // refuses — including when it is the remedy the error message recommends.
    let mut connection = fixture();
    with_a_transfer_leg(&connection);

    run(&mut connection, command(COUNTERPART, Some(OWNER)));

    let (survives, link): (i64, Option<String>) = connection
        .query_row(
            "SELECT COUNT(*), MAX(linked_transfer_id) FROM transaction_splits WHERE id = ?1",
            [LEG_LINE],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("leg line");
    assert_eq!(survives, 1, "R-5: the line is cleared, never cascaded");
    assert_eq!(link, None);

    // The split parent is untouched, so Everyday does not move; Rainy day gives
    // back what the deleted counterpart put there.
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(balance(&connection, RAINY_DAY), 0);
    assert_eq!(identity(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, RAINY_DAY), 0);
}

#[test]
fn deleting_a_split_parent_whose_own_line_is_a_leg_succeeds_too() {
    // The direction the addendum had not seen: the cascade fires
    // trg_protect_linked_leg_delete instead, and Postgres accepts this delete,
    // so a guard covering only the other direction would diverge silently.
    let mut connection = fixture();
    with_a_transfer_leg(&connection);

    run(&mut connection, command(PARENT, Some(OWNER)));

    assert_eq!(
        count(&connection, "SELECT COUNT(*) FROM transaction_splits"),
        0,
        "the lines go with their parent — that is the cascade, and it is right"
    );

    // The counterpart in the other account survives, stranded rather than left
    // pointing at a ghost, and its money never moved.
    let (survives, link): (i64, Option<String>) = connection
        .query_row(
            "SELECT COUNT(*), MAX(linked_transfer_split_id) FROM transactions WHERE id = ?1",
            [COUNTERPART],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("counterpart");
    assert_eq!(survives, 1);
    assert_eq!(link, None);
    assert_eq!(balance(&connection, RAINY_DAY), 1_500);
    assert_eq!(balance(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, RAINY_DAY), 0);
}

#[test]
fn the_leg_guard_is_released_and_is_never_taken_when_it_is_not_needed() {
    // A flag left behind would silently disable the leg protection for every
    // later write on this file, so the release is asserted after both the
    // guarded path and the unguarded one.
    let mut connection = fixture();
    with_a_transfer_leg(&connection);

    run(&mut connection, command(COUNTERPART, Some(OWNER)));
    assert_eq!(count(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);

    let mut connection = fixture();
    run(&mut connection, command(PARENT, Some(OWNER)));
    assert_eq!(
        count(&connection, "SELECT COUNT(*) FROM _rpc_guard"),
        0,
        "an ordinary delete has no business standing a protection trigger down"
    );
}

#[test]
fn the_guard_does_not_survive_a_refusal() {
    // The guard is inserted and released inside the same transaction as the
    // delete it authorises, so a refusal takes it with everything else. Proved
    // against a refusal that happens AFTER the guard has been taken.
    //
    // WHICH REFUSAL, and why it changed on 2026-08-08. This used to point the
    // counterpart at an account its owner does not own, so that the balance
    // reversal found nothing and the verb refused on `changes() != 1`. The
    // ownership key (schema.sql "THE OWNERSHIP PAIRING") makes that row
    // unwritable, and in doing so makes `changes() != 1` unreachable on this
    // path — so a refusal that is still reachable had to be found, and there is
    // one: the balance column's own bound.
    //
    // `accounts_balance_bounded` caps a balance at ±1e15 minor (schema.sql,
    // "OVERFLOW ARITHMETIC" — int64 cannot hold a scaled numeric(20,2), so the
    // cliff is real rather than decorative). Rainy day is parked ON the floor
    // with two rows that cancel, so B-1 holds; deleting the +15.00 counterpart
    // reverses it to −15.00 BELOW the floor and the CHECK fires — after the
    // guard was taken, after the DELETE, inside the same transaction.
    let mut connection = fixture();
    with_a_transfer_leg(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions
               (id, user_id, account_id, description, amount_minor, type, date, category)
             VALUES ('70000000-0000-0000-0000-0000000000b1', '{OWNER}', '{RAINY_DAY}',
                     'Cancels the counterpart', -1500, 'expense', '2024-03-01', '{WEEKLY_SHOP}');
             UPDATE accounts
                SET balance_minor = -1000000000000000, initial_balance_minor = -1000000000000000
              WHERE id = '{RAINY_DAY}';"
        ))
        .expect("park the account on the floor");
    assert_eq!(identity(&connection, RAINY_DAY), 0, "B-1 holds before");

    let error =
        delete_transaction(&mut connection, command(COUNTERPART, Some(OWNER))).expect_err("refuse");
    assert_eq!(error.code(), "constraint_violated");
    assert!(
        error.to_string().contains("accounts_balance_bounded"),
        "the balance bound must be what refused this, got: {error}"
    );

    assert_eq!(
        count(&connection, "SELECT COUNT(*) FROM _rpc_guard"),
        0,
        "the flag rolled back with the transaction it belonged to"
    );
    // And the leg is still linked, because the delete rolled back too.
    let link: Option<String> = connection
        .query_row(
            "SELECT linked_transfer_id FROM transaction_splits WHERE id = ?1",
            [LEG_LINE],
            |row| row.get(0),
        )
        .expect("leg line");
    assert_eq!(link.as_deref(), Some(COUNTERPART));
}

#[test]
fn an_unrecognised_key_is_refused_rather_than_discarded() {
    let error = serde_json::from_value::<DeleteTransaction>(serde_json::json!({
        "id": PARENT,
        "user_id": OWNER,
        "cascade": true,
    }))
    .expect_err("must refuse");
    assert!(error.to_string().contains("cascade"), "{error}");
}

#[test]
fn the_delete_verb_moves_no_balance_by_assignment() {
    // B-2, tested the only way an absence can be. The verb reverses with
    // `balance_minor = balance_minor - ?`; anything that assigns an absolute
    // figure would be a new and forbidden shape.
    let verb = include_str!("../src/verbs/delete_transaction.rs");
    assert!(
        verb.contains("balance_minor = balance_minor - ?1"),
        "the relative reversal is the point of this verb",
    );
    assert!(
        !verb.contains("SET balance_minor = ?"),
        "balance must move relatively, in SQL, never by assignment",
    );
}
