//! A holding, as the Investments page lists it — and as an audit entry records
//! it.
//!
//! # The projection is the CLOUD's `SELECTED_COLUMNS`, verbatim
//!
//! `services/api/investmentService.ts` names thirteen columns in one string
//! literal and says why it must stay one line (*"supabase-js parses this at the
//! type level to shape the row it returns, and a computed string collapses every
//! result to `GenericStringError`"*). [`COLUMNS`] below is that list, plus
//! `user_id`, which every other module under [`crate::row`] carries for the same
//! reason: an audit entry's `before`/`after` has to say whose row it was.
//!
//! Two columns of the table are deliberately NOT in it, and each absence is a
//! decision rather than an oversight:
//!
//! * **`market_value_minor`.** `schema.sql` has the column and anticipated
//!   storing it. Nothing writes it and nothing reads it, because
//!   `investmentService.ts` settled the question first and settled it the other
//!   way: *"`market_value` is deliberately NOT written — it is quantity × price,
//!   and a stored copy of a derived number is a copy that goes stale. The screen
//!   computes it, so a holding can never display a value its own price
//!   contradicts."* A file that stored one would be the only engine of the three
//!   with a second opinion about the same figure. The arithmetic still exists —
//!   [`crate::scaled::market_value_minor`] — and it is used for `cost_basis`,
//!   which is not derived from a price that moves.
//! * **`exchange`.** A column in both schemas that neither engine's client has
//!   ever written or read. Adding it to the projection would put a key on the
//!   wire that the app's `InvestmentHolding` has no field for.
//!
//! # THREE SCALES IN ONE ROW, AND THAT IS THE WHOLE POINT
//!
//! `quantity`, `current_price` and `purchase_price` are [`Scaled8`] — eight
//! decimal places, because a fund unit price is a RATE and rounding a rate
//! before multiplying it by a quantity is how a portfolio comes to disagree with
//! the broker. `cost_basis` is [`Money`] — two places, because what a position
//! cost is an amount that was settled in pennies.
//!
//! A row that used one type for all three would make `quantity + cost_basis`
//! compile. See [`crate::scaled`] for the argument in full.
//!
//! # `last_updated` is a TIMESTAMP and `purchase_date` is a DAY
//!
//! Carried as they are stored, and the difference is real: a price was taken
//! from an exchange at an instant, and a purchase happened on a date somebody
//! wrote on a contract note. The far side reads each with the reader that fits
//! it — `values.ts`'s `instant` and `day` — and this crate does not convert
//! either.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;
use crate::scaled::Scaled8;

/// The fourteen columns, in the order [`row_of`] reads them.
///
/// One string, because four readers use it — the list, the read-back after a
/// create, the read-back after an update, and the price sweep's own — and a
/// column added to one copy and not the others is read at the wrong index by the
/// ones that were not edited.
const COLUMNS: &str = "id, user_id, account_id, symbol, name, asset_type, currency,
        quantity_e8, cost_basis_minor, current_price_e8, purchase_date,
        purchase_price_e8, last_updated, notes";

/// A holding as stored, in the serialised order.
#[derive(Debug, Clone, Serialize)]
pub struct InvestmentRow {
    /// Primary key.
    pub id: String,
    /// Owner.
    pub user_id: String,
    /// The investment account it sits in. Nullable in both schemas; every row
    /// the app writes names one.
    pub account_id: Option<String>,
    /// The ticker, upper-cased by the CLIENT before it ever gets here — see
    /// [`crate::verbs::create_investment`] on why the crate does not do it.
    pub symbol: String,
    /// As shown.
    pub name: String,
    /// One of the eight `investments_asset_type_check` allows.
    pub asset_type: String,
    /// Three letters. What the position is priced in.
    pub currency: String,
    /// How many units. Fractional to eight places.
    pub quantity: Scaled8,
    /// What the whole position cost — MONEY, and derived from the two figures
    /// beside it rather than stated (see [`crate::verbs::create_investment`]).
    pub cost_basis: Money,
    /// Last known price of ONE unit, in `currency`'s major unit. `None` means
    /// "never priced", which the UI must say rather than show as zero.
    pub current_price: Option<Scaled8>,
    /// `YYYY-MM-DD`, when there is one.
    pub purchase_date: Option<String>,
    /// What one unit cost when it was bought.
    pub purchase_price: Option<Scaled8>,
    /// When the price was taken from the exchange. `None` when never priced.
    pub last_updated: Option<String>,
    /// Free text.
    pub notes: Option<String>,
}

/// The statement [`list_all`] prepares.
///
/// Public for the reason [`crate::row::list_owned_sql`] gives: a plan assertion
/// written against a hand-copied query is an assertion about the copy. It takes
/// no argument, touches no connection and returns a constant, so it is not the
/// door DESIGN §6.4 closes.
#[must_use]
pub fn list_all_sql() -> String {
    format!(
        "SELECT {COLUMNS}
           FROM investments
          WHERE user_id = ?1
          ORDER BY symbol, id"
    )
}

/// The statement [`list_of_symbol`] prepares. Public for the same reason: the
/// price sweep asks it once per quote, so its plan is the one that decides
/// whether a fifty-symbol sweep walks a portfolio fifty times.
#[must_use]
pub fn list_of_symbol_sql() -> String {
    format!(
        "SELECT {COLUMNS}
           FROM investments
          WHERE user_id = ?1 AND symbol = ?2
          ORDER BY id"
    )
}

/// Every holding this login has, by symbol.
///
/// The port of `InvestmentService.list`: `.select(SELECTED_COLUMNS)`,
/// `.eq('user_id', …)`, `.order('symbol', { ascending: true })` — and then `id`
/// behind it, which is this crate's own tie-break for the reason
/// [`crate::verbs::reads`] gives about every other list: two holdings of the
/// same symbol (the same fund in two accounts is the ordinary case) are ordered
/// by nothing at all otherwise, and "nothing at all" in SQLite means whatever
/// the sorter did last time.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_all(connection: &Connection, user_id: &str) -> CoreResult<Vec<InvestmentRow>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql, asserted in
    // tests/investment_family.rs):
    //   SEARCH investments USING INDEX idx_investments_symbol (user_id=?)
    //   USE TEMP B-TREE FOR LAST TERM OF ORDER BY
    //
    // The LAST TERM, not the whole ORDER BY, and the difference is the index:
    // `idx_investments_symbol` is `(user_id, symbol)`, so it delivers this
    // owner's rows already in symbol order and SQLite sorts only the `id`
    // tie-break. That is accepted on `crate::verbs::reads`'s own terms for the
    // other light reads — the sort runs over one portfolio, which is tens of
    // rows, and a fourth column on this index would trade write cost on every
    // price sweep to remove it.
    //
    // No new index was added for this verb: schema.sql had `(user_id, symbol)`
    // before it existed, which is also why the ORDER BY leads with `symbol`
    // rather than with `created_at` the way the budgets and goals reads do.
    let mut statement = connection.prepare(&list_all_sql())?;
    let rows = statement.query_map(params![user_id], row_of)?;

    let mut holdings = Vec::new();
    for holding in rows {
        holdings.push(holding?);
    }
    Ok(holdings)
}

/// One owner's holdings of ONE symbol, by id.
///
/// The port of `InvestmentService.applyQuotes`'s per-quote
/// `.eq('user_id', …).eq('symbol', …)`. A separate function rather than a filter
/// over [`list_all`] because the difference is the INDEX: this is what
/// `idx_investments_symbol (user_id, symbol)` was built as a composite for, and
/// a Rust-side filter over every holding would answer the same rows by walking a
/// portfolio per quote — which on a fifty-symbol sweep is fifty full reads.
///
/// EXPLAIN QUERY PLAN (measured against schema.sql, asserted in
/// `tests/investment_family.rs`):
///   SEARCH investments USING INDEX idx_investments_symbol (user_id=? AND symbol=?)
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_of_symbol(
    connection: &Connection,
    user_id: &str,
    symbol: &str,
) -> CoreResult<Vec<InvestmentRow>> {
    let mut statement = connection.prepare(&list_of_symbol_sql())?;
    let rows = statement.query_map(params![user_id, symbol], row_of)?;

    let mut holdings = Vec::new();
    for holding in rows {
        holdings.push(holding?);
    }
    Ok(holdings)
}

/// Read one holding, scoped to an owner.
///
/// The `.eq('id', …).eq('user_id', …)` pair every one of `InvestmentService`'s
/// writes carries, and `None` is the port of `.maybeSingle()` finding nothing.
/// An absent owner applies no ownership clause — the decision
/// [`crate::verbs::update_transaction`] documents at length.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_owned(
    connection: &Connection,
    id: &str,
    user_id: Option<&str>,
) -> CoreResult<Option<InvestmentRow>> {
    Ok(connection
        .query_row(
            &format!(
                "SELECT {COLUMNS}
                   FROM investments
                  WHERE id = ?1
                    AND (?2 IS NULL OR user_id = ?2)"
            ),
            params![id, user_id],
            row_of,
        )
        .optional()?)
}

/// One record of that fourteen-column SELECT as an [`InvestmentRow`].
fn row_of(record: &rusqlite::Row<'_>) -> rusqlite::Result<InvestmentRow> {
    Ok(InvestmentRow {
        id: record.get(0)?,
        user_id: record.get(1)?,
        account_id: record.get(2)?,
        symbol: record.get(3)?,
        name: record.get(4)?,
        asset_type: record.get(5)?,
        currency: record.get(6)?,
        quantity: Scaled8::from_raw(record.get(7)?),
        cost_basis: Money::from_minor(record.get(8)?),
        current_price: record.get::<_, Option<i64>>(9)?.map(Scaled8::from_raw),
        purchase_date: record.get(10)?,
        purchase_price: record.get::<_, Option<i64>>(11)?.map(Scaled8::from_raw),
        last_updated: record.get(12)?,
        notes: record.get(13)?,
    })
}
