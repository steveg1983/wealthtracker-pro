//! `link_bank_account_snap` — the one write in this crate that sets an absolute
//! balance, and the reason that is not a contradiction.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260613090000_bank_sync_atomic_import.sql:184-220`.
//! Traced by grep across every migration: defined once, never redefined.
//! `20260725120000:257` restates its grant and changes nothing.
//!
//! # The absent verb, and why this one is not it
//!
//! `verbs/mod.rs` opens by saying what is deliberately missing:
//!
//! > **`set_account_balance`.** DESIGN.md §6.5: *"Note what is absent:
//! > `set_account_balance`. Deliberately. B-2."* Balance moves only as
//! > `balance = balance ± delta` […] There is no way to set an absolute figure
//! > because there is no function that takes one.
//!
//! This function takes an absolute figure. It is still not a balance setter,
//! because it moves `initial_balance` by the same delta in the same statement:
//!
//! ```text
//! initial_balance := initial_balance + (bank − balance)
//! balance         := bank
//! ```
//!
//! B-1 says `balance = initial_balance + Σ(transactions.amount)`. Adding the same
//! delta to both sides leaves it true, which is what makes this a **rebase**
//! rather than an override. MEASURED on the reference cluster, on an account
//! holding −25.00 with one −25.00 row against it, snapped to 10.00:
//!
//! ```text
//! balance          -25.00 -> 10.00
//! initial_balance    0.00 -> 35.00
//! bank_balance          — -> 10.00
//! B-1 holds                 true
//! ```
//!
//! Not one transaction was invented, moved or deleted to get there. The account
//! is now saying "I started with 35.00 and have spent 25.00", which is exactly
//! what a person means when they link an account that has history the app has
//! never seen. `bankBalanceSnapshot.ts:292` gates when it may run; this is what
//! it does when it does.
//!
//! # `bank_balance` is written here and compared against everywhere else
//!
//! B-6, and `20260807200000:50-58` states it: *"bank_balance is the
//! reconciliation reference — what the bank says the account holds […] Writers of
//! this column must set bank_balance (and now bank_balance_date) and NOTHING
//! else"*. This function is the exception the invariant already knows about: it
//! is the LINK moment, and the whole point of a link snap is that the ledger is
//! being brought to the bank's number once, deliberately, with an audit row
//! saying so.
//!
//! MEASURED: it does **not** set `bank_balance_date`, which is the column
//! `20260807200000` added so an old statement cannot overwrite a newer figure.
//! That is the live behaviour and it is ported unchanged; a snap that dated its
//! own figure would be a change to the cloud, not a port of it.
//!
//! # Two refusals that are deliberately one
//!
//! MEASURED: an account that does not exist and an account owned by somebody
//! else both refuse with `account_not_found_or_not_owned`. That is the shape
//! every RPC in this schema uses and the reason is in
//! [`crate::row::account::read_owned`]: telling the two apart confirms an id
//! exists to a caller who may not see it.
//!
//! # A NULL bank balance, and a divergence that cannot be expressed here
//!
//! MEASURED, and it is worth writing down because it is a live cloud defect
//! rather than a difference of design: `link_bank_account_snap(account, user,
//! NULL)` is ACCEPTED, and it sets `balance`, `initial_balance` and
//! `bank_balance` all to NULL — `COALESCE(initial_balance,0) + (NULL − balance)`
//! is NULL, and so is the assignment to `balance`. An account's ledger is
//! destroyed by a link that reported nothing.
//!
//! It cannot happen here, and not because this verb checks for it: the argument
//! is a [`crate::money::Money`], which has no null, and `accounts.balance_minor`
//! is `NOT NULL`. The state is unreachable by construction on both counts. A
//! DECLARED divergence in the local edition's favour, with nothing to implement.
//!
//! # No guard, measured
//!
//! This is an UPDATE of `accounts`, and every `trg_protect_split_*` trigger is
//! `BEFORE UPDATE OF` a column on `transactions`. MEASURED anyway, because the
//! guard question is asked per verb and answered by running it: snapping an
//! account whose transaction is a split parent is accepted, guard table empty
//! throughout. What DOES fire is `trg_accounts_updated_at` — and it stands down
//! of its own accord, because this verb writes `updated_at` itself and the
//! trigger's WHEN is `NEW.updated_at IS OLD.updated_at`.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, AccountRow};

/// The command. The RPC's three arguments.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LinkBankAccountSnap {
    /// `p_account_id`.
    pub account_id: String,
    /// `p_user_id`. Not optional, unlike the ledger verbs: this function is
    /// service-role only in the cloud and its owner argument has no default.
    pub user_id: String,
    /// `p_bank_balance`. A decimal string; a JSON number is refused at the
    /// boundary, because a JSON number is a binary float.
    pub bank_balance: Money,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct LinkBankAccountSnapResult {
    /// The account as it stands after the snap — the RPC returns the whole row.
    pub answer: AccountRow,
    /// Dense sequence number of the audit row written for this snap.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Bring an account to the bank's figure without breaking the ledger identity.
///
/// # Errors
/// [`CoreError::Refused`] for `account_not_found_or_not_owned` or a rule the file
/// enforced — including `accounts_balance_bounded`, which is what stops a bank
/// reporting a number this file cannot hold;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn link_bank_account_snap(
    connection: &mut Connection,
    command: LinkBankAccountSnap,
) -> CoreResult<LinkBankAccountSnapResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    // `SELECT … FOR UPDATE` in the cloud. SQLite has one writer and this is
    // inside BEGIN IMMEDIATE, so the row cannot move between the read and the
    // write; the lock has nothing to add.
    let Some(before) = account::read_owned(&transaction, &command.account_id, &command.user_id)?
    else {
        return Err(CoreError::Refused(
            Refusal::named(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            )
            .with_hint("The account does not exist or does not belong to this user."),
        ));
    };

    // The delta, computed once and applied to both sides so B-1 survives it.
    // Checked arithmetic: a bank figure at one end of the range against a balance
    // at the other would overflow, and an overflow here would move the ledger by
    // a plausible-looking wrong amount rather than failing.
    let delta = command
        .bank_balance
        .minor()
        .checked_sub(before.balance.minor())
        .ok_or_else(out_of_range)?;
    let rebased = before
        .initial_balance
        .minor()
        .checked_add(delta)
        .ok_or_else(out_of_range)?;

    let moved = transaction.execute(
        "UPDATE accounts
            SET initial_balance_minor = ?1,
                balance_minor         = ?2,
                bank_balance_minor    = ?2,
                updated_at            = ?3
          WHERE id = ?4
            AND user_id = ?5",
        params![
            rebased,
            command.bank_balance.minor(),
            now,
            command.account_id,
            command.user_id
        ],
    )?;
    // Unreachable: the row was found a moment ago under the same predicate and
    // nothing can interleave inside BEGIN IMMEDIATE. Asserted because SQLite
    // reports zero changed rows and raises nothing at all, which is the failure
    // mode this crate refuses to leave silent.
    if moved != 1 {
        return Err(CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between reading it and snapping it",
        ));
    }

    let after = account::read_owned(&transaction, &command.account_id, &command.user_id)?
        .ok_or_else(|| {
            CoreError::refuse(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                "the account disappeared between snapping it and reading it back",
            )
        })?;

    let entry = audit::write(
        &transaction,
        &command.user_id,
        "account",
        &command.account_id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(LinkBankAccountSnapResult {
        answer: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

fn out_of_range() -> CoreError {
    CoreError::refuse(
        "amount_out_of_range",
        "the distance between this account's balance and the bank's figure is more than this \
         ledger can count",
    )
}
