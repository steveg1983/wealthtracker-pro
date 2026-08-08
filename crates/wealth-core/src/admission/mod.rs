//! Admission control — the rules that decide what a parsed row MEANS before any
//! write verb sees it.
//!
//! # The dividing line, one level finer than [`crate::verbs`]
//!
//! DESIGN.md §6.3 draws the first line: *"if it decides what gets written, it is
//! Rust."* PHASE1-PLAN §3.1 sharpens it, and disagrees with the design's own
//! wording while doing so — the design says the importer *parsers* stay in
//! TypeScript and produce "a typed row array", and typing is exactly where the
//! decisions hide. Turning `"05/03/2026"` into a date is a decision about the
//! file's order. Turning `"-12.34"` into a number is `parseMoneyInput`. Deciding
//! that `TRNTYPE=CREDIT, TRNAMT=-40.00` is an expense is a rule with a name.
//!
//! > **TypeScript finds the records and their fields as text. Rust decides what
//! > the text means.**
//!
//! This module is the second half of that sentence. Everything in it takes text
//! and typed scalars and answers a question. Nothing in it writes.
//!
//! # No connection, and that is structural rather than a habit
//!
//! Not one function here takes a [`rusqlite::Connection`], and the only
//! occurrences of the word anywhere under `admission/` are in this paragraph:
//!
//! ```bash
//! grep -rn rusqlite crates/wealth-core/src/admission/ | grep -v '//!'
//! # no output
//! ```
//!
//! The command-line bridge goes further and refuses to hand one over: a
//! `plan_*` command sent with `--db` is a fault, not a command. So "a planner
//! cannot write" is not a review comment — there is no file in scope to write
//! to. That matters because these rules run *before* the ledger's own
//! constraints do: a bad admission decision produces rows that are internally
//! consistent and entirely wrong, which is precisely the class of damage
//! `verify_integrity` reported it could not see (PHASE1-PLAN §2.5).
//!
//! # The oracle is different here, and the difference is the point
//!
//! Every verb in [`crate::verbs`] is a port of a Postgres function, so its proof
//! is differential against the live RPC. **These rules have no Postgres side at
//! all.** PHASE1-PLAN §5 counts 48 such invariants — 35 % of the whole
//! inventory — and calls their oracle *"the existing Vitest suite: 2,447 lines
//! across 8 modules, written against real defects"*.
//!
//! The plan's method was transliteration: copy each Vitest case into a scenario
//! file and run the Rust against it. This port does something stronger, because
//! the oracle can be **executed**: `scripts/local-sqlite/admission.mjs` drives
//! the actual TypeScript module and this crate from ONE JSON payload and
//! compares the two answers field by field. A transliterated expectation can
//! drift from the module it was copied from and nothing says so; a live oracle
//! cannot.
//!
//! # Money at this boundary, and the one thing the port refuses to copy
//!
//! Every amount here is a [`Money`](crate::money::Money) — an `i64` of minor
//! units, deserialised from a decimal string. The TypeScript modules take
//! `number`, and each of them carries its own defence against that: `exactPence`
//! in `statementDuplicates.ts`, `pence` in `feedOverlap.ts`,
//! `toNumber(toDecimal(...))` in `statementBankBalance.ts`. All three are
//! `Decimal` round-trips whose job is to turn a double back into an exact
//! quantity of pence.
//!
//! The port deletes all three, because the type has already done it. What that
//! exposes is a real difference and it is DECLARED rather than smoothed over:
//! those helpers **round** a sub-penny amount (`-12.345` → `-1235` minor, half
//! away from zero) and `Money::parse` **refuses** it. That is the same
//! divergence [`crate::money`] already declares against Postgres's
//! `numeric(20,2)` and against `parseMoneyInput`, arriving at three more sites.
//! The differential lane pins both sides of it at each one, so the day the
//! TypeScript stops rounding, the divergence retires deliberately instead of
//! quietly.
//!
//! # What is here
//!
//! | rule | invariants | ported from |
//! | --- | --- | --- |
//! | [`statement_duplicates`] | TS-I6, TS-I7 | `src/utils/statementDuplicates.ts` |
//! | [`statement_bank_balance`] | TS-B1, TS-B2, TS-B3, TS-I2 | `src/utils/statementBankBalance.ts` |
//! | [`feed_overlap`] | TS-I12, TS-I13 | `src/services/import/msMoney/feedOverlap.ts` |
//! | [`cleared`] | TS-I9 | four sites; see the module |
//! | [`account_identifiers`] | TS-A1, TS-A2, TS-A3 | `src/utils/ofxAccountIdentifiers.ts` |
//! | [`self_transfer`] | TS-I8 | `src/utils/transferMatch.ts:85-94` |
//!
//! and two shared pieces that exist because two rules each needed them and
//! disagreeing about either would be silent: [`day`], which is the ECMAScript
//! date-only form and its rollover, and [`text`], which is the one float in the
//! crate.
//!
//! # What is NOT here, named so nobody has to re-derive it
//!
//! * **`plan_import` itself.** PHASE1-PLAN §3.2 lists a verb of that name over
//!   `Vec<RawRow>` that enforces thirteen canonical invariants at once. What is
//!   built here is its admission *decisions*, each addressable on its own. The
//!   verb that sequences them — the date-order question (TS-I10), the sign
//!   question (TS-I5), D-3's zero-amount rule, the statement ordinal (TS-I4) —
//!   is not built, and the write path it would end in is
//!   [`crate::verbs::import_transactions`], which is.
//! * **`plan_duplicate_sweep` and `delete_transactions_swept`** (TS-D1…TS-D4).
//!   The sweep DELETES, so its gate is a refusal in a write verb rather than a
//!   plan, and PHASE1-PLAN §4.3 settles its shape as a `strand_ack` token on
//!   `delete_transaction` — which is a change to an existing verb's contract and
//!   to a declared divergence (#126), not an addition beside it.
//! * **`formatStatementDay` and `todayIsoDay`.** They decide what is SHOWN.
//! * **`findTransferCandidates`** from the same file as [`self_transfer`]. It is
//!   the transfer sweep's ranking (TS-T5/TS-T6/TS-T7), which PHASE1-PLAN routes
//!   through `plan_transfer_sweep`, and it reads the whole register rather than
//!   one row's fields — a different shape of question from everything here.

pub mod account_identifiers;
pub mod cleared;
pub mod day;
pub mod feed_overlap;
pub mod self_transfer;
pub mod statement_bank_balance;
pub mod statement_duplicates;
pub mod text;

pub use account_identifiers::{
    plan_account_identifier_match, plan_account_identifiers, PlanAccountIdentifierMatch,
    PlanAccountIdentifierMatchResult, PlanAccountIdentifiers, PlanAccountIdentifiersResult,
};
pub use cleared::{
    plan_cleared_flag, ClearedPolicy, ImportSource, PlanClearedFlag, PlanClearedFlagResult,
};
pub use feed_overlap::{plan_feed_overlap, PlanFeedOverlap, PlanFeedOverlapResult};
pub use self_transfer::{
    plan_category_admission, PlanCategoryAdmission, PlanCategoryAdmissionResult,
};
pub use statement_bank_balance::{
    plan_statement_bank_balance, PlanStatementBankBalance, PlanStatementBankBalanceResult,
};
pub use statement_duplicates::{
    plan_statement_duplicates, PlanStatementDuplicates, PlanStatementDuplicatesResult,
};
