//! What the four heavy reads do to a ledger the size of a real one.
//!
//! Slice 15's six reads accepted `USE TEMP B-TREE FOR ORDER BY` and wrote down
//! why: *"the sort happens after the index has cut the table down to one owner's
//! rows, and on these five tables that is tens to low hundreds"*. It also wrote
//! down the condition under which that argument stops holding — *"a read over
//! `transactions` or `transaction_splits`, where the row counts are five orders
//! of magnitude larger"* — and said slice 16's reads *"must be measured again
//! rather than assumed to be like these"*.
//!
//! This is that measurement, and it is a TEST rather than a note because a note
//! goes stale in silence. R-12: a read verb that full-scans must turn something
//! red. Every plan below is asserted, not printed and hoped over, and each
//! assertion is made against the query the reader itself prepares — the SQL
//! comes from the crate, never from a copy in this file, because a plan
//! assertion written against a copy is one that survives the query changing.
//!
//! The wall times ARE printed rather than asserted. A time bound is a bound on
//! whichever machine happens to run it, and a flaky test that fails on a busy
//! laptop teaches people to re-run tests until they pass. Run it with
//! `cargo test --test reads_at_scale -- --nocapture` to see them; the figures
//! recorded in `crate::verbs::reads` came from that.
//!
//! The ledger built here is 50,000 transactions across 12 accounts, with 6,000
//! tags, 8,000 split lines and 1,000 archived rows. All of it is invented: this
//! repo is public, and no real payee, account number or figure appears in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
// The fixture builder counts rows and spreads them over accounts and dates.
// `arithmetic_side_effects` is denied crate-wide because MONEY arithmetic must
// be checked; loop indices are not money, and writing `checked_rem` around a
// modulo of a loop counter would make this file harder to read without making
// any figure in the app safer. Every amount below is a literal.
#![allow(clippy::arithmetic_side_effects)]

use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Instant;

use rusqlite::Connection;
use tempfile::TempDir;
use wealth_core::db;
use wealth_core::row;
use wealth_core::verbs::{
    account_balances, list_transaction_splits, list_transactions, load_boot, splits_for, OwnedRead,
    SplitsFor,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const TRANSFER_ROOT: &str = "c0000000-0000-0000-0000-000000000001";

/// Big enough to be the thing the plan says it is. The owner's own MS Money
/// history is ~51k rows; the RPC this slice ports was written for *"50k+"*.
const TRANSACTIONS: usize = 50_000;
const ACCOUNTS: usize = 12;
const TAGGED: usize = 3_000;
const SPLIT_PARENTS: usize = 4_000;
const ARCHIVED: usize = 1_000;

/// The ledger, built ONCE and opened per test.
///
/// Built into a real file rather than memory, and shared, for two reasons that
/// happen to point the same way: fifty thousand rows take a moment to write and
/// six tests should not each pay for it, and a plan measured on a file is a plan
/// measured on the thing the app will actually open. Every test here only reads,
/// so several connections to one file is exactly the situation SQLite is for.
static LEDGER: OnceLock<(TempDir, PathBuf)> = OnceLock::new();

fn a_real_sized_ledger() -> Connection {
    let (_directory, path) = LEDGER.get_or_init(build_the_ledger);
    db::open(path).expect("open")
}

/// A ledger of the size the RPC was written for, built in one transaction.
fn build_the_ledger() -> (TempDir, PathBuf) {
    let directory = tempfile::tempdir().expect("tempdir");
    let path = directory.path().join("scale.db");
    // `Connection::open` to CREATE it and `db::configure` to put it in the state
    // the schema's guarantees hold in — the same two steps `wealth-core-cli
    // --apply-schema` takes, because `db::open` deliberately refuses to create a
    // file that is not there.
    let connection = Connection::open(&path).expect("create");
    db::configure(&connection).expect("configure");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO categories (id, user_id, name, type, level)
               VALUES ('{TRANSFER_ROOT}', '{OWNER}', 'Transfer', 'both', 'type'),
                      ('c0000000-0000-0000-0000-000000000002', '{OWNER}', 'Outgoings',
                       'expense', 'type');"
        ))
        .expect("seed");

    connection.execute_batch("BEGIN").expect("begin");
    {
        let mut account = connection
            .prepare(
                "INSERT INTO accounts (id, user_id, name, type, balance_minor,
                                       initial_balance_minor)
                 VALUES (?1, ?2, ?3, 'checking', 0, ?4)",
            )
            .expect("prepare account");
        for index in 0..ACCOUNTS {
            account
                .execute(rusqlite::params![
                    account_id(index),
                    OWNER,
                    format!("Account {index}"),
                    i64::try_from(index).unwrap() * 100,
                ])
                .expect("account");
        }

        let mut transaction = connection
            .prepare(
                "INSERT INTO transactions (id, user_id, account_id, description, amount_minor,
                                           type, date, category, archived)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'expense', ?6, 'c0000000-0000-0000-0000-000000000002',
                         ?7)",
            )
            .expect("prepare transaction");
        for index in 0..TRANSACTIONS {
            transaction
                .execute(rusqlite::params![
                    transaction_id(index),
                    OWNER,
                    account_id(index % ACCOUNTS),
                    format!("Payee {}", index % 400),
                    -100_i64 - i64::try_from(index % 900).unwrap(),
                    a_date(index),
                    i64::from(index < ARCHIVED),
                ])
                .expect("transaction");
        }

        let mut tag = connection
            .prepare("INSERT INTO transaction_tags (transaction_id, tag) VALUES (?1, ?2)")
            .expect("prepare tag");
        for index in 0..TAGGED {
            // Two tags apiece, so the fold has something to fold rather than a
            // one-to-one map that any implementation would get right.
            for name in ["holiday", "receipted"] {
                tag.execute(rusqlite::params![transaction_id(index), name]).expect("tag");
            }
        }

        // A split parent's lines must sum to it (S-1) and there must be at least
        // two (S-2), so each parent takes its own amount split in two. Written
        // behind the guard the schema's own protections require.
        connection.execute_batch("INSERT INTO _rpc_guard VALUES ('split')").expect("guard");
        let mut parent = connection
            .prepare("UPDATE transactions SET is_split = 1, category = '' WHERE id = ?1")
            .expect("prepare parent");
        let mut line = connection
            .prepare(
                "INSERT INTO transaction_splits (id, transaction_id, user_id, category,
                                                 amount_minor, sort_order)
                 VALUES (?1, ?2, ?3, 'c0000000-0000-0000-0000-000000000002', ?4, ?5)",
            )
            .expect("prepare line");
        for index in 0..SPLIT_PARENTS {
            let amount = -100_i64 - i64::try_from(index % 900).unwrap();
            parent.execute(rusqlite::params![transaction_id(index)]).expect("parent");
            line.execute(rusqlite::params![
                format!("50000000-0000-0000-0000-{index:012}"),
                transaction_id(index),
                OWNER,
                amount + 50,
                0,
            ])
            .expect("line");
            line.execute(rusqlite::params![
                format!("51000000-0000-0000-0000-{index:012}"),
                transaction_id(index),
                OWNER,
                -50,
                // A SHARED sort_order on the second line of every fourth parent,
                // because `sort_order` is not unique and the tie-break is what
                // keeps the answer repeatable.
                if index % 4 == 0 { 0 } else { 1 },
            ])
            .expect("line");
        }
        connection.execute_batch("DELETE FROM _rpc_guard").expect("guard off");

        // B-1 on every account, so the file this measures against is a file the
        // ledger would accept. `verify_integrity` would otherwise open with
        // twelve `balance_identity` violations.
        connection
            .execute_batch(
                "UPDATE accounts SET balance_minor = initial_balance_minor + COALESCE(
                   (SELECT SUM(amount_minor) FROM transactions t WHERE t.account_id = accounts.id),
                   0)",
            )
            .expect("balances");
    }
    connection.execute_batch("COMMIT").expect("commit");
    // ANALYZE, because a plan the planner chose WITHOUT statistics is a plan the
    // app will not get: `db::open` reads `sqlite_stat1` if it is there, and a
    // real file that has been written to for a year has it.
    connection.execute_batch("ANALYZE").expect("analyze");
    drop(connection);
    (directory, path)
}

fn account_id(index: usize) -> String {
    format!("a0000000-0000-0000-0000-{index:012}")
}

fn transaction_id(index: usize) -> String {
    format!("70000000-0000-0000-0000-{index:012}")
}

/// Four years of dates, many rows to a day — which is what makes `date DESC`
/// alone an ambiguous order and the ported `id DESC` tie-break load-bearing.
fn a_date(index: usize) -> String {
    let day = index % 28 + 1;
    let month = (index / 28) % 12 + 1;
    let year = 2021 + (index / (28 * 12)) % 4;
    format!("{year:04}-{month:02}-{day:02}")
}

/// `EXPLAIN QUERY PLAN`, as the lines SQLite reports.
///
/// The bound values are the REAL ones, not placeholders: SQLite's planner is
/// allowed to choose differently for a value it can see, so explaining a query
/// with unbound parameters would be explaining a query nobody runs.
fn plan(connection: &Connection, sql: &str, bound: &[&str]) -> Vec<String> {
    let mut statement = connection.prepare(&format!("EXPLAIN QUERY PLAN {sql}")).expect("explain");
    statement
        .query_map(rusqlite::params_from_iter(bound), |record| record.get::<_, String>(3))
        .expect("explain rows")
        .map(|line| line.expect("line"))
        .collect::<Vec<_>>()
}

fn report(name: &str, elapsed: std::time::Duration, rows: usize, plan: &[String]) {
    println!("── {name}: {rows} rows in {:?}", elapsed);
    for line in plan {
        println!("     {line}");
    }
}

// ── The plans ──────────────────────────────────────────────────────────────

#[test]
fn the_transaction_read_searches_an_index_and_never_sorts() {
    let connection = a_real_sized_ledger();

    let started = Instant::now();
    let answered = list_transactions(&connection, OwnedRead { user_id: OWNER.to_owned() })
        .expect("read");
    let elapsed = started.elapsed();
    let plan = plan(&connection, &row::list_owned_sql(), &[OWNER]);
    report("list_transactions", elapsed, answered.answer.transactions.len(), &plan);

    assert_eq!(answered.answer.transactions.len(), TRANSACTIONS);
    let plan = plan.join(" | ");
    // The whole of R-12 for this read. `idx_txn_user_page (user_id, date DESC,
    // id DESC)` IS the query's WHERE and ORDER BY, so there is nothing to sort
    // afterwards; a plan carrying either of the other two words is a bug report
    // rather than a merge.
    assert!(plan.contains("SEARCH transactions USING INDEX idx_txn_user_page"), "{plan}");
    assert!(!plan.contains("SCAN transactions"), "{plan}");
    assert!(!plan.contains("TEMP B-TREE"), "{plan}");
}

#[test]
fn the_tag_pass_walks_the_child_table_once_and_never_sorts() {
    let connection = a_real_sized_ledger();

    let plan = plan(&connection, &row::owned_tags_sql(), &[OWNER]).join(" | ");
    // A SCAN, and the one place in the read family where a scan is the right
    // plan: `transaction_tags` grows with a person's VOCABULARY, not with their
    // ledger, and it is `WITHOUT ROWID` so the walk is already in the order the
    // query asks for. What must not appear is a sort — that would mean the
    // planner drove from `transactions` and had to re-order 50k rows' worth of
    // tags afterwards.
    //
    // The plan names the query's ALIASES (`tt`, `t`), not the tables. That is
    // SQLite reporting what the statement said, and asserting on the alias is
    // asserting on the statement rather than on a name that happens to match.
    assert!(plan.contains("SCAN tt"), "{plan}");
    assert!(plan.contains("SEARCH t USING INDEX sqlite_autoindex_transactions_1"), "{plan}");
    assert!(!plan.contains("TEMP B-TREE"), "{plan}");
}

#[test]
fn the_whole_store_split_read_searches_an_index_and_never_sorts() {
    let connection = a_real_sized_ledger();

    let started = Instant::now();
    let answered = list_transaction_splits(&connection, OwnedRead { user_id: OWNER.to_owned() })
        .expect("read");
    let elapsed = started.elapsed();
    let plan = plan(&connection, &row::split::list_owned_sql(), &[OWNER]);
    report("list_transaction_splits", elapsed, answered.answer.transaction_splits.len(), &plan);

    assert_eq!(answered.answer.transaction_splits.len(), SPLIT_PARENTS * 2);
    let plan = plan.join(" | ");
    // `idx_splits_user_display` exists BECAUSE of this assertion — see the
    // measurement in `crate::verbs::reads`. Without it the plan is a search on
    // `idx_splits_user_cat` plus USE TEMP B-TREE FOR ORDER BY.
    assert!(
        plan.contains("SEARCH transaction_splits USING INDEX idx_splits_user_display"),
        "{plan}"
    );
    assert!(!plan.contains("SCAN transaction_splits"), "{plan}");
    assert!(!plan.contains("TEMP B-TREE"), "{plan}");
}

#[test]
fn one_parents_lines_are_found_by_the_parent_index() {
    let connection = a_real_sized_ledger();

    let parent = transaction_id(7);
    let started = Instant::now();
    let answered = splits_for(
        &connection,
        SplitsFor { user_id: OWNER.to_owned(), transaction_id: parent.clone() },
    )
    .expect("read");
    let elapsed = started.elapsed();
    let plan = plan(&connection, &row::split::list_for_parent_sql(), &[&parent, OWNER]);
    report("splits_for", elapsed, answered.answer.splits.len(), &plan);

    assert_eq!(answered.answer.splits.len(), 2);
    let plan = plan.join(" | ");
    // `idx_splits_user_display` was added for the WHOLE-STORE read above, and it
    // turns out to serve this one better than the index written for it: both of
    // this query's bound columns are the new index's first two, and its last two
    // are this query's ORDER BY. Before it, the plan was
    //
    //   SEARCH … USING INDEX idx_splits_transaction (transaction_id=?)
    //   USE TEMP B-TREE FOR LAST TERM OF ORDER BY
    //
    // — the `id` tie-break sorted inside each run of equal `sort_order`. That
    // was accepted (a run is lines within one parent) and is now simply gone.
    assert!(
        plan.contains("SEARCH transaction_splits USING INDEX idx_splits_user_display"),
        "{plan}"
    );
    assert!(!plan.contains("SCAN transaction_splits"), "{plan}");
    assert!(!plan.contains("TEMP B-TREE"), "{plan}");
}

#[test]
fn the_balance_aggregate_is_answered_out_of_a_covering_index() {
    let connection = a_real_sized_ledger();

    let started = Instant::now();
    let answered = account_balances(&connection, OwnedRead { user_id: OWNER.to_owned() })
        .expect("read");
    let elapsed = started.elapsed();
    let plan = plan(&connection, row::balance::FOR_OWNER_SQL, &[OWNER]);
    report("account_balances", elapsed, answered.answer.account_balances.len(), &plan);

    assert_eq!(answered.answer.account_balances.len(), ACCOUNTS);
    let plan = plan.join(" | ");
    // COVERING is the word that matters: the sum is answered without touching
    // the transactions table at all, which is what `idx_txn_balance_cover
    // (account_id, user_id, amount_minor, id)` carries its last two columns for.
    // The plan names the aliases the statement uses.
    assert!(plan.contains("SEARCH t USING COVERING INDEX idx_txn_balance_cover"), "{plan}");
    assert!(plan.contains("SEARCH a USING INDEX idx_accounts_user"), "{plan}");
    assert!(!plan.contains("SCAN t"), "{plan}");
    // This verb's two temp B-trees ARE asserted — present, and deliberately so.
    // They are what the RPC's SHAPE costs: a LEFT JOIN grouped by the account is
    // 50k joined rows through a sorter, and rewriting it as two correlated
    // subqueries removes both (MEASURED: 16.5ms → 3.4ms, release profile).
    //
    // The port keeps the shape anyway, and the reason is not conservatism.
    // PHASE3-PLAN §3's fourth property is `COUNT(t.id)` and NOT `COUNT(*)`, and
    // that property EXISTS ONLY UNDER A LEFT JOIN — in the subquery form the two
    // spellings are the same expression, so the mutation that must turn a named
    // spec red would stop being a mutation at all. Three properties survive the
    // rewrite and one dies, on a verb whose whole job is to be the independent
    // check on the stored balance. Thirteen milliseconds is not the price of
    // that.
    //
    // Asserting their PRESENCE rather than their absence is what makes the
    // trade-off visible: the day somebody rewrites this query for speed, this
    // line fails and sends them to the paragraph above.
    assert!(plan.contains("USE TEMP B-TREE FOR GROUP BY"), "{plan}");
}

// ── The answers, at this size ──────────────────────────────────────────────

#[test]
fn the_balances_agree_with_the_ledger_the_client_would_sum() {
    let connection = a_real_sized_ledger();

    let balances = account_balances(&connection, OwnedRead { user_id: OWNER.to_owned() })
        .expect("read")
        .answer
        .account_balances;
    let listed = list_transactions(&connection, OwnedRead { user_id: OWNER.to_owned() })
        .expect("read")
        .answer
        .transactions;

    // The two figures the dashboard shows at once: the aggregate that lands
    // first and the client's own sum over the rows that land second. They have
    // to agree to the penny at 50,000 rows, or the page visibly changes its mind
    // about how much money there is. Both are read as decimal STRINGS and
    // compared as minor units through the ledger's own parser — nothing here
    // parses money as a float.
    for balance in &balances {
        let opening: i64 = connection
            .query_row(
                "SELECT initial_balance_minor FROM accounts WHERE id = ?1",
                rusqlite::params![balance.account_id],
                |record| record.get(0),
            )
            .expect("opening");
        let summed: i64 = listed
            .iter()
            .filter(|row| row.account_id == balance.account_id)
            .map(|row| row.amount.minor())
            .sum::<i64>()
            + opening;
        assert_eq!(balance.balance.minor(), summed, "account {}", balance.account_id);
    }

    // And the archived thousand are in BOTH of those sums, which is R-1 stated
    // at the size it would actually be noticed.
    assert_eq!(listed.iter().filter(|row| row.archived).count(), ARCHIVED);
    let counted: i64 = balances.iter().map(|balance| balance.txn_count).sum();
    assert_eq!(counted, i64::try_from(TRANSACTIONS).unwrap());
}

// ── The composite, at the same size ────────────────────────────────────────

#[test]
fn the_whole_boot_costs_about_the_sum_of_its_parts() {
    let mut connection = a_real_sized_ledger();

    let started = Instant::now();
    let boot = load_boot(&mut connection, OwnedRead { user_id: OWNER.to_owned() }).expect("boot");
    let elapsed = started.elapsed();
    let answer = &boot.answer;
    println!(
        "── load_boot: {} accounts · {} categories · {} transactions · {} lines · \
         {} budgets · {} goals in {elapsed:?}",
        answer.accounts.len(),
        answer.categories.len(),
        answer.transactions.len(),
        answer.transaction_splits.len(),
        answer.budgets.len(),
        answer.goals.len(),
    );

    // The whole boot in one call, and every part of it whole. There is no plan
    // to assert here because there is no query here: the six plans are the six
    // reads' own, asserted above against the SQL those reads prepare. What this
    // measures is the composite's own overhead — one BEGIN and one COMMIT
    // around work that was already being done — and the figure recorded in
    // `crate::verbs::load_boot` says what it came to.
    assert_eq!(answer.transactions.len(), TRANSACTIONS);
    assert_eq!(answer.transaction_splits.len(), SPLIT_PARENTS * 2);
    assert_eq!(answer.accounts.len(), ACCOUNTS);
    // Two categories, and neither is a To/From: this ledger's accounts are
    // created inside one transaction with the trigger's root present, so C-3
    // mints one per account — twelve of them — beside the two the fixture
    // names.
    assert_eq!(answer.categories.len(), 2 + ACCOUNTS);
    // Nothing in the fixture plans or saves, and empty is an answer: a boot
    // that invented a budget would be a boot that read something else.
    assert!(answer.budgets.is_empty());
    assert!(answer.goals.is_empty());

    // The transaction is finished, not leaked. At this size a leaked read lock
    // is the difference between an app that opens and an app that cannot write
    // again until it is restarted.
    assert!(connection.is_autocommit());
}
