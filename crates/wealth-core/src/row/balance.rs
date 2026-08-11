//! What every account is actually worth, DERIVED — the money read.
//!
//! This is the port of `account_balances()`
//! (`20260722160000_account_balances_rpc.sql:26-42`), the one function in the
//! cloud schema whose whole purpose is to answer a question the client could
//! answer for itself, faster. The client's answer is a sum over the full
//! transaction set; on a Money-era history that is 50k+ rows arriving in ~52
//! pages, *"measured at 2.7s of a 3.6s boot, with the user watching a skeleton
//! the whole time"*. The aggregate is one round trip.
//!
//! # Why a derived figure lives beside the row mappers
//!
//! Nothing in this file reads a stored row: a balance here is computed. It sits
//! in [`crate::row`] anyway because of what it computes WITH. Every figure it
//! produces leaves through [`Money`], the same one integer-to-decimal conversion
//! every other reader uses, and PHASE3-PLAN D-4's decisive argument is that a
//! second implementation of that conversion is *"one careless line in the
//! numbers on screen"*. A module that put this arithmetic anywhere else would be
//! the beginning of the second one.
//!
//! # THE FOUR PROPERTIES
//!
//! PHASE3-PLAN §3 names four, each of which is a named money bug if got wrong,
//! and each of which has a mutation and a spec that goes red for it. They are
//! listed here, at the SQL, because this is where somebody would break one.
//!
//! **1. It AGGREGATES. It never reads `accounts.balance`.** (R-2.) The stored
//! balance is a cache that every write verb maintains, and B-1 says it must
//! equal `initial_balance + Σ amounts` — but *no constraint in either engine
//! enforces that*, which is exactly why `v_integrity_violations` opens with
//! `balance_identity` (`schema.sql:1578-1586`). The two are siblings and the
//! relationship runs one way: **this verb derives what `verify_integrity`
//! checks.** A port that read `a.balance_minor` would answer with the cache, so
//! a file whose cache had drifted would report the drift AS MONEY on the
//! dashboard, and the one instrument that could have caught it —
//! `verify_integrity` naming `balance_identity` — would still be reporting the
//! violation nobody's figures showed. The whole value of having two independent
//! numbers is that they are independent.
//!
//! **2. The sum spans ALL rows, ARCHIVED INCLUDED.** (R-1, contract rule 82 —
//! THE money bug.) The RPC says it in as many words: *"The sum deliberately
//! spans ALL transactions, archived included: archiving is a view flag (see
//! 20260721130000_soft_archive.sql) and never moves a balance."* An `AND NOT
//! t.archived` here is one token, reads like a tidy-up, and silently removes the
//! whole of a user's archived history from every balance in the app. Note that
//! `balance_identity` does not filter archived either — so a port that filtered
//! here would ALSO make `verify_integrity` report every account with an archived
//! row as broken, which is the sibling check earning its keep.
//!
//! **3. `LEFT JOIN`, so an account with no transactions still answers.** An
//! inner join drops it from the result entirely, and a missing key in the map is
//! not "£0.00" to the caller — `computeAccountBalances` falls back to its own
//! sum for an account the map does not name, so the account would flicker from
//! its opening balance to its opening balance. Worse when it is not zero: a
//! newly opened account whose opening balance is its whole content would show
//! nothing at all until the rows arrived.
//!
//! **4. `COUNT(t.id)`, never `COUNT(*)`.** Under a LEFT JOIN with no matching
//! row, `COUNT(*)` counts the manufactured null row and answers 1. The count is
//! not decoration: it is how a caller tells "this account has no transactions"
//! from "this account's transactions have not arrived yet", and one is a fact
//! while the other is a loading state.
//!
//! # What is local, and declared
//!
//! The cloud RPC takes NO ARGUMENT: it is `SECURITY DEFINER` and gets its
//! identity from the verified JWT through `requesting_user_id()`, *"so there is
//! no parameter to spoof"*. A file has no JWT and no RLS, so the owner arrives
//! in the payload like every other read's — and the reason it is required rather
//! than optional is [`crate::verbs::reads`]'s: a read that named no owner would
//! answer for every login in the file.
//!
//! `COALESCE(a.initial_balance, 0)` is in the cloud's SQL because that column is
//! nullable there. `initial_balance_minor` is `NOT NULL DEFAULT 0` locally
//! (`schema.sql:356`), so the COALESCE would be dead code and is left out; the
//! COALESCE around the SUM stays, because SUM over no rows is NULL in both
//! engines and that is property 3's other half.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;

/// One account's derived balance, in the three keys the RPC returns.
///
/// The names are the CLOUD's — `account_id`, `balance`, `txn_count` — because
/// `toAccountBalanceMap` (`transactionService.ts`) reads exactly those three off
/// the wire, and a local spelling would be a second name for one field.
#[derive(Debug, Clone, Serialize)]
pub struct AccountBalance {
    /// The account this figure belongs to.
    pub account_id: String,
    /// `initial_balance + Σ(transactions.amount)`, as a decimal string.
    pub balance: Money,
    /// How many transactions went into it. Zero is a real answer.
    pub txn_count: i64,
}

/// The statement [`for_owner`] prepares, and the ONLY copy of it.
///
/// Public for the reason [`crate::row::list_owned_sql`] gives, and with more at
/// stake than the others: every one of the four properties above is visible in
/// this string, so a reviewer checking that a port did not quietly filter the
/// archive is reading the same characters the connection is.
pub const FOR_OWNER_SQL: &str = "SELECT a.id,
                a.initial_balance_minor + COALESCE(SUM(t.amount_minor), 0),
                COUNT(t.id)
           FROM accounts a
           LEFT JOIN transactions t
                  ON t.account_id = a.id
                 AND t.user_id = a.user_id
          WHERE a.user_id = ?1
          GROUP BY a.id, a.initial_balance_minor
          ORDER BY a.id";

/// Every account's balance, derived, in one pass.
///
/// # The order is stated, because the cloud states none at all
///
/// The RPC has no `ORDER BY` — it is `GROUP BY a.id, a.initial_balance` and
/// nothing else, so its answer is a SET and the row order is whatever the plan
/// produced. That is fine in the cloud, where the client turns it into a `Map`
/// the moment it arrives. It is not fine here, for the reason every read in this
/// crate states an order: an unrepeatable answer is an unrepeatable spec.
///
/// So `ORDER BY a.id` is this crate's own, stated rather than ported, and `id`
/// alone is enough — it is the group key, so no tie is possible.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails. There is no refusal: an owner
/// with no accounts has an empty list, which is an answer.
pub fn for_owner(connection: &Connection, user_id: &str) -> CoreResult<Vec<AccountBalance>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql, 12 accounts / 50k rows):
    //   SCAN accounts USING INDEX idx_accounts_user (user_id=?)
    //   SEARCH transactions USING COVERING INDEX idx_txn_balance_cover
    //          (account_id=? AND user_id=?)
    //
    // COVERING is the word that matters, and it is why `idx_txn_balance_cover
    // (account_id, user_id, amount_minor, id)` carries two columns it does not
    // filter on: the aggregate is answered out of the index without touching the
    // table at all. DESIGN §4 measured the difference on this very query — 106ms
    // unindexed against 3.46ms with it — and it is the measurement behind
    // *"index design carries ~640× the leverage of transport design"*.
    //
    // The outer SCAN of `accounts` is a scan of one login's accounts, which is a
    // dozen rows, and it is what a LEFT JOIN driven from the left side has to
    // be. Nothing to fix.
    let mut statement = connection.prepare(FOR_OWNER_SQL)?;
    let rows = statement.query_map(params![user_id], |record| {
        Ok(AccountBalance {
            account_id: record.get(0)?,
            balance: Money::from_minor(record.get(1)?),
            txn_count: record.get(2)?,
        })
    })?;

    let mut balances = Vec::new();
    for balance in rows {
        balances.push(balance?);
    }
    Ok(balances)
}
