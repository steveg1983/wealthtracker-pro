//! The boot, as ONE question asked of an open file.
//!
//! Every other verb in this crate answers something a caller thought of. This
//! one answers what the application asks the moment it starts: what accounts
//! are there, what names can things be filed under, what is in the ledger, what
//! its split lines are, what the budgets and the goals say, and which reports the
//! person has saved. Seven answers, one call, one transaction.
//!
//! # The question is the seam's, and the seam already wrote it down
//!
//! `dataPort.ts` declares `loadBoot(): Promise<BootSnapshot>` and says why it
//! is one call rather than six: *"the ORDER between them is a rule rather than
//! an accident (categories before transactions; budgets and goals together,
//! never one after the other), and a rule spread over six call-site awaits can
//! only be kept by the one call site that happens to read it."*
//!
//! The cloud keeps that rule by OBEYING it — `DataServiceImpl.loadBoot` is the
//! boot effect's old sequence moved behind the seam, six network crossings in
//! the order the app depended on. A file has no such sequence to keep, and the
//! contract suite says so in its own vocabulary: `BOOT_COMPOSITION`'s
//! `'local-core'` row is `{ describes: 'one crossing, one transaction, one
//! snapshot', fansOut: false }`, and the note above it explains what that buys
//! — *"Ordering is not kept there, it is unable to be broken there, which is a
//! stronger property"*. This verb is what makes that row true.
//!
//! # What is in the answer, key by key
//!
//! ```text
//! BootSnapshot field   this answer's key     the read it composes
//! ──────────────────   ───────────────────   ─────────────────────────────
//! accounts             accounts              list_accounts
//! categories           categories            list_categories
//! transactions         transactions          list_transactions
//! splits               transaction_splits    list_transaction_splits
//! budgets              budgets               list_budgets
//! goals                goals                 list_goals
//! customReports        custom_reports        list_custom_reports
//! transactionStats     — the port's          (see below)
//! phases               — the port's          (see below)
//! ```
//!
//! Six of the seven keys are the seam's own field names. The odd one is not:
//! `splits` there is `transaction_splits` here, because this crate names a read
//! after the QUESTION it answers and there are two split reads — `splits_for`
//! already owns the bare word for *one parent's* lines. A key that meant "all
//! of them" in one answer and "one row's" in another is the kind of thing that
//! is read wrongly once and then believed. The port maps the name where every
//! other snake-to-camel mapping already happens.
//!
//! # WHY THE SAVED REPORTS ARE IN A BOOT AT ALL
//!
//! Every other absence below is argued, so the newest PRESENCE is argued too —
//! and it is not obvious. A saved report is not the ledger, nobody needs one to
//! draw a register, and the reports page is a route a person visits rarely: on
//! the face of it this belongs with the closed accounts and the dismissals,
//! fetched when the surface that wants them opens.
//!
//! It is here because the DASHBOARD renders pinned custom reports in its first
//! paint. The pins live in the preferences document as `custom:<id>`, and the
//! widget they name is drawn from the definition in this table — so a boot that
//! omitted the reports would paint a dashboard with the pinned widgets missing
//! and fill them in a moment later, which is the flash the composite exists to
//! prevent. It is the same reason the budgets and the goals are here rather than
//! on their own pages' loads: what the boot must carry is what the FIRST SCREEN
//! draws, not what the first screen is about.
//!
//! What it costs is nothing that changes the shape of this verb. It is one more
//! `SEARCH … USING INDEX` over a table holding a handful of rows per login — the
//! same shape as the accounts, the categories, the budgets and the goals, whose
//! band the measurement note at the foot of this file places it in and does not
//! claim to have re-run it in. It carries no money either, so it adds nothing to
//! the one conversion this crate is careful about.
//!
//! # What is NOT in the answer, and each absence is a decision
//!
//! **The balances (R-4).** `account_balances` is the seam's PARALLEL read — the
//! one that is deliberately not in the sequence at all — and it stays outside
//! this answer, exactly as it stays outside `BootSnapshot`. The seam's own paragraph is the argument and it applies
//! verbatim to a file: those figures *"exist for exactly the seconds a long
//! history is in flight"*, the seeding rule that uses them fires only while
//! `transactions.length === 0`, and *"a read whose entire purpose is to be early
//! cannot be bundled with the thing it is early for"*. Folding them in here
//! would not merely make the answer bigger — it would make the early answer
//! arrive at the same instant as the thing it was early for, which is the same
//! as not having it. The map is a separate verb precisely so a caller can start
//! it FIRST and await it LAST.
//!
//! There is a second half to R-4 that a file makes easy to get wrong. The
//! accounts in this answer carry `accounts.balance`, the STORED figure, because
//! that is the column the read they come from projects. A composite that
//! "helpfully" replaced it with the derived total would be answering
//! [`crate::verbs::account_balances`]'s question under another verb's name, and
//! the one instrument that exists to catch a drifted cache
//! ([`crate::verbs::verify_integrity`]'s `balance_identity`) would be reporting
//! a disagreement nobody's figures could contradict. Two numbers are only worth
//! having while they are arrived at independently. Both halves have a named
//! spec.
//!
//! **The transaction stats.** `BootSnapshot.transactionStats` says how the rows
//! were obtained — how many came from a cache, how many from a delta, and in
//! words why no snapshot was served. Every one of those is a fact about a
//! FETCH STRATEGY, and a file has none: it has rows. The port answers them the
//! way divergence B-1 already says browser storage does, with `'local mode'`,
//! and it is the port rather than this verb for a reason that decides it: the
//! OTHER sentence in that vocabulary is `'load failed'`, which is what the boot
//! must say when this crate could not be reached at all. A verb cannot answer
//! for the case where the verb did not run. One vocabulary, one owner.
//!
//! **The phases.** `BootSnapshot.phases` is a duration per phase, and an answer
//! that carries a duration is an answer that is never twice the same — which is
//! precisely what the differential harness compares. The caller times the one
//! crossing there is; a per-read breakdown is what
//! `crates/wealth-core/tests/reads_at_scale.rs` records, on a ledger the size of
//! a real one, where a measurement means something.
//!
//! **The closed accounts and the suggestion dismissals.** Neither is a boot
//! read in the application either: `listClosedAccounts` is asked by the three
//! surfaces that show closed accounts (`Accounts.tsx`, `AccountTransactions.tsx`,
//! `useAccountNames.ts`), and `listSuggestionDismissals` by
//! `refreshSuggestionDismissals`, when a sweep opens. Putting them here would
//! make every boot pay for two answers most boots never look at, and would make
//! this verb something other than a port of `loadBoot`.
//!
//! **Anything that WRITES.** The cloud's composite may change the store on its
//! way past — `prepareCategories` runs `migrate_categories_atomic` on a first
//! signed-in load — and that is the whole reason the cloud's category read must
//! be awaited before its transaction read. A local file has no second id space
//! to migrate from ([`super`]'s own argument for not porting that function), so
//! the category answer here is [`crate::verbs::list_categories`] and nothing
//! more. Seeding a brand-new file's defaults is `seed_categories`' job, once,
//! before this verb has anything to answer with.
//!
//! # ONE BEGIN … COMMIT, and it is a READ transaction
//!
//! PHASE3-PLAN §3 specifies it — *"load_boot (ONE BEGIN..COMMIT around six
//! reads)"* — and the reason is worth stating rather than citing, because every
//! other read in this crate deliberately opens no transaction at all. (Six was
//! the count when the plan was written; the saved reports made it seven. The
//! number is not what that clause is about.)
//!
//! A statement outside a transaction gets its own snapshot. Seven of them get
//! seven, and between any two of them another connection's write can commit. The
//! damage that does is not an abstract inconsistency: it is a boot whose
//! `transactions` include a row whose account is not in its `accounts`, or a
//! split parent whose lines were read a moment before they were written. The
//! application then draws a register filed against an account it does not know
//! about, and nothing anywhere reports an error. A transaction makes the seven
//! answers ONE snapshot of ONE file, which is what "one crossing" has to mean
//! if it is to mean anything.
//!
//! It is `DEFERRED`, spelled out rather than defaulted, because the difference
//! matters: `IMMEDIATE` would take a write lock to do no writing, and this verb
//! must never be the reason an import cannot start. What a deferred read
//! transaction does hold, in this schema's journal mode, is a SHARED lock for
//! its duration — measured at the fifty-thousand-row size in
//! `tests/reads_at_scale.rs` — so a writer arriving mid-boot waits that long
//! rather than tearing the answer in half. That is the trade, and it is the
//! right way round: the boot is the one moment when nothing else is happening
//! yet, and `db::configure`'s `busy_timeout` of five seconds is an order of
//! magnitude more than the wait.
//!
//! **The desktop is single-writer, and that is not the reason this is safe.**
//! One connection behind a mutex means the application cannot race itself; it
//! says nothing about the second process the two locks in PHASE3-PLAN §5 exist
//! to refuse, about a backup tool, or about the differential harness, which
//! opens the file from Node and from Rust in the same breath. A consistency
//! story that depends on nobody else ever opening the file is a story that is
//! true until it is not, and it would be untrue silently.
//!
//! What a test can prove about this is less than one would like, and it is
//! worth being honest about which is which. Provable, and proved below: the
//! transaction is finished rather than leaked (a leaked read transaction would
//! hold that shared lock for the life of the document, and the next call would
//! fail outright). Not provable without a second thread whose timing decides
//! the result: that a write cannot land in the middle. A flaky test that fails
//! on a busy laptop teaches people to re-run tests until they pass, so what is
//! here is the assertion that holds every time, and this paragraph is the rest.
//!
//! # It composes the reads; it does not re-implement them
//!
//! Every list below comes from the same `crate::row` function the verb of the
//! same name calls. There is no SQL in this file, and that is structural rather
//! than tidy: those functions hold the ONE copy of each query, the plan
//! assertions in `tests/reads_at_scale.rs` are made against those same strings,
//! and a second copy here would be a second query that could drift while every
//! plan assertion went on passing.
//!
//! It is also what makes the two ordering rules survive the composite (R-5).
//! `list_transactions` orders by `date DESC, id DESC` — the cloud's own key and
//! the cloud's own tie-break — and the ledger inside this answer is that answer,
//! not a re-sorted copy of it. Contract rule 79 is asserted THROUGH this call on
//! both engines, and the crate's own tie-breaks are asserted through it too, so
//! a composite that sorted, filtered or de-duplicated anything on its way out
//! has a named spec waiting for it. The archive keeps both its doors open the
//! same way: [`crate::verbs::reads`] explains why neither the ledger read nor
//! the balance read has heard of it (R-1), and a composite is not a third place
//! to have an opinion about it.
//!
//! # EXPLAIN QUERY PLAN, and what the whole thing costs
//!
//! No plan of its own: it runs no query of its own. The seven plans are the seven
//! reads', recorded in [`crate::verbs::reads`] and asserted at fifty thousand
//! rows in `tests/reads_at_scale.rs` — which also measures this verb whole, on
//! the same ledger, in the same run:
//!
//! ```text
//! load_boot                            64.3–65.6ms / 206ms
//!   of which, measured beside it:
//!   list_transactions (50,000 rows)    59.5–60.7ms / 193ms
//!   list_transaction_splits (8,000)      5.3–5.7ms /  14ms
//!   accounts + categories + budgets + goals
//!                                      under 1ms in both
//! ```
//!
//! Release / debug, serially (`--test-threads=1`), over four runs on the
//! author's machine, and recorded rather than asserted for the reason that whole
//! file gives: a time bound is a bound on whichever machine runs it. A RANGE
//! rather than one figure because four runs gave four, and the spread is bigger
//! than the thing being measured. The two heavy reads' numbers also differ from
//! the table in [`crate::verbs::reads`], taken in an earlier run — which is
//! exactly why the parts are re-measured here beside the whole rather than
//! subtracted from a table.
//!
//! **Those figures are from the run that took them and the saved reports were
//! not in it**, which is said here rather than quietly folded into the last
//! line: the seventh read arrived after that measurement. It is a
//! `SEARCH … USING INDEX idx_custom_reports_user` over a table holding a handful
//! of rows per login — the same shape and the same order of magnitude as the
//! four already on that line — so it belongs in the sub-millisecond band with
//! them, and the next run of `tests/reads_at_scale.rs` is what will say so
//! rather than this paragraph.
//!
//! **The composite costs the sum of its parts and nothing over.** One `BEGIN`
//! and one `COMMIT` around work already being done is, at this size, below the
//! noise floor of the measurement. What it replaces is not the seven reads — those
//! are the work — but the ~2.7 seconds of paged fetches the cloud RPC's own
//! commentary records for the transactions alone, and five further crossings
//! behind them.

use rusqlite::{Connection, TransactionBehavior};
use serde::Serialize;

use crate::error::CoreResult;
use crate::row::account::{self, ListedAccount};
use crate::row::budget::{self, ListedBudget};
use crate::row::category::{self, CategoryRow};
use crate::row::custom_report::{self, CustomReportRow};
use crate::row::goal::{self, GoalRow};
use crate::row::split::{self, ListedSplit};
use crate::row::{self as transaction, ListedTransaction};
use crate::verbs::reads::{Answered, OwnedRead};

/// Everything the application boots with, from one snapshot of one file.
///
/// The field ORDER is the cloud sequence's — accounts, categories, the ledger,
/// its lines, then the planning pair — so this struct can be read beside
/// `DataServiceImpl.loadBoot` and the two seen to be answering the same
/// question. Here it is presentation only: nothing inside one transaction
/// happens before anything else in a way a caller can observe, which is the
/// `fansOut: false` half of the divergence table.
#[derive(Debug, Serialize)]
pub struct Boot {
    /// Open accounts, oldest first. Their `balance` is the STORED figure.
    pub accounts: Vec<ListedAccount>,
    /// Every category, by level then name, hidden ones included.
    pub categories: Vec<CategoryRow>,
    /// The whole ledger, newest first, ARCHIVED ROWS INCLUDED.
    pub transactions: Vec<ListedTransaction>,
    /// Every split line this login owns, parent by parent, in display order.
    pub transaction_splits: Vec<ListedSplit>,
    /// Every budget, oldest first, paused ones included.
    pub budgets: Vec<ListedBudget>,
    /// Every goal, oldest first, finished ones included.
    pub goals: Vec<GoalRow>,
    /// Every saved report, oldest first. Last, because it arrived last and the
    /// order is presentation — see the struct's own note.
    pub custom_reports: Vec<CustomReportRow>,
}

/// The boot, in one answer, from one snapshot.
///
/// Takes `&mut Connection` where every other read takes `&Connection`, and the
/// difference is the point rather than an inconvenience: this verb opens a
/// transaction, so it holds the connection for its duration, and the type says
/// so before the body does.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the file cannot be read. It is NOT
/// softened into an empty answer here: seven empty lists is what a NEW FILE
/// legitimately answers with, and a verb that said the same thing about a file
/// it could not open would make the two indistinguishable. Contract rule 81 —
/// *"loadBoot never rejects"* — is kept one layer out, in `LocalDataPort`,
/// which is the same place the sentence it must say (`'load failed'`) is
/// written, and the only place that can answer for a call that did not happen.
#[allow(clippy::needless_pass_by_value)]
pub fn load_boot(connection: &mut Connection, command: OwnedRead) -> CoreResult<Answered<Boot>> {
    let owner = command.user_id;
    // DEFERRED: a read transaction. See the module docs for what it holds, for
    // how long, and for what tearing the seven answers apart would cost.
    let snapshot = connection.transaction_with_behavior(TransactionBehavior::Deferred)?;

    let answer = Boot {
        accounts: account::list_open(&snapshot, &owner)?,
        categories: category::list_all(&snapshot, &owner)?,
        transactions: transaction::list_owned(&snapshot, &owner)?,
        transaction_splits: split::list_owned(&snapshot, &owner)?,
        budgets: budget::list_all(&snapshot, &owner)?,
        goals: goal::list_all(&snapshot, &owner)?,
        custom_reports: custom_report::list_all(&snapshot, &owner)?,
    };

    // Committed rather than left to drop. Dropping a rusqlite `Transaction`
    // rolls it back, which for seven SELECTs is the same released lock and a
    // different sentence: this one ended because it was finished.
    snapshot.commit()?;
    Ok(Answered { answer })
}
