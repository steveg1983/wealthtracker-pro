//! The round trip: collect → wipe → restore → collect, against the real schema.
//!
//! `restore_family.rs` proves the RESTORE half against hand-written bundles —
//! rows spelled the way a cloud export spells them, which is what makes it a
//! proof about the FORMAT rather than about this crate agreeing with itself.
//! This file is the other half, and it can only exist now that there is a
//! collector: **a file this edition writes, poured back into this edition, has to
//! come out the same file.**
//!
//! Nothing here has a Postgres counterpart to compare against, and the reasons
//! are worth naming one by one:
//!
//! 1. **The trip itself.** The cloud's collector is TypeScript walking PostgREST
//!    and its restore is ~34 separate transactions. There is no single call on
//!    that engine to put beside this one.
//! 2. **B-10 / R-16 — one transaction.** A restore that refuses on its last
//!    chunk must leave the file EXACTLY as it was. The cloud cannot make that
//!    claim; its own commentary calls the resulting half-restore *"honest"*.
//! 3. **The null story.** `transactions.is_reconciled` is the only nullable
//!    column in this schema with a default, so it is the only column where "the
//!    file said null" and "the file said nothing" produce different rows. Both
//!    have to survive a round trip, and the cloud's twin of this rule
//!    (20260811090000) is asserted in the differential specs rather than here.
//! 4. **Rule 84's mechanism.** `trg_create_transfer_category_for_account` stands
//!    itself down while the login has no Transfer anchor, which is what stops a
//!    restore minting a second To/From category for every account in the file.
//!    That is a SQLite trigger's WHEN clause; the cloud has its own and the
//!    contract suite asserts the OUTCOME on both.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use serde_json::{json, Value};
use wealth_core::db;
use wealth_core::verbs::{
    collect_backup, restore_backup, wipe_user_financial_data, CollectBackup, RestoreBackup,
    WipeUserFinancialData,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";
const OUTGOINGS: &str = "c0000000-0000-0000-0000-000000000002";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";
const PAYDAY: &str = "70000000-0000-0000-0000-000000000002";
const OLD_HISTORY: &str = "70000000-0000-0000-0000-000000000003";

/// The steps `backupService.RESTORE_STEPS` names, as chunks over one file.
///
/// Spelled here the way the PORT spells it, because the ORDER is the file
/// format's rather than the crate's: accounts first (so C-3's trigger stands
/// down), categories level by level (so `parent_id` resolves), parents before
/// children everywhere else.
const STEPS: [(&str, Option<&str>); 16] = [
    ("accounts", None),
    ("categories", Some("type")),
    ("categories", Some("sub")),
    ("categories", Some("detail")),
    ("budgets", None),
    ("goals", None),
    ("investments", None),
    ("investment_transactions", None),
    ("transactions", None),
    ("transaction_splits", None),
    ("goal_contributions", None),
    ("recurring_transactions", None),
    ("notifications", None),
    ("dashboard_layouts", None),
    ("widget_preferences", None),
    ("suggestion_dismissals", None),
];

fn blank() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute(
            "INSERT INTO users (id, email) VALUES (?1, 'harness@example.test')",
            [OWNER],
        )
        .expect("the file's one login");
    connection
}

/// A small but awkward ledger: a transfer pair, a tagged row, a dismissal with a
/// subject, and three rows whose committed flag takes all three of its values.
fn seeded() -> Connection {
    let connection = blank();
    connection
        .execute_batch(&format!(
            "INSERT INTO categories (id, user_id, name, type, level) VALUES
               ('{TRANSFER_ROOT}', '{OWNER}', 'Transfer', 'both', 'type'),
               ('{OUTGOINGS}', '{OWNER}', 'Outgoings', 'expense', 'type');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor,
                                   last_reconciled_balance_minor) VALUES
               ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -7010, 0, -7010),
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 50000, 0, NULL);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                       category, is_cleared, is_reconciled, needs_review, metadata) VALUES
               -- committed: marked AND settled by a finalize.
               ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -7010, 'expense',
                '2019-05-04', '{OUTGOINGS}', 1, 1, 0, '{{\"reference\":\"kept\"}}'),
               -- explicitly NOT committed.
               ('{PAYDAY}', '{OWNER}', '{RAINY_DAY}', 'Payday', 50000, 'income',
                '2019-05-04', NULL, 0, 0, 1, '{{}}');
             -- pre-split history: the third value, which MEANS 'ask is_cleared'.
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                       is_cleared, is_reconciled) VALUES
               ('{OLD_HISTORY}', '{OWNER}', '{EVERYDAY}', 'Older than the split', 0, 'expense',
                '2018-01-01', 1, NULL);
             INSERT INTO transaction_tags (transaction_id, tag) VALUES
               ('{CORNER_SHOP}', 'groceries'), ('{CORNER_SHOP}', 'weekly');
             INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key) VALUES
               ('d0000000-0000-0000-0000-000000000001', '{OWNER}', 'duplicate', 'corner-shop');
             INSERT INTO suggestion_dismissal_subjects (dismissal_id, transaction_id, role_order)
               VALUES ('d0000000-0000-0000-0000-000000000001', '{CORNER_SHOP}', 0);"
        ))
        .expect("seed");
    connection
}

fn collect(connection: &mut Connection) -> Value {
    let result = collect_backup(
        connection,
        serde_json::from_value::<CollectBackup>(json!({ "user_id": OWNER })).expect("command"),
    )
    .expect("collect");
    serde_json::to_value(result.answer.data).expect("as json")
}

/// The file's rows, sliced into the sixteen chunks the format's steps name.
fn chunks_of(file: &Value) -> Value {
    let mut chunks = Vec::new();
    for (entity, level) in STEPS {
        let rows: Vec<Value> = file
            .get(entity)
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|row| match level {
                None => true,
                Some(wanted) => row.get("level").and_then(Value::as_str) == Some(wanted),
            })
            .collect();
        chunks.push(json!({ "entity": entity, "rows": rows }));
    }
    Value::Array(chunks)
}

fn restore(
    connection: &mut Connection,
    chunks: Value,
) -> Result<wealth_core::verbs::RestoreBackupResult, wealth_core::error::CoreError> {
    let command: RestoreBackup =
        serde_json::from_value(json!({ "chunks": chunks, "user_id": OWNER })).expect("command");
    restore_backup(connection, command)
}

fn wipe(connection: &mut Connection) {
    wipe_user_financial_data(
        connection,
        WipeUserFinancialData {
            confirm: Some("DELETE EVERYTHING".to_owned()),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("wipe");
}

fn scalar(connection: &Connection, sql: &str) -> String {
    connection
        .query_row(sql, [], |row| row.get::<_, rusqlite::types::Value>(0))
        .map(|value| match value {
            rusqlite::types::Value::Null => "NULL".to_owned(),
            rusqlite::types::Value::Integer(number) => number.to_string(),
            rusqlite::types::Value::Real(number) => number.to_string(),
            rusqlite::types::Value::Text(text) => text,
            rusqlite::types::Value::Blob(_) => "BLOB".to_owned(),
        })
        .unwrap_or_else(|error| format!("ERROR {error}"))
}

// ── 1. The trip ─────────────────────────────────────────────────────────────

#[test]
fn a_file_this_edition_writes_is_a_file_this_edition_reads_back_whole() {
    let mut connection = seeded();
    let first = collect(&mut connection);

    wipe(&mut connection);
    let outcome = restore(&mut connection, chunks_of(&first)).expect("restore");

    let second = collect(&mut connection);
    assert_eq!(second, first, "the round trip changed the file");

    // Per STEP, in step order — the shape `RestoreOutcome.restored` needs, and
    // the reason the answer is a list rather than a total.
    assert_eq!(outcome.answer.inserted.len(), STEPS.len());
    assert_eq!(outcome.answer.inserted[0], 2, "two accounts");
    assert_eq!(outcome.answer.inserted[1], 2, "two type-level categories");
    assert_eq!(outcome.answer.inserted[8], 3, "three transactions");
    assert!(outcome.answer.dropped.is_empty(), "{:?}", outcome.answer.dropped);
}

#[test]
fn money_survives_the_trip_as_money_and_never_as_a_double() {
    // −70.10 is a figure IEEE-754 gets wrong the moment anything re-adds it.
    let mut connection = seeded();
    let file = collect(&mut connection);
    let accounts = file["accounts"].as_array().expect("accounts");

    assert_eq!(accounts[0]["balance"], json!("-70.10"), "a decimal string, not a number");
    assert_eq!(accounts[0]["last_reconciled_balance"], json!("-70.10"));
    assert_eq!(accounts[1]["last_reconciled_balance"], Value::Null, "never reconciled");

    wipe(&mut connection);
    restore(&mut connection, chunks_of(&file)).expect("restore");

    assert_eq!(scalar(&connection, "SELECT balance_minor FROM accounts ORDER BY id"), "-7010");
    assert_eq!(
        scalar(&connection, "SELECT SUM(amount_minor) FROM transactions"),
        "42990",
        "every penny, and the sum computed in integers on the way back"
    );
}

#[test]
fn the_pairing_and_the_child_tables_travel_in_the_file() {
    // `linked_transfer_id` is in the FILE and not in any INSERT: it is the cycle
    // the second pass closes. A collect that left it out would export a ledger
    // whose every transfer came back unpaired, silently, in the only copy.
    let mut connection = seeded();
    connection
        .execute_batch(&format!(
            "UPDATE transactions SET transfer_account_id = '{RAINY_DAY}' WHERE id = '{CORNER_SHOP}';
             UPDATE transactions SET transfer_account_id = '{EVERYDAY}'  WHERE id = '{PAYDAY}';
             UPDATE transactions SET linked_transfer_id = '{PAYDAY}'     WHERE id = '{CORNER_SHOP}';
             UPDATE transactions SET linked_transfer_id = '{CORNER_SHOP}' WHERE id = '{PAYDAY}';"
        ))
        .expect("a linked pair");

    let file = collect(&mut connection);
    let rows = file["transactions"].as_array().expect("transactions");
    assert_eq!(rows[0]["linked_transfer_id"], json!(PAYDAY));
    assert_eq!(rows[0]["tags"], json!(["groceries", "weekly"]));
    assert_eq!(
        file["suggestion_dismissals"][0]["subject_ids"],
        json!([CORNER_SHOP]),
        "a dismissal's subjects are a SEQUENCE, ordered by role_order"
    );

    // And the links close in the SAME transaction as the rows, which is what
    // R-11's deferred keys buy: no second call, no window with a stranded leg.
    wipe(&mut connection);
    let links = json!({
        "transaction_links": [
            { "id": CORNER_SHOP, "linked_transfer_id": PAYDAY },
            { "id": PAYDAY, "linked_transfer_id": CORNER_SHOP },
        ]
    });
    let command: RestoreBackup = serde_json::from_value(json!({
        "chunks": chunks_of(&file),
        "links": links,
        "user_id": OWNER,
    }))
    .expect("command");
    let outcome = restore_backup(&mut connection, command).expect("restore");
    assert_eq!(outcome.answer.transactions_relinked, 2);
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM transactions a JOIN transactions b ON b.id = a.linked_transfer_id
              WHERE b.linked_transfer_id = a.id"
        ),
        "2",
        "the pair names its partner both ways round"
    );
}

// ── 2. One transaction ──────────────────────────────────────────────────────

#[test]
fn a_restore_that_refuses_on_its_last_chunk_leaves_the_file_exactly_as_it_was() {
    // B-10 / R-16, and the whole difference between the two engines. The cloud
    // commits each chunk on its own, so this same failure leaves the login
    // PARTLY POPULATED and its recovery is "wipe and retry". Here there is
    // nothing to recover from.
    let mut connection = seeded();
    let file = collect(&mut connection);
    wipe(&mut connection);

    let empty_before = scalar(&connection, "SELECT COUNT(*) FROM transactions");
    assert_eq!(empty_before, "0");

    // The last chunk names a table the format does not carry. Everything before
    // it is legal, and a chunked restore would have committed all of it.
    let mut chunks = chunks_of(&file).as_array().expect("array").clone();
    chunks.push(json!({ "entity": "not_a_table", "rows": [{ "id": "x" }] }));

    let refusal = restore(&mut connection, Value::Array(chunks)).expect_err("unknown entity");
    assert_eq!(refusal.code(), "restore_entity_unknown");

    for table in ["accounts", "categories", "transactions", "transaction_tags"] {
        assert_eq!(
            scalar(&connection, &format!("SELECT COUNT(*) FROM {table}")),
            "0",
            "{table} was written by a restore that refused"
        );
    }
}

#[test]
fn a_restore_over_a_file_that_still_holds_something_is_refused_before_anything_is_read() {
    let mut connection = seeded();
    let file = collect(&mut connection);
    let before = scalar(&connection, "SELECT COUNT(*) FROM transactions");

    let refusal = restore(&mut connection, chunks_of(&file)).expect_err("not empty");
    assert_eq!(refusal.code(), "restore_target_not_empty");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM transactions"), before);

    // The precondition is asked ONCE about the FILE, not per accounts chunk —
    // so a file with no accounts section is refused too, where the cloud would
    // land it on top of a populated login.
    let refusal = restore(&mut connection, json!([{ "entity": "categories", "rows": [] }]))
        .expect_err("a file with no accounts is still a restore");
    assert_eq!(refusal.code(), "restore_target_not_empty");
}

// ── 3. The null story ───────────────────────────────────────────────────────

#[test]
fn the_third_value_of_the_committed_flag_survives_the_round_trip() {
    // The obligation `schema.sql` recorded at the column, discharged. NULL there
    // MEANS "this row predates the split between marking and committing; ask
    // is_cleared". A restored cloud history is made of exactly those rows, and
    // the default filling them in would report a whole reconciled history as
    // work still outstanding.
    let mut connection = seeded();
    let file = collect(&mut connection);

    let rows = file["transactions"].as_array().expect("transactions");
    let by_id = |id: &str| {
        rows.iter().find(|row| row["id"] == json!(id)).expect("row").clone()
    };
    assert_eq!(by_id(CORNER_SHOP)["is_reconciled"], json!(true), "committed");
    assert_eq!(by_id(PAYDAY)["is_reconciled"], json!(false), "explicitly not committed");
    assert_eq!(by_id(OLD_HISTORY)["is_reconciled"], Value::Null, "the third value");

    wipe(&mut connection);
    restore(&mut connection, chunks_of(&file)).expect("restore");

    assert_eq!(
        scalar(
            &connection,
            "SELECT group_concat(COALESCE(CAST(is_reconciled AS TEXT), 'NULL'), '/')
               FROM (SELECT is_reconciled FROM transactions ORDER BY id)"
        ),
        "1/0/NULL",
        "committed, not committed, and never asked — all three, back as they went"
    );
}

#[test]
fn a_column_the_file_never_heard_of_arrives_at_the_schemas_own_default() {
    // The other half of the same rule, and the half that is about NOT NULL
    // columns:
    //
    //   KEY ABSENT             -> the default. An older backup restores into a
    //                             newer schema.
    //   KEY null, NOT NULL col -> the default too. No legal export could have
    //                             produced it, so it is read as "not stated".
    //
    // A nullable column is never reached by either branch — it takes the file's
    // value or NULL, which is what the differential spec
    // `restore-a-deliberate-null-is-not-the-same-as-a-column-the-file-never-
    // mentioned` measured against the cloud and corrected this port with.
    let mut connection = blank();
    let chunks = json!([
        { "entity": "accounts", "rows": [
            { "id": EVERYDAY, "name": "Everyday", "type": "checking", "currency": "GBP",
              "balance": "0.00", "initial_balance": "0.00", "metadata": {} },
        ]},
        { "entity": "transactions", "rows": [
            // A file from before either flag existed.
            { "id": CORNER_SHOP, "account_id": EVERYDAY, "description": "Corner shop",
              "amount": "-70.10", "type": "expense", "date": "2019-05-04",
              // Stated, so that the two rows below differ in the OUTPUT and not
              // merely in the input: a fixture whose branches produce the same
              // string proves nothing about which branch ran.
              "is_cleared": true },
            // And a hand-edited one that states null for two columns that cannot
            // hold it.
            { "id": PAYDAY, "account_id": EVERYDAY, "description": "Payday",
              "amount": "70.10", "type": "income", "date": "2019-05-04",
              "needs_review": null, "is_cleared": null },
        ]},
    ]);
    restore(&mut connection, chunks).expect("an older file still restores");

    assert_eq!(
        scalar(
            &connection,
            "SELECT group_concat(needs_review || '/' || is_cleared || '/'
                      || COALESCE(CAST(is_reconciled AS TEXT), 'NULL'), ' ')
               FROM (SELECT * FROM transactions ORDER BY id)"
        ),
        // needs_review 0 = reviewed (silence is safe) on both rows; is_cleared
        // as each row stated it; and is_reconciled NULL on both, because it is
        // NULLABLE and a silence about a nullable column is a null rather than
        // a default — which is what "this row predates the split" is spelled
        // as, and what the cloud does with the same file.
        "0/1/NULL 0/0/NULL",
        "the schema's own answers for what the past did not know — and NULL for \
         the one column that may hold one, on both engines"
    );
}

// ── 4. Rule 84's mechanism ──────────────────────────────────────────────────

#[test]
fn accounts_go_in_first_so_the_file_brings_its_own_transfer_categories() {
    // C-3's trigger stands itself down while the login has no type-level
    // Transfer category — which is what stops a restore minting a To/From row
    // for every account in the file and then inserting the file's own beside it.
    // Two To/From categories for one account is not cosmetic: the transfer
    // picker offers the same account twice under two ids.
    // The seed writes the Transfer anchor BEFORE its accounts, so C-3's trigger
    // has already minted one To/From category per account — with ids nobody
    // predicted, which is exactly the shape a real ledger is in.
    let mut connection = seeded();
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM categories WHERE is_transfer_category = 1"),
        "2",
        "the fixture starts where a real ledger starts"
    );

    let file = collect(&mut connection);
    wipe(&mut connection);
    restore(&mut connection, chunks_of(&file)).expect("restore");

    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM categories WHERE is_transfer_category = 1"
        ),
        "2",
        "one per account, and not one more"
    );
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM accounts a
              WHERE (SELECT COUNT(*) FROM categories c
                      WHERE c.account_id = a.id AND c.is_transfer_category = 1) <> 1"
        ),
        "0"
    );

    // And the trigger IS armed — inserting an account NOW, with the anchor in
    // place, mints one. Without this the test above would pass on a file whose
    // trigger had simply been dropped.
    connection
        .execute_batch(&format!(
            "INSERT INTO accounts (id, user_id, name, type) VALUES
               ('a0000000-0000-0000-0000-00000000000f', '{OWNER}', 'Holiday fund', 'savings');"
        ))
        .expect("a third account");
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM categories WHERE is_transfer_category = 1"),
        "3",
        "the trigger stands down during a restore, not always"
    );
}

// ── 5. The collector's own refusals ─────────────────────────────────────────

#[test]
fn a_collect_with_no_owner_is_refused_rather_than_reading_the_nearest_ledger() {
    let mut connection = seeded();
    let refusal = collect_backup(
        &mut connection,
        serde_json::from_value::<CollectBackup>(json!({})).expect("command"),
    )
    .expect_err("no owner");
    assert_eq!(refusal.code(), "owner_unknown");
}

#[test]
fn a_new_file_collects_to_fourteen_empty_sections_rather_than_to_nothing() {
    // `buildBackupBundle`'s rule, kept on this side of the seam too: *"a reader
    // should not have to tell 'this user has no investments' apart from 'this
    // export forgot about investments'."*
    let mut connection = blank();
    let file = collect(&mut connection);
    let sections = file.as_object().expect("an object");
    assert_eq!(sections.len(), 14);
    for (name, rows) in sections {
        assert_eq!(rows, &json!([]), "{name} should be an empty array");
    }
}
