//! Money — signed integer minor units, and nothing else.
//!
//! # The rule this module exists to make structural
//!
//! DESIGN.md §3 and CLAUDE.md BLOCKER #1: **no floating-point arithmetic for
//! money, anywhere, ever.** `schema.sql` makes that true of storage (`STRICT`
//! tables reject a REAL in an INTEGER column). This module makes it true of the
//! boundary, which is where the cloud lost it: `parseFloat` on the way in,
//! IEEE-754 doubles on the way out.
//!
//! Money is an `i64` count of minor units at every boundary — in the struct, in
//! the SQL parameter, in the column. Its *wire* form is a decimal **string**,
//! never a JSON number, because a JSON number is a double the moment any parser
//! touches it. `"-12.34"` survives a round trip through anything; `-12.34` does
//! not.
//!
//! # Sub-minor-unit input is REFUSED, not rounded
//!
//! `Money::parse("-12.345")` is an error, not `-12.35`.
//!
//! This is a deliberate divergence, declared in three directions:
//!
//! * **From Postgres**: `transactions.amount` is `numeric(20,2)`, so the cloud
//!   rounds half-away-from-zero and says nothing. Measured on the reference
//!   cluster: `create_transaction_atomic` with `"amount":"-12.345"` stores
//!   `-12.35` and moves the balance by `-12.35`.
//! * **From the TypeScript money boundary**: `src/utils/decimal.ts:69-80`
//!   (`parseMoneyInput`, invariant TS-M1 / canonical #131) rounds
//!   `ROUND_HALF_UP` to 2 dp and returns a number. PHASE1-PLAN §3.2 note 3
//!   claims the `Money` newtype makes #131 "structural"; it cannot, because a
//!   newtype that refuses does not implement a rule that rounds. The two
//!   documents disagree and this module follows the design's stated principle
//!   (§3.1, on the quantity ceiling: *"the local edition refuses to write it
//!   rather than silently rounding"*).
//! * **From nothing at all in the schema**: no CHECK can express "this decimal
//!   string had three places", because by the time SQLite sees it, it is an
//!   integer. The refusal has to live here or nowhere.
//!
//! # Bounds
//!
//! The range checks in `schema.sql` (±1e11 minor per row, ±1e15 per stock
//! figure) are *not* re-implemented here, on purpose: duplicating a constraint
//! in two places is how the two copies drift. What this module does guarantee is
//! that parsing cannot overflow an `i64` on the way to the constraint —
//! otherwise an absurd input would wrap into a plausible one and the CHECK would
//! be handed a lie.

use std::fmt;

use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Minor units per major unit. Sterling pence, cents, öre — the schema's
/// `_minor` suffix means exactly this scale (`schema.sql` §"Scale is per
/// column").
pub const MINOR_UNITS_PER_MAJOR: i64 = 100;

/// A signed amount of money, counted in minor units.
///
/// `Copy` because it is one `i64`; `Ord` because comparing two amounts is
/// always exact.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Money(i64);

/// Why a decimal string is not money.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoneyError {
    /// Not a plain signed decimal: empty, a stray symbol, a thousands
    /// separator, an exponent, a leading `+`, or more than one point.
    Malformed,
    /// More than two decimal places. The value is real but this ledger cannot
    /// hold it, and rounding it silently is what this edition refuses to do.
    SubMinorUnit,
    /// Too large to count in `i64` minor units.
    OutOfRange,
}

impl MoneyError {
    /// The stable machine code a refusal is reported under.
    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::Malformed => "amount_malformed",
            Self::SubMinorUnit => "amount_not_representable",
            Self::OutOfRange => "amount_out_of_range",
        }
    }
}

/// Every machine code this boundary can refuse with.
///
/// serde has no room for structured errors — a `Deserialize` implementation can
/// only return a *message* — so a refusal that happens during deserialisation
/// arrives at the caller as prose with the code embedded in it. This list is how
/// the code is recovered, and it exists so that "the amount had three decimal
/// places" is reported under its own name rather than as a generic parse
/// failure. A refusal nobody can name is a refusal nobody can test for.
pub const BOUNDARY_CODES: [&str; 4] = [
    "amount_must_be_a_string",
    "amount_not_representable",
    "amount_out_of_range",
    "amount_malformed",
];

impl fmt::Display for MoneyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Malformed => f.write_str(
                "amount must be a plain signed decimal string such as \"-12.34\" \
                 (no currency symbol, no thousands separator, no exponent)",
            ),
            Self::SubMinorUnit => f.write_str(
                "amount has more than two decimal places; this ledger is exact to the \
                 minor unit and will not round money on your behalf",
            ),
            Self::OutOfRange => f.write_str("amount is too large to count in minor units"),
        }
    }
}

impl std::error::Error for MoneyError {}

impl Money {
    /// Zero.
    pub const ZERO: Self = Self(0);

    /// Per-row bound from `schema.sql` (`transactions_amount_bounded`).
    /// Published so callers can *report* it; the constraint, not this constant,
    /// is what enforces it.
    pub const ROW_BOUND_MINOR: i64 = 100_000_000_000;

    /// Stock-figure bound from `schema.sql` (`accounts_balance_bounded`).
    pub const STOCK_BOUND_MINOR: i64 = 1_000_000_000_000_000;

    /// Wrap a count of minor units that is already trusted — a value read back
    /// out of an INTEGER column, or a literal in a test.
    #[must_use]
    pub const fn from_minor(minor: i64) -> Self {
        Self(minor)
    }

    /// The count of minor units, for binding straight into SQL.
    #[must_use]
    pub const fn minor(self) -> i64 {
        self.0
    }

    /// Parse a plain signed decimal string.
    ///
    /// Accepts exactly the grammar `-?(\d+(\.\d{1,2})?|\.\d{1,2})`, which is
    /// the grammar `parseMoneyInput` accepts *after* it has stripped currency
    /// symbols and separators. The stripping is deliberately not reproduced: it
    /// belongs to a text input box, not to a command boundary, and a command
    /// that has to guess what `"£1,2 3 4"` meant has already lost.
    ///
    /// `-0`, `-0.0` and `-0.00` all normalise to `0` (TS-M2 / canonical #132:
    /// negative zero is not a thing a ledger may hold).
    ///
    /// # Errors
    /// [`MoneyError`] — see its variants.
    pub fn parse(text: &str) -> Result<Self, MoneyError> {
        let (negative, digits) = match text.strip_prefix('-') {
            Some(rest) => (true, rest),
            None => (false, text),
        };
        if digits.is_empty() {
            return Err(MoneyError::Malformed);
        }

        let mut parts = digits.splitn(2, '.');
        // splitn always yields at least one item, so this cannot be None; the
        // `unwrap_or` keeps the crate free of panicking paths rather than
        // asserting it.
        let whole = parts.next().unwrap_or("");
        let fraction = parts.next();

        if digits.matches('.').count() > 1 {
            return Err(MoneyError::Malformed);
        }
        if whole.is_empty() && fraction.is_none() {
            return Err(MoneyError::Malformed);
        }
        if !whole.bytes().all(|b| b.is_ascii_digit()) {
            return Err(MoneyError::Malformed);
        }

        let minor_from_fraction = match fraction {
            None => 0_i64,
            Some(frac) => {
                if frac.is_empty() || !frac.bytes().all(|b| b.is_ascii_digit()) {
                    return Err(MoneyError::Malformed);
                }
                if frac.len() > 2 {
                    // The whole reason this function returns a Result.
                    return Err(MoneyError::SubMinorUnit);
                }
                let scaled = if frac.len() == 1 {
                    frac.parse::<i64>()
                        .map_err(|_| MoneyError::Malformed)?
                        .checked_mul(10)
                } else {
                    Some(frac.parse::<i64>().map_err(|_| MoneyError::Malformed)?)
                };
                scaled.ok_or(MoneyError::OutOfRange)?
            }
        };

        let major: i64 = if whole.is_empty() {
            0
        } else {
            whole.parse::<i64>().map_err(|_| MoneyError::OutOfRange)?
        };

        let minor = major
            .checked_mul(MINOR_UNITS_PER_MAJOR)
            .and_then(|scaled| scaled.checked_add(minor_from_fraction))
            .ok_or(MoneyError::OutOfRange)?;

        // Negative zero is normalised away by construction: -(0) is 0.
        let signed = if negative {
            minor.checked_neg().ok_or(MoneyError::OutOfRange)?
        } else {
            minor
        };
        Ok(Self(signed))
    }

    /// Render as the decimal string this type deserialises from. Exact: no
    /// float ever exists on this path.
    #[must_use]
    pub fn to_decimal_string(self) -> String {
        hundredths_to_decimal_string(self.0)
    }
}

/// A count of hundredths, rendered as a two-place decimal string. Exact: no
/// float ever exists on this path.
///
/// [`Money::to_decimal_string`] IS this function, and it is spelled separately
/// for one reason: `budgets.alert_threshold_bp` is stored as hundredths of a
/// percent (8000 meaning 80.00%) and the cloud stores the same quantity as
/// `numeric(5,2)`, which casts to text as `"80.00"`. A read that hands the app
/// the raw 8000 forces a division on the far side of the boundary — and
/// `/ 100` under `src/services/local/` is exactly what R-7's grep exists to
/// catch, whether or not the quantity is money.
///
/// So the rendering happens here, once, in the module whose entire purpose is
/// that a fixed-point quantity never meets a float. What must NOT follow is a
/// [`Money`] holding a percentage: the threshold is not money, `schema.sql`
/// says so in capitals at the column, and giving it money's type would make it
/// eligible for every arithmetic this crate reserves for amounts.
#[must_use]
// The divisor is the literal 100 and the dividend is a u64, so neither
// division can divide by zero nor overflow. Spelled out rather than
// switching the lint off, because the next person to add arithmetic here
// should have to justify it too.
#[allow(clippy::arithmetic_side_effects)]
pub fn hundredths_to_decimal_string(hundredths: i64) -> String {
    let negative = hundredths < 0;
    // i64::MIN has no positive counterpart; unsigned_abs is the only
    // correct way to take the magnitude.
    let magnitude = hundredths.unsigned_abs();
    let whole = magnitude / 100;
    let fraction = magnitude % 100;
    let sign = if negative { "-" } else { "" };
    format!("{sign}{whole}.{fraction:02}")
}

impl fmt::Debug for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Money({})", self.to_decimal_string())
    }
}

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_decimal_string())
    }
}

impl Serialize for Money {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_decimal_string())
    }
}

struct MoneyVisitor;

impl Visitor<'_> for MoneyVisitor {
    type Value = Money;

    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a decimal money string such as \"-12.34\"")
    }

    fn visit_str<E: de::Error>(self, value: &str) -> Result<Money, E> {
        Money::parse(value).map_err(|error| E::custom(format!("{}: {error}", error.code())))
    }

    // A JSON number is an IEEE-754 double by the time any parser has read it.
    // Refusing it here is the difference between a type system that documents
    // the rule and one that enforces it.
    fn visit_f64<E: de::Error>(self, _value: f64) -> Result<Money, E> {
        Err(E::custom(
            "amount_must_be_a_string: money may not be a JSON number — a JSON number is \
             a binary float and cannot hold a decimal amount exactly. Send \"-12.34\".",
        ))
    }

    fn visit_i64<E: de::Error>(self, _value: i64) -> Result<Money, E> {
        self.visit_f64(0.0)
    }

    fn visit_u64<E: de::Error>(self, _value: u64) -> Result<Money, E> {
        self.visit_f64(0.0)
    }
}

impl<'de> Deserialize<'de> for Money {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(MoneyVisitor)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{Money, MoneyError};

    #[test]
    fn parses_the_plain_decimal_grammar() {
        let cases = [
            ("0", 0_i64),
            ("0.00", 0),
            ("12", 1_200),
            ("12.3", 1_230),
            ("12.34", 1_234),
            (".5", 50),
            ("-.5", -50),
            ("-7", -700),
            ("-12.34", -1_234),
            ("1000000000.00", 100_000_000_000),
        ];
        for (text, minor) in cases {
            assert_eq!(
                Money::parse(text).map(Money::minor),
                Ok(minor),
                "parsing {text}"
            );
        }
    }

    #[test]
    fn negative_zero_is_normalised_away() {
        for text in ["-0", "-0.0", "-0.00"] {
            let parsed = Money::parse(text);
            assert_eq!(parsed, Ok(Money::ZERO), "parsing {text}");
            assert_eq!(parsed.map(Money::to_decimal_string).as_deref(), Ok("0.00"));
        }
    }

    #[test]
    fn a_sub_penny_amount_is_refused_rather_than_rounded() {
        // Postgres numeric(20,2) stores -12.35 for this input and says nothing.
        // src/utils/decimal.ts parseMoneyInput returns -12.35 for it too.
        assert_eq!(Money::parse("-12.345"), Err(MoneyError::SubMinorUnit));
        assert_eq!(Money::parse("0.001"), Err(MoneyError::SubMinorUnit));
        assert_eq!(MoneyError::SubMinorUnit.code(), "amount_not_representable");
    }

    #[test]
    fn rejects_everything_that_is_not_a_plain_signed_decimal() {
        for text in [
            "", "-", ".", "-.", "+1.00", "1,000.00", "£1.00", " 1.00", "1.00 ", "1e3", "abc",
            "1.2.3", "--1", "1-", "0x10", "NaN", "Infinity",
        ] {
            assert_eq!(
                Money::parse(text),
                Err(MoneyError::Malformed),
                "parsing {text:?}"
            );
        }
    }

    #[test]
    fn overflow_is_an_error_not_a_wrap() {
        assert_eq!(
            Money::parse("99999999999999999999"),
            Err(MoneyError::OutOfRange)
        );
        assert_eq!(
            Money::parse("-99999999999999999999.99"),
            Err(MoneyError::OutOfRange)
        );
    }

    #[test]
    fn round_trips_through_its_own_string_form() {
        for minor in [
            0_i64,
            1,
            -1,
            99,
            -99,
            100,
            -100,
            123_456,
            -123_456,
            i64::MAX,
        ] {
            let money = Money::from_minor(minor);
            let text = money.to_decimal_string();
            assert_eq!(Money::parse(&text), Ok(money), "round trip of {text}");
        }
    }

    #[test]
    fn the_formatter_survives_the_value_that_has_no_positive_counterpart() {
        // i64::MIN is outside every schema bound and cannot be re-parsed (its
        // magnitude does not fit in an i64), but the formatter must not panic
        // on it: `-x` would, `unsigned_abs` does not.
        assert_eq!(
            Money::from_minor(i64::MIN).to_decimal_string(),
            "-92233720368547758.08"
        );
    }

    #[test]
    fn serde_refuses_a_json_number() {
        let error = serde_json::from_str::<Money>("-12.34")
            .unwrap_err()
            .to_string();
        assert!(error.contains("amount_must_be_a_string"), "{error}");
        let error = serde_json::from_str::<Money>("12").unwrap_err().to_string();
        assert!(error.contains("amount_must_be_a_string"), "{error}");
    }

    #[test]
    fn serde_accepts_the_string_form_and_gives_it_back() {
        let money: Money = serde_json::from_str(r#""-12.34""#).unwrap_or(Money::ZERO);
        assert_eq!(money.minor(), -1_234);
        assert_eq!(
            serde_json::to_string(&money).unwrap_or_default(),
            r#""-12.34""#
        );
    }

    #[test]
    fn serde_surfaces_the_sub_penny_code() {
        let error = serde_json::from_str::<Money>(r#""-12.345""#)
            .unwrap_err()
            .to_string();
        assert!(error.contains("amount_not_representable"), "{error}");
    }
}
