//! Integration tests for the ingest pair, against the real vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`: 49 specs
//! running the same payload against the live RPCs and these two verbs. What is
//! here is the half with **no Postgres counterpart**, or the half a
//! cross-engine comparison cannot see:
//!
//! 1. **The guard table**, read empty across a whole import. The guard question
//!    is asked per verb and answered by running it, and "no guard" is a claim
//!    that needs an assertion like any other.
//! 2. **The audit payload**, field by field. The differential harness compares
//!    stored rows and audit SHAPES; what the entries actually hold — money as a
//!    decimal string, both sides of a rebase — is a local shape, because the
//!    hash chain has no cloud twin.
//! 3. **The tie payee memory has no rule for.** The cloud's answer below
//!    `MAX(created_at)` is an artefact of its plan, so no differential spec can
//!    assert it. The local rule (`category ASC`) is stated here instead, which
//!    is where a strengthening the cloud does not have belongs.
//! 4. **The arithmetic guards** on a batch whose sum would overflow `i64`.
//! 5. **The order the two verbs' refusals fire in**, asserted as an ORDER rather
//!    than one refusal at a time — the differential specs pin each pair, this
//!    pins the sequence.
//!
//! All data is invented.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use serde_json::json;
use wealth_core::db;
use wealth_core::verbs::{
    import_bank_transactions, import_transactions, ImportBankTransactions, ImportTransactions,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";
const FED: &str = "a0000000-0000-0000-0000-0000000000fe";
const GROCERIES: &str = "c0000000-0000-0000-0000-0000000000e4";
const FUEL: &str = "c0000000-0000-0000-0000-0000000000e5";

/// Everyday at −25.00 with the one −25.00 row that justifies it, plus an account
/// seeded the way the bank feed seeds one (balance = initial = the snapshot).
/// B-1 holds on both before anything happens.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0),
                      ('{FED}', '{OWNER}', 'Fed account', 'checking', 10000, 10000);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
               VALUES ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense',
                       '2024-03-01');
             INSERT INTO categories (id, user_id, name, type, level) VALUES
               ('{GROCERIES}', '{OWNER}', 'Groceries', 'expense', 'detail'),
               ('{FUEL}', '{OWNER}', 'Fuel', 'expense', 'detail');"
        ))
        .expect("fixture");
    connection
}

fn file_import(
    connection: &mut Connection,
    rows: serde_json::Value,
) -> wealth_core::error::CoreResult<wealth_core::verbs::ImportTransactionsResult> {
    let command: ImportTransactions = serde_json::from_value(json!({
        "user_id": OWNER, "account_id": EVERYDAY, "rows": rows,
    }))
    .expect("a well-formed command");
    import_transactions(connection, command)
}

fn feed_import(
    connection: &mut Connection,
    rows: serde_json::Value,
) -> wealth_core::error::CoreResult<wealth_core::verbs::ImportBankTransactionsResult> {
    let command: ImportBankTransactions =
        serde_json::from_value(json!({ "user_id": OWNER, "rows": rows }))
            .expect("a well-formed command");
    import_bank_transactions(connection, command)
}

fn row(description: &str, amount: &str) -> serde_json::Value {
    json!({ "description": description, "amount": amount, "type": "expense", "date": "2024-05-01" })
}

fn feed_row(description: &str, amount: &str, external: &str) -> serde_json::Value {
    json!({
        "user_id": OWNER, "account_id": FED, "description": description, "amount": amount,
        "type": "expense", "date": "2024-05-01", "external_transaction_id": external,
    })
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect("read")
}

fn balances(connection: &Connection, account: &str) -> (i64, i64) {
    connection
        .query_row(
            "SELECT balance_minor, initial_balance_minor FROM accounts WHERE id = ?1",
            [account],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("read")
}

/// B-1 for one account, as a difference that must be zero.
fn identity(connection: &Connection, account: &str) -> i64 {
    connection
        .query_row(
            "SELECT a.balance_minor - a.initial_balance_minor
                    - COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                                 WHERE t.account_id = a.id), 0)
               FROM accounts a WHERE a.id = ?1",
            [account],
            |row| row.get(0),
        )
        .expect("read")
}

// ── The guard question, answered by running it ──────────────────────────────

#[test]
fn a_file_import_holds_no_guard_at_any_point() {
    // Neither verb touches `_rpc_guard`, and the reason is measured rather than
    // assumed: nothing on `transactions` fires on INSERT, and the accounts
    // UPDATE is watched only by triggers that stand down. This asserts the
    // outcome — the table is empty afterwards — and the assertion that the
    // import SUCCEEDED is what stops it passing vacuously against a verb that
    // refuses everything.
    let mut connection = fixture();
    let result = file_import(&mut connection, json!([row("Coffee", "-4.25")])).expect("import");

    assert_eq!(result.answer.inserted, 1);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);
}

#[test]
fn a_feed_import_holds_no_guard_either() {
    let mut connection = fixture();
    let result = feed_import(&mut connection, json!([feed_row("Shop", "-12.00", "n-1")]))
        .expect("import");

    assert_eq!(result.answer.inserted, 1);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);
}

// ── The audit payload, which the harness can only see the shape of ──────────

#[test]
fn the_account_entry_records_both_sides_of_the_batch_movement() {
    // One movement for the whole chunk, and the entry that justifies it. Money
    // is a decimal STRING on both sides: a JSON number is a binary float the
    // moment any parser reads it, and an audit trail made of floats is not
    // evidence of anything.
    let mut connection = fixture();
    let result = file_import(
        &mut connection,
        json!([row("Coffee", "-4.25"), row("Bus", "-2.50")]),
    )
    .expect("import");

    let seq = result.audit_seq.expect("a batch that landed closes with an account entry");
    let (entity, action, before, after): (String, String, Option<String>, Option<String>) =
        connection
            .query_row(
                "SELECT entity, action, before_data, after_data FROM financial_audit_log
                  WHERE seq = ?1",
                [seq],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("the entry");

    assert_eq!((entity.as_str(), action.as_str()), ("account", "update"));
    let before: serde_json::Value = serde_json::from_str(&before.expect("a before")).expect("json");
    let after: serde_json::Value = serde_json::from_str(&after.expect("an after")).expect("json");
    assert_eq!(before["balance"], json!("-25.00"));
    assert_eq!(after["balance"], json!("-31.75"));
    // Only `balance` moved. A port that touched the opening figure on this path
    // would be doing the FEED's job on the file's.
    assert_eq!(before["initial_balance"], after["initial_balance"]);
}

#[test]
fn the_feed_entry_records_a_rebase_as_a_move_of_the_opening_figure() {
    // The same assertion for B-4's other arm, and the only record anywhere that
    // an account's opening balance was rewritten.
    let mut connection = fixture();
    let result =
        feed_import(&mut connection, json!([feed_row("Shop", "-12.00", "n-1")])).expect("import");

    let seq = result.audit_seq.expect("an account entry");
    let (before, after): (Option<String>, Option<String>) = connection
        .query_row(
            "SELECT before_data, after_data FROM financial_audit_log WHERE seq = ?1",
            [seq],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("the entry");
    let before: serde_json::Value = serde_json::from_str(&before.expect("a before")).expect("json");
    let after: serde_json::Value = serde_json::from_str(&after.expect("an after")).expect("json");

    assert_eq!(before["balance"], after["balance"], "a rebase moves no balance");
    assert_eq!(before["initial_balance"], json!("100.00"));
    assert_eq!(after["initial_balance"], json!("112.00"));
    assert_eq!(identity(&connection, FED), 0, "B-1 survives the rebase");
}

#[test]
fn a_skipped_row_writes_no_audit_entry_and_moves_nothing() {
    // The idempotency guarantee, stated as an absence: a row Postgres — and now
    // SQLite — refuses is a row that never existed to move a balance or to be
    // recorded. "The audit log therefore keeps saying exactly what the table
    // holds" (20260808140000:109-111).
    let mut connection = fixture();
    let keyed = json!([{
        "description": "Coffee", "amount": "-4.25", "type": "expense", "date": "2024-05-01",
        "import_source": "ofx", "import_source_id": "fitid:1",
    }]);
    file_import(&mut connection, keyed.clone()).expect("first post");
    let entries = scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log");
    let balance = balances(&connection, EVERYDAY);

    let again = file_import(&mut connection, keyed).expect("second post");

    assert_eq!((again.answer.inserted, again.answer.skipped), (0, 1));
    assert!(again.answer.idempotent, "the request was keyed end to end");
    assert!(again.audit_seq.is_none(), "nothing landed, so nothing closed the batch");
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        entries
    );
    assert_eq!(balances(&connection, EVERYDAY), balance);
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

// ── The refusal ORDER, as an order ──────────────────────────────────────────

#[test]
fn the_file_importers_refusals_fire_in_the_order_the_cloud_checks_them() {
    // Each differential spec pins ONE pair. This walks the whole sequence by
    // making every fault true at once and removing them one at a time, so a port
    // that got two of the five the right way round and the third wrong still
    // fails here.
    let mut connection = fixture();
    let long = "x".repeat(201);

    let all_of_it = json!([
        { "description": "A", "amount": "-1.00", "type": "expense", "date": "2024-05-01",
          "import_source": "ofx" },
        { "description": "B", "amount": "-1.00", "type": "expense", "date": "2024-05-01",
          "import_source": "ofx", "import_source_id": "k" },
        { "description": "C", "amount": "-1.00", "type": "expense", "date": "2024-05-01",
          "import_source": "ofx", "import_source_id": "k" },
        { "description": "D", "amount": "-1.00", "type": "expense", "date": "2024-05-01",
          "import_source": "ofx", "import_source_id": long },
        { "description": "E", "amount": "-1.00", "type": "nonsense", "date": "2024-05-01" },
    ]);

    // 1. Not an array beats everything, including a payload full of faults.
    let command: ImportTransactions = serde_json::from_value(json!({
        "user_id": OWNER, "account_id": EVERYDAY, "rows": "nope",
    }))
    .expect("command");
    assert_eq!(
        import_transactions(&mut connection, command).unwrap_err().code(),
        "rows_not_an_array"
    );

    // 2. Half a key.
    assert_eq!(
        file_import(&mut connection, all_of_it.clone()).unwrap_err().code(),
        "import_provenance_incomplete"
    );

    // 3. The repeat, once the half key is gone.
    let no_half = json!(all_of_it.as_array().unwrap()[1..]);
    assert_eq!(
        file_import(&mut connection, no_half).unwrap_err().code(),
        "import_provenance_duplicate_in_request"
    );

    // 4. The oversized key, once the repeat is gone.
    let no_repeat = json!(all_of_it.as_array().unwrap()[2..]);
    assert_eq!(
        file_import(&mut connection, no_repeat).unwrap_err().code(),
        "import_provenance_too_long"
    );

    // 5. Only then does the row's own content get looked at — and it is looked
    //    at from inside the loop, which is why nothing survives it.
    let just_the_bad_row = json!(all_of_it.as_array().unwrap()[4..]);
    assert_eq!(
        file_import(&mut connection, just_the_bad_row).unwrap_err().code(),
        "constraint_violated"
    );
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM transactions"), 1);
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

#[test]
fn a_row_that_will_not_store_takes_the_rows_before_it_with_it() {
    // One call = one transaction. The good row IS inserted before the bad one
    // fails; what makes the account whole again is the rollback, not a check —
    // which is why the assertion is on the state and not on the answer.
    let mut connection = fixture();
    let error = file_import(
        &mut connection,
        json!([
            row("Good", "-1.00"),
            { "description": "Bad", "amount": "-1.00", "type": "expense", "date": "2024-05-01",
              "category_confirmed": "banana" },
        ]),
    )
    .unwrap_err();

    assert_eq!(error.code(), "boolean_invalid");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM transactions"), 1);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"), 0);
    assert_eq!(balances(&connection, EVERYDAY), (-2500, 0));
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

#[test]
fn an_unknown_key_on_a_row_is_refused_under_its_own_name() {
    // The declared divergence, and the whole reason it is worth having: a
    // caller must be able to tell a typo from a rejection. Reported as
    // `unknown_field`, not as `invalid_command`, and the message names the key.
    let mut connection = fixture();
    let error = file_import(
        &mut connection,
        json!([{ "description": "A", "amount": "-1.00", "type": "expense", "date": "2024-05-01",
                 "is_clered": true }]),
    )
    .unwrap_err();

    assert_eq!(error.code(), "unknown_field");
    assert!(error.to_string().contains("is_clered"), "{error}");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM transactions"), 1);
}

// ── Payee memory: the rule the cloud does not have ──────────────────────────

/// Two rows for one payee, filed differently, with everything the cloud orders
/// on made equal — same count, same date, same `created_at`.
fn plant_a_total_tie(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, category, created_at)
             VALUES ('7a000000-0000-0000-0000-000000000001', '{OWNER}', '{FED}', 'BIG SHOP', -1000,
                     'expense', '2024-01-01', '{FUEL}', '2024-01-01T00:00:00.000Z'),
                    ('7a000000-0000-0000-0000-000000000002', '{OWNER}', '{FED}', 'BIG SHOP', -1100,
                     'expense', '2024-01-01', '{GROCERIES}', '2024-01-01T00:00:00.000Z');
             UPDATE accounts SET initial_balance_minor = initial_balance_minor + 2100
              WHERE id = '{FED}';"
        ))
        .expect("the tie");
}

#[test]
fn a_tie_the_cloud_has_no_rule_for_is_decided_by_the_category_id() {
    // MEASURED on the reference cluster: below `MAX(created_at)` the cloud's
    // answer is repeatable but is not a rule — for {Aaa, Zzz} it is Zzz either
    // way round, and for {Groceries, Fuel} it is whichever was written second.
    // Those two observations contradict each other, so there is nothing to port.
    //
    // The local edition therefore states one: ascending category id. That is a
    // strengthening where the cloud has no rule, not a divergence from one, and
    // it is asserted HERE rather than in a differential spec because a spec that
    // constructed a total tie would be asserting the cloud's artefact.
    //
    // GROCERIES is …e4 and FUEL is …e5, and the fixture plants FUEL first — so
    // an implementation that fell back to insertion order would answer Fuel.
    let mut connection = fixture();
    plant_a_total_tie(&connection);

    feed_import(&mut connection, json!([feed_row("BIG SHOP", "-9.00", "n-1")])).expect("import");

    let filed: Option<String> = connection
        .query_row(
            "SELECT category FROM transactions WHERE external_transaction_id = 'n-1'",
            [],
            |row| row.get(0),
        )
        .expect("the row");
    assert_eq!(filed.as_deref(), Some(GROCERIES));
}

#[test]
fn the_local_tie_break_is_stable_however_the_rows_were_written() {
    // The property that makes it worth having at all: the same file imports the
    // same way twice, and on two machines. The cloud's answer is stable per
    // physical layout; this one is stable per DATA.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, category, created_at)
             VALUES ('7a000000-0000-0000-0000-000000000001', '{OWNER}', '{FED}', 'BIG SHOP', -1000,
                     'expense', '2024-01-01', '{GROCERIES}', '2024-01-01T00:00:00.000Z'),
                    ('7a000000-0000-0000-0000-000000000002', '{OWNER}', '{FED}', 'BIG SHOP', -1100,
                     'expense', '2024-01-01', '{FUEL}', '2024-01-01T00:00:00.000Z');
             UPDATE accounts SET initial_balance_minor = initial_balance_minor + 2100
              WHERE id = '{FED}';"
        ))
        .expect("the tie, the other way round");

    feed_import(&mut connection, json!([feed_row("BIG SHOP", "-9.00", "n-1")])).expect("import");

    let filed: Option<String> = connection
        .query_row(
            "SELECT category FROM transactions WHERE external_transaction_id = 'n-1'",
            [],
            |row| row.get(0),
        )
        .expect("the row");
    assert_eq!(filed.as_deref(), Some(GROCERIES), "the same answer either way");
}

#[test]
fn payee_memory_reads_an_archived_row() {
    // MEASURED on the reference cluster and reproduced without comment: the
    // helper's WHERE clause has no `archived` term. Adding one here would be a
    // change of behaviour wearing a port's clothes — the archive is a display
    // decision (A-3), and a payee's history does not stop being its history
    // because the register stopped showing it.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, category, archived)
             VALUES ('7a000000-0000-0000-0000-000000000001', '{OWNER}', '{FED}', 'BIG SHOP', -1000,
                     'expense', '2024-01-01', '{GROCERIES}', 1);
             UPDATE accounts SET initial_balance_minor = initial_balance_minor + 1000
              WHERE id = '{FED}';"
        ))
        .expect("an archived row");

    feed_import(&mut connection, json!([feed_row("BIG SHOP", "-9.00", "n-1")])).expect("import");

    let (filed, confirmed): (Option<String>, i64) = connection
        .query_row(
            "SELECT category, category_confirmed FROM transactions
              WHERE external_transaction_id = 'n-1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("the row");
    assert_eq!(filed.as_deref(), Some(GROCERIES));
    assert_eq!(confirmed, 0, "it is still a guess");
}

// ── The arithmetic ──────────────────────────────────────────────────────────

#[test]
fn an_amount_this_ledger_cannot_hold_is_refused_by_the_file_before_the_sum() {
    // The batch sum is accumulated with `checked_add`, and the honest thing to
    // say about that guard is that it is UNREACHABLE on any file a person owns:
    // the per-row bound is ±1e11 minor, so overflowing `i64` takes about 92
    // million rows in one request. It is there because an unchecked `+=` in
    // money code is a wrapped total wearing a plausible figure, not because a
    // test can drive it.
    //
    // What IS reachable is the row bound, and this asserts the ORDER: a row this
    // ledger cannot hold is refused by the FILE, from inside the loop, before it
    // reaches the accumulator at all.
    let mut connection = fixture();
    let error = file_import(&mut connection, json!([row("Enormous", "50000000000.00")]))
        .unwrap_err();

    assert_eq!(error.code(), "constraint_violated");
    assert!(
        error.to_string().contains("transactions_amount_bounded"),
        "{error}"
    );
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM transactions"), 1);
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

#[test]
fn the_answer_counts_what_landed_and_what_was_already_there_separately() {
    // The two numbers answer different questions, and conflating them is how an
    // import summary starts telling the user that rows arrived when they were
    // already present — or the other way round, which is worse.
    let mut connection = fixture();
    let first = json!([{
        "description": "Coffee", "amount": "-4.25", "type": "expense", "date": "2024-05-01",
        "import_source": "ofx", "import_source_id": "fitid:1",
    }]);
    file_import(&mut connection, first).expect("first post");

    let overlapping = json!([
        { "description": "Coffee", "amount": "-4.25", "type": "expense", "date": "2024-05-01",
          "import_source": "ofx", "import_source_id": "fitid:1" },
        { "description": "Bus", "amount": "-2.50", "type": "expense", "date": "2024-05-01",
          "import_source": "ofx", "import_source_id": "fitid:2" },
    ]);
    let result = file_import(&mut connection, overlapping).expect("second post");

    assert_eq!((result.answer.inserted, result.answer.skipped), (1, 1));
    assert!(result.answer.idempotent);
    // The balance moved by the row that landed and by nothing else.
    assert_eq!(balances(&connection, EVERYDAY), (-3175, 0));
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

// ── The feed's per-account bookkeeping ──────────────────────────────────────

#[test]
fn a_sync_across_accounts_audits_them_in_account_order() {
    // The cloud walks its accumulator with `jsonb_each_text`, which visits keys
    // in jsonb's own order — length, then bytes — and every key is a
    // 36-character uuid, so that is ascending byte order. The local port uses a
    // BTreeMap for exactly this reason: a HashMap would make the audit log's
    // order depend on a hash seed, and the log would stop being reproducible.
    let mut connection = fixture();
    feed_import(
        &mut connection,
        json!([
            feed_row("A", "-1.00", "n-1"),
            { "user_id": OWNER, "account_id": EVERYDAY, "description": "B", "amount": "-2.00",
              "type": "expense", "date": "2024-05-01", "external_transaction_id": "n-2" },
        ]),
    )
    .expect("import");

    let order: String = connection
        .query_row(
            "SELECT group_concat(entity_id, ',') FROM (
               SELECT entity_id FROM financial_audit_log WHERE entity = 'account' ORDER BY seq)",
            [],
            |row| row.get(0),
        )
        .expect("read");
    assert_eq!(order, format!("{EVERYDAY},{FED}"));
    assert_eq!(identity(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, FED), 0);
}

#[test]
fn an_account_whose_rows_were_all_skipped_is_not_touched_at_all() {
    // No balance movement, no audit row, and — the part only a local test can
    // see — no `updated_at` bump either. A routine empty sync must be free.
    let mut connection = fixture();
    feed_import(&mut connection, json!([feed_row("Shop", "-12.00", "n-1")])).expect("first");
    let stamp: String = connection
        .query_row("SELECT updated_at FROM accounts WHERE id = ?1", [FED], |row| row.get(0))
        .expect("read");
    let entries = scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log");

    let again = feed_import(&mut connection, json!([feed_row("Shop", "-12.00", "n-1")]))
        .expect("second");

    assert_eq!((again.answer.inserted, again.answer.skipped), (0, 1));
    assert!(again.audit_seq.is_none());
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        entries
    );
    let after: String = connection
        .query_row("SELECT updated_at FROM accounts WHERE id = ?1", [FED], |row| row.get(0))
        .expect("read");
    assert_eq!(after, stamp, "an untouched account keeps its timestamp");
}

#[test]
fn the_rebase_answer_is_taken_once_and_survives_the_batch_it_describes() {
    // Row 1 gives the account feed history. If the answer were re-asked for row
    // 2 it would come back INCREMENTAL, and the batch would be split across both
    // arms — half the money moved twice.
    let mut connection = fixture();
    feed_import(
        &mut connection,
        json!([feed_row("A", "-12.00", "n-1"), feed_row("B", "-8.00", "n-2")]),
    )
    .expect("import");

    // 100 − (−20) = 120, all of it on the opening figure.
    assert_eq!(balances(&connection, FED), (10000, 12000));
    assert_eq!(identity(&connection, FED), 0);
}

#[test]
fn a_second_sync_moves_the_balance_and_leaves_the_opening_figure_alone() {
    // The control for the test above. A family that only tested the rebase would
    // pass just as happily against a port that rebases for ever.
    let mut connection = fixture();
    feed_import(&mut connection, json!([feed_row("A", "-12.00", "n-1")])).expect("first");
    assert_eq!(balances(&connection, FED), (10000, 11200));

    feed_import(&mut connection, json!([feed_row("B", "-8.00", "n-2")])).expect("second");

    assert_eq!(balances(&connection, FED), (9200, 11200));
    assert_eq!(identity(&connection, FED), 0);
}

#[test]
fn a_row_naming_another_owner_loses_the_whole_sync() {
    // The refusal is per row and fires before that row does anything, but the
    // rollback is what removes the good row ahead of it — the same all-or-nothing
    // property the file importer has, asserted on the other verb.
    let mut connection = fixture();
    let error = feed_import(
        &mut connection,
        json!([
            feed_row("Good", "-1.00", "n-1"),
            { "user_id": "22222222-2222-2222-2222-222222222222", "account_id": FED,
              "description": "Theirs", "amount": "-2.00", "type": "expense",
              "date": "2024-05-01", "external_transaction_id": "n-2" },
        ]),
    )
    .unwrap_err();

    assert_eq!(error.code(), "row user_id does not match p_user_id");
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM transactions WHERE account_id = 'a0000000-0000-0000-0000-0000000000fe'"),
        0
    );
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"), 0);
    assert_eq!(balances(&connection, FED), (10000, 10000));
}
