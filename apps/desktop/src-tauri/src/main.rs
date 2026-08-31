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
//!
//! # THE LICENCE GATE STANDS IN FRONT OF THE ONE COMMAND
//!
//! `license.rs` decides whether this window may write; [`READ_VERBS`] and
//! [`BOOT_WRITES`] below decide what "write" means, and [`licence_gate`] is the
//! two of them meeting. It sits inside [`wealth_core_invoke`] — the same
//! placement argument the updater and the file chooser make, one more time: a
//! check the WebView performs is a check the WebView can skip.
//!
//! The rule it enforces, in the shortest form there is: **reads and the export
//! never stop. Writes do.**

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
mod license;
mod lock;
mod update;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use wealth_core::command::{dispatch, parse, plan, respond, Response};
use wealth_core::error::{CoreError, Refusal};

use document::{Document, OpenLedger};
use license::{Licensing, Status};

/// Everything the shell holds between calls.
///
/// Two fields. The first was alone until licensing arrived, and the second is
/// not an exception to the rule stated here — a shell with a cache, a session or
/// a copy of anything the ledger already knows is a second place for the truth
/// to live. A licence is not something the ledger knows: it is a property of the
/// INSTALLATION, it lives outside every ledger file on purpose (a licence stored
/// in a ledger would be copied with the ledger), and there is nowhere else for
/// it to be held.
struct Shell {
    /// The open document, or none. THE mutex — see this module's header.
    open: Mutex<Option<Document>>,
    /// Whether this window may write, and who it belongs to. See `license.rs`.
    licensing: Licensing,
}

/// The verbs a window may ask when it is not licensed, because they WRITE
/// NOTHING.
///
/// ── HOW THIS LIST WAS DERIVED, AND WHY IT IS SPELLED OUT ────────────────────
///
/// Not by prefix. `list_*`/`get_*`/`read_*` is a naming convention and a
/// convention is a thing somebody breaks on a Tuesday; `collect_backup` reads
/// fifteen tables and matches no prefix at all, and `set_transactions_cleared`
/// would match a `set_*` rule that somebody was bound to propose. So each name
/// below was taken from ONE place — the single `match` in
/// `crates/wealth-core/src/command.rs`'s `dispatch` — and admitted on ONE
/// criterion, which is visible in that match and nowhere else:
///
///   **the arm takes `&*connection`.** A read opens no transaction, so the crate
///   hands it an immutable connection, and the compiler is what keeps that true.
///   Sixteen of the names below are exactly the arms with a `&*` in them.
///
/// Three names needed a sentence rather than a signature, and here they are:
///
///   * `load_boot` takes `&mut`, and the crate says why in as many words —
///     *"the ONE answering verb that takes the connection by `&mut`, and the
///     only place in this match where that is not a sign of a write: it opens a
///     DEFERRED read transaction so its six answers are one snapshot"*;
///   * `collect_backup` is the same shape: `transaction_with_behavior(Deferred)`,
///     fifteen `SELECT`s, `commit`. It is THE EXPORT, and the never-hostage rule
///     below is mostly about this one name;
///   * the seven `plan_*` commands are answered by `command::plan` BEFORE a
///     document is looked for — they are handed no connection at all — so they
///     are structurally incapable of writing. They are the front half of an
///     import whose back half is refused, and refusing them as well would be
///     refusing something that cannot touch a file, which is not the rule this
///     gate enforces.
///
/// ── THE FAILURE MODE THIS SHAPE IS CHOSEN AGAINST ───────────────────────────
///
/// A write classified as a read. So the gate DEFAULT-REFUSES: a verb that is not
/// named here is refused, including a verb added to the crate tomorrow. A new
/// read has to be admitted deliberately, by a person editing this list; a new
/// write is refused for free, by nobody doing anything.
///
/// `every_allowed_verb_is_a_verb_this_crate_actually_has` holds it to the enum
/// rather than to this comment, by asking serde what the variants are.
const READ_VERBS: &[&str] = &[
    // The nine settings-sized reads.
    "list_accounts",
    "list_closed_accounts",
    "list_categories",
    "list_budgets",
    "list_goals",
    "list_custom_reports",
    "list_investments",
    "list_suggestion_dismissals",
    "list_forecast_adjustments",
    // The heavy four: one person's whole history.
    "list_transactions",
    "list_transaction_splits",
    "splits_for",
    "account_balances",
    // The composite — seven of the above at once, in one snapshot.
    "load_boot",
    // The three that answer without listing anything.
    "verify_integrity",
    "read_preferences",
    "user_financial_data_is_empty",
    // THE EXPORT. See the never-hostage rule on `licence_gate`.
    "collect_backup",
    // The admission surface: answered before a file is opened.
    "plan_statement_duplicates",
    "plan_statement_bank_balance",
    "plan_feed_overlap",
    "plan_cleared_flag",
    "plan_account_identifiers",
    "plan_account_identifier_match",
    "plan_category_admission",
];

/// The one write an unlicensed window is still allowed, and the argument for it.
///
/// A SEPARATE LIST, not a line hidden among the reads. `seed_categories` writes
/// rows and calling it a read would be the exact lie [`READ_VERBS`] is shaped to
/// prevent, so it is admitted here as what it is: a named exception, with the
/// reason attached and nowhere for a second one to be added quietly.
///
/// The reason is that it is not the PERSON's write. `services/local/
/// deviceDocument.ts`'s `bootDeviceLedger` issues it on every launch, before the
/// application is imported — *"must `await port.prepareCategories()` before
/// `port.loadBoot()`"* — and a refusal there rejects the boot, which leaves an
/// unlicensed window on the chooser with an error on it. That is precisely the
/// hostage-taking this whole gate exists to prevent: a person whose trial ended
/// could not open their ledger to read it, let alone export it.
///
/// What it actually writes is the product's own default category list, into a
/// file that has none. No money, no rows anybody authored, and it is idempotent
/// — every launch after the first writes nothing at all.
const BOOT_WRITES: &[&str] = &["seed_categories"];

/// The code a refused write carries. Stable, and matched on by nobody.
///
/// `dataPort.ts` rule 4 forbids a caller branching on an error's code, and the
/// renderer does not: `src/desktop/LicenceScreen.tsx` asks `license_status` for
/// the state rather than inferring it from a refusal. The code is here for a
/// support conversation and for this file's own tests.
const LICENCE_REQUIRED: &str = "licence_required";

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
    // The licence is read here rather than inside `ask` so that `ask` — the
    // whole of the path a question travels — can be run by a test that supplies
    // its own. There is exactly one body and both callers use it.
    ask(&verb, &payload, &shell.licensing.status(), &shell.open)
}

/// The whole of one invoke, minus where the licence and the document come from.
///
/// Separated for the tests at the foot of this file and for no other reason:
/// `State<'_, Shell>` cannot be built outside a running Tauri application, and a
/// gate that could only be exercised through a window would be a gate nobody
/// exercised. Everything the command does is here, in order.
///
/// # Errors
/// A fault, as [`wealth_core_invoke`] documents. A refusal — the licence's
/// included — is an `Ok` carrying `{ok:false,…}`.
fn ask(
    verb: &str,
    payload: &serde_json::Value,
    licence: &Status,
    open: &Mutex<Option<Document>>,
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

    // THE LICENCE GATE, AND IT IS DELIBERATELY THE SECOND THING.
    //
    // After `parse`, so that a typo is still answered as a typo: `parse`
    // succeeding is what guarantees `verb` is one of the crate's own strings, so
    // the allowlist is compared against a name that exists rather than against
    // anything the WebView felt like sending. A gate in front of `parse` would
    // report `wibble` as "licence required", which is both untrue and the kind
    // of message that costs somebody an afternoon.
    //
    // Before `plan` and before the mutex, so that a refused write never reaches
    // a planner, a document or a connection.
    if let Some(refused) = licence_gate(licence, verb) {
        return refused;
    }

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

    let mut held = open
        .lock()
        .map_err(|_| "the ledger was left locked by a failed call; restart the window".to_owned())?;
    let document = held.as_mut().ok_or_else(|| {
        "no ledger is open in this window, so there was nothing to ask".to_owned()
    })?;

    respond(dispatch(&mut document.connection, command)).map_err(|detail| fault_sentence(&detail))
}

/// May this window ask that? The refusal if not.
///
/// ── NOBODY'S LEDGER IS EVER HELD HOSTAGE ────────────────────────────────────
///
/// The landing page promises, in these words:
///
/// > *your ledger exports in full whenever you want it*
///
/// This function is where that promise is kept or broken. An expired trial and a
/// missing licence take exactly one thing away — WRITING — and leave every read
/// in [`READ_VERBS`] answering, `collect_backup` among them. A person whose
/// trial ended can still open their ledger, read every screen, run every report
/// and export the whole file. Withholding somebody's own accounts to make them
/// pay would be a worse thing to do than losing the sale.
///
/// ── AND IT IS A REFUSAL, NOT A FAULT ────────────────────────────────────────
///
/// It rides in the crate's own envelope through `respond`, so `readEnvelope`
/// throws it with its message intact and the ~28 places that render an error's
/// `.message` say the sentence written here. A `Fault` would have been the lazy
/// option and it would have arrived wrapped in "The ledger file could not
/// answer…", which is untrue: the ledger was never asked.
fn licence_gate(licence: &Status, verb: &str) -> Option<Result<Response, Fault>> {
    if licence.may_write {
        return None;
    }
    if READ_VERBS.contains(&verb) || BOOT_WRITES.contains(&verb) {
        return None;
    }

    let refusal = Refusal::named(
        LICENCE_REQUIRED,
        // Verbatim from `license.rs` — the same sentence the licence screen
        // shows, so a person meets one explanation rather than two.
        &licence.message,
    )
    .with_hint(
        "Reading and exporting are unaffected: open the licence screen to enter a key, or use \
         Export to take the whole ledger with you.",
    );

    // Built through the crate's own constructor rather than by assembling an
    // envelope here: there must be one shape of refusal on this wire and it is
    // the one `respond` writes.
    //
    // The `Err` arm cannot happen — `respond` returns `Err` only for a storage
    // fault and this is a refusal — but it is spelled out rather than unwrapped,
    // because `panic` is denied in this crate. It answers with a FAULT rather
    // than with `None`, so that the one unreachable branch here still refuses
    // the write. A gate whose impossible case lets the write through is a gate
    // with a way round it.
    Some(match respond(Err(CoreError::Refused(refusal))) {
        Ok(response) => Ok(response),
        Err(detail) => Err(fault_sentence(&detail)),
    })
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

/// Where this window stands on its licence.
///
/// Answers rather than refuses in every state, including the states in which
/// nothing may be written: a window that could not ask "am I licensed?" would
/// have no way to say why a write was refused. Not a ledger question, so not a
/// verb — the shell describing itself, exactly as [`shell_build`] does.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn license_status(shell: State<'_, Shell>) -> Status {
    shell.licensing.status()
}

/// Take a pasted licence key, check it, and keep it if it holds up.
///
/// # Errors
/// A sentence for the person who pasted it, saying which way it is wrong. The
/// check is entirely local — a signature against a key compiled into this
/// binary — so this command reaches no network, here or anywhere else.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn license_apply(key: String, shell: State<'_, Shell>) -> Result<Status, Fault> {
    shell.licensing.apply(&key)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.manage(Shell {
                open: Mutex::new(None),
                // The APP'S CONFIG DIRECTORY, not the ledger's directory and not
                // the ledger itself. A licence belongs to the installation: one
                // kept inside a ledger file would be copied with the ledger, so
                // sending somebody a backup would send them a licence.
                //
                // A path resolver that cannot answer is survivable and must not
                // stop the window — see `update.rs` on what a failed check may
                // cost. The fallback is a directory beside the process, which
                // means the licence is forgotten between launches; that is
                // annoying and it is not somebody's accounts.
                licensing: Licensing::open(match app.path().app_config_dir() {
                    Ok(dir) => dir,
                    Err(error) => {
                        eprintln!(
                            "wealthtracker-desktop: this machine has no readable config \
                             directory, so a licence will not be remembered between launches: \
                             {error}"
                        );
                        std::env::temp_dir().join("wealthtracker-licence")
                    }
                }),
            });
            // Returns at once; the look happens on the async runtime and can
            // only ever cost the update. See `update.rs`.
            update::offer_any_update(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            wealth_core_invoke,
            current_ledger,
            open_ledger,
            create_ledger,
            close_ledger,
            shell_build,
            license_status,
            license_apply
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

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use std::sync::Mutex;

    use super::{ask, licence_gate, BOOT_WRITES, LICENCE_REQUIRED, READ_VERBS};
    use crate::document;
    use crate::license::{State, Status};
    use wealth_core::command::{parse, Response};

    /// A directory of this test's own. `lock.rs`'s twin says why it is a counter.
    fn temp_dir() -> std::path::PathBuf {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let base = std::env::temp_dir().join(format!(
            "wt-gate-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&base).unwrap();
        base
    }

    /// A licence status, built by hand.
    ///
    /// The gate reads exactly two things — `may_write` and `message` — so a test
    /// that went through `Licensing` to produce them would be testing the
    /// verifier a second time and the gate not at all. `license.rs`'s own suite
    /// is where a status is earned rather than stated.
    fn status(state: State, may_write: bool) -> Status {
        Status {
            state,
            kind: None,
            licensed_to: None,
            expires_at: None,
            may_write,
            clock_went_back: false,
            message: "Your trial has ended, so this ledger is open read-only. Nothing has been \
                      removed: every screen still works and you can export the whole file \
                      whenever you want it."
                .to_owned(),
        }
    }

    /// A real ledger in a directory of its own, and the shell's half of the
    /// mutex around it. Nothing here is a fake: the write below really writes
    /// and the read really reads.
    fn a_ledger() -> (Mutex<Option<document::Document>>, String) {
        let path = temp_dir().join("gated.db");
        let opened = document::create(&path).expect("a new ledger");
        let owner = opened.owner.clone();
        (Mutex::new(Some(opened)), owner)
    }

    /// The envelope, as the renderer would read it.
    fn envelope(response: &Response) -> serde_json::Value {
        serde_json::to_value(response).expect("a response serialises")
    }

    /// One category, as `create_category` wants it.
    fn a_category(owner: &str) -> serde_json::Value {
        serde_json::json!({
            "user_id": owner,
            "name": "Postage",
            "type": "expense",
            "level": "type"
        })
    }

    /// The owner-only payload the reads take.
    fn owned_by(owner: &str) -> serde_json::Value {
        serde_json::json!({ "user_id": owner })
    }

    #[test]
    fn a_licensed_window_writes() {
        let (open, owner) = a_ledger();
        let answer = ask(
            "create_category",
            &a_category(&owner),
            &status(State::Licensed, true),
            &open,
        )
        .expect("a licensed write reaches the ledger");

        assert_eq!(envelope(&answer)["ok"], serde_json::json!(true));
    }

    #[test]
    fn an_expired_window_is_refused_by_name_and_still_answers_a_read() {
        // THE WHOLE RULE, in one case, against a real file.
        let (open, owner) = a_ledger();
        let expired = status(State::Expired, false);

        let refused = ask("create_category", &a_category(&owner), &expired, &open)
            .expect("a refusal is an answer, not a fault");
        let body = envelope(&refused);
        assert_eq!(body["ok"], serde_json::json!(false));
        assert_eq!(body["error"]["code"], serde_json::json!(LICENCE_REQUIRED));
        // The sentence a person reads is the licence's own, unchanged.
        assert!(
            body["error"]["message"]
                .as_str()
                .unwrap_or_default()
                .contains("read-only"),
            "{body}"
        );

        // AND THE LEDGER IS NOT HOSTAGE. The same window, the same instant, a
        // read: it answers.
        let read = ask("list_accounts", &owned_by(&owner), &expired, &open)
            .expect("a read is never refused for want of a licence");
        assert_eq!(envelope(&read)["ok"], serde_json::json!(true));

        // …AND SO DOES THE EXPORT, which is the promise the landing page makes
        // in as many words: "your ledger exports in full whenever you want it".
        let exported = ask("collect_backup", &owned_by(&owner), &expired, &open)
            .expect("the export is never refused for want of a licence");
        assert_eq!(envelope(&exported)["ok"], serde_json::json!(true));

        // …and nothing was written by the refused call.
        let categories =
            ask("list_categories", &owned_by(&owner), &expired, &open).expect("a read");
        assert!(
            !envelope(&categories).to_string().contains("Postage"),
            "the refused write must not have reached the file"
        );
    }

    #[test]
    fn a_window_with_no_licence_at_all_behaves_exactly_as_an_expired_one() {
        // Missing and expired are one rule, not two. If they ever diverge it
        // will be here that it shows.
        let (open, owner) = a_ledger();
        let missing = status(State::Unlicensed, false);

        let refused =
            ask("create_category", &a_category(&owner), &missing, &open).expect("a refusal");
        assert_eq!(
            envelope(&refused)["error"]["code"],
            serde_json::json!(LICENCE_REQUIRED)
        );

        let read = ask("list_accounts", &owned_by(&owner), &missing, &open).expect("a read");
        assert_eq!(envelope(&read)["ok"], serde_json::json!(true));
    }

    #[test]
    fn an_unlicensed_window_can_still_open_its_ledger() {
        // `seed_categories` is `BOOT_WRITES`'s only entry, and this is what it is
        // for: `bootDeviceLedger` issues it on every launch, so a refusal here
        // would leave a person who let their trial lapse unable to open the file
        // at all — no reading, no exporting, nothing.
        let (open, owner) = a_ledger();
        let answer = ask(
            "seed_categories",
            // The default set, as `prepareCategories` hands it over. One row is
            // enough, and it has to carry its own id: a seed never mints one,
            // because the ids are what the app files transactions under.
            &serde_json::json!({
                "user_id": owner,
                "categories": [
                    { "id": "type-income", "name": "Income", "type": "income", "level": "type" }
                ]
            }),
            &status(State::Expired, false),
            &open,
        )
        .expect("the boot's seed is not refused");

        let body = envelope(&answer);
        assert_eq!(body["ok"], serde_json::json!(true), "{body}");
    }

    #[test]
    fn an_unenforced_build_refuses_nothing() {
        let (open, owner) = a_ledger();
        let answer = ask(
            "create_category",
            &a_category(&owner),
            &status(State::Unenforced, true),
            &open,
        )
        .expect("a development build writes");

        assert_eq!(envelope(&answer)["ok"], serde_json::json!(true));
    }

    #[test]
    fn a_verb_nobody_has_heard_of_is_still_reported_as_one() {
        // The gate stands AFTER `parse` for this reason: a typo must not be
        // reported as a licence problem. Checked in the state where the gate is
        // most eager to speak.
        let (open, _) = a_ledger();
        let refused = ask(
            "wibble",
            &serde_json::json!({}),
            &status(State::Expired, false),
            &open,
        )
        .expect("a refusal");

        let body = envelope(&refused);
        assert_ne!(body["error"]["code"], serde_json::json!(LICENCE_REQUIRED));
        assert!(
            body["error"]["message"]
                .as_str()
                .unwrap_or_default()
                .contains("unknown variant"),
            "{body}"
        );
    }

    #[test]
    fn every_allowed_verb_is_a_verb_this_crate_actually_has() {
        // THE ALLOWLIST, HELD TO THE ENUM RATHER THAN TO ITS OWN COMMENT.
        //
        // A name misspelled in `READ_VERBS` fails in the silent direction: the
        // verb it was meant to admit is refused instead, and only a person with
        // an expired trial ever finds out. So the list is checked against the
        // verb set itself — and the verb set is not exported as a list by
        // anything, because `Command` is an enum with a serde tag on it.
        //
        // Serde will however RECITE it. An unknown tag produces "unknown variant
        // `…`, expected one of `create_transaction`, `update_transaction`, …",
        // which is the enum's own spelling of its own variants, produced by the
        // same derive that reads the wire. Nothing here can drift from that.
        let recital = match parse(r#"{"verb":"__not_a_verb__","payload":{}}"#) {
            Ok(_) => panic!("`__not_a_verb__` must not parse"),
            Err(refusal) => envelope(&refusal)["error"]["message"]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
        };
        assert!(recital.contains("unknown variant"), "{recital}");

        let unknown: Vec<&str> = READ_VERBS
            .iter()
            .chain(BOOT_WRITES.iter())
            .copied()
            .filter(|verb| !recital.contains(&format!("`{verb}`")))
            .collect();
        assert_eq!(
            unknown,
            Vec::<&str>::new(),
            "these are on the allowlist and are not verbs this crate has"
        );

        // AND THE INSTRUMENT IS NOT VACUOUS. If the recital ever stopped naming
        // variants, the filter above would pass everything.
        assert!(recital.contains("`create_transaction`"), "{recital}");
    }

    #[test]
    fn the_writes_that_matter_most_are_not_on_the_allowlist() {
        // The other direction, spelled out by name. `READ_VERBS` is a list a
        // person edits, and the mistake it is shaped against is a WRITE being
        // added to it — which no assertion about spelling would catch.
        for verb in [
            "create_transaction",
            "update_transaction",
            "delete_transaction",
            "import_transactions",
            "import_bank_transactions",
            "restore_backup",
            "restore_user_chunk",
            "wipe_user_financial_data",
            "write_preferences",
            "create_account",
            "update_account",
            "close_account",
            "set_transactions_cleared",
            "create_budget",
            "create_investment",
            "create_category",
        ] {
            assert!(
                licence_gate(&status(State::Expired, false), verb).is_some(),
                "{verb} must be refused when the licence has lapsed"
            );
        }
    }

    #[test]
    fn every_read_is_allowed_when_there_is_no_licence() {
        for verb in READ_VERBS.iter().chain(BOOT_WRITES.iter()) {
            assert!(
                licence_gate(&status(State::Unlicensed, false), verb).is_none(),
                "{verb} is on the allowlist and must not be refused"
            );
        }
    }
}
