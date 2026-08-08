//! Integration tests for the first verb, against the real vendored schema.
//!
//! These are the crate's own guarantees. They are NOT the differential proof —
//! that lives in `scripts/local-sqlite/verbs.mjs`, which runs the same
//! operations through the Postgres RPC as well and compares. What is here is the
//! half that does not need a Postgres cluster: the balance identity, the
//! `changes()` assert, the audit row and its chain.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::money::Money;
use wealth_core::verbs::{create_transaction, CreateTransaction, CreateTransactionResult};
use wealth_core::wire::Flag;

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const SOMEONE_ELSES: &str = "a0000000-0000-0000-0000-000000000009";
/// An id nothing has — the EXISTENCE half of the ownership key, as against the
/// OWNERSHIP half that `SOMEONE_ELSES` exercises.
const NO_SUCH_ACCOUNT: &str = "a0000000-0000-0000-0000-0000000000ff";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";

/// A file with the same starting state as the constraint harness's fixture,
/// plus a second user who owns an account this one does not.
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
               ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', 0, 0),
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 0, 0),
               ('{SOMEONE_ELSES}', '{STRANGER}', 'Not yours', 'checking', 0, 0);",
        ))
        .expect("fixture");
    connection
}

fn command(amount: &str, kind: &str) -> CreateTransaction {
    serde_json::from_value(serde_json::json!({
        "user_id": OWNER,
        "account_id": EVERYDAY,
        "description": "Corner shop",
        "amount": amount,
        "type": kind,
        "date": "2024-03-01",
        "category": WEEKLY_SHOP,
    }))
    .expect("command")
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

fn run(connection: &mut Connection, command: CreateTransaction) -> CreateTransactionResult {
    create_transaction(connection, command).expect("the verb should have accepted this")
}

#[test]
fn an_expense_moves_the_balance_by_its_own_amount() {
    let mut connection = fixture();
    let result = run(&mut connection, command("-25.00", "expense"));
    assert_eq!(result.transaction.amount, Money::from_minor(-2_500));
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    // B-1: balance = initial_balance + SUM(amount), for this account.
    let identity: i64 = connection
        .query_row(
            "SELECT a.balance_minor - (a.initial_balance_minor
                      + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                                   WHERE t.account_id = a.id), 0))
               FROM accounts a WHERE a.id = ?1",
            [EVERYDAY],
            |row| row.get(0),
        )
        .expect("identity");
    assert_eq!(identity, 0, "B-1 must hold after the verb");
}

#[test]
fn income_moves_the_balance_the_other_way() {
    let mut connection = fixture();
    run(&mut connection, command("1200.50", "income"));
    assert_eq!(balance(&connection, EVERYDAY), 120_050);
}

#[test]
fn a_zero_amount_row_is_accepted_and_moves_nothing() {
    let mut connection = fixture();
    let result = run(&mut connection, command("0.00", "expense"));
    assert_eq!(result.transaction.amount, Money::ZERO);
    assert_eq!(balance(&connection, EVERYDAY), 0);
    // It still had to hit exactly one account row: the changes() assert is not
    // satisfied by "the balance did not need to move".
    assert_eq!(result.audit_seq, 1);
}

#[test]
fn an_account_owned_by_somebody_else_is_refused_before_a_balance_can_move() {
    // WAS: `an_account_owned_by_somebody_else_is_refused_by_name`, until
    // 2026-08-08, when the ownership key took over the job.
    //
    // The name was accurate while the verb's own `changes() != 1` assert was
    // what fired. `transactions.account_id` is now a key on (account, owner)
    // (schema.sql "THE OWNERSHIP PAIRING"; cloud 20260808170000), so the INSERT
    // is refused before any balance statement is reached — and the cloud RPC
    // behaves identically, refusing at `transactions_account_id_user_fkey`
    // rather than at its own `account_not_found_or_not_owned`. Both engines
    // converged on the key, which is what
    // verb-specs/b2-an-account-owned-by-somebody-else-is-refused-by-name.spec
    // .mjs now measures.
    //
    // What separates this from its sibling below is no longer the error, which
    // is now identical: it is that the account named here EXISTS. Only the
    // ownership half of the composite key can refuse this one; a single-column
    // key would have taken the row.
    let mut connection = fixture();
    let mut payload = command("-10.00", "expense");
    payload.account_id = SOMEONE_ELSES.to_owned();

    let error = create_transaction(&mut connection, payload).expect_err("must refuse");
    assert_eq!(error.code(), "constraint_violated");
    assert!(
        error.to_string().contains("FOREIGN KEY constraint failed"),
        "expected the ownership key, got: {error}"
    );

    let present: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE id = ?1",
            [SOMEONE_ELSES],
            |row| row.get(0),
        )
        .expect("count");
    assert_eq!(present, 1, "the account named is real — only ownership refused it");

    // The whole verb rolled back: no row, no balance move, no audit entry.
    assert_eq!(balance(&connection, SOMEONE_ELSES), 0);
    let rows: i64 = connection
        .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
        .expect("count");
    assert_eq!(rows, 0, "the insert must not survive the refusal");
    let audits: i64 = connection
        .query_row("SELECT COUNT(*) FROM financial_audit_log", [], |row| {
            row.get(0)
        })
        .expect("count");
    assert_eq!(audits, 0);
}

#[test]
fn an_account_that_does_not_exist_at_all_is_stopped_by_the_foreign_key() {
    // Worth pinning: this does NOT reach the changes() assert. Both engines
    // have transactions.account_id -> accounts, so the INSERT fails first.
    //
    // Since 2026-08-08 the test above refuses with the same code and the same
    // message, so the pair no longer distinguishes itself by the error. It
    // distinguishes itself by the DATA: here the account is absent, so the
    // EXISTENCE half of the key is what refuses — the half a single-column key
    // always had. There, the account is present.
    let mut connection = fixture();
    let mut payload = command("-10.00", "expense");
    payload.account_id = NO_SUCH_ACCOUNT.to_owned();

    let error = create_transaction(&mut connection, payload).expect_err("must refuse");
    assert_eq!(error.code(), "constraint_violated");
    assert!(error.to_string().contains("FOREIGN KEY"), "{error}");

    let present: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE id = ?1",
            [NO_SUCH_ACCOUNT],
            |row| row.get(0),
        )
        .expect("count");
    assert_eq!(present, 0, "nothing of that id exists — existence refused it");
}

#[test]
fn a_far_side_owned_by_somebody_else_is_refused_too() {
    // R-12's weakest link, and the reason the pairing was not optional.
    //
    // This verb copies `transfer_account_id` straight out of the caller's
    // payload with no ownership check whatsoever — the cloud RPC does the same
    // (20260808150000:196), which made this the ONE account reference reachable
    // through a trusted RPC rather than only through a raw insert. MEASURED on
    // the reference cluster before the key existed: ACCEPTED, and the row
    // landed naming a stranger's account as the far side of a transfer.
    //
    // Now refused, by `transactions_transfer_account_id_user_fkey` there and by
    // the twin key here. The account_id is the caller's OWN, so nothing but the
    // far side is wrong — which is what makes this a different test from the
    // two above rather than a restatement of them.
    let mut connection = fixture();
    let mut payload = command("-10.00", "expense");
    payload.transfer_account_id = Some(SOMEONE_ELSES.to_owned());

    let error = create_transaction(&mut connection, payload).expect_err("must refuse");
    assert_eq!(error.code(), "constraint_violated");
    assert!(
        error.to_string().contains("FOREIGN KEY constraint failed"),
        "expected the ownership key, got: {error}"
    );

    // Nothing survived, and the account the row WAS legitimately in is unmoved.
    let rows: i64 = connection
        .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
        .expect("count");
    assert_eq!(rows, 0);
    assert_eq!(balance(&connection, EVERYDAY), 0);
}

#[test]
fn every_create_writes_exactly_one_audit_row_in_the_same_transaction() {
    let mut connection = fixture();
    let result = run(&mut connection, command("-25.00", "expense"));

    let (entity, entity_id, action, before_is_null, seq, prev, hash): (
        String,
        String,
        String,
        i64,
        i64,
        Option<String>,
        String,
    ) = connection
        .query_row(
            "SELECT entity, entity_id, action, before_data IS NULL, seq, prev_hash, row_hash
               FROM financial_audit_log",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            },
        )
        .expect("exactly one audit row");

    assert_eq!(entity, "transaction");
    assert_eq!(entity_id, result.transaction.id);
    assert_eq!(action, "create");
    assert_eq!(before_is_null, 1, "a create has no before (U-6)");
    assert_eq!(seq, 1);
    assert_eq!(prev, None, "the first row starts the chain");
    assert_eq!(hash, result.audit_row_hash);

    // after_data is what STORAGE holds, and its amount is a decimal string.
    let after: String = connection
        .query_row("SELECT after_data FROM financial_audit_log", [], |row| {
            row.get(0)
        })
        .expect("after");
    let parsed: serde_json::Value = serde_json::from_str(&after).expect("json");
    assert_eq!(parsed["amount"], serde_json::json!("-25.00"));
    assert_eq!(parsed["category_confirmed"], serde_json::json!(true));
}

#[test]
fn the_audit_chain_links_row_to_row() {
    let mut connection = fixture();
    let first = run(&mut connection, command("-25.00", "expense"));
    let second = run(&mut connection, command("-10.00", "expense"));

    let (seq, prev): (i64, Option<String>) = connection
        .query_row(
            "SELECT seq, prev_hash FROM financial_audit_log WHERE row_hash = ?1",
            [&second.audit_row_hash],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("second row");
    assert_eq!(seq, 2);
    assert_eq!(prev.as_deref(), Some(first.audit_row_hash.as_str()));
}

#[test]
fn statement_sequence_and_category_confirmed_round_trip() {
    let mut connection = fixture();
    let payload: CreateTransaction = serde_json::from_value(serde_json::json!({
        "user_id": OWNER,
        "account_id": EVERYDAY,
        "description": "Second of three on the same day",
        "amount": "-3.20",
        "type": "expense",
        "date": "2024-03-01",
        "statement_sequence": 2,
        "category_confirmed": false,
    }))
    .expect("command");

    let result = run(&mut connection, payload);
    assert_eq!(result.transaction.statement_sequence, Some(2));
    assert!(!result.transaction.category_confirmed);
}

#[test]
fn an_absent_ordinal_and_an_empty_one_are_both_null() {
    let mut connection = fixture();
    let absent = run(&mut connection, command("-1.00", "expense"));
    assert_eq!(absent.transaction.statement_sequence, None);

    let mut payload = command("-1.00", "expense");
    payload.statement_sequence = Some(serde_json::from_value(serde_json::json!("")).expect("wire"));
    let empty = run(&mut connection, payload);
    assert_eq!(empty.transaction.statement_sequence, None);

    let mut payload = command("-1.00", "expense");
    payload.statement_sequence =
        Some(serde_json::from_value(serde_json::json!("4")).expect("wire"));
    let text = run(&mut connection, payload);
    assert_eq!(text.transaction.statement_sequence, Some(4));
}

#[test]
fn a_transfer_typed_row_is_stored_as_sent_and_linked_to_nothing() {
    // The RPC does no transfer-category resolution and creates no counterpart.
    // Reading its body is the only way to know that; this is that reading, made
    // executable.
    let mut connection = fixture();
    let payload: CreateTransaction = serde_json::from_value(serde_json::json!({
        "user_id": OWNER,
        "account_id": EVERYDAY,
        "description": "Standing order to savings",
        "amount": "-100.00",
        "type": "transfer",
        "date": "2024-03-01",
        "transfer_account_id": RAINY_DAY,
    }))
    .expect("command");

    let result = run(&mut connection, payload);
    assert_eq!(result.transaction.kind, "transfer");
    assert_eq!(
        result.transaction.transfer_account_id.as_deref(),
        Some(RAINY_DAY)
    );
    assert_eq!(result.transaction.linked_transfer_id, None);
    assert_eq!(
        result.transaction.category, None,
        "no To/From category is filed here"
    );
    // And the other account was not touched.
    assert_eq!(balance(&connection, RAINY_DAY), 0);
    assert_eq!(balance(&connection, EVERYDAY), -10_000);
}

#[test]
fn tags_become_child_rows_in_the_same_transaction() {
    let mut connection = fixture();
    let mut payload = command("-25.00", "expense");
    payload.tags = Some(vec!["groceries".to_owned(), "weekly".to_owned()]);
    let result = run(&mut connection, payload);
    assert_eq!(
        result.transaction.tags,
        vec!["groceries".to_owned(), "weekly".to_owned()]
    );

    // A tag the child table refuses takes the whole verb with it.
    let mut payload = command("-1.00", "expense");
    payload.tags = Some(vec!["   ".to_owned()]);
    let error = create_transaction(&mut connection, payload).expect_err("blank tag must refuse");
    assert_eq!(error.code(), "constraint_violated");
    let rows: i64 = connection
        .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
        .expect("count");
    assert_eq!(rows, 1, "only the first create survived");
}

#[test]
fn a_sub_penny_amount_never_reaches_the_file() {
    let error = serde_json::from_value::<CreateTransaction>(serde_json::json!({
        "user_id": OWNER,
        "account_id": EVERYDAY,
        "description": "Three decimal places",
        "amount": "-12.345",
        "type": "expense",
        "date": "2024-03-01",
    }))
    .expect_err("must refuse");
    assert!(
        error.to_string().contains("amount_not_representable"),
        "{error}"
    );
}

#[test]
fn money_may_not_arrive_as_a_json_number() {
    let error = serde_json::from_value::<CreateTransaction>(serde_json::json!({
        "user_id": OWNER,
        "account_id": EVERYDAY,
        "description": "Float",
        "amount": -12.34,
        "type": "expense",
        "date": "2024-03-01",
    }))
    .expect_err("must refuse");
    assert!(
        error.to_string().contains("amount_must_be_a_string"),
        "{error}"
    );
}

#[test]
fn an_impossible_date_is_refused_before_any_write() {
    let mut connection = fixture();
    let mut payload = command("-1.00", "expense");
    payload.date = "2023-02-29".to_owned();
    let error = create_transaction(&mut connection, payload).expect_err("must refuse");
    assert_eq!(error.code(), "date_invalid");
    assert_eq!(balance(&connection, EVERYDAY), 0);
}

#[test]
fn is_cleared_is_carried_through_and_defaults_to_unreconciled() {
    // The regression this port found, now fixed on both sides:
    // 20260808150000_create_honours_is_cleared.sql restores the passthrough the
    // cloud lost at 20260808090000. See verbs::create_transaction's module docs.
    let mut connection = fixture();

    let mut payload = command("-1.00", "expense");
    payload.is_cleared = Some(Flag::Bool(true));
    assert!(run(&mut connection, payload).transaction.is_cleared);

    // Said nothing: COALESCE(..., false). A hand-entered row is not reconciled.
    assert!(!run(&mut connection, command("-1.00", "expense"))
        .transaction
        .is_cleared);

    // And "t" is a boolean too, because `p->>'is_cleared'` hands the cast text.
    let mut payload = command("-1.00", "expense");
    payload.is_cleared = Some(Flag::Text("t".to_owned()));
    assert!(run(&mut connection, payload).transaction.is_cleared);
}

#[test]
fn a_boolean_that_is_not_a_boolean_is_refused_by_name() {
    let mut connection = fixture();
    let mut payload = command("-1.00", "expense");
    payload.is_cleared = Some(Flag::Text(String::new()));
    let error = create_transaction(&mut connection, payload).expect_err("must refuse");
    assert_eq!(error.code(), "boolean_invalid");
    assert!(error.to_string().contains("is_cleared"), "{error}");

    // Nothing was written: the flags resolve before the transaction opens.
    let rows: i64 = connection
        .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
        .expect("count");
    assert_eq!(rows, 0);
}

#[test]
fn a_key_nobody_reads_is_refused_rather_than_discarded() {
    let error = serde_json::from_value::<CreateTransaction>(serde_json::json!({
        "user_id": OWNER,
        "account_id": EVERYDAY,
        "description": "Typo",
        "amount": "-1.00",
        "type": "expense",
        "date": "2024-03-01",
        "amont": "-99.00",
    }))
    .expect_err("must refuse");
    assert!(error.to_string().contains("amont"), "{error}");
}

#[test]
fn there_is_no_absolute_balance_setter_on_the_command_surface() {
    // B-2, tested the only way an absence can be: by naming it. The module
    // documentation mentions `set_account_balance` on purpose — recording why
    // it is missing is the point — so this looks for a *declaration*, not for
    // the words.
    let surface = include_str!("../src/verbs/mod.rs");
    assert!(
        !surface.contains("fn set_account_balance"),
        "the command surface must not grow an absolute balance setter",
    );
    let exported = surface
        .lines()
        .find(|line| line.starts_with("pub use"))
        .unwrap_or_default();
    assert!(
        !exported.contains("balance"),
        "nothing exported from the verb surface may set a balance directly: {exported}",
    );
    let verb = include_str!("../src/verbs/create_transaction.rs");
    assert!(
        !verb.contains("SET balance_minor = ?"),
        "balance must move relatively, in SQL, never by assignment",
    );
    assert!(
        verb.contains("balance_minor = balance_minor + ?1"),
        "the relative UPDATE is the point of this verb",
    );
}
