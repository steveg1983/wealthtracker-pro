//! The reads — the questions the app asks a file it has already opened.
//!
//! Ten of them here. Six are light — the accounts, the closed accounts, the
//! categories, the budgets, the goals and the suggestion dismissals — and four
//! are the ones that run over a person's whole history: the transactions, every
//! split line, one parent's split lines, and the balances. They write nothing,
//! they audit nothing, and they open no transaction, for the reason
//! [`super::user_financial_data_is_empty`] gives: there is nothing to be atomic
//! about, and a log line recording that somebody asked a question is noise in a
//! log whose whole value is that every line in it is a change.
//!
//! # Why a read is a verb here at all
//!
//! PHASE3-PLAN D-4 decides it, and the decisive reason is money. `money.rs`'s
//! [`crate::money::Money::to_decimal_string`] is the ONE place minor units
//! become the text the app parses. A read implemented anywhere else — a query
//! layer beside the command surface, a `SELECT` in the shell — is a second
//! implementation of that conversion, and *"a second layer's `minor as f64 /
//! 100.0` is one careless line in the numbers on screen"*. Three lesser reasons
//! stand behind it: the row mappers already exist ([`crate::row`]), `db::open`'s
//! read-back assertions would have a second opener to be forgotten by, and a
//! query layer has no differential oracle — `scripts/local-sqlite/verbs.mjs`
//! drives THIS surface and nothing else.
//!
//! # Every read is scoped to one owner, and the owner is REQUIRED
//!
//! The write verbs take `user_id` as an `Option`, because the RPCs they port
//! spell their guard `p_user_id IS NULL OR user_id = p_user_id` and a NULL
//! stands it down. A read has no such shape to port: every cloud read is
//! `.eq('user_id', userId)` with an id `DataService` resolved on the same tick
//! and refuses to proceed without.
//!
//! Locally the difference matters more, not less. There is no RLS to narrow the
//! answer afterwards, and a file CAN hold more than one login's rows — a backup
//! restored from an account that had two, or the harness's own second user. A
//! read with the owner left off would answer with all of them. So it is a
//! `String` and not an `Option<String>`, and the refusal for leaving it out is
//! serde's, before a connection is touched.
//!
//! # None of them takes a filter
//!
//! `dataPort.ts` states it: *"None of them take a filter: the app loads its
//! ledger and does its own filtering in memory, and pretending otherwise here
//! would invent a query language that no implementation actually has."* That is
//! also §6.4's absence from the other side — a verb that took a predicate would
//! be a verb that took SQL eventually.
//!
//! Two things look like a filter and are not. Closed accounts are a SECOND VERB
//! rather than a flag on the first: two questions, two names, and a call site
//! that cannot be misread. And [`splits_for`] takes a `transaction_id`, which is
//! not a predicate over a set but the NAME OF A PARENT — the seam's own `…For`
//! suffix, which exists so that `listTransactionSplits` (all of them) and
//! `listTransactionSplitsFor` (one row's) are *"told apart by more than their
//! arity at the call site"*.
//!
//! # ARCHIVED ROWS ARE IN BOTH ANSWERS, AND THAT IS THE POINT
//!
//! Two of the four verbs here touch the archive, and the trap is that the right
//! answer is the SAME on both sides while the instinct is different:
//!
//! * [`list_transactions`] returns archived rows, with the flag as a column. The
//!   boot query filters on `user_id` and nothing else; the register hides an
//!   archived row in memory.
//! * [`account_balances`] COUNTS archived rows. The RPC says so in its own
//!   comment — *"archiving is a view flag and never moves a balance"*.
//!
//! R-1 is the second of those going wrong, and contract rule 82 is the test that
//! catches it. But a port that "fixed" the FIRST one instead — filtering the
//! list — would produce the same disagreement from the other end, because the
//! client sums the list it was given. Two figures, one ledger: the only safe
//! answer is that neither read has heard of the archive.
//!
//! # The order is part of the answer, and the last key is this crate's own
//!
//! Each read takes its ORDER BY from the query it is a port of:
//!
//! ```text
//! list_accounts               created_at              accountService.getAccounts
//! list_closed_accounts        created_at              accountService.getClosedAccounts
//! list_categories             level, name             planningService.ensureCategories
//! list_budgets                created_at              planningService.getBudgets
//! list_goals                  created_at              planningService.getGoals
//! list_suggestion_dismissals  dismissed_at DESC       suggestionDismissalService.list
//! list_transactions           date DESC, id DESC      transactionService.fetchTransactionPage
//! list_transaction_splits     transaction_id, sort_order
//!                                                     transactionService.getAllTransactionSplits
//! splits_for                  sort_order              transactionService.getTransactionSplits
//! account_balances            (none — see below)      account_balances() RPC
//! ```
//!
//! and then adds `id` behind it, which **is not a port of anything**. The cloud
//! states no tie-break, so its answer below its last key is an artefact of a
//! query plan — the same thing `apply_category_to_uncategorized`'s payee-memory
//! ordering found, and the same answer: state one, and say out loud that it is
//! stated rather than ported.
//!
//! It is stated because a list that is drawn is a list that gets re-drawn. Two
//! accounts created in the same second are ordered by nothing at all otherwise,
//! and "nothing at all" in SQLite means whatever the sorter did last time —
//! which is a visible reshuffle on a page nobody touched, and an unrepeatable
//! differential spec.
//!
//! **Two of this slice's four are exceptions, in opposite directions.**
//!
//! [`list_transactions`] is the only read in the crate whose tie-break needed no
//! decision: the cloud already states `.order('id', {ascending: false})` and
//! calls it, in its own comment, a *"stable tiebreak for paging"*. Fifty-two
//! pages of an unstably-ordered query hand the same row over twice and lose
//! another, so the cloud had to settle what the others could leave open. Its
//! whole ORDER BY is ported, tie-break included, and nothing here is this
//! crate's own.
//!
//! [`account_balances`] is the other end: the RPC states NO order whatsoever —
//! `GROUP BY` and nothing after it — because the client turns the answer into a
//! `Map` the moment it lands. `ORDER BY a.id` is therefore entirely this crate's
//! own, and it is enough by itself, `id` being the group key. It also changes
//! what the differential harness may do: where the other reads compare an
//! ordered list against an ordered list, the oracle for this one has to impose
//! an order on a set to compare it at all, and says so.
//!
//! # EXPLAIN QUERY PLAN, measured against `scripts/local-sqlite/schema.sql`
//!
//! ```text
//! list_accounts              SEARCH accounts USING INDEX idx_accounts_user (user_id=?)
//! list_closed_accounts       SEARCH accounts USING INDEX idx_accounts_user (user_id=?)
//! list_categories            SEARCH categories USING INDEX idx_categories_user (user_id=?)
//! list_budgets               SEARCH budgets USING INDEX idx_budgets_user (user_id=?)
//! list_goals                 SEARCH goals USING INDEX idx_goals_user (user_id=?)
//! list_suggestion_dismissals SEARCH suggestion_dismissals USING INDEX
//!                                   sqlite_autoindex_suggestion_dismissals_2 (user_id=?)
//!   its subjects             SEARCH suggestion_dismissal_subjects USING PRIMARY KEY
//!                                   (dismissal_id=?)
//! ```
//!
//! Every one is a SEARCH. DESIGN §4's rule is that a plan saying SCAN is a bug
//! report rather than a merge, and the measurement behind it is 106ms unindexed
//! against 3.46ms indexed on the transactions table — *"index design carries
//! ~640× the leverage of transport design"*.
//!
//! **Each of the six also reports `USE TEMP B-TREE FOR ORDER BY`, and that is
//! accepted rather than overlooked.** The sort happens after the index has cut
//! the table down to one owner's rows, and on these five tables that is tens to
//! low hundreds — a person has a dozen accounts, a few hundred categories, a
//! handful of budgets and goals. Adding `(user_id, created_at, id)` covering
//! indexes to remove it would trade write cost and four more indexes to keep in
//! step with the cloud for a sort of fifty rows. What would change the answer:
//! a read over `transactions` or `transaction_splits`, where the row counts are
//! five orders of magnitude larger — which is why `idx_txn_balance_cover`
//! exists, and it is why the four below were MEASURED rather than assumed to be
//! like these.
//!
//! # THE HEAVY FOUR, MEASURED
//!
//! `crates/wealth-core/tests/reads_at_scale.rs` builds a ledger the size of a
//! real one — 50,000 transactions across 12 accounts, 6,000 tags, 8,000 split
//! lines, 1,000 of the transactions archived — and asserts every plan below. It
//! is a test rather than a note because a note goes stale in silence, and it is
//! R-12 made real: *"read verb full-scans → EXPLAIN assertion red"*.
//!
//! ```text
//! list_transactions       SEARCH transactions USING INDEX idx_txn_user_page
//!                                (user_id=?)                    53ms / 175ms
//!   its tag pass          SCAN tt
//!                         SEARCH t USING INDEX
//!                                sqlite_autoindex_transactions_1 (id=?)
//! list_transaction_splits SEARCH transaction_splits USING INDEX
//!                                idx_splits_user_display (user_id=?)
//!                                                              4.6ms / 12.8ms
//! splits_for              SEARCH transaction_splits USING INDEX
//!                                idx_splits_user_display
//!                                (user_id=? AND transaction_id=?)
//!                                                              0.9ms / 1.8ms
//! account_balances        SEARCH a USING INDEX idx_accounts_user (user_id=?)
//!                         SEARCH t USING COVERING INDEX idx_txn_balance_cover
//!                                (account_id=? AND user_id=?) LEFT-JOIN
//!                         USE TEMP B-TREE FOR GROUP BY
//!                         USE TEMP B-TREE FOR ORDER BY        18.7ms / 34.8ms
//! ```
//!
//! Times are whole verbs — SQL, mapping, `Money` rendering and all — as
//! release / debug, on the author's machine. They are recorded, not asserted: a
//! time bound is a bound on whichever machine runs it, and a flaky test teaches
//! people to re-run tests until they pass. Three of the four are boot reads
//! (`splits_for` is asked per row, when a split is opened), and together they
//! come to ~76ms of release time — against the 2.7s of paged fetches the cloud
//! RPC's own commentary measured for the transactions alone.
//!
//! **Three things in that table were decided by the measurement.**
//!
//! *A new index, `idx_splits_user_display (user_id, transaction_id, sort_order,
//! id)`.* Without it, `list_transaction_splits` plans as `SCAN
//! transaction_splits USING INDEX idx_splits_transaction` plus `USE TEMP B-TREE
//! FOR LAST TERM OF ORDER BY` (8.9ms against 4.5ms, debug). The 2× is the lesser
//! half: the word is SCAN, so the read walks every login's lines and discards
//! the ones that are not the caller's, and a restored two-login file is exactly
//! what the required owner exists for. The reasoning is written at the index in
//! `schema.sql`. It also, unplanned, took the temp B-tree off `splits_for`.
//!
//! *An index NOT added.* `accounts(user_id, id)` was tried, to see whether
//! ordering the outer loop of `account_balances` by the group key would let
//! SQLite group without a sorter. MEASURED: 33.9ms → 32.9ms, which is noise.
//! Not added — an index that buys nothing is write cost and one more thing to
//! keep in step with the cloud.
//!
//! *A faster query NOT adopted.* `account_balances`'s two temp B-trees are what
//! its SHAPE costs: a `LEFT JOIN` grouped per account puts 50k joined rows
//! through a sorter, and two correlated subqueries do the same work in 3.4ms
//! against 16.5ms (release). The port keeps the join anyway, and not out of
//! conservatism: PHASE3-PLAN §3's fourth property is `COUNT(t.id)` and **not**
//! `COUNT(*)`, and that property exists ONLY under a LEFT JOIN — rewritten, the
//! two spellings become the same expression and the mutation that has to turn a
//! named spec red stops being a mutation. Three properties survive the rewrite
//! and one dies, on the one verb whose job is to be the independent check on a
//! stored balance. Thirteen milliseconds is not the price of that. The test
//! asserts the temp B-trees are PRESENT, so the day somebody rewrites this for
//! speed they are sent to this paragraph.
//!
//! # The composite is next door, and it is the exception to two of these rules
//!
//! [`super::load_boot`] answers six of these ten at once — the accounts, the
//! categories, the ledger, its lines, the budgets and the goals — and it is in
//! its own module because it breaks this one's opening claim on purpose: it
//! DOES open a transaction, a deferred read one, so that its six answers are
//! one snapshot of one file rather than six snapshots of a file somebody else
//! may be writing to in between. It also carries no plan of its own, because it
//! runs no query of its own: it calls the same [`crate::row`] functions the six
//! verbs below call, which is what keeps their ordering contracts true through
//! it (R-5) and what stops a second copy of any query from existing.
//!
//! # What is still not here
//!
//! `collect_backup`, the backup group's — every table whole, in
//! `BACKUP_ENTITIES` order.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;
use crate::row::account::{self, ListedAccount};
use crate::row::balance::{self, AccountBalance};
use crate::row::budget::{self, ListedBudget};
use crate::row::category::{self, CategoryRow};
use crate::row::dismissal::{self, DismissalRow};
use crate::row::goal::{self, GoalRow};
use crate::row::split::{self, ListedSplit};
use crate::row::{self as transaction, ListedTransaction};

/// The payload every read but [`splits_for`] takes: one owner, and nothing
/// else. Nine of the ten here, and [`super::load_boot`] makes it ten.
///
/// One type for ten verbs because it is one argument for ten verbs, and ten
/// identical struct definitions would be ten places for the next person to add
/// a filter to. The VERBS stay ten — the enum's exhaustive dispatch is over
/// variants, not over payload types.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OwnedRead {
    /// Whose rows. Required — see the module docs.
    pub user_id: String,
}

/// [`splits_for`]'s payload: an owner, and the parent whose lines are wanted.
///
/// The tenth read, and the only one that names anything narrower than a login.
/// A second field rather than a second use of [`OwnedRead`] plus a filter,
/// because `transaction_id` is not a predicate the caller composed — it is the
/// subject of the question, and `deny_unknown_fields` is what keeps it the only
/// one that can be sent.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SplitsFor {
    /// Whose lines. Required, and locally it is the ONLY gate — see the verb.
    pub user_id: String,
    /// The split parent.
    pub transaction_id: String,
}

/// A read's answer, in the shape the differential harness compares on.
///
/// `answer` rather than the bare list, because `lib/verb-sqlite.mjs` reads
/// `result.transaction ?? result.answer` and a verb decides what it is
/// comparable ON. The named field inside it (`accounts`, `categories`, …) is
/// what makes a spec's expectation readable as the question it answers.
#[derive(Debug, Serialize)]
pub struct Answered<T: Serialize> {
    /// The projection both engines are compared on.
    pub answer: T,
}

/// The accounts a login can file a transaction against.
#[derive(Debug, Serialize)]
pub struct Accounts {
    /// Open accounts, oldest first.
    pub accounts: Vec<ListedAccount>,
}

/// The accounts a login has closed.
#[derive(Debug, Serialize)]
pub struct ClosedAccounts {
    /// Closed accounts, oldest first.
    pub closed_accounts: Vec<ListedAccount>,
}

/// The names rows are filed under.
#[derive(Debug, Serialize)]
pub struct Categories {
    /// Every category, by level then name.
    pub categories: Vec<CategoryRow>,
}

/// The limits a login has set.
#[derive(Debug, Serialize)]
pub struct Budgets {
    /// Every budget, oldest first, paused ones included.
    pub budgets: Vec<ListedBudget>,
}

/// What a login is saving towards.
#[derive(Debug, Serialize)]
pub struct Goals {
    /// Every goal, oldest first, finished ones included.
    pub goals: Vec<GoalRow>,
}

/// What a login has told the sweeps to stop offering.
#[derive(Debug, Serialize)]
pub struct SuggestionDismissals {
    /// Every dismissal, newest first, each with its subjects in role order.
    pub suggestion_dismissals: Vec<DismissalRow>,
}

/// The ledger itself.
#[derive(Debug, Serialize)]
pub struct Transactions {
    /// Every transaction, newest first, ARCHIVED ONES INCLUDED.
    pub transactions: Vec<ListedTransaction>,
}

/// Every split line in the file, for the reports that aggregate by category.
#[derive(Debug, Serialize)]
pub struct TransactionSplits {
    /// Every line this login owns, parent by parent, in display order.
    pub transaction_splits: Vec<ListedSplit>,
}

/// One transaction's split lines.
#[derive(Debug, Serialize)]
pub struct Splits {
    /// The parent's lines in display order — empty when it is not a split.
    pub splits: Vec<ListedSplit>,
}

/// What every account is worth, derived.
#[derive(Debug, Serialize)]
pub struct AccountBalances {
    /// One entry per account, by id, including accounts with no transactions.
    pub account_balances: Vec<AccountBalance>,
}

/// Every open account this login has.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails. This verb has no
/// refusal: an owner with no accounts has an empty list, which is an answer.
#[allow(clippy::needless_pass_by_value)]
pub fn list_accounts(
    connection: &Connection,
    command: OwnedRead,
) -> CoreResult<Answered<Accounts>> {
    Ok(Answered {
        answer: Accounts { accounts: account::list_open(connection, &command.user_id)? },
    })
}

/// Every closed account this login has.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn list_closed_accounts(
    connection: &Connection,
    command: OwnedRead,
) -> CoreResult<Answered<ClosedAccounts>> {
    Ok(Answered {
        answer: ClosedAccounts {
            closed_accounts: account::list_closed(connection, &command.user_id)?,
        },
    })
}

/// Every category this login has, hidden ones included.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn list_categories(
    connection: &Connection,
    command: OwnedRead,
) -> CoreResult<Answered<Categories>> {
    Ok(Answered {
        answer: Categories { categories: category::list_all(connection, &command.user_id)? },
    })
}

/// Every budget this login has, paused ones included.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn list_budgets(connection: &Connection, command: OwnedRead) -> CoreResult<Answered<Budgets>> {
    Ok(Answered {
        answer: Budgets { budgets: budget::list_all(connection, &command.user_id)? },
    })
}

/// Every goal this login has, finished ones included.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn list_goals(connection: &Connection, command: OwnedRead) -> CoreResult<Answered<Goals>> {
    Ok(Answered {
        answer: Goals { goals: goal::list_all(connection, &command.user_id)? },
    })
}

/// Every suggestion this login has refused.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn list_suggestion_dismissals(
    connection: &Connection,
    command: OwnedRead,
) -> CoreResult<Answered<SuggestionDismissals>> {
    Ok(Answered {
        answer: SuggestionDismissals {
            suggestion_dismissals: dismissal::list_all(connection, &command.user_id)?,
        },
    })
}

/// Every transaction this login has, newest first, **archived ones included**.
///
/// The port of the query the signed-in boot actually runs. See
/// [`crate::row::ListedTransaction`] for the column set and the one column this
/// file has not got, and this module's header for why the archive is not
/// filtered here or anywhere else.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn list_transactions(
    connection: &Connection,
    command: OwnedRead,
) -> CoreResult<Answered<Transactions>> {
    Ok(Answered {
        answer: Transactions {
            transactions: transaction::list_owned(connection, &command.user_id)?,
        },
    })
}

/// Every split line this login owns, parent by parent, in display order.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn list_transaction_splits(
    connection: &Connection,
    command: OwnedRead,
) -> CoreResult<Answered<TransactionSplits>> {
    Ok(Answered {
        answer: TransactionSplits {
            transaction_splits: split::list_owned(connection, &command.user_id)?,
        },
    })
}

/// One transaction's split lines, in display order.
///
/// # An unsplit row and a stranger's row answer the same way
///
/// Both are `[]`, and that is deliberate rather than lazy. The cloud's query is
/// `.eq('transaction_id', …)` under RLS: a row belonging to somebody else
/// matches the filter and is then removed by the policy, so the caller gets an
/// empty array and cannot tell it from a row with no lines. Answering
/// differently here would tell a caller that an id they cannot see exists — the
/// same reasoning [`crate::row::account::read_owned`] gives for not
/// distinguishing "no such account" from "not your account".
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn splits_for(connection: &Connection, command: SplitsFor) -> CoreResult<Answered<Splits>> {
    Ok(Answered {
        answer: Splits {
            splits: split::list_for_parent(connection, &command.user_id, &command.transaction_id)?,
        },
    })
}

/// Every account's balance, DERIVED — never read off `accounts.balance`.
///
/// The port of `account_balances()`. Its four properties, each of which is a
/// named money bug if got wrong, are documented at the SQL in
/// [`crate::row::balance`], because that is where somebody would break one.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails.
#[allow(clippy::needless_pass_by_value)]
pub fn account_balances(
    connection: &Connection,
    command: OwnedRead,
) -> CoreResult<Answered<AccountBalances>> {
    Ok(Answered {
        answer: AccountBalances {
            account_balances: balance::for_owner(connection, &command.user_id)?,
        },
    })
}
