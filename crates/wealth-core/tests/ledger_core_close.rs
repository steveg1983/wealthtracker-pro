//! Integration tests for the two verbs that close the ledger core:
//! `delete_unused_categories` and `verify_integrity`.
//!
//! The differential proof for the prune lives in `scripts/local-sqlite/verbs.mjs`
//! — eighteen specs, each running one payload against the live Postgres RPC and
//! against this crate. What is here is the half that has **no Postgres
//! counterpart to compare against**:
//!
//! 1. **The ORDER the port imposes.** The cloud is one statement and its order is
//!    the executor's; the local port deletes deepest-first *on purpose*, and the
//!    reason is a SQLite execution detail with no cloud twin. `deepest_first`'s
//!    unit tests cover the ordering function; these cover it against a file.
//!    2. **That the refusal rolls the batch back.** The differential harness sees
//!    the end state on both engines; what it cannot see is whether the local verb
//!    left an audit row behind, and a rollback that keeps a record of a change it
//!    undid is worse than no record at all.
//! 3. **`verify_integrity` entire**, because there is no cloud verify_integrity —
//!    the verb's own module documentation carries the trace. Its twenty-four
//!    specs run on SQLite alone; what is here is the part a spec cannot reach:
//!    that a clean file stays clean *through* a verb, and that the checker
//!    notices the wreckage the prune's measured hole leaves.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::error::CoreError;
use wealth_core::verbs::{
    delete_unused_categories, verify_integrity, DeleteUnusedCategories, VerifyIntegrity,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";
const OUTGOINGS: &str = "c0000000-0000-0000-0000-000000000002";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const PARENT: &str = "c0000000-0000-0000-0000-0000000000e1";
const CHILD: &str = "c0000000-0000-0000-0000-0000000000c1";
const GRANDCHILD: &str = "c0000000-0000-0000-0000-0000000000c2";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";

/// One owner, one account (minting its own To/From category through C-3's
/// trigger), a category tree three deep, and the −25.00 row Everyday's balance
/// matches so B-1 holds before anything runs.
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
               ('{PARENT}', '{OWNER}', 'Food shopping', 'expense', 'detail', '{OUTGOINGS}');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category)
               VALUES ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense',
                       '2024-03-01', '{WEEKLY_SHOP}');"
        ))
        .expect("fixture");
    connection
}

/// A branch under [`PARENT`]: child, then grandchild.
fn a_branch(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{CHILD}', '{OWNER}', 'Child', 'expense', 'detail', '{PARENT}');
             INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{GRANDCHILD}', '{OWNER}', 'Grandchild', 'expense', 'detail', '{CHILD}');"
        ))
        .expect("branch");
}

fn prune(connection: &mut Connection, ids: &[&str]) -> i64 {
    delete_unused_categories(
        connection,
        DeleteUnusedCategories {
            ids: Some(ids.iter().map(|id| (*id).to_owned()).collect()),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("prune")
    .answer
    .deleted
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect("read")
}

fn report(connection: &Connection) -> wealth_core::verbs::IntegrityReport {
    verify_integrity(connection, VerifyIntegrity {})
        .expect("verify")
        .answer
}

// ── delete_unused_categories ───────────────────────────────────────────────

#[test]
fn a_branch_named_whole_is_counted_whole() {
    let mut connection = fixture();
    a_branch(&connection);

    // Three rows, three deletions — the number the cloud gives, and NOT the
    // number SQLite's own single-statement DELETE gives (measured: 1, because
    // the cascade removes the descendants before the scan reaches them).
    assert_eq!(prune(&mut connection, &[PARENT, CHILD, GRANDCHILD]), 3);
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM categories WHERE id IN ('{PARENT}','{CHILD}','{GRANDCHILD}')")
        ),
        0
    );
}

#[test]
fn the_order_is_deepest_first_whatever_order_the_caller_names_them_in() {
    // The caller's list is the WORST order for a naive port: parent first, so a
    // single-statement DELETE would cascade the other two away and count one.
    let mut connection = fixture();
    a_branch(&connection);
    assert_eq!(prune(&mut connection, &[PARENT, CHILD, GRANDCHILD]), 3);

    // And the reverse list must give the same answer, because the order the verb
    // uses is a fact about the tree, not about the request.
    let mut reversed = fixture();
    a_branch(&reversed);
    assert_eq!(prune(&mut reversed, &[GRANDCHILD, CHILD, PARENT]), 3);
}

#[test]
fn a_referenced_descendant_is_not_counted_even_though_it_is_gone() {
    let mut connection = fixture();
    a_branch(&connection);
    connection
        .execute_batch(&format!(
            "UPDATE transactions SET category = '{GRANDCHILD}' WHERE id = '{CORNER_SHOP}';"
        ))
        .expect("file it");

    // TWO, not three: the grandchild's own check skips it, and it is then
    // removed by the cascade from its parent rather than by this call. Both
    // engines answer 2 and both leave the transaction's category dangling.
    assert_eq!(prune(&mut connection, &[PARENT, CHILD, GRANDCHILD]), 2);
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM categories WHERE id = '{GRANDCHILD}'")
        ),
        0
    );
    let filed: String = connection
        .query_row(
            &format!("SELECT category FROM transactions WHERE id = '{CORNER_SHOP}'"),
            [],
            |row| row.get(0),
        )
        .expect("read");
    assert_eq!(filed, GRANDCHILD);
}

#[test]
fn the_prune_writes_nothing_to_the_audit_log() {
    let mut connection = fixture();
    assert_eq!(prune(&mut connection, &[PARENT]), 1);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        0
    );
}

#[test]
fn the_transfer_protection_takes_the_whole_batch_with_it() {
    let mut connection = fixture();
    let transfer_category: String = connection
        .query_row(
            &format!(
                "SELECT id FROM categories WHERE account_id = '{EVERYDAY}' AND is_transfer_category = 1"
            ),
            [],
            |row| row.get(0),
        )
        .expect("the trigger minted one");
    connection
        .execute_batch(&format!(
            "UPDATE categories SET parent_id = '{PARENT}' WHERE id = '{transfer_category}';"
        ))
        .expect("reparent");

    let outcome = delete_unused_categories(
        &mut connection,
        DeleteUnusedCategories {
            ids: Some(vec![PARENT.to_owned(), transfer_category.clone()]),
            user_id: Some(OWNER.to_owned()),
        },
    );

    match outcome {
        Err(CoreError::Refused(refusal)) => {
            assert!(
                refusal.message().contains("transfer_category_protected"),
                "{refusal}"
            );
        }
        other => panic!("expected a refusal, got {other:?}"),
    }

    // The batch rolled back whole: the parent is still here, the protected row
    // is still here, and nothing was audited on the way past.
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM categories WHERE id = '{PARENT}'")
        ),
        1
    );
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM categories WHERE is_transfer_category = 1"
        ),
        1
    );
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        0
    );
    // And the guard table is empty, because the verb never touched it.
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM _rpc_guard"), 0);
}

#[test]
fn no_flag_in_the_guard_table_stands_the_transfer_protection_down() {
    // `verbs/mod.rs` says C-5 is a protection rather than a nuisance and the
    // verb does not try to suppress it. This is that claim, tested from the
    // other side: even with every guard flag held, the refusal is the same.
    let connection = fixture();
    let transfer_category: String = connection
        .query_row(
            &format!(
                "SELECT id FROM categories WHERE account_id = '{EVERYDAY}' AND is_transfer_category = 1"
            ),
            [],
            |row| row.get(0),
        )
        .expect("minted");
    connection
        .execute_batch(&format!(
            "UPDATE categories SET parent_id = '{PARENT}' WHERE id = '{transfer_category}';
             INSERT INTO _rpc_guard VALUES ('split');
             INSERT INTO _rpc_guard VALUES ('leg');
             INSERT INTO _rpc_guard VALUES ('restore');"
        ))
        .expect("reparent and guard");

    let refused = connection
        .execute_batch(&format!("DELETE FROM categories WHERE id = '{PARENT}'"))
        .expect_err("C-5 must still fire");
    assert!(
        refused.to_string().contains("transfer_category_protected"),
        "{refused}"
    );
}

// ── verify_integrity ───────────────────────────────────────────────────────

#[test]
fn a_clean_file_stays_clean_through_a_prune() {
    let mut connection = fixture();
    a_branch(&connection);
    assert!(report(&connection).ok);

    assert_eq!(prune(&mut connection, &[GRANDCHILD]), 1);

    let after = report(&connection);
    assert!(after.ok, "{:?}", after.findings);
    assert_eq!(after.violations, 0);
    assert_eq!(after.warnings, 0);
}

#[test]
fn the_checker_sees_the_wreckage_the_prune_leaves_behind() {
    // The two halves of the family, joined: the prune's measured hole produces
    // exactly the state verify_integrity's dangling_category_ref reports, and
    // this is the only place both are exercised in one file.
    let mut connection = fixture();
    a_branch(&connection);
    connection
        .execute_batch(&format!(
            "UPDATE transactions SET category = '{GRANDCHILD}' WHERE id = '{CORNER_SHOP}';"
        ))
        .expect("file it");
    assert!(report(&connection).ok);

    assert_eq!(prune(&mut connection, &[PARENT, CHILD, GRANDCHILD]), 2);

    let after = report(&connection);
    assert!(!after.ok);
    assert_eq!(after.violations, 1);
    assert_eq!(after.findings[0].check, "dangling_category_ref");
    assert_eq!(after.findings[0].entity, "transaction");
    assert_eq!(after.findings[0].id, CORNER_SHOP);
    assert_eq!(after.findings[0].severity, "violation");
}

#[test]
fn a_warning_never_makes_the_file_not_ok() {
    let connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('a0000000-0000-0000-0000-0000000000ca', '{OWNER}', 'Card', 'credit', 5000, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, import_source, import_source_id)
               VALUES ('70000000-0000-0000-0000-0000000000f0', '{OWNER}',
                       'a0000000-0000-0000-0000-0000000000ca', 'Shop', 5000, 'income',
                       '2024-04-01', 'ofx', 'ofx-1');"
        ))
        .expect("card");

    let answer = report(&connection);
    assert!(answer.ok, "a heuristic must not condemn a file");
    assert_eq!(answer.violations, 0);
    assert_eq!(answer.warnings, 1);
    assert_eq!(answer.findings.len(), 1);
    assert_eq!(answer.findings[0].severity, "warning");

    // And the view's own one-line verdict agrees with the verb's.
    assert_eq!(scalar(&connection, "SELECT ok FROM v_integrity_ok"), 1);
}

#[test]
fn the_report_is_ordered_by_check_then_entity_then_id() {
    // Two checks and three findings in one file, planted in the order that would
    // come out wrong if the verb trusted UNION ALL.
    let connection = fixture();
    connection
        .execute_batch(&format!(
            "UPDATE accounts SET balance_minor = balance_minor + 1 WHERE id = '{EVERYDAY}';
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor,
                                   bank_balance_minor, bank_balance_date)
               VALUES ('a0000000-0000-0000-0000-0000000000ca', '{OWNER}', 'Card', 'credit',
                       -1000, 0, 400000, '2024-04-01');
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
               VALUES ('70000000-0000-0000-0000-0000000000f0', '{OWNER}',
                       'a0000000-0000-0000-0000-0000000000ca', 'Shop', -1000, 'expense', '2024-04-01');"
        ))
        .expect("two kinds of wrong");

    let answer = report(&connection);
    let names: Vec<&str> = answer
        .findings
        .iter()
        .map(|finding| finding.check.as_str())
        .collect();
    assert_eq!(names, ["balance_identity", "bank_balance_implausible"]);
    assert_eq!(answer.violations, 1);
    assert_eq!(answer.warnings, 1);
    assert!(!answer.ok);
}

#[test]
fn the_totals_always_add_up_to_the_list() {
    // The report's two counts and its own findings are read once, from one
    // query, so they cannot disagree. Asserted rather than assumed because a
    // second query for the counts is the obvious "tidier" refactor.
    let connection = fixture();
    connection
        .execute_batch(&format!(
            "UPDATE accounts SET balance_minor = balance_minor + 1 WHERE id = '{EVERYDAY}';
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('a0000000-0000-0000-0000-0000000000ca', '{OWNER}', 'Card', 'credit', 5000, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type,
                                       date, import_source, import_source_id)
               VALUES ('70000000-0000-0000-0000-0000000000f0', '{OWNER}',
                       'a0000000-0000-0000-0000-0000000000ca', 'Shop', 5000, 'income',
                       '2024-04-01', 'ofx', 'ofx-1');"
        ))
        .expect("one of each");

    let answer = report(&connection);
    let total = i64::try_from(answer.findings.len()).expect("small");
    assert_eq!(answer.violations + answer.warnings, total);
    assert_eq!(answer.ok, answer.violations == 0);
}
