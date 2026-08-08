//! `create_transfer_counterpart` — Money-style "make the other side".
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260721090000_transfer_counterpart_currency_guard.sql:17-112`
//! — not the original at `20260716100000:151-232`. Traced by grep across every
//! migration:
//!
//! | migration | change |
//! | --- | --- |
//! | `20260716100000:151` | the original |
//! | `20260721090000:17` | **redefines it** to add the cross-currency guard (T-9) |
//! | `20260725120000` | restates grants only |
//!
//! Porting the older body would drop T-9 and let a USD amount move a GBP ledger
//! by its raw magnitude — the exact bug `20260721090000`'s header describes.
//!
//! # The one verb in this family that moves money
//!
//! Its three siblings are balance-neutral by construction. This one mints a row
//! in another account's register, so B-2 applies in full and the movement is
//! `balance = balance + <the new row's amount>` in SQL. One account moves; the
//! source account does not, because the source row's amount is unchanged. Net
//! worth is the same afterwards, which is what makes it a transfer rather than
//! income appearing from nowhere.
//!
//! # The refusal ORDER is part of the contract, and it was measured
//!
//! MEASURED against the reference cluster, 2026-08-08
//! (`scratchpad/local-core/probe-transfers2.sh`), adjacent pairs driven by
//! payloads that break both rules:
//!
//! ```text
//! 1  transaction_not_found
//! 2  a zero-amount transaction cannot become a transfer
//! 3  a split transaction cannot become a transfer — remove the split first
//! 4  transaction is already part of a linked transfer
//! 5  a transfer needs two different accounts
//! 6  account_not_found_or_not_owned                     (the TARGET account)
//! 7  Transfers between accounts in different currencies are not supported yet (% and %)
//! ```
//!
//! The surprising one is **2 beats 3**: a zero-amount *split parent* is told it
//! is zero, not that it is split. (A split of +10 and −10 sums to zero, so this
//! is a shape real data can take.)
//!
//! # What the minted row carries, MEASURED rather than assumed
//!
//! `probe-transfers4.sh`'s `ctc-detail` case, against a source row with every
//! interesting column filled in:
//!
//! | column | counterpart gets |
//! | --- | --- |
//! | `description`, `date`, `notes` | the source's |
//! | `amount` | **minus** the source's |
//! | `type` | `transfer` |
//! | `category` | the *source account's* To/From category (T-6) |
//! | `transfer_account_id` | the source's account |
//! | `linked_transfer_id` | the source row |
//! | `is_cleared` | `false` — **not** copied. A statement you have reconciled says nothing about one in another bank |
//! | `category_confirmed` | `true`, by column default, even when the source's is false |
//! | `statement_sequence`, `metadata`, `is_recurring`, `import_source` | column defaults; the source's are **not** copied |
//!
//! The last two rows are the interesting ones and they are not decisions this
//! port made: they are what the INSERT's column list leaves out, and every
//! omitted column takes the table's default. A port that "completed" the copy
//! would file a minted row as an import of a file it did not come from.
//!
//! # T-9's guard has a hole, and it is reproduced rather than closed
//!
//! ```sql
//! SELECT * INTO v_src_acct FROM public.accounts
//!  WHERE id = v_src.account_id AND user_id = v_src.user_id;
//! IF FOUND AND v_src_acct.currency IS NOT NULL AND … THEN
//! ```
//!
//! `IF FOUND` means: when the source row's account is **not** this user's, the
//! currency check is skipped entirely and the counterpart is minted anyway.
//! MEASURED (`probe-transfers2.sh`, `ctc-source-account-foreign`): a row owned by
//! this user but filed against another user's GBP account minted a counterpart
//! into a USD account, moved the USD ledger by the GBP magnitude, and refused
//! nothing. The same `IF FOUND` shape is in the split writer, where the splits
//! probes found it first.
//!
//! It is ported exactly, hole included, for the reason every declared divergence
//! in this crate is *not* taken: the local edition is a port, and a port that
//! refuses what the cloud accepts is a bug in the port. Whether the hole is
//! reachable in production is a question about RLS rather than about this file,
//! and it is answered in the batch report — read, not executed.
//!
//! # Which guard this verb holds: none, and measured rather than assumed
//!
//! * The INSERT is an INSERT: none of the `BEFORE UPDATE OF …` split guards can
//!   fire on it, and there is no BEFORE INSERT trigger on `transactions`.
//! * The UPDATE of the source writes `type` and `category`, both watched by
//!   `trg_protect_split_*` — but only `WHEN OLD.is_split = 1`, and refusal 3 has
//!   already refused every such row.
//! * `transaction_splits` is not touched, so the leg triggers are not in play.
//!
//! `tests/transfer_family.rs` drives the mint with the guard table asserted
//! empty and shows the triggers stay silent.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, AccountRow};
use crate::row::category::transfer_category_for;
use crate::row::{self, TransactionRow};

use super::transfer;

/// The command. `(p_id, p_target_account_id, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateTransferCounterpart {
    /// `p_id`. The row that already exists.
    pub id: String,
    /// `p_target_account_id`. The account the other side belongs in.
    pub target_account_id: String,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back. The RPC's `{source, counterpart}`, with `source`
/// under the `transaction` key every result in this crate carries.
#[derive(Debug, Serialize)]
pub struct CreateTransferCounterpartResult {
    /// The row the caller named, as stored after it became half a transfer.
    pub transaction: TransactionRow,
    /// The row that was minted on the other side.
    pub counterpart: TransactionRow,
    /// Dense sequence number of the audit row written for the source.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Make the other side of a transfer, move the account it lands in, and audit
/// all three — in one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for any of the seven named refusals or a constraint
/// the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn create_transfer_counterpart(
    connection: &mut Connection,
    command: CreateTransferCounterpart,
) -> CoreResult<CreateTransferCounterpartResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    // ── 1. ──────────────────────────────────────────────────────────────────
    let owner = command.user_id.as_deref();
    let Some(source) = row::read_owned_transaction(&write, &command.id, owner)? else {
        return Err(CoreError::Refused(
            Refusal::named("transaction_not_found", "transaction_not_found")
                .with_hint("The transaction does not exist or does not belong to this user."),
        ));
    };

    // ── 2-5. ────────────────────────────────────────────────────────────────
    if source.amount == Money::ZERO {
        return Err(CoreError::refuse(
            "zero_amount_cannot_become_transfer",
            "a zero-amount transaction cannot become a transfer",
        ));
    }
    if source.is_split {
        return Err(transfer::split_cannot_become_transfer());
    }
    if source.linked_transfer_id.is_some() {
        return Err(transfer::already_linked());
    }
    if source.account_id == command.target_account_id {
        return Err(transfer::needs_two_accounts());
    }

    // ── 6. The target account, which is also the balance's `before`. ────────
    // Read once, here, and NOT re-read before the move: the cloud's
    // `v_acct_before` is this row, taken at the ownership gate and used as the
    // audit's `before` afterwards. The `after` is read back from storage.
    let Some(target) = account::read_owned(&write, &command.target_account_id, &source.user_id)?
    else {
        return Err(not_owned());
    };

    // ── 7. T-9. ─────────────────────────────────────────────────────────────
    refuse_a_currency_crossing(&write, &source, &target)?;

    // The counterpart is −amount with no conversion, which is exactly why 7
    // exists. `checked_neg` because a money path with an unchecked negation in
    // it is a money path with a panic in it.
    let amount = source
        .amount
        .minor()
        .checked_neg()
        .map(Money::from_minor)
        .ok_or_else(|| {
            CoreError::refuse(
                "amount_out_of_range",
                "that amount has no negation in minor units",
            )
        })?;

    let counterpart = mint(&write, &source, &target, amount, &now)?;
    let source_after = point_the_source_at_it(&write, &source, &counterpart, &now)?;
    let target_after = move_the_balance(&write, &source, &target, amount, &now)?;

    // U-1, in the RPC's order (`:102-108`): the new row, the row that changed,
    // then the account whose balance moved.
    audit::write(
        &write,
        &counterpart.user_id,
        "transaction",
        &counterpart.id,
        Action::Create,
        None,
        Some(&json_of(&counterpart)?),
        &now,
    )?;
    let entry = audit::write(
        &write,
        &source_after.user_id,
        "transaction",
        &source_after.id,
        Action::Update,
        Some(&json_of(&source)?),
        Some(&json_of(&source_after)?),
        &now,
    )?;
    audit::write(
        &write,
        &source.user_id,
        "account",
        &target.id,
        Action::Update,
        Some(&json_of(&target)?),
        Some(&json_of(&target_after)?),
        &now,
    )?;

    write.commit()?;

    Ok(CreateTransferCounterpartResult {
        transaction: source_after,
        counterpart,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

fn not_owned() -> CoreError {
    CoreError::Refused(
        Refusal::named(
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
            Refusal::ACCOUNT_NOT_FOUND_OR_NOT_OWNED,
        )
        .with_hint("The account does not exist or does not belong to this user."),
    )
}

/// T-9, with the cloud's `IF FOUND` hole intact — see the module docs.
///
/// Locally `accounts.currency` is `NOT NULL DEFAULT 'GBP'`, so the cloud's "a
/// NULL currency is unspecified and never blocks" branch is unreachable here.
/// The empty-string test keeps the shape rather than the accident, exactly as
/// the split writer's copy of this guard does.
fn refuse_a_currency_crossing(
    write: &rusqlite::Transaction<'_>,
    source: &TransactionRow,
    target: &AccountRow,
) -> CoreResult<()> {
    let Some(from) = account::read_owned(write, &source.account_id, &source.user_id)? else {
        return Ok(());
    };
    if !from.currency.is_empty()
        && !target.currency.is_empty()
        && from.currency != target.currency
    {
        return Err(CoreError::refuse(
            "transfer_currency_mismatch",
            &format!(
                "Transfers between accounts in different currencies are not supported yet ({} and {})",
                from.currency, target.currency
            ),
        ));
    }
    Ok(())
}

/// The other side: a real row in the target account's register.
///
/// The column list is the RPC's, in the RPC's order, and every column it does
/// NOT name is a column that takes the table's default. See the module docs for
/// what that means for `is_cleared` and `category_confirmed`.
fn mint(
    write: &rusqlite::Transaction<'_>,
    source: &TransactionRow,
    target: &AccountRow,
    amount: Money,
    now: &str,
) -> CoreResult<TransactionRow> {
    // T-6. The counterpart sits in the target account, so it files under the
    // SOURCE account's To/From category — the other side's, never its own.
    let category = transfer_category_for(write, &source.user_id, &source.account_id, amount)?;

    let id = uuid::Uuid::new_v4().to_string();
    write.execute(
        "INSERT INTO transactions
           (id, user_id, account_id, description, amount_minor, type, date, category,
            notes, transfer_account_id, linked_transfer_id, is_cleared, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'transfer', ?6, ?7, ?8, ?9, ?10, 0, ?11, ?11)",
        params![
            id,
            source.user_id,
            target.id,
            source.description,
            amount.minor(),
            source.date,
            category,
            source.notes,
            source.account_id,
            source.id,
            now
        ],
    )?;
    row::read_transaction(write, &id)
}

/// The source row becomes the other half: typed, filed under the TARGET
/// account's To/From category, and pointed at the row just minted.
fn point_the_source_at_it(
    write: &rusqlite::Transaction<'_>,
    source: &TransactionRow,
    counterpart: &TransactionRow,
    now: &str,
) -> CoreResult<TransactionRow> {
    let category = transfer_category_for(
        write,
        &source.user_id,
        &counterpart.account_id,
        source.amount,
    )?;
    let changed = write.execute(
        "UPDATE transactions
            SET type = 'transfer',
                category = ?1,
                transfer_account_id = ?2,
                linked_transfer_id = ?3,
                updated_at = ?4
          WHERE id = ?5",
        params![
            category,
            counterpart.account_id,
            counterpart.id,
            now,
            source.id
        ],
    )?;
    if changed != 1 {
        return Err(transfer::vanished("the source row"));
    }
    row::read_transaction(write, &source.id)
}

/// B-2. The new row moves the target account's ledger balance, relatively, in
/// SQL — and `changes()` is read, because Postgres's `RETURNING … INTO` reports
/// a miss and SQLite's silence does not.
fn move_the_balance(
    write: &rusqlite::Transaction<'_>,
    source: &TransactionRow,
    target: &AccountRow,
    amount: Money,
    now: &str,
) -> CoreResult<AccountRow> {
    let moved = write.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor + ?1,
                updated_at = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![amount.minor(), now, target.id, source.user_id],
    )?;
    if moved != 1 {
        // Unreachable: the same predicate found the row three statements ago,
        // inside this transaction. Asserted because a balance that silently did
        // not move is a permanent B-1 violation, and SQLite reports it by
        // saying nothing at all.
        return Err(not_owned());
    }
    account::read_owned(write, &target.id, &source.user_id)?.ok_or_else(not_owned)
}

/// Anything serialisable, as the audit column's TEXT.
fn json_of<T: Serialize>(value: &T) -> CoreResult<String> {
    serde_json::to_string(value)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::CreateTransferCounterpart;

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<CreateTransferCounterpart>(
            r#"{"id":"x","target_account":"y"}"#,
        )
        .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("target_account"), "{error}");
    }
}
