//! Licensing — a signed statement about who bought this, checked offline.
//!
//! # A FENCE, NOT A VAULT. Read this before changing anything below
//!
//! This repository is public. Everything in this file — the verifier, the
//! allowlist, the states, the clock defence — can be read by anybody, and a
//! person who is prepared to compile their own build can delete it in an
//! afternoon. That is not a flaw in the design; it is the design's premise, and
//! writing it down is the only way to stop somebody later mistaking this for
//! security and building something load-bearing on top of it.
//!
//! What it is actually for:
//!
//!   * it makes the SIGNED, NOTARISED, SELF-UPDATING build the thing that is
//!     bought. A recompiled fork gets none of that, and `update.rs` is why the
//!     official one is worth having;
//!   * it keeps honest people honest, which is the whole of what a licence key
//!     has ever done for a desktop application;
//!   * it lets a trial exist at all, which is the feature the owner actually
//!     wanted.
//!
//! It is deliberately NOT: a server, a phone-home, an activation count, a
//! machine binding, or a reason for this program to need the internet. The local
//! edition's entire promise is one file on one machine, and a licence check that
//! called anything would be the first line of that promise broken.
//!
//! # Why the enforcement is in Rust and not in the renderer
//!
//! `update.rs`'s sentence, applied to a second privileged decision: *"the
//! WebView is not the part of this program that should be able to replace the
//! program"*. Nor is it the part that should be able to decide it is licensed. A
//! check in the renderer is a check inside the largest, most reachable, most
//! extension-exposed surface this binary has, and it would be one `localStorage`
//! key away from being switched off by somebody who never opened a compiler.
//!
//! Keeping it here has the same three side effects the updater's placement has:
//! the renderer's size ratchet never sees it, the CSP is not involved, and
//! `src/desktop/routes.ts` and the shared UI stay identical between the two
//! editions. The renderer is told the STATE and shows it; it is never asked.
//!
//! # `license` in code, "licence" in prose, and that is on purpose
//!
//! The app speaks en-GB (`src/design-system/__tests__/ukEnglish.test.ts`), so
//! every sentence a person reads here says *licence*, and so do the files a
//! person touches: `licence-public-key.txt`, `scripts/issue-licence.mjs`. The
//! Rust module, its types and the two Tauri commands say `license`, because they
//! are the wire and the wire is one spelling forever. The split is stated so
//! that a reader meets it as a decision rather than as a typo.
//!
//! # The licence string
//!
//! ```text
//! WTL1-<base64url(claims JSON)>.<base64url(64-byte Ed25519 signature)>
//! ```
//!
//! `WTL1` is the ENVELOPE's version — the encoding above. `"v": 1` inside the
//! claims is the CLAIMS' version — the field set. They are two versions because
//! they fail differently: a change to the encoding must be unreadable to an old
//! build, and a change to the fields must be REFUSED by one.
//!
//! **The signature covers the exact bytes that travel.** The claims are carried
//! base64url'd and verified before they are parsed, so there is no canonical
//! serialisation to agree on between Node and Rust — no key ordering, no
//! whitespace, no number formatting, none of the ways a "canonical JSON" scheme
//! quietly stops round-tripping. The bytes ARE the canonical form. This is JWS's
//! one good idea and it costs nothing to borrow.
//!
//! Base64url unpadded, so the string survives an email, a URL and a text box
//! without anything helpfully re-encoding it.
//!
//! # Two kinds, and what each one enforces
//!
//! **Trial** carries `expires`. It is checked against the system clock, with the
//! standard mild rollback defence below.
//!
//! **Lifetime** carries no expiry, and its enforcement is the LICENSEE'S NAME:
//! the app says "Licensed to …" where a person can see it. At this scale that is
//! the whole of one-user enforcement, and it is a better one than it looks —
//! sharing a key means sharing your name with it.
//!
//! **There is deliberately no machine binding**, and this is a decision rather
//! than an omission. Binding punishes the legitimate cases — a new laptop, a
//! restored backup, a reinstall after a repair — far more reliably than it stops
//! the copy it is aimed at, because the person copying is the one person
//! prepared to work around it. An accounts application that locks somebody out
//! of their own ledger on the day their machine died has done more damage than
//! every unpaid copy it ever prevented.
//!
//! # The clock defence, and what it honestly buys
//!
//! The highest instant this installation has ever seen is kept in the app's own
//! config directory, and the trial is judged against `max(now, that)`. Setting
//! the clock back therefore gains nothing: the mark is what counts, and it only
//! moves forwards.
//!
//! A determined cheat beats this by deleting one file, and that is ACCEPTED. The
//! defence is aimed at the accidental and the half-hearted — the person who
//! notices the trial has ended and idly wonders whether the date would fix it.
//! Anything stronger would mean hiding state where a user cannot find it, which
//! is a thing this program does not do to people.
//!
//! A backwards clock is REPORTED rather than punished ([`Status::clock_went_back`]),
//! because the innocent explanation — a machine whose clock was wrong and has
//! just been corrected — is far commoner than the guilty one, and the honest
//! response to it is a sentence, not a lockout. A tolerance
//! ([`CLOCK_TOLERANCE_SECS`]) keeps ordinary NTP corrections quiet.
//!
//! # NOBODY'S LEDGER IS EVER HELD HOSTAGE
//!
//! The landing page promises, in these words:
//!
//! > *your ledger exports in full whenever you want it*
//!
//! An expired or missing licence does not touch that. Reads answer, the register
//! draws, every report runs, and `collect_backup` — the export — is on the
//! allowlist beside them. What stops is WRITING. `main.rs` holds the allowlist
//! and the argument for every name on it; this module only decides whether a
//! window may write at all.
//!
//! # The placeholder, and how enforcement arms itself
//!
//! `apps/desktop/licence-public-key.txt` is compiled in with `include_str!`. It
//! ships holding the word `PLACEHOLDER`, and a build made from it reports
//! [`State::Unenforced`]: nothing is refused, the screen says "development
//! build", and no licence can be applied because there is no key to check one
//! against. The owner runs `--generate` once, commits the public half, and every
//! build after that is armed.
//!
//! A key file that is present but UNREADABLE also lands on `Unenforced`, and
//! that fail-open direction is deliberate: a mangled key file is a mistake by
//! the people who ship this program, and the person it would otherwise lock out
//! of their own accounts had no part in it. The mistake is caught instead by
//! `the_committed_public_key_is_the_placeholder_or_a_real_key`, which is a test,
//! which is where a build-time mistake belongs.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use ed25519_dalek::{Signature, VerifyingKey, SIGNATURE_LENGTH};
use serde::{Deserialize, Serialize};

/// The committed public key, as text, at compile time.
///
/// One `include_str!` and no build script: rotating the key is editing this file
/// and rebuilding. See its own header for the format and for what `PLACEHOLDER`
/// means.
const PUBLIC_KEY_FILE: &str = include_str!("../../licence-public-key.txt");

/// The word the committed key file holds until a real key is issued.
const PLACEHOLDER: &str = "PLACEHOLDER";

/// The licence string's prefix — the ENVELOPE's version. See the module header.
const PREFIX: &str = "WTL1-";

/// The only claims version this build understands.
const CLAIMS_VERSION: u32 = 1;

/// How far backwards a clock may travel before it is worth mentioning.
///
/// A day. Long enough that an ordinary correction — a machine that booted with a
/// dead RTC, a timezone database update, an NTP step after a long sleep — passes
/// without a word, and short enough that a deliberate month-long rewind is
/// reported. It changes nothing about ENFORCEMENT either way: the trial is
/// judged against the high-water mark regardless, so this only decides whether
/// the licence screen says anything about it.
const CLOCK_TOLERANCE_SECS: u64 = 86_400;

/// How far the clock must move before the high-water mark is written again.
///
/// An hour. The mark is consulted on every invoke and an invoke is 0.145 ms, so
/// a write per call would make the licence the most expensive thing in the
/// process. A window loses at most an hour of mark on a crash, which costs a
/// trial an hour it already had.
const STAMP_INTERVAL_SECS: u64 = 3_600;

/// Where the applied licence is kept, under the app's config directory.
const LICENCE_FILE: &str = "licence.key";

/// Where the high-water mark is kept, under the app's config directory.
const CLOCK_FILE: &str = "clock.stamp";

/// What kind of licence this is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// Time-limited. Carries an expiry, and is judged against the clock.
    Trial,
    /// Bought outright. No expiry; the licensee's name is the enforcement.
    Lifetime,
}

/// What a licence claims, as the issuing script writes it.
///
/// `deny_unknown_fields` on purpose, and it is the reason [`Self::v`] exists: a
/// build that met a field it did not know would otherwise accept a licence whose
/// meaning it had only partly read. Refusing is the honest answer, and bumping
/// `v` is how a future field is introduced.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Claims {
    /// The claims schema version. Must be [`CLAIMS_VERSION`].
    pub v: u32,
    /// Trial or lifetime.
    pub kind: Kind,
    /// The licensee's name, as the app displays it.
    pub name: String,
    /// The licensee's email, as the support conversation will start from.
    pub email: String,
    /// When it was issued, in seconds since the Unix epoch.
    pub issued: u64,
    /// When a trial ends, in seconds since the Unix epoch. Absent for lifetime.
    ///
    /// Epoch seconds rather than a date string, and that is a decision about
    /// dependencies: a `YYYY-MM-DD` would need this crate to convert an instant
    /// into a civil date to compare against it, which means a calendar library
    /// in a shell whose whole job is to not have opinions. An integer needs
    /// `SystemTime` and nothing else. The renderer formats it for a person,
    /// where there is already an en-GB locale to do it in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires: Option<u64>,
    /// This licence's own id, so a support conversation can name one.
    pub id: String,
}

/// Where a window stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum State {
    /// No real public key is compiled in. A development build: nothing is
    /// enforced and the screen says so rather than pretending.
    Unenforced,
    /// A valid lifetime licence, or a trial still in date.
    Licensed,
    /// A valid trial whose date has passed.
    Expired,
    /// No licence, or one that did not verify.
    Unlicensed,
}

/// What the renderer is told, and the only thing it is ever told.
///
/// It is a REPORT, not a decision. The refusal happens in `main.rs` whether the
/// renderer reads this or not; this exists so a window can say something true.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// Where this window stands.
    pub state: State,
    /// Trial or lifetime, when there is a licence at all.
    pub kind: Option<Kind>,
    /// The licensee's name, for "Licensed to …".
    pub licensed_to: Option<String>,
    /// When a trial ends, in seconds since the Unix epoch.
    pub expires_at: Option<u64>,
    /// Whether writes are permitted. The renderer's one branch.
    pub may_write: bool,
    /// Whether this machine's clock reads earlier than the highest instant this
    /// installation has seen. Reported, never punished — see the module header.
    pub clock_went_back: bool,
    /// The sentence a person reads: the consequence, then the remedy.
    pub message: String,
}

/// The public key this build was compiled with.
enum PublicKey {
    /// The committed file still holds the placeholder, or holds something this
    /// build could not read. Either way there is nothing to check against.
    Placeholder,
    /// A real key. Enforcement is armed.
    Armed(VerifyingKey),
}

/// What is held between calls: the verified claims, and the clock's memory.
struct Held {
    /// The claims of the stored licence, once verified. `None` when there is no
    /// licence, or when the one on disk did not verify.
    claims: Option<Claims>,
    /// Why there is no licence, when there is none. Shown verbatim, so that
    /// "tampered" and "never pasted" are not the same sentence.
    absent: String,
    /// The highest instant this installation has ever seen, epoch seconds.
    high_water: u64,
    /// The high-water mark as last written to disk. See [`STAMP_INTERVAL_SECS`].
    written: u64,
}

/// The shell's licensing, as one value it holds for its lifetime.
///
/// Constructed once in `setup` and never replaced, so that the file is read once
/// rather than on every invoke. The clock's memory advances behind a mutex; the
/// key never changes, because it is compiled in.
pub struct Licensing {
    key: PublicKey,
    home: PathBuf,
    held: Mutex<Held>,
}

impl Licensing {
    /// Read the compiled key, the stored licence and the clock's memory.
    ///
    /// Never fails. Every I/O failure below has the same honest answer — an
    /// unlicensed window that can still read and export everything — and a shell
    /// that refused to start because it could not read a stamp file would be a
    /// shell that locks somebody out of their accounts over a licence.
    #[must_use]
    pub fn open(home: PathBuf) -> Self {
        let key = read_public_key(PUBLIC_KEY_FILE);
        let now = clock_now();

        let (claims, absent) = match read_stored(&home, &key) {
            Ok(claims) => (Some(claims), String::new()),
            Err(why) => (None, why),
        };

        let stamped = read_stamp(&home.join(CLOCK_FILE));
        let high_water = stamped.max(now);

        let held = Held {
            claims,
            absent,
            high_water,
            written: stamped,
        };
        let licensing = Self {
            key,
            home,
            held: Mutex::new(held),
        };
        // Once at launch, so that a window opened after a long gap records the
        // gap rather than waiting for the first invoke to notice it.
        licensing.observe(now);
        licensing
    }

    /// Where this window stands, judged against the clock right now.
    ///
    /// Cheap enough for the invoke path: a mutex, a comparison, and — at most
    /// once an hour — one small write. See [`STAMP_INTERVAL_SECS`].
    #[must_use]
    pub fn status(&self) -> Status {
        let now = clock_now();
        let (high_water, went_back) = self.observe(now);
        let effective = now.max(high_water);

        let Ok(held) = self.held.lock() else {
            // A poisoned mutex means a previous call panicked, which in this
            // crate means a bug. It must not cost somebody their register.
            return unlicensed(
                "This window could not read its licence, so it is open read-only. \
                 Everything you have is still here and still exports; restart the app \
                 to try again.",
                went_back,
            );
        };

        if matches!(self.key, PublicKey::Placeholder) {
            // A development build. Said plainly rather than dressed up as a
            // licence, because a screen that claims to be licensed when nothing
            // was checked is the one outcome worse than saying nothing.
            return Status {
                state: State::Unenforced,
                kind: None,
                licensed_to: None,
                expires_at: None,
                may_write: true,
                clock_went_back: went_back,
                message: "Development build — no licence key is compiled into it, so nothing \
                          is checked and nothing is restricted."
                    .to_owned(),
            };
        }

        let Some(claims) = held.claims.as_ref() else {
            return unlicensed(&held.absent, went_back);
        };

        match claims.expires {
            None => Status {
                state: State::Licensed,
                kind: Some(claims.kind),
                licensed_to: Some(claims.name.clone()),
                expires_at: None,
                may_write: true,
                clock_went_back: went_back,
                message: format!("Licensed to {}.", claims.name),
            },
            Some(expires) if effective > expires => Status {
                state: State::Expired,
                kind: Some(claims.kind),
                licensed_to: Some(claims.name.clone()),
                expires_at: Some(expires),
                may_write: false,
                clock_went_back: went_back,
                // The consequence, then the remedy, then the promise — in that
                // order, because the first thing a person needs to know is that
                // their money is not gone.
                message: "Your trial has ended, so this ledger is open read-only. Nothing has \
                          been removed: every screen still works and you can export the whole \
                          file whenever you want it. Enter a licence key to write again."
                    .to_owned(),
            },
            Some(expires) => Status {
                state: State::Licensed,
                kind: Some(claims.kind),
                licensed_to: Some(claims.name.clone()),
                expires_at: Some(expires),
                may_write: true,
                clock_went_back: went_back,
                message: format!("Trial licensed to {}.", claims.name),
            },
        }
    }

    /// Check a pasted key, keep it if it verifies, and say where that leaves us.
    ///
    /// # Errors
    /// A sentence for the person who pasted it. Every failure here is theirs to
    /// act on — a truncated paste, a key for a different product, a trial that
    /// was signed by a key this build does not carry — so each one says which.
    pub fn apply(&self, pasted: &str) -> Result<Status, String> {
        let PublicKey::Armed(key) = &self.key else {
            // Honest rather than convenient. There is no key to check against,
            // so "accepted" would be a lie and "rejected" would be a puzzle.
            return Err("This is a development build: it carries no licence key, so a licence \
                        cannot be checked against anything. Nothing is restricted here in any \
                        case."
                .to_owned());
        };

        let claims = verify(key, pasted)?;
        let trimmed = pasted.trim();

        // Written BEFORE the in-memory copy is replaced, so that a disk that
        // refused the write leaves the window in the state it can prove it is
        // in. The other order would give somebody a licensed window that is
        // unlicensed again after a restart, with nothing to point at.
        if let Err(error) = write_stored(&self.home, trimmed) {
            return Err(format!(
                "That licence is valid, but it could not be saved to this machine ({error}), so \
                 it would be forgotten when the app closes. Check that {} is writable.",
                self.home.display()
            ));
        }

        if let Ok(mut held) = self.held.lock() {
            held.claims = Some(claims);
            held.absent = String::new();
        }

        Ok(self.status())
    }

    /// Take note of the instant, and say what the mark is and whether the clock
    /// has been behind it.
    ///
    /// Returns `(high_water, went_back)`. Writes the mark at most once per
    /// [`STAMP_INTERVAL_SECS`].
    fn observe(&self, now: u64) -> (u64, bool) {
        let Ok(mut held) = self.held.lock() else {
            return (now, false);
        };

        let went_back = now < held.high_water.saturating_sub(CLOCK_TOLERANCE_SECS);
        if now > held.high_water {
            held.high_water = now;
        }

        let mark = held.high_water;
        if mark > held.written.saturating_add(STAMP_INTERVAL_SECS) {
            // A failed write is not worth a word to anybody: the mark is a
            // defence against idleness, not a record anything depends on. It
            // will be attempted again on the next call.
            if write_stamp(&self.home, mark).is_ok() {
                held.written = mark;
            }
        }

        (mark, went_back)
    }
}

/// A window with no usable licence, worded by whatever established that.
fn unlicensed(message: &str, went_back: bool) -> Status {
    Status {
        state: State::Unlicensed,
        kind: None,
        licensed_to: None,
        expires_at: None,
        may_write: false,
        clock_went_back: went_back,
        message: message.to_owned(),
    }
}

/// What a window says when it has never been given a licence at all.
///
/// A constant because two callers need the same sentence — the first launch and
/// a licence file that was deleted are the same situation and deserve the same
/// words.
const NEVER_APPLIED: &str =
    "No licence has been entered on this machine, so this ledger is open read-only. Nothing is \
     hidden: every screen works and the whole file exports. Enter a licence key to write.";

/// Now, in seconds since the Unix epoch.
///
/// A clock set before 1970 reads as 0, which the high-water mark then ignores.
/// That is the correct treatment of a machine claiming to be in the 1960s.
fn clock_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_secs())
}

/// Read the compiled key file, ignoring its comments.
///
/// Anything that is not a real 32-byte key — the placeholder, an empty file, a
/// mangled line — is [`PublicKey::Placeholder`]. The module header argues that
/// fail-open direction; the test below is what stops it hiding a mistake.
fn read_public_key(file: &str) -> PublicKey {
    let Some(line) = key_line(file) else {
        return PublicKey::Placeholder;
    };
    if line == PLACEHOLDER {
        return PublicKey::Placeholder;
    }
    let Ok(bytes) = URL_SAFE_NO_PAD.decode(line) else {
        return PublicKey::Placeholder;
    };
    let Ok(sized) = <[u8; 32]>::try_from(bytes.as_slice()) else {
        return PublicKey::Placeholder;
    };
    VerifyingKey::from_bytes(&sized).map_or(PublicKey::Placeholder, PublicKey::Armed)
}

/// The first line of the key file that is neither blank nor a comment.
fn key_line(file: &str) -> Option<&str> {
    file.lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))
}

/// Check one pasted licence string against one key.
///
/// # Errors
/// A sentence naming what is wrong with the string, because the person holding
/// it is the only one who can do anything about it.
fn verify(key: &VerifyingKey, pasted: &str) -> Result<Claims, String> {
    let trimmed = pasted.trim();
    if trimmed.is_empty() {
        return Err("Paste a licence key first.".to_owned());
    }

    let Some(body) = trimmed.strip_prefix(PREFIX) else {
        return Err(format!(
            "That does not look like a WealthTracker licence key: they all begin with {PREFIX}."
        ));
    };

    let Some((claims_part, signature_part)) = body.split_once('.') else {
        return Err("That licence key is incomplete — it is missing everything after the full \
                    stop. Copy the whole line, including the end."
            .to_owned());
    };

    let claims_bytes = URL_SAFE_NO_PAD
        .decode(claims_part)
        .map_err(|_| "That licence key has been altered or mis-copied.".to_owned())?;
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature_part)
        .map_err(|_| "That licence key has been altered or mis-copied.".to_owned())?;

    let sized = <[u8; SIGNATURE_LENGTH]>::try_from(signature_bytes.as_slice())
        .map_err(|_| "That licence key has been altered or mis-copied.".to_owned())?;

    // `verify_strict` rather than `verify`: it refuses small-order public keys
    // and the malleable signature forms, which are the two ways an Ed25519
    // check can be true of something nobody signed.
    key.verify_strict(claims_bytes.as_slice(), &Signature::from_bytes(&sized))
        .map_err(|_| {
            "That licence key was not signed for this app. Check you have pasted the whole \
             key, exactly as it was sent to you."
                .to_owned()
        })?;

    // ONLY NOW is the JSON read. The bytes were proven first, which is what
    // keeps a hostile string from reaching a deserialiser at all.
    let claims: Claims = serde_json::from_slice(&claims_bytes).map_err(|error| {
        format!("That licence was signed correctly but this build cannot read it ({error}). It \
                 may have been issued for a newer version.")
    })?;

    if claims.v != CLAIMS_VERSION {
        return Err(format!(
            "That licence is version {} and this build understands version {CLAIMS_VERSION}. \
             Update the app, or ask for a licence for this version.",
            claims.v
        ));
    }
    if claims.kind == Kind::Lifetime && claims.expires.is_some() {
        // A lifetime licence with an expiry is a contradiction, and accepting
        // it would mean choosing which half to believe.
        return Err("That licence contradicts itself: it is a lifetime licence with an end \
                    date. Ask for it to be re-issued."
            .to_owned());
    }
    if claims.kind == Kind::Trial && claims.expires.is_none() {
        return Err("That licence is a trial with no end date. Ask for it to be re-issued."
            .to_owned());
    }

    Ok(claims)
}

/// Read the stored licence, if there is one, and verify it.
///
/// # Errors
/// The sentence to show when there is nothing usable, which is not always the
/// same sentence: a file that was never written and a file that has been edited
/// are different situations and a person is owed the difference.
fn read_stored(home: &Path, key: &PublicKey) -> Result<Claims, String> {
    let PublicKey::Armed(verifying) = key else {
        return Err(NEVER_APPLIED.to_owned());
    };
    let path = home.join(LICENCE_FILE);
    let Ok(text) = fs::read_to_string(&path) else {
        return Err(NEVER_APPLIED.to_owned());
    };
    verify(verifying, &text).map_err(|why| {
        format!(
            "The licence saved on this machine is no longer valid, so this ledger is open \
             read-only — everything still reads and exports. ({why})"
        )
    })
}

/// Keep the pasted licence where the next launch will find it.
///
/// # Errors
/// The underlying I/O error, for the sentence [`Licensing::apply`] builds.
fn write_stored(home: &Path, licence: &str) -> Result<(), std::io::Error> {
    fs::create_dir_all(home)?;
    fs::write(home.join(LICENCE_FILE), licence)
}

/// The high-water mark as last written, or 0.
fn read_stamp(path: &Path) -> u64 {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| text.trim().parse::<u64>().ok())
        .unwrap_or(0)
}

/// Write the high-water mark.
///
/// # Errors
/// The underlying I/O error. Every caller ignores it — see [`Licensing::observe`].
fn write_stamp(home: &Path, mark: u64) -> Result<(), std::io::Error> {
    fs::create_dir_all(home)?;
    fs::write(home.join(CLOCK_FILE), mark.to_string())
}

#[cfg(test)]
#[allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::arithmetic_side_effects
)]
mod tests {
    use super::{
        key_line, read_public_key, verify, Claims, Kind, Licensing, PublicKey, State,
        CLAIMS_VERSION, PLACEHOLDER, PREFIX, PUBLIC_KEY_FILE,
    };
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine as _;
    use ed25519_dalek::{Signer, SigningKey, VerifyingKey};

    /// A directory of this test's own. `lock.rs`'s twin says why the name is a
    /// counter rather than a clock.
    fn temp_dir() -> std::path::PathBuf {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let base = std::env::temp_dir().join(format!(
            "wt-licence-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&base).unwrap();
        base
    }

    /// AN EPHEMERAL KEYPAIR, every time.
    ///
    /// No test in this repository may carry the owner's private key, or any key
    /// that outlives the process that made it. The seed is fixed so a failure is
    /// reproducible; it is a test seed and it signs nothing anybody runs.
    fn keypair() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    /// Issue a licence the way `scripts/issue-licence.mjs` does — the same two
    /// base64url parts over the same bytes.
    fn issue(signing: &SigningKey, claims: &Claims) -> String {
        let json = serde_json::to_vec(claims).unwrap();
        let signature = signing.sign(&json);
        format!(
            "{PREFIX}{}.{}",
            URL_SAFE_NO_PAD.encode(&json),
            URL_SAFE_NO_PAD.encode(signature.to_bytes())
        )
    }

    fn lifetime() -> Claims {
        Claims {
            v: CLAIMS_VERSION,
            kind: Kind::Lifetime,
            name: "Ada Lovelace".to_owned(),
            email: "ada@example.com".to_owned(),
            issued: 1_756_684_800,
            expires: None,
            id: "lic-0001".to_owned(),
        }
    }

    fn trial(expires: u64) -> Claims {
        Claims {
            v: CLAIMS_VERSION,
            kind: Kind::Trial,
            name: "Grace Hopper".to_owned(),
            email: "grace@example.com".to_owned(),
            issued: 1_756_684_800,
            expires: Some(expires),
            id: "lic-0002".to_owned(),
        }
    }

    /// A `Licensing` armed with a key of this test's own, over a temp home.
    fn armed(signing: &SigningKey, home: std::path::PathBuf) -> Licensing {
        let mut licensing = Licensing::open(home);
        licensing.key = PublicKey::Armed(signing.verifying_key());
        // The stored licence was read against the committed key, so re-read it
        // against this test's own.
        let reread = super::read_stored(&licensing.home, &licensing.key);
        if let Ok(mut held) = licensing.held.lock() {
            match reread {
                Ok(claims) => {
                    held.claims = Some(claims);
                    held.absent = String::new();
                }
                Err(why) => {
                    held.claims = None;
                    held.absent = why;
                }
            }
        }
        licensing
    }

    /// The far future, so a "still in date" trial does not expire on a machine
    /// with a badly set clock or in the year this is still running.
    const A_LONG_WAY_OFF: u64 = 4_102_444_800; // 2100-01-01

    #[test]
    fn the_committed_public_key_is_the_placeholder_or_a_real_key() {
        // THE BUILD-TIME GATE. `read_public_key` fails OPEN by design (a mangled
        // key must never lock a person out of their own accounts), so a typo in
        // the committed file would otherwise ship as a silently unenforced
        // build. This is where that mistake is caught.
        let line = key_line(PUBLIC_KEY_FILE).expect("the key file must have a line in it");
        if line == PLACEHOLDER {
            assert!(matches!(read_public_key(PUBLIC_KEY_FILE), PublicKey::Placeholder));
            return;
        }
        let bytes = URL_SAFE_NO_PAD
            .decode(line)
            .expect("a committed key must be base64url");
        let sized = <[u8; 32]>::try_from(bytes.as_slice())
            .expect("an Ed25519 public key is 32 bytes");
        VerifyingKey::from_bytes(&sized).expect("a committed key must be a real Ed25519 key");
        assert!(matches!(read_public_key(PUBLIC_KEY_FILE), PublicKey::Armed(_)));
    }

    #[test]
    fn a_placeholder_build_enforces_nothing_and_says_so() {
        // The committed key has been real since 2026-09-01, so the placeholder
        // state is constructed directly — the behaviour pinned here must hold
        // through any future rotation window where the line is PLACEHOLDER again.
        let mut licensing = Licensing::open(temp_dir());
        licensing.key = PublicKey::Placeholder;
        let status = licensing.status();

        assert_eq!(status.state, State::Unenforced);
        assert!(status.may_write);
        assert!(status.message.contains("Development build"), "{}", status.message);

        // And it refuses a paste rather than pretending to have checked it.
        let refused = licensing
            .apply(&issue(&keypair(), &lifetime()))
            .expect_err("a build with no key cannot check one");
        assert!(refused.contains("development build"), "{refused}");
    }

    #[test]
    fn a_lifetime_licence_names_its_owner_and_never_expires() {
        let signing = keypair();
        let licensing = armed(&signing, temp_dir());

        let status = licensing.apply(&issue(&signing, &lifetime())).expect("a valid licence");

        assert_eq!(status.state, State::Licensed);
        assert_eq!(status.kind, Some(Kind::Lifetime));
        assert_eq!(status.licensed_to.as_deref(), Some("Ada Lovelace"));
        assert_eq!(status.expires_at, None);
        assert!(status.may_write);
        assert!(status.message.contains("Licensed to Ada Lovelace"), "{}", status.message);
    }

    #[test]
    fn a_licence_survives_the_window_that_applied_it() {
        // The point of writing the file at all: the next launch reads it back
        // and verifies it again, rather than trusting anything in memory.
        let signing = keypair();
        let home = temp_dir();
        armed(&signing, home.clone())
            .apply(&issue(&signing, &lifetime()))
            .expect("a valid licence");

        let next_launch = armed(&signing, home);
        assert_eq!(next_launch.status().state, State::Licensed);
    }

    #[test]
    fn an_expired_trial_says_the_consequence_the_remedy_and_the_promise() {
        let signing = keypair();
        let licensing = armed(&signing, temp_dir());

        // Expired in 2001. Nothing about this test depends on today's date.
        let status = licensing
            .apply(&issue(&signing, &trial(1_000_000_000)))
            .expect("an expired licence still verifies — it is valid and over");

        assert_eq!(status.state, State::Expired);
        assert!(!status.may_write);
        assert!(status.message.contains("read-only"), "{}", status.message);
        // THE PROMISE. The landing page says "your ledger exports in full
        // whenever you want it", and this is the sentence that keeps it in front
        // of the one person who most needs to hear it.
        assert!(status.message.contains("export"), "{}", status.message);
        assert!(status.message.contains("Nothing has been removed"), "{}", status.message);
    }

    #[test]
    fn a_trial_still_in_date_may_write() {
        let signing = keypair();
        let licensing = armed(&signing, temp_dir());

        let status = licensing
            .apply(&issue(&signing, &trial(A_LONG_WAY_OFF)))
            .expect("a valid trial");

        assert_eq!(status.state, State::Licensed);
        assert_eq!(status.kind, Some(Kind::Trial));
        assert_eq!(status.expires_at, Some(A_LONG_WAY_OFF));
        assert!(status.may_write);
    }

    #[test]
    fn a_window_with_no_licence_is_read_only_and_says_nothing_is_hidden() {
        let signing = keypair();
        let status = armed(&signing, temp_dir()).status();

        assert_eq!(status.state, State::Unlicensed);
        assert!(!status.may_write);
        assert!(status.message.contains("read-only"), "{}", status.message);
        assert!(status.message.contains("exports"), "{}", status.message);
    }

    #[test]
    fn one_altered_byte_is_refused_and_the_window_stays_read_only() {
        let signing = keypair();
        let licensing = armed(&signing, temp_dir());
        let good = issue(&signing, &lifetime());

        // Flip one character of the claims half. The signature is over those
        // exact bytes, so this is the whole of what tampering looks like.
        let at = PREFIX.len() + 4;
        let mut bytes = good.clone().into_bytes();
        bytes[at] = if bytes[at] == b'A' { b'B' } else { b'A' };
        let tampered = String::from_utf8(bytes).unwrap();

        let refused = licensing.apply(&tampered).expect_err("a tampered key must be refused");
        assert!(refused.contains("not signed for this app") || refused.contains("altered"), "{refused}");
        assert_eq!(licensing.status().state, State::Unlicensed);
    }

    #[test]
    fn a_key_signed_by_somebody_else_is_refused() {
        // The property the whole scheme rests on: possession of the format is
        // not possession of the key.
        let ours = keypair();
        let theirs = SigningKey::from_bytes(&[9u8; 32]);
        let licensing = armed(&ours, temp_dir());

        let refused = licensing
            .apply(&issue(&theirs, &lifetime()))
            .expect_err("another key's signature must be refused");
        assert!(refused.contains("not signed for this app"), "{refused}");
    }

    #[test]
    fn a_string_that_is_not_a_licence_says_which_way_it_is_wrong() {
        let signing = keypair();
        let licensing = armed(&signing, temp_dir());

        assert!(licensing.apply("   ").expect_err("empty").contains("Paste a licence key"));
        assert!(licensing
            .apply("hello")
            .expect_err("no prefix")
            .contains("begin with WTL1-"));
        assert!(licensing
            .apply("WTL1-abc")
            .expect_err("no signature")
            .contains("incomplete"));
    }

    #[test]
    fn a_licence_from_a_future_schema_is_refused_by_version() {
        let signing = keypair();
        let mut claims = lifetime();
        claims.v = 2;
        let refused = verify(&signing.verifying_key(), &issue(&signing, &claims))
            .expect_err("a version this build does not know must be refused");
        assert!(refused.contains("version 2"), "{refused}");
    }

    #[test]
    fn a_licence_that_contradicts_itself_is_refused_rather_than_half_believed() {
        let signing = keypair();

        let mut lifetime_with_end = lifetime();
        lifetime_with_end.expires = Some(A_LONG_WAY_OFF);
        let refused = verify(&signing.verifying_key(), &issue(&signing, &lifetime_with_end))
            .expect_err("a lifetime licence with an end date must be refused");
        assert!(refused.contains("contradicts itself"), "{refused}");

        let mut endless_trial = trial(0);
        endless_trial.expires = None;
        let refused = verify(&signing.verifying_key(), &issue(&signing, &endless_trial))
            .expect_err("a trial with no end date must be refused");
        assert!(refused.contains("no end date"), "{refused}");
    }

    #[test]
    fn a_field_this_build_does_not_know_is_refused_rather_than_ignored() {
        // `deny_unknown_fields`, proven rather than assumed. A build that
        // silently dropped a field would be a build that had only partly read
        // what it was agreeing to.
        let signing = keypair();
        let json = br#"{"v":1,"kind":"lifetime","name":"A","email":"a@example.com","issued":1,"id":"x","seats":40}"#;
        let signature = signing.sign(json);
        let licence = format!(
            "{PREFIX}{}.{}",
            URL_SAFE_NO_PAD.encode(json),
            URL_SAFE_NO_PAD.encode(signature.to_bytes())
        );

        let refused = verify(&signing.verifying_key(), &licence)
            .expect_err("an unknown claim must be refused");
        assert!(refused.contains("cannot read it"), "{refused}");
    }

    #[test]
    fn winding_the_clock_back_does_not_revive_a_trial() {
        // THE ROLLBACK DEFENCE, measured. The mark is written to the home
        // directory; a second `Licensing` over the same home is the next launch,
        // and it judges the trial against the mark rather than against a clock
        // that has since been set backwards.
        let signing = keypair();
        let home = temp_dir();

        // This installation has seen 2030, whatever the machine says today.
        let seen_2030 = 1_893_456_000_u64;
        std::fs::write(home.join(super::CLOCK_FILE), seen_2030.to_string()).unwrap();

        let licensing = armed(&signing, home);
        // A trial that ends in 2027 — comfortably in the past as far as the mark
        // is concerned, and possibly in the future as far as the clock is.
        let status = licensing
            .apply(&issue(&signing, &trial(1_800_000_000)))
            .expect("a valid trial");

        assert_eq!(status.state, State::Expired, "the mark, not the clock, decides");
    }

    #[test]
    fn a_clock_behind_the_mark_is_reported_and_never_punished() {
        let signing = keypair();
        let home = temp_dir();
        // A mark far enough ahead that any real clock is behind it.
        std::fs::write(home.join(super::CLOCK_FILE), "4102444800").unwrap();

        let licensing = armed(&signing, home);
        let status = licensing
            .apply(&issue(&signing, &lifetime()))
            .expect("a valid lifetime licence");

        assert!(status.clock_went_back, "a clock a lifetime behind should be mentioned");
        // AND NOT PUNISHED. A lifetime licence has no expiry, so a clock that
        // disagrees with the mark is somebody else's problem, not this window's.
        assert_eq!(status.state, State::Licensed);
        assert!(status.may_write);
    }

    #[test]
    fn a_licence_the_issuing_script_really_made_verifies_here() {
        // THE TWO IMPLEMENTATIONS, HELD TO EACH OTHER.
        //
        // Everything else in this file signs with `ed25519_dalek::Signer` and
        // verifies with `ed25519_dalek::VerifyingKey`, which proves the crate
        // agrees with itself and nothing about `scripts/issue-licence.mjs`. The
        // wire between them is described in two places — this module's header
        // and that script's — and two descriptions of one format is exactly how
        // a format acquires two meanings.
        //
        // So this is a licence THAT SCRIPT ACTUALLY PRINTED, beside the public
        // key it printed with it. If Node's base64url, its JSON, its field
        // order, its number formatting or its signature ever stop being what
        // this reads, this fails, and it fails here rather than on somebody's
        // machine on the day they paid.
        //
        // THE KEYPAIR IS EPHEMERAL AND ITS PRIVATE HALF IS GONE. It was made in
        // a temp directory for this one string, it signs nothing anybody runs,
        // and the licensee is invented — this repository is public and no real
        // person's name or address belongs in it.
        const PUBLIC: &str = "8nrtIIqfCFbKff7MxBxtCtbY49QclyNp_0SKAMRfBtg";
        const LICENCE: &str = "WTL1-eyJ2IjoxLCJraW5kIjoibGlmZXRpbWUiLCJuYW1lIjoiR3JhY2UgSG9wcGVyIiwiZW1haWwiOiJncmFjZUBleGFtcGxlLmNvbSIsImlzc3VlZCI6MTc4ODIxODAwMiwiaWQiOiJ3dGwtcndpUDhpWVdJOTlZIn0.x3-xRRL9s18dhk_521xPpNgCAgYj5uOGx_V507ae9Be0s3PQ2Pek6HNSNGYKLkBLpasqBrqaaSK7ZIq7-ACuDw";

        let raw = URL_SAFE_NO_PAD.decode(PUBLIC).expect("the printed key is base64url");
        let sized = <[u8; 32]>::try_from(raw.as_slice()).expect("32 bytes");
        let key = VerifyingKey::from_bytes(&sized).expect("a real Ed25519 key");

        let claims = verify(&key, LICENCE).expect("a licence the script issued must verify here");
        assert_eq!(claims.kind, Kind::Lifetime);
        assert_eq!(claims.name, "Grace Hopper");
        assert_eq!(claims.expires, None);
        assert_eq!(claims.v, CLAIMS_VERSION);

        // And the key file's own reader agrees the printed line IS a key —
        // which is the other half of what the owner does with `--generate`.
        let committed = format!("# a comment\n\n{PUBLIC}\n");
        assert!(matches!(read_public_key(&committed), PublicKey::Armed(_)));
    }

    #[test]
    fn the_high_water_mark_only_ever_moves_forwards() {
        let home = temp_dir();
        let licensing = Licensing::open(home.clone());

        let (first, _) = licensing.observe(2_000_000_000);
        let (second, went_back) = licensing.observe(1_000_000_000);

        assert_eq!(first, 2_000_000_000);
        assert_eq!(second, 2_000_000_000, "a smaller instant must not lower the mark");
        assert!(went_back);
        // And it reached the disk, which is what makes it survive the window.
        assert_eq!(super::read_stamp(&home.join(super::CLOCK_FILE)), 2_000_000_000);
    }
}
