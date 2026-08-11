//! The desktop shell — a body for the ledger core.
//!
//! # ONE command for the ledger, and what that buys (PHASE3-PLAN D-3)
//!
//! [`wealth_core_invoke`] is the whole of this program's money surface. One verb
//! string, one payload, one envelope, over `wealth_core::command`'s
//! `parse` → `plan` → `dispatch` → `respond` — which is the SAME four functions
//! and the SAME single match the differential harness's CLI runs.
//!
//! `command.rs` states why it is one and not forty:
//!
//! > Two callers need this match and there must not be two matches. … a verb set
//! > that exists twice is a verb set whose two halves agree until the day they
//! > do not.
//!
//! And the property that follows: `dispatch` is one match with no catch-all, so
//! a verb added to `Command` and left undispatched does not compile. That is
//! R-10, and it holds here for free — there is nothing in this file that knows
//! any verb's name.
//!
//! # There are three more commands, and none of them is a verb
//!
//! [`create_ledger`], [`open_ledger`] and [`close_ledger`]. They take no path
//! from the renderer, they run no SQL, and they name no verb. See
//! `document.rs`'s header for the three reasons a file command may not be a
//! `Command` variant — the first of which is that the WebView must never be able
//! to say which file to open.
//!
//! # The two locks meet here
//!
//! The `Mutex<Option<Document>>` below is the first: one connection, reached one
//! caller at a time, so the application cannot race itself. That is what
//! `DataPortCapabilities.maxConcurrentWrites: 1` promises the app — *"a QUEUE
//! rather than concurrency"*. The second is the file claim inside the document,
//! and `lock.rs` explains why neither implies the other.
//!
//! # A refusal resolves; a fault rejects
//!
//! `respond` already draws that line and both callers honour it by their own
//! door — *"a non-zero exit and a line on stderr for the CLI, a rejected promise
//! for the shell"*. Tauri's `Result` is that door: `Ok` resolves the promise
//! with the `{ok:…}` envelope, `Err` rejects it. So a ledger that says no
//! arrives at `readEnvelope` as `{ok:false,error:{…}}` and is thrown with the
//! ledger's own words; a storage fault arrives as a rejection and
//! `coreTransport.ts` writes the sentence, because the crate had no chance to.

// No console window behind the app on Windows. The attribute is inert on macOS
// and Linux, and is the one line every Tauri binary carries.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![deny(missing_docs)]
#![warn(clippy::pedantic)]
#![allow(clippy::doc_markdown)]

// EVERY `#[tauri::command]` BELOW TAKES ITS ARGUMENTS BY VALUE, and clippy's
// pedantic set would rather they did not. The signature is not this file's to
// choose: the macro deserialises the renderer's payload into owned values and
// hands `State` over by value, so a reference here does not compile. Allowed at
// each command rather than for the module, so that an ordinary function which
// grew the same habit would still be reported.

mod document;
mod lock;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use wealth_core::command::{dispatch, parse, plan, respond, Response};

use document::{Document, OpenLedger};

/// Everything the shell holds between calls.
///
/// One field, deliberately. A shell with a cache, a session or a copy of
/// anything the ledger already knows is a second place for the truth to live.
struct Shell {
    /// The open document, or none. THE mutex — see this module's header.
    open: Mutex<Option<Document>>,
}

/// What `invoke` gives back for a question the ledger could not be asked at all.
///
/// A string rather than a structure, because `coreTransport.ts` puts it inside
/// one sentence with the verb's name in front of it and nothing branches on its
/// shape. The seam's rule 4 — an error's `.message` is prose a person reads —
/// reaches all the way down here.
type Fault = String;

/// Ask the open ledger one question.
///
/// # Errors
/// A fault: no document open, or the ledger's storage failed. A REFUSAL is not
/// an error here — it comes back inside the envelope, with `ok: false`.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn wealth_core_invoke(
    verb: String,
    payload: serde_json::Value,
    shell: State<'_, Shell>,
) -> Result<Response, Fault> {
    // The command is built as TEXT and parsed, rather than assembled from the
    // two arguments as a `serde_json::Value` and read with `from_value`.
    // `command.rs` asks for exactly this decision and leaves it to the caller:
    //
    //   > `from_str` reports the line and column of the offending byte and
    //   > `from_value` cannot, so a second entry point would put two different
    //   > `message` strings on the wire for one mistake. Which one the shell
    //   > sends is a decision about the wire rather than a convenience.
    //
    // It sends TEXT, so that the shell and the CLI word one mistake one way. A
    // spec written against the harness describes what the app does; that is only
    // true while the two parse the same bytes the same way.
    let request = serde_json::json!({ "verb": verb, "payload": payload });
    let text = serde_json::to_string(&request)
        .map_err(|error| format!("this request could not be sent to the ledger: {error}"))?;

    let command = match parse(&text) {
        Ok(command) => command,
        // A malformed command is a REFUSAL, not a fault: something was asked and
        // is being told no, in the envelope every other no arrives in — and
        // before a file is touched.
        Err(refusal) => return Ok(refusal),
    };

    // THE ADMISSION SURFACE IS ANSWERED WITHOUT A LEDGER.
    // A `plan_*` command decides what a row MEANS and writes nothing, so it is
    // answered here — before the document is even looked for. That is not an
    // optimisation: it is what lets an import be planned in a window with no
    // file open, and it keeps this shell honest about which half of the surface
    // it is talking to, exactly as the CLI refuses a `--db` beside a planner.
    let command = match plan(command) {
        Ok(outcome) => return respond(outcome).map_err(|detail| fault_sentence(&detail)),
        Err(command) => command,
    };

    let mut open = shell
        .open
        .lock()
        .map_err(|_| "the ledger was left locked by a failed call; restart the window".to_owned())?;
    let document = open.as_mut().ok_or_else(|| {
        "no ledger is open in this window, so there was nothing to ask".to_owned()
    })?;

    respond(dispatch(&mut document.connection, command)).map_err(|detail| fault_sentence(&detail))
}

/// A storage fault, worded for the person in front of it.
///
/// `respond` hands over `storage fault: <sqlite's words>`. SQLite's words are
/// accurate and mean nothing to anybody, so they are kept — a support
/// conversation needs them — behind a sentence that says what happened.
fn fault_sentence(detail: &str) -> Fault {
    format!(
        "The ledger file could not complete that. Nothing was changed. ({detail})"
    )
}

/// Which ledger this window has open, if any.
///
/// Answers rather than refuses when there is none: the renderer asks this on
/// load, and "no ledger yet" is the ordinary state of a window that has just
/// started.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn current_ledger(shell: State<'_, Shell>) -> Option<OpenLedger> {
    shell
        .open
        .lock()
        .ok()
        .and_then(|open| open.as_ref().map(Document::describe))
}

/// Choose a ledger and open it.
///
/// `async` because the chooser is modal and the platform's own: the blocking
/// dialog API dispatches the panel to the main thread and waits, so calling it
/// FROM the main thread would deadlock. An async command runs on the runtime's
/// pool, which is where waiting is allowed.
///
/// # Errors
/// A sentence for a person: nothing was chosen, the ledger is open elsewhere, it
/// is not a ledger, or nobody owns it.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
async fn open_ledger(app: tauri::AppHandle, shell: State<'_, Shell>) -> Result<OpenLedger, Fault> {
    let chosen = app
        .dialog()
        .file()
        .add_filter("WealthTracker ledger", &["db"])
        .blocking_pick_file()
        .ok_or_else(|| CHOOSER_CANCELLED.to_owned())?;

    let path = chosen
        .into_path()
        .map_err(|error| format!("that ledger's location could not be read: {error}"))?;

    let document = document::open(&path)?;
    Ok(hold(&shell, document))
}

/// Choose a name and make a ledger there.
///
/// # Errors
/// As [`open_ledger`], plus: a name already in use.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
async fn create_ledger(app: tauri::AppHandle, shell: State<'_, Shell>) -> Result<OpenLedger, Fault> {
    let chosen = app
        .dialog()
        .file()
        .add_filter("WealthTracker ledger", &["db"])
        .set_file_name("My money.db")
        .blocking_save_file()
        .ok_or_else(|| CHOOSER_CANCELLED.to_owned())?;

    let path = chosen
        .into_path()
        .map_err(|error| format!("that location could not be read: {error}"))?;

    let document = document::create(&path)?;
    Ok(hold(&shell, document))
}

/// Close the open ledger, releasing its claim.
///
/// # Errors
/// Only if the mutex was poisoned by a previous panic, which is a window that
/// has to be restarted.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn close_ledger(shell: State<'_, Shell>) -> Result<(), Fault> {
    let mut open = shell
        .open
        .lock()
        .map_err(|_| "the ledger was left locked by a failed call; restart the window".to_owned())?;
    // Dropping the document drops its connection AND its claim, in that order.
    // Nothing else releases either — which is why closing is a command rather
    // than something the renderer can forget to do.
    *open = None;
    Ok(())
}

/// What a cancelled chooser says.
///
/// Cancelling is not a failure and this sentence is written so that a renderer
/// showing every rejection verbatim still says something true and calm.
const CHOOSER_CANCELLED: &str = "No ledger was chosen.";

/// Put a freshly opened document in the shell, and describe it.
///
/// Replacing the previous one drops it, which releases the previous file's
/// claim — so opening a second ledger closes the first, rather than holding two
/// and letting the window's title decide which is real.
fn hold(shell: &State<'_, Shell>, document: Document) -> OpenLedger {
    let described = document.describe();
    if let Ok(mut open) = shell.open.lock() {
        *open = Some(document);
    }
    described
}

/// What the renderer is told about the build it is running in.
///
/// Not a ledger question, so not a verb: it is the shell describing itself.
#[derive(Debug, Serialize)]
struct ShellBuild {
    shell: &'static str,
    sqlite: String,
}

/// The versions behind this window.
#[tauri::command]
fn shell_build() -> ShellBuild {
    ShellBuild {
        shell: env!("CARGO_PKG_VERSION"),
        sqlite: rusqlite::version().to_owned(),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(Shell {
                open: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            wealth_core_invoke,
            current_ledger,
            open_ledger,
            create_ledger,
            close_ledger,
            shell_build
        ])
        .run(tauri::generate_context!())
        // The one place this program may not carry on. There is no window, so
        // there is nowhere to show a message; the message goes to stderr and the
        // process ends, which is what every Tauri binary does and the only thing
        // available.
        .unwrap_or_else(|error| {
            eprintln!("wealthtracker-desktop: the window could not be started: {error}");
            std::process::exit(1);
        });
}
