//! Integration tests for the dismissal pair — `dismiss_suggestion` and
//! `restore_suggestion` — against the real vendored schema.
//!
//! The differential proof for both lives in `scripts/local-sqlite/verbs.mjs`,
//! where the same payload runs against `suggestionDismissalService`'s own INSERT
//! and DELETE transcribed into SQL. What is here is the half with **no Postgres
//! counterpart to compare against**:
//!
//! 1. **`recorded`.** The flag that separates *"answered with the row already
//!    there"* from *"wrote a second row and got lucky"*. It is deliberately
//!    outside the compared `answer` (a key the cloud's `.select()` has no
//!    counterpart for would be reported as a divergence by every spec that used
//!    it), so this is the only place it can be asserted directly. The
//!    differential half proves the same rule from outside, by the id.
//! 2. **The absence of an audit trail**, which is a claim about nothing being
//!    there and therefore one only a test can hold. Both engines agree — see
//!    [`wealth_core::verbs::dismiss_suggestion`] for why divergence 10 does not
//!    extend here — so a differential spec can only ever compare zero against
//!    zero, and would go on passing if BOTH sides started writing entries.
//! 3. **The subject cascade, from the child table's own side.** The differential
//!    spec counts subject rows through a probe that spells the question
//!    differently per engine; this one watches the actual table.
//! 4. **The owner-less arity.** `restore_suggestion` takes `user_id: Option`,
//!    like every owner-scoped verb here, and what an absent owner REACHES is a
//!    property of this crate rather than of the cloud's client, which always
//!    sends one.
//! 5. **The guard table**, empty across both, which is the claim
//!    `verbs/mod.rs`'s table makes for every verb and measures rather than
//!    reasons.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::verbs::{
    dismiss_suggestion, restore_suggestion, DismissSuggestion, RestoreSuggestion,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";
const SECOND_ROW: &str = "70000000-0000-0000-0000-000000000002";

/// Two logins, one account, and two rows a dismissal can legitimately name.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES
               ('{OWNER}', 'harness@example.test'),
               ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', 0, 0);
             INSERT INTO transactions
                    (id, user_id, account_id, description, amount_minor, type, date) VALUES
               ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense', '2024-03-01'),
               ('{SECOND_ROW}',  '{OWNER}', '{EVERYDAY}', 'Nothing at all', 0, 'expense', '2024-03-02');"
        ))
        .expect("fixture");
    connection
}

/// A refusal about one row, under the caller's own key.
fn refusal(kind: &str, subject_key: &str, subject_ids: &[&str]) -> DismissSuggestion {
    DismissSuggestion {
        user_id: OWNER.to_owned(),
        kind: kind.to_owned(),
        subject_key: subject_key.to_owned(),
        subject_ids: subject_ids.iter().map(|id| (*id).to_owned()).collect(),
        id: None,
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
    text(
        connection,
        "SELECT COALESCE((SELECT group_concat(entry, ',') FROM (
           SELECT entity || '/' || action AS entry
             FROM financial_audit_log ORDER BY seq)), 'NONE')",
    )
}

/// The guard table, which must be empty after both verbs: neither touches a
/// table any `_rpc_guard` flag protects, and that is measured rather than
/// reasoned about.
fn guard_rows(connection: &Connection) -> i64 {
    scalar(connection, "SELECT COUNT(*) FROM _rpc_guard")
}

// ── dismiss_suggestion ──────────────────────────────────────────────────────

#[test]
fn a_first_refusal_reports_that_it_recorded_one() {
    let mut connection = fixture();
    let answer = dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "a key", &[CORNER_SHOP]),
    )
    .expect("dismiss");

    assert!(answer.recorded, "the first refusal is the one that writes");
    assert_eq!(answer.answer.subject_ids, vec![CORNER_SHOP.to_owned()]);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 1);
    assert_eq!(guard_rows(&connection), 0);
}

#[test]
fn a_repeat_refusal_reports_that_it_wrote_nothing() {
    // The assertion the differential harness cannot make: `recorded` is outside
    // the compared answer on purpose. Without it, "answered with the existing
    // row" and "deleted and re-inserted an identical one" look the same from
    // outside — and only one of those keeps `dismissed_at` meaning what the
    // migration says it means.
    let mut connection = fixture();
    let first = dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "a key", &[CORNER_SHOP]),
    )
    .expect("first");

    let second = dismiss_suggestion(
        &mut connection,
        // A DIFFERENT subject list, which an upsert would have stored.
        refusal("duplicate", "a key", &[SECOND_ROW, CORNER_SHOP]),
    )
    .expect("second");

    assert!(first.recorded);
    assert!(!second.recorded, "the second refusal must write nothing");
    assert_eq!(second.answer.id, first.answer.id);
    assert_eq!(second.answer.dismissed_at, first.answer.dismissed_at);
    assert_eq!(second.answer.subject_ids, vec![CORNER_SHOP.to_owned()]);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 1);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissal_subjects"),
        1,
        "the second call's extra subject must not have joined the first's row"
    );
}

#[test]
fn the_same_key_under_two_kinds_is_two_refusals() {
    // `suggestion_dismissals_unique_subject` carries `kind`, and the migration
    // says why: the same two rows are a transfer pair to one scan and a
    // duplicate to another, and the consequences of the two offers are opposite.
    let mut connection = fixture();
    let pair = dismiss_suggestion(
        &mut connection,
        refusal("transfer-pair", "one key", &[CORNER_SHOP]),
    )
    .expect("pair");
    let duplicate = dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "one key", &[CORNER_SHOP]),
    )
    .expect("duplicate");

    assert!(pair.recorded && duplicate.recorded);
    assert_ne!(pair.answer.id, duplicate.answer.id);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 2);
}

#[test]
fn the_subjects_are_stored_at_the_positions_they_arrived_at() {
    let mut connection = fixture();
    dismiss_suggestion(
        &mut connection,
        // Not id order: SECOND_ROW sorts after CORNER_SHOP.
        refusal("transfer-pair", "out then in", &[SECOND_ROW, CORNER_SHOP]),
    )
    .expect("dismiss");

    assert_eq!(
        text(
            &connection,
            "SELECT group_concat(transaction_id || '@' || role_order, ',') FROM (
               SELECT transaction_id, role_order FROM suggestion_dismissal_subjects
                ORDER BY role_order)"
        ),
        format!("{SECOND_ROW}@0,{CORNER_SHOP}@1")
    );
}

#[test]
fn a_payee_refusal_names_text_and_stores_no_subjects() {
    // The three kinds slice 23 widened the CHECK for. Their key is payee text
    // rather than ids, and they name no rows at all — which is what keeps the
    // prune trigger off them.
    let mut connection = fixture();
    for kind in ["payee-merchant", "payee-line", "payee-hidden"] {
        let answer = dismiss_suggestion(
            &mut connection,
            refusal(kind, &format!("payee-cleanup:payee:{kind}%20TEXT"), &[]),
        )
        .expect("payee dismissal");
        assert!(answer.recorded);
        assert!(answer.answer.subject_ids.is_empty());
    }

    // The two RECURRING verdicts (20260817220000) travel the same door with
    // the same two habits: no subject rows, and a key whose payee text no id
    // remapper can touch. recurring-confirmed is the first POSITIVE verdict
    // this table holds — the gate that lets a detected pattern feed derived
    // surfaces — and a CHECK that refused it would be the whole Confirm
    // control failing to save on a local file.
    for kind in ["recurring-confirmed", "recurring-not"] {
        let answer = dismiss_suggestion(
            &mut connection,
            refusal(
                kind,
                &format!("account:11111111-1111-4111-8111-111111111111|recurring:out:{kind}%20payee"),
                &[],
            ),
        )
        .expect("recurring verdict");
        assert!(answer.recorded);
        assert!(answer.answer.subject_ids.is_empty());
    }

    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 5);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissal_subjects"),
        0
    );
}

#[test]
fn a_subject_naming_no_transaction_takes_the_whole_write_with_it() {
    // The declared divergence, from this side: the file has a foreign key where
    // the cloud has a column comment. What matters here is that the refusal is
    // ALL-OR-NOTHING — a verb that had committed the parent and failed the child
    // would leave a refusal with no rows in it, which the read side cannot tell
    // from a legitimate payee dismissal.
    let mut connection = fixture();
    let error = dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "about a ghost", &["70000000-0000-0000-0000-0000000000ff"]),
    )
    .expect_err("a subject must name a real row");

    assert_eq!(error.code(), "constraint_violated");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 0);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissal_subjects"),
        0
    );
}

#[test]
fn a_subject_with_no_id_at_all_is_refused_by_name() {
    let mut connection = fixture();
    let error = dismiss_suggestion(&mut connection, refusal("duplicate", "a key", &[""]))
        .expect_err("an empty string is not an id");

    assert_eq!(error.code(), "transaction_not_found");
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 0);
}

#[test]
fn a_kind_the_file_does_not_admit_is_refused_by_the_file() {
    // The CHECK is the one implementation, exactly as C-5 is for categories: the
    // verb holds no second copy of the kind list, so widening the constraint is
    // the only edit widening the vocabulary takes.
    let mut connection = fixture();
    let error = dismiss_suggestion(
        &mut connection,
        refusal("something-nobody-scans-for", "a key", &[CORNER_SHOP]),
    )
    .expect_err("the CHECK judges the kind");

    assert_eq!(error.code(), "constraint_violated");
}

// ── restore_suggestion ──────────────────────────────────────────────────────

#[test]
fn undoing_a_refusal_takes_its_subjects_with_it() {
    // The cascade, watched from the child table's own side. The verb does not
    // walk these rows — `delete_goal`'s decision, not `delete_category`'s — so
    // the file has to be caught actually doing it.
    let mut connection = fixture();
    dismiss_suggestion(
        &mut connection,
        refusal("transfer-pair", "the pair", &[SECOND_ROW, CORNER_SHOP]),
    )
    .expect("dismiss");
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissal_subjects"),
        2
    );

    let answer = restore_suggestion(
        &mut connection,
        RestoreSuggestion {
            user_id: Some(OWNER.to_owned()),
            kind: "transfer-pair".to_owned(),
            subject_key: "the pair".to_owned(),
        },
    )
    .expect("restore");

    assert_eq!(answer.answer.deleted, 1);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 0);
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissal_subjects"),
        0,
        "the subjects go with the parent, by the key"
    );
    assert_eq!(guard_rows(&connection), 0);
}

#[test]
fn undoing_a_refusal_nobody_made_is_a_successful_nothing() {
    let mut connection = fixture();
    let answer = restore_suggestion(
        &mut connection,
        RestoreSuggestion {
            user_id: Some(OWNER.to_owned()),
            kind: "duplicate".to_owned(),
            subject_key: "never refused".to_owned(),
        },
    )
    .expect("a key naming nothing is not an error");

    assert_eq!(answer.answer.deleted, 0);
}

#[test]
fn with_no_owner_named_it_reaches_every_login() {
    // The arity half, which the cloud's client cannot exercise because it always
    // sends an owner. Stated rather than discovered: the option exists so that
    // every owner-scoped verb in this crate spells the argument the same way,
    // and what it REACHES when absent is this crate's property to assert.
    let mut connection = fixture();
    dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "a shared key", &[CORNER_SHOP]),
    )
    .expect("mine");
    connection
        .execute(
            "INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key)
                  VALUES ('d0000000-0000-0000-0000-0000000000ff', ?1, 'duplicate', 'a shared key')",
            [STRANGER],
        )
        .expect("theirs");

    let answer = restore_suggestion(
        &mut connection,
        RestoreSuggestion {
            user_id: None,
            kind: "duplicate".to_owned(),
            subject_key: "a shared key".to_owned(),
        },
    )
    .expect("restore");

    assert_eq!(answer.answer.deleted, 2);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 0);
}

#[test]
fn naming_an_owner_reaches_only_theirs() {
    let mut connection = fixture();
    dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "a shared key", &[CORNER_SHOP]),
    )
    .expect("mine");
    connection
        .execute(
            "INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key)
                  VALUES ('d0000000-0000-0000-0000-0000000000ff', ?1, 'duplicate', 'a shared key')",
            [STRANGER],
        )
        .expect("theirs");

    let answer = restore_suggestion(
        &mut connection,
        RestoreSuggestion {
            user_id: Some(STRANGER.to_owned()),
            kind: "duplicate".to_owned(),
            subject_key: "a shared key".to_owned(),
        },
    )
    .expect("restore");

    assert_eq!(answer.answer.deleted, 1);
    assert_eq!(
        text(&connection, "SELECT user_id FROM suggestion_dismissals"),
        OWNER
    );
}

#[test]
fn a_dismissal_is_created_or_deleted_and_never_edited() {
    // `trg_dismissals_no_update` is the local half of the cloud having no UPDATE
    // policy, and it is what makes "restore" a delete rather than a flag. Asserted
    // because a schema trigger nobody tests is a schema trigger somebody removes.
    let mut connection = fixture();
    let stored = dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "a key", &[CORNER_SHOP]),
    )
    .expect("dismiss");

    let error = connection
        .execute(
            "UPDATE suggestion_dismissals SET subject_key = 'edited' WHERE id = ?1",
            [&stored.answer.id],
        )
        .expect_err("a dismissal is never edited");

    assert!(
        error.to_string().contains("dismissal_immutable"),
        "expected the trigger's own words, got {error}"
    );
}

// ── Neither writes to the money trail ───────────────────────────────────────

#[test]
fn neither_verb_writes_a_line_in_the_money_trail() {
    // The claim about an absence. Both engines agree here — the cloud argues it
    // on the merits at 20260806180000:73-79, and divergence 10's reasoning
    // (money in four columns) has nothing to reach in a table with no figure in
    // it — so the differential spec can only compare zero with zero. This is the
    // assertion that would fail if a later slice decided a dismissal was worth
    // a line after all without anybody arguing it.
    let mut connection = fixture();
    dismiss_suggestion(
        &mut connection,
        refusal("duplicate", "a key", &[CORNER_SHOP]),
    )
    .expect("dismiss");
    restore_suggestion(
        &mut connection,
        RestoreSuggestion {
            user_id: Some(OWNER.to_owned()),
            kind: "duplicate".to_owned(),
            subject_key: "a key".to_owned(),
        },
    )
    .expect("restore");

    assert_eq!(trail(&connection), "NONE");
    assert_eq!(guard_rows(&connection), 0);
}

// ── The prune the schema owns, exercised through the verbs ──────────────────

#[test]
fn deleting_the_row_a_refusal_names_takes_the_refusal_with_it() {
    // Slice 19 fixed this trigger from AFTER DELETE to BEFORE DELETE — as an
    // AFTER trigger it had never once fired, because the child rows had already
    // gone with the transaction's own cascade and the subquery matched nothing.
    // `specs/r13` pins the trigger from the schema's side; this pins it from the
    // side a person reaches it from, which is a dismissal written by the verb
    // rather than planted by a fixture.
    let mut connection = fixture();
    dismiss_suggestion(
        &mut connection,
        refusal("transfer-pair", "the pair", &[SECOND_ROW, CORNER_SHOP]),
    )
    .expect("dismiss");

    connection
        .execute("DELETE FROM transactions WHERE id = ?1", [CORNER_SHOP])
        .expect("delete the row it named");

    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"),
        0,
        "a refusal about a row that no longer exists can never be offered again"
    );
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissal_subjects"),
        0
    );
}

#[test]
fn a_payee_refusal_survives_the_row_it_never_named() {
    // The other half of the same trigger, and the reason the payee kinds store no
    // subjects: delete every transaction carrying the wording, re-import the
    // statement, and the same wording arrives on brand new ids. A refusal that
    // expired with the rows would put the payee the user struck off straight back
    // on the screen.
    let mut connection = fixture();
    dismiss_suggestion(
        &mut connection,
        refusal("payee-hidden", "payee-cleanup:payee:DIRECT%20DEBIT", &[]),
    )
    .expect("dismiss");

    connection
        .execute("DELETE FROM transactions WHERE id = ?1", [CORNER_SHOP])
        .expect("delete");

    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM suggestion_dismissals"), 1);
}
