//! `finalize_reconciliation` — the only thing in the system that COMMITS a row.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260810200000_marking_is_not_reconciling.sql:209-278`.
//! It is the one function that migration CREATED rather than restated, and it
//! is what turned Finalize from a button whose only visible effect was a date
//! into the act that finishes a reconciliation. The client calls it at one place
//! (`transactionService.finalizeReconciliation`), from the reconciliation
//! screen's Finish.
//!
//! # IT CONVERTS EXACTLY THE WORKING SET
//!
//! `is_cleared = true AND is_reconciled IS NOT DISTINCT FROM false` — and the
//! second half is `IS NOT DISTINCT FROM false` rather than `IS DISTINCT FROM
//! true` ON PURPOSE. The migration argues it:
//!
//! > a NULL row is one the old world already called reconciled, and sweeping
//! > those in would rewrite (and re-audit, and re-stamp `updated_at` on) the
//! > entire history of the account the first time anybody finalized it, for no
//! > change in what any screen shows.
//!
//! In SQLite `IS NOT DISTINCT FROM false` is spelled `is_reconciled IS 0`, which
//! is NOT the same predicate as `is_reconciled = 0` (that one is NULL, and
//! therefore false, for a pre-split row — the same answer here by luck rather
//! than by statement, and a spelling that would silently start including NULLs
//! the day it was written the other way round). It is spelled `IS 0`.
//!
//! # IT RECORDS THE FIGURE IT WAS SETTLED AGAINST
//!
//! Because the next reconciliation opens at last time's ending balance, and
//! because *"reconciled on the 3rd" without "against what" is a claim nobody can
//! check afterwards*. Both go on the account: `last_reconciled_date` and
//! `last_reconciled_balance` (`last_reconciled_balance_minor` here — slice 20
//! added the column for `AccountUpdate`'s sake, before there was a verb to write
//! it).
//!
//! **ZERO IS A FIGURE.** A NULL ending balance is refused by name; `0` is
//! accepted and recorded, because an account swept to zero every night closes on
//! exactly that. The two must not share a representation and the column is
//! nullable so that they do not.
//!
//! # ALL-OR-NOTHING, AND WHAT THE INTERMEDIATE STATE WOULD COST
//!
//! One transaction: the rows and the account's record of them land together or
//! neither does. Rows committed against a statement the account has no memory of
//! is the state that makes the NEXT reconciliation start from a figure that is
//! not the one this one finished on.
//!
//! # BALANCE-NEUTRAL, AND THE ONE FIGURE THAT LOOKS LIKE MONEY
//!
//! It writes one flag per row and two records on the account, and never touches
//! `balance` or `initial_balance`. `last_reconciled_balance` is a RECORD of a
//! figure a person confirmed on a day: never added to, never compared against
//! `balance` by anything here, and never reconciled TO — a difference between
//! the two is the thing the screen exists to show, and closing it silently would
//! be inventing money. It still crosses as a [`Money`] string, because a
//! statement balance is money and a JSON number is a double.
//!
//! # THE OWNER IS REQUIRED, WHICH IS UNUSUAL IN THIS CRATE
//!
//! Every other verb here takes `Option<String>` and lets an absent owner stand
//! the guard down — the local twin of the cloud falling back to RLS. This RPC's
//! `p_user_id` has no default and its account lookup is `WHERE id = p_account_id
//! AND user_id = p_user_id`, so a NULL owner matches nothing and the call is
//! refused `account_not_found_or_not_owned`. The port keeps `Option` so that the
//! shape of a payload is the same everywhere, and reproduces the SQL's answer:
//! no owner, no account, refused.
//!
//! # The sweep fires here, and only here
//!
//! This verb writes `is_reconciled = 1`, so `trg_sweep_reconciled_into_archive`
//! fires for every row it converts, and archives the ones dated on or before
//! their account's cutoff. That is A-3 and it is the point of the split: a
//! COMMITTED row may drop off the live register, a MARKED one may not.
//!
//! The cloud does it in a BEFORE trigger that assigns `NEW.archived := true`,
//! which SQLite cannot do, so `schema.sql` issues a second UPDATE from an AFTER
//! trigger. The end state is identical and the audit entry says so on both
//! engines: this verb reads the row back AFTER the statement, so the `after` it
//! records carries `archived` as the sweep left it rather than as the SET list
//! wrote it.
//!
//! # Which guard it holds: none, and measured
//!
//! It writes `is_reconciled` and `updated_at` on transactions and three columns
//! on the account. No split protection watches any of them; C-4 watches `name`
//! and `is_active`, neither of which it writes; `trg_accounts_updated_at` stands
//! down of its own accord because this writes `updated_at` itself.
//! `tests/reconciliation_family.rs` asserts the guard table empty across a
//! finalize.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, ListedAccount};
use crate::row::{self, TransactionRow, WrittenTransaction};

/// The command: `(p_user_id, p_account_id, p_ending_balance, p_reconciled_on)`.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FinalizeReconciliation {
    /// `p_user_id`. See the module docs: no owner, no account.
    #[serde(default)]
    pub user_id: Option<String>,
    /// `p_account_id`. Which account is being finished.
    pub account_id: String,
    /// `p_ending_balance`. The statement's closing figure, as a decimal string.
    /// Absent is refused by name; `"0"` is a real answer.
    #[serde(default)]
    pub ending_balance: Option<Money>,
    /// `p_reconciled_on`. The day it was settled. Absent means today, which is
    /// the RPC's `COALESCE(p_reconciled_on, CURRENT_DATE)`.
    #[serde(default)]
    pub reconciled_on: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct FinalizeReconciliationResult {
    /// The projection both engines are compared on — the RPC's own
    /// `jsonb_build_object`, key for key. Everything below it is local.
    pub answer: FinalizeAnswer,
    /// The account as stored afterwards.
    pub account: ListedAccount,
    /// The rows converted, as stored, in the order they were written.
    pub transactions: Vec<WrittenTransaction>,
    /// Dense sequence number of the LAST audit row written — the account's,
    /// which is always written, so this is never `None`.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// The RPC's return value.
#[derive(Debug, Serialize)]
pub struct FinalizeAnswer {
    /// How many rows this call converted from marked to committed. Rows already
    /// committed are not counted twice, and pre-split rows are not counted at
    /// all.
    pub reconciled: i64,
    /// The figure the account now records. Echoed back because the screen shows
    /// it, and because a caller must never have to re-read to learn what it just
    /// wrote. A decimal STRING, as every figure that leaves this crate is.
    pub ending_balance: Money,
    /// The day the account now records.
    pub reconciled_on: String,
}

/// Commit an account's marked rows and record the statement they were settled
/// against, in one transaction.
///
/// # Errors
/// [`CoreError::Refused`] for `ending_balance_required` and for
/// `account_not_found_or_not_owned`; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn finalize_reconciliation(
    connection: &mut Connection,
    command: FinalizeReconciliation,
) -> CoreResult<FinalizeReconciliationResult> {
    // First, and before the transaction opens: the ending balance is the whole
    // point of finishing, and a NULL one would record "reconciled against
    // nothing". The RPC checks it first too.
    let Some(ending_balance) = command.ending_balance else {
        return Err(CoreError::Refused(
            Refusal::named(
                "ending_balance_required",
                "ending_balance_required",
            )
            .with_hint(
                "A reconciliation is settled against a statement's closing figure. £0.00 is a \
                 figure; no figure at all is not.",
            ),
        ));
    };

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    // `COALESCE(p_reconciled_on, CURRENT_DATE)`. The day is validated rather
    // than trusted: the column is TEXT here and `date` there, so 31 February
    // would be refused by Postgres and stored by a `LIKE '____-__-__'` CHECK.
    let reconciled_on = match command.reconciled_on.as_deref() {
        Some(stated) => super::create_account::calendar_day(stated, "reconciled_on")?
            .unwrap_or_else(|| today(&now)),
        None => today(&now),
    };

    let before_account = read_owned_account(&write, &command.account_id, owner)?;
    let converted = commit_the_working_set(
        &write,
        &before_account.user_id,
        &command.account_id,
        &now,
    )?;

    let changed = write.execute(
        "UPDATE accounts
            SET last_reconciled_date          = ?1,
                last_reconciled_balance_minor = ?2,
                updated_at                    = ?3
          WHERE id = ?4
            AND user_id = ?5",
        params![
            reconciled_on,
            ending_balance.minor(),
            now,
            command.account_id,
            before_account.user_id
        ],
    )?;
    if changed != 1 {
        return Err(CoreError::refuse(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            "the account disappeared between finding it and recording the reconciliation",
        ));
    }

    let after_account = account::read_listed(&write, &command.account_id, &before_account.user_id)?
        .ok_or_else(|| {
            CoreError::refuse(
                Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
                "the account disappeared between recording the reconciliation and reading it back",
            )
        })?;

    let entry = audit::write(
        &write,
        &after_account.user_id,
        "account",
        &command.account_id,
        Action::Update,
        Some(&super::json_of(&before_account)?),
        Some(&super::json_of(&after_account)?),
        &now,
    )?;

    let reconciled = super::count(converted.len())?;

    // The result projection, taken before the commit and beside the audit
    // rather than instead of it: every `json_of` above still serialises the
    // audit projection, and these add the one column an answer needs.
    let converted = row::written_all(&write, converted)?;

    write.commit()?;

    Ok(FinalizeReconciliationResult {
        answer: FinalizeAnswer {
            reconciled,
            ending_balance,
            reconciled_on,
        },
        account: after_account,
        transactions: converted,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// Convert every marked-but-uncommitted row of one account, audited one by one.
///
/// The RPC's `FOR v_old IN SELECT … FOR UPDATE LOOP`, and the two halves of its
/// WHERE clause are the whole selection rule: `is_cleared = 1` (this is the
/// working set a person built up by ticking) and `is_reconciled IS 0` (NOT `= 0`
/// — a pre-split NULL is history the old world already called reconciled, and
/// sweeping it in would re-audit and re-stamp the whole account).
///
/// The ids are collected before the loop rather than iterated live, because the
/// UPDATE inside it fires `trg_sweep_reconciled_into_archive`, and walking a
/// cursor over a table being written through a trigger is a different question
/// on every engine. The set cannot change under us: one verb, one IMMEDIATE
/// transaction, one writer.
fn commit_the_working_set(
    write: &rusqlite::Transaction<'_>,
    owner: &str,
    account_id: &str,
    now: &str,
) -> CoreResult<Vec<TransactionRow>> {
    let ids = {
        let mut statement = write.prepare(
            "SELECT id FROM transactions
              WHERE user_id = ?1
                AND account_id = ?2
                AND is_cleared = 1
                AND is_reconciled IS 0
              ORDER BY id",
        )?;
        let rows = statement
            .query_map(params![owner, account_id], |record| {
                record.get::<_, String>(0)
            })?;
        let mut ids = Vec::new();
        for id in rows {
            ids.push(id?);
        }
        ids
    };

    let mut converted = Vec::new();
    for id in &ids {
        let before = row::read_transaction(write, id)?;
        let changed = write.execute(
            "UPDATE transactions
                SET is_reconciled = 1,
                    updated_at    = ?1
              WHERE id = ?2",
            params![now, id],
        )?;
        if changed != 1 {
            return Err(CoreError::refuse(
                "transaction_not_found",
                "a transaction being committed disappeared between finding it and writing it",
            ));
        }
        // Read back AFTER the statement, so the sweep's archive is in the
        // `after` this audits — which is what the cloud's `RETURNING *` gives it
        // from a BEFORE trigger.
        let after = row::read_transaction(write, id)?;

        audit::write(
            write,
            &after.user_id,
            "transaction",
            &after.id,
            Action::Update,
            Some(&super::json_of(&before)?),
            Some(&super::json_of(&after)?),
            now,
        )?;
        converted.push(after);
    }
    Ok(converted)
}

/// The account, scoped as the RPC scopes it: `id = p_account_id AND user_id =
/// p_user_id`, with a NULL owner matching nothing.
fn read_owned_account(
    connection: &Connection,
    account_id: &str,
    user_id: Option<&str>,
) -> CoreResult<ListedAccount> {
    let owner = user_id.ok_or_else(not_found)?;
    account::read_listed(connection, account_id, owner)?.ok_or_else(not_found)
}

fn not_found() -> CoreError {
    CoreError::Refused(
        Refusal::named(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
        )
        .with_hint("The account does not exist or does not belong to this user."),
    )
}

/// `CURRENT_DATE`, from the instant this call is stamping everything else with.
///
/// Taken from `now` rather than asked for separately, so that a finalize which
/// runs across midnight cannot record one day on the account and another on the
/// rows it wrote. `db::now` is an ISO instant, and its first ten characters are
/// its UTC day — which is divergence D-9's answer for this engine.
fn today(now: &str) -> String {
    now.get(..10).unwrap_or(now).to_owned()
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::FinalizeReconciliation;

    #[test]
    fn an_ending_balance_may_not_arrive_as_a_json_number() {
        // A statement's closing figure is money, and a JSON number is a double
        // by the time any parser has read it.
        let error = serde_json::from_str::<FinalizeReconciliation>(
            r#"{"account_id":"a","ending_balance":142.5}"#,
        )
        .expect_err("money may not be a JSON number");
        assert!(error.to_string().contains("amount_must_be_a_string"), "{error}");
    }

    #[test]
    fn there_is_nowhere_to_name_the_rows() {
        // The working set is a property of the account, not of the caller's
        // list: a payload that could name rows could commit a row that was
        // never marked.
        let error = serde_json::from_str::<FinalizeReconciliation>(
            r#"{"account_id":"a","ending_balance":"0","ids":["x"]}"#,
        )
        .expect_err("a finalize takes no row list");
        assert!(error.to_string().contains("`ids`"), "{error}");
    }
}
