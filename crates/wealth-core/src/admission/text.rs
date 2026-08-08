//! Description similarity — the one quantity in this crate that is a float, and
//! the reason that is not a contradiction.
//!
//! # It is a ranking signal and never a gate
//!
//! Both modules that use it say so in their own words.
//! `statementDuplicates.ts:39-53`: *"Description is a RANKING signal for tier 2
//! and never a gate"*. `feedOverlap.ts:28-31`: *"Description is a RANKING
//! signal, never a gate. Feed descriptions are the bank's raw strings
//! (`AMZNMktplace …`), Money's are payee names (`Amazon`); requiring them to
//! agree would miss most true duplicates."*
//!
//! The consequence of that sentence is what makes the float acceptable: no
//! amount of money changes hands because this number is 0.57 rather than 0.58.
//! What it decides is which of several rows *already qualifying on account,
//! exact pence and date* is offered as the pairing. Money never touches it —
//! [`crate::money::Money`] is an `i64` and this function cannot see one.
//!
//! `Cargo.toml` denies `clippy::float_arithmetic` for the whole crate. This is
//! the only place it is allowed, in one four-line function, and the allow is
//! deliberately not module-wide.
//!
//! # Why the float is copied rather than improved
//!
//! An exact rational would rank better in principle and would be *wrong* here:
//! the port has to break the same ties the same way. The comparison
//! `gap === bestGap && similarity > bestSimilarity` is an IEEE-754 comparison in
//! the TypeScript, so it is an IEEE-754 comparison here. Both sides divide two
//! small integers, which is the case where the two languages cannot disagree —
//! MEASURED: node and rustc print `0.5`, `0.6666666666666666`,
//! `0.5714285714285714`, `0.3333333333333333` and `0.2857142857142857`
//! character for character, because both render an f64 as its shortest
//! round-tripping decimal.

use std::collections::BTreeSet;

/// Alphanumeric word tokens, upper-cased; short noise words dropped.
///
/// The port of `text.toUpperCase().split(/[^A-Z0-9]+/).filter(t => t.length > 2)`.
///
/// The two halves of that expression disagree about Unicode on purpose, and the
/// disagreement is copied: `toUpperCase` is the full Unicode mapping (`é` → `É`,
/// `ß` → `SS`) and the character class is ASCII-only, so an accented letter ends
/// up as a *separator*. `CAFé FIXTURE` yields `{CAF, FIXTURE}` on both sides —
/// which is the same fixture, and the same answer, as the constraint harness's
/// `x1-upper-…` spec.
///
/// A token is ASCII by construction (it survived a filter that admits only
/// `A-Z0-9`), so JavaScript's UTF-16 `length` and Rust's byte `len` count the
/// same thing and the `> 2` threshold means the same thing in both.
fn tokens(text: &str) -> BTreeSet<String> {
    text.to_uppercase()
        .split(|character: char| {
            !(character.is_ascii_uppercase() || character.is_ascii_digit())
        })
        .filter(|token| token.len() > 2)
        .map(ToOwned::to_owned)
        .collect()
}

/// Jaccard overlap of the two token sets — 1 identical, 0 nothing in common.
///
/// Zero when either side has no usable token at all, which is the answer for a
/// blank description and for one made entirely of short words.
#[must_use]
// The one float in the crate. Every operand is a set cardinality bounded by the
// length of a description, so the casts cannot lose a digit and the subtraction
// cannot go negative (`shared` is counted out of `left`, so it is at most
// `min(left, right)` and the union is at least `max(left, right)`).
#[allow(
    clippy::float_arithmetic,
    clippy::cast_precision_loss,
    clippy::arithmetic_side_effects
)]
pub fn description_similarity(left_text: &str, right_text: &str) -> f64 {
    let left = tokens(left_text);
    let right = tokens(right_text);
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    let shared = left.iter().filter(|token| right.contains(*token)).count();
    let union = left.len() + right.len() - shared;
    shared as f64 / union as f64
}

#[cfg(test)]
// `float_cmp` is right about money and wrong here. These assertions compare a
// quotient of two small integers against a value the same division produced —
// which is exactly the case where IEEE-754 equality is total — and comparing
// with an epsilon instead would stop the tests from catching the thing they
// exist for: that node and rustc agree on the answer bit for bit.
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::float_cmp)]
mod tests {
    use super::{description_similarity, tokens};

    #[test]
    fn scores_shared_words_and_ignores_case_and_punctuation() {
        assert!(description_similarity("Corner Shop", "CORNER SHOP LTD") > 0.5);
        assert_eq!(description_similarity("Corner Shop", "Fuel Station"), 0.0);
        // Short tokens are noise and are dropped, so an all-short string
        // scores 0 against itself.
        assert_eq!(description_similarity("a b c", "a b c"), 0.0);
    }

    #[test]
    fn a_renamed_payee_shares_nothing_with_the_banks_wording() {
        // The case the whole two-tier rule exists for: requiring the
        // descriptions to agree — or merely to be similar — would have missed
        // this pair and doubled the payment.
        assert_eq!(
            description_similarity(
                "Nadia",
                "Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027"
            ),
            0.0
        );
    }

    #[test]
    fn an_accented_letter_splits_the_token_because_the_character_class_is_ascii() {
        let split: Vec<String> = tokens("CAFé FIXTURE").into_iter().collect();
        assert_eq!(split, vec!["CAF".to_owned(), "FIXTURE".to_owned()]);
    }

    #[test]
    fn the_quotients_render_exactly_as_javascript_renders_them() {
        // MEASURED against node 22.17.0 for the three descriptions the
        // statement fixtures actually produce.
        assert_eq!(
            format!("{}", description_similarity("Corner Shop", "CORNER SHOP LTD 4471")),
            "0.5"
        );
        assert_eq!(
            format!(
                "{}",
                description_similarity(
                    "Sweep Transfer from account 5566",
                    "Sweep Transfer from account 55667788"
                )
            ),
            "0.6666666666666666"
        );
        assert_eq!(
            format!(
                "{}",
                description_similarity(
                    "Direct Debit - TELCO LTD  447",
                    "Direct Debit - TELCO LTD  447221900-00007"
                )
            ),
            "0.5714285714285714"
        );
    }
}
