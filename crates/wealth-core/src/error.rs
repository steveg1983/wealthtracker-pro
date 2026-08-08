//! Refusals, and the machine codes they are known by.
//!
//! # Why a refusal has a name
//!
//! The differential harness matches on the name, not the prose
//! (`scripts/local-sqlite/lib/specs.mjs`: *"A refusal must be NAMED. 'it
//! errored' is not a proof that the right rule fired — a typo in the fixture
//! also errors."*). So does the app: `handleSupabaseError` surfaces
//! `error.message` to the user, which is why `schema.sql` copies the cloud's
//! refusal strings character for character.
//!
//! Two kinds of refusal reach a caller, and they are deliberately not merged:
//!
//! * **Named** — a rule this crate enforces in control flow, e.g.
//!   [`Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED`], which is the cloud RPC's own
//!   string.
//! * **Constraint** — a rule the *file* enforces. The code is
//!   `constraint_violated` and the message is SQLite's own, so the name of the
//!   CHECK or trigger that fired travels unaltered to whoever is reading.

use std::fmt;

/// A refusal: something the caller asked for that this ledger will not do.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Refusal {
    code: String,
    message: String,
    hint: Option<String>,
}

impl Refusal {
    /// The live cloud RPC's only named refusal.
    /// `supabase/migrations/20260808100000_category_provenance.sql:167-171`.
    pub const ACCOUNT_NOT_FOUND_OR_NOT_OWNED: &'static str = "account_not_found_or_not_owned";

    /// A rule this crate enforces, with the code the harness will match on.
    #[must_use]
    pub fn named(code: &str, message: &str) -> Self {
        Self {
            code: code.to_owned(),
            message: message.to_owned(),
            hint: None,
        }
    }

    /// Attach the sentence a human needs. The cloud RPCs use `USING HINT`
    /// for exactly this and the wording is carried over verbatim where one
    /// exists.
    #[must_use]
    pub fn with_hint(mut self, hint: &str) -> Self {
        self.hint = Some(hint.to_owned());
        self
    }

    /// The stable machine code.
    #[must_use]
    pub fn code(&self) -> &str {
        &self.code
    }

    /// The message, which for a constraint refusal is the engine's own.
    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    /// The hint, when there is one.
    #[must_use]
    pub fn hint(&self) -> Option<&str> {
        self.hint.as_deref()
    }
}

impl fmt::Display for Refusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for Refusal {}

/// Everything a verb can fail with.
#[derive(Debug)]
pub enum CoreError {
    /// The operation was understood and refused. This is a *result*, not a
    /// fault: the ledger is intact and the caller was told why.
    Refused(Refusal),
    /// The command could not be understood — a missing field, a value of the
    /// wrong shape, money sent as a JSON number.
    InvalidCommand(String),
    /// The file, the connection or an assertion about them. Not the caller's
    /// fault and not a rule: a fault.
    Storage(rusqlite::Error),
}

impl CoreError {
    /// A refusal with a name.
    #[must_use]
    pub fn refuse(code: &str, message: &str) -> Self {
        Self::Refused(Refusal::named(code, message))
    }

    /// The machine code, whatever kind of failure this is.
    #[must_use]
    pub fn code(&self) -> &str {
        match self {
            Self::Refused(refusal) => refusal.code(),
            Self::InvalidCommand(_) => "invalid_command",
            Self::Storage(_) => "storage_fault",
        }
    }
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Refused(refusal) => write!(f, "{refusal}"),
            Self::InvalidCommand(message) => write!(f, "invalid_command: {message}"),
            Self::Storage(error) => write!(f, "storage_fault: {error}"),
        }
    }
}

impl std::error::Error for CoreError {}

/// A `rusqlite` failure that carries a constraint or trigger name is a
/// **refusal** — the file enforcing a rule — and is reported as one, message
/// intact. Anything else is a storage fault.
impl From<rusqlite::Error> for CoreError {
    fn from(error: rusqlite::Error) -> Self {
        if let rusqlite::Error::SqliteFailure(failure, Some(ref message)) = error {
            let is_rule = matches!(
                failure.code,
                rusqlite::ErrorCode::ConstraintViolation | rusqlite::ErrorCode::TypeMismatch
            );
            if is_rule {
                return Self::Refused(Refusal::named("constraint_violated", message));
            }
        }
        Self::Storage(error)
    }
}

/// The result every verb returns.
pub type CoreResult<T> = Result<T, CoreError>;
