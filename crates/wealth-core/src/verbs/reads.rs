//! The reads — the questions the app asks a file it has already opened.
//!
//! Six of them here: the accounts, the closed accounts, the categories, the
//! budgets, the goals and the suggestion dismissals. They write nothing, they
//! audit nothing, and they open no transaction, for the reason
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
//! The one thing that looks like a filter and is not: closed accounts are a
//! SECOND VERB rather than a flag on the first. Two questions, two names, and a
//! call site that cannot be misread.
//!
//! # The order is part of the answer, and the last key is this crate's own
//!
//! Each read takes its ORDER BY from the query it is a port of:
//!
//! ```text
//! list_accounts               created_at            accountService.getAccounts
//! list_closed_accounts        created_at            accountService.getClosedAccounts
//! list_categories             level, name           planningService.ensureCategories
//! list_budgets                created_at            planningService.getBudgets
//! list_goals                  created_at            planningService.getGoals
//! list_suggestion_dismissals  dismissed_at DESC     suggestionDismissalService.list
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
//! exists and why slice 16's reads must be measured again rather than assumed
//! to be like these.
//!
//! # What is deliberately not here yet
//!
//! `list_transactions`, `list_transaction_splits`, `splits_for` and
//! `account_balances` are the next slice's, and they are separated from these
//! six by more than a queue: they are the reads whose plans have to be argued,
//! and `account_balances` carries four properties that are each a named money
//! bug if got wrong (PHASE3-PLAN §3). `load_boot` composes six reads into one
//! transaction after that, and `collect_backup` is the backup group's.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;
use crate::row::account::{self, ListedAccount};
use crate::row::budget::{self, ListedBudget};
use crate::row::category::{self, CategoryRow};
use crate::row::dismissal::{self, DismissalRow};
use crate::row::goal::{self, GoalRow};

/// The payload every read in this slice takes: one owner, and nothing else.
///
/// One type for six verbs because it is one argument for six verbs, and six
/// identical struct definitions would be six places for the next person to add
/// a filter to. The VERBS stay six — the enum's exhaustive dispatch is over
/// variants, not over payload types.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OwnedRead {
    /// Whose rows. Required — see the module docs.
    pub user_id: String,
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
