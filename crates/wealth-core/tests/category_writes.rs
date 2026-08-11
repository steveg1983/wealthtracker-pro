//! Integration tests for the category family's five WRITES —
//! `create_category`, `create_categories`, `update_category`,
//! `delete_category` and `seed_categories` — against the real vendored schema.
//!
//! The sibling file `category_family.rs` covers the three verbs that port an
//! RPC (merge, and the two provenance verbs). These five port a TypeScript
//! writer instead (PHASE3-PLAN D-2), and the differential proof for them lives
//! in `scripts/local-sqlite/verbs.mjs`, where the same payload runs against
//! `planningService`'s own INSERT/UPDATE/DELETE transcribed into SQL.
//!
//! What is here is the half with **no Postgres counterpart to compare against**:
//!
//! 1. **The audit trail.** The cloud writes none for any of these — there is no
//!    function to write one from — so the entries have nothing to be compared
//!    against and everything to be asserted. Including the one verb that
//!    deliberately writes NO entry, which is the claim most likely to rot.
//! 2. **The delete's subtree walk.** The cloud lets `ON DELETE CASCADE` take the
//!    children; this verb walks them, so "every row that went was counted and
//!    audited" and "a loop in `parent_id` does not hang" are properties of this
//!    engine alone.
//! 3. **C-5 through the verb.** The trigger is proved on both engines by the
//!    constraint harness; that a plain delete inherits it, and that the refusal
//!    takes the whole tree back with it, is not.
//! 4. **The two CHECKs the cloud has never had** —
//!    `categories_account_only_for_transfer` and `categories_flags_exclusive`.
//!    A differential spec cannot assert a refusal one engine does not have.
//! 5. **The seed's idempotence and its ids** (B-4). The cloud's answer to the
//!    same question is a different one by construction: it remaps every id, and
//!    its client never asks twice.
//! 6. **The guard table**, empty across all five, which is the claim
//!    `verbs/mod.rs`'s table makes for every verb and measures rather than
//!    reasons.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::verbs::{
    create_categories, create_category, delete_category, seed_categories, update_category,
    CategoryDraft, CategoryPatch, CreateCategories, CreateCategory, DeleteCategory, SeedCategories,
    UpdateCategory,
};
use wealth_core::wire::{Field, Flag};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";
const OUTGOINGS: &str = "c0000000-0000-0000-0000-000000000002";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const NEW_CATEGORY: &str = "c0000000-0000-0000-0000-0000000000f1";
const CHILD: &str = "c0000000-0000-0000-0000-0000000000f2";
const GRANDCHILD: &str = "c0000000-0000-0000-0000-0000000000f3";

/// One login, a Transfer anchor, an expense root with one leaf under it, and one
/// account — which mints its own To/From category through C-3, because the
/// anchor is written first.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO categories (id, user_id, name, type, level) VALUES
               ('{TRANSFER_ROOT}', '{OWNER}', 'Transfer', 'both', 'type'),
               ('{OUTGOINGS}', '{OWNER}', 'Outgoings', 'expense', 'type');
             INSERT INTO categories (id, user_id, name, type, level, parent_id)
               VALUES ('{WEEKLY_SHOP}', '{OWNER}', 'Weekly shop', 'expense', 'sub', '{OUTGOINGS}');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', 0, 0);"
        ))
        .expect("fixture");
    connection
}

/// A file with a login and NOTHING else — what `create_file` leaves behind.
fn empty_file() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'device@localhost');"
        ))
        .expect("fixture");
    connection
}

/// A draft with the three columns the table insists on, and nothing else.
fn draft(id: Option<&str>, name: &str, parent: Option<&str>) -> CategoryDraft {
    CategoryDraft {
        id: id.map(ToOwned::to_owned),
        name: Some(name.to_owned()),
        kind: Some("expense".to_owned()),
        level: Some("detail".to_owned()),
        parent_id: parent.map(ToOwned::to_owned),
        ..CategoryDraft::default()
    }
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

fn text(connection: &Connection, sql: &str) -> String {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

/// Every audit entry, as `entity/action` in write order.
fn trail(connection: &Connection) -> String {
    connection
        .query_row(
            "SELECT COALESCE((SELECT group_concat(entry, ',') FROM (
               SELECT entity || '/' || action AS entry
                 FROM financial_audit_log ORDER BY seq)), 'NONE')",
            [],
            |row| row.get(0),
        )
        .expect("trail")
}

/// The guard table, which must be empty before and after every verb.
fn guards(connection: &Connection) -> i64 {
    scalar(connection, "SELECT COUNT(*) FROM _rpc_guard")
}

// ── The create pair ────────────────────────────────────────────────────────

#[test]
fn a_create_stores_the_row_answers_it_and_audits_it() {
    let mut connection = fixture();

    let result = create_category(
        &mut connection,
        CreateCategory {
            user_id: OWNER.to_owned(),
            category: draft(Some(NEW_CATEGORY), "Fuel", Some(OUTGOINGS)),
        },
    )
    .expect("create");

    // The answer is the row as STORED — the column defaults included, which is
    // what a caller puts straight into state (B-7's shape, for a category).
    assert_eq!(result.answer.id, NEW_CATEGORY);
    assert_eq!(result.answer.name, "Fuel");
    assert_eq!(result.answer.parent_id.as_deref(), Some(OUTGOINGS));
    assert!(result.answer.is_active, "is_active defaults true");
    assert!(!result.answer.is_system);
    assert!(!result.answer.is_transfer_category);

    assert_eq!(
        text(
            &connection,
            &format!("SELECT name FROM categories WHERE id = '{NEW_CATEGORY}'")
        ),
        "Fuel"
    );
    // The cloud writes no audit row for this at all. This one does.
    assert_eq!(trail(&connection), "category/create");
    assert!(result.audit_seq > 0);
    assert!(!result.audit_row_hash.is_empty());
    assert_eq!(guards(&connection), 0, "no guard is held across a create");
}

#[test]
fn a_create_without_an_id_mints_one_and_two_creates_do_not_share_it() {
    let mut connection = fixture();

    let first = create_category(
        &mut connection,
        CreateCategory {
            user_id: OWNER.to_owned(),
            category: draft(None, "Fuel", None),
        },
    )
    .expect("first");
    let second = create_category(
        &mut connection,
        CreateCategory {
            user_id: OWNER.to_owned(),
            category: draft(None, "Parking", None),
        },
    )
    .expect("second");

    assert_eq!(first.answer.id.len(), 36, "a v4 uuid, minted here (B-5)");
    assert_ne!(first.answer.id, second.answer.id);
}

#[test]
fn a_bulk_create_wires_a_child_listed_before_its_parent() {
    // `parent_id` is an IMMEDIATE foreign key in this file, so a one-pass writer
    // would refuse this list. The cloud accepts it (its column is nullable and
    // its RPC defers the links), so a local port that refused would be refusing
    // a tree import the cloud performs.
    let mut connection = fixture();

    let result = create_categories(
        &mut connection,
        CreateCategories {
            user_id: OWNER.to_owned(),
            categories: vec![
                draft(Some(CHILD), "Fuel", Some(NEW_CATEGORY)),
                draft(Some(NEW_CATEGORY), "Motoring", None),
            ],
        },
    )
    .expect("bulk");

    assert_eq!(result.answer.categories.len(), 2);
    assert_eq!(
        text(
            &connection,
            &format!("SELECT parent_id FROM categories WHERE id = '{CHILD}'")
        ),
        NEW_CATEGORY
    );
    // One entry per row, and the `after` was read after the links were wired —
    // so the child's entry records the parent it actually has.
    assert_eq!(trail(&connection), "category/create,category/create");
    let entry = text(
        &connection,
        &format!(
            "SELECT after_data FROM financial_audit_log WHERE entity_id = '{CHILD}'"
        ),
    );
    assert!(
        entry.contains(NEW_CATEGORY),
        "the audited row is the row as stored, not as first inserted: {entry}"
    );
    assert_eq!(guards(&connection), 0);
}

#[test]
fn a_bulk_create_that_the_file_refuses_lands_none_of_it() {
    let mut connection = fixture();

    let refusal = create_categories(
        &mut connection,
        CreateCategories {
            user_id: OWNER.to_owned(),
            categories: vec![
                draft(Some(NEW_CATEGORY), "Fuel", None),
                // `level` is CHECKed on both engines.
                CategoryDraft {
                    level: Some("nonsense".to_owned()),
                    ..draft(Some(CHILD), "Parking", None)
                },
            ],
        },
    )
    .expect_err("refused");

    // The file's own words. This CHECK is written inline rather than as a named
    // CONSTRAINT, so SQLite reports the EXPRESSION — which is the more useful
    // half here, because it lists what was allowed. (The two constraints the
    // cloud does not have ARE named, and their tests match on the name.)
    assert!(
        refusal.to_string().contains("CHECK constraint failed")
            && refusal.to_string().contains("level IN"),
        "the file's own rule: {refusal}"
    );
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM categories WHERE id = '{NEW_CATEGORY}'")
        ),
        0,
        "the first row went back with the second"
    );
    assert_eq!(trail(&connection), "NONE", "and so did its audit entry");
}

// ── The two CHECKs the cloud has never had ─────────────────────────────────

#[test]
fn an_ordinary_category_may_not_name_an_account() {
    let mut connection = fixture();

    let refusal = create_category(
        &mut connection,
        CreateCategory {
            user_id: OWNER.to_owned(),
            category: CategoryDraft {
                account_id: Some(EVERYDAY.to_owned()),
                ..draft(Some(NEW_CATEGORY), "Not a To/From", None)
            },
        },
    )
    .expect_err("refused");

    assert!(
        refusal
            .to_string()
            .contains("categories_account_only_for_transfer"),
        "{refusal}"
    );
}

#[test]
fn a_category_may_not_carry_two_semantic_flags() {
    let mut connection = fixture();

    let refusal = create_category(
        &mut connection,
        CreateCategory {
            user_id: OWNER.to_owned(),
            category: CategoryDraft {
                is_revaluation_category: Some(Flag::Bool(true)),
                is_unassigned_bucket: Some(Flag::Bool(true)),
                ..draft(Some(NEW_CATEGORY), "Both at once", None)
            },
        },
    )
    .expect_err("refused");

    assert!(
        refusal.to_string().contains("categories_flags_exclusive"),
        "{refusal}"
    );
}

// ── The update ─────────────────────────────────────────────────────────────

#[test]
fn an_update_changes_what_it_names_and_audits_before_and_after() {
    let mut connection = fixture();

    let result = update_category(
        &mut connection,
        UpdateCategory {
            id: WEEKLY_SHOP.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CategoryPatch {
                name: Field::Value("Food shopping".to_owned()),
                ..CategoryPatch::default()
            },
        },
    )
    .expect("update");

    assert_eq!(result.answer.name, "Food shopping");
    // Untouched by an update that did not name them.
    assert_eq!(result.answer.level, "sub");
    assert_eq!(result.answer.parent_id.as_deref(), Some(OUTGOINGS));

    assert_eq!(trail(&connection), "category/update");
    let before = text(
        &connection,
        "SELECT before_data FROM financial_audit_log ORDER BY seq DESC LIMIT 1",
    );
    assert!(
        before.contains("Weekly shop"),
        "the entry carries what it was: {before}"
    );
    assert_eq!(guards(&connection), 0);
}

#[test]
fn an_empty_parent_clears_the_link_and_a_category_nobody_has_is_refused() {
    let mut connection = fixture();

    // `categoryToDb` writes `c.parentId || null` — falsy, so '' is a clear.
    update_category(
        &mut connection,
        UpdateCategory {
            id: WEEKLY_SHOP.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CategoryPatch {
                parent_id: Field::Value(String::new()),
                ..CategoryPatch::default()
            },
        },
    )
    .expect("cleared");

    assert_eq!(
        scalar(
            &connection,
            &format!(
                "SELECT COUNT(*) FROM categories WHERE id = '{WEEKLY_SHOP}' AND parent_id IS NULL"
            )
        ),
        1
    );

    let refusal = update_category(
        &mut connection,
        UpdateCategory {
            id: "c0000000-0000-0000-0000-00000000dead".to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CategoryPatch {
                name: Field::Value("Nowhere".to_owned()),
                ..CategoryPatch::default()
            },
        },
    )
    .expect_err("refused");

    assert!(refusal.to_string().contains("category_not_found"), "{refusal}");
    assert_eq!(
        trail(&connection),
        "category/update",
        "the refusal wrote no entry of its own"
    );
}

#[test]
fn a_to_from_category_may_be_renamed_because_neither_engine_stops_it() {
    // C-5 is BEFORE DELETE and nothing else. A verb that refused this would be a
    // second implementation of a protection the schema deliberately did not
    // write — and C-4 puts the name back on the next account rename anyway.
    let mut connection = fixture();
    let to_from = text(
        &connection,
        &format!(
            "SELECT id FROM categories WHERE account_id = '{EVERYDAY}' AND is_transfer_category = 1"
        ),
    );

    let result = update_category(
        &mut connection,
        UpdateCategory {
            id: to_from.clone(),
            user_id: Some(OWNER.to_owned()),
            patch: CategoryPatch {
                name: Field::Value("Renamed by hand".to_owned()),
                ..CategoryPatch::default()
            },
        },
    )
    .expect("accepted");
    assert_eq!(result.answer.name, "Renamed by hand");

    // And C-4 takes it straight back, from the account.
    connection
        .execute(
            "UPDATE accounts SET name = 'Everyday account' WHERE id = ?1",
            [EVERYDAY],
        )
        .expect("rename");
    assert_eq!(
        text(
            &connection,
            &format!("SELECT name FROM categories WHERE id = '{to_from}'")
        ),
        "To/From Everyday account"
    );
}

// ── The delete ─────────────────────────────────────────────────────────────

#[test]
fn a_delete_takes_the_subtree_counts_every_row_and_audits_each() {
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{NEW_CATEGORY}', '{OWNER}', 'Motoring', 'expense', 'sub', '{OUTGOINGS}'),
               ('{CHILD}', '{OWNER}', 'Fuel', 'expense', 'detail', '{NEW_CATEGORY}'),
               ('{GRANDCHILD}', '{OWNER}', 'Diesel', 'expense', 'detail', '{CHILD}');"
        ))
        .expect("tree");

    let result = delete_category(
        &mut connection,
        DeleteCategory {
            id: NEW_CATEGORY.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(result.answer.deleted, 3, "the group and both rows under it");
    assert_eq!(
        scalar(
            &connection,
            &format!(
                "SELECT COUNT(*) FROM categories
                  WHERE id IN ('{NEW_CATEGORY}', '{CHILD}', '{GRANDCHILD}')"
            )
        ),
        0
    );
    // Deepest first, so the log reads in the order the rows actually left.
    assert_eq!(
        trail(&connection),
        "category/delete,category/delete,category/delete"
    );
    assert_eq!(
        text(
            &connection,
            "SELECT entity_id FROM financial_audit_log ORDER BY seq LIMIT 1"
        ),
        GRANDCHILD
    );
    assert_eq!(guards(&connection), 0);
}

#[test]
fn deleting_a_category_nobody_has_is_a_successful_nothing() {
    // No `.single()` on the cloud's query, so no row matched is not an error —
    // the opposite of the update above, and the difference is that one word.
    let mut connection = fixture();

    let result = delete_category(
        &mut connection,
        DeleteCategory {
            id: "c0000000-0000-0000-0000-00000000dead".to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("accepted");

    assert_eq!(result.answer.deleted, 0);
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn a_to_from_category_cannot_be_deleted_and_takes_the_whole_tree_back_with_it() {
    // C-5, reached the long way: a plain group with the account's To/From
    // category moved underneath it. The walk deletes the protected row directly
    // rather than cascading into it, and the trigger raises either way.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{NEW_CATEGORY}', '{OWNER}', 'Motoring', 'expense', 'sub', '{OUTGOINGS}'),
               ('{CHILD}', '{OWNER}', 'Fuel', 'expense', 'detail', '{NEW_CATEGORY}');
             UPDATE categories SET parent_id = '{NEW_CATEGORY}'
              WHERE account_id = '{EVERYDAY}' AND is_transfer_category = 1;"
        ))
        .expect("tree");

    let refusal = delete_category(
        &mut connection,
        DeleteCategory {
            id: NEW_CATEGORY.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect_err("refused");

    // The trigger's own message, verbatim — seam rule 4.
    assert!(
        refusal.to_string().contains("transfer_category_protected"),
        "{refusal}"
    );
    // The whole call, not the part that had not run yet: `Fuel` is deeper than
    // the protected row's siblings and would have gone first.
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM categories WHERE id IN ('{NEW_CATEGORY}', '{CHILD}')")
        ),
        2
    );
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn a_loop_in_the_parent_links_does_not_hang_the_walk() {
    // `parent_id` has no constraint against a cycle in either engine, and a
    // topological walk that trusts the data is a hang waiting to happen. A file
    // that has been through a bad restore is the way one arrives.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{NEW_CATEGORY}', '{OWNER}', 'Motoring', 'expense', 'sub', '{OUTGOINGS}'),
               ('{CHILD}', '{OWNER}', 'Fuel', 'expense', 'detail', '{NEW_CATEGORY}');
             UPDATE categories SET parent_id = '{CHILD}' WHERE id = '{NEW_CATEGORY}';"
        ))
        .expect("loop");

    let result = delete_category(
        &mut connection,
        DeleteCategory {
            id: NEW_CATEGORY.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    // It TERMINATED, and the loop is gone from the file.
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM categories WHERE id IN ('{NEW_CATEGORY}', '{CHILD}')")
        ),
        0
    );
    // And the count DEGRADES rather than lying. In a cycle there is no
    // "deepest", so the first delete's cascade takes the second row before the
    // walk reaches it: one row is removed by this verb and one by the key, and
    // `deleted` reports the one it actually did — which is exactly what
    // SQLite's own single-statement DELETE would have said. The unaudited row is
    // the price of a file whose parent links form a loop, and the alternative
    // (an entry for a delete this verb did not perform) is worse.
    assert_eq!(result.answer.deleted, 1);
    assert_eq!(trail(&connection), "category/delete");
}

// ── The seed ───────────────────────────────────────────────────────────────

/// A four-row tree in the shape the app's own defaults have: two type anchors,
/// one leaf under each, and a child listed BEFORE its parent.
fn starter() -> Vec<CategoryDraft> {
    vec![
        CategoryDraft {
            id: Some("transfer-in".to_owned()),
            name: Some("Transfer In".to_owned()),
            kind: Some("both".to_owned()),
            level: Some("detail".to_owned()),
            parent_id: Some("type-transfer".to_owned()),
            is_system: Some(Flag::Bool(true)),
            ..CategoryDraft::default()
        },
        CategoryDraft {
            id: Some("type-transfer".to_owned()),
            name: Some("Transfer".to_owned()),
            kind: Some("both".to_owned()),
            level: Some("type".to_owned()),
            is_system: Some(Flag::Bool(true)),
            ..CategoryDraft::default()
        },
        CategoryDraft {
            id: Some("type-expense".to_owned()),
            name: Some("Expense".to_owned()),
            kind: Some("expense".to_owned()),
            level: Some("type".to_owned()),
            is_system: Some(Flag::Bool(true)),
            ..CategoryDraft::default()
        },
        CategoryDraft {
            // A parent OUTSIDE the batch: the cloud leaves this link NULL, and
            // so does this.
            parent_id: Some("type-nothing-here".to_owned()),
            ..draft(Some("expense--fuel"), "Fuel", Some("type-nothing-here"))
        },
    ]
}

fn seed(connection: &mut Connection, categories: Vec<CategoryDraft>) -> Vec<String> {
    seed_categories(
        connection,
        SeedCategories {
            user_id: OWNER.to_owned(),
            categories,
        },
    )
    .expect("seed")
    .answer
    .categories
    .into_iter()
    .map(|category| category.id)
    .collect()
}

#[test]
fn a_seed_keeps_the_ids_it_was_given_and_never_remaps_anything() {
    // B-4, and the whole reason the verb is not called `migrate_categories`:
    // 'transfer-in' has to still be 'transfer-in' when the ledger asks for it.
    let mut connection = empty_file();

    let mut ids = seed(&mut connection, starter());
    ids.sort();

    assert_eq!(
        ids,
        vec!["expense--fuel", "transfer-in", "type-expense", "type-transfer"]
    );
    // The child that was listed before its parent got its link in the second
    // pass; the one whose parent is not in the batch did not.
    assert_eq!(
        text(
            &connection,
            "SELECT parent_id FROM categories WHERE id = 'transfer-in'"
        ),
        "type-transfer"
    );
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM categories WHERE id = 'expense--fuel' AND parent_id IS NULL"
        ),
        1
    );
    // Seventy-seven entries in front of the first transaction is not an audit
    // trail. See the verb's module docs.
    assert_eq!(trail(&connection), "NONE");
    assert_eq!(guards(&connection), 0);
}

#[test]
fn a_second_seed_writes_nothing_and_answers_with_what_is_there() {
    let mut connection = empty_file();
    let first = seed(&mut connection, starter());

    // The rows are edited in between, exactly as a person would: the second
    // seed must not put the default back.
    connection
        .execute_batch("UPDATE categories SET name = 'Moving money' WHERE id = 'type-transfer';")
        .expect("rename");

    let second = seed(&mut connection, starter());

    assert_eq!(first.len(), second.len(), "nothing was added on top");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM categories"), 4);
    assert_eq!(
        text(
            &connection,
            "SELECT name FROM categories WHERE id = 'type-transfer'"
        ),
        "Moving money",
        "the caller's own edit survived the boot that asked again"
    );
}

#[test]
fn a_file_that_holds_one_category_is_not_seeded_at_all() {
    // The gate is `EXISTS`, not a per-id check: a person who deleted every
    // default but one must not have the other seventy-six come back.
    let mut connection = fixture();
    let before = scalar(&connection, "SELECT COUNT(*) FROM categories");

    let answered = seed(&mut connection, starter());

    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM categories"), before);
    assert_eq!(
        i64::try_from(answered.len()).expect("count"),
        before,
        "and the answer is the whole stored set, which is what the boot reads"
    );
}

#[test]
fn a_seed_with_nothing_in_it_is_refused_and_so_is_a_row_with_no_id() {
    let mut connection = empty_file();

    let empty = seed_categories(
        &mut connection,
        SeedCategories {
            user_id: OWNER.to_owned(),
            categories: Vec::new(),
        },
    )
    .expect_err("refused");
    assert!(
        empty.to_string().contains("categories_payload_empty"),
        "{empty}"
    );

    let nameless = seed_categories(
        &mut connection,
        SeedCategories {
            user_id: OWNER.to_owned(),
            categories: vec![draft(None, "No id at all", None)],
        },
    )
    .expect_err("refused");
    assert!(
        nameless.to_string().contains("category_missing_id"),
        "{nameless}"
    );
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM categories"),
        0,
        "and neither refusal left half a tree behind"
    );
}

#[test]
fn a_seeded_anchor_does_not_go_back_for_an_account_that_was_made_first() {
    // C-3 stands down when there is no Transfer anchor, and this verb does not
    // backfill what it stood down for — `ensureCategories` never has either.
    // The state is reported rather than repaired.
    let mut connection = empty_file();
    connection
        .execute_batch(&format!(
            "INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', 0, 0);"
        ))
        .expect("account first");

    seed(&mut connection, starter());

    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM categories WHERE is_transfer_category = 1"
        ),
        0
    );
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM v_integrity_violations
              WHERE check_name = 'account_missing_transfer_category'"
        ),
        1,
        "and verify_integrity is what says so"
    );
}
