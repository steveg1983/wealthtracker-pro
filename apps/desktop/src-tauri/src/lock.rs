//! The two locks — what stops a second process from opening one ledger.
//!
//! # What the two locks are, and why one of them is not enough
//!
//! `crates/wealth-core/src/verbs/load_boot.rs` states the problem this file
//! answers, in the middle of explaining why the boot's six reads are one
//! transaction:
//!
//! > **The desktop is single-writer, and that is not the reason this is safe.**
//! > One connection behind a mutex means the application cannot race itself; it
//! > says nothing about the second process the two locks in PHASE3-PLAN §5 exist
//! > to refuse, about a backup tool, or about the differential harness, which
//! > opens the file from Node and from Rust in the same breath.
//!
//! So the two locks are two DIFFERENT statements, and this module holds one of
//! them:
//!
//! 1. **The mutex in `main.rs`** — one connection, held by the shell, reached
//!    through a `Mutex`. It makes the application unable to race ITSELF: two
//!    invokes from the WebView queue rather than interleave, which is what
//!    `DataPortCapabilities.maxConcurrentWrites: 1` promises the app in as many
//!    words (*"a QUEUE rather than concurrency"*).
//!
//! 2. **The file lock here** — an advisory exclusive lock on a sidecar, held for
//!    the life of the open document. It makes a SECOND PROCESS unable to open
//!    the same ledger: a second copy of this app, an older build still running,
//!    a second window, or anything else that plays by the same rule.
//!
//! Neither implies the other. A mutex is invisible outside the process; a file
//! lock says nothing about two threads inside one. Both are needed and they are
//! deliberately kept apart, because a single mechanism that appeared to do both
//! would be doing one of them badly.
//!
//! # Why the kernel holds it, and not a row in the file
//!
//! The obvious alternative is a lease: write `{pid, host, since}` into
//! `schema_meta` and refuse a file that already has one. It is worse in the way
//! that matters most, and the reason is what happens after a crash. A lease
//! written into the file OUTLIVES the process that wrote it: kill the app, pull
//! the power, and the ledger is locked against its owner by a note from a
//! process that no longer exists. Every product that has tried this ends up
//! shipping a "the file is in use — unlock it anyway?" button, which is a button
//! that unlocks a file that really IS in use.
//!
//! `flock(2)` — which is what `File::try_lock` is on Unix, and `LockFileEx` on
//! Windows — is held by the OPEN FILE DESCRIPTION. The kernel drops it when the
//! process ends, however it ends: cleanly, by `SIGKILL`, or by the machine
//! losing power. There is nothing to clean up and nothing to override.
//!
//! # But the note is written anyway, and here is what it is for
//!
//! The kernel's refusal is `WouldBlock`. That is not a sentence anybody can act
//! on. So once the lock IS held, this writes who holds it into the same file —
//! and a process that is refused reads that note to say *which* window has the
//! ledger open.
//!
//! The note is evidence, never a gate. It is read only after the kernel has
//! already refused, it is never trusted to refuse on its own, and a stale note
//! next to a free lock is simply overwritten. Both properties are asserted
//! below.
//!
//! # Why a sidecar and not the `.db` itself
//!
//! SQLite takes locks of its own on the database file, on every connection, for
//! the duration of every transaction. Those are POSIX record locks and these are
//! `flock` locks, which are independent mechanisms that do not conflict today —
//! but "do not conflict today, on this platform, in this VFS" is a thin thing to
//! rest a ledger on. A sidecar removes the question, and it buys something as
//! well: the lock is held across a close and re-open of the connection, so the
//! document owns the file even in the moments when nothing has it open.

use std::fmt;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

/// The suffix the sidecar takes. Beside the ledger rather than in a temp
/// directory, because a lock somewhere else is a lock that does not travel with
/// the file it is about: a ledger on a USB stick opened on two machines is
/// exactly the case this is for.
const SUFFIX: &str = ".lock";

/// An exclusive claim on one ledger, for as long as this value is alive.
///
/// Dropping it releases the lock — and dropping it is the ONLY way this program
/// releases one, because the handle is owned by the open document and the
/// document is what a close destroys.
#[derive(Debug)]
pub struct LedgerLock {
    handle: File,
}

/// What is known about the process that already has it.
///
/// Read out of the note beside the lock. Every field may be wrong — the note is
/// evidence rather than truth — which is why the message it produces is phrased
/// as a report rather than as a fact.
#[derive(Debug)]
pub struct Holder {
    pid: u32,
    host: String,
    since: String,
}

impl fmt::Display for Holder {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "process {} on {} has had it open since {}",
            self.pid, self.host, self.since
        )
    }
}

/// Why a ledger could not be claimed.
#[derive(Debug)]
pub enum LockRefused {
    /// Somebody else holds it. `holder` is the note, when there was a readable
    /// one — absent is normal, not suspicious: the holder may be mid-write, or
    /// may be an older build that wrote no note at all.
    Held(Option<Holder>),
    /// The sidecar could not be created or locked for a reason that is not
    /// "somebody else has it": a read-only volume, a directory that is not
    /// there, a filesystem with no lock support.
    Unavailable(String),
}

impl fmt::Display for LockRefused {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Held(Some(holder)) => write!(
                formatter,
                "This ledger is already open in another window ({holder}). \
                 One window at a time: two would each hold a balance the other \
                 had already changed."
            ),
            Self::Held(None) => write!(
                formatter,
                "This ledger is already open in another process. One window at a \
                 time: two would each hold a balance the other had already changed."
            ),
            Self::Unavailable(why) => write!(
                formatter,
                "This ledger could not be claimed for this window: {why}. \
                 Opening it without a claim would let a second window open it too."
            ),
        }
    }
}

impl LedgerLock {
    /// Claim a ledger, or say who has it.
    ///
    /// # Errors
    /// [`LockRefused`] — held by somebody else, or not claimable at all.
    pub fn claim(ledger: &Path) -> Result<Self, LockRefused> {
        let path = sidecar(ledger);
        let handle = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            // NOT `truncate`. Truncating would destroy the previous holder's
            // note before the lock has been taken — so a process that is about
            // to be refused would have already erased the evidence it needs to
            // explain the refusal.
            .truncate(false)
            .open(&path)
            .map_err(|error| LockRefused::Unavailable(error.to_string()))?;

        match handle.try_lock() {
            Ok(()) => {}
            Err(std::fs::TryLockError::WouldBlock) => {
                return Err(LockRefused::Held(read_note(&path)));
            }
            Err(std::fs::TryLockError::Error(error)) => {
                return Err(LockRefused::Unavailable(error.to_string()));
            }
        }

        // The lock is held. Anything found in the file now is a note from a
        // process that is gone — the kernel would not have handed the lock over
        // otherwise — so it is overwritten rather than respected. This is the
        // "stale note next to a free lock" case, and it is a non-event.
        let mut claimed = Self { handle };
        claimed.write_note();
        Ok(claimed)
    }

    /// Record who holds it, for the benefit of whoever is refused next.
    ///
    /// A failure here is deliberately ignored: the CLAIM is the lock, and a
    /// ledger that could not be annotated is still correctly locked. Refusing
    /// to open a file because a comment could not be written would be trading a
    /// working ledger for a better error message.
    fn write_note(&mut self) {
        let note = format!(
            "{{\"pid\":{},\"host\":{},\"since\":{}}}\n",
            std::process::id(),
            serde_json::Value::from(hostname()),
            serde_json::Value::from(now())
        );
        let _ = self.handle.set_len(0);
        let _ = self.handle.seek(SeekFrom::Start(0));
        let _ = self.handle.write_all(note.as_bytes());
        let _ = self.handle.flush();
    }
}

impl Drop for LedgerLock {
    fn drop(&mut self) {
        // Emptied on the way out so that the next holder's refusal message
        // cannot quote a process that closed politely. The lock itself goes
        // when the descriptor does, whether or not this line ran — that is the
        // whole reason the kernel holds it and the file does not.
        let _ = self.handle.set_len(0);
        let _ = self.handle.unlock();
    }
}

fn sidecar(ledger: &Path) -> PathBuf {
    let mut name = ledger.as_os_str().to_os_string();
    name.push(SUFFIX);
    PathBuf::from(name)
}

/// The note, if there is a readable one. Every failure answers `None`: an
/// unreadable note means the refusal is worded without a name, which is a worse
/// message and not a worse outcome.
fn read_note(path: &Path) -> Option<Holder> {
    let mut text = String::new();
    File::open(path).ok()?.read_to_string(&mut text).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(text.trim()).ok()?;
    Some(Holder {
        pid: u32::try_from(parsed.get("pid")?.as_u64()?).ok()?,
        host: parsed.get("host")?.as_str()?.to_owned(),
        since: parsed.get("since")?.as_str()?.to_owned(),
    })
}

/// This machine's name, or a stated non-answer.
///
/// From the environment rather than from a syscall crate: the value reaches a
/// person in one sentence and nothing branches on it, so a dependency to make it
/// slightly more reliable would be a dependency spent on a noun.
fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "this machine".to_owned())
}

/// The instant the claim was taken, in the same shape every timestamp in this
/// product uses.
fn now() -> String {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs());
    format!("epoch {seconds}")
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{LedgerLock, LockRefused};
    use std::io::Write;

    /// A directory of this test's own.
    ///
    /// The name carries a COUNTER as well as the clock, and that is not belt
    /// and braces: `cargo test` runs these in parallel threads, `as_nanos()` is
    /// only as fine-grained as the platform's clock, and two tests that landed
    /// in one directory would fight over one `ledger.db` — which is precisely
    /// the state this module exists to detect, so the failure looked like the
    /// product working. Measured: it flaked roughly one run in eight before the
    /// counter was added.
    fn temp_dir() -> std::path::PathBuf {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let base = std::env::temp_dir().join(format!(
            "wt-lock-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&base).unwrap();
        base
    }

    #[test]
    fn a_second_claim_on_one_ledger_is_refused() {
        // The property the whole module exists for. Two claims from ONE process
        // is the strictest form of the test: `flock` is per open file
        // description, so this really is two independent claims and not a
        // recursive one.
        let dir = temp_dir();
        let ledger = dir.join("ledger.db");
        std::fs::write(&ledger, b"not really a database").unwrap();

        let first = LedgerLock::claim(&ledger).expect("the first claim");
        let second = LedgerLock::claim(&ledger);

        match second {
            Err(LockRefused::Held(_)) => {}
            Err(other) => panic!("refused for the wrong reason: {other}"),
            Ok(_) => panic!("two processes must not hold one ledger"),
        }
        drop(first);
    }

    #[test]
    fn the_refusal_names_the_process_that_has_it() {
        let dir = temp_dir();
        let ledger = dir.join("ledger.db");
        std::fs::write(&ledger, b"x").unwrap();

        let held = LedgerLock::claim(&ledger).expect("the first claim");
        let refusal = LedgerLock::claim(&ledger).expect_err("the second");

        let message = refusal.to_string();
        assert!(
            message.contains(&format!("process {}", std::process::id())),
            "{message}"
        );
        assert!(message.contains("already open in another window"), "{message}");
        drop(held);
    }

    #[test]
    fn releasing_a_ledger_lets_the_next_claim_through() {
        let dir = temp_dir();
        let ledger = dir.join("ledger.db");
        std::fs::write(&ledger, b"x").unwrap();

        let first = LedgerLock::claim(&ledger).expect("first");
        drop(first);

        let again = LedgerLock::claim(&ledger).expect("a released ledger is claimable");
        drop(again);
    }

    #[test]
    fn a_note_left_by_a_process_that_died_does_not_lock_anybody_out() {
        // The failure a lease in the file WOULD have: the note says a process
        // holds this, the kernel says nothing does, and the kernel is right.
        let dir = temp_dir();
        let ledger = dir.join("ledger.db");
        std::fs::write(&ledger, b"x").unwrap();
        let sidecar = dir.join("ledger.db.lock");
        let mut planted = std::fs::File::create(&sidecar).unwrap();
        planted
            .write_all(br#"{"pid":999999,"host":"a machine that crashed","since":"epoch 1"}"#)
            .unwrap();
        drop(planted);

        let claimed = LedgerLock::claim(&ledger).expect("a stale note is not a lock");
        assert!(matches!(claimed, LedgerLock { .. }));

        // And the stale note is gone rather than left to mislead the next
        // refusal.
        let text = std::fs::read_to_string(super::sidecar(&ledger)).unwrap();
        assert!(text.contains(&format!("\"pid\":{}", std::process::id())), "{text}");
        assert!(!text.contains("999999"), "{text}");
    }

    #[test]
    fn a_ledger_in_a_directory_that_is_not_there_says_so_rather_than_claiming_it() {
        let dir = temp_dir();
        let ledger = dir.join("no-such-directory").join("ledger.db");

        match LedgerLock::claim(&ledger) {
            Err(LockRefused::Unavailable(_)) => {}
            Err(other) => panic!("wrong refusal: {other}"),
            Ok(_) => panic!("a claim that could not be written must not be reported as taken"),
        }
    }
}
