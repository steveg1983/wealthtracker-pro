//! Integration tests for the reconciliation and archive family — the five verbs
//! that read and write Money's C and R — against the real vendored schema.
//!
//! The differential proof for all five lives in `scripts/local-sqlite/verbs.mjs`,
//! where the same payload runs against the live RPCs. What is here is the half
//! with **no Postgres counterpart to compare against**:
//!
//! 1. **The three-valued column, from the Rust side.** `is_reconciled` is
//!    `Option<bool>` in [`wealth_core::row::TransactionRow`], and the difference
//!    between `None` and `Some(false)` is what `finalize_reconciliation`
//!    selects on and what `archive_transactions_before` COALESCEs. A
//!    differential spec compares two rendered strings; this compares the type.
//! 2. **The guard table**, empty across all five, which is the claim
//!    `verbs/mod.rs`'s table makes and measures rather than reasons about. The
//!    marking verb is the interesting one: it WRITES the column the archive
//!    sweep watches, so the trigger is consulted on every call and stands down
//!    every time.
//! 3. **The audit chain**, which is per-file and has no cross-engine twin: the
//!    two verbs that audit write one entry per row they really change, and the
//!    two bulk archive verbs write none at all — a claim about nothing being
//!    there, which only a test can hold.
//! 4. **The CHECK that committed implies marked**, reached through the file
//!    rather than through a verb. Its differential spec goes through
//!    `update_transaction` and declares the divergence; this is the same rule
//!    asserted where it lives.
//! 5. **The owner-less arity.** `finalize_reconciliation` is the one verb in the
//!    crate where an absent owner is a refusal rather than a stand-down, and
//!    what an absent owner REACHES is a property of this crate.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::money::Money;
use wealth_core::verbs::{
    archive_transactions_before, finalize_reconciliation, set_transactions_archived,
    set_transactions_cleared, unarchive_account, ArchiveTransactionsBefore,
    FinalizeReconciliation, SetTransactionsArchived, SetTransactionsCleared, UnarchiveAccount,
};
use wealth_core::wire::Flag;

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const THEIRS: &str = "a0000000-0000-0000-0000-000000000009";
const MARKED: &str = "70000000-0000-0000-0000-0000000000c1";
const COMMITTED: &str = "70000000-0000-0000-0000-0000000000c2";
const PRE_SPLIT: &str = "70000000-0000-0000-0000-0000000000c3";
const UNMARKED: &str = "70000000-0000-0000-0000-0000000000c4";

/// Two logins, two accounts, and one row per state of the committed flag.
///
/// The pre-split row is planted as an explicit NULL: the column carries
/// `DEFAULT 0`, so leaving it out would produce "explicitly not committed",
/// which is the right answer for a new row and the wrong state for this test.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES
               ('{OWNER}', 'harness@example.test'),
               ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}',    'Everyday',  'checking', -400, 0),
                      ('{THEIRS}',   '{STRANGER}', 'Not yours', 'checking',    0, 0);
             INSERT INTO transactions
                    (id, user_id, account_id, description, amount_minor, type, date,
                     is_cleared, is_reconciled) VALUES
               ('{MARKED}',    '{OWNER}', '{EVERYDAY}', 'Ticked',   -100, 'expense', '2024-01-15', 1, 0),
               ('{COMMITTED}', '{OWNER}', '{EVERYDAY}', 'Settled',  -100, 'expense', '2024-01-16', 1, 1),
               ('{PRE_SPLIT}', '{OWNER}', '{EVERYDAY}', 'Historic', -100, 'expense', '2024-01-17', 1, NULL),
               ('{UNMARKED}',  '{OWNER}', '{EVERYDAY}', 'Pending',  -100, 'expense', '2024-03-01', 0, 0);"
        ))
        .expect("fixture");
    connection
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

fn text(connection: &Connection, sql: &str) -> String {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

/// The committed flag as the FILE holds it, three-valued.
fn committed(connection: &Connection, id: &str) -> Option<bool> {
    connection
        .query_row(
            "SELECT is_reconciled FROM transactions WHERE id = ?1",
            [id],
            |row| row.get::<_, Option<i64>>(0),
        )
        .expect("read")
        .map(|value| value != 0)
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

/// The guard table, which must be empty after every verb in this family.
fn guard_rows(connection: &Connection) -> i64 {
    scalar(connection, "SELECT COUNT(*) FROM _rpc_guard")
}

/// B-1 for the Everyday account, in minor units. Every test asserts it: none of
/// these five verbs may move a penny, including the ones that refuse.
fn balance_drift(connection: &Connection) -> i64 {
    scalar(
        connection,
        &format!(
            "SELECT a.balance_minor - (a.initial_balance_minor
                    + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                                 WHERE t.account_id = a.id), 0))
               FROM accounts a WHERE a.id = '{EVERYDAY}'"
        ),
    )
}

fn marking(ids: &[&str], cleared: bool) -> SetTransactionsCleared {
    SetTransactionsCleared {
        ids: Some(ids.iter().map(|id| (*id).to_owned()).collect()),
        cleared: Flag::Bool(cleared),
        user_id: Some(OWNER.to_owned()),
    }
}

fn finalize(ending_balance: Option<&str>, day: Option<&str>) -> FinalizeReconciliation {
    FinalizeReconciliation {
        user_id: Some(OWNER.to_owned()),
        account_id: EVERYDAY.to_owned(),
        ending_balance: ending_balance.map(|value| Money::parse(value).expect("a figure")),
        reconciled_on: day.map(ToOwned::to_owned),
    }
}

// ── set_transactions_cleared ────────────────────────────────────────────────

#[test]
fn marking_writes_an_explicit_answer_over_a_pre_split_null() {
    // The COALESCE's whole purpose: the row's commitment was "ask is_cleared",
    // and the tick it was being asked about is the one changing.
    let mut connection = fixture();
    assert_eq!(committed(&connection, PRE_SPLIT), None);

    let answer = set_transactions_cleared(&mut connection, marking(&[PRE_SPLIT], false))
        .expect("unmark");

    assert_eq!(answer.changed, 1);
    assert_eq!(committed(&connection, PRE_SPLIT), Some(false));
    assert_eq!(guard_rows(&connection), 0);
    assert_eq!(balance_drift(&connection), 0);
}

#[test]
fn unmarking_a_committed_row_clears_both_flags_in_one_statement() {
    // If it did not, `transactions_reconciled_implies_cleared` would refuse the
    // write — which is exactly what the next test proves the file does.
    let mut connection = fixture();

    set_transactions_cleared(&mut connection, marking(&[COMMITTED], false)).expect("unmark");

    assert_eq!(committed(&connection, COMMITTED), Some(false));
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT is_cleared FROM transactions WHERE id = '{COMMITTED}'")
        ),
        0
    );
    assert_eq!(trail(&connection), "transaction/update");
    assert_eq!(balance_drift(&connection), 0);
}

#[test]
fn the_file_refuses_a_row_that_is_committed_but_not_marked() {
    // The CHECK, reached directly. Its differential spec goes through
    // `update_transaction`, where the cloud accepts the same write; this is the
    // rule asserted where it lives, so a schema that lost it fails here even if
    // no verb path reached it.
    let connection = fixture();
    let refused = connection.execute(
        &format!("UPDATE transactions SET is_cleared = 0 WHERE id = '{COMMITTED}'"),
        [],
    );
    let message = refused.expect_err("committed implies marked").to_string();
    assert!(
        message.contains("transactions_reconciled_implies_cleared"),
        "{message}"
    );
}

#[test]
fn a_tick_never_reaches_the_sweep_even_with_a_cutoff_in_place() {
    // The sweep is `AFTER UPDATE OF is_reconciled` and this verb writes that
    // column on every row it touches, so the trigger IS consulted here — and
    // stands down, because marking never writes a 1. A row you cannot see is a
    // row you cannot untick.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "UPDATE accounts SET archive_through_date = '2024-06-30' WHERE id = '{EVERYDAY}';"
        ))
        .expect("cutoff");

    set_transactions_cleared(&mut connection, marking(&[UNMARKED], true)).expect("mark");

    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT archived FROM transactions WHERE id = '{UNMARKED}'")
        ),
        0
    );
    assert_eq!(guard_rows(&connection), 0);
}

// ── finalize_reconciliation ─────────────────────────────────────────────────

#[test]
fn finalizing_commits_the_working_set_and_leaves_history_unanswered() {
    let mut connection = fixture();

    let answer = finalize_reconciliation(&mut connection, finalize(Some("-4.00"), Some("2024-03-31")))
        .expect("finalize");

    assert_eq!(answer.answer.reconciled, 1);
    assert_eq!(committed(&connection, MARKED), Some(true));
    assert_eq!(committed(&connection, COMMITTED), Some(true));
    // The one that matters: a NULL row is history the old world already called
    // reconciled, and sweeping it in would re-audit the whole account.
    assert_eq!(committed(&connection, PRE_SPLIT), None);
    assert_eq!(committed(&connection, UNMARKED), Some(false));
    assert_eq!(trail(&connection), "transaction/update,account/update");
    assert_eq!(guard_rows(&connection), 0);
    assert_eq!(balance_drift(&connection), 0);
}

#[test]
fn the_recorded_figure_is_a_record_and_never_the_balance() {
    let mut connection = fixture();

    finalize_reconciliation(&mut connection, finalize(Some("999.99"), Some("2024-03-31")))
        .expect("finalize");

    // A figure nothing in the ledger agrees with, recorded exactly as given —
    // and the balance untouched beside it. The difference between the two is
    // what the reconciliation screen exists to show.
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT last_reconciled_balance_minor FROM accounts WHERE id = '{EVERYDAY}'")
        ),
        99_999
    );
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT balance_minor FROM accounts WHERE id = '{EVERYDAY}'")
        ),
        -400
    );
    assert_eq!(balance_drift(&connection), 0);
}

#[test]
fn an_absent_day_is_the_day_the_call_is_stamped_with() {
    // `COALESCE(p_reconciled_on, CURRENT_DATE)`, taken from the instant this
    // call stamps everything else with — so a finalize running across midnight
    // cannot record one day on the account and another on the rows.
    let mut connection = fixture();

    let answer =
        finalize_reconciliation(&mut connection, finalize(Some("0"), None)).expect("finalize");

    let stamped = text(
        &connection,
        &format!("SELECT last_reconciled_date FROM accounts WHERE id = '{EVERYDAY}'"),
    );
    assert_eq!(stamped, answer.answer.reconciled_on);
    assert_eq!(stamped.len(), 10, "a calendar day, not an instant: {stamped}");
    let row_day = text(
        &connection,
        &format!("SELECT substr(updated_at, 1, 10) FROM transactions WHERE id = '{MARKED}'"),
    );
    assert_eq!(row_day, stamped);
}

#[test]
fn an_absent_owner_finds_no_account_to_finish() {
    // The one verb in the crate where `user_id: None` is a refusal rather than a
    // stand-down. See its module documentation.
    let mut connection = fixture();
    let mut command = finalize(Some("0"), Some("2024-03-31"));
    command.user_id = None;

    let error = finalize_reconciliation(&mut connection, command).expect_err("no owner");

    assert_eq!(error.code(), "account_not_found_or_not_owned");
    assert_eq!(trail(&connection), "NONE");
    assert_eq!(committed(&connection, MARKED), Some(false));
}

#[test]
fn a_finalize_with_no_figure_is_refused_before_anything_is_read() {
    let mut connection = fixture();

    let error = finalize_reconciliation(&mut connection, finalize(None, Some("2024-03-31")))
        .expect_err("no figure");

    assert_eq!(error.code(), "ending_balance_required");
    assert_eq!(committed(&connection, MARKED), Some(false));
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn a_cutoff_that_is_not_a_calendar_day_is_refused() {
    // 31 February passes `LIKE '____-__-__'` and is not a day. Postgres refuses
    // it in the cast before the function body runs; this refuses it in the verb.
    let mut connection = fixture();

    let error = finalize_reconciliation(
        &mut connection,
        finalize(Some("0"), Some("2024-02-31")),
    )
    .expect_err("not a day");

    assert_eq!(error.code(), "date_invalid");
    assert_eq!(trail(&connection), "NONE");
}

// ── set_transactions_archived ───────────────────────────────────────────────

#[test]
fn archiving_one_row_writes_one_audit_entry_and_no_money() {
    let mut connection = fixture();

    let answer = set_transactions_archived(
        &mut connection,
        SetTransactionsArchived {
            ids: Some(vec![MARKED.to_owned()]),
            archived: Some(Flag::Bool(true)),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("archive");

    assert_eq!(answer.changed, 1);
    assert_eq!(trail(&connection), "transaction/update");
    assert_eq!(balance_drift(&connection), 0);
    assert_eq!(guard_rows(&connection), 0);
}

#[test]
fn one_unknown_id_loses_the_whole_batch() {
    let mut connection = fixture();

    let error = set_transactions_archived(
        &mut connection,
        SetTransactionsArchived {
            ids: Some(vec![MARKED.to_owned(), "70000000-0000-0000-0000-0000000000ff".to_owned()]),
            archived: Some(Flag::Bool(true)),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect_err("one bad id");

    assert_eq!(error.code(), "transaction_not_found");
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT archived FROM transactions WHERE id = '{MARKED}'")
        ),
        0,
        "the good id in the same call must not have been written"
    );
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn an_empty_list_is_answered_before_the_direction_is_even_checked() {
    // The RPC's order: `IF p_ids IS NULL … RETURN 0` comes FIRST, so an empty
    // call with no direction is a nothing rather than a refusal.
    let mut connection = fixture();

    let answer = set_transactions_archived(
        &mut connection,
        SetTransactionsArchived {
            ids: Some(Vec::new()),
            archived: None,
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("an empty list is not a refusal");

    assert_eq!(answer.changed, 0);
    assert_eq!(trail(&connection), "NONE");
}

// ── archive_transactions_before / unarchive_account ─────────────────────────

#[test]
fn the_bulk_archive_writes_no_audit_entry_at_all() {
    // A claim about nothing being there, which only a test can hold: the cloud
    // function contains no write_financial_audit call and neither does the port.
    // A differential spec can only ever compare zero against zero here, and
    // would go on passing if BOTH sides started writing entries.
    let mut connection = fixture();

    let answer = archive_transactions_before(
        &mut connection,
        ArchiveTransactionsBefore {
            user_id: Some(OWNER.to_owned()),
            account_id: EVERYDAY.to_owned(),
            cutoff: "2024-02-28".to_owned(),
        },
    )
    .expect("archive");

    assert_eq!(answer.answer.archived, 2, "the committed one and the pre-split one");
    assert_eq!(trail(&connection), "NONE");
    assert_eq!(balance_drift(&connection), 0);
    assert_eq!(guard_rows(&connection), 0);

    let brought_back = unarchive_account(
        &mut connection,
        UnarchiveAccount {
            user_id: Some(OWNER.to_owned()),
            account_id: EVERYDAY.to_owned(),
        },
    )
    .expect("unarchive");

    assert_eq!(brought_back.answer.unarchived, 2);
    assert_eq!(trail(&connection), "NONE");
    // The commitment is untouched in both directions.
    assert_eq!(committed(&connection, COMMITTED), Some(true));
    assert_eq!(committed(&connection, PRE_SPLIT), None);
    assert_eq!(balance_drift(&connection), 0);
}

#[test]
fn unarchiving_an_account_that_is_not_yours_writes_nothing_and_refuses_nothing() {
    let mut connection = fixture();

    let answer = unarchive_account(
        &mut connection,
        UnarchiveAccount {
            user_id: Some(OWNER.to_owned()),
            account_id: THEIRS.to_owned(),
        },
    )
    .expect("no refusal, by design");

    assert_eq!(answer.answer.unarchived, 0);
    assert!(answer.account.is_none(), "it is not this owner's account to report");
    assert_eq!(trail(&connection), "NONE");
}
