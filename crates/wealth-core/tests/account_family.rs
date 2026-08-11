//! Integration tests for `create_account`, `update_account` and
//! `close_account`, against the real vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`: the same
//! payload run against this crate and against the TypeScript writer's own
//! INSERT/UPDATE, transcribed into SQL. What is here is the half with **no
//! Postgres counterpart**:
//!
//! 1. **B-1 across every account verb.** The cloud has no `verify_integrity` and
//!    no ledger identity to keep, so "the balance still equals the opening
//!    balance plus the rows" is not a comparison — it is a property of this
//!    engine, and it is checked after each of the three.
//! 2. **C-3 through the verb**, and R-6's collision with a restore. The trigger
//!    is proved on both engines by the constraint harness; what cannot be proved
//!    there is that the create verb inherits it, that the `NOT EXISTS` guard
//!    really fires when a restore brings its own To/From rows, and that
//!    `verify_integrity` names either failure.
//! 3. **The audit trail.** The cloud writes none for these three, because there
//!    is no function to write one from, so the entries have nothing to be
//!    compared against and everything to be asserted.
//! 4. **The guard table**, empty across all three, which is the claim
//!    `verbs/mod.rs`'s table makes for every verb and measures rather than
//!    reasons.
//!
//! All data is invented. This repo is public.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use serde_json::json;
use wealth_core::db;
use wealth_core::money::Money;
use wealth_core::verbs::{
    close_account, create_account, restore_user_chunk, update_account, verify_integrity,
    AccountPatch, Chunk, CloseAccount, CreateAccount, RestoreUserChunk, UpdateAccount,
    VerifyIntegrity,
};
use wealth_core::wire::Field;

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";
const NEW_ACCOUNT: &str = "a0000000-0000-0000-0000-0000000000a1";

/// One login, the Transfer anchor C-3 needs, one account at −25.00 with the one
/// −25.00 row that justifies it, and that account's To/From category (minted by
/// the trigger, because the anchor was written first).
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO users (id, email) VALUES ('{STRANGER}', 'stranger@example.test');
             INSERT INTO categories (id, user_id, name, type, level)
               VALUES ('{TRANSFER_ROOT}', '{OWNER}', 'Transfer', 'both', 'type');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
               VALUES ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense',
                       '2024-03-01');"
        ))
        .expect("fixture");
    connection
}

/// A create with only the fields a test cares about; everything else absent, so
/// the verb's own defaults answer.
fn draft(name: &str) -> CreateAccount {
    CreateAccount {
        id: Some(NEW_ACCOUNT.to_owned()),
        user_id: OWNER.to_owned(),
        name: name.to_owned(),
        kind: None,
        currency: None,
        initial_balance: None,
        is_active: None,
        institution: None,
        sort_code: None,
        account_number: None,
        opening_balance_date: None,
        notes: None,
        low_balance_alert_enabled: None,
        low_balance_threshold: None,
    }
}

fn patch_of(patch: AccountPatch) -> UpdateAccount {
    UpdateAccount {
        id: EVERYDAY.to_owned(),
        user_id: Some(OWNER.to_owned()),
        patch,
    }
}

/// Every finding `v_integrity_violations` can see, as `check:subject` lines.
fn violations(connection: &Connection) -> Vec<String> {
    verify_integrity(connection, VerifyIntegrity {})
        .expect("verify")
        .answer
        .findings
        .iter()
        .map(|finding| format!("{}:{}", finding.check, finding.id))
        .collect()
}

fn transfer_categories_for(connection: &Connection, account: &str) -> Vec<(String, i64)> {
    let mut statement = connection
        .prepare(
            "SELECT name, is_active FROM categories
              WHERE account_id = ?1 AND is_transfer_category = 1
              ORDER BY name",
        )
        .expect("prepare");
    let rows = statement
        .query_map([account], |row| Ok((row.get(0)?, row.get(1)?)))
        .expect("query");
    rows.map(|row| row.expect("row")).collect()
}

fn guard_rows(connection: &Connection) -> i64 {
    connection
        .query_row("SELECT COUNT(*) FROM _rpc_guard", [], |row| row.get(0))
        .expect("guard")
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

// ── create ──────────────────────────────────────────────────────────────────

#[test]
fn a_new_account_opens_at_its_opening_balance_and_the_identity_holds() {
    // The whole of the one-figure decision, asserted rather than argued. There
    // is no `balance` argument, so `balance` can only be the opening balance,
    // and B-1 is therefore true from the first instant of the account's life.
    let mut connection = fixture();

    let created = create_account(
        &mut connection,
        CreateAccount {
            initial_balance: Some(Money::parse("250.50").expect("a decimal")),
            ..draft("Rainy day")
        },
    )
    .expect("create");

    assert_eq!(created.answer.balance.to_decimal_string(), "250.50");
    assert_eq!(created.answer.initial_balance.to_decimal_string(), "250.50");
    assert_eq!(balances(&connection, NEW_ACCOUNT), (25_050, 25_050));
    assert!(violations(&connection).is_empty());
}

#[test]
fn c3_a_created_account_has_exactly_one_to_from_category_named_after_it() {
    // C-3, through the VERB. The trigger is proved on both engines by
    // specs/c3-account-insert-creates-its-transfer-category; this is the claim
    // that the create verb inherits it rather than needing its own copy — which
    // is the whole reason the minting is not in the verb.
    let mut connection = fixture();

    create_account(&mut connection, draft("Rainy day")).expect("create");

    assert_eq!(
        transfer_categories_for(&connection, NEW_ACCOUNT),
        vec![("To/From Rainy day".to_owned(), 1)]
    );
    // And the two checks that would report its absence or its duplication see
    // nothing, on the new account and on the fixture's.
    assert!(violations(&connection).is_empty());
}

#[test]
fn c3_stands_down_when_the_file_has_no_transfer_anchor_yet() {
    // The cloud's own behaviour, verbatim: "categories seed lazily; a parentless
    // category renders as junk". It matters far beyond a brand-new file, because
    // it is what makes a restore's account-first order safe (R-6) — and it is
    // why `verify_integrity` REPORTS the missing category rather than the schema
    // refusing the account.
    //
    // A brand-new file rather than the fixture with its anchor removed, and the
    // reason is itself C-5: deleting the Transfer root cascades onto the
    // existing account's To/From category, which `trg_protect_transfer_category`
    // refuses while that account is there. MEASURED — the first draft of this
    // test failed on exactly that, which is the protection working.
    let mut connection = empty_file();

    create_account(&mut connection, draft("Rainy day")).expect("create");

    assert!(transfer_categories_for(&connection, NEW_ACCOUNT).is_empty());
    assert!(violations(&connection)
        .contains(&format!("account_missing_transfer_category:{NEW_ACCOUNT}")));
}

#[test]
fn a_card_stores_four_digits_and_the_rest_is_nowhere_in_the_file() {
    // B-7's card rule, in the ledger rather than above it. The second assertion
    // is the one that matters: not "the field was truncated" but "the number is
    // not in the database", because anything stored reaches that person's
    // backups and their JSON export.
    let mut connection = fixture();
    let pan = "1111222233334444";

    let created = create_account(
        &mut connection,
        CreateAccount {
            kind: Some("credit".to_owned()),
            account_number: Some(pan.to_owned()),
            ..draft("Spending card")
        },
    )
    .expect("create");

    assert_eq!(created.answer.account_number.as_deref(), Some("4444"));
    let stored: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE account_number = ?1",
            [pan],
            |row| row.get(0),
        )
        .expect("read");
    assert_eq!(stored, 0);
}

#[test]
fn a_bank_number_is_stored_whole_because_it_is_not_a_card() {
    // The other side of the same rule, and the reason `accountService` refuses
    // to guess an account's type: truncating here would destroy a real 8-digit
    // bank number.
    let mut connection = fixture();

    let created = create_account(
        &mut connection,
        CreateAccount {
            kind: Some("savings".to_owned()),
            account_number: Some("12345678".to_owned()),
            sort_code: Some("00-00-00".to_owned()),
            ..draft("Rainy day")
        },
    )
    .expect("create");

    assert_eq!(created.answer.account_number.as_deref(), Some("12345678"));
    assert_eq!(created.answer.sort_code.as_deref(), Some("00-00-00"));
}

#[test]
fn the_create_writes_one_audit_entry_carrying_the_whole_row() {
    // The cloud writes NOTHING here — `accounts` is a direct PostgREST insert
    // with no function to call `write_financial_audit` from — so this entry has
    // no counterpart to be compared against and is asserted instead.
    let mut connection = fixture();

    let created = create_account(&mut connection, draft("Rainy day")).expect("create");

    let (entity, action, before, after): (String, String, Option<String>, Option<String>) =
        connection
            .query_row(
                "SELECT entity, action, before_data, after_data
                   FROM financial_audit_log WHERE seq = ?1",
                [created.audit_seq],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("audit row");

    assert_eq!(entity, "account");
    assert_eq!(action, "create");
    assert!(before.is_none(), "a create has nothing before it");
    let after: serde_json::Value =
        serde_json::from_str(&after.expect("an after")).expect("valid json");
    assert_eq!(after["id"], json!(NEW_ACCOUNT));
    assert_eq!(after["name"], json!("Rainy day"));
    // Money as a decimal string in the audit payload, as everywhere else.
    assert_eq!(after["balance"], json!("0.00"));
    assert_eq!(after["is_active"], json!(true));
}

#[test]
fn an_opening_balance_date_that_is_not_a_day_is_refused_by_name() {
    let mut connection = fixture();

    let refusal = create_account(
        &mut connection,
        CreateAccount {
            opening_balance_date: Some("2024-02-31".to_owned()),
            ..draft("Rainy day")
        },
    )
    .expect_err("a day that does not exist");

    assert_eq!(refusal.code(), "date_invalid");
}

#[test]
fn the_iso_instant_the_cloud_writer_sends_is_read_as_its_day() {
    // `accountService.createAccount` sends `openingBalanceDate.toISOString()`
    // into a Postgres `date` column, which truncates. This file's column is TEXT
    // with a shape CHECK, so the truncation happens in the verb — and the two
    // engines end up with the same stored day.
    let mut connection = fixture();

    let created = create_account(
        &mut connection,
        CreateAccount {
            opening_balance_date: Some("2024-04-06T12:00:00.000Z".to_owned()),
            ..draft("Rainy day")
        },
    )
    .expect("create");

    assert_eq!(created.answer.opening_balance_date.as_deref(), Some("2024-04-06"));
}

#[test]
fn a_create_holds_no_guard_and_leaves_none_behind() {
    let mut connection = fixture();
    assert_eq!(guard_rows(&connection), 0);
    create_account(&mut connection, draft("Rainy day")).expect("create");
    assert_eq!(guard_rows(&connection), 0);
}

// ── update ──────────────────────────────────────────────────────────────────

#[test]
fn an_update_may_not_set_a_balance_and_says_which_rule_stopped_it() {
    // The refusal that separates this engine from the cloud's account update,
    // which will set `accounts.balance` to whatever it is handed. It is refused
    // by NAME rather than as an unknown field, because the caller has to be
    // told the rule rather than left thinking it made a typo.
    let mut connection = fixture();

    let refusal = update_account(
        &mut connection,
        patch_of(AccountPatch {
            balance: Field::Value(json!("999.00")),
            ..AccountPatch::default()
        }),
    )
    .expect_err("no absolute balance setter");

    assert_eq!(refusal.code(), "account_balance_is_derived");
    assert_eq!(balances(&connection, EVERYDAY), (-2500, 0));
    assert!(violations(&connection).is_empty());
}

#[test]
fn correcting_the_opening_balance_moves_the_balance_with_it() {
    // B-1, kept by moving BOTH sides by one delta. The cloud moves one side and
    // leaves the ledger identity broken by the size of the correction; here the
    // account is left saying "I started with 100.00 and have spent 25.00".
    let mut connection = fixture();

    let updated = update_account(
        &mut connection,
        patch_of(AccountPatch {
            initial_balance: Field::Value(Money::parse("100.00").expect("a decimal")),
            ..AccountPatch::default()
        }),
    )
    .expect("update");

    assert_eq!(updated.answer.initial_balance.to_decimal_string(), "100.00");
    assert_eq!(updated.answer.balance.to_decimal_string(), "75.00");
    assert_eq!(balances(&connection, EVERYDAY), (7_500, 10_000));
    assert!(violations(&connection).is_empty());
}

#[test]
fn c4_a_rename_follows_through_to_the_to_from_category() {
    // Not implemented in the verb — `trg_sync_transfer_category_for_account`
    // does it, which is what makes it parity with the cloud trigger rather than
    // a second implementation. Asserted here because the verb is the only thing
    // that fires it in the local edition.
    let mut connection = fixture();

    update_account(
        &mut connection,
        patch_of(AccountPatch {
            name: Field::Value("Everyday spending".to_owned()),
            ..AccountPatch::default()
        }),
    )
    .expect("rename");

    assert_eq!(
        transfer_categories_for(&connection, EVERYDAY),
        vec![("To/From Everyday spending".to_owned(), 1)]
    );
}

#[test]
fn a_field_the_patch_does_not_mention_is_left_exactly_as_it_was() {
    let mut connection = fixture();
    connection
        .execute(
            "UPDATE accounts SET notes = 'keep me', institution = 'Made Up Bank' WHERE id = ?1",
            [EVERYDAY],
        )
        .expect("seed");

    let updated = update_account(
        &mut connection,
        patch_of(AccountPatch {
            name: Field::Value("Everyday spending".to_owned()),
            ..AccountPatch::default()
        }),
    )
    .expect("update");

    assert_eq!(updated.answer.notes.as_deref(), Some("keep me"));
    assert_eq!(updated.answer.institution.as_deref(), Some("Made Up Bank"));
}

#[test]
fn a_stated_json_null_clears_the_column_and_absence_does_not() {
    // `mapAccountToDb`'s one rule, both halves: undefined is dropped, null is
    // kept and clears. The two are indistinguishable to an `Option`, which is
    // why the patch is written in `Field`.
    let mut connection = fixture();
    connection
        .execute("UPDATE accounts SET notes = 'keep me' WHERE id = ?1", [EVERYDAY])
        .expect("seed");

    let cleared = update_account(
        &mut connection,
        patch_of(AccountPatch {
            notes: Field::Null,
            ..AccountPatch::default()
        }),
    )
    .expect("update");
    assert_eq!(cleared.answer.notes, None);
}

#[test]
fn the_last_reconciled_balance_is_a_column_this_file_now_has() {
    // The gap `row/account.rs` recorded and this slice closed. Zero is stored as
    // zero and read back as zero: a swept account really does close on £0.00,
    // and "never reconciled" is NULL.
    let mut connection = fixture();

    let updated = update_account(
        &mut connection,
        patch_of(AccountPatch {
            last_reconciled_date: Field::Value("2024-03-31".to_owned()),
            last_reconciled_balance: Field::Value(Money::parse("0.00").expect("a decimal")),
            ..AccountPatch::default()
        }),
    )
    .expect("update");

    assert_eq!(updated.answer.last_reconciled_date.as_deref(), Some("2024-03-31"));
    assert_eq!(
        updated
            .answer
            .last_reconciled_balance
            .map(Money::to_decimal_string)
            .as_deref(),
        Some("0.00")
    );
    // And the balance did not move: recording a reconciliation is not a payment.
    assert_eq!(balances(&connection, EVERYDAY), (-2500, 0));
}

#[test]
fn somebody_elses_account_is_refused_by_name_and_nothing_moves() {
    let mut connection = fixture();

    let refusal = update_account(
        &mut connection,
        UpdateAccount {
            id: EVERYDAY.to_owned(),
            user_id: Some(STRANGER.to_owned()),
            patch: AccountPatch {
                name: Field::Value("Mine now".to_owned()),
                ..AccountPatch::default()
            },
        },
    )
    .expect_err("not theirs");

    assert_eq!(refusal.code(), "account_not_found_or_not_owned");
    let name: String = connection
        .query_row("SELECT name FROM accounts WHERE id = ?1", [EVERYDAY], |row| {
            row.get(0)
        })
        .expect("read");
    assert_eq!(name, "Everyday");
}

#[test]
fn an_update_holds_no_guard_and_leaves_none_behind() {
    let mut connection = fixture();
    update_account(
        &mut connection,
        patch_of(AccountPatch {
            name: Field::Value("Everyday spending".to_owned()),
            ..AccountPatch::default()
        }),
    )
    .expect("rename");
    assert_eq!(guard_rows(&connection), 0);
}

// ── close ───────────────────────────────────────────────────────────────────

#[test]
fn closing_keeps_every_transaction_and_every_penny() {
    // What close MEANS: one column. A deleted account is a hole in a ledger, and
    // the button promises the account can be reopened at any time.
    let mut connection = fixture();

    close_account(
        &mut connection,
        CloseAccount {
            id: EVERYDAY.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("close");

    let (is_active, rows): (i64, i64) = connection
        .query_row(
            "SELECT a.is_active,
                    (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id)
               FROM accounts a WHERE a.id = ?1",
            [EVERYDAY],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("read");
    assert_eq!(is_active, 0);
    assert_eq!(rows, 1, "closing is not deleting");
    assert_eq!(balances(&connection, EVERYDAY), (-2500, 0));
    assert!(violations(&connection).is_empty());
}

#[test]
fn c4_closing_takes_the_to_from_category_out_of_the_dropdowns() {
    let mut connection = fixture();

    close_account(
        &mut connection,
        CloseAccount {
            id: EVERYDAY.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("close");

    // Still there — C-5 protects it while the account exists — and hidden.
    assert_eq!(
        transfer_categories_for(&connection, EVERYDAY),
        vec![("To/From Everyday".to_owned(), 0)]
    );
}

#[test]
fn closing_a_closed_account_is_accepted_rather_than_refused() {
    // MEASURED on both engines: the UPDATE matches the row whether or not the
    // value differs. Idempotent, and audited both times, which is the honest
    // record of two requests rather than one.
    let mut connection = fixture();
    let close = |connection: &mut Connection| {
        close_account(
            connection,
            CloseAccount {
                id: EVERYDAY.to_owned(),
                user_id: Some(OWNER.to_owned()),
            },
        )
    };

    close(&mut connection).expect("close");
    let second = close(&mut connection).expect("close again");

    assert!(!second.answer.is_active);
    let entries: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM financial_audit_log WHERE entity = 'account'",
            [],
            |row| row.get(0),
        )
        .expect("count");
    assert_eq!(entries, 2);
}

#[test]
fn reopening_is_an_update_because_there_is_no_reopen_verb() {
    let mut connection = fixture();
    close_account(
        &mut connection,
        CloseAccount {
            id: EVERYDAY.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("close");

    let reopened = update_account(
        &mut connection,
        patch_of(AccountPatch {
            is_active: Field::Value(wealth_core::wire::Flag::Bool(true)),
            ..AccountPatch::default()
        }),
    )
    .expect("reopen");

    assert!(reopened.answer.is_active);
    // And C-4 brought the To/From category back with it.
    assert_eq!(
        transfer_categories_for(&connection, EVERYDAY),
        vec![("To/From Everyday".to_owned(), 1)]
    );
}

#[test]
fn a_close_holds_no_guard_and_leaves_none_behind() {
    let mut connection = fixture();
    close_account(
        &mut connection,
        CloseAccount {
            id: EVERYDAY.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("close");
    assert_eq!(guard_rows(&connection), 0);
}

// ── R-6: the C-3 trigger against a restore ──────────────────────────────────

/// A restore into an EMPTY file: accounts first, then the categories the backup
/// carries — including that account's own To/From row.
///
/// This is the collision PHASE3-PLAN R-6 names, and the shape the contract's
/// rule 84 states from the seam ("a restored ledger has exactly ONE To/From per
/// account"). It cannot be asserted through the seam yet — every restore rule
/// needs `collectBackup` too, and that is slice 25 — so it is asserted here,
/// where the two verbs that make a restore already exist.
fn empty_file() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'device@localhost');"
        ))
        .expect("owner");
    connection
}

fn restore(connection: &mut Connection, chunks: Vec<(&str, serde_json::Value)>) {
    restore_user_chunk(
        connection,
        RestoreUserChunk {
            chunks: chunks
                .into_iter()
                .map(|(entity, rows)| Chunk {
                    entity: entity.to_owned(),
                    rows: Field::Value(rows),
                })
                .collect(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("restore");
}

#[test]
fn r6_a_restored_ledger_has_exactly_one_to_from_category_per_account() {
    // The two things that could go wrong, and the two guards that stop them.
    //
    // The accounts land while the file has NO categories, so C-3's outer
    // `WHEN EXISTS (a Transfer anchor)` stands the trigger down and the backup's
    // own To/From row lands unopposed. Then the categories land — and the
    // trigger is not fired by a category insert at all.
    let mut connection = empty_file();

    restore(
        &mut connection,
        vec![
            (
                "accounts",
                json!([{
                    "id": EVERYDAY, "user_id": OWNER, "name": "Everyday", "type": "checking",
                    "balance": "0.00", "initial_balance": "0.00", "is_active": true
                }]),
            ),
            (
                "categories",
                json!([
                    {
                        "id": TRANSFER_ROOT, "user_id": OWNER, "name": "Transfer",
                        "type": "both", "level": "type"
                    },
                    {
                        "id": "c0000000-0000-0000-0000-0000000000fa", "user_id": OWNER,
                        "name": "To/From Everyday", "type": "both", "level": "detail",
                        "parent_id": TRANSFER_ROOT, "account_id": EVERYDAY,
                        "is_transfer_category": true
                    }
                ]),
            ),
        ],
    );

    assert_eq!(
        transfer_categories_for(&connection, EVERYDAY),
        vec![("To/From Everyday".to_owned(), 1)],
        "the restore's own To/From row, and no second one"
    );
    assert!(violations(&connection).is_empty());
}

#[test]
fn r6_the_order_that_could_produce_two_is_refused_by_a_key_rather_than_a_guard() {
    // THE COLLISION R-6 NAMES — and the finding is that it is UNREACHABLE, for a
    // reason the plan did not have: a foreign key, not the trigger's guard.
    //
    // Two facts close every other route first. A restore is ONE call in ONE
    // transaction (B-10), and it refuses a login that already holds anything —
    // MEASURED, `restore_target_not_empty`, which the first draft of this test
    // tripped over by restoring twice. So the only way an account can be
    // inserted into a file that already has its Transfer anchor is for the SAME
    // restore to send the categories chunk BEFORE the accounts chunk, which is
    // the order that would leave C-3's outer `WHEN EXISTS` satisfied and the
    // inner `NOT EXISTS` as the last line of defence.
    //
    // That order does not get as far as the trigger. A To/From category names
    // its account through `FOREIGN KEY (account_id, user_id) REFERENCES
    // accounts(id, user_id)`, which is NOT deferrable — only the two
    // transfer-link keys in this schema are — so the category cannot land before
    // the account exists, and the whole restore is refused by name with the row
    // printed. MEASURED here rather than reasoned: this is the refusal.
    //
    // So "exactly one To/From per account after a restore" holds by TWO
    // independent constructions: in the only legal order the trigger stands
    // itself down (the test above), and the order in which it would not is not
    // an order a restore can use.
    let mut connection = empty_file();

    let refusal = restore_user_chunk(
        &mut connection,
        RestoreUserChunk {
            chunks: vec![
                Chunk {
                    entity: "categories".to_owned(),
                    rows: Field::Value(json!([
                        {
                            "id": TRANSFER_ROOT, "user_id": OWNER, "name": "Transfer",
                            "type": "both", "level": "type"
                        },
                        {
                            "id": "c0000000-0000-0000-0000-0000000000fa", "user_id": OWNER,
                            "name": "To/From Everyday", "type": "both", "level": "detail",
                            "parent_id": TRANSFER_ROOT, "account_id": EVERYDAY,
                            "is_transfer_category": true
                        }
                    ])),
                },
                Chunk {
                    entity: "accounts".to_owned(),
                    rows: Field::Value(json!([{
                        "id": EVERYDAY, "user_id": OWNER, "name": "Everyday", "type": "checking",
                        "balance": "0.00", "initial_balance": "0.00", "is_active": true
                    }])),
                },
            ],
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect_err("a category cannot name an account that is not there yet");

    assert_eq!(refusal.code(), "restore_row_refused");
    // All or nothing: the refused restore left the file exactly as empty as it
    // found it, so there is no half-restored ledger to have two of anything in.
    let rows: i64 = connection
        .query_row(
            "SELECT (SELECT COUNT(*) FROM accounts) + (SELECT COUNT(*) FROM categories)",
            [],
            |row| row.get(0),
        )
        .expect("count");
    assert_eq!(rows, 0);
}

#[test]
fn r6_two_to_from_categories_are_reported_by_name_when_they_do_occur() {
    // The check that makes rule 84 provable at all. A second To/From row under a
    // DIFFERENT name escapes the unique index — so the invariant is not "the
    // index prevents it", it is "verify_integrity sees it", and this is that
    // check firing.
    let connection = fixture();
    connection
        .execute(
            "INSERT INTO categories (id, user_id, name, type, level, parent_id, account_id,
                                     is_transfer_category)
             VALUES ('c0000000-0000-0000-0000-0000000000fc', ?1, 'To/From Everyday (old)', 'both',
                     'detail', ?2, ?3, 1)",
            [OWNER, TRANSFER_ROOT, EVERYDAY],
        )
        .expect("plant a duplicate");

    assert!(violations(&connection)
        .contains(&format!("account_multiple_transfer_categories:{EVERYDAY}")));
}
