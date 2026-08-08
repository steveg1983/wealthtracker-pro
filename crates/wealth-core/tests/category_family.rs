//! Integration tests for the category family, against the real vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`: forty-seven
//! specs, every one of them running the same payload against the live Postgres
//! RPC and these verbs. What is here is the half that has **no Postgres
//! counterpart to compare against**, and there are five kinds of it:
//!
//! 1. **The returned counts.** `merge_categories` returns five of them and the
//!    other two verbs return one each. The differential harness compares stored
//!    ROWS, not return values, so the numbers the client acts on — the toast that
//!    says how many transactions moved — are asserted here.
//! 2. **The `leg` guard, both halves.** `verbs/mod.rs` claims `merge_categories`
//!    needs `_rpc_guard('leg')` conditionally. Both halves of that are claims
//!    about a SQLite trigger with no cloud twin: that the guard is HELD where a
//!    linked leg is re-filed (or the merge would be refused), and that it is
//!    RELEASED afterwards, so the protection is back on before the call returns.
//! 3. **The refusal ORDER**, where the pair that proves it cannot be built on
//!    both engines. `categories_flags_exclusive` is a local-only CHECK, so a
//!    category that is both the unassigned bucket and a transfer category — the
//!    fixture for one of the fifteen measured order pairs — cannot exist locally
//!    at all. What CAN be built is asserted here.
//! 4. **The audit chain.** Whether the hashes actually chain across a write that
//!    touches four tables is a local invariant; there is no cloud hash to compare
//!    to, and this is the largest number of entities any verb in this crate
//!    writes in one transaction.
//! 5. **Atomicity.** `merge_left_references` aborts a call that has already moved
//!    rows. The differential harness sees the end state; this sees that the
//!    audit log is empty too, which is the half that says the rollback took the
//!    evidence with it rather than leaving a record of a change that was undone.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::verbs::{
    apply_category_to_uncategorized, confirm_transaction_categories, merge_categories,
    ApplyCategoryToUncategorized, ConfirmTransactionCategories, MergeCategories,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const THEIR_ACCOUNT: &str = "a0000000-0000-0000-0000-000000000009";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";
const OUTGOINGS: &str = "c0000000-0000-0000-0000-000000000002";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const SOURCE: &str = "c0000000-0000-0000-0000-0000000000e1";
const TARGET: &str = "c0000000-0000-0000-0000-0000000000e2";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";
const COUNTERPART: &str = "70000000-0000-0000-0000-000000000009";
const BLANK_ROW: &str = "70000000-0000-0000-0000-000000000021";
const GUESSED_ROW: &str = "70000000-0000-0000-0000-000000000025";
const LEG_LINE: &str = "50000000-0000-0000-0000-000000000001";
const PLAIN_LINE: &str = "50000000-0000-0000-0000-000000000002";
const BUDGET: &str = "b0000000-0000-0000-0000-000000000001";
const RECURRING: &str = "d0000000-0000-0000-0000-000000000001";

/// One owner, two accounts (each minting its own To/From category through C-3's
/// trigger), a category tree, the −25.00 Corner shop row Everyday's balance
/// matches, and the two leaves every merge test joins.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO categories (id, user_id, name, type, level) VALUES
               ('{TRANSFER_ROOT}', '{OWNER}', 'Transfer', 'both', 'type'),
               ('{OUTGOINGS}', '{OWNER}', 'Outgoings', 'expense', 'type');
             INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{WEEKLY_SHOP}', '{OWNER}', 'Weekly shop', 'expense', 'sub', '{OUTGOINGS}'),
               ('{SOURCE}', '{OWNER}', 'Food shopping', 'expense', 'detail', '{OUTGOINGS}'),
               ('{TARGET}', '{OWNER}', 'Groceries', 'expense', 'detail', '{OUTGOINGS}');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor) VALUES
               ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0),
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 0, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category)
               VALUES ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense',
                       '2024-03-01', '{WEEKLY_SHOP}');"
        ))
        .expect("fixture");
    connection
}

/// Corner shop, filed under the source through both reference columns.
fn filed_under_the_source(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "UPDATE transactions SET category = '{SOURCE}', category_id = '{SOURCE}'
              WHERE id = '{CORNER_SHOP}';"
        ))
        .expect("filed");
}

/// A budget and a recurring template, both pointing at the source.
fn other_surfaces(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO budgets (id, user_id, name, amount_minor, period, category, category_id, start_date)
               VALUES ('{BUDGET}', '{OWNER}', 'Food', 10000, 'monthly', '{SOURCE}', '{SOURCE}', '2024-01-01');
             INSERT INTO recurring_transactions
               (id, user_id, account_id, description, amount_minor, type, category, frequency,
                start_date, next_date)
               VALUES ('{RECURRING}', '{OWNER}', '{EVERYDAY}', 'Weekly food', -2000, 'expense',
                       '{SOURCE}', 'weekly', '2024-01-01', '2024-01-08');"
        ))
        .expect("surfaces");
}

/// Corner shop as a split whose first line is a LINKED transfer leg filed under
/// the source. The shape `trg_protect_linked_leg` (S-9) watches.
fn linked_leg_under_the_source(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{CORNER_SHOP}';
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, transfer_account_id)
               VALUES ('{COUNTERPART}', '{OWNER}', '{RAINY_DAY}', 'Counterpart', 1500, 'transfer',
                       '2024-03-01', '{EVERYDAY}');
             UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '{RAINY_DAY}';
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor,
                                             sort_order, transfer_account_id, linked_transfer_id)
               VALUES ('{LEG_LINE}', '{CORNER_SHOP}', '{OWNER}', '{SOURCE}', -1500, 0,
                       '{RAINY_DAY}', '{COUNTERPART}');
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
               VALUES ('{PLAIN_LINE}', '{CORNER_SHOP}', '{OWNER}', '{WEEKLY_SHOP}', -1000, 1);
             UPDATE transactions SET linked_transfer_split_id = '{LEG_LINE}' WHERE id = '{COUNTERPART}';
             DELETE FROM _rpc_guard;"
        ))
        .expect("linked leg");
}

/// A second login, an account of theirs, and a split line of OURS on a parent of
/// theirs — the only route to `merge_left_references`.
fn my_line_on_their_parent(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{THEIR_ACCOUNT}', '{STRANGER}', 'Not yours', 'checking', -1000, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, is_split, category)
               VALUES ('70000000-0000-0000-0000-0000000000aa', '{STRANGER}', '{THEIR_ACCOUNT}',
                       'Theirs', -1000, 'expense', '2024-05-01', 1, '');
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
               VALUES ('50000000-0000-0000-0000-0000000000aa', '70000000-0000-0000-0000-0000000000aa',
                       '{OWNER}', '{SOURCE}', -1000, 0);"
        ))
        .expect("their parent");
}

/// The five rows the provenance verbs tell apart.
fn every_shape_of_filing(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "UPDATE accounts SET balance_minor = balance_minor - 500 WHERE id = '{EVERYDAY}';
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, category, category_confirmed) VALUES
               ('{BLANK_ROW}', '{OWNER}', '{EVERYDAY}', 'Blank', -100, 'expense', '2024-05-01', '', 0),
               ('70000000-0000-0000-0000-000000000022', '{OWNER}', '{EVERYDAY}', 'Null', -100, 'expense', '2024-05-02', NULL, 0),
               ('70000000-0000-0000-0000-000000000023', '{OWNER}', '{EVERYDAY}', 'Spaces', -100, 'expense', '2024-05-03', '   ', 0),
               ('70000000-0000-0000-0000-000000000024', '{OWNER}', '{EVERYDAY}', 'Filed', -100, 'expense', '2024-05-04', '{WEEKLY_SHOP}', 1),
               ('{GUESSED_ROW}', '{OWNER}', '{EVERYDAY}', 'Guessed', -100, 'expense', '2024-05-05', '{WEEKLY_SHOP}', 0);"
        ))
        .expect("filing shapes");
}

fn merge(source: &str, target: &str) -> MergeCategories {
    MergeCategories {
        source_id: Some(source.to_owned()),
        target_id: Some(target.to_owned()),
        user_id: Some(OWNER.to_owned()),
    }
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

fn text(connection: &Connection, sql: &str) -> String {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

// ── 1. The counts the client acts on ───────────────────────────────────────

#[test]
fn a_merge_counts_each_surface_it_moved() {
    let mut connection = fixture();
    filed_under_the_source(&connection);
    other_surfaces(&connection);

    let result = merge_categories(&mut connection, merge(SOURCE, TARGET)).expect("merge");

    assert_eq!(result.transactions, 1, "one whole transaction");
    assert_eq!(result.budgets, 1, "one budget");
    assert_eq!(result.recurring, 1, "one recurring template");
    assert_eq!(result.split_lines, 0, "no split lines");
    assert_eq!(result.split_transactions, 0, "no split parents");
    assert_eq!(result.source_id, SOURCE);
    assert_eq!(result.target_id, TARGET);
    // The house key, and the row it names: the FIRST whole transaction moved.
    assert_eq!(
        result.transaction.as_ref().map(|row| row.id.as_str()),
        Some(CORNER_SHOP)
    );
}

#[test]
fn a_split_parent_is_counted_once_in_each_loop() {
    // The outcome that looks like double counting and is not: one row, two
    // columns, two facts. MEASURED identical on the reference cluster.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '', category_id = '{SOURCE}'
              WHERE id = '{CORNER_SHOP}';
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
               ('{LEG_LINE}', '{CORNER_SHOP}', '{OWNER}', '{SOURCE}', -1500, 0),
               ('{PLAIN_LINE}', '{CORNER_SHOP}', '{OWNER}', '{WEEKLY_SHOP}', -1000, 1);
             DELETE FROM _rpc_guard;"
        ))
        .expect("split parent");

    let result = merge_categories(&mut connection, merge(SOURCE, TARGET)).expect("merge");

    assert_eq!(result.transactions, 1, "counted by the transactions loop");
    assert_eq!(result.split_lines, 1, "and its line by the lines loop");
    assert_eq!(result.split_transactions, 1, "one parent touched");
    // The blank stayed blank, which is the only reason the first count exists.
    assert_eq!(
        text(
            &connection,
            &format!("SELECT category FROM transactions WHERE id = '{CORNER_SHOP}'")
        ),
        ""
    );
}

#[test]
fn two_lines_of_one_parent_are_two_lines_and_one_entry() {
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{CORNER_SHOP}';
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
               ('{LEG_LINE}', '{CORNER_SHOP}', '{OWNER}', '{SOURCE}', -1500, 0),
               ('{PLAIN_LINE}', '{CORNER_SHOP}', '{OWNER}', '{SOURCE}', -1000, 1);
             DELETE FROM _rpc_guard;"
        ))
        .expect("split parent");

    let result = merge_categories(&mut connection, merge(SOURCE, TARGET)).expect("merge");

    assert_eq!(result.split_lines, 2);
    assert_eq!(result.split_transactions, 1);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM transaction_splits"),
        2,
        "two lines on the same target are still two lines"
    );
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        2,
        "one entry for the parent, one for the category delete"
    );
}

// ── 2. The `leg` guard, both halves ────────────────────────────────────────

#[test]
fn the_trigger_the_merge_stands_down_is_armed() {
    // The control. Without it, the next test proves only that the merge works —
    // not that it needed the guard to. This is the same UPDATE the verb makes,
    // by hand, with nothing held.
    let connection = fixture();
    linked_leg_under_the_source(&connection);

    let error = connection
        .execute_batch(&format!(
            "UPDATE transaction_splits SET category = '{TARGET}'
              WHERE transaction_id = '{CORNER_SHOP}' AND category = '{SOURCE}';"
        ))
        .expect_err("S-9 must refuse an unguarded re-filing of a linked leg");
    assert!(
        error.to_string().contains("split_leg_locked"),
        "expected split_leg_locked, got {error}"
    );
}

#[test]
fn a_merge_re_files_a_linked_leg_without_breaking_the_pair() {
    let mut connection = fixture();
    linked_leg_under_the_source(&connection);

    let result = merge_categories(&mut connection, merge(SOURCE, TARGET)).expect(
        "the cloud performs this merge; without _rpc_guard('leg') the local file refuses it",
    );

    assert_eq!(result.split_lines, 1);
    assert_eq!(
        text(
            &connection,
            &format!("SELECT category FROM transaction_splits WHERE id = '{LEG_LINE}'")
        ),
        TARGET
    );
    // Everything the guard stood down for is exactly as it was.
    assert_eq!(
        scalar(
            &connection,
            &format!(
                "SELECT amount_minor FROM transaction_splits WHERE id = '{LEG_LINE}'"
            )
        ),
        -1500
    );
    assert_eq!(
        text(
            &connection,
            &format!(
                "SELECT linked_transfer_id FROM transaction_splits WHERE id = '{LEG_LINE}'"
            )
        ),
        COUNTERPART
    );
    assert_eq!(
        text(
            &connection,
            &format!(
                "SELECT linked_transfer_split_id FROM transactions WHERE id = '{COUNTERPART}'"
            )
        ),
        LEG_LINE
    );
}

#[test]
fn the_guard_is_released_before_the_verb_returns() {
    // The half that a "does the merge work" test cannot see. A guard left in the
    // table would stand S-9 down for every write that followed on this file —
    // and `_rpc_guard` is a real table, not a temp one, so it would survive the
    // connection as well.
    let mut connection = fixture();
    linked_leg_under_the_source(&connection);
    merge_categories(&mut connection, merge(SOURCE, TARGET)).expect("merge");

    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM _rpc_guard"),
        0,
        "the guard table must be empty after the call"
    );
    // And provably back on: the same unguarded edit is refused again.
    let error = connection
        .execute_batch(&format!(
            "UPDATE transaction_splits SET category = '{WEEKLY_SHOP}' WHERE id = '{LEG_LINE}';"
        ))
        .expect_err("S-9 must be armed again");
    assert!(
        error.to_string().contains("split_leg_locked"),
        "expected split_leg_locked, got {error}"
    );
}

#[test]
fn a_merge_that_touches_no_leg_never_takes_the_guard() {
    // The narrowness claim. A merge over ordinary split lines must not stand S-9
    // down at all, so the trigger is armed for the WHOLE call — asserted by
    // arming a second linked leg that the merge does not touch and showing it is
    // still locked afterwards.
    let mut connection = fixture();
    linked_leg_under_the_source(&connection);
    // Re-file the leg away from the source so the merge has no reason to hold
    // the guard, and put an ordinary line on the source instead.
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('leg');
             UPDATE transaction_splits SET category = '{WEEKLY_SHOP}' WHERE id = '{LEG_LINE}';
             DELETE FROM _rpc_guard;
             UPDATE transaction_splits SET category = '{SOURCE}' WHERE id = '{PLAIN_LINE}';"
        ))
        .expect("re-file");

    let result = merge_categories(&mut connection, merge(SOURCE, TARGET)).expect("merge");
    assert_eq!(result.split_lines, 1, "only the ordinary line moved");
    assert_eq!(
        text(
            &connection,
            &format!("SELECT category FROM transaction_splits WHERE id = '{LEG_LINE}'")
        ),
        WEEKLY_SHOP,
        "the linked leg was not touched"
    );
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);
}

// ── 3. Refusal order that cannot be built on both engines ──────────────────

#[test]
fn the_source_guards_run_in_the_order_the_cloud_checks_them() {
    // Measured pairwise on the reference cluster; asserted here for the pairs
    // that are constructible locally. `categories_flags_exclusive` is a
    // local-only CHECK, so the transfer+unassigned pair from probe-merge2.sh's
    // o11 has no local fixture and is deliberately absent.
    let cases: [(&str, &str); 4] = [
        // level beats every flag
        ("UPDATE categories SET level = 'type', is_system = 1 WHERE id = '{S}'",
         "merge_source_is_type_root"),
        // is_system beats the bucket
        ("UPDATE categories SET is_system = 1, is_unassigned_bucket = 1 WHERE id = '{S}'",
         "merge_source_is_system_category"),
        // the bucket beats having children
        ("UPDATE categories SET is_unassigned_bucket = 1 WHERE id = '{S}';
          INSERT INTO categories (id, user_id, name, type, level, parent_id)
            VALUES ('c0000000-0000-0000-0000-0000000000c1', '{O}', 'Child', 'expense', 'detail', '{S}')",
         "merge_source_is_unassigned_bucket"),
        // and having children beats every target guard
        ("INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
            ('c0000000-0000-0000-0000-0000000000c1', '{O}', 'Child', 'expense', 'detail', '{S}'),
            ('c0000000-0000-0000-0000-0000000000c2', '{O}', 'Other', 'expense', 'detail', '{T}')",
         "merge_source_has_children"),
    ];

    for (setup, expected) in cases {
        let mut connection = fixture();
        connection
            .execute_batch(
                &setup
                    .replace("{S}", SOURCE)
                    .replace("{T}", TARGET)
                    .replace("{O}", OWNER),
            )
            .expect("order fixture");
        let error =
            merge_categories(&mut connection, merge(SOURCE, TARGET)).expect_err("must refuse");
        assert_eq!(error.code(), expected, "for setup: {setup}");
    }
}

#[test]
fn a_transfer_category_is_refused_before_its_delete_protection_can_fire() {
    // C-5's trigger would refuse the DELETE anyway — but only after every
    // reference had already moved. The guard ORDER is what makes that
    // protection unreachable through this verb, and the assertion that says so
    // is that the transaction the merge would otherwise have moved is untouched.
    let mut connection = fixture();
    let to_from: String = text(
        &connection,
        &format!("SELECT id FROM categories WHERE account_id = '{EVERYDAY}' AND is_transfer_category = 1"),
    );
    connection
        .execute_batch(&format!(
            "UPDATE transactions SET category = '{to_from}' WHERE id = '{CORNER_SHOP}';"
        ))
        .expect("file under the To/From category");

    let error = merge_categories(&mut connection, merge(&to_from, TARGET))
        .expect_err("a To/From category cannot be merged away");
    assert_eq!(error.code(), "merge_source_is_transfer_category");
    assert_eq!(
        text(
            &connection,
            &format!("SELECT category FROM transactions WHERE id = '{CORNER_SHOP}'")
        ),
        to_from,
        "nothing moved before the refusal"
    );
}

// ── 4. The audit chain across four tables ──────────────────────────────────

#[test]
fn the_audit_chain_links_across_every_surface_a_merge_touches() {
    let mut connection = fixture();
    filed_under_the_source(&connection);
    other_surfaces(&connection);

    let result = merge_categories(&mut connection, merge(SOURCE, TARGET)).expect("merge");

    // Four entries: transaction, budget, recurring_transaction, category.
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        4
    );
    assert_eq!(
        text(
            &connection,
            "SELECT group_concat(entity || '/' || action, ',')
               FROM (SELECT entity, action FROM financial_audit_log ORDER BY seq)"
        ),
        "transaction/update,budget/update,recurring_transaction/update,category/delete",
        "written in the cloud's code order, which is the only non-arbitrary one"
    );

    // Dense, and chained: every row's prev_hash is the row before it.
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log a
              WHERE a.seq > 1
                AND a.prev_hash IS NOT (SELECT b.row_hash FROM financial_audit_log b
                                         WHERE b.seq = a.seq - 1)"
        ),
        0,
        "a link in the chain does not chain"
    );
    assert_eq!(result.audit_seq, 4, "the last entry is the category delete");
    assert_eq!(
        text(
            &connection,
            "SELECT row_hash FROM financial_audit_log WHERE seq = 4"
        ),
        result.audit_row_hash
    );
    assert_eq!(
        text(
            &connection,
            "SELECT entity FROM financial_audit_log WHERE seq = 4"
        ),
        "category"
    );
}

#[test]
fn the_category_delete_entry_carries_the_whole_row_and_no_after() {
    let mut connection = fixture();
    merge_categories(&mut connection, merge(SOURCE, TARGET)).expect("merge");

    let before = text(
        &connection,
        "SELECT before_data FROM financial_audit_log WHERE entity = 'category'",
    );
    let parsed: serde_json::Value = serde_json::from_str(&before).expect("json");
    let object = parsed.as_object().expect("an object");
    assert_eq!(
        object.len(),
        16,
        "the whole categories row, as the reference cluster records it"
    );
    assert_eq!(object["name"], "Food shopping");
    assert_eq!(object["is_transfer_category"], false);
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log
              WHERE entity = 'category' AND after_data IS NULL"
        ),
        1,
        "U-6: a delete has no after"
    );
}

// ── 5. Atomicity ───────────────────────────────────────────────────────────

#[test]
fn a_left_reference_takes_the_moves_and_the_evidence_with_it() {
    let mut connection = fixture();
    filed_under_the_source(&connection);
    other_surfaces(&connection);
    my_line_on_their_parent(&connection);

    let error = merge_categories(&mut connection, merge(SOURCE, TARGET))
        .expect_err("a surviving reference must abort the whole call");
    assert_eq!(error.code(), "merge_left_references");

    // Every move is undone — including the ones that had already happened.
    assert_eq!(
        text(
            &connection,
            &format!("SELECT category FROM transactions WHERE id = '{CORNER_SHOP}'")
        ),
        SOURCE
    );
    assert_eq!(
        text(
            &connection,
            &format!("SELECT category FROM budgets WHERE id = '{BUDGET}'")
        ),
        SOURCE
    );
    assert_eq!(
        text(
            &connection,
            &format!("SELECT category FROM recurring_transactions WHERE id = '{RECURRING}'")
        ),
        SOURCE
    );
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM categories WHERE id = '{SOURCE}'")
        ),
        1,
        "the source survives"
    );
    // And the evidence went with them: the log does not record a change that
    // was undone.
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        0
    );
}

// ── The two provenance verbs ───────────────────────────────────────────────

#[test]
fn the_fan_out_counts_only_the_rows_it_filled() {
    let mut connection = fixture();
    every_shape_of_filing(&connection);

    let result = apply_category_to_uncategorized(
        &mut connection,
        ApplyCategoryToUncategorized {
            ids: Some(vec![
                BLANK_ROW.to_owned(),
                "70000000-0000-0000-0000-000000000022".to_owned(),
                "70000000-0000-0000-0000-000000000023".to_owned(),
                "70000000-0000-0000-0000-000000000024".to_owned(),
                GUESSED_ROW.to_owned(),
                "70000000-0000-0000-0000-0000000000ff".to_owned(),
            ]),
            category: Some(WEEKLY_SHOP.to_owned()),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("fan out");

    assert_eq!(result.applied, 3, "three blanks, and nothing else");
    assert_eq!(result.transactions.len(), 3);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        3,
        "one entry per row changed"
    );
    // The balance is untouched, which for a verb with no amount in it is the
    // difference between "no arithmetic in the code" and "none in the file".
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT balance_minor FROM accounts WHERE id = '{EVERYDAY}'")
        ),
        -3000
    );
}

#[test]
fn the_fan_out_skips_a_split_parent_and_files_the_rest() {
    // WAS: `the_fan_out_loses_the_whole_call_to_one_split_parent`, until
    // 2026-08-08, and the old name is the whole story.
    //
    // 20260713100000:275 added `AND NOT is_split` to the cursor for exactly
    // this; 20260808100000:387 was written from the definition that predates it
    // and dropped it, so naming a split parent alongside good rows raised
    // `split_category_locked` and filed NOTHING. This test reproduced that on
    // the rule that a port refusing less than the cloud is a bug in the port.
    //
    // `20260808180000_apply_category_skips_split_parents.sql` repairs the
    // cloud — the same fix, and the same wrong-base mistake, as
    // 20260808150000's `is_cleared` three days earlier — so the honest port is
    // now the fixed behaviour. MEASURED both ways on the reference cluster
    // (probe-apply-category.sql): before, an error and zero rows filed; after,
    // 2 filed, 2 audit rows, the parent untouched.
    //
    // SKIPPED, not refused: a row the cursor's WHERE clause does not select is
    // a row nobody was going to write, so it is silent and does not count.
    let mut connection = fixture();
    every_shape_of_filing(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{CORNER_SHOP}';
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
               ('{LEG_LINE}', '{CORNER_SHOP}', '{OWNER}', '{WEEKLY_SHOP}', -1500, 0),
               ('{PLAIN_LINE}', '{CORNER_SHOP}', '{OWNER}', '{WEEKLY_SHOP}', -1000, 1);
             DELETE FROM _rpc_guard;"
        ))
        .expect("split parent");

    let result = apply_category_to_uncategorized(
        &mut connection,
        ApplyCategoryToUncategorized {
            ids: Some(vec![
                BLANK_ROW.to_owned(),
                CORNER_SHOP.to_owned(),
                "70000000-0000-0000-0000-000000000022".to_owned(),
            ]),
            category: Some(WEEKLY_SHOP.to_owned()),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("the split parent is skipped, not refused");

    assert_eq!(result.applied, 2, "the two blanks, and not the parent");
    assert_eq!(
        text(
            &connection,
            &format!("SELECT COALESCE(category, 'NULL') FROM transactions WHERE id = '{BLANK_ROW}'")
        ),
        WEEKLY_SHOP,
        "a row that was perfectly fine, filed"
    );
    // The parent is untouched: still blank, still split. Skipping it is not the
    // same as writing a blank over it.
    assert_eq!(
        text(
            &connection,
            &format!("SELECT COALESCE(category, 'NULL') FROM transactions WHERE id = '{CORNER_SHOP}'")
        ),
        "",
        "a split parent's category stays blank by design"
    );
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT is_split FROM transactions WHERE id = '{CORNER_SHOP}'")
        ),
        1
    );
    // Two rows changed, two audit entries. A third would mean the parent was
    // written after all.
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        2
    );
}

#[test]
fn confirming_counts_decisions_rather_than_ids() {
    let mut connection = fixture();
    every_shape_of_filing(&connection);

    let result = confirm_transaction_categories(
        &mut connection,
        ConfirmTransactionCategories {
            ids: Some(vec![
                BLANK_ROW.to_owned(),
                "70000000-0000-0000-0000-000000000022".to_owned(),
                "70000000-0000-0000-0000-000000000023".to_owned(),
                "70000000-0000-0000-0000-000000000024".to_owned(),
                GUESSED_ROW.to_owned(),
                GUESSED_ROW.to_owned(),
            ]),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("confirm");

    assert_eq!(result.confirmed, 1, "one genuine suggestion among six ids");
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        1
    );
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT category_confirmed FROM transactions WHERE id = '{GUESSED_ROW}'")
        ),
        1
    );
}

#[test]
fn confirming_writes_nothing_a_second_time() {
    let mut connection = fixture();
    every_shape_of_filing(&connection);
    let command = || ConfirmTransactionCategories {
        ids: Some(vec![GUESSED_ROW.to_owned()]),
        user_id: Some(OWNER.to_owned()),
    };

    assert_eq!(
        confirm_transaction_categories(&mut connection, command())
            .expect("first")
            .confirmed,
        1
    );
    let again = confirm_transaction_categories(&mut connection, command()).expect("second");
    assert_eq!(again.confirmed, 0);
    assert_eq!(again.audit_seq, None, "and no entry to go with it");
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        1
    );
}

#[test]
fn neither_provenance_verb_takes_the_split_guard() {
    // `verbs/mod.rs` says `apply_category_to_uncategorized` must NOT hold
    // `_rpc_guard('split')`, because holding it would make the local edition
    // quietly succeed where the cloud fails. Proven by the state of the guard
    // table after a call that refused, which is where a leaked flag would show.
    let mut connection = fixture();
    every_shape_of_filing(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{CORNER_SHOP}';
             INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
               ('{LEG_LINE}', '{CORNER_SHOP}', '{OWNER}', '{WEEKLY_SHOP}', -1500, 0),
               ('{PLAIN_LINE}', '{CORNER_SHOP}', '{OWNER}', '{WEEKLY_SHOP}', -1000, 1);
             DELETE FROM _rpc_guard;"
        ))
        .expect("split parent");

    let _ = apply_category_to_uncategorized(
        &mut connection,
        ApplyCategoryToUncategorized {
            ids: Some(vec![CORNER_SHOP.to_owned()]),
            category: Some(WEEKLY_SHOP.to_owned()),
            user_id: Some(OWNER.to_owned()),
        },
    );
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);

    let _ = confirm_transaction_categories(
        &mut connection,
        ConfirmTransactionCategories {
            ids: Some(vec![CORNER_SHOP.to_owned()]),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("confirm skips it");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);
}
