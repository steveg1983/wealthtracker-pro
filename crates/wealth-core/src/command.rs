//! The command surface itself: every verb this crate answers to, the one
//! dispatch that answers them, and the envelope the answer travels in.
//!
//! Four functions, in the order a command meets them: [`parse`] turns text into
//! a typed [`Command`], [`plan`] answers the ones that need no database,
//! [`dispatch`] runs the rest against a connection, and [`respond`] puts the
//! outcome in the envelope.
//!
//! # Why this is in the library and not in the bin that used to hold it
//!
//! Two callers need this match and there must not be two matches.
//!
//! The first is `bin/wealth_core_cli.rs`, the differential harness's bridge:
//! `scripts/local-sqlite/verbs.mjs` drives it once per spec and compares every
//! answer against the live Postgres RPC. The second is the desktop shell, whose
//! whole Rust surface is ONE `#[tauri::command] wealth_core_invoke(verb,
//! payload)` over this same enum — PHASE3-PLAN D-3, which rejected forty
//! separate Tauri commands for precisely this reason: it *"duplicates the
//! exhaustive dispatch"*, and a verb set that exists twice is a verb set whose
//! two halves agree until the day they do not.
//!
//! The bin cannot be that shared home. `Cargo.toml` puts it behind
//! `required-features = ["cli"]` so the shell cannot ship it, and Cargo never
//! builds a dependency's bin targets in any case. A library module is reachable
//! from both; a bin is reachable from neither the other way round.
//!
//! What stays in the bin is what is genuinely the command line's: argument
//! parsing, stdin and stdout, and the exit code.
//!
//! # The property that must stay singular
//!
//! [`dispatch`] is ONE match with no catch-all arm. Add a variant to [`Command`]
//! and forget to arm it and the crate does not compile — the compiler refusing a
//! verb nobody dispatched. That is the whole of R-10, and it is only a property
//! while there is one match to hold it: a second dispatch elsewhere would each
//! be exhaustive over its own arms and neither would notice the other's gap.
//!
//! # This is not a SQL surface
//!
//! DESIGN.md §6.4: *"There is no command that accepts a SQL string. You cannot
//! bypass what does not exist."* A command is `{"verb": …, "payload": …}`,
//! deserialised by serde into a typed payload. A payload that is not a known
//! verb is refused; a payload with an unrecognised field is refused. Neither
//! refusal touches a connection — [`parse`] runs before anything is opened —
//! and there is no branch anywhere below that concatenates a caller's text into
//! a statement.
//!
//! # The envelope
//!
//! ```text
//! {"ok":true,  "result": …}
//! {"ok":false, "error": {"code": …, "message": …, "hint": …}}
//! ```
//!
//! A refusal is an ANSWER and rides in that second shape with `ok:false`. A
//! storage fault is not an answer: [`respond`] returns `Err` for it, and each
//! caller shows it out by its own door — a non-zero exit and a line on stderr
//! for the CLI, a rejected promise for the shell. The harness relies on the
//! distinction (`lib/verb-sqlite.mjs`: *"A non-zero exit is a FAULT, never a
//! refusal"*) and so does the seam: a refusal's `message` is the prose the user
//! reads, so it must not be prefixed, wrapped or re-worded on its way out.
//!
//! # Why [`parse`] takes text rather than a `serde_json::Value`
//!
//! Because the two are not the same refusal. `from_str` reports the line and
//! column of the offending byte and `from_value` cannot, so a second entry
//! point would put two different `message` strings on the wire for one mistake.
//! Which one the shell sends is a decision about the wire rather than a
//! convenience, and it belongs to the commit that gives the shell a caller.

use serde::{Deserialize, Serialize};

use crate::admission::{
    plan_account_identifier_match, plan_account_identifiers, plan_category_admission,
    plan_cleared_flag, plan_feed_overlap, plan_statement_bank_balance, plan_statement_duplicates,
    PlanAccountIdentifierMatch, PlanAccountIdentifiers, PlanCategoryAdmission, PlanClearedFlag,
    PlanFeedOverlap, PlanStatementBankBalance, PlanStatementDuplicates,
};
use crate::error::CoreError;
use crate::verbs::{
    account_balances, apply_category_to_uncategorized, clear_transfer_links,
    confirm_transaction_categories, create_transaction, create_transfer_counterpart,
    delete_transaction, delete_unused_categories, finalize_user_restore, import_bank_transactions,
    import_transactions, link_bank_account_snap, link_split_line_transfer, link_transfer_pair,
    list_accounts, list_budgets, list_categories, list_closed_accounts, list_goals,
    list_suggestion_dismissals, list_transaction_splits, list_transactions, merge_categories,
    repair_claimed_transfer, restore_user_chunk, set_transaction_splits_with_legs, splits_for,
    update_transaction, user_financial_data_is_empty, verify_integrity, wipe_user_financial_data,
    ApplyCategoryToUncategorized, ClearTransferLinks, ConfirmTransactionCategories,
    CreateTransaction, CreateTransferCounterpart, DeleteTransaction, DeleteUnusedCategories,
    FinalizeUserRestore, ImportBankTransactions, ImportTransactions, LinkBankAccountSnap,
    LinkSplitLineTransfer, LinkTransferPair, MergeCategories, OwnedRead, RepairClaimedTransfer,
    RestoreUserChunk, SetTransactionSplitsWithLegs, SplitsFor, UpdateTransaction,
    UserFinancialDataIsEmpty, VerifyIntegrity, WipeUserFinancialData,
};

/// A command, as a caller sends it.
///
/// One JSON object per verb, and the object is the same one the Postgres side
/// receives — the update and delete RPCs take their arguments positionally
/// (`(p_id, p, p_user_id)`), so `lib/verb-postgres.mjs` unpacks the same object
/// into that call rather than either side getting a payload of its own.
// The shared postfix is the point: `serde(rename_all = "snake_case")` turns
// these names into the wire's verb strings, so `CreateTransaction` IS
// `"create_transaction"`. Shortening them to please the lint would rename the
// protocol.
#[allow(clippy::enum_variant_names)]
#[derive(Debug, Deserialize)]
#[serde(tag = "verb", content = "payload", rename_all = "snake_case")]
pub enum Command {
    /// [`crate::verbs::create_transaction`].
    CreateTransaction(Box<CreateTransaction>),
    /// [`crate::verbs::update_transaction`].
    UpdateTransaction(Box<UpdateTransaction>),
    /// [`crate::verbs::delete_transaction`].
    DeleteTransaction(Box<DeleteTransaction>),
    // Named for the RPC it ports, not for the older `set_transaction_splits`
    // that is deliberately left alone in the cloud. The two are different write
    // paths with different rules, and a verb string that could mean either is a
    // verb string that will one day mean the wrong one.
    /// [`crate::verbs::set_transaction_splits_with_legs`].
    SetTransactionSplitsWithLegs(Box<SetTransactionSplitsWithLegs>),
    // The transfer family. Five RPCs, five verb strings, each spelled exactly as
    // the function it ports — including `clear_transfer_links`, which is what
    // the client's `clearTransferLinks` actually calls (it stopped being a table
    // UPDATE in 20260805145035, and the verb's docs record how that was
    // established rather than assumed).
    /// [`crate::verbs::link_transfer_pair`].
    LinkTransferPair(Box<LinkTransferPair>),
    /// [`crate::verbs::create_transfer_counterpart`].
    CreateTransferCounterpart(Box<CreateTransferCounterpart>),
    /// [`crate::verbs::clear_transfer_links`].
    ClearTransferLinks(Box<ClearTransferLinks>),
    /// [`crate::verbs::repair_claimed_transfer`].
    RepairClaimedTransfer(Box<RepairClaimedTransfer>),
    /// [`crate::verbs::link_split_line_transfer`].
    LinkSplitLineTransfer(Box<LinkSplitLineTransfer>),
    // The category family. Three verb strings, each spelled exactly as the
    // function it ports — including the two from 20260808100000, whose LIVE
    // definitions are the ones ported (`apply_category_to_uncategorized` has
    // three definitions across three migrations and only the newest counts).
    /// [`crate::verbs::merge_categories`].
    MergeCategories(Box<MergeCategories>),
    /// [`crate::verbs::apply_category_to_uncategorized`].
    ApplyCategoryToUncategorized(Box<ApplyCategoryToUncategorized>),
    /// [`crate::verbs::confirm_transaction_categories`].
    ConfirmTransactionCategories(Box<ConfirmTransactionCategories>),
    // The fourth category verb, and the one whose every protection is a WHERE
    // clause rather than a RAISE. Same name as the RPC it ports; the count it
    // returns is the RPC's, which is not the count SQLite's own single-statement
    // spelling would give (see the verb's module documentation).
    /// [`crate::verbs::delete_unused_categories`].
    DeleteUnusedCategories(Box<DeleteUnusedCategories>),
    // The restore family. Four verb strings, each spelled exactly as the
    // function it ports — including `restore_user_chunk`, whose LOCAL payload
    // carries a LIST of chunks because the whole restore is one transaction here
    // (DESIGN.md §5 divergence 6). The name is kept singular because a verb
    // string that differs from the function it ports is a verb string that will
    // one day be mapped to the wrong function.
    /// [`crate::verbs::user_financial_data_is_empty`].
    UserFinancialDataIsEmpty(Box<UserFinancialDataIsEmpty>),
    /// [`crate::verbs::wipe_user_financial_data`].
    WipeUserFinancialData(Box<WipeUserFinancialData>),
    /// [`crate::verbs::restore_user_chunk`].
    RestoreUserChunk(Box<RestoreUserChunk>),
    /// [`crate::verbs::finalize_user_restore`].
    FinalizeUserRestore(Box<FinalizeUserRestore>),
    // The account snap: service-role only in the cloud, and the one function in
    // the schema that assigns an absolute balance without breaking B-1.
    /// [`crate::verbs::link_bank_account_snap`].
    LinkBankAccountSnap(Box<LinkBankAccountSnap>),
    // The ingest surface. Two verb strings, each spelled as the function it
    // ports minus the `_atomic` every verb in this crate drops.
    //
    // PHASE1-PLAN §3.2 also lists an `import_transactions`, and it is NOT this
    // one: that is the admission-control verb over `RawRow`, which decides what
    // a file's text MEANS before anything is stored. This is the write path such
    // a verb would end in — the port of the RPC that exists today. Named here
    // rather than left to be discovered, because two things called
    // `import_transactions` is exactly how the wrong one gets called.
    /// [`crate::verbs::import_transactions`].
    ImportTransactions(Box<ImportTransactions>),
    /// [`crate::verbs::import_bank_transactions`].
    ImportBankTransactions(Box<ImportBankTransactions>),
    // ── The reads ────────────────────────────────────────────────────────────
    //
    // Ten verbs that answer and write nothing. Nine are named for the question
    // they answer rather than for a function they port, because there is no
    // function to port: the cloud reads those tables over PostgREST, so what is
    // ported is a QUERY — its filter and its ORDER BY, spelled out in
    // [`crate::verbs::reads`] alongside the plan each one was measured to use.
    //
    // `list_closed_accounts` is a second verb rather than a flag on the first,
    // and that is the naming discipline rather than an accident: two questions
    // get two names, and a payload with `{"open": false}` in it is a payload
    // that will one day be sent by mistake.
    //
    // Nine of the ten share ONE payload type — an owner, and nothing else. The
    // dispatch stays exhaustive over VARIANTS, so an eleventh read still has to
    // be armed below or the crate does not compile.
    /// [`crate::verbs::list_accounts`].
    ListAccounts(Box<OwnedRead>),
    /// [`crate::verbs::list_closed_accounts`].
    ListClosedAccounts(Box<OwnedRead>),
    /// [`crate::verbs::list_categories`].
    ListCategories(Box<OwnedRead>),
    /// [`crate::verbs::list_budgets`].
    ListBudgets(Box<OwnedRead>),
    /// [`crate::verbs::list_goals`].
    ListGoals(Box<OwnedRead>),
    /// [`crate::verbs::list_suggestion_dismissals`].
    ListSuggestionDismissals(Box<OwnedRead>),
    // The heavy four. They differ from the six above in what they run over —
    // one person's whole history rather than a page of settings — which is why
    // their plans are measured at 50k rows in [`crate::verbs::reads`] rather
    // than argued from the size of a list of accounts.
    //
    // `account_balances` is the only read here that IS a port of a function
    // (`20260722160000`), and the only verb in the crate that answers with money
    // it computed rather than money it stored. Its four properties are in
    // [`crate::row::balance`].
    //
    // `splits_for` is the one read with a payload of its own, because it names a
    // PARENT. The seam spells the distinction with a suffix —
    // `listTransactionSplits` against `listTransactionSplitsFor` — and the verb
    // strings keep it.
    /// [`crate::verbs::list_transactions`].
    ListTransactions(Box<OwnedRead>),
    /// [`crate::verbs::list_transaction_splits`].
    ListTransactionSplits(Box<OwnedRead>),
    /// [`crate::verbs::splits_for`].
    SplitsFor(Box<SplitsFor>),
    /// [`crate::verbs::account_balances`].
    AccountBalances(Box<OwnedRead>),
    // The only verb here that is NOT a port: the cloud has no verify_integrity,
    // no view and no equivalent, and the verb's module documentation carries the
    // trace that establishes it. Its payload is `{}` — it takes not even an
    // owner, because integrity is a property of the file.
    /// [`crate::verbs::verify_integrity`].
    VerifyIntegrity(Box<VerifyIntegrity>),
    // ── The admission surface ────────────────────────────────────────────────
    //
    // Seven commands that decide what a parsed row MEANS, and write nothing.
    // They are dispatched by `plan` below, BEFORE the database is opened, and
    // handing one a database is a fault: see that function for why the refusal
    // is worth more than the convenience.
    //
    // None of these is a port of a Postgres function — there is none to port.
    // Their oracle is the TypeScript module each one names, executed side by
    // side with this crate by `scripts/local-sqlite/admission.mjs`.
    /// [`crate::admission::plan_statement_duplicates`].
    PlanStatementDuplicates(Box<PlanStatementDuplicates>),
    /// [`crate::admission::plan_statement_bank_balance`].
    PlanStatementBankBalance(Box<PlanStatementBankBalance>),
    /// [`crate::admission::plan_feed_overlap`].
    PlanFeedOverlap(Box<PlanFeedOverlap>),
    /// [`crate::admission::plan_cleared_flag`].
    PlanClearedFlag(Box<PlanClearedFlag>),
    /// [`crate::admission::plan_account_identifiers`].
    PlanAccountIdentifiers(Box<PlanAccountIdentifiers>),
    /// [`crate::admission::plan_account_identifier_match`].
    PlanAccountIdentifierMatch(Box<PlanAccountIdentifierMatch>),
    /// [`crate::admission::plan_category_admission`].
    PlanCategoryAdmission(Box<PlanCategoryAdmission>),
}

/// Read one command out of its JSON text.
///
/// # Errors
/// The refusal to send back, ready-made: a malformed command is a REFUSAL, not
/// a fault. The caller asked for something and is being told no, in the same
/// envelope every other no arrives in — and it is told before a file is opened,
/// which is what makes "an unknown verb never reaches a connection" a fact
/// about the code rather than a claim about it.
pub fn parse(input: &str) -> Result<Command, Response> {
    serde_json::from_str(input).map_err(|error| {
        let message = error.to_string();
        Response::Error {
            ok: false,
            error: ErrorBody {
                code: boundary_code(&message),
                message,
                hint: None,
            },
        }
    })
}

/// Recover the machine code from a serde error message.
///
/// A `Deserialize` implementation can only fail with prose, so `Money`'s
/// refusals arrive here as text with their code embedded. Without this, a
/// sub-penny amount — a named, decided, tested refusal — would be reported as
/// a generic `invalid_command`, and a spec could not tell it from a typo.
///
/// `unknown_field` is here for the same reason and is the local edition's
/// DECLARED divergence from `update_transaction_atomic`, which discards a key it
/// does not know. A divergence that reports as `invalid_command` is
/// indistinguishable from a malformed request, and the whole point of it is that
/// the caller can tell the difference.
fn boundary_code(message: &str) -> String {
    if let Some(code) = crate::money::BOUNDARY_CODES
        .iter()
        .find(|code| message.contains(*code))
    {
        return (*code).to_owned();
    }
    // serde's own wording for `deny_unknown_fields`. Matched on the prefix
    // rather than reconstructed, because the rest of the message names the key
    // and lists the ones that were expected, and that is the useful half.
    if message.starts_with("unknown field") {
        return "unknown_field".to_owned();
    }
    "invalid_command".to_owned()
}

/// The admission commands, answered without a database.
///
/// # Errors
/// `Err(command)` hands a write verb back untouched, so the write dispatch
/// below stays exhaustive: a verb added to [`Command`] and forgotten here falls
/// through to that match and fails to compile, which is the failure everybody
/// wants and nobody gets from a catch-all on both sides.
///
/// The `Ok` is itself a result, because a planner can refuse.
pub fn plan(command: Command) -> Result<Result<serde_json::Value, CoreError>, Command> {
    match command {
        Command::PlanStatementDuplicates(payload) => {
            Ok(as_json(plan_statement_duplicates(&payload)))
        }
        Command::PlanStatementBankBalance(payload) => {
            Ok(as_json(plan_statement_bank_balance(&payload)))
        }
        Command::PlanFeedOverlap(payload) => Ok(as_json(plan_feed_overlap(&payload))),
        Command::PlanClearedFlag(payload) => Ok(as_json(plan_cleared_flag(&payload))),
        Command::PlanAccountIdentifiers(payload) => Ok(as_json(plan_account_identifiers(&payload))),
        Command::PlanAccountIdentifierMatch(payload) => {
            Ok(as_json(plan_account_identifier_match(&payload)))
        }
        Command::PlanCategoryAdmission(payload) => Ok(as_json(plan_category_admission(&payload))),
        other => Err(other),
    }
}

/// Run one write verb against an open ledger.
///
/// THE match, and the one place a verb string becomes a call. Spelling every
/// variant out rather than writing `_` is what makes the compiler refuse a NEW
/// verb that nobody dispatched; see this module's documentation for why that
/// property only holds while there is exactly one of these.
///
/// # Errors
/// [`CoreError`] as the verb returns it: a [`CoreError::Refused`] is the ledger
/// declining and the file is intact, a [`CoreError::Storage`] is a fault.
pub fn dispatch(
    connection: &mut rusqlite::Connection,
    command: Command,
) -> Result<serde_json::Value, CoreError> {
    match command {
        Command::CreateTransaction(payload) => {
            create_transaction(connection, *payload).and_then(as_json)
        }
        Command::UpdateTransaction(payload) => {
            update_transaction(connection, *payload).and_then(as_json)
        }
        Command::DeleteTransaction(payload) => {
            delete_transaction(connection, *payload).and_then(as_json)
        }
        Command::SetTransactionSplitsWithLegs(payload) => {
            set_transaction_splits_with_legs(connection, *payload).and_then(as_json)
        }
        Command::LinkTransferPair(payload) => {
            link_transfer_pair(connection, *payload).and_then(as_json)
        }
        Command::CreateTransferCounterpart(payload) => {
            create_transfer_counterpart(connection, *payload).and_then(as_json)
        }
        Command::ClearTransferLinks(payload) => {
            clear_transfer_links(connection, *payload).and_then(as_json)
        }
        Command::RepairClaimedTransfer(payload) => {
            repair_claimed_transfer(connection, *payload).and_then(as_json)
        }
        Command::LinkSplitLineTransfer(payload) => {
            link_split_line_transfer(connection, *payload).and_then(as_json)
        }
        Command::MergeCategories(payload) => {
            merge_categories(connection, *payload).and_then(as_json)
        }
        Command::ApplyCategoryToUncategorized(payload) => {
            apply_category_to_uncategorized(connection, *payload).and_then(as_json)
        }
        Command::ConfirmTransactionCategories(payload) => {
            confirm_transaction_categories(connection, *payload).and_then(as_json)
        }
        Command::DeleteUnusedCategories(payload) => {
            delete_unused_categories(connection, *payload).and_then(as_json)
        }
        // The only verb that needs no `&mut`: it opens no transaction, because
        // it writes nothing.
        Command::UserFinancialDataIsEmpty(payload) => {
            user_financial_data_is_empty(&*connection, *payload).and_then(as_json)
        }
        Command::WipeUserFinancialData(payload) => {
            wipe_user_financial_data(connection, *payload).and_then(as_json)
        }
        Command::RestoreUserChunk(payload) => {
            restore_user_chunk(connection, *payload).and_then(as_json)
        }
        Command::FinalizeUserRestore(payload) => {
            finalize_user_restore(connection, *payload).and_then(as_json)
        }
        Command::LinkBankAccountSnap(payload) => {
            link_bank_account_snap(connection, *payload).and_then(as_json)
        }
        Command::ImportTransactions(payload) => {
            import_transactions(connection, *payload).and_then(as_json)
        }
        Command::ImportBankTransactions(payload) => {
            import_bank_transactions(connection, *payload).and_then(as_json)
        }
        // The second verb that needs no `&mut`, and for the same reason as the
        // first: it writes nothing.
        Command::VerifyIntegrity(payload) => {
            verify_integrity(&*connection, *payload).and_then(as_json)
        }
        // The reads, and every one of them takes `&*connection` for the same
        // reason those two do: a read opens no transaction. Ten arms rather
        // than one `Command::List…(_) => list(…)` helper, because the enum's
        // whole property is that each variant is spelled once here — an arm
        // that dispatched several verbs through one function would be a place
        // for two of them to become the same answer without the compiler
        // noticing.
        Command::ListAccounts(payload) => list_accounts(&*connection, *payload).and_then(as_json),
        Command::ListClosedAccounts(payload) => {
            list_closed_accounts(&*connection, *payload).and_then(as_json)
        }
        Command::ListCategories(payload) => {
            list_categories(&*connection, *payload).and_then(as_json)
        }
        Command::ListBudgets(payload) => list_budgets(&*connection, *payload).and_then(as_json),
        Command::ListGoals(payload) => list_goals(&*connection, *payload).and_then(as_json),
        Command::ListSuggestionDismissals(payload) => {
            list_suggestion_dismissals(&*connection, *payload).and_then(as_json)
        }
        Command::ListTransactions(payload) => {
            list_transactions(&*connection, *payload).and_then(as_json)
        }
        Command::ListTransactionSplits(payload) => {
            list_transaction_splits(&*connection, *payload).and_then(as_json)
        }
        Command::SplitsFor(payload) => splits_for(&*connection, *payload).and_then(as_json),
        Command::AccountBalances(payload) => {
            account_balances(&*connection, *payload).and_then(as_json)
        }
        // A self-check with a name, and the same shape as the split writer's
        // `split_write_inconsistent`: [`plan`] above answers every one of these
        // and returns before a file is ever opened, so nothing can arrive here.
        // Spelling the seven names out rather than writing `_` is what makes
        // the compiler refuse a NEW verb that nobody dispatched — and if a plan
        // verb is ever added to this arm and forgotten in [`plan`], the caller
        // is told so by name instead of being handed a connection.
        Command::PlanStatementDuplicates(_)
        | Command::PlanStatementBankBalance(_)
        | Command::PlanFeedOverlap(_)
        | Command::PlanClearedFlag(_)
        | Command::PlanAccountIdentifiers(_)
        | Command::PlanAccountIdentifierMatch(_)
        | Command::PlanCategoryAdmission(_) => Err(CoreError::InvalidCommand(
            "plan_dispatch_missed: an admission command reached the write dispatch".to_owned(),
        )),
    }
}

/// One verb's outcome, as the wire's response.
///
/// # Errors
/// A storage fault is `Err`: the caller must be able to tell "the verb refused"
/// from "the harness is broken", and the two leave by different doors.
pub fn respond(outcome: Result<serde_json::Value, CoreError>) -> Result<Response, String> {
    Ok(match outcome {
        Ok(result) => Response::Ok { ok: true, result },
        Err(CoreError::Storage(error)) => return Err(format!("storage fault: {error}")),
        Err(CoreError::Refused(refusal)) => Response::Error {
            ok: false,
            error: ErrorBody {
                code: refusal.code().to_owned(),
                message: refusal.message().to_owned(),
                hint: refusal.hint().map(ToOwned::to_owned),
            },
        },
        Err(error @ CoreError::InvalidCommand(_)) => Response::Error {
            ok: false,
            error: ErrorBody {
                code: error.code().to_owned(),
                message: error.to_string(),
                hint: None,
            },
        },
    })
}

/// The envelope. `ok` is a field rather than a tag because it is read by
/// callers that never learn Rust exists.
#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum Response {
    /// The verb answered. `ok` is always `true`.
    Ok {
        /// Always `true`.
        ok: bool,
        /// What the verb returned, serialised.
        result: serde_json::Value,
    },
    /// The verb, or the parse before it, said no. `ok` is always `false`.
    Error {
        /// Always `false`.
        ok: bool,
        /// The refusal.
        error: ErrorBody,
    },
}

/// A refusal on the wire: a name to match on, a sentence to show, and
/// sometimes a second sentence saying what to do about it.
#[derive(Debug, Serialize)]
pub struct ErrorBody {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    hint: Option<String>,
}

/// Every verb's result serialises the same way, and every one of them carries a
/// `transaction` key the harness reads. One function so a fourth verb cannot
/// invent a third shape.
fn as_json<T: Serialize>(result: T) -> Result<serde_json::Value, CoreError> {
    serde_json::to_value(&result)
        .map_err(|error| CoreError::InvalidCommand(format!("result: {error}")))
}
