//! Integration tests for the preferences pair — `read_preferences` and
//! `write_preferences` — against the real vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`, where the
//! same payload runs against `supabasePreferencesTransport`'s own `.select()`
//! and `.upsert()` transcribed into SQL. What is here is the half with **no
//! Postgres counterpart to compare against**:
//!
//! 1. **The round trip through a file that is CLOSED and reopened.** The
//!    differential harness holds one connection for the length of a spec, so it
//!    cannot tell a document that was committed from one that was merely
//!    visible. Every test below writes through one connection and reads through
//!    a second one opened on the same path.
//! 2. **The document is opaque**, which is a claim about the crate reading
//!    nothing rather than about a stored value. A document with keys this
//!    program has never heard of comes back with all of them, in order, and a
//!    spec comparing two engines could not tell that from both engines
//!    understanding the keys.
//! 3. **`created_at` surviving a replace**, which is what makes the write an
//!    upsert rather than a delete-and-insert. Both engines do it, so a
//!    differential spec compares one truth against the same truth and would go
//!    on passing if both started re-minting the row.
//! 4. **Two owners in one file.** A restored backup can leave a file holding a
//!    second login's rows (`localDataPort.ts`'s D-5 note), and there is no RLS
//!    to narrow an answer afterwards — so the isolation is the verb's `WHERE`
//!    and nothing else. Asserted here from both directions.
//! 5. **The guard table**, empty across a write, which is the claim
//!    `verbs/mod.rs`'s table makes for every verb and measures rather than
//!    reasons.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use serde_json::{json, Value};
use tempfile::TempDir;
use wealth_core::db;
use wealth_core::error::CoreError;
use wealth_core::verbs::{read_preferences, write_preferences, ReadPreferences, WritePreferences};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";

/// A ledger on disk with two logins in it, so that "whose settings" is a real
/// question rather than one the fixture answers by having only one candidate.
fn ledger() -> (TempDir, std::path::PathBuf) {
    let directory = TempDir::new().expect("temp dir");
    let path = directory.path().join("preferences.db");

    let connection = Connection::open(&path).expect("create");
    db::configure(&connection).expect("configure");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES
               ('{OWNER}', 'device@localhost'),
               ('{STRANGER}', 'stranger@example.test');"
        ))
        .expect("fixture");
    drop(connection);

    (directory, path)
}

/// A SECOND connection to the same file — the whole point of these tests.
fn reopen(path: &std::path::Path) -> Connection {
    db::open(path).expect("reopen")
}

fn write(connection: &mut Connection, owner: &str, document: Value) -> Option<Value> {
    write_preferences(
        connection,
        WritePreferences {
            user_id: Some(owner.to_owned()),
            preferences: document,
        },
    )
    .expect("write")
    .answer
    .preferences
}

fn read(connection: &Connection, owner: &str) -> Option<Value> {
    read_preferences(
        connection,
        ReadPreferences {
            user_id: Some(owner.to_owned()),
        },
    )
    .expect("read")
    .answer
    .preferences
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

#[test]
fn a_document_written_is_there_after_the_file_is_closed_and_opened_again() {
    // THE ROUND TRIP, across two connections. A preferences document that only
    // survives while the window is open is the failure the whole tier exists to
    // end: settings that do not travel, said again in a smaller way.
    let (_directory, path) = ledger();
    let document = json!({
        "version": 1,
        "values": {
            "money_management_theme": "dark",
            "dashboardKeyAccounts": "[\"a0000000-0000-0000-0000-000000000001\"]"
        }
    });

    let mut first = reopen(&path);
    let answered = write(&mut first, OWNER, document.clone());
    drop(first);

    let second = reopen(&path);
    assert_eq!(answered, Some(document.clone()));
    assert_eq!(read(&second, OWNER), Some(document));
}

#[test]
fn a_file_that_holds_none_says_null_rather_than_an_empty_document() {
    // `null` and `{}` are different answers, and `PreferencesService.attach`
    // branches on exactly that difference: a null document is what makes the
    // one-time LIFT happen, so a file answering `{}` here would tell a person's
    // first launch that they had deliberately turned everything off.
    let (_directory, path) = ledger();

    assert_eq!(read(&reopen(&path), OWNER), None);
}

#[test]
fn an_empty_document_is_stored_and_is_not_the_same_as_none() {
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    write(&mut connection, OWNER, json!({ "version": 1, "values": {} }));

    assert_eq!(
        read(&reopen(&path), OWNER),
        Some(json!({ "version": 1, "values": {} }))
    );
}

#[test]
fn the_crate_reads_nothing_inside_the_document() {
    // Opacity, proved rather than asserted in prose: a document whose every key
    // is unknown to this program — and whose shape is not a preferences document
    // at all — comes back exactly as it went in, nesting and all.
    let (_directory, path) = ledger();
    let odd = json!({
        "version": 97,
        "values": { "somethingNobodyHasWrittenYet": "true" },
        "aKeyTheDocumentTypeDoesNotHave": { "nested": [1, 2, { "deep": null }] }
    });

    let mut connection = reopen(&path);
    write(&mut connection, OWNER, odd.clone());

    assert_eq!(read(&reopen(&path), OWNER), Some(odd));
}

#[test]
fn a_second_write_replaces_the_document_rather_than_merging_it() {
    // REPLACES, which is the service's own rule: the document is read as a set
    // and a key the caller left out is a key the person removed. A merge would
    // resurrect it on every write, on whichever machine still remembered it.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    write(
        &mut connection,
        OWNER,
        json!({ "version": 1, "values": { "a": "1", "b": "2" } }),
    );
    write(
        &mut connection,
        OWNER,
        json!({ "version": 1, "values": { "a": "9" } }),
    );

    assert_eq!(
        read(&reopen(&path), OWNER),
        Some(json!({ "version": 1, "values": { "a": "9" } }))
    );
}

#[test]
fn a_replace_keeps_one_row_and_the_day_it_was_first_written() {
    // What makes it an UPSERT and not a delete-and-insert. `created_at` is the
    // day this ledger first remembered anything about how to look at it, and a
    // write that re-minted the row would quietly reset it every time somebody
    // dragged a column.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    write(&mut connection, OWNER, json!({ "values": { "a": "1" } }));
    let first: String = connection
        .query_row("SELECT created_at FROM user_preferences", [], |row| {
            row.get(0)
        })
        .expect("created_at");

    write(&mut connection, OWNER, json!({ "values": { "a": "2" } }));

    let after = reopen(&path);
    assert_eq!(scalar(&after, "SELECT COUNT(*) FROM user_preferences"), 1);
    let (created, updated): (String, String) = after
        .query_row(
            "SELECT created_at, updated_at FROM user_preferences",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("stamps");
    assert_eq!(created, first);
    assert!(updated >= created, "{updated} < {created}");
}

#[test]
fn one_login_cannot_see_or_overwrite_the_other_s_settings() {
    // A local file can hold more than one login's rows and there is no RLS to
    // narrow an answer afterwards, so the isolation is the verb's WHERE clause
    // and nothing else. Both directions, because a filter applied to the read
    // and forgotten on the write is the shape this goes wrong in.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    write(&mut connection, OWNER, json!({ "values": { "who": "mine" } }));
    write(
        &mut connection,
        STRANGER,
        json!({ "values": { "who": "theirs" } }),
    );

    let after = reopen(&path);
    assert_eq!(
        read(&after, OWNER),
        Some(json!({ "values": { "who": "mine" } }))
    );
    assert_eq!(
        read(&after, STRANGER),
        Some(json!({ "values": { "who": "theirs" } }))
    );
    assert_eq!(scalar(&after, "SELECT COUNT(*) FROM user_preferences"), 2);
}

#[test]
fn an_owner_this_file_has_never_heard_of_is_stopped_by_the_foreign_key() {
    // The cloud's row is scoped the same way and its RLS refuses first; here the
    // key is the only thing standing between a document and an owner that does
    // not exist. It is a REFUSAL rather than a fault — the file enforcing a rule
    // — so a caller is told rather than shown a stack trace.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    let error = write_preferences(
        &mut connection,
        WritePreferences {
            user_id: Some("99999999-9999-9999-9999-999999999999".to_owned()),
            preferences: json!({ "values": {} }),
        },
    )
    .expect_err("an owner the file does not hold must be refused");

    assert!(
        matches!(&error, CoreError::Refused(refusal) if refusal.code() == "constraint_violated"),
        "{error}"
    );
    assert_eq!(
        scalar(&reopen(&path), "SELECT COUNT(*) FROM user_preferences"),
        0
    );
}

#[test]
fn a_caller_who_did_not_say_whose_settings_is_refused_by_name() {
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    let read_error = read_preferences(&connection, ReadPreferences { user_id: None })
        .expect_err("a read with no owner");
    let write_error = write_preferences(
        &mut connection,
        WritePreferences {
            user_id: None,
            preferences: json!({}),
        },
    )
    .expect_err("a write with no owner");

    for error in [read_error, write_error] {
        assert!(
            matches!(&error, CoreError::Refused(refusal) if refusal.code() == "owner_unknown"),
            "{error}"
        );
    }
}

#[test]
fn a_document_that_is_not_an_object_is_refused_by_the_file() {
    // The same rule the cloud states as `jsonb_typeof(prefs) = 'object'`. Every
    // reader indexes into this by key, so an array here would be a document
    // nothing can read stored in a column nothing would complain about.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    let error = write_preferences(
        &mut connection,
        WritePreferences {
            user_id: Some(OWNER.to_owned()),
            preferences: json!([1, 2, 3]),
        },
    )
    .expect_err("an array is not a preferences document");

    assert!(
        matches!(&error, CoreError::Refused(refusal) if refusal.code() == "constraint_violated"),
        "{error}"
    );
    assert_eq!(read(&reopen(&path), OWNER), None);
}

#[test]
fn a_document_bigger_than_the_ceiling_is_refused_and_the_previous_one_survives() {
    // 256 KiB, the same number over the same measurement as the cloud's. The
    // point of the ceiling is that this table must not become a second,
    // unindexed copy of the ledger — and the point of THIS test is the second
    // half: a refused write leaves the settings that were already there.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);
    write(&mut connection, OWNER, json!({ "values": { "a": "1" } }));

    let error = write_preferences(
        &mut connection,
        WritePreferences {
            user_id: Some(OWNER.to_owned()),
            preferences: json!({ "values": { "huge": "x".repeat(300_000) } }),
        },
    )
    .expect_err("a document over the ceiling");

    assert!(
        matches!(&error, CoreError::Refused(refusal) if refusal.code() == "constraint_violated"),
        "{error}"
    );
    assert_eq!(
        read(&reopen(&path), OWNER),
        Some(json!({ "values": { "a": "1" } }))
    );
}

#[test]
fn a_write_leaves_no_audit_entry_and_no_guard_row() {
    // Two claims about nothing being there, which is why they are here rather
    // than in a differential spec that could only compare zero against zero.
    //
    // The audit: divergence 10 turns on money living in four columns, and a
    // preference holds no figure — the dismissal pair's argument, applied again.
    // The guard: `user_preferences` has no triggers at all.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);

    write(&mut connection, OWNER, json!({ "values": { "a": "1" } }));
    write(&mut connection, OWNER, json!({ "values": { "a": "2" } }));

    let after = reopen(&path);
    assert_eq!(
        scalar(&after, "SELECT COUNT(*) FROM financial_audit_log"),
        0
    );
    assert_eq!(scalar(&after, "SELECT COUNT(*) FROM _rpc_guard"), 0);
}

#[test]
fn deleting_the_owner_takes_their_settings_with_them() {
    // The one thing that really does remove the row, and the reason there is no
    // `clear_preferences` verb. Stated as a test because the cascade is the
    // schema's rather than a verb's, and a schema that lost it would leave a
    // document behind with nobody to own it.
    let (_directory, path) = ledger();
    let mut connection = reopen(&path);
    write(&mut connection, OWNER, json!({ "values": { "a": "1" } }));

    connection
        .execute("DELETE FROM users WHERE id = ?1", [OWNER])
        .expect("delete the login");

    assert_eq!(
        scalar(&reopen(&path), "SELECT COUNT(*) FROM user_preferences"),
        0
    );
}
