//! Integration tests for the update verb, against the real vendored schema.
//!
//! These are the crate's own guarantees. The differential proof — that the two
//! engines agree — lives in `scripts/local-sqlite/verbs.mjs`; what is here is
//! the half that does not need a Postgres cluster, plus the boundary refusals
//! that never reach a database at all.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::verbs::{update_transaction, UpdateTransaction, UpdateTransactionResult};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const SOMEONE_ELSES: &str = "a0000000-0000-0000-0000-000000000009";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const OUTGOINGS: &str = "c0000000-0000-0000-0000-000000000002";
const ROW: &str = "70000000-0000-0000-0000-000000000001";

/// One account holding one -25.00 row, with every nullable column of that row
/// filled in — otherwise "cleared to NULL" and "left alone" are the same
/// observation.
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
               ('{SOMEONE_ELSES}', '{STRANGER}', 'Not yours', 'checking', 0, 0);
             INSERT INTO transactions
               (id, user_id, account_id, description, amount_minor, type, date, category,
                category_id, notes, merchant_name, transfer_account_id, is_cleared,
                is_recurring, category_confirmed, metadata)
             VALUES
               ('{ROW}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense', '2024-03-01',
                '{WEEKLY_SHOP}', '{WEEKLY_SHOP}', 'a note', 'a merchant', '{RAINY_DAY}', 1,
                1, 0, '{{\"k\":1}}');
             INSERT INTO transaction_tags (transaction_id, tag) VALUES
               ('{ROW}', 'one'), ('{ROW}', 'two');",
        ))
        .expect("fixture");
    connection
}

fn patch(json: serde_json::Value) -> UpdateTransaction {
    serde_json::from_value(serde_json::json!({
        "id": ROW,
        "user_id": OWNER,
        "patch": json,
    }))
    .expect("command")
}

fn run(connection: &mut Connection, command: UpdateTransaction) -> UpdateTransactionResult {
    update_transaction(connection, command).expect("the verb should have accepted this")
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

/// B-1 for one account: `balance − (initial + Σ amount)`, which must be zero.
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

// ── The four behaviours of the same three characters ────────────────────────

#[test]
fn a_field_nobody_sent_is_left_exactly_as_it_was() {
    let mut connection = fixture();
    let row = run(&mut connection, patch(serde_json::json!({"description": "renamed"}))).transaction;

    assert_eq!(row.description, "renamed");
    assert_eq!(row.notes.as_deref(), Some("a note"));
    assert_eq!(row.merchant_name.as_deref(), Some("a merchant"));
    assert_eq!(row.transfer_account_id.as_deref(), Some(RAINY_DAY));
    assert_eq!(row.category_id.as_deref(), Some(WEEKLY_SHOP));
    assert_eq!(row.category.as_deref(), Some(WEEKLY_SHOP));
    assert!(row.is_cleared);
    assert!(row.is_recurring);
    assert!(!row.category_confirmed);
    assert_eq!(row.metadata, serde_json::json!({"k": 1}));
    assert_eq!(row.tags, vec!["one".to_owned(), "two".to_owned()]);
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
}

#[test]
fn an_empty_string_clears_the_two_fields_it_clears() {
    let mut connection = fixture();
    let row = run(
        &mut connection,
        patch(serde_json::json!({"transfer_account_id": "", "category_id": ""})),
    )
    .transaction;
    assert_eq!(row.transfer_account_id, None);
    assert_eq!(row.category_id, None);
    // …and nothing else. `category` is a different column and a different class.
    assert_eq!(row.category.as_deref(), Some(WEEKLY_SHOP));
}

#[test]
fn an_empty_account_id_keeps_the_old_account_rather_than_clearing_it() {
    // The row AUDIT3 §1 called dangerous. Implementing TS-T3 uniformly here
    // would try to null a NOT NULL column on an edit the user thought was a
    // rename.
    let mut connection = fixture();
    let row = run(&mut connection, patch(serde_json::json!({"account_id": ""}))).transaction;
    assert_eq!(row.account_id, EVERYDAY);
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(balance(&connection, RAINY_DAY), 0);
}

#[test]
fn an_empty_string_is_stored_verbatim_in_the_text_fields() {
    let mut connection = fixture();
    let row = run(
        &mut connection,
        patch(serde_json::json!({"category": "", "notes": "", "merchant_name": ""})),
    )
    .transaction;
    assert_eq!(row.category.as_deref(), Some(""), "not NULL — the empty string");
    assert_eq!(row.notes.as_deref(), Some(""));
    assert_eq!(row.merchant_name.as_deref(), Some(""));
}

#[test]
fn a_json_null_clears_a_present_key_field_and_is_ignored_by_a_coalesced_one() {
    let mut connection = fixture();
    let row = run(
        &mut connection,
        patch(serde_json::json!({
            "notes": null,
            "transfer_account_id": null,
            "description": null,
            "amount": null,
            "is_cleared": null,
        })),
    )
    .transaction;
    assert_eq!(row.notes, None);
    assert_eq!(row.transfer_account_id, None);
    assert_eq!(row.description, "Corner shop");
    assert_eq!(row.amount.minor(), -2_500);
    assert!(row.is_cleared);
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
}

#[test]
fn an_empty_date_is_refused_before_anything_is_written() {
    // The differential specs cover the amount and boolean casts; this is the
    // third member of the raising class, proved here because it is a pure
    // boundary rule and needs no cluster.
    let mut connection = fixture();
    let error = update_transaction(&mut connection, patch(serde_json::json!({"date": ""})))
        .expect_err("must refuse");
    assert_eq!(error.code(), "date_invalid");

    let error = update_transaction(
        &mut connection,
        patch(serde_json::json!({"date": "2023-02-29"})),
    )
    .expect_err("must refuse");
    assert_eq!(error.code(), "date_invalid");

    let audits: i64 = connection
        .query_row("SELECT COUNT(*) FROM financial_audit_log", [], |row| {
            row.get(0)
        })
        .expect("count");
    assert_eq!(audits, 0, "a refused edit writes no audit row");
}

#[test]
fn an_empty_boolean_is_refused_by_name_and_a_postgres_spelling_is_accepted() {
    let mut connection = fixture();
    let error = update_transaction(&mut connection, patch(serde_json::json!({"is_cleared": ""})))
        .expect_err("must refuse");
    assert_eq!(error.code(), "boolean_invalid");
    assert!(error.to_string().contains("is_cleared"), "{error}");

    // `p->>'is_cleared'` hands the cast text, so every spelling Postgres takes
    // is a spelling this takes.
    let row = run(&mut connection, patch(serde_json::json!({"is_cleared": "off"}))).transaction;
    assert!(!row.is_cleared);
    let row = run(&mut connection, patch(serde_json::json!({"is_cleared": "yes"}))).transaction;
    assert!(row.is_cleared);
}

#[test]
fn an_empty_type_reaches_the_check_and_is_refused() {
    // The third member of the raising class, and the one AUDIT3's table got
    // wrong: it predicted `type: ''` would store the empty string. It would,
    // were it not for the CHECK — which both engines have, so both refuse and
    // the prediction was right about the RPC and wrong about the table.
    let mut connection = fixture();
    let error = update_transaction(&mut connection, patch(serde_json::json!({"type": ""})))
        .expect_err("must refuse");
    assert_eq!(error.code(), "constraint_violated");
    assert!(error.to_string().contains("CHECK"), "{error}");

    let stored: String = connection
        .query_row("SELECT type FROM transactions", [], |row| row.get(0))
        .expect("type");
    assert_eq!(stored, "expense");
}

#[test]
fn metadata_is_taken_as_json_not_as_text() {
    // `->`, not `->>`. AUDIT3's table omitted this field entirely; measured on
    // the reference cluster, `""` stores a JSON string and `null` stores JSON
    // null — neither is ignored and neither is SQL NULL, which the NOT NULL
    // column would refuse anyway.
    let mut connection = fixture();

    let row = run(&mut connection, patch(serde_json::json!({"metadata": ""}))).transaction;
    assert_eq!(row.metadata, serde_json::json!(""));

    let row = run(&mut connection, patch(serde_json::json!({"metadata": null}))).transaction;
    assert_eq!(row.metadata, serde_json::Value::Null);

    let row = run(
        &mut connection,
        patch(serde_json::json!({"metadata": {"note": "invented"}})),
    )
    .transaction;
    assert_eq!(row.metadata, serde_json::json!({"note": "invented"}));

    // …and money still may not hide in it (schema.sql's CHECK, which is the
    // reason that blob was broken up into typed columns in the first place).
    let error = update_transaction(
        &mut connection,
        patch(serde_json::json!({"metadata": {"transferMetadata": {"fees": 1.5}}})),
    )
    .expect_err("money in the blob must refuse");
    assert_eq!(error.code(), "constraint_violated");
}

#[test]
fn tags_are_replaced_only_by_an_array() {
    let mut connection = fixture();

    // Not an array: ignored, exactly as jsonb_typeof(...) <> 'array' is.
    let row = run(&mut connection, patch(serde_json::json!({"tags": ""}))).transaction;
    assert_eq!(row.tags, vec!["one".to_owned(), "two".to_owned()]);
    let row = run(&mut connection, patch(serde_json::json!({"tags": null}))).transaction;
    assert_eq!(row.tags, vec!["one".to_owned(), "two".to_owned()]);

    // An array replaces the whole set…
    let row = run(&mut connection, patch(serde_json::json!({"tags": ["three"]}))).transaction;
    assert_eq!(row.tags, vec!["three".to_owned()]);

    // …and an empty array is a real instruction, not an absent key.
    let row = run(&mut connection, patch(serde_json::json!({"tags": []}))).transaction;
    assert!(row.tags.is_empty());
}

#[test]
fn a_key_outside_the_allow_list_is_refused_rather_than_discarded() {
    // D-7. The cloud sets fifteen columns and drops every other key on the
    // floor; see the verb's module documentation for why this one does not.
    // Nothing here is executed against the file — the refusal happens at the
    // command boundary — so the connection is only here to prove that.
    let connection = fixture();
    for key in ["archived", "is_split", "linked_transfer_id", "amont"] {
        let command = serde_json::from_value::<UpdateTransaction>(serde_json::json!({
            "id": ROW,
            "user_id": OWNER,
            "patch": { key: null },
        }));
        let error = command.expect_err("an unknown key must refuse");
        assert!(error.to_string().contains(key), "{key}: {error}");
    }
    // And the row is untouched, because none of that reached the file.
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

// ── The three-way provenance CASE ───────────────────────────────────────────

#[test]
fn stating_the_provenance_flag_honours_it() {
    let mut connection = fixture();
    let row = run(
        &mut connection,
        patch(serde_json::json!({"category_confirmed": true})),
    )
    .transaction;
    assert!(row.category_confirmed);
}

#[test]
fn changing_the_category_confirms_it_without_being_asked() {
    let mut connection = fixture();
    let row = run(
        &mut connection,
        patch(serde_json::json!({"category": OUTGOINGS})),
    )
    .transaction;
    assert_eq!(row.category.as_deref(), Some(OUTGOINGS));
    assert!(row.category_confirmed, "choosing a category IS vouching for it");
}

#[test]
fn re_sending_the_same_category_confirms_nothing() {
    let mut connection = fixture();
    let row = run(
        &mut connection,
        patch(serde_json::json!({"category": WEEKLY_SHOP, "description": "tidied"})),
    )
    .transaction;
    assert!(!row.category_confirmed);
}

#[test]
fn a_stated_null_provenance_flag_takes_the_first_branch_and_keeps_the_old_value() {
    // Subtle and measured: `p ? 'category_confirmed'` is TRUE for a JSON null,
    // so branch 1 fires and COALESCEs to the old value — which means branch 2
    // (the category changed) is NOT reached even though the category changed.
    let mut connection = fixture();
    let row = run(
        &mut connection,
        patch(serde_json::json!({"category": OUTGOINGS, "category_confirmed": null})),
    )
    .transaction;
    assert_eq!(row.category.as_deref(), Some(OUTGOINGS));
    assert!(
        !row.category_confirmed,
        "a stated null keeps the old flag; it does not fall through to the changed-category branch"
    );
}

// ── Balance, and the assert SQLite will not make for you ────────────────────

#[test]
fn changing_an_amount_moves_the_account_by_the_difference() {
    let mut connection = fixture();
    run(&mut connection, patch(serde_json::json!({"amount": "-40.00"})));
    assert_eq!(balance(&connection, EVERYDAY), -4_000);
    assert_eq!(identity(&connection, EVERYDAY), 0, "B-1 must hold");
}

#[test]
fn an_amount_that_did_not_change_moves_nothing() {
    let mut connection = fixture();
    run(&mut connection, patch(serde_json::json!({"amount": "-25.00"})));
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

#[test]
fn moving_between_accounts_reverses_one_and_applies_the_other() {
    let mut connection = fixture();
    // `transfer_account_id` is cleared in the same edit because this fixture's
    // row points at Rainy day, and `transactions_transfer_two_accounts` refuses
    // a transfer whose other side is its own account. That constraint is a
    // DECLARED schema-level divergence in its own right — the cloud only checks
    // it inside link_transfer_pair, so a direct write is accepted there — and it
    // already has a spec (specs/t2-transfer-needs-two-accounts.spec.mjs). It is
    // not this verb's business, so the edit simply does what a caller would have
    // to do.
    run(
        &mut connection,
        patch(serde_json::json!({
            "account_id": RAINY_DAY,
            "amount": "-40.00",
            "transfer_account_id": "",
        })),
    );
    assert_eq!(balance(&connection, EVERYDAY), 0, "the old effect reversed");
    assert_eq!(balance(&connection, RAINY_DAY), -4_000, "the new one applied");
    assert_eq!(identity(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, RAINY_DAY), 0);
}

#[test]
fn moving_a_row_onto_somebody_elses_account_is_refused_by_the_ownership_key() {
    // WAS: `moving_a_row_onto_somebody_elses_account_is_refused_by_name`, until
    // 2026-08-08.
    //
    // It drove the `changes()` assert on the inbound half of the account move,
    // because nothing in SQLite raises when an UPDATE matches no row.
    //
    // The move is now refused one step earlier, by the ownership key, on the
    // statement that writes `account_id` — before any balance statement is
    // reached. MEASURED on the reference cluster too (probe-fk-verbs.sql, P3):
    // `update_transaction_atomic` handed the same patch refuses at
    // `transactions_account_id_user_fkey`, so the two engines agree about the
    // mechanism as well as the verdict.
    //
    // Worth recording precisely because it corrects a sentence in the
    // migration's own header: 20260808170000:225-227 says the RPCs' named
    // refusals "still guard update, delete and split, where the row's account
    // can change without the foreign key having anything new to check". On
    // update the key HAS something to check — the new `account_id` against the
    // row's `user_id` — and it checks it first.
    let mut connection = fixture();
    let error = update_transaction(
        &mut connection,
        patch(serde_json::json!({"account_id": SOMEONE_ELSES})),
    )
    .expect_err("must refuse");
    assert_eq!(error.code(), "constraint_violated");
    assert!(
        error.to_string().contains("FOREIGN KEY constraint failed"),
        "expected the ownership key, got: {error}"
    );

    // Whole edit rolled back, both accounts intact, B-1 still holds.
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(balance(&connection, SOMEONE_ELSES), 0);
    assert_eq!(identity(&connection, EVERYDAY), 0);
    assert_eq!(identity(&connection, SOMEONE_ELSES), 0);
    let audits: i64 = connection
        .query_row("SELECT COUNT(*) FROM financial_audit_log", [], |row| {
            row.get(0)
        })
        .expect("count");
    assert_eq!(audits, 0);
}

#[test]
fn pointing_a_far_side_at_somebody_elses_account_is_refused_too() {
    // The other half of R-12 on this verb. `transfer_account_id` is passed
    // through unchecked by both editions — the cloud's own allow-list carries
    // it (20260808100000:325-327) with no ownership test anywhere — so before
    // the key this landed, and the row named a stranger's account as the far
    // side of a transfer. MEASURED on the reference cluster: accepted before,
    // refused after (probe-fk-verbs.sql, P4).
    //
    // The row's own account is untouched here, so nothing but the far side can
    // be what refused it.
    let mut connection = fixture();
    let error = update_transaction(
        &mut connection,
        patch(serde_json::json!({"transfer_account_id": SOMEONE_ELSES})),
    )
    .expect_err("must refuse");
    assert_eq!(error.code(), "constraint_violated");
    assert!(
        error.to_string().contains("FOREIGN KEY constraint failed"),
        "expected the ownership key, got: {error}"
    );

    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(identity(&connection, EVERYDAY), 0);
    let far_side: Option<String> = connection
        .query_row(
            "SELECT transfer_account_id FROM transactions WHERE id = ?1",
            [ROW],
            |row| row.get(0),
        )
        .expect("row");
    assert_eq!(
        far_side.as_deref(),
        Some(RAINY_DAY),
        "the refused patch left the far side it already had — an account of the caller's own, \
         which is also the control: the column takes a target, it is the OWNER that was refused"
    );
}

// ── Ownership, and the audit row ────────────────────────────────────────────

#[test]
fn somebody_elses_row_is_refused_by_name() {
    let mut connection = fixture();
    let command: UpdateTransaction = serde_json::from_value(serde_json::json!({
        "id": ROW,
        "user_id": STRANGER,
        "patch": { "description": "not mine" },
    }))
    .expect("command");
    let error = update_transaction(&mut connection, command).expect_err("must refuse");
    assert_eq!(error.code(), "transaction_not_found");
}

#[test]
fn a_row_that_does_not_exist_refuses_the_same_way() {
    // Deliberately the same message: a distinct one would confirm that an id
    // exists to a caller who cannot see it.
    let mut connection = fixture();
    let command: UpdateTransaction = serde_json::from_value(serde_json::json!({
        "id": "70000000-0000-0000-0000-0000000000ff",
        "user_id": OWNER,
        "patch": { "description": "nothing to rename" },
    }))
    .expect("command");
    let error = update_transaction(&mut connection, command).expect_err("must refuse");
    assert_eq!(error.code(), "transaction_not_found");
}

#[test]
fn an_edit_writes_one_audit_row_carrying_both_sides() {
    let mut connection = fixture();
    let result = run(
        &mut connection,
        patch(serde_json::json!({"description": "renamed", "amount": "-30.00"})),
    );

    let (action, before, after, seq, hash): (String, String, String, i64, String) = connection
        .query_row(
            "SELECT action, before_data, after_data, seq, row_hash FROM financial_audit_log",
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

    assert_eq!(action, "update");
    assert_eq!(seq, result.audit_seq);
    assert_eq!(hash, result.audit_row_hash);

    let before: serde_json::Value = serde_json::from_str(&before).expect("json");
    let after: serde_json::Value = serde_json::from_str(&after).expect("json");
    // Money as a decimal STRING on both sides of the change: the audit trail
    // never holds a JSON number for an amount.
    assert_eq!(before["amount"], serde_json::json!("-25.00"));
    assert_eq!(after["amount"], serde_json::json!("-30.00"));
    assert_eq!(before["description"], serde_json::json!("Corner shop"));
    assert_eq!(after["description"], serde_json::json!("renamed"));
}

#[test]
fn a_split_parents_protected_fields_are_still_protected_through_this_verb() {
    // The update verb deliberately does NOT hold _rpc_guard('split'). Both
    // engines refuse an amount change on a split parent — the cloud
    // procedurally (20260713100000:67-105), the local file by trigger.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{ROW}';
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
               VALUES ('50000000-0000-0000-0000-000000000001', '{ROW}', '{OWNER}',
                       '{WEEKLY_SHOP}', -2500, 0);
             DELETE FROM _rpc_guard;"
        ))
        .expect("split fixture");

    let error = update_transaction(&mut connection, patch(serde_json::json!({"amount": "-40.00"})))
        .expect_err("a split parent's amount is its lines' sum");
    assert_eq!(error.code(), "constraint_violated");
    assert!(error.to_string().contains("split_amount_locked"), "{error}");
    assert_eq!(balance(&connection, EVERYDAY), -2_500);
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

// ── needs_review, the sixteenth field (20260810090000) ──────────────────────

/// `needs_review` as stored on the fixture's one row.
fn review(connection: &Connection) -> i64 {
    connection
        .query_row("SELECT needs_review FROM transactions WHERE id = ?1", [ROW], |row| row.get(0))
        .expect("needs_review")
}

#[test]
fn a_review_nobody_mentioned_is_left_exactly_as_it_was() {
    // The whole of the migration's argument in one assertion: this verb is also
    // how the bulk categorise sweep, the payee rename and the transfer-link
    // repair write, and none of those is a human reading a row. An edit that
    // implied a review would mark a whole import as dealt with the first time
    // anybody ran a bulk tool over it.
    let mut connection = fixture();
    connection
        .execute("UPDATE transactions SET needs_review = 1 WHERE id = ?1", [ROW])
        .expect("arrange");

    run(&mut connection, patch(serde_json::json!({ "category": OUTGOINGS })));

    assert_eq!(review(&connection), 1);
}

#[test]
fn a_stated_review_flag_is_honoured() {
    // What the register's four save buttons send, and the only thing that ends
    // a row's review through this verb.
    let mut connection = fixture();
    connection
        .execute("UPDATE transactions SET needs_review = 1 WHERE id = ?1", [ROW])
        .expect("arrange");

    let result = run(&mut connection, patch(serde_json::json!({ "needs_review": false })));

    assert_eq!(review(&connection), 0);
    // And the row it hands back is otherwise untouched — one boolean, no money.
    assert_eq!(result.transaction.amount.to_decimal_string(), "-25.00");
    assert_eq!(balance(&connection, EVERYDAY), -2500);
    assert_eq!(identity(&connection, EVERYDAY), 0);
}

#[test]
fn a_stated_null_review_flag_keeps_the_stored_answer() {
    // The COALESCE class, same as its two neighbours: present-but-null is not a
    // value, so the stored answer stands.
    let mut connection = fixture();
    connection
        .execute("UPDATE transactions SET needs_review = 1 WHERE id = ?1", [ROW])
        .expect("arrange");

    run(&mut connection, patch(serde_json::json!({ "needs_review": serde_json::Value::Null })));

    assert_eq!(review(&connection), 1);
}

#[test]
fn an_empty_review_flag_is_refused_by_name() {
    let mut connection = fixture();
    let error = update_transaction(&mut connection, patch(serde_json::json!({ "needs_review": "" })))
        .unwrap_err();

    assert_eq!(error.code(), "boolean_invalid");
    assert!(error.to_string().contains("needs_review"), "{error}");
}

#[test]
fn an_edit_that_says_nothing_about_review_answers_with_the_stored_flag() {
    // THE RESULT PROJECTION (slice 27), and the gap it closes.
    //
    // `localDataPort.ts`'s header wrote this failure down before there was a
    // caller to suffer it: a write answered out of the AUDIT projection, which
    // has no `needs_review`, so an edit that never mentioned the flag answered
    // `false` for a row that was still new work — and a caller replacing its
    // copy with the answer un-bolded an imported row in the register until the
    // next read. The row here is imported and untouched by the patch.
    let mut connection = fixture();
    connection
        .execute("UPDATE transactions SET needs_review = 1 WHERE id = ?1", [ROW])
        .expect("arrange");

    let result = run(&mut connection, patch(serde_json::json!({ "notes": "edited" })));

    assert!(result.transaction.needs_review, "the answer must say what the file holds");
    assert_eq!(review(&connection), 1, "and the file must still hold it");
}

#[test]
fn the_audit_payload_is_not_the_answer_and_does_not_carry_the_flag() {
    // The other half of the same decision, and the reason the projection is a
    // wrapper rather than a wider `TransactionRow`: the audit payload is
    // hash-chained and compared field by field against the cloud's `ROW_JSON`
    // twin (`scripts/local-sqlite/schema.sql`, amendment 6). Widening it would
    // re-chain history to record what the review flag already says elsewhere.
    let mut connection = fixture();
    connection
        .execute("UPDATE transactions SET needs_review = 1 WHERE id = ?1", [ROW])
        .expect("arrange");

    run(&mut connection, patch(serde_json::json!({ "notes": "edited" })));

    let (before, after): (String, String) = connection
        .query_row(
            "SELECT before_data, after_data FROM financial_audit_log
              WHERE entity = 'transaction' ORDER BY seq DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("an audit row");

    for (which, payload) in [("before", &before), ("after", &after)] {
        let parsed: serde_json::Value = serde_json::from_str(payload).expect("audit json");
        assert!(
            parsed.get("needs_review").is_none(),
            "the {which} payload widened: {payload}"
        );
    }
}
