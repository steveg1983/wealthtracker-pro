//! `close_account` — one column, and everything that is deliberately not in it.
//!
//! # What it is a port OF
//!
//! `accountService.deleteAccount` (`src/services/api/accountService.ts:338-372`),
//! whose whole body — once the local-mode branch is set aside — is:
//!
//! ```text
//! .from('accounts').update({ is_active: false }).eq('id', id)[.eq('user_id', …)]
//! ```
//!
//! The name is the one thing about it that has ever been misleading, and the
//! seam already renamed it: `closeAccount`, because *"a deleted account is a
//! hole in a ledger: its transactions would have nowhere to belong"*
//! (`dataPort.ts:345-350`). The service's own comment says the same —
//! *"closing is a SOFT close (isActive=false, reopenable), never a hard
//! delete — the Close button promises 'you can reopen it at any time'."*
//!
//! # WHAT CLOSE MEANS, TRACED RATHER THAN ASSUMED
//!
//! The whole of it, and each half was checked against the schema rather than
//! guessed at:
//!
//! | | what happens |
//! | --- | --- |
//! | the account row | `is_active` goes false. Nothing else. |
//! | its transactions | **untouched** — every row stays where it is, and so does the balance |
//! | its To/From category | hidden, by C-4, in the same statement |
//! | its balance | unchanged, and still `initial_balance + Σ(rows)` |
//! | the live list | it leaves, because `list_accounts` filters `is_active` |
//! | the closed list | it appears, because `list_closed_accounts` filters the other way |
//! | reopening | `update_account` with `is_active: true`; there is no separate verb, and the cloud has none either |
//! | `archive_through_date` | **not touched.** Archiving is a different thing done for a different reason, and conflating the two is how a close would start hiding rows from the register |
//!
//! The third row is the one that would be missed by writing this verb from its
//! name: `trg_sync_transfer_category_for_account` is `AFTER UPDATE OF name,
//! is_active`, so closing an account takes its `To/From <name>` category out of
//! every transaction dropdown without anything here knowing about it. That is
//! C-4, it is the port of `20260708140000:90-119`, and the constraint spec
//! `c4-closing-an-account-hides-its-transfer-category` already proves both
//! engines do it. A verb that "helpfully" also deactivated the category would
//! write it twice.
//!
//! # Closing a closed account is not an error
//!
//! MEASURED on both engines: the UPDATE matches the row and reports one row
//! changed whether or not the value differs, so a second close is accepted and
//! writes an audit entry whose `before` and `after` differ only in
//! `updated_at`. The cloud behaves identically. Idempotent, not silent.
//!
//! # No guard, measured
//!
//! An UPDATE of `accounts`; see [`super::update_account`], which is the same
//! answer for the same reasons. `tests/account_family.rs` asserts the guard
//! table empty across a close.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::account::{self, ListedAccount};

use super::update_account::read_scoped;

/// The command. The two arguments the client's `.update().eq().eq()` carries.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CloseAccount {
    /// Which account.
    pub id: String,
    /// Whose. Absent names no owner — see [`super::update_account`].
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The seam's `closeAccount` answers `void`, and this answers the row anyway:
/// the audit entry needs the `after` state regardless, an answer costs one read
/// that has already happened, and a caller that wants to update its own copy of
/// the account (rather than re-listing both lists) can. Nothing is required to
/// look at it.
#[derive(Debug, Serialize)]
pub struct CloseAccountResult {
    /// The account as stored after the close.
    pub answer: ListedAccount,
    /// Dense sequence number of the audit row written for this close.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Close one account, leaving every transaction it holds exactly where it is.
///
/// # Errors
/// [`CoreError::Refused`] for `account_not_found_or_not_owned`;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn close_account(
    connection: &mut Connection,
    command: CloseAccount,
) -> CoreResult<CloseAccountResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let Some(before) = read_scoped(&transaction, &command.id, command.user_id.as_deref())? else {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    };

    // ONE column. `updated_at` is written here rather than left to
    // `trg_accounts_updated_at` so that the row, the To/From category C-4
    // touches and the audit entry all carry one instant — the same reason
    // `create_transaction` binds its two timestamps to one parameter.
    let changed = transaction.execute(
        "UPDATE accounts
            SET is_active  = 0,
                updated_at = ?1
          WHERE id = ?2",
        params![now, command.id],
    )?;
    if changed != 1 {
        return Err(CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between finding it and closing it",
        ));
    }

    let after = account::read_listed(&transaction, &command.id, &before.user_id)?.ok_or_else(
        || {
            CoreError::refuse(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                "the account disappeared between closing it and reading it back",
            )
        },
    )?;

    let entry = audit::write(
        &transaction,
        &after.user_id,
        "account",
        &command.id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(CloseAccountResult {
        answer: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}
