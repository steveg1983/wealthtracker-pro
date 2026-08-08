//! The differential harness's bridge into the command layer.
//!
//! ```text
//! wealth-core-cli --db <path>        JSON command on stdin, JSON result on stdout
//! wealth-core-cli --apply-schema --db <path>   create the file and apply the schema
//! wealth-core-cli --version                    engine and crate versions, as JSON
//! ```
//!
//! # Why a spawned binary and not a native Node addon
//!
//! `scripts/local-sqlite/lib/sqlite.mjs` states the constraint this repo already
//! decided: *"this repo ships a browser bundle and a Vercel function set —
//! adding a native, node-gyp-compiled devDependency for a schema harness buys a
//! prebuild/rebuild failure mode on every `npm ci`"*. A napi-rs binding would be
//! exactly that devDependency. A spawned binary has **zero** npm surface: the
//! harness runs it if it is built and says so plainly if it is not, and
//! `npm ci` never learns Rust exists.
//!
//! The Node runner already drives `psql` this way — one process per spec, JSON
//! or text out — so the two engines are driven by the same shape and neither
//! gets a structural advantage in the comparison.
//!
//! The cost is a process spawn per command. MEASURED, 40 runs after 3 warm-ups
//! on an M-series laptop: median **2.50 ms**, min 2.20, p95 3.42; the whole
//! 16-spec suite including the Postgres side is 0.66 s wall clock. A long-lived
//! JSON-lines daemon would save single-digit milliseconds in exchange for a
//! failure mode — a hung child holding a write lock on the temp database — that
//! is much worse than the latency it saves.
//!
//! # Why the Node side owns the file and the Rust side only writes to it
//!
//! The harness creates the temp database, applies `schema.sql` and the fixture
//! with `node:sqlite`, then calls this binary, then re-opens the file to run its
//! assertions. So the verb is exercised against the **vendored** schema, applied
//! by the same code path that applies it for the existing 54 constraint specs —
//! not against a copy this crate keeps. `--apply-schema` exists only for the
//! crate's own integration tests, which have no Node runner to do it for them.
//!
//! # This is not a SQL surface
//!
//! DESIGN.md §6.4: *"There is no command that accepts a SQL string. You cannot
//! bypass what does not exist."* This binary takes `{"verb": …, "payload": …}`,
//! deserialised by serde into a typed command. A payload that is not a known
//! verb is refused; a payload with an unrecognised field is refused. There is no
//! branch here that concatenates anything into a statement.

use std::io::Read;
use std::path::PathBuf;
use std::process::ExitCode;

use serde::{Deserialize, Serialize};
use wealth_core::db;
use wealth_core::error::CoreError;
use wealth_core::verbs::{
    apply_category_to_uncategorized, clear_transfer_links, confirm_transaction_categories,
    create_transaction, create_transfer_counterpart, delete_transaction,
    delete_unused_categories, finalize_user_restore, import_bank_transactions,
    import_transactions, link_bank_account_snap, link_split_line_transfer, link_transfer_pair,
    merge_categories, repair_claimed_transfer, restore_user_chunk,
    set_transaction_splits_with_legs, update_transaction, user_financial_data_is_empty,
    verify_integrity, wipe_user_financial_data, ApplyCategoryToUncategorized, ClearTransferLinks,
    ConfirmTransactionCategories, CreateTransaction, CreateTransferCounterpart, DeleteTransaction,
    DeleteUnusedCategories, FinalizeUserRestore, ImportBankTransactions, ImportTransactions,
    LinkBankAccountSnap, LinkSplitLineTransfer, LinkTransferPair, MergeCategories,
    RepairClaimedTransfer, RestoreUserChunk, SetTransactionSplitsWithLegs, UpdateTransaction,
    UserFinancialDataIsEmpty, VerifyIntegrity, WipeUserFinancialData,
};

/// A command, as the harness sends it.
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
enum Command {
    CreateTransaction(Box<CreateTransaction>),
    UpdateTransaction(Box<UpdateTransaction>),
    DeleteTransaction(Box<DeleteTransaction>),
    // Named for the RPC it ports, not for the older `set_transaction_splits`
    // that is deliberately left alone in the cloud. The two are different write
    // paths with different rules, and a verb string that could mean either is a
    // verb string that will one day mean the wrong one.
    SetTransactionSplitsWithLegs(Box<SetTransactionSplitsWithLegs>),
    // The transfer family. Five RPCs, five verb strings, each spelled exactly as
    // the function it ports — including `clear_transfer_links`, which is what
    // the client's `clearTransferLinks` actually calls (it stopped being a table
    // UPDATE in 20260805145035, and the verb's docs record how that was
    // established rather than assumed).
    LinkTransferPair(Box<LinkTransferPair>),
    CreateTransferCounterpart(Box<CreateTransferCounterpart>),
    ClearTransferLinks(Box<ClearTransferLinks>),
    RepairClaimedTransfer(Box<RepairClaimedTransfer>),
    LinkSplitLineTransfer(Box<LinkSplitLineTransfer>),
    // The category family. Three verb strings, each spelled exactly as the
    // function it ports — including the two from 20260808100000, whose LIVE
    // definitions are the ones ported (`apply_category_to_uncategorized` has
    // three definitions across three migrations and only the newest counts).
    MergeCategories(Box<MergeCategories>),
    ApplyCategoryToUncategorized(Box<ApplyCategoryToUncategorized>),
    ConfirmTransactionCategories(Box<ConfirmTransactionCategories>),
    // The fourth category verb, and the one whose every protection is a WHERE
    // clause rather than a RAISE. Same name as the RPC it ports; the count it
    // returns is the RPC's, which is not the count SQLite's own single-statement
    // spelling would give (see the verb's module documentation).
    DeleteUnusedCategories(Box<DeleteUnusedCategories>),
    // The restore family. Four verb strings, each spelled exactly as the
    // function it ports — including `restore_user_chunk`, whose LOCAL payload
    // carries a LIST of chunks because the whole restore is one transaction here
    // (DESIGN.md §5 divergence 6). The name is kept singular because a verb
    // string that differs from the function it ports is a verb string that will
    // one day be mapped to the wrong function.
    UserFinancialDataIsEmpty(Box<UserFinancialDataIsEmpty>),
    WipeUserFinancialData(Box<WipeUserFinancialData>),
    RestoreUserChunk(Box<RestoreUserChunk>),
    FinalizeUserRestore(Box<FinalizeUserRestore>),
    // The account snap: service-role only in the cloud, and the one function in
    // the schema that assigns an absolute balance without breaking B-1.
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
    ImportTransactions(Box<ImportTransactions>),
    ImportBankTransactions(Box<ImportBankTransactions>),
    // The only verb here that is NOT a port: the cloud has no verify_integrity,
    // no view and no equivalent, and the verb's module documentation carries the
    // trace that establishes it. Its payload is `{}` — it takes not even an
    // owner, because integrity is a property of the file.
    VerifyIntegrity(Box<VerifyIntegrity>),
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum Response {
    Ok { ok: bool, result: serde_json::Value },
    Error { ok: bool, error: ErrorBody },
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    hint: Option<String>,
}

fn main() -> ExitCode {
    match run() {
        Ok(response) => {
            print(&response);
            ExitCode::SUCCESS
        }
        // A harness fault — a missing file, an unreadable stdin, a schema that
        // will not apply. Deliberately NOT a JSON error body: the runner must be
        // able to tell "the verb refused" from "the harness is broken", and the
        // existing runner already makes that distinction for Postgres.
        Err(fault) => {
            eprintln!("wealth-core-cli: {fault}");
            ExitCode::FAILURE
        }
    }
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
    if let Some(code) = wealth_core::money::BOUNDARY_CODES
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

/// Every verb's result serialises the same way, and every one of them carries a
/// `transaction` key the harness reads. One function so a fourth verb cannot
/// invent a third shape.
fn as_json<T: Serialize>(result: T) -> Result<serde_json::Value, CoreError> {
    serde_json::to_value(&result)
        .map_err(|error| CoreError::InvalidCommand(format!("result: {error}")))
}

fn print(response: &Response) {
    match serde_json::to_string(response) {
        Ok(text) => println!("{text}"),
        Err(error) => eprintln!("wealth-core-cli: could not serialise response: {error}"),
    }
}

fn run() -> Result<Response, String> {
    let mut database: Option<PathBuf> = None;
    let mut apply_schema = false;
    let mut show_version = false;

    let mut args = std::env::args().skip(1);
    while let Some(argument) = args.next() {
        match argument.as_str() {
            "--db" => database = args.next().map(PathBuf::from),
            "--apply-schema" => apply_schema = true,
            "--version" => show_version = true,
            other => return Err(format!("unknown argument {other}")),
        }
    }

    if show_version {
        return Ok(Response::Ok {
            ok: true,
            result: serde_json::json!({
                "crate": env!("CARGO_PKG_VERSION"),
                "rusqlite": rusqlite::version(),
            }),
        });
    }

    let path = database.ok_or_else(|| "--db <path> is required".to_owned())?;

    if apply_schema {
        let connection = rusqlite::Connection::open(&path).map_err(|error| error.to_string())?;
        db::configure(&connection).map_err(|error| error.to_string())?;
        wealth_core::apply_schema(&connection).map_err(|error| error.to_string())?;
        return Ok(Response::Ok {
            ok: true,
            result: serde_json::json!({ "schema": "applied" }),
        });
    }

    let mut input = String::new();
    std::io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| format!("could not read the command from stdin: {error}"))?;

    // A malformed command is a REFUSAL, not a fault: the harness asked for
    // something and is being told no. Only the transport is a fault.
    let command: Command = match serde_json::from_str(&input) {
        Ok(command) => command,
        Err(error) => {
            let message = error.to_string();
            return Ok(Response::Error {
                ok: false,
                error: ErrorBody {
                    code: boundary_code(&message),
                    message,
                    hint: None,
                },
            });
        }
    };

    let mut connection = db::open(&path).map_err(|error| error.to_string())?;

    let outcome = match command {
        Command::CreateTransaction(payload) => {
            create_transaction(&mut connection, *payload).and_then(as_json)
        }
        Command::UpdateTransaction(payload) => {
            update_transaction(&mut connection, *payload).and_then(as_json)
        }
        Command::DeleteTransaction(payload) => {
            delete_transaction(&mut connection, *payload).and_then(as_json)
        }
        Command::SetTransactionSplitsWithLegs(payload) => {
            set_transaction_splits_with_legs(&mut connection, *payload).and_then(as_json)
        }
        Command::LinkTransferPair(payload) => {
            link_transfer_pair(&mut connection, *payload).and_then(as_json)
        }
        Command::CreateTransferCounterpart(payload) => {
            create_transfer_counterpart(&mut connection, *payload).and_then(as_json)
        }
        Command::ClearTransferLinks(payload) => {
            clear_transfer_links(&mut connection, *payload).and_then(as_json)
        }
        Command::RepairClaimedTransfer(payload) => {
            repair_claimed_transfer(&mut connection, *payload).and_then(as_json)
        }
        Command::LinkSplitLineTransfer(payload) => {
            link_split_line_transfer(&mut connection, *payload).and_then(as_json)
        }
        Command::MergeCategories(payload) => {
            merge_categories(&mut connection, *payload).and_then(as_json)
        }
        Command::ApplyCategoryToUncategorized(payload) => {
            apply_category_to_uncategorized(&mut connection, *payload).and_then(as_json)
        }
        Command::ConfirmTransactionCategories(payload) => {
            confirm_transaction_categories(&mut connection, *payload).and_then(as_json)
        }
        Command::DeleteUnusedCategories(payload) => {
            delete_unused_categories(&mut connection, *payload).and_then(as_json)
        }
        // The only verb that needs no `&mut`: it opens no transaction, because
        // it writes nothing.
        Command::UserFinancialDataIsEmpty(payload) => {
            user_financial_data_is_empty(&connection, *payload).and_then(as_json)
        }
        Command::WipeUserFinancialData(payload) => {
            wipe_user_financial_data(&mut connection, *payload).and_then(as_json)
        }
        Command::RestoreUserChunk(payload) => {
            restore_user_chunk(&mut connection, *payload).and_then(as_json)
        }
        Command::FinalizeUserRestore(payload) => {
            finalize_user_restore(&mut connection, *payload).and_then(as_json)
        }
        Command::LinkBankAccountSnap(payload) => {
            link_bank_account_snap(&mut connection, *payload).and_then(as_json)
        }
        Command::ImportTransactions(payload) => {
            import_transactions(&mut connection, *payload).and_then(as_json)
        }
        Command::ImportBankTransactions(payload) => {
            import_bank_transactions(&mut connection, *payload).and_then(as_json)
        }
        // The second verb that needs no `&mut`, and for the same reason as the
        // first: it writes nothing.
        Command::VerifyIntegrity(payload) => {
            verify_integrity(&connection, *payload).and_then(as_json)
        }
    };

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
