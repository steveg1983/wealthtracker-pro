//! The admission surface, at the seams the differential lane cannot reach.
//!
//! `scripts/local-sqlite/admission.mjs` runs 109 specs against the real
//! TypeScript, and everything with a TypeScript counterpart belongs there
//! rather than here. What is left is three kinds of thing:
//!
//! 1. **A rule whose oracle is not TypeScript.** The bank feed's `cleared`
//!    policy is enforced in SQL, and its differential proof is against Postgres
//!    in the VERB lane. It still has to be in the policy table, so it is
//!    asserted here.
//! 2. **A behaviour the TypeScript leaves undefined.** `findFeedOverlap` sorts
//!    its feed rows with a comparator that returns NaN when a date is
//!    unreadable, and V8's answer to that is measurably not a rule. The
//!    property that MATTERS — such a row matches nothing — is asserted here,
//!    with one feed row, so there is no order to disagree about.
//! 3. **The boundary itself.** `deny_unknown_fields` is this crate's declared
//!    divergence from the cloud's silent key-discarding, and money is a string
//!    on every command including these.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use wealth_core::admission::cleared::{ClearedPolicy, ImportSource};
use wealth_core::admission::{
    plan_cleared_flag, plan_feed_overlap, plan_statement_bank_balance, plan_statement_duplicates,
    PlanClearedFlag, PlanFeedOverlap, PlanStatementBankBalance, PlanStatementDuplicates,
};

// ── 1. The source with no TypeScript oracle ─────────────────────────────────

#[test]
fn a_bank_feed_row_is_never_pre_cleared_and_the_lane_cannot_say_so() {
    // The feed's policy lives in `import_bank_transactions_atomic`, not in any
    // TypeScript module, so the admission lane has nothing to run it against.
    // Its differential proof is
    // `verb-specs/feed-a-feed-row-arrives-unreconciled.spec.mjs`, against the
    // live Postgres RPC. This is the assertion that the SOURCE TABLE agrees
    // with it — a policy table that had forgotten the feed would be caught
    // nowhere else.
    for flag in [None, Some("*"), Some("X"), Some("2"), Some("true")] {
        let answer = plan_cleared_flag(&PlanClearedFlag {
            source: ImportSource::BankFeed,
            cleared_flag: flag.map(ToOwned::to_owned),
        });
        assert!(!answer.cleared, "the feed never pre-clears ({flag:?})");
        assert_eq!(answer.policy, ClearedPolicy::NeverPreCleared);
    }
}

#[test]
fn five_sources_carry_four_policies_and_three_of_them_answer_the_same_thing() {
    // PHASE1-PLAN §4.2's trap, stated as an assertion: the VALUE cannot
    // distinguish OFX from CSV, so a test that only read the value would pass a
    // one-policy port for three of the five sources.
    let policies: Vec<ClearedPolicy> = [
        ImportSource::BankFeed,
        ImportSource::Ofx,
        ImportSource::Qif,
        ImportSource::Csv,
        ImportSource::MsMoney,
    ]
    .into_iter()
    .map(ImportSource::cleared_policy)
    .collect();

    let mut distinct = policies.clone();
    distinct.sort_by_key(|policy| format!("{policy:?}"));
    distinct.dedup();
    assert_eq!(distinct.len(), 4, "four policies across five sources");

    // …and three of the five can never answer true AT ALL. Stated over every
    // flag any source recognises rather than over one: with no flag all five
    // answer false, which is the shape that makes the trap a trap.
    let can_ever_answer_true = policies
        .iter()
        .filter(|policy| {
            [Some("*"), Some("X"), Some("2"), Some("1"), Some("0"), None]
                .into_iter()
                .any(|flag| policy.decide(flag))
        })
        .count();
    assert_eq!(
        can_ever_answer_true, 2,
        "only QIF and MS Money can ever produce a reconciled row"
    );
}

// ── 2. What the TypeScript leaves to V8 ─────────────────────────────────────

#[test]
fn an_unreadable_date_keeps_a_row_out_of_matching_on_both_sides_of_the_overlap() {
    // Deliberately one feed row and one Money row, so the ordering the
    // TypeScript leaves undefined is not in play. Two shapes, both directions.
    let feed_unreadable: PlanFeedOverlap = serde_json::from_str(
        r#"{
          "transactions": [{"id":"m1","account_id":"a","date":"2026-05-10","amount":"-12.34","description":"x","type":"expense"}],
          "feed_rows": [{"id":"f1","account_id":"a","date":"nonsense","amount":"-12.34","description":"x"}]
        }"#,
    )
    .expect("payload");
    let plan = plan_feed_overlap(&feed_unreadable);
    assert!(plan.matches.is_empty());
    assert_eq!(plan.unmatched_feed_ids, vec!["f1".to_owned()]);

    let money_unreadable: PlanFeedOverlap = serde_json::from_str(
        r#"{
          "transactions": [{"id":"m1","account_id":"a","date":"nonsense","amount":"-12.34","description":"x","type":"expense"}],
          "feed_rows": [{"id":"f1","account_id":"a","date":"2026-05-10","amount":"-12.34","description":"x"}]
        }"#,
    )
    .expect("payload");
    let plan = plan_feed_overlap(&money_unreadable);
    assert!(plan.matches.is_empty());
    assert_eq!(plan.kept_despite_overlap.transfers, 0);
    assert_eq!(plan.kept_despite_overlap.split_parents, 0);
}

// ── 3. The boundary ─────────────────────────────────────────────────────────

#[test]
fn a_misspelled_key_is_refused_rather_than_discarded() {
    // The crate's DECLARED divergence from both import RPCs, applied to the
    // admission surface too: the cloud discards a key it does not recognise,
    // and a planner whose caller misspelled `destination_confirmed` would
    // otherwise silently answer as though it were false — which is a refusal to
    // write, reported as nothing at all.
    let error = serde_json::from_str::<PlanStatementBankBalance>(
        r#"{"destination_confirmed": true, "destinaton_confirmed": true}"#,
    )
    .expect_err("an unknown key must be refused");
    assert!(error.to_string().starts_with("unknown field"), "{error}");

    let error = serde_json::from_str::<PlanStatementDuplicates>(
        r#"{"account_id":"a","incoming":[{"amount":"-1.00","descriptoin":"typo"}],"held":[]}"#,
    )
    .expect_err("an unknown key inside a row must be refused too");
    assert!(error.to_string().starts_with("unknown field"), "{error}");
}

#[test]
fn money_may_not_be_a_json_number_on_the_admission_surface_either() {
    // A JSON number is an IEEE-754 double the moment a parser touches it, and
    // these rules compare amounts for equality. `Money` refuses it at the
    // boundary, so the comparison cannot be handed a value that has already
    // drifted.
    let error = serde_json::from_str::<PlanStatementDuplicates>(
        r#"{"account_id":"a","incoming":[{"amount":-12.34,"description":"x"}],"held":[]}"#,
    )
    .expect_err("a JSON number must be refused");
    assert!(error.to_string().contains("amount_must_be_a_string"), "{error}");

    let error = serde_json::from_str::<PlanStatementBankBalance>(
        r#"{"destination_confirmed":true,"statement":{"amount":900,"date_as_of":"2026-03-31"}}"#,
    )
    .expect_err("a JSON number must be refused");
    assert!(error.to_string().contains("amount_must_be_a_string"), "{error}");
}

#[test]
fn an_absent_optional_section_is_the_same_as_a_null_one() {
    // `account: null` and no `account` key at all both mean "there is no
    // account to write to", which is what the TypeScript's `!account` test
    // says. Asserted because serde would happily have made them different.
    for payload in [
        r#"{"destination_confirmed":true,"account":null,"statement":{"amount":"900.00","date_as_of":"2026-03-31"}}"#,
        r#"{"destination_confirmed":true,"statement":{"amount":"900.00","date_as_of":"2026-03-31"}}"#,
    ] {
        let command: PlanStatementBankBalance = serde_json::from_str(payload).expect("payload");
        let json = serde_json::to_value(plan_statement_bank_balance(&command)).expect("json");
        assert_eq!(json, serde_json::json!({ "kind": "none" }), "{payload}");
    }
}

#[test]
fn the_two_tiers_are_reported_separately_even_when_one_is_empty() {
    // The shape is part of the contract: a caller reads `certain` and
    // `possible` and treats them differently — TS-I6 says a FITID pair may not
    // be overridden by "import anyway" and an amount-and-date pair may. A
    // result that collapsed the two when one was empty would leave that
    // distinction to be re-derived from `basis`.
    let command: PlanStatementDuplicates = serde_json::from_str(
        r#"{"account_id":"a","incoming":[],"held":[]}"#,
    )
    .expect("payload");
    let json = serde_json::to_value(plan_statement_duplicates(&command)).expect("json");
    assert_eq!(
        json,
        serde_json::json!({ "certain": [], "possible": [] })
    );
}
