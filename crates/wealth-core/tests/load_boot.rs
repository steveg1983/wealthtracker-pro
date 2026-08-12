//! Integration tests for the composite — the half of it that has no cloud
//! counterpart to be differential about.
//!
//! `scripts/local-sqlite/verb-specs/boot-*.spec.mjs` holds the other half: seven
//! specs running one `load_boot` payload against the queries
//! `DataServiceImpl.loadBoot` composes, and comparing the two answers list by
//! list. What is here is what that comparison cannot reach:
//!
//! 1. **The SHAPE of the answer** — which keys it has, and, more to the point,
//!    which it has not. The harness compares the keys both engines produce; only
//!    a test on this side can say that a key which appears in NEITHER answer is
//!    absent on purpose. That is where R-4 lives: a balance map folded into this
//!    verb would close the seeding window the seam keeps open on purpose, and
//!    the harness would report it as a divergence rather than as the money bug
//!    it is.
//! 2. **The two figures side by side** — the stored balance this answer carries
//!    and the derived one [`account_balances`] computes, asked of the same file
//!    in the same test, which is the only place their independence is visible.
//! 3. **The crate's own tie-breaks, through the composite.** The cloud states no
//!    order under a tie for the accounts, so its oracle deliberately does not
//!    either; the tie-break is this crate's and R-5 says it must survive being
//!    composed.
//! 4. **A file holding two logins**, which is a local possibility with no cloud
//!    equivalent: there is no RLS behind a file, and the owner in the payload is
//!    the whole gate — seven times over in this verb.
//! 5. **The transaction**, in the one respect a single-threaded test can prove:
//!    that it is finished rather than leaked.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::command::{parse, Command};
use wealth_core::db;
use wealth_core::verbs::{
    account_balances, list_accounts, list_budgets, list_categories, list_custom_reports, list_goals,
    list_transactions,
    list_transaction_splits, load_boot, OwnedRead,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const CORNER_SHOP: &str = "70000000-0000-0000-0000-000000000001";
const SAME_DAY: &str = "70000000-0000-0000-0000-0000000000f1";
const A_LATER_DAY: &str = "70000000-0000-0000-0000-0000000000f2";
const SAME_INSTANT: &str = "2024-01-01T00:00:00.000Z";

fn owner(user_id: &str) -> OwnedRead {
    OwnedRead { user_id: user_id.to_owned() }
}

/// An empty file with one login in it, and the Transfer root C-3 looks for.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO categories (id, user_id, name, type, level)
               VALUES ('{TRANSFER_ROOT}', '{OWNER}', 'Transfer', 'both', 'type');"
        ))
        .expect("fixture");
    connection
}

/// One of everything the boot answers with, so no list is empty by accident.
///
/// Two accounts opened in the SAME instant (the tie the crate's own key
/// settles), three transactions on TWO days (so the ledger's order is
/// observable and its tie-break is exercised), one of them a split parent with
/// two lines, a budget, a goal and a saved report. Every balance is what B-1
/// says it should be.
///
/// The two days matter more than they look. With every row on one date, Rust's
/// stable sort makes a mutation that re-orders the ledger by date alone a
/// NO-OP, and the composition test below passes on a composite that sorts. It
/// was written that way first and the mutation walked straight through it.
fn a_whole_ledger(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO accounts (id, user_id, name, type, balance_minor,
                                   initial_balance_minor, created_at, updated_at) VALUES
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 1000, 1000,
                '{SAME_INSTANT}', '{SAME_INSTANT}'),
               ('{EVERYDAY}',  '{OWNER}', 'Everyday', 'checking', -2700, 0,
                '{SAME_INSTANT}', '{SAME_INSTANT}');
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor,
                                       type, date, category, is_split) VALUES
               ('{CORNER_SHOP}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500,
                'expense', '2024-03-01', '', 1),
               ('{SAME_DAY}', '{OWNER}', '{EVERYDAY}', 'Same day', -100,
                'expense', '2024-03-01', '{TRANSFER_ROOT}', 0),
               ('{A_LATER_DAY}', '{OWNER}', '{EVERYDAY}', 'A later day', -100,
                'expense', '2024-03-02', '{TRANSFER_ROOT}', 0);
             INSERT INTO transaction_splits (id, transaction_id, user_id, category,
                                             amount_minor, sort_order) VALUES
               ('50000000-0000-0000-0000-0000000000b1', '{CORNER_SHOP}', '{OWNER}',
                '{TRANSFER_ROOT}', -1000, 0),
               ('50000000-0000-0000-0000-0000000000b2', '{CORNER_SHOP}', '{OWNER}',
                '{TRANSFER_ROOT}', -1500, 1);
             INSERT INTO budgets (id, user_id, name, amount_minor, period, start_date)
               VALUES ('b0000000-0000-0000-0000-000000000001', '{OWNER}', 'Food', 12345,
                       'monthly', '2024-01-01');
             INSERT INTO goals (id, user_id, name, target_amount_minor)
               VALUES ('90000000-0000-0000-0000-000000000001', '{OWNER}', 'New boiler', 150000);
             INSERT INTO custom_reports (id, user_id, name, components)
               VALUES ('a1000000-0000-0000-0000-000000000001', '{OWNER}', 'Where it went',
                       '[{{\"id\":\"one\",\"type\":\"summary\"}}]');"
        ))
        .expect("ledger");
}

// ── The shape of the answer, which is where R-4 lives ───────────────────────

#[test]
fn the_boot_answers_with_seven_lists_and_no_balance_map() {
    let mut connection = fixture();
    a_whole_ledger(&connection);

    let answered = load_boot(&mut connection, owner(OWNER)).expect("boot");
    let json = serde_json::to_value(&answered).expect("json");
    let keys: Vec<&str> = json["answer"]
        .as_object()
        .expect("an object")
        .keys()
        .map(String::as_str)
        .collect();

    // R-4, as a key set. `account_balances` is the seam's PARALLEL read — the
    // one deliberately outside the sequence — and the whole value of it is that
    // it arrives BEFORE the ledger does: the
    // seeding rule fires only while `transactions.length === 0`, so a map that
    // arrives WITH the transactions has nothing left to seed and every account
    // reads zero for the whole boot. Folding it in here is not a bigger answer,
    // it is the loss of the answer that mattered.
    //
    // The other three absences are decisions too, argued at the verb:
    // `transaction_stats` and `phases` are the port's vocabulary (one of those
    // sentences is `'load failed'`, which only the port can say), and the closed
    // accounts and the dismissals are not boot reads in the application either.
    assert_eq!(
        keys,
        vec![
            "accounts",
            "categories",
            "transactions",
            "transaction_splits",
            "budgets",
            "goals",
            // The seventh, and the one presence the verb has to argue rather
            // than inherit: the dashboard draws pinned custom reports in its
            // first paint, so a boot without them paints the pinned widgets
            // missing and fills them in afterwards.
            "custom_reports"
        ]
    );
}

#[test]
fn the_stored_balance_crosses_the_boot_untouched_while_the_derived_one_is_asked_separately() {
    let mut connection = fixture();
    a_whole_ledger(&connection);
    // A cache that has drifted: the rows say −27.00, the column says 999.99.
    // The only fixture in this file that plants a B-1 violation, planted for the
    // reason `aStoredBalanceThatDrifted` gives — the violation IS the subject.
    connection
        .execute_batch(&format!(
            "UPDATE accounts SET balance_minor = 99999 WHERE id = '{EVERYDAY}';"
        ))
        .expect("drift");

    let boot = load_boot(&mut connection, owner(OWNER)).expect("boot");
    let everyday = boot
        .answer
        .accounts
        .iter()
        .find(|account| account.id == EVERYDAY)
        .expect("the account");
    let derived = account_balances(&connection, owner(OWNER)).expect("balances");
    let aggregate = derived
        .answer
        .account_balances
        .iter()
        .find(|balance| balance.account_id == EVERYDAY)
        .expect("the balance");

    // The second half of R-4, and the half a key set cannot catch. The boot
    // carries the STORED figure because that is the column its accounts read
    // projects; the money verb DERIVES its own. A composite that quietly
    // corrected one with the other would make the two agree always — and two
    // numbers are only worth having while they are arrived at independently.
    // `verify_integrity`'s `balance_identity` is the instrument that would then
    // be reporting a disagreement nobody's figures could contradict.
    assert_eq!(everyday.balance.to_decimal_string(), "999.99");
    assert_eq!(aggregate.balance.to_decimal_string(), "-27.00");
}

#[test]
fn a_new_file_answers_with_seven_empty_arrays_and_not_seven_nulls() {
    let mut connection = fixture();
    connection
        .execute_batch(&format!("DELETE FROM categories WHERE user_id = '{OWNER}';"))
        .expect("empty");

    let answered = load_boot(&mut connection, owner(OWNER)).expect("boot");

    // The far side maps all seven by name, and `null` under any of them is a
    // different bug from `[]`: one says "nothing here yet", which is what a file
    // on the day it is made legitimately says, and the other says "this read
    // does not work".
    assert_eq!(
        serde_json::to_string(&answered).expect("json"),
        r#"{"answer":{"accounts":[],"categories":[],"transactions":[],"transaction_splits":[],"budgets":[],"goals":[],"custom_reports":[]}}"#
    );
}

// ── It composes the reads; it does not re-implement them ────────────────────

#[test]
fn every_list_in_the_boot_is_the_read_of_the_same_name_asked_on_its_own() {
    let mut connection = fixture();
    a_whole_ledger(&connection);

    let boot = load_boot(&mut connection, owner(OWNER)).expect("boot");
    fn value<T: serde::Serialize>(rows: &T) -> serde_json::Value {
        serde_json::to_value(rows).expect("json")
    }

    // Seven assertions of the same shape, and together they are the claim the
    // module makes structurally: this verb runs no query of its own. A composite
    // that grew one — for speed, for a join, for a column somebody wanted —
    // would drift from the read it was copied from while every EXPLAIN
    // assertion in `reads_at_scale.rs` went on passing, because those are
    // asserted against the READS' SQL.
    assert_eq!(
        value(&boot.answer.accounts),
        value(&list_accounts(&connection, owner(OWNER)).expect("read").answer.accounts)
    );
    assert_eq!(
        value(&boot.answer.categories),
        value(&list_categories(&connection, owner(OWNER)).expect("read").answer.categories)
    );
    assert_eq!(
        value(&boot.answer.transactions),
        value(&list_transactions(&connection, owner(OWNER)).expect("read").answer.transactions)
    );
    assert_eq!(
        value(&boot.answer.transaction_splits),
        value(
            &list_transaction_splits(&connection, owner(OWNER))
                .expect("read")
                .answer
                .transaction_splits
        )
    );
    assert_eq!(
        value(&boot.answer.budgets),
        value(&list_budgets(&connection, owner(OWNER)).expect("read").answer.budgets)
    );
    assert_eq!(
        value(&boot.answer.goals),
        value(&list_goals(&connection, owner(OWNER)).expect("read").answer.goals)
    );
    assert_eq!(
        value(&boot.answer.custom_reports),
        value(
            &list_custom_reports(&connection, owner(OWNER))
                .expect("read")
                .answer
                .custom_reports
        )
    );
}

#[test]
fn the_ledger_in_the_boot_is_newest_first_with_the_clouds_own_tie_break_behind_it() {
    let mut connection = fixture();
    a_whole_ledger(&connection);

    let boot = load_boot(&mut connection, owner(OWNER)).expect("boot");
    let ids: Vec<&str> = boot.answer.transactions.iter().map(|row| row.id.as_str()).collect();

    // R-5 stated where the app actually receives it. `date DESC, id DESC` — and
    // here the second key is not this crate's own: the cloud states it and calls
    // it, in its own comment, a "stable tiebreak for paging". Two rows share
    // 2024-03-01, and …f1 sorts above …001.
    assert_eq!(ids, vec![A_LATER_DAY, SAME_DAY, CORNER_SHOP]);
}

#[test]
fn two_accounts_opened_in_the_same_instant_are_in_the_boot_in_id_order() {
    let mut connection = fixture();
    a_whole_ledger(&connection);

    let boot = load_boot(&mut connection, owner(OWNER)).expect("boot");
    let ids: Vec<&str> = boot.answer.accounts.iter().map(|a| a.id.as_str()).collect();

    // R-5 for a key the cloud never stated. Rainy day is INSERTed first and
    // `created_at` cannot separate the two, so the answer is by id — Everyday's,
    // ending 0001. The harness cannot prove this one: its oracle deliberately
    // omits a tie-break the cloud never said, so a composite that re-sorted its
    // accounts would still match Postgres and be caught only here.
    assert_eq!(ids, vec![EVERYDAY, RAINY_DAY]);
}

#[test]
fn the_same_file_booted_twice_answers_in_the_same_order() {
    let mut connection = fixture();
    a_whole_ledger(&connection);

    let first = serde_json::to_value(load_boot(&mut connection, owner(OWNER)).expect("boot"))
        .expect("json");
    let again = serde_json::to_value(load_boot(&mut connection, owner(OWNER)).expect("boot"))
        .expect("json");

    // The property every tie-break in the crate exists for, asked of the whole
    // boot at once: a page that reshuffles itself between two loads nobody
    // changed anything between is a page whose running balance cannot be
    // checked by eye. It also proves the first call left nothing behind — a
    // leaked read transaction would make this second one fail outright.
    assert_eq!(first, again);
}

// ── A file holding two logins ───────────────────────────────────────────────

#[test]
fn a_second_logins_rows_are_in_the_file_and_in_none_of_the_boots_seven_lists() {
    let mut connection = fixture();
    a_whole_ledger(&connection);
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('a0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours',
                       'checking', -100, 0);
             INSERT INTO categories (id, user_id, name, type, level)
               VALUES ('c0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours',
                       'expense', 'detail');
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor,
                                       type, date)
               VALUES ('70000000-0000-0000-0000-0000000000f9', '{STRANGER}',
                       'a0000000-0000-0000-0000-0000000000f9', 'Theirs', -100, 'expense',
                       '2024-03-01');
             INSERT INTO transaction_splits (id, transaction_id, user_id, category,
                                             amount_minor, sort_order)
               VALUES ('50000000-0000-0000-0000-0000000000f9',
                       '70000000-0000-0000-0000-0000000000f9', '{STRANGER}',
                       'c0000000-0000-0000-0000-0000000000f9', -100, 0);
             INSERT INTO budgets (id, user_id, name, amount_minor, period, start_date)
               VALUES ('b0000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours', 100,
                       'monthly', '2024-01-01');
             INSERT INTO goals (id, user_id, name, target_amount_minor)
               VALUES ('90000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours', 100);
             INSERT INTO custom_reports (id, user_id, name)
               VALUES ('a1000000-0000-0000-0000-0000000000f9', '{STRANGER}', 'Not yours');"
        ))
        .expect("stranger");

    let boot = load_boot(&mut connection, owner(OWNER)).expect("boot");

    // Seven chances to forget the owner, which is the composite's own new risk:
    // each list below would be one row longer if this verb had passed the owner
    // to six reads and not the seventh. There is no RLS in a file to narrow the
    // answer afterwards, and a restored two-login file is exactly what the
    // required owner exists for.
    assert!(boot.answer.accounts.iter().all(|row| row.user_id == OWNER));
    assert!(boot.answer.categories.iter().all(|row| row.user_id == OWNER));
    assert_eq!(boot.answer.transactions.len(), 3);
    assert!(boot.answer.transaction_splits.iter().all(|row| row.user_id == OWNER));
    assert!(boot.answer.budgets.iter().all(|row| row.user_id == OWNER));
    assert!(boot.answer.goals.iter().all(|row| row.user_id == OWNER));
    assert!(boot.answer.custom_reports.iter().all(|row| row.user_id == OWNER));

    // And the other half of the same property: a file with two logins answers
    // each of them correctly. Scoping is a filter, not a refusal.
    let theirs = load_boot(&mut connection, owner(STRANGER)).expect("boot");
    assert_eq!(theirs.answer.accounts.len(), 1);
    assert_eq!(theirs.answer.transactions.len(), 1);
    assert_eq!(theirs.answer.transaction_splits.len(), 1);
    assert_eq!(theirs.answer.custom_reports.len(), 1);
}

// ── The transaction ─────────────────────────────────────────────────────────

#[test]
fn the_boot_finishes_its_transaction_instead_of_leaving_one_open() {
    let mut connection = fixture();
    a_whole_ledger(&connection);
    assert!(connection.is_autocommit(), "the fixture left a transaction open");

    load_boot(&mut connection, owner(OWNER)).expect("boot");

    // The half of "one transaction" a single-threaded test can prove. A leaked
    // read transaction holds a SHARED lock for the life of the document — every
    // later write on any connection would wait out `busy_timeout` and then fail
    // — so this assertion is worth more than its length. What it cannot prove is
    // that a write cannot land in the MIDDLE of the seven reads; that needs a
    // second thread whose timing decides the result, and a flaky test teaches
    // people to re-run tests until they pass. The verb's module documentation
    // says which is which rather than leaving the gap to be discovered.
    assert!(connection.is_autocommit(), "the boot left its read transaction open");

    // A write still works afterwards, which is the same fact from the side that
    // would actually be noticed.
    connection
        .execute_batch(&format!(
            "UPDATE accounts SET name = 'Everyday account' WHERE id = '{EVERYDAY}';"
        ))
        .expect("the file is still writable");
}

// ── The refusals that never reach a connection ──────────────────────────────

#[test]
fn the_composite_parses_to_its_own_variant() {
    let parsed = parse(&format!(
        r#"{{"verb":"load_boot","payload":{{"user_id":"{OWNER}"}}}}"#
    ))
    .expect("load_boot");

    // The dispatch's exhaustiveness is the compiler's business; what the
    // compiler cannot check is that the STRING is the one the port will send.
    assert!(matches!(parsed, Command::LoadBoot(_)));
}

#[test]
fn a_boot_with_no_owner_is_refused_before_a_file_is_opened() {
    let refusal = parse(r#"{"verb":"load_boot","payload":{}}"#).expect_err("refused");
    let json = serde_json::to_string(&refusal).expect("json");

    // Seven reads with the owner left off would answer with every login in the
    // file — the reads' own reasoning, multiplied by seven.
    assert!(json.contains("missing field"), "{json}");
    assert!(json.contains("user_id"), "{json}");
}

#[test]
fn a_boot_asking_for_the_balances_as_well_is_refused_by_name() {
    let refusal = parse(&format!(
        r#"{{"verb":"load_boot","payload":{{"user_id":"{OWNER}","include_balances":true}}}}"#
    ))
    .expect_err("refused");
    let json = serde_json::to_string(&refusal).expect("json");

    // The most plausible thing anybody will one day try to send, and the reason
    // this verb shares the reads' payload rather than owning one: a composite
    // with a payload of its own is a composite whose payload grows options, and
    // the first option anybody would add is the one R-4 exists to keep out.
    assert!(json.contains("unknown_field"), "{json}");
    assert!(json.contains("include_balances"), "{json}");
}
