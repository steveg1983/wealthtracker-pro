//! `apply_investment_prices` — last night's close, written onto the rows it is
//! about.
//!
//! # What it is a port OF
//!
//! `InvestmentService.applyQuotes` (`:330-354`), which is a LOOP: one
//! `.update({current_price, last_updated, updated_at}).eq('user_id', …)
//! .eq('symbol', quote.symbol).select('id')` per quote, summing the rows each one
//! touched.
//!
//! No RPC. PHASE3-PLAN D-2 again, and this is the one verb of the family whose
//! shape genuinely differs from the writer's: the cloud makes N round trips and
//! this makes one transaction. What is compared is what the writer PROMISES —
//! the rows carry the prices and the count says how many were repriced — and the
//! differential spec drives both engines from the same list.
//!
//! # BY SYMBOL, NOT BY ID, AND THAT IS THE FEATURE
//!
//! A quote is about a SECURITY, not about a position. The same fund held in an
//! ISA and a dealing account is two rows and one price, and pricing them
//! separately would mean fetching the same quote twice and leaving the second row
//! stale whenever the first fetch failed. So one quote updates every row of this
//! owner carrying that symbol, which is exactly what the cloud's
//! `.eq('user_id', …).eq('symbol', …)` does.
//!
//! # ONLY TWO COLUMNS MOVE
//!
//! The writer says why: *"Only `current_price` and `last_updated` move: quantity,
//! cost basis and account are the user's data and a price refresh has no business
//! touching them. `market_value` is deliberately NOT written — it is quantity ×
//! price, and a stored copy of a derived number is a copy that goes stale."*
//!
//! `updated_at` moves as well, in both engines, because the row did change.
//!
//! # THE COUNT IS WHAT WAS REPRICED
//!
//! Not the number of quotes handed in. The writer sums `data?.length` per quote
//! precisely *"so the caller can say '3 of 5 updated' rather than claiming
//! success it did not verify"*, and a symbol nobody holds contributes zero. Rows
//! are counted once even if two quotes name the same symbol — the second update
//! writes the second price over the first and reports its own row again — which
//! is the cloud's behaviour too, and is why the port's caller de-duplicates
//! upstream (`fetchQuotes` answers a Map keyed by symbol).
//!
//! # NOTHING IN, NOTHING OUT, AND NOTHING WRITTEN
//!
//! `if (quotes.length === 0) return 0` in the writer, BEFORE it even asks for a
//! client. Reproduced here without opening a transaction, the same statement
//! [`super::create_categories`] makes: an empty list is the ordinary case, not a
//! caller's mistake.
//!
//! # It audits — DIVERGENCE 10, and ONE ENTRY PER ROW
//!
//! A price is a figure, and U-1's question — *"what changed that figure"* — is
//! asked about a portfolio's value more often than about anything else in this
//! product. So each row that moves gets its own `investment/update` entry with
//! `before` and `after`, chained, inside the one transaction. Not one entry per
//! quote: an entry names an ENTITY, and a quote is not one.
//!
//! # No guard, measured
//!
//! An UPDATE of `investments`. `schema.sql` has no trigger on that table.
//! `tests/investment_family.rs` asserts the guard table empty across a sweep.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::CoreResult;
use crate::row::investment;
use crate::scaled::Scaled8;

/// One price, as `/api/quotes` returned it and the app hands it on.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QuoteWriteback {
    /// The security. Matched against `investments.symbol` exactly — the client
    /// upper-cases both, and neither engine folds case.
    pub symbol: String,
    /// What one unit is worth, in the row's own currency's MAJOR unit. Pence are
    /// normalised to pounds at the proxy (`api/_lib/quotes.ts`), never here.
    pub price: Scaled8,
    /// When the exchange printed it, ISO 8601.
    pub as_of: String,
}

/// The command: an owner, and the prices.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApplyInvestmentPrices {
    /// Whose holdings. Required, unlike the patch verbs': a sweep with no owner
    /// would reprice every login in a restored two-login file.
    pub user_id: String,
    /// The prices, in the order the caller fetched them.
    #[serde(default)]
    pub quotes: Vec<QuoteWriteback>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct ApplyInvestmentPricesResult {
    /// The count, in the object shape the harness compares a verb on.
    pub answer: RepricedAnswer,
}

/// How many holdings now carry a new price.
#[derive(Debug, Serialize)]
pub struct RepricedAnswer {
    /// Rows this call moved. Never the number of quotes.
    pub repriced: i64,
}

/// Write fetched prices onto this owner's rows — one SQLite transaction, or none
/// of it.
///
/// # Errors
/// [`crate::error::CoreError::Refused`] for a rule the file enforced (the price
/// bound, the `current_price_e8 >= 0` CHECK); [`crate::error::CoreError::Storage`]
/// for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn apply_investment_prices(
    connection: &mut Connection,
    command: ApplyInvestmentPrices,
) -> CoreResult<ApplyInvestmentPricesResult> {
    // Nothing in, nothing out, and the file is never opened for it.
    if command.quotes.is_empty() {
        return Ok(ApplyInvestmentPricesResult {
            answer: RepricedAnswer { repriced: 0 },
        });
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let mut repriced = 0_usize;

    for quote in &command.quotes {
        // The rows this quote is about, READ FIRST — the audit's `before` needs
        // them, and so does the count, which is the number of rows that really
        // moved rather than the number of quotes that were offered.
        let before = investment::list_of_symbol(&write, &command.user_id, &quote.symbol)?;
        if before.is_empty() {
            continue;
        }

        write.execute(
            "UPDATE investments
                SET current_price_e8 = ?3,
                    last_updated     = ?4,
                    updated_at       = ?5
              WHERE user_id = ?1 AND symbol = ?2",
            params![
                command.user_id,
                quote.symbol,
                quote.price.raw(),
                quote.as_of,
                now,
            ],
        )?;

        for row in &before {
            let after = super::create_investment::read_back(&write, &row.id, &command.user_id)?;
            audit::write(
                &write,
                &command.user_id,
                "investment",
                &row.id,
                Action::Update,
                Some(&super::json_of(row)?),
                Some(&super::json_of(&after)?),
                &now,
            )?;
            repriced = repriced.saturating_add(1);
        }
    }

    write.commit()?;

    Ok(ApplyInvestmentPricesResult {
        answer: RepricedAnswer {
            repriced: super::count(repriced)?,
        },
    })
}

