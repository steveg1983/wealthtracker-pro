//! A calendar day, and the exact shape of "this file's date is unreadable".
//!
//! # Why this is not [`crate::wire::is_calendar_date`]
//!
//! `wire::is_calendar_date` answers the question Postgres's `::date` cast asks:
//! *is this a real day?* It refuses 31 February, because a ledger that files a
//! transaction on a day that does not exist is broken.
//!
//! The admission modules ask a different question, and it is not a nicer one:
//! *what does the TypeScript this is a port of do with this text?* Every date in
//! `statementDuplicates.ts` and `feedOverlap.ts` reaches `Date.parse`, and
//! `Date.parse` is not a validator. MEASURED (node 22.17.0, V8):
//!
//! | text | `Date.parse` |
//! | --- | --- |
//! | `2027-02-07` | 2027-02-07 |
//! | `2027-02-30` | **2027-03-02** — the day ROLLS OVER |
//! | `2027-04-31` | **2027-05-01** |
//! | `1900-02-29` | **1900-03-01** (1900 is not a leap year) |
//! | `2027-02-00` | NaN |
//! | `2027-13-01` | NaN |
//! | `2027-12-32` | NaN |
//! | `0000-01-01` | 0000-01-01 |
//!
//! That is the ECMAScript Date Time String Format followed by `MakeDay`: the
//! *syntax* bounds the month at 12 and the day at 31, and anything inside those
//! bounds but outside the month's real length is carried into the next month
//! rather than rejected. This module reproduces exactly that, because a port
//! that "tidied" it would put a row in a different bucket from the module it
//! claims to be a port of, and the whole lane is built on the two agreeing.
//!
//! # What is deliberately NOT reproduced
//!
//! V8's fallback parser. `Date.parse("2027-2-7")`, `Date.parse(" 2027-02-07")`
//! and `Date.parse("+002027-02-07")` all succeed in node and are
//! **implementation-defined** — ECMA-262 says an implementation may accept
//! anything it likes once the standard format does not match. Reproducing it
//! would mean porting V8, and the surface includes `"Feb 7 2027"` and
//! `"2/7/2027"`, whose meaning depends on the reader's nationality.
//!
//! So this module reads the standard date-only form and nothing else, and the
//! difference is DECLARED with a spec on each side of it. The direction of the
//! consequence is worth stating: a date the port cannot read is a row excluded
//! from duplicate matching, which imports as a new row and shows up in the
//! register — not one silently suppressed. The port fails towards "the user
//! sees an extra row", never towards "the user's payment vanished".

/// A calendar day as a count of days since 1970-01-01, UTC.
///
/// Days rather than milliseconds on purpose: every comparison these modules
/// make is a whole-day gap, and the TypeScript reaches the same number by
/// flooring milliseconds. Counting the unit the rule is written in removes the
/// floor, and with it the only place a sub-day component could have leaked in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Day(i64);

impl Day {
    /// Parse the ECMAScript date-only form, `YYYY-MM-DD`.
    ///
    /// `None` is "unreadable", which is a real and load-bearing answer: a row
    /// whose date cannot be read has no position on the calendar and is a
    /// duplicate of nothing.
    ///
    /// A day between 1 and 31 that is longer than its month ROLLS OVER, which
    /// is what `Date.parse` does — see the module documentation.
    #[must_use]
    pub fn parse(text: &str) -> Option<Self> {
        let bytes = text.as_bytes();
        if bytes.len() != 10 || bytes.get(4) != Some(&b'-') || bytes.get(7) != Some(&b'-') {
            return None;
        }
        if ![0usize, 1, 2, 3, 5, 6, 8, 9]
            .iter()
            .all(|index| bytes.get(*index).is_some_and(u8::is_ascii_digit))
        {
            return None;
        }
        let number = |from: usize, to: usize| -> Option<i64> {
            text.get(from..to).and_then(|part| part.parse::<i64>().ok())
        };
        let year = number(0, 4)?;
        let month = number(5, 7)?;
        let day = number(8, 10)?;
        // The SYNTAX bounds, not the calendar's. 2027-02-30 passes here and is
        // rolled over below, exactly as MakeDay does.
        if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
            return None;
        }
        Some(Self(days_from_civil(year, month, day)))
    }

    /// The count of days since the epoch.
    #[must_use]
    pub const fn epoch_day(self) -> i64 {
        self.0
    }

    /// Whole days between two days, always positive.
    #[must_use]
    pub fn gap(self, other: Self) -> i64 {
        self.0.saturating_sub(other.0).saturating_abs()
    }

    /// Render back as `YYYY-MM-DD`.
    ///
    /// This is the ROLLED-OVER day, not the text that was parsed: `2027-02-30`
    /// comes back as `2027-03-02`, because that is the day the value means and
    /// it is what `new Date(ms).toISOString().slice(0, 10)` produces.
    #[must_use]
    pub fn to_iso(self) -> String {
        let (year, month, day) = civil_from_days(self.0);
        format!("{year:04}-{month:02}-{day:02}")
    }
}

// Howard Hinnant's `days_from_civil` / `civil_from_days`, which are exact
// integer arithmetic over the proleptic Gregorian calendar and agree with
// `MakeDay` on every input this module can produce. Every operand here is
// bounded by a four-digit year parsed above, so none of it can overflow an i64;
// the lint is switched off for the two functions rather than for the module.
#[allow(clippy::arithmetic_side_effects)]
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_prime = (month + 9) % 12;
    let day_of_year = (153 * month_prime + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

#[allow(clippy::arithmetic_side_effects)]
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = if shifted >= 0 { shifted } else { shifted - 146_096 } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    };
    (if month <= 2 { year + 1 } else { year }, month, day)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::Day;

    #[test]
    fn reads_the_standard_date_only_form() {
        for (text, iso) in [
            ("2027-02-07", "2027-02-07"),
            ("1970-01-01", "1970-01-01"),
            ("1969-12-31", "1969-12-31"),
            ("2000-02-29", "2000-02-29"),
            ("0000-01-01", "0000-01-01"),
            ("9999-12-31", "9999-12-31"),
        ] {
            let day = Day::parse(text).expect(text);
            assert_eq!(day.to_iso(), iso, "round trip of {text}");
        }
        assert_eq!(Day::parse("1970-01-01").map(Day::epoch_day), Some(0));
        assert_eq!(Day::parse("1970-01-02").map(Day::epoch_day), Some(1));
        assert_eq!(Day::parse("1969-12-31").map(Day::epoch_day), Some(-1));
    }

    #[test]
    fn a_day_past_the_end_of_its_month_rolls_over_exactly_as_date_parse_does() {
        // MEASURED in node 22.17.0 — see the module documentation's table.
        for (text, rolled) in [
            ("2027-02-30", "2027-03-02"),
            ("2027-02-31", "2027-03-03"),
            ("2027-04-31", "2027-05-01"),
            ("1900-02-29", "1900-03-01"),
        ] {
            assert_eq!(
                Day::parse(text).map(Day::to_iso).as_deref(),
                Some(rolled),
                "{text} must roll over"
            );
        }
    }

    #[test]
    fn everything_outside_the_syntax_is_unreadable() {
        for text in [
            "",
            "not a date",
            "2027-02-00",
            "2027-00-01",
            "2027-13-01",
            "2027-12-32",
            "20270207",
            "2027/02/07",
            "2027-02-07T00:00:00Z",
            // V8's fallback parser accepts all four of these. Deliberately not
            // ported; the divergence is declared and has specs.
            "2027-2-7",
            "2027-02-7",
            " 2027-02-07",
            "+002027-02-07",
        ] {
            assert_eq!(Day::parse(text), None, "{text:?} must be unreadable");
        }
    }

    #[test]
    fn the_gap_is_whole_days_and_has_no_sign() {
        let earlier = Day::parse("2027-02-07").expect("earlier");
        let later = Day::parse("2027-02-10").expect("later");
        assert_eq!(later.gap(earlier), 3);
        assert_eq!(earlier.gap(later), 3);
        assert_eq!(earlier.gap(earlier), 0);
    }
}
