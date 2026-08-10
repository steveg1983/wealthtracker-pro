//! TS-I9 — four `cleared` policies, one per source, and the reason a port that
//! writes one of them four times passes most of its own tests.
//!
//! # What `cleared` means, and why the bank cannot decide it
//!
//! `is_cleared` is not "the bank has processed this". It is "the USER has
//! checked this row against their statement" — a MARK they made.
//! `ofxImportService.ts:558-565` says it in as many words, and the migration
//! that made the feed agree (`20260807180000`) says it again. So a row arriving
//! from a bank *cannot* be pre-cleared: importing the statement is the moment
//! the check is supposed to happen, and a row that arrives already ticked skips
//! the one step that would have caught a missing or wrong entry.
//!
//! A row arriving from a file the user's own bookkeeping produced is different.
//! A QIF `C*` and a Money `clearedStatus` of 1 or 2 are the user's own past
//! marks, exported. Dropping them re-asks for work that was done, on every row
//! of a decade of history.
//!
//! # Two flags, since the app stopped making one do both jobs
//!
//! Migration `20260810200000` split the single flag into the two states
//! Microsoft Money always kept, and `src/utils/transactionReconciliation.ts`
//! holds the rule:
//!
//! * `is_cleared` — MARKED. A working tick, kept across sessions, settling
//!   nothing.
//! * `is_reconciled` — COMMITTED. Produced only by finishing a reconciliation
//!   against an ending balance the user stated.
//!
//! Only one importer answers the second one. Money's `clearedStatus` is a
//! three-value SCALE, not a flag — 0 neither, 1 C (marked), 2 R (committed) —
//! so `transform.ts` maps it onto both, and this module ports both. The other
//! three file importers write no committed flag at all, and that silence is
//! itself the rule they are read by: an unstated `reconciled` means "ask
//! `cleared`". [`ClearedPolicy::decide_reconciled`] returns `None` for exactly
//! those three, so "states nothing" and "states false" stay different answers.
//!
//! # The trap, in the words of the document that found it
//!
//! PHASE1-PLAN §4.2: *"five sources, four policies, but only **three distinct
//! values**. Feed, OFX and CSV all produce `false`. So a test that asserts *the
//! value* cannot tell a correct four-policy port from a wrong one-policy port —
//! it passes either way for three of the five sources."*
//!
//! Two things here answer that, and neither is a test:
//!
//! 1. **The policy is data, one per source, and the match is exhaustive.**
//!    [`ImportSource::cleared_policy`] has five arms. Adding a source without
//!    deciding its policy is a compile error, not an omission — which is the
//!    only form of "you cannot forget this" that survives a hurried change.
//! 2. **The answer names the policy that produced it.** A caller — and a spec —
//!    can see `no_cleared_column` where CSV answered and `never_pre_cleared`
//!    where OFX did, though both answered `false`. A one-policy port cannot
//!    fake that: it has one name to give.
//!
//! The distinguishing *tests* are still the two the plan names — a QIF row with
//! `C*` and a Money row with `clearedStatus = 2`, each asserted `true`, and each
//! asserted `false` when the same logical row arrives as CSV — and they are in
//! the differential lane, run against the four real TypeScript importers.
//!
//! # The failure mode, if this is lost
//!
//! `is_cleared` defaults to 0 in the schema (I-9). So a port that simply
//! *forgets* the QIF and Money policies raises no error and loses no data: it
//! produces silently-unreconciled history, and nobody finds out until a user
//! opens Reconciliation against ten years of ticks that are gone.
//!
//! The second flag fails the opposite way and is worse for it. Take Money's C
//! rows as committed and the app reports reconciliations that never happened —
//! tens of thousands of them, against statements nobody confirmed, with nothing
//! on screen to say so. That is the failure reconciliation exists to catch.

use serde::{Deserialize, Serialize};

/// Where a row came from. Five sources; the enum exists so the policy table can
/// be exhaustive.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportSource {
    /// The live bank feed. No local edition has one; a restored cloud backup
    /// carries its rows.
    BankFeed,
    /// An OFX/QFX statement file.
    Ofx,
    /// A QIF file — the only file format in the list that states a
    /// reconciliation status of its own.
    Qif,
    /// A CSV, in whatever column order the bank chose this year.
    Csv,
    /// A Microsoft Money `.mny` file, read natively.
    MsMoney,
}

/// One of the four rules. Named, because the name is what stops three
/// identical `false`s from being indistinguishable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ClearedPolicy {
    /// **Feed and OFX.** Always `false`, deliberately and not incidentally: a
    /// bank saying it processed a payment is not the user saying they checked
    /// it.
    NeverPreCleared,
    /// **QIF.** The file's own `C` flag: `X` or `*` and nothing else.
    FileFlag,
    /// **CSV.** Always `false`, for the duller reason that a CSV has no cleared
    /// column to read. A different rule from [`Self::NeverPreCleared`] with the
    /// same answer — and if a bank ever ships a CSV with a reconciliation
    /// column, this is the arm that changes and the other two must not.
    NoClearedColumn,
    /// **MS Money.** Money's own three-value scale, which answers BOTH flags:
    /// 0 neither, 1 C (marked, a balance session left unfinished), 2 R (marked
    /// *and* committed). The only policy here that states anything at all about
    /// `is_reconciled` — see [`ClearedPolicy::decide_reconciled`].
    MoneyStatusScale,
}

impl ClearedPolicy {
    /// Apply the policy to the file's own text for this row.
    ///
    /// `flag` is `RawRow::cleared_flag` — the QIF `C` line's payload, or Money's
    /// `clearedStatus` rendered as text. `None` is "the file said nothing",
    /// which for every policy here means `false`.
    #[must_use]
    // `match_same_arms` wants the two `false` arms merged, and merging them is
    // THE mistake this module exists to make impossible. PHASE1-PLAN §4.2:
    // "five sources, four policies, but only three distinct values… a test that
    // asserts the value cannot tell a correct four-policy port from a wrong
    // one-policy port". Two policies that agree today are two policies: if a
    // bank ever ships a CSV with a reconciliation column, `NoClearedColumn` is
    // the arm that changes and `NeverPreCleared` must not move with it.
    #[allow(clippy::match_same_arms)]
    pub fn decide(self, flag: Option<&str>) -> bool {
        match self {
            // `ofxImportService.ts:568` and 20260807180000. The flag is not
            // read: there is nothing in either source that could set it, and a
            // caller that supplies one anyway is ignored rather than obeyed.
            Self::NeverPreCleared => false,
            // `qifImportService.ts:104-105`, applied at `:387` through
            // `qifTrx.cleared || false`, which is what makes an absent C line
            // false rather than undefined.
            Self::FileFlag => matches!(flag, Some("X" | "*")),
            // `enhancedCsvImportService.ts:417`.
            Self::NoClearedColumn => false,
            // `import/msMoney/transform.ts` — MARKED is C or R, so 1 counts.
            // Anything off Money's scale (including a QIF flag sent here by
            // mistake) is not a number on it and is not a mark.
            Self::MoneyStatusScale => matches!(flag, Some("1" | "2")),
        }
    }

    /// Apply the policy to the COMMITTED flag — `transactions.is_reconciled`.
    ///
    /// `None` is not `Some(false)`. It means this importer states nothing about
    /// the committed flag, and `src/utils/transactionReconciliation.ts` then
    /// reads the row through `cleared` instead. Three of the four policies are
    /// in that position and the distinction is load-bearing: a `Some(false)`
    /// from Money says "marked, deliberately not committed", where a `None`
    /// from QIF says "this format never had an answer to give".
    ///
    /// Four arms, written out rather than defaulted, for the same reason
    /// [`Self::decide`] has four: a fifth policy must not inherit an answer
    /// nobody chose for it.
    #[must_use]
    // Three arms answer `None` and `match_same_arms` wants them merged. They
    // stay apart for the reason the same lint is silenced on [`Self::decide`]:
    // the three silences have three different causes — a bank that writes no
    // mark to commit, a QIF format that has no committed field, a CSV that has
    // no reconciliation column at all — and the day any one of them gains an
    // answer it must be able to move without dragging the other two with it.
    #[allow(clippy::match_same_arms)]
    pub fn decide_reconciled(self, flag: Option<&str>) -> Option<bool> {
        match self {
            // Nothing arrives from a bank pre-marked, so there is nothing to
            // commit and no column written either way.
            Self::NeverPreCleared => None,
            // `qifImportService.ts` writes `cleared` and stops there: a QIF `C*`
            // row carries no committed flag, and is read through its mark.
            Self::FileFlag => None,
            // `enhancedCsvImportService.ts` — no cleared column, no committed
            // one either.
            Self::NoClearedColumn => None,
            // `import/msMoney/transform.ts` — R and only R. Stated on every row
            // including the false ones, because the importer read Money's own
            // answer and an unstated flag would be read as the mark.
            Self::MoneyStatusScale => Some(flag == Some("2")),
        }
    }
}

impl ImportSource {
    /// The policy this source's rows are admitted under.
    ///
    /// Five arms, and they are the whole of TS-I9. The match is exhaustive by
    /// construction: a sixth source cannot be added without an answer here.
    #[must_use]
    pub const fn cleared_policy(self) -> ClearedPolicy {
        match self {
            Self::BankFeed | Self::Ofx => ClearedPolicy::NeverPreCleared,
            Self::Qif => ClearedPolicy::FileFlag,
            Self::Csv => ClearedPolicy::NoClearedColumn,
            Self::MsMoney => ClearedPolicy::MoneyStatusScale,
        }
    }
}

/// Decide whether a row from this source arrives reconciled.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanClearedFlag {
    /// Which importer produced the row.
    pub source: ImportSource,
    /// The file's own text for this row's reconciliation status, if it has one.
    #[serde(default)]
    pub cleared_flag: Option<String>,
}

/// The answer, and the policy that produced it.
#[derive(Debug, Clone, Serialize)]
pub struct PlanClearedFlagResult {
    /// What `transactions.is_cleared` will hold — the MARK.
    pub cleared: bool,
    /// What `transactions.is_reconciled` will hold, when this importer states
    /// it at all.
    ///
    /// Absent from the serialised answer when the importer says nothing, which
    /// is not the same as saying `false`: the row is then read through
    /// `cleared`. Only MS Money answers here, and it answers on every row.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reconciled: Option<bool>,
    /// Which of the four rules decided. Carried so that three sources answering
    /// `false` remain three distinguishable answers.
    pub policy: ClearedPolicy,
}

/// Apply TS-I9.
#[must_use]
pub fn plan_cleared_flag(command: &PlanClearedFlag) -> PlanClearedFlagResult {
    let policy = command.source.cleared_policy();
    let flag = command.cleared_flag.as_deref();
    PlanClearedFlagResult {
        cleared: policy.decide(flag),
        reconciled: policy.decide_reconciled(flag),
        policy,
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{ClearedPolicy, ImportSource};

    #[test]
    fn the_two_sources_that_can_answer_true_are_the_only_two_that_do() {
        assert!(ImportSource::Qif.cleared_policy().decide(Some("*")));
        assert!(ImportSource::Qif.cleared_policy().decide(Some("X")));
        assert!(ImportSource::MsMoney.cleared_policy().decide(Some("2")));

        // The same flag through every other source. This is the assertion a
        // one-policy port fails.
        for source in [ImportSource::BankFeed, ImportSource::Ofx, ImportSource::Csv] {
            for flag in [Some("*"), Some("X"), Some("2"), Some("true"), None] {
                assert!(
                    !source.cleared_policy().decide(flag),
                    "{source:?} must never arrive reconciled ({flag:?})"
                );
            }
        }
    }

    #[test]
    fn the_qif_flag_is_two_characters_and_not_a_truthiness_test() {
        let policy = ImportSource::Qif.cleared_policy();
        assert!(policy.decide(Some("X")));
        assert!(policy.decide(Some("*")));
        // Money's own reconciled code, and QIF's own lower-case c, are not the
        // QIF flag. `c` in particular is what a "cleared but not reconciled"
        // row carries in some writers.
        for flag in [Some("2"), Some("x"), Some("c"), Some("C"), Some(""), None] {
            assert!(!policy.decide(flag), "{flag:?} is not the QIF cleared flag");
        }
    }

    #[test]
    fn moneys_scale_has_three_values_and_answers_both_flags() {
        let policy = ImportSource::MsMoney.cleared_policy();
        // 0 — neither.
        assert!(!policy.decide(Some("0")));
        assert_eq!(policy.decide_reconciled(Some("0")), Some(false));
        // 1 — C: a mark, and NOT a commitment. The one that used to be thrown
        // away, and the one that must never be promoted.
        assert!(policy.decide(Some("1")), "C is a mark");
        assert_eq!(
            policy.decide_reconciled(Some("1")),
            Some(false),
            "C is a balance session nobody finished"
        );
        // 2 — R: marked and committed.
        assert!(policy.decide(Some("2")));
        assert_eq!(policy.decide_reconciled(Some("2")), Some(true));
        // Off the scale entirely: not a mark, and certainly not a commitment.
        assert!(!policy.decide(Some("3")));
        assert!(!policy.decide(Some("*")), "a QIF flag is not on Money's scale");
        assert!(!policy.decide(None));
        assert_eq!(policy.decide_reconciled(None), Some(false));
    }

    #[test]
    fn only_money_states_the_committed_flag_and_silence_is_not_false() {
        // The asymmetry transactionReconciliation.ts is built on: an unstated
        // committed flag sends the reader back to the mark, so a port that
        // answered `Some(false)` for QIF would un-reconcile every ticked row a
        // QIF ever carried.
        for source in [
            ImportSource::BankFeed,
            ImportSource::Ofx,
            ImportSource::Qif,
            ImportSource::Csv,
        ] {
            for flag in [Some("*"), Some("X"), Some("2"), Some("1"), None] {
                assert_eq!(
                    source.cleared_policy().decide_reconciled(flag),
                    None,
                    "{source:?} states nothing about the committed flag ({flag:?})"
                );
            }
        }
        assert!(ImportSource::MsMoney
            .cleared_policy()
            .decide_reconciled(None)
            .is_some());
    }

    #[test]
    fn three_sources_answer_false_under_two_different_policies() {
        // The trap PHASE1-PLAN §4.2 names: the VALUE cannot tell these apart.
        // The policy name can, and that is why the result carries it.
        assert_eq!(
            ImportSource::Ofx.cleared_policy(),
            ClearedPolicy::NeverPreCleared
        );
        assert_eq!(
            ImportSource::BankFeed.cleared_policy(),
            ClearedPolicy::NeverPreCleared
        );
        assert_eq!(
            ImportSource::Csv.cleared_policy(),
            ClearedPolicy::NoClearedColumn
        );
        assert_ne!(
            ImportSource::Ofx.cleared_policy(),
            ImportSource::Csv.cleared_policy()
        );
    }
}
