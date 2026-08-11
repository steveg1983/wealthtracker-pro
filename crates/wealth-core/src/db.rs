//! The connection, its PRAGMAs, and the assertions that prove they took.
//!
//! # `PRAGMA foreign_keys` is the single most likely silent failure in the port
//!
//! DESIGN.md §2.1, verified: it defaults to **0**, and it is **per connection**.
//! Every `ON DELETE SET NULL` in `schema.sql` — including T-8, the deliberate
//! stranding of a transfer's other leg, and R-5 — is inert without it. Nothing
//! fails; the rows just quietly stop being related.
//!
//! So it is set here, where no caller can forget it, and then **read back**.
//! Setting a PRAGMA that does not apply is silent in SQLite: `PRAGMA
//! foreign_keys = ON` inside an open transaction is a no-op with no error. A
//! set without a read-back proves nothing.
//!
//! # `PRAGMA recursive_triggers` must stay OFF
//!
//! `schema.sql`'s `updated_at` triggers are AFTER UPDATE triggers that issue
//! their own UPDATE, because SQLite's BEFORE triggers cannot assign to `NEW`
//! (DESIGN.md §2.3, verified: `SET NEW.u = 'x'` is a parse error). That shape is
//! safe *only* while recursive triggers are off. If it is ever switched on they
//! recurse until SQLITE_ERROR, on every edit. It is asserted, not assumed.

use rusqlite::{Connection, OpenFlags};

use crate::error::{CoreError, CoreResult};

/// The lowest SQLite this schema parses on: `STRICT` tables arrived in 3.37.
/// `libsqlite3-sys`'s `bundled` feature pins the version at build time, so this
/// is a tripwire for a future switch to the system library rather than a real
/// runtime risk today.
const MIN_SQLITE: (i32, i32, i32) = (3, 37, 0);

/// Open a local edition file and put its connection into the only state the
/// schema's guarantees hold in.
///
/// # Errors
/// [`CoreError::Storage`] if the file cannot be opened, if the SQLite build is
/// too old, or if any PRAGMA did not take.
pub fn open(path: &std::path::Path) -> CoreResult<Connection> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_URI,
    )?;
    configure(&connection)?;
    assert_journal_mode(&connection)?;
    Ok(connection)
}

/// Prove the file is in the journal mode the schema chose.
///
/// # Why this is not in [`configure`]
///
/// Everything in there is PER CONNECTION. `journal_mode` is not: `schema.sql`
/// says so at the pragma — *"persistent (stored in the file header)"* — which
/// means it is a property of the FILE and there is nothing to set on the way in.
/// It is applied once, by the schema, when the file is made.
///
/// So this is a read-back with no set in front of it, and that is exactly what
/// makes it worth doing: a file that came from somewhere else, or that was
/// converted by another tool, or whose creation was interrupted, opens perfectly
/// well in `delete` mode and behaves identically until the moment it matters.
/// What WAL buys is that a reader does not block the writer and that a crash
/// mid-transaction rolls back from a log rather than from a journal the
/// filesystem may have reordered. A ledger quietly running without it has a
/// different crash-safety story from the one the schema decided, and nothing
/// would ever say so.
///
/// It is also why this lives in [`open`] rather than in [`configure`]: an
/// in-memory database has no file header and answers `memory`, which is correct
/// for it and would make every one of the crate's own tests fail an assertion
/// about a property they do not have.
///
/// # Errors
/// [`CoreError::Storage`] naming the mode the file is actually in.
pub fn assert_journal_mode(connection: &Connection) -> CoreResult<()> {
    let mode: String = connection.pragma_query_value(None, "journal_mode", |row| row.get(0))?;
    if !mode.eq_ignore_ascii_case("wal") {
        return Err(fault(&format!(
            "This ledger is in journal mode '{mode}' and the schema is written for WAL. \
             A file that was converted or half-created keeps its own mode, and in any other \
             mode a reader blocks the writer and a crash recovers by a different route than \
             the one this schema was designed and measured against."
        )));
    }
    Ok(())
}

/// Open a brand-new in-memory file. Used by the crate's own tests; the real
/// application always has a path.
///
/// # Errors
/// As [`open`].
pub fn open_in_memory() -> CoreResult<Connection> {
    let connection = Connection::open_in_memory()?;
    configure(&connection)?;
    Ok(connection)
}

/// Apply and then verify every connection-level setting the schema depends on.
///
/// # Errors
/// [`CoreError::Storage`] with a message naming the setting that did not take.
pub fn configure(connection: &Connection) -> CoreResult<()> {
    assert_version(connection)?;

    connection.pragma_update(None, "foreign_keys", "ON")?;
    // A busy file is a fault, not a hang. One writer, so this only ever fires
    // when another process has the file open.
    connection.pragma_update(None, "busy_timeout", 5_000)?;

    let foreign_keys: i64 =
        connection.pragma_query_value(None, "foreign_keys", |row| row.get(0))?;
    if foreign_keys != 1 {
        return Err(fault(
            "PRAGMA foreign_keys did not take. Every ON DELETE SET NULL in the schema is \
             inert on this connection, including the one that deliberately strands a \
             transfer's other leg.",
        ));
    }

    let recursive: i64 =
        connection.pragma_query_value(None, "recursive_triggers", |row| row.get(0))?;
    if recursive != 0 {
        return Err(fault(
            "PRAGMA recursive_triggers is ON. The updated_at triggers issue their own \
             UPDATE (SQLite BEFORE triggers cannot assign to NEW) and will recurse.",
        ));
    }

    Ok(())
}

fn assert_version(connection: &Connection) -> CoreResult<()> {
    let version: String = connection.query_row("SELECT sqlite_version()", [], |row| row.get(0))?;
    let mut parts = version
        .split('.')
        .map(|part| part.parse::<i32>().unwrap_or(-1));
    let found = (
        parts.next().unwrap_or(-1),
        parts.next().unwrap_or(-1),
        parts.next().unwrap_or(0),
    );
    if found < MIN_SQLITE {
        return Err(fault(&format!(
            "SQLite {version} cannot parse this schema; STRICT tables need {}.{}.{}",
            MIN_SQLITE.0, MIN_SQLITE.1, MIN_SQLITE.2
        )));
    }
    Ok(())
}

fn fault(message: &str) -> CoreError {
    CoreError::Storage(rusqlite::Error::SqliteFailure(
        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISUSE),
        Some(message.to_owned()),
    ))
}

/// The current UTC instant in the exact shape `schema.sql`'s column defaults
/// use (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`).
///
/// Read from SQLite rather than from a Rust clock crate so that a row written
/// by a verb and a row written by a column default are stamped by the same
/// clock in the same format — `transactions_timestamps_shaped` enforces the
/// format, and a second source would eventually drift from it.
///
/// # Errors
/// [`CoreError::Storage`] if the query fails.
pub fn now(connection: &Connection) -> CoreResult<String> {
    Ok(
        connection.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')", [], |row| {
            row.get(0)
        })?,
    )
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{configure, now, open_in_memory};
    use rusqlite::Connection;

    #[test]
    fn a_configured_connection_enforces_foreign_keys() {
        let connection = open_in_memory().unwrap();
        let value: i64 = connection
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .unwrap();
        assert_eq!(value, 1);
    }

    #[test]
    fn configure_refuses_a_connection_whose_pragma_cannot_take() {
        // Inside an open transaction, `PRAGMA foreign_keys` is a documented
        // no-op. This is the exact silent failure the read-back exists to
        // catch, so it is worth proving the read-back catches it.
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("PRAGMA foreign_keys = OFF; BEGIN;")
            .unwrap();
        let error = configure(&connection).expect_err("a no-op PRAGMA must be reported");
        assert!(
            error.to_string().contains("foreign_keys did not take"),
            "{error}"
        );
    }

    #[test]
    fn a_file_not_in_wal_is_refused_by_name() {
        // The whole point of a read-back with no set in front of it: this file
        // opens perfectly well and behaves identically right up to the crash
        // the mode is about.
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("rollback-journal.db");
        let made = Connection::open(&path).unwrap();
        made.pragma_update(None, "journal_mode", "DELETE").unwrap();
        made.execute_batch("CREATE TABLE t (x INTEGER)").unwrap();
        drop(made);

        let error = super::open(&path).expect_err("a file outside WAL must be reported");
        assert!(error.to_string().contains("journal mode 'delete'"), "{error}");
    }

    #[test]
    fn a_file_the_schema_made_is_in_wal_and_opens() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("ledger.db");
        let made = Connection::open(&path).unwrap();
        configure(&made).unwrap();
        crate::apply_schema(&made).unwrap();
        drop(made);

        let opened = super::open(&path).expect("a schema-made file opens");
        let journal: String = opened
            .pragma_query_value(None, "journal_mode", |row| row.get(0))
            .unwrap();
        assert_eq!(journal, "wal");
    }

    #[test]
    fn the_clock_matches_the_shape_the_schema_checks() {
        let connection = open_in_memory().unwrap();
        let stamp = now(&connection).unwrap();
        assert_eq!(stamp.len(), 24, "{stamp}");
        assert!(stamp.ends_with('Z'), "{stamp}");
        assert_eq!(stamp.as_bytes().get(10), Some(&b'T'), "{stamp}");
    }
}
