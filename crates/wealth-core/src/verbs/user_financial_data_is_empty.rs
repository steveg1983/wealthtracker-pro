//! `user_financial_data_is_empty` — the port of the question a restore asks
//! before it will do anything.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260807083000_user_data_restore.sql:107-130`. Traced by
//! grep across every migration: defined once, never redefined.
//!
//! # The three tables, and why it is not "is there any data"
//!
//! `accounts`, `categories`, `transactions` — and nothing else. MEASURED on the
//! reference cluster: a login holding only a budget answers **true**. That is
//! not an oversight in the RPC, it is the precondition doing exactly the job the
//! migration describes. The hazards the emptiness rule neutralises are all about
//! those three tables:
//!
//! * inserting an account mints a To/From **category** with a fresh id, colliding
//!   with the one the backup already carries under its original id;
//! * `categories_user_id_name_parent_id_key` collides with a seeded default set;
//! * `transactions_import_source_unique` collides with a previous import.
//!
//! A budget cannot cause any of them. So the question is the narrow one, and
//! `localBackupService.localFinancialDataIsEmpty` asks the same narrow one *"so
//! that 'empty' means one thing across both engines"*.
//!
//! # `p_user_id IS NULL` means "every row in the table"
//!
//! MEASURED: with no owner named, the RPC's `EXISTS` has no filter and reports on
//! the whole table. In the cloud that is nearly always the same answer, because
//! RLS has already narrowed what the caller can see. There is no RLS in a local
//! file, so here it is literally every row — which for a single-login file is
//! also the same answer, and is why the argument is passed through rather than
//! quietly required.
//!
//! # It writes nothing, and audits nothing
//!
//! The only verb in this crate that opens no transaction: there is nothing to be
//! atomic about, and an audit entry recording that somebody asked a question
//! would be noise in a log whose whole value is that every line in it is a
//! change.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;

/// The command. The RPC's single argument.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UserFinancialDataIsEmpty {
    /// `p_user_id`. Absent means "every row in the file".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// The RPC returns a bare boolean; this is that boolean, in the object shape the
/// differential harness compares two engines' answers in.
#[derive(Debug, Serialize)]
pub struct IsEmptyAnswer {
    /// True when there is no account, no category and no transaction.
    pub empty: bool,
}

/// The answer.
#[derive(Debug, Serialize)]
pub struct UserFinancialDataIsEmptyResult {
    /// The projection both engines are compared on.
    pub answer: IsEmptyAnswer,
}

/// Is this file empty enough to restore a backup into?
///
/// # Errors
/// [`crate::error::CoreError::Storage`] if the read fails. This verb has no
/// refusal: every question it can be asked has an answer.
#[allow(clippy::needless_pass_by_value)]
pub fn user_financial_data_is_empty(
    connection: &Connection,
    command: UserFinancialDataIsEmpty,
) -> CoreResult<UserFinancialDataIsEmptyResult> {
    let found: i64 = connection.query_row(
        "SELECT EXISTS (
           SELECT 1 FROM accounts     WHERE (?1 IS NULL OR user_id = ?1)
            UNION ALL
           SELECT 1 FROM categories   WHERE (?1 IS NULL OR user_id = ?1)
            UNION ALL
           SELECT 1 FROM transactions WHERE (?1 IS NULL OR user_id = ?1)
         )",
        params![command.user_id],
        |row| row.get(0),
    )?;

    Ok(UserFinancialDataIsEmptyResult { answer: IsEmptyAnswer { empty: found == 0 } })
}
