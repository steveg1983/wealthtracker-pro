//! The audit row, and the chain that makes it tamper-*evident*.
//!
//! # U-1: the write cannot succeed without it
//!
//! `supabase/migrations/20260610150000_financial_audit_log.sql:5-7` —
//! *"Written from INSIDE the atomic transaction RPCs, so the audit row commits
//! in the same database transaction as the operation it records: an operation
//! cannot succeed without its audit entry, and vice versa."* Locally that is one
//! SQLite transaction per verb; this module never opens one of its own, and its
//! only entry point takes a `&Connection` that is already inside one.
//!
//! # U-3: what changes locally, and what does not
//!
//! In the cloud the table is immutable *by absence*: no INSERT/UPDATE/DELETE
//! policy exists and only a `SECURITY DEFINER` helper writes it. A local file
//! belongs to its owner — `sqlite3 wealth.db "DROP TRIGGER trg_audit_no_update"`
//! is one command — so the honest local property is **tamper-evident, not
//! tamper-proof** (DESIGN.md §7.6). `schema.sql` provides the triggers; this
//! module provides the chain that makes an edit *visible*.
//!
//! # The chain
//!
//! `schema.sql` specifies:
//!
//! ```text
//! row_hash = SHA256(prev_hash || seq || entity || entity_id || action
//!                   || before || after || created_at)
//! ```
//!
//! Concatenation alone is ambiguous — `("ab","c")` and `("a","bc")` hash the
//! same — and an ambiguous chain is a chain with a forgery in it. Every field is
//! therefore **length-prefixed** before hashing:
//! `<byte length in decimal> 0x1F <bytes>`, with an absent field encoded as the
//! literal `-` in place of the length. `0x1F` is ASCII Unit Separator, which
//! cannot appear in a uuid, an action or a timestamp, and which JSON escapes if
//! it appears inside `before`/`after`.
//!
//! # What the cloud has that this does not
//!
//! `actor_clerk_id`. There is no Clerk in a local file and no second identity to
//! distinguish; `20260725120000_audit_identity_and_function_grants.sql` exists
//! to stop one signed-in user attributing a row to another, which is a property
//! of a shared database. Recorded here so its absence is a decision.

use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};

use crate::error::CoreResult;

/// Unit Separator. Cannot occur unescaped in any field this chain covers.
const FIELD_SEPARATOR: u8 = 0x1F;

/// What an audit row records about the shape of the change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// A row that did not exist now does. No `before`.
    Create,
    /// A row changed. Both `before` and `after`.
    Update,
    /// A row that existed no longer does. No `after`.
    Delete,
}

impl Action {
    /// The stored value. Matches the cloud's CHECK
    /// (`financial_audit_log_action_check`) and the local one.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Create => "create",
            Self::Update => "update",
            Self::Delete => "delete",
        }
    }
}

/// One entry, as written.
#[derive(Debug, Clone)]
pub struct AuditEntry {
    /// Primary key of the audit row.
    pub id: String,
    /// Dense, monotonic. A gap is a report from `verify_integrity()`.
    pub seq: i64,
    /// The chained hash of this row.
    pub row_hash: String,
}

/// Write one audit row inside the caller's transaction.
///
/// The `seq`/`prev_hash` read is a `MAX(seq)` against the table, which is safe
/// under SQLite's single writer and inside `BEGIN IMMEDIATE`: no second writer
/// can interleave between the read and the insert.
///
/// # Errors
/// [`crate::error::CoreError`] — a constraint refusal (the local table's
/// `audit_create_has_no_before` family) or a storage fault.
// The parameter list is the cloud's, in the cloud's order:
// `write_financial_audit(p_user_id, p_entity, p_entity_id, p_action, p_before,
// p_after)` plus the connection it must join and the timestamp the caller has
// already fixed. `20260725120000_audit_identity_and_function_grants.sql:74-77`
// records why that shape is worth preserving verbatim: *"Thirty-four call sites
// across fourteen migrations pass p_user_id positionally; changing the shape
// would be worse than the bug."* A struct here would read better and would make
// every future comparison against the cloud a translation exercise.
#[allow(clippy::too_many_arguments)]
pub fn write(
    connection: &Connection,
    user_id: &str,
    entity: &str,
    entity_id: &str,
    action: Action,
    before: Option<&str>,
    after: Option<&str>,
    created_at: &str,
) -> CoreResult<AuditEntry> {
    let head: Option<(i64, String)> = connection
        .query_row(
            "SELECT seq, row_hash FROM financial_audit_log ORDER BY seq DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    let (previous_seq, prev_hash) = match head {
        Some((seq, hash)) => (seq, Some(hash)),
        None => (0, None),
    };
    let seq = previous_seq.saturating_add(1);

    let row_hash = chain_hash(
        prev_hash.as_deref(),
        seq,
        entity,
        entity_id,
        action.as_str(),
        before,
        after,
        created_at,
    );

    let id = uuid::Uuid::new_v4().to_string();
    connection.execute(
        "INSERT INTO financial_audit_log
           (id, user_id, entity, entity_id, action, before_data, after_data,
            created_at, seq, prev_hash, row_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            id,
            user_id,
            entity,
            entity_id,
            action.as_str(),
            before,
            after,
            created_at,
            seq,
            prev_hash,
            row_hash
        ],
    )?;

    Ok(AuditEntry { id, seq, row_hash })
}

/// The chain hash, hex-encoded lower case.
///
/// Separated from [`write`] so it can be tested without a database and re-run
/// by `verify_integrity()` over stored rows.
#[must_use]
#[allow(clippy::too_many_arguments)]
pub fn chain_hash(
    prev_hash: Option<&str>,
    seq: i64,
    entity: &str,
    entity_id: &str,
    action: &str,
    before: Option<&str>,
    after: Option<&str>,
    created_at: &str,
) -> String {
    let mut hasher = Sha256::new();
    absorb(&mut hasher, prev_hash);
    let sequence = seq.to_string();
    absorb(&mut hasher, Some(sequence.as_str()));
    absorb(&mut hasher, Some(entity));
    absorb(&mut hasher, Some(entity_id));
    absorb(&mut hasher, Some(action));
    absorb(&mut hasher, before);
    absorb(&mut hasher, after);
    absorb(&mut hasher, Some(created_at));

    let digest = hasher.finalize();
    let mut hex = String::with_capacity(64);
    for byte in digest {
        // Two lower-case hex digits per byte. A lookup, not arithmetic: the
        // crate denies arithmetic with side effects and a hex encoder is not
        // where an exception should be spent.
        hex.push(HEX_DIGITS[usize::from(byte >> 4) & 0x0F]);
        hex.push(HEX_DIGITS[usize::from(byte) & 0x0F]);
    }
    hex
}

const HEX_DIGITS: [char; 16] = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f',
];

fn absorb(hasher: &mut Sha256, field: Option<&str>) {
    match field {
        None => hasher.update(b"-"),
        Some(value) => hasher.update(value.len().to_string().as_bytes()),
    }
    hasher.update([FIELD_SEPARATOR]);
    if let Some(value) = field {
        hasher.update(value.as_bytes());
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{chain_hash, Action};

    #[test]
    fn the_hash_is_stable_for_the_same_input() {
        let first = chain_hash(
            None,
            1,
            "transaction",
            "t1",
            "create",
            None,
            Some("{}"),
            "2024-01-01T00:00:00.000Z",
        );
        let second = chain_hash(
            None,
            1,
            "transaction",
            "t1",
            "create",
            None,
            Some("{}"),
            "2024-01-01T00:00:00.000Z",
        );
        assert_eq!(first, second);
        assert_eq!(first.len(), 64);
        assert!(first.bytes().all(|b| b.is_ascii_hexdigit()));
    }

    #[test]
    fn moving_a_character_between_fields_changes_the_hash() {
        // The reason every field is length-prefixed. Without it these two are
        // the same byte stream and a forger can shuffle field boundaries.
        let left = chain_hash(None, 1, "ab", "c", "create", None, None, "t");
        let right = chain_hash(None, 1, "a", "bc", "create", None, None, "t");
        assert_ne!(left, right);
    }

    #[test]
    fn an_absent_field_is_not_the_same_as_an_empty_one() {
        let absent = chain_hash(None, 1, "e", "i", "create", None, None, "t");
        let empty = chain_hash(None, 1, "e", "i", "create", Some(""), None, "t");
        assert_ne!(absent, empty);
    }

    #[test]
    fn the_chain_links() {
        let first = chain_hash(
            None,
            1,
            "transaction",
            "t1",
            "create",
            None,
            Some("{}"),
            "t",
        );
        let second = chain_hash(
            Some(&first),
            2,
            "transaction",
            "t2",
            "create",
            None,
            Some("{}"),
            "t",
        );
        let forged = chain_hash(
            Some("0"),
            2,
            "transaction",
            "t2",
            "create",
            None,
            Some("{}"),
            "t",
        );
        assert_ne!(second, forged);
    }

    #[test]
    fn actions_use_the_stored_spellings() {
        assert_eq!(Action::Create.as_str(), "create");
        assert_eq!(Action::Update.as_str(), "update");
        assert_eq!(Action::Delete.as_str(), "delete");
    }
}
