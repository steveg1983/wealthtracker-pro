//! `unarchive_account` — one click, because nothing ever left.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260721130000_soft_archive.sql:92-114`, which is still
//! the live definition — the marking migration restated its three neighbours and
//! left this one alone, because it reads no flag that was split. The client
//! calls it at one place (`transactionService.unarchiveAccount`), from the
//! Archive manager's "Keep all".
//!
//! # THE VERB WITH NO REFUSAL AT ALL, AND IT IS TRACED RATHER THAN ASSUMED
//!
//! The RPC does not look the account up, does not check `FOUND`, and raises
//! nothing. It issues two UPDATEs whose WHERE clauses carry the owner, and
//! answers with a count. So:
//!
//! * an account nobody has → `{unarchived: 0}`, no error;
//! * somebody else's account → `{unarchived: 0}`, no error, and nothing of
//!   theirs is touched, because both statements are scoped by `user_id`;
//! * an account with nothing archived → `{unarchived: 0}`, and the cutoff is
//!   still cleared, which is the point: "Keep all" must be able to undo a cutoff
//!   that has not caught anything up yet.
//!
//! This port keeps every one of those, including the silence. It is the opposite
//! decision from [`super::archive_transactions_before`] beside it, which raises
//! `account_not_found` — and the asymmetry is the cloud's, in one migration,
//! twenty lines apart. Reproduced rather than smoothed over for the reason the
//! whole crate reproduces refusal ORDER: a caller that branches on a refusal is
//! branching on the cloud's behaviour, and a port that invented one here would
//! turn a silent no-op into an error dialog nobody has ever seen.
//!
//! # IT NEVER TOUCHES THE COMMITMENT, AND A ROW THAT COMES BACK IS STILL R
//!
//! Two columns on the rows: `archived` and `updated_at`. `is_reconciled` is not
//! among them and must not be. Unarchiving is a decision about what the register
//! SHOWS; the commitment is a fact about a statement that was balanced, and
//! bringing a row back into view does not un-settle the statement it was
//! reconciled against. A port that cleared it would silently re-open every
//! finished reconciliation the account has ever had, and the account's own
//! `last_reconciled_balance` would then record a figure no set of rows agrees
//! with.
//!
//! The reverse is guarded by the schema rather than by this verb: the rows come
//! back with `is_reconciled = 1` untouched, so no `AFTER UPDATE OF is_reconciled`
//! fires and A-3 cannot re-archive them in the same breath. That is what the
//! soft archive's own comment means by *"never un-archives — unarchive is an
//! explicit action"*, read from the other end.
//!
//! # IT AUDITS NOTHING
//!
//! As [`super::archive_transactions_before`], and for the same reason: there is
//! no `write_financial_audit` in the function being ported. See that module for
//! the argument, which applies to both.
//!
//! # Balance-neutral
//!
//! A view flag and a date. The rows never left the balance, which is the whole
//! design of the soft archive.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::error::CoreResult;
use crate::row::account::{self, ListedAccount};

/// The command: `(p_user_id, p_account_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UnarchiveAccount {
    /// `p_user_id`. Both statements are scoped by it; an absent one matches no
    /// row and the answer is a truthful zero.
    #[serde(default)]
    pub user_id: Option<String>,
    /// `p_account_id`. Which account comes back.
    pub account_id: String,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct UnarchiveAccountResult {
    /// The projection both engines are compared on — the RPC's own
    /// `jsonb_build_object`, which has exactly one key.
    pub answer: UnarchiveAnswer,
    /// The account as stored afterwards, or `None` when the id named nothing
    /// this owner has — which is not an error here. Local, and outside the
    /// answer for [`super::archive_transactions_before`]'s reason.
    pub account: Option<ListedAccount>,
}

/// The RPC's return value.
#[derive(Debug, Serialize)]
pub struct UnarchiveAnswer {
    /// How many rows came back into the live register.
    pub unarchived: i64,
}

/// Bring an account's archived rows back, and forget its cutoff.
///
/// # Errors
/// [`crate::error::CoreError::Storage`] for a fault. There is no refusal: see
/// the module documentation, which traces why the RPC has none either.
#[allow(clippy::needless_pass_by_value)]
pub fn unarchive_account(
    connection: &mut Connection,
    command: UnarchiveAccount,
) -> CoreResult<UnarchiveAccountResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    let unarchived = write.execute(
        "UPDATE transactions
            SET archived   = 0,
                updated_at = ?1
          WHERE user_id = ?2
            AND account_id = ?3
            AND archived = 1",
        params![now, owner, command.account_id],
    )?;

    write.execute(
        "UPDATE accounts
            SET archive_through_date = NULL,
                updated_at           = ?1
          WHERE id = ?2
            AND user_id = ?3",
        params![now, command.account_id, owner],
    )?;

    let account = match owner {
        Some(owner) => account::read_listed(&write, &command.account_id, owner)?,
        None => None,
    };

    let count = super::count(unarchived)?;

    write.commit()?;

    Ok(UnarchiveAccountResult {
        answer: UnarchiveAnswer {
            unarchived: count,
        },
        account,
    })
}
