//! Fixed-point figures that are NOT money: how many units, and what one costs.
//!
//! # Why this is a second module and not a second constructor on [`Money`]
//!
//! For the reason [`crate::money::hundredths_from_decimal_string`] already gives
//! about a budget threshold, one scale further out: *"a [`Money`] holding a
//! percentage would be eligible for every arithmetic this crate reserves for
//! amounts, and one `+` between a threshold and a balance is a class of bug no
//! test would think to look for."*
//!
//! A holding carries two such figures and neither is an amount:
//!
//! * **quantity** — how many units are held. Fractional, because fund units and
//!   crypto are. 100 shares is not £100 of anything.
//! * **unit price** — what ONE unit is worth. A RATE, like an exchange rate.
//!   Rounding a rate before multiplying it by a quantity is the classic way to
//!   make a portfolio disagree with the broker, which is precisely the bug
//!   `20260809120000_investment_prices_below_the_penny.sql` was written to end:
//!   `numeric(10,2)` silently turned SHEL.L's £32.775 into £32.78, half a penny
//!   per share, every night, in the same direction.
//!
//! Multiplying the two gives money, and that multiplication happens in
//! [`market_value_minor`] and nowhere else.
//!
//! # The scale is 1e8, and `schema.sql` chose it
//!
//! *"8dp is chosen, not measured: it is exact for UK fund prices (4dp), US
//! equity (4dp), and sub-cent crypto down to £0.00000001."* The file records the
//! scale in `schema_meta` so a later widening is a migration rather than an
//! archaeology exercise, and the cloud agrees since that migration widened both
//! price columns to `numeric(20,8)`.
//!
//! # A ninth decimal place is REFUSED, not rounded — divergence M-2
//!
//! [`Money`]'s refusal one scale out, and declared in the same three directions.
//! `numeric(20,8)` rounds half-away-from-zero and says nothing; a file refuses.
//! The reason is the reason M-1 exists: a value the engine cannot hold exactly
//! is a value the user should be told about rather than one the ledger should
//! invent an approximation of.
//!
//! # The wire form is EIGHT PLACES, always
//!
//! `numeric(20,8)::text` in Postgres is `'32.77500000'`, never `'32.775'`, and
//! [`to_decimal_string`] produces the same eight places for the same reason
//! [`crate::money::Money::to_decimal_string`] always produces two: the
//! differential harness compares two engines' answers as TEXT, and a comparison
//! that first has to normalise a spelling is a comparison with a normaliser in
//! it that can be wrong.
//!
//! # int64 is the ceiling, and it is LOWER than the cloud's
//!
//! `schema.sql` states it: *"Postgres `numeric(20,8)` permits 1e12 units, so a
//! position larger than 9e10 units exists in the cloud type and is REFUSED here.
//! That divergence is deliberate and tested."* This module is where that refusal
//! happens — before the CHECK, so it is named rather than reported as a
//! constraint violation about a column.

use std::fmt;

use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Decimal places every quantity and unit price is counted in.
pub const SCALE_DIGITS: usize = 8;

/// The scale itself: `10^SCALE_DIGITS`.
pub const SCALE: i64 = 100_000_000;

/// Why a decimal string is not a quantity or a price.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScaledError {
    /// Not a plain signed decimal: empty, a stray symbol, a thousands
    /// separator, an exponent, a leading `+`, or more than one point.
    Malformed,
    /// More than eight decimal places. Divergence M-2 — see the module docs.
    TooPrecise,
    /// Beyond what an `i64` can count at this scale. The cloud's type is wider;
    /// see the module docs.
    OutOfRange,
}

impl ScaledError {
    /// The suffix a field-specific machine code is built from, so that
    /// `quantity_out_of_range` and `unit_price_out_of_range` are two names
    /// rather than one generic one a test cannot tell apart.
    #[must_use]
    pub const fn suffix(self) -> &'static str {
        match self {
            Self::Malformed => "malformed",
            Self::TooPrecise => "not_representable",
            Self::OutOfRange => "out_of_range",
        }
    }
}

impl fmt::Display for ScaledError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Malformed => f.write_str(
                "must be a plain signed decimal string such as \"32.775\" \
                 (no currency symbol, no thousands separator, no exponent)",
            ),
            Self::TooPrecise => f.write_str(
                "has more than eight decimal places; this ledger is exact to eight and \
                 will not round a figure on your behalf",
            ),
            Self::OutOfRange => f.write_str("is too large for this ledger to count exactly"),
        }
    }
}

impl std::error::Error for ScaledError {}

/// A plain signed decimal string as a count of hundred-millionths.
///
/// The grammar is [`crate::money::hundredths_from_decimal_string`]'s with the
/// fraction widened to eight places, and it is spelled out here rather than
/// shared with that function for the reason the module docs give: the two
/// quantities must not become one type.
///
/// # Errors
/// [`ScaledError`] — see its variants.
pub fn from_decimal_string(text: &str) -> Result<i64, ScaledError> {
    let (negative, digits) = match text.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, text),
    };
    if digits.is_empty() {
        return Err(ScaledError::Malformed);
    }
    if digits.matches('.').count() > 1 {
        return Err(ScaledError::Malformed);
    }

    let mut parts = digits.splitn(2, '.');
    // splitn always yields at least one item; the `unwrap_or` keeps this crate
    // free of panicking paths rather than asserting it.
    let whole = parts.next().unwrap_or("");
    let fraction = parts.next();

    if whole.is_empty() && fraction.is_none() {
        return Err(ScaledError::Malformed);
    }
    if !whole.bytes().all(|b| b.is_ascii_digit()) {
        return Err(ScaledError::Malformed);
    }

    let scaled_fraction = match fraction {
        None => 0_i64,
        Some(frac) => {
            if frac.is_empty() || !frac.bytes().all(|b| b.is_ascii_digit()) {
                return Err(ScaledError::Malformed);
            }
            if frac.len() > SCALE_DIGITS {
                // The whole reason this function returns a Result.
                return Err(ScaledError::TooPrecise);
            }
            // Right-pad to the full scale: "5" at 8 places is 50_000_000, not 5.
            let mut padded = String::with_capacity(SCALE_DIGITS);
            padded.push_str(frac);
            while padded.len() < SCALE_DIGITS {
                padded.push('0');
            }
            padded.parse::<i64>().map_err(|_| ScaledError::OutOfRange)?
        }
    };

    let units: i64 = if whole.is_empty() {
        0
    } else {
        whole.parse::<i64>().map_err(|_| ScaledError::OutOfRange)?
    };

    let raw = units
        .checked_mul(SCALE)
        .and_then(|scaled| scaled.checked_add(scaled_fraction))
        .ok_or(ScaledError::OutOfRange)?;

    // Negative zero is normalised away by construction: -(0) is 0, the same
    // rule `Money::parse` keeps.
    if negative {
        raw.checked_neg().ok_or(ScaledError::OutOfRange)
    } else {
        Ok(raw)
    }
}

/// A count of hundred-millionths, rendered at exactly eight decimal places.
///
/// Exact: no float ever exists on this path, and no trailing zero is trimmed —
/// see the module docs on why the wire form is fixed-width.
#[must_use]
// The divisor is the literal SCALE and the dividend is a u64, so neither
// division can divide by zero nor overflow. Spelled out rather than switching
// the lint off, because the next person to add arithmetic here should have to
// justify it too.
#[allow(clippy::arithmetic_side_effects)]
pub fn to_decimal_string(raw: i64) -> String {
    let negative = raw < 0;
    // i64::MIN has no positive counterpart; unsigned_abs is the only correct
    // way to take the magnitude.
    let magnitude = raw.unsigned_abs();
    let scale = SCALE.unsigned_abs();
    let whole = magnitude / scale;
    let fraction = magnitude % scale;
    let sign = if negative { "-" } else { "" };
    format!("{sign}{whole}.{fraction:08}")
}

/// `quantity × unit price` as MONEY, in minor units, rounded half-away-from-zero.
///
/// # Why this is the only multiplication in the investments family
///
/// `schema.sql` states the arithmetic and the reason for it: *"`price_e8 *
/// quantity_e8` is 1e16-scaled and overflows int64 for any position over about
/// £92. It is therefore NEVER computed in SQL. `market_value_minor` is computed
/// in the command layer in i128, rounded half-up to minor units, and stored.
/// `cost_basis_minor` likewise."*
///
/// **Half-AWAY-FROM-ZERO, not half-up**, and the difference is the sign: the
/// value this agrees with is `numeric(10,2)` in the cloud, and Postgres rounds
/// `-0.005` to `-0.01`. A half-up implementation would answer `-0.00` for the
/// same input and the two ledgers would disagree by a penny on every short
/// position that landed on a half.
///
/// Returns `None` when the product does not fit in `i64` minor units, which the
/// caller reports as a refusal naming the figure rather than as an overflow.
#[must_use]
#[allow(clippy::arithmetic_side_effects)]
pub fn market_value_minor(quantity_e8: i64, unit_price_e8: i64) -> Option<i64> {
    // i128 throughout: the product is 1e16-scaled, so £1,000 of a £10 share is
    // already 1e19 and an i64 would have wrapped.
    let product = i128::from(quantity_e8).checked_mul(i128::from(unit_price_e8))?;
    // 1e16 down to 1e2 is a divisor of 1e14.
    let divisor: i128 = 100_000_000_000_000;
    let magnitude = product.unsigned_abs();
    let divisor_magnitude = divisor.unsigned_abs();
    let quotient = magnitude / divisor_magnitude;
    let remainder = magnitude % divisor_magnitude;
    // Half-away-from-zero: the magnitude rounds up on exactly a half, and the
    // sign is put back afterwards.
    let rounded = if remainder.checked_mul(2)? >= divisor_magnitude {
        quotient.checked_add(1)?
    } else {
        quotient
    };
    let signed = i128::try_from(rounded).ok()?;
    let signed = if product < 0 { signed.checked_neg()? } else { signed };
    i64::try_from(signed).ok()
}

/// A quantity or a unit price, counted in hundred-millionths.
///
/// The twin of [`crate::money::Money`], and deliberately NOT convertible to it:
/// the only way one becomes the other is [`market_value_minor`], which is a
/// multiplication by the other kind of figure and is the only place in this
/// crate where the two scales meet.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Scaled8(i64);

impl Scaled8 {
    /// Zero.
    pub const ZERO: Self = Self(0);

    /// Wrap a raw count that is already trusted — a value read back out of an
    /// INTEGER column, or a literal in a test.
    #[must_use]
    pub const fn from_raw(raw: i64) -> Self {
        Self(raw)
    }

    /// The raw count, for binding straight into SQL.
    #[must_use]
    pub const fn raw(self) -> i64 {
        self.0
    }

    /// Parse a plain signed decimal string at this scale.
    ///
    /// # Errors
    /// [`ScaledError`] — see its variants.
    pub fn parse(text: &str) -> Result<Self, ScaledError> {
        from_decimal_string(text).map(Self)
    }

    /// Render at exactly eight places, the shape `numeric(20,8)::text` produces.
    #[must_use]
    pub fn to_decimal_string(self) -> String {
        to_decimal_string(self.0)
    }
}

impl fmt::Debug for Scaled8 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Scaled8({})", self.to_decimal_string())
    }
}

impl fmt::Display for Scaled8 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_decimal_string())
    }
}

impl Serialize for Scaled8 {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_decimal_string())
    }
}

struct Scaled8Visitor;

impl Visitor<'_> for Scaled8Visitor {
    type Value = Scaled8;

    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a decimal string such as \"32.775\"")
    }

    fn visit_str<E: de::Error>(self, value: &str) -> Result<Scaled8, E> {
        Scaled8::parse(value).map_err(|error| E::custom(format!("figure_{}: {error}", error.suffix())))
    }

    // A JSON number is an IEEE-754 double by the time any parser has read it,
    // and a quantity is exactly where that costs the most: 0.1 + 0.2 units of a
    // fund is a position nobody holds. Refused for [`crate::money::Money`]'s
    // reason, in [`crate::money::Money`]'s words.
    fn visit_f64<E: de::Error>(self, _value: f64) -> Result<Scaled8, E> {
        Err(E::custom(
            "figure_must_be_a_string: a quantity or a unit price may not be a JSON number — \
             a JSON number is a binary float and cannot hold a decimal figure exactly. \
             Send \"32.775\".",
        ))
    }

    fn visit_i64<E: de::Error>(self, _value: i64) -> Result<Scaled8, E> {
        self.visit_f64(0.0)
    }

    fn visit_u64<E: de::Error>(self, _value: u64) -> Result<Scaled8, E> {
        self.visit_f64(0.0)
    }
}

impl<'de> Deserialize<'de> for Scaled8 {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(Scaled8Visitor)
    }
}

/// Every machine code this boundary can refuse with — [`crate::money::BOUNDARY_CODES`]'s
/// twin, and recovered the same way, because serde can only return a *message*.
pub const SCALED_BOUNDARY_CODES: [&str; 4] = [
    "figure_must_be_a_string",
    "figure_not_representable",
    "figure_out_of_range",
    "figure_malformed",
];

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    #[test]
    fn eight_places_survive_the_round_trip() {
        for text in [
            "0.00000000",
            "1.00000000",
            "32.77500000",
            "-32.77500000",
            "0.00000001",
            "90000000000.00000000",
        ] {
            let raw = from_decimal_string(text).expect("a plain decimal parses");
            assert_eq!(to_decimal_string(raw), text, "round trip of {text}");
        }
    }

    #[test]
    fn a_short_fraction_is_padded_rather_than_read_as_units() {
        // "32.775" is 32.775, not 32.00000775 — the classic off-by-a-scale.
        assert_eq!(from_decimal_string("32.775"), Ok(3_277_500_000));
        assert_eq!(to_decimal_string(3_277_500_000), "32.77500000");
    }

    #[test]
    fn a_ninth_decimal_place_is_refused_rather_than_rounded() {
        assert_eq!(from_decimal_string("0.000000005"), Err(ScaledError::TooPrecise));
        assert_eq!(from_decimal_string("32.775000001"), Err(ScaledError::TooPrecise));
    }

    #[test]
    fn the_grammar_refuses_what_money_refuses() {
        for text in ["", "-", "+1", "1e8", "1,000", "£1", "1.2.3", "1.", ".", "abc"] {
            assert_eq!(
                from_decimal_string(text),
                Err(ScaledError::Malformed),
                "{text} should be malformed"
            );
        }
        // A bare leading point IS allowed, exactly as Money allows ".5".
        assert_eq!(from_decimal_string(".5"), Ok(50_000_000));
    }

    #[test]
    fn negative_zero_is_normalised_away() {
        assert_eq!(from_decimal_string("-0.00000000"), Ok(0));
        assert_eq!(to_decimal_string(0), "0.00000000");
    }

    #[test]
    fn a_position_wider_than_int64_is_refused_rather_than_wrapped() {
        // The cloud's numeric(20,8) permits 1e12 units. At 1e8 that needs 1e20,
        // which i64 cannot hold — the deliberate divergence schema.sql names.
        assert_eq!(
            from_decimal_string("1000000000000.00000000"),
            Err(ScaledError::OutOfRange)
        );
    }

    #[test]
    fn a_market_value_is_money_and_rounds_the_way_postgres_does() {
        // 100 units at £32.775 = £3277.50 exactly.
        assert_eq!(market_value_minor(100 * SCALE, 3_277_500_000), Some(327_750));
        // 3 units at £12.345 = £37.035 → £37.04, away from zero.
        assert_eq!(market_value_minor(3 * SCALE, 1_234_500_000), Some(3_704));
        // The same position held short rounds to −£37.04, not −£37.03.
        assert_eq!(market_value_minor(-3 * SCALE, 1_234_500_000), Some(-3_704));
        // And a value that cannot be money at all is None rather than a wrap.
        assert_eq!(market_value_minor(i64::MAX, i64::MAX), None);
    }

    #[test]
    fn a_json_number_is_refused_the_way_money_refuses_one() {
        let refusal = serde_json::from_str::<Scaled8>("32.775").expect_err("a number is refused");
        assert!(
            refusal.to_string().contains("figure_must_be_a_string"),
            "named, not generic: {refusal}"
        );
        assert_eq!(
            serde_json::from_str::<Scaled8>("\"32.775\"").expect("a string parses"),
            Scaled8::from_raw(3_277_500_000)
        );
    }

    #[test]
    fn the_wire_form_is_the_one_postgres_prints() {
        let json = serde_json::to_string(&Scaled8::from_raw(3_277_500_000)).expect("serialises");
        assert_eq!(json, "\"32.77500000\"");
    }
}
