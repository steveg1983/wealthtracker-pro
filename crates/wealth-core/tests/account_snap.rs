//! Integration tests for `link_bank_account_snap`, against the real vendored
//! schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`: six specs
//! running the same payload against the live RPC and this verb. What is here is
//! the half with **no Postgres counterpart**:
//!
//! 1. **The audit payload**, field by field. The differential harness compares
//!    stored rows, and the entry this verb writes is the only record of a rebase
//!    — the one moment a balance is assigned rather than moved. What it holds is
//!    what makes the rebase reconstructible, and that is a local shape (the hash
//!    chain has no cloud twin).
//! 2. **The arithmetic at the ends of the range.** The delta is `bank − balance`,
//!    and both operands are bounded at ±1e15 minor, so their difference can be
//!    2e15 — well inside `i64`, and the checked arithmetic is there for the case
//!    where a caller has not yet met the CHECK.
//! 3. **The NULL bank balance the cloud accepts.** MEASURED there: it sets
//!    `balance`, `initial_balance` and `bank_balance` all to NULL and destroys the
//!    account's ledger. It is unreachable here, by two independent constructions,
//!    and a test that says which two is worth more than a note.
//!
//! All data is invented.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::money::Money;
use wealth_core::verbs::{link_bank_account_snap, LinkBankAccountSnap};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";

/// One account at −25.00 with the one −25.00 row that justifies it, so B-1 holds
/// before anything happens.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
               VALUES ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense',
                       '2024-03-01');"
        ))
        .expect("fixture");
    connection
}

fn snap(connection: &mut Connection, bank: &str) -> wealth_core::verbs::LinkBankAccountSnapResult {
    link_bank_account_snap(
        connection,
        LinkBankAccountSnap {
            account_id: EVERYDAY.to_owned(),
            user_id: OWNER.to_owned(),
            bank_balance: Money::parse(bank).expect("a decimal"),
        },
    )
    .expect("snap")
}

fn balances(connection: &Connection) -> (i64, i64, Option<i64>) {
    connection
        .query_row(
            "SELECT balance_minor, initial_balance_minor, bank_balance_minor
               FROM accounts WHERE id = ?1",
            [EVERYDAY],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("read")
}

#[test]
fn the_audit_entry_records_both_sides_of_the_rebase() {
    // This is the only record that a balance was ASSIGNED rather than moved, and
    // it is the thing a person would go looking for when an account's opening
    // balance is not what they remember.
    let mut connection = fixture();
    let result = snap(&mut connection, "10.00");

    let (action, before, after): (String, Option<String>, Option<String>) = connection
        .query_row(
            "SELECT action, before_data, after_data FROM financial_audit_log WHERE seq = ?1",
            [result.audit_seq],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("the entry");

    assert_eq!(action, "update");
    let before: serde_json::Value =
        serde_json::from_str(&before.expect("U-6: an update has a before")).expect("json");
    let after: serde_json::Value =
        serde_json::from_str(&after.expect("U-6: an update has an after")).expect("json");

    // Money leaves this crate as a STRING at every boundary, the audit payload
    // included: a JSON number is a binary float the moment any parser reads it,
    // and an audit trail made of floats is not evidence of anything.
    assert_eq!(before["balance"], serde_json::json!("-25.00"));
    assert_eq!(before["initial_balance"], serde_json::json!("0.00"));
    assert_eq!(after["balance"], serde_json::json!("10.00"));
    assert_eq!(after["initial_balance"], serde_json::json!("35.00"));
    assert_eq!(after["id"], serde_json::json!(EVERYDAY));
}

#[test]
fn the_ledger_identity_survives_a_rebase_in_either_direction() {
    // B-1: balance = initial_balance + Σ(amount). The one −25.00 row never moves,
    // so initial_balance has to absorb the whole delta both ways.
    for (bank, expected_initial) in [("10.00", 3_500_i64), ("-100.00", -7_500), ("-25.00", 0)] {
        let mut connection = fixture();
        snap(&mut connection, bank);
        let (balance, initial, bank_balance) = balances(&connection);
        assert_eq!(balance, Money::parse(bank).expect("decimal").minor(), "snapping to {bank}");
        assert_eq!(initial, expected_initial, "snapping to {bank}");
        assert_eq!(bank_balance, Some(balance), "bank_balance is the reference figure");

        let sum: i64 = connection
            .query_row(
                "SELECT COALESCE(SUM(amount_minor), 0) FROM transactions WHERE account_id = ?1",
                [EVERYDAY],
                |row| row.get(0),
            )
            .expect("sum");
        assert_eq!(balance, initial.saturating_add(sum), "B-1 broke snapping to {bank}");
    }
}

#[test]
fn a_second_snap_rebases_from_where_the_first_one_left_it() {
    // The link handler can run twice — a reconnect, a re-authorisation — and each
    // snap must be relative to the CURRENT balance, not to the original one.
    let mut connection = fixture();
    snap(&mut connection, "10.00");
    snap(&mut connection, "40.00");
    let (balance, initial, _) = balances(&connection);
    assert_eq!(balance, 4_000);
    assert_eq!(initial, 6_500, "0 + (10 − −25) + (40 − 10) = 65.00");

    let entries: i64 = connection
        .query_row("SELECT COUNT(*) FROM financial_audit_log", [], |row| row.get(0))
        .expect("count");
    assert_eq!(entries, 2, "each rebase is its own entry");
}

#[test]
fn a_figure_the_file_cannot_hold_is_refused_and_nothing_moves() {
    // The bound is the SCHEMA's, not this verb's: duplicating it here is how the
    // two copies drift. What the verb owes is that the refusal leaves the account
    // exactly as it was.
    let mut connection = fixture();
    let error = link_bank_account_snap(
        &mut connection,
        LinkBankAccountSnap {
            account_id: EVERYDAY.to_owned(),
            user_id: OWNER.to_owned(),
            bank_balance: Money::from_minor(Money::STOCK_BOUND_MINOR.saturating_add(1)),
        },
    )
    .expect_err("past the stock bound");
    assert!(error.to_string().contains("accounts_balance_bounded"), "{error}");
    assert_eq!(balances(&connection), (-2_500, 0, None));

    let entries: i64 = connection
        .query_row("SELECT COUNT(*) FROM financial_audit_log", [], |row| row.get(0))
        .expect("count");
    assert_eq!(entries, 0, "a refused snap leaves no evidence of a change that never happened");
}

#[test]
fn money_cannot_reach_this_verb_as_a_json_number() {
    // The cloud's NULL-bank-balance defect (MEASURED there: it nulls balance,
    // initial_balance and bank_balance together and destroys the ledger) is
    // unreachable here by TWO independent constructions, and this is the first:
    // the argument is a Money, which has no null and no float.
    let error = serde_json::from_str::<LinkBankAccountSnap>(&format!(
        r#"{{"account_id":"{EVERYDAY}","user_id":"{OWNER}","bank_balance":10.0}}"#
    ))
    .expect_err("a JSON number is a float");
    assert!(error.to_string().contains("amount_must_be_a_string"), "{error}");

    // …and the second: the column itself. Even a caller reaching past the verb
    // cannot leave the ledger with no balance at all.
    let connection = fixture();
    let refused = connection.execute_batch(&format!(
        "UPDATE accounts SET balance_minor = NULL WHERE id = '{EVERYDAY}';"
    ));
    assert!(refused.is_err(), "accounts.balance_minor is NOT NULL for exactly this reason");
}

#[test]
fn a_null_bank_balance_is_not_a_shape_the_command_has() {
    let error = serde_json::from_str::<LinkBankAccountSnap>(&format!(
        r#"{{"account_id":"{EVERYDAY}","user_id":"{OWNER}","bank_balance":null}}"#
    ))
    .expect_err("null is not a decimal string");
    assert!(!error.to_string().is_empty());
}
