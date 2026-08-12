//! Integration tests for the custom-report trio — `create_custom_report`,
//! `update_custom_report` and `delete_custom_report` — against the real
//! vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`, where the
//! same payload runs against the INSERT, UPDATE and DELETE
//! `20260812140000_reports_outlive_the_browser.sql` gave the cloud. What is here
//! is the half with **no Postgres counterpart to compare against**:
//!
//! 1. **The audit trail.** The cloud writes none for this table — DESIGN.md §5
//!    divergence 10 — so the entries have nothing to be compared against and
//!    everything to be asserted. They are also the first in the crate written for
//!    a row that holds no figure, so what is asserted is not "the number that
//!    moved" but the DEFINITION: a deleted report has to be readable out of its
//!    own entry, because the row was the only copy of it.
//! 2. **The refusal's WORDS.** PostgREST answers `PGRST116`, so the prose is the
//!    app's own and is asserted rather than inherited.
//! 3. **THE REPLACEMENT, which is this family's one real decision.** A patch
//!    ASSIGNS `components` and `filters` where `update_goal` merges `metadata`.
//!    A differential spec would pass either way as long as both engines did the
//!    same thing; the reason it must be a replacement is a fact about what a
//!    report IS, so it is a test rather than a comparison.
//! 4. **The two containers a row is born with**, `[]` and `{}`, which come from
//!    the column and not from the verb — and which are what stand between an
//!    empty report and a page that iterates `null`.
//! 5. **The guard table**, empty across all three, which is the claim
//!    `verbs/mod.rs`'s table makes for every verb and measures rather than
//!    reasons.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it — and this entity could not carry one if it
//! tried, which is [`wealth_core::row::custom_report`]'s whole opening argument.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use serde_json::json;
use wealth_core::db;
use wealth_core::verbs::{
    create_custom_report, delete_custom_report, update_custom_report, CreateCustomReport,
    CustomReportDraft, CustomReportPatch, DeleteCustomReport, UpdateCustomReport,
};
use wealth_core::wire::Field;

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const REPORT: &str = "a1000000-0000-0000-0000-0000000000f1";
const THEIRS: &str = "a1000000-0000-0000-0000-0000000000f9";
const ABSENT: &str = "a1000000-0000-0000-0000-0000000000ff";

/// Two logins, and one account for a filter to name.
///
/// The account is here so that the ids inside `filters` are ids of rows that
/// really exist — not because anything in this family checks, and that is half
/// the point: nothing does, and the tests below say so out loud rather than
/// leaving it to be assumed from a passing run.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES
               ('{OWNER}', 'harness@example.test'),
               ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', 0, 0);"
        ))
        .expect("fixture");
    connection
}

/// A draft with the one column the table insists on, and nothing else.
fn report_draft(id: Option<&str>) -> CustomReportDraft {
    CustomReportDraft {
        id: id.map(ToOwned::to_owned),
        name: Some("Where it went".to_owned()),
        ..CustomReportDraft::default()
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

/// The guard table, which must be empty after every verb: nothing in this family
/// touches a table any `_rpc_guard` flag protects — `custom_reports` has no
/// trigger on it at all — and that is measured rather than reasoned about.
fn guards_held(connection: &Connection) -> i64 {
    scalar(connection, "SELECT COUNT(*) FROM _rpc_guard")
}

/// The `message` a refusal puts on the wire — what `command::respond` copies
/// into the envelope, and therefore the sentence `coreTransport` hands the UI.
///
/// Not `to_string()`: [`wealth_core::error::CoreError`]'s Display prefixes the
/// code, which is right for a log line and wrong for the assertion this family
/// needs.
fn refusal_message(error: &wealth_core::error::CoreError) -> String {
    match error {
        wealth_core::error::CoreError::Refused(refusal) => refusal.message().to_owned(),
        other => panic!("expected a refusal, got {other}"),
    }
}

/// A report already in the file, inserted as SQL rather than through the verb.
///
/// The audit table is immutable by trigger (U-3), so a fixture built by CALLING
/// the create would leave an entry no test could clear and every trail assertion
/// would have to subtract it. A fixture is a STATE, not a history.
///
/// Two components in a stated ORDER and a filter naming two things, because both
/// halves of the wholesale-replacement claim need something to be lost.
fn seed_report(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO custom_reports (id, user_id, name, description, components, filters)
               VALUES ('{REPORT}', '{OWNER}', 'Where it went', 'last quarter',
                       '[{{\"id\":\"one\",\"type\":\"summary\"}},{{\"id\":\"two\",\"type\":\"pie\"}}]',
                       '{{\"dateRange\":\"custom\",\"customStartDate\":\"2024-01-01\",
                          \"accounts\":[\"{EVERYDAY}\"],\"tags\":[\"a-label\"]}}');"
        ))
        .expect("seed report");
}

// ── The audit trail, which the cloud has for this table too: none ────────────

#[test]
fn a_reports_whole_life_is_audited() {
    let mut connection = fixture();

    create_custom_report(
        &mut connection,
        CreateCustomReport {
            user_id: OWNER.to_owned(),
            report: report_draft(Some(REPORT)),
        },
    )
    .expect("create");
    update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                name: Field::Value("Where it really went".to_owned()),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect("update");
    delete_custom_report(
        &mut connection,
        DeleteCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(
        trail(&connection),
        "custom_report/create,custom_report/update,custom_report/delete"
    );
    // U-6: a create has no `before`, a delete has no `after`, an update has both.
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM financial_audit_log
              WHERE (action = 'create' AND before_data IS NULL AND after_data IS NOT NULL)
                 OR (action = 'update' AND before_data IS NOT NULL AND after_data IS NOT NULL)
                 OR (action = 'delete' AND before_data IS NOT NULL AND after_data IS NULL)"
        ),
        3
    );
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn a_deleted_report_is_reconstructable_from_its_entry() {
    // The case the entry exists for. There is no figure in this row to ask "what
    // changed that?" about — the reason budgets and goals are audited — so what
    // this has to prove is the other thing a log is for: the row was the only
    // copy of work somebody composed, and after a delete the entry is all there
    // is.
    let mut connection = fixture();
    seed_report(&connection);

    delete_custom_report(
        &mut connection,
        DeleteCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM custom_reports"), 0);

    let before: serde_json::Value = serde_json::from_str(&text(
        &connection,
        "SELECT before_data FROM financial_audit_log",
    ))
    .expect("the entry is JSON");

    assert_eq!(before["name"], json!("Where it went"));
    assert_eq!(before["description"], json!("last quarter"));
    // The whole definition, not a summary of it: both blocks, in the order they
    // rendered in, and the filter that scoped them.
    assert_eq!(
        before["components"],
        json!([{ "id": "one", "type": "summary" }, { "id": "two", "type": "pie" }])
    );
    assert_eq!(before["filters"]["accounts"], json!([EVERYDAY]));
    assert_eq!(before["filters"]["dateRange"], json!("custom"));
}

#[test]
fn the_entry_carries_the_definition_as_documents_and_not_as_strings() {
    // The wire contract, asserted where it is easiest to break: `components` and
    // `filters` are a real array and a real object on the way out. A row mapper
    // that carried the column's TEXT through would put `"[]"` here, every reader
    // would have to parse the answer a second time, and the two parses would be
    // two chances to disagree about a document neither side owns.
    let mut connection = fixture();
    seed_report(&connection);

    let result = update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                description: Field::Value("this quarter".to_owned()),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect("update");

    assert!(result.answer.components.is_array(), "{:?}", result.answer.components);
    assert!(result.answer.filters.is_object(), "{:?}", result.answer.filters);

    // And the same in the log, which is what the hash chain covers.
    assert_eq!(
        text(
            &connection,
            "SELECT json_type(after_data, '$.components') || '/' ||
                    json_type(after_data, '$.filters')
               FROM financial_audit_log"
        ),
        "array/object"
    );
    // The key ORDER is the struct's, because `serde_json` preserves it and the
    // chain is over the bytes. A reordered projection would re-chain history.
    assert_eq!(
        text(
            &connection,
            "SELECT (SELECT group_concat(key, ',') FROM json_each(after_data))
               FROM financial_audit_log"
        ),
        "id,user_id,name,description,components,filters,created_at,updated_at"
    );
    assert_eq!(guards_held(&connection), 0);
}

// ── The two containers a report is born with ─────────────────────────────────

#[test]
fn a_report_is_born_with_an_empty_list_and_an_empty_object_when_the_caller_states_neither() {
    // `[]` and `{}` rather than `null`, and the difference is an empty report
    // against a page that iterates nothing: the reports page walks `components`
    // and indexes into `filters`. The defaults are the COLUMN's — the verb binds
    // NULL and `COALESCE` reaches the literal — so a row inserted by any other
    // writer gets them too.
    let mut connection = fixture();

    let created = create_custom_report(
        &mut connection,
        CreateCustomReport {
            user_id: OWNER.to_owned(),
            report: report_draft(None),
        },
    )
    .expect("create");

    assert_eq!(created.answer.components, json!([]));
    assert_eq!(created.answer.filters, json!({}));
    assert_eq!(created.answer.description, "");
    // Minted rather than refused: B-5, the same as a budget's or a goal's id.
    assert_eq!(created.answer.id.len(), 36, "{}", created.answer.id);
    // The stored row says the same thing, which is what makes it the column's
    // default rather than the answer's.
    assert_eq!(
        text(&connection, "SELECT components || '/' || filters FROM custom_reports"),
        "[]/{}"
    );
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn a_report_born_with_a_definition_keeps_it_exactly() {
    let mut connection = fixture();

    let created = create_custom_report(
        &mut connection,
        CreateCustomReport {
            user_id: OWNER.to_owned(),
            report: CustomReportDraft {
                id: Some(REPORT.to_owned()),
                name: Some("Where it went".to_owned()),
                description: Some("last quarter".to_owned()),
                components: Some(json!([{ "id": "one", "type": "summary" }])),
                filters: Some(json!({ "dateRange": "custom", "accounts": [EVERYDAY] })),
            },
        },
    )
    .expect("create");

    assert_eq!(created.answer.components, json!([{ "id": "one", "type": "summary" }]));
    assert_eq!(created.answer.filters["accounts"], json!([EVERYDAY]));
    // The account id inside `filters` is opaque content: no key reaches it, and
    // deleting the account it names leaves the report standing. Asserted because
    // it is an ABSENCE — a foreign key added here one day would be found by this
    // test rather than by somebody's failing delete.
    connection
        .execute_batch(&format!("DELETE FROM accounts WHERE id = '{EVERYDAY}';"))
        .expect("the account goes");
    assert_eq!(
        text(&connection, "SELECT json_extract(filters, '$.accounts[0]') FROM custom_reports"),
        EVERYDAY
    );
}

// ── The replacement, which is this family's one real decision ────────────────

#[test]
fn a_patch_replaces_the_components_wholesale_rather_than_merging_them() {
    // The contrast with `update_goal`, which MERGES `metadata` because three
    // unrelated app fields share that column. A component list is ORDERED and a
    // merge of it means nothing: under one, removing the second block would
    // leave it standing and reordering would silently do nothing at all.
    let mut connection = fixture();
    seed_report(&connection);

    let result = update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                components: Field::Value(json!([{ "id": "two", "type": "table" }])),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect("update");

    // ONE block, and it is the new one. A merge — by key or by index — would
    // have left `one` behind or kept `two`'s old `pie`.
    assert_eq!(result.answer.components, json!([{ "id": "two", "type": "table" }]));
    // The column the patch did not mention is untouched, which is the other half
    // of the same statement: replacement is per COLUMN, not per row.
    assert_eq!(result.answer.filters["accounts"], json!([EVERYDAY]));
    assert_eq!(result.answer.name, "Where it went");
}

#[test]
fn a_patch_replaces_the_filters_wholesale_so_a_narrowing_can_be_cleared() {
    // The edit a merge makes impossible: going back to "all accounts" is
    // expressed by sending the filter object WITHOUT `accounts`, and under a
    // merge the old array would survive every update the report ever received.
    let mut connection = fixture();
    seed_report(&connection);

    let result = update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                filters: Field::Value(json!({ "dateRange": "last12Months" })),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect("update");

    assert_eq!(result.answer.filters, json!({ "dateRange": "last12Months" }));
    assert!(
        result.answer.filters.get("accounts").is_none(),
        "the narrowing survived: {:?}",
        result.answer.filters
    );
    // …and `customStartDate` went with it, which is the coherence argument: the
    // keys of this object are one scope, not independent settings.
    assert!(result.answer.filters.get("customStartDate").is_none());
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn an_empty_list_is_a_value_and_an_absent_key_is_not() {
    // The three-state `Field` doing the work it exists for. "The report now has
    // no blocks" and "leave the blocks alone" are different edits, and an
    // `Option` would collapse them into one.
    let mut connection = fixture();
    seed_report(&connection);

    let emptied = update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                components: Field::Value(json!([])),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect("update");
    assert_eq!(emptied.answer.components, json!([]));

    let untouched = update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: REPORT.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                name: Field::Value("Renamed".to_owned()),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect("update");
    assert_eq!(untouched.answer.components, json!([]));
    assert_eq!(untouched.answer.name, "Renamed");
}

// ── The refusal's own words ──────────────────────────────────────────────────

#[test]
fn a_report_that_is_not_there_is_refused_in_a_sentence_a_person_can_read() {
    // Seam rule 4: the `message` is the prose the UI renders, and this family's
    // refusal has no cloud words to inherit — PostgREST's own answer is
    // `PGRST116: JSON object requested, multiple (or no) rows returned`.
    let mut connection = fixture();
    seed_report(&connection);

    let error = update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: ABSENT.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                name: Field::Value("Renamed".to_owned()),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect_err("a report that is not there");

    assert_eq!(error.code(), "custom_report_not_found");
    assert_eq!(refusal_message(&error), "Custom report not found");
    // And nothing moved: the judgement happens before the first write.
    assert_eq!(trail(&connection), "NONE");
    assert_eq!(text(&connection, "SELECT name FROM custom_reports"), "Where it went");
}

#[test]
fn a_strangers_report_is_refused_by_the_same_name_on_an_update() {
    // "Not yours" and "not there" answer identically, which is
    // `crate::row::account::read_owned`'s reasoning: a different answer would
    // tell a caller that an id they cannot see exists.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO custom_reports (id, user_id, name)
               VALUES ('{THEIRS}', '{STRANGER}', 'Not yours');"
        ))
        .expect("their report");

    let error = update_custom_report(
        &mut connection,
        UpdateCustomReport {
            id: THEIRS.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: CustomReportPatch {
                name: Field::Value("Mine now".to_owned()),
                ..CustomReportPatch::default()
            },
        },
    )
    .expect_err("not the owner's");

    assert_eq!(error.code(), "custom_report_not_found");
    assert_eq!(text(&connection, "SELECT name FROM custom_reports"), "Not yours");
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn a_report_with_no_name_at_all_is_refused_by_the_table() {
    // Not by the verb: the rule is `NOT NULL` in both engines, so it holds for a
    // restore and for somebody with a SQLite prompt as well as for this call.
    let mut connection = fixture();

    let error = create_custom_report(
        &mut connection,
        CreateCustomReport {
            user_id: OWNER.to_owned(),
            report: CustomReportDraft::default(),
        },
    )
    .expect_err("no name");

    assert!(error.to_string().contains("NOT NULL"), "{error}");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM custom_reports"), 0);
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn a_name_made_of_spaces_is_refused_where_the_builders_own_check_lets_it_through() {
    // `if (!name)` is true of `"   "` in JavaScript, so the builder saves it and
    // the list then offers a report with no visible name. The CHECK is where
    // that cannot happen.
    let mut connection = fixture();

    let error = create_custom_report(
        &mut connection,
        CreateCustomReport {
            user_id: OWNER.to_owned(),
            report: CustomReportDraft {
                name: Some("   ".to_owned()),
                ..CustomReportDraft::default()
            },
        },
    )
    .expect_err("a blank name");

    assert!(error.to_string().contains("custom_reports_name_not_blank"), "{error}");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM custom_reports"), 0);
}

#[test]
fn a_components_that_is_not_a_list_is_refused_by_the_container_check() {
    // `json_valid` alone would accept this: `{}` is perfectly good JSON. What it
    // is not is something the page can iterate, and a report stored this way
    // draws as a blank panel with no error anywhere.
    let mut connection = fixture();

    let error = create_custom_report(
        &mut connection,
        CreateCustomReport {
            user_id: OWNER.to_owned(),
            report: CustomReportDraft {
                name: Some("Where it went".to_owned()),
                components: Some(json!({ "id": "one" })),
                ..CustomReportDraft::default()
            },
        },
    )
    .expect_err("an object where a list belongs");

    assert!(error.to_string().contains("json_type(components)"), "{error}");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM custom_reports"), 0);
    assert_eq!(trail(&connection), "NONE");
}

// ── The delete, which refuses nothing ────────────────────────────────────────

#[test]
fn deleting_a_report_that_is_not_there_answers_zero_without_refusing() {
    // The asymmetry with the update above, and it is the cloud's shape rather
    // than a decision taken here: `.delete()` has no `.single()` on it, and the
    // seam asks for idempotence by name.
    let mut connection = fixture();
    seed_report(&connection);

    let result = delete_custom_report(
        &mut connection,
        DeleteCustomReport {
            id: ABSENT.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("a successful nothing");

    assert_eq!(result.answer.deleted, 0);
    // A trail that recorded it would be a trail of deletions that never
    // happened.
    assert_eq!(trail(&connection), "NONE");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM custom_reports"), 1);
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn deleting_a_strangers_report_answers_zero_and_leaves_it_standing() {
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "INSERT INTO custom_reports (id, user_id, name)
               VALUES ('{THEIRS}', '{STRANGER}', 'Not yours');"
        ))
        .expect("their report");

    let result = delete_custom_report(
        &mut connection,
        DeleteCustomReport {
            id: THEIRS.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("a successful nothing");

    assert_eq!(result.answer.deleted, 0);
    assert_eq!(trail(&connection), "NONE");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM custom_reports"), 1);
}

#[test]
fn deleting_a_login_takes_its_reports_and_leaves_the_other_logins_alone() {
    // The one key this table has, doing the one thing it is for. A report
    // belonging to a login that no longer exists would travel into every backup
    // taken afterwards.
    //
    // No verb in it, which is why the connection is not `mut`: this is the
    // SCHEMA's claim rather than the trio's, and a test that went through
    // `delete_custom_report` to make it would be testing the wrong thing.
    let connection = fixture();
    seed_report(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO custom_reports (id, user_id, name)
               VALUES ('{THEIRS}', '{STRANGER}', 'Not yours');
             DELETE FROM users WHERE id = '{STRANGER}';"
        ))
        .expect("the stranger goes");

    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM custom_reports"), 1);
    assert_eq!(text(&connection, "SELECT user_id FROM custom_reports"), OWNER);
}
