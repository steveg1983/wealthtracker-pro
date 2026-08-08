//! TS-B1 / TS-B2 / TS-B3 — whether an imported statement's closing balance may
//! be written onto an account's Bank Balance, and what exactly gets written.
//!
//! Port of `src/utils/statementBankBalance.ts`.
//!
//! # What it will never write, and why that is a type and not a promise
//!
//! `balance`. That is the ledger — `initial_balance` plus every transaction,
//! moved only by verbs that also write the row justifying the movement (B-2).
//! The statement's transactions have already moved it by the time this runs, so
//! writing the statement's total on top would count the same money twice.
//!
//! The TypeScript makes that structural with a type:
//!
//! ```ts
//! export type BankBalanceRecord = Pick<Account, 'bankBalance' | 'bankBalanceDate'>;
//! ```
//!
//! A `Pick` of two fields cannot express a third, so `updates.balance = …` is
//! not a mistake the compiler permits — it is a sentence that does not
//! typecheck. [`BankBalanceUpdates`] reproduces that here and goes one further:
//! its two fields are **private** and its only constructor takes exactly a
//! [`Money`] and a day, so no code in this crate — not just no code outside it —
//! can put a third value in one. `bank_balance` is a REFERENCE the app compares
//! against and never adds to, which is also why a wrong one is safe: it shows up
//! as a visible Difference, not as money that changed.
//!
//! # The sign is the file's own
//!
//! Nothing here normalises a sign. OFX signs a statement's balance in the same
//! frame as the transactions printed beside it, so a card with money owing
//! closes on a negative ledger balance — the same way this app stores a
//! liability. TrueLayer's card API is the opposite and `cardNormalization`
//! negates it there; doing that here would turn a correctly-signed debt into an
//! asset. That is TS-I2, and it is a rule about NOT applying another rule, which
//! is the easiest kind to lose in a port. There is no negation in this file.
//!
//! # Staleness orders TEXT, and the day test is a SHAPE test
//!
//! Two things about `is_iso_day` that look like oversights and are not:
//!
//! * It tests the shape `dddd-dd-dd` and not the calendar, so `2026-13-45`
//!   passes. That is copied deliberately: the schema's own column check is
//!   `bank_balance_date LIKE '____-__-__'` (`schema.sql:357`), so the file
//!   would accept the same value, and a port that refused it would refuse a
//!   write the storage permits.
//! * The comparison is `recorded > statement` on the STRINGS. For this shape
//!   lexicographic order is chronological order, which is the whole reason the
//!   column holds a day in this form.
//!
//! Equal days are allowed to write, so re-importing the same statement settles
//! on the same figure instead of depending on the order files were opened in.
//! A recorded balance with no recorded date cannot be compared, so it is written
//! over: the alternative is refusing forever on accounts whose balance predates
//! the date column.
//!
//! # Deliberately not ported
//!
//! `formatStatementDay` ('2026-03-31' → '31 Mar 2026') and `todayIsoDay` decide
//! what is SHOWN, which is the other side of the dividing line. Both carry a
//! timezone argument worth keeping in TypeScript's own tests, and neither
//! decides what is written.

use serde::{Deserialize, Serialize};

use crate::money::Money;

/// A statement's closing balance and the day it is true for.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StatementBalance {
    /// The closing figure, signed as the file signs it.
    pub amount: Money,
    /// Calendar day, `YYYY-MM-DD`.
    pub date_as_of: String,
}

/// The account fields this module reads.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BankBalanceRecord {
    /// What the account already reconciles against, if anything.
    #[serde(default)]
    pub bank_balance: Option<Money>,
    /// The day that figure is true for, if it was recorded.
    #[serde(default)]
    pub bank_balance_date: Option<String>,
}

/// The fields a write would set — and, structurally, the only ones it can.
///
/// Private fields with a single constructor. There is no `balance` here and no
/// way to add one from outside this module; see the module documentation for
/// why that is the point rather than an inconvenience.
#[derive(Debug, Clone, Serialize)]
pub struct BankBalanceUpdates {
    bank_balance: Money,
    bank_balance_date: String,
}

impl BankBalanceUpdates {
    /// The only way to build one.
    fn new(bank_balance: Money, bank_balance_date: String) -> Self {
        Self {
            bank_balance,
            bank_balance_date,
        }
    }

    /// The figure to store.
    #[must_use]
    pub const fn bank_balance(&self) -> Money {
        self.bank_balance
    }

    /// The day it is true for.
    #[must_use]
    pub fn bank_balance_date(&self) -> &str {
        &self.bank_balance_date
    }
}

/// What this statement should do to the account's Bank Balance.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PlanStatementBankBalanceResult {
    /// Write these fields onto the account.
    Set {
        /// The two fields, and only those two.
        updates: BankBalanceUpdates,
        /// The figure, repeated for a caller that wants it without the record.
        amount: Money,
        /// The day, likewise.
        date_as_of: String,
    },
    /// Left alone: what the account already holds is more recent than this file.
    Stale {
        /// The day the kept figure is true for.
        recorded_date: String,
        /// The kept figure.
        recorded_balance: Money,
    },
    /// Nothing to do, and nothing worth saying.
    None,
}

/// Whether a statement's closing balance may be written.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanStatementBankBalance {
    /// What the file states, if it states one.
    #[serde(default)]
    pub statement: Option<StatementBalance>,
    /// What the account already holds. Absent means there is no account to
    /// write to.
    #[serde(default)]
    pub account: Option<BankBalanceRecord>,
    /// True when a person has settled which account this statement belongs to —
    /// they picked it, or the account's own recorded sort code / account number
    /// is the one in the file.
    ///
    /// False for the unattended batch importers, where a file is matched by a
    /// digit or two in an account's name and nobody sees the result before it is
    /// written. Those runs still import the transactions — individually visible,
    /// individually removable — they just do not get to redefine what the
    /// account reconciles against on the strength of a guess. That is TS-B2.
    pub destination_confirmed: bool,
}

/// A calendar day in the one form that compares and sorts correctly.
///
/// Shape only, exactly as the TypeScript and the schema's own column check.
#[must_use]
pub fn is_iso_day(value: Option<&str>) -> bool {
    let Some(text) = value else { return false };
    let bytes = text.as_bytes();
    bytes.len() == 10
        && bytes.get(4) == Some(&b'-')
        && bytes.get(7) == Some(&b'-')
        && [0usize, 1, 2, 3, 5, 6, 8, 9]
            .iter()
            .all(|index| bytes.get(*index).is_some_and(u8::is_ascii_digit))
}

/// Apply TS-B1/TS-B2/TS-B3.
#[must_use]
pub fn plan_statement_bank_balance(
    command: &PlanStatementBankBalance,
) -> PlanStatementBankBalanceResult {
    // Order matters and is copied: the destination question is asked before the
    // file is looked at, so an unattended run cannot be talked into a write by
    // the contents of a statement.
    let Some(account) = command.account.as_ref() else {
        return PlanStatementBankBalanceResult::None;
    };
    if !command.destination_confirmed {
        return PlanStatementBankBalanceResult::None;
    }

    // `Number.isFinite(statementBalance.amount)` has no counterpart here and
    // needs none: `Money` cannot hold a NaN, because the only way to build one
    // is to parse a decimal string and `"NaN"` is not one.
    let Some(statement) = command.statement.as_ref() else {
        return PlanStatementBankBalanceResult::None;
    };
    if !is_iso_day(Some(&statement.date_as_of)) {
        return PlanStatementBankBalanceResult::None;
    }

    // The staleness rule is the point of the recorded date: last March's
    // statement must not overwrite a figure that is already newer, or reopening
    // Reconciliation would show a difference of several months' spending and
    // finalising would be worse than useless.
    if let (Some(recorded_balance), Some(recorded_date)) =
        (account.bank_balance, account.bank_balance_date.as_deref())
    {
        if is_iso_day(Some(recorded_date)) && recorded_date > statement.date_as_of.as_str() {
            return PlanStatementBankBalanceResult::Stale {
                recorded_date: recorded_date.to_owned(),
                recorded_balance,
            };
        }
    }

    PlanStatementBankBalanceResult::Set {
        updates: BankBalanceUpdates::new(statement.amount, statement.date_as_of.clone()),
        amount: statement.amount,
        date_as_of: statement.date_as_of.clone(),
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{is_iso_day, BankBalanceUpdates};
    use crate::money::Money;

    #[test]
    fn an_update_can_carry_two_fields_and_there_is_no_third() {
        // The runtime half of the unrepresentability argument. The compile-time
        // half is that `BankBalanceUpdates`'s fields are private and `new` is
        // the only constructor — `balance` is not a thing that can be written
        // here, rather than a thing that is not written.
        let updates = BankBalanceUpdates::new(Money::from_minor(123_456), "2026-03-31".to_owned());
        let json = serde_json::to_value(&updates).unwrap_or(serde_json::Value::Null);
        let keys: Vec<&str> = json
            .as_object()
            .map(|object| object.keys().map(String::as_str).collect())
            .unwrap_or_default();
        assert_eq!(keys, vec!["bank_balance", "bank_balance_date"]);
        assert!(!keys.contains(&"balance"));
    }

    #[test]
    fn the_day_test_is_a_shape_test_and_the_schema_agrees() {
        assert!(is_iso_day(Some("2026-03-31")));
        // Not a calendar test. `schema.sql:357` is LIKE '____-__-__' and would
        // store this too, so refusing it here would refuse a write the file
        // permits.
        assert!(is_iso_day(Some("2026-13-45")));
        for bad in ["2026-3-31", "2026-03-31T00:00:00Z", "", "26-03-31", "2026/03/31"] {
            assert!(!is_iso_day(Some(bad)), "{bad}");
        }
        assert!(!is_iso_day(None));
    }
}
