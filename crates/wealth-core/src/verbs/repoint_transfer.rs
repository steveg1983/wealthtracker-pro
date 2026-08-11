//! `repoint_transfer` — a linked transfer changes address, and both sides are
//! re-filed from the pairing as it will be.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260810140000_repoint_transfer.sql:150-372`. Defined
//! once, never redefined. It is the newest RPC in the transfer family and the
//! only one that answers the question the editor used to refuse outright:
//!
//! > "This transfer is linked to its opposite transaction. To move it, delete
//! >  the transfer and recreate it."
//!
//! — advice that destroyed imported bank evidence to fix a typo, and that was
//! not even true, because deleting the counterpart did not visibly release the
//! survivor either.
//!
//! # THE CROSSOVER IS THE RULE, and it is derived rather than patched
//!
//! Each row's category names the OTHER side:
//!
//! ```text
//! source.transfer_account_id      = target
//! source.category                 = To/From <target>
//! counterpart.account_id          = target
//! counterpart.transfer_account_id = source.account_id
//! counterpart.category            = To/From <source.account_id>
//! ```
//!
//! BOTH are recomputed from the pairing as it will be, never patched — because
//! the source's own account can move in the same save, and then the
//! counterpart's category is stale too. Deriving both makes that unrepresentable.
//! The same rule is written once in TypeScript (`src/utils/transferRepoint.ts`),
//! once in the RPC, and once here, and all three derive rather than patch.
//!
//! A re-point never touches an amount, a date, a description, a note, a tag, or
//! either reconciliation flag. **It is a change of address, not of fact.**
//!
//! # THE C/R SPLIT, AND WHY THIS VERB DOES NOT TOUCH IT
//!
//! Slice 24 added `transactions.is_reconciled` and the CHECK that goes with it
//! (`transactions_reconciled_implies_cleared`: committed implies marked). A
//! re-point can move, release or delete a row that has been RECONCILED, so the
//! interaction is worth stating rather than discovering:
//!
//! * **Neither flag is ever written.** Not by the move, not by the release, not
//!   by the fresh counterpart's INSERT (which takes `is_cleared = 0` from the
//!   RPC's own column list and `is_reconciled` from the column default). So the
//!   CHECK cannot be reached from either direction: a row that satisfied it
//!   before still satisfies it, because neither side of it changed.
//! * **The archive sweep does not fire.** `trg_sweep_reconciled_into_archive` is
//!   `AFTER UPDATE OF is_reconciled`, so a verb that never names that column in
//!   a SET list cannot wake it. MEASURED — `tests/transfer_family.rs` re-points a
//!   committed pair and asserts both rows are still in the register.
//! * **A RELEASED row keeps its R.** It stays exactly where it is, so what it
//!   was settled against is still true; only what it CLAIMS TO BE changes. It
//!   becomes an uncategorised `expense`/`income` marked `needs_review`, which is
//!   the pair "settled, and asking to be looked at" — odd-looking and correct:
//!   the statement it was ticked against has not been un-issued by somebody
//!   re-pointing a transfer in another account.
//!
//! # THE THREE DISPOSITIONS
//!
//! ```text
//! move     the counterpart changes address. The ordinary case: it is
//!          scaffolding this app inserted ("create the other side"), so nothing
//!          is lost by moving it.
//! release  the counterpart is a REAL transaction that happens to have been
//!          matched to this transfer. It stays where it is and becomes a plain
//!          unlinked, uncategorised row again; a fresh counterpart is created in
//!          the target.
//! delete   as release, but the displaced row is removed and its account's
//!          balance reversed.
//! ```
//!
//! The caller decides, because the caller is the only one that can ask.
//! `src/utils/transferCounterpartOrigin.ts` explains how conservatively the app
//! guesses before it asks, and `src/utils/transferSurvivorRelease.ts` is the
//! app-layer twin of the release itself — the same three columns cleared, the
//! same `needs_review`, for the survivor of a DELETED leg.
//!
//! # BALANCE REASONING, per branch
//!
//! This is the one transfer operation that is not balance-neutral overall, so
//! the statement is made per branch rather than asserted once:
//!
//! * **move** — the counterpart leaves one account and joins another: the same
//!   amount subtracted from its old account and added to the new one. Net zero
//!   across the pair; each account's own B-1 identity is maintained because the
//!   ROW moved with the money. When the target IS already the counterpart's
//!   account (a pure re-file) NO balance statement runs at all.
//! * **release** — the released row does not move and does not change amount, so
//!   its account is untouched. The fresh counterpart adds its amount to the
//!   target, exactly as [`super::create_transfer_counterpart`] does.
//! * **delete** — the removed row's amount is subtracted from its account, the
//!   new row's amount added to the target. Two independent, audited statements.
//!
//! Every movement is `balance_minor = balance_minor ± <delta>` in SQL (B-2), and
//! `changes()` is asserted on each, because Postgres reports a missed
//! `RETURNING … INTO` and SQLite reports it by saying nothing at all.
//!
//! # IT IS SAFE TO CALL WITH AN UNCHANGED TARGET
//!
//! Deliberately not an error. If the counterpart already sits in the target, the
//! function re-files both categories and moves no money — which is what makes it
//! the right call after the SOURCE's own account has been changed, where the
//! counterpart is in the right place but is filed under the To/From category of
//! an account this transfer has nothing to do with any more.
//!
//! # THE REFUSAL ORDER, transcribed from the function body
//!
//! ```text
//! 1  unknown disposition "x" — expected move, release or delete
//! 2  transaction_not_found                    (the source)
//! 3  that transaction is not half of a linked transfer
//! 4  transaction_not_found                    (the counterpart)
//! 5  those two rows are not linked to each other any more — reload and look again
//! 6  a transfer needs two different accounts
//! 7  a split transaction cannot become a transfer — remove the split first
//! 8  the other half of this transfer is one line of a split — edit that split to move it
//! 9  one of these rows is archived — bring it back into the register before moving it
//! 10 a zero-amount transaction cannot be a transfer
//! 11 account_not_found_or_not_owned           (the TARGET account)
//! 12 transfers between accounts in different currencies are not supported yet (% and %)
//! ```
//!
//! Read off the RPC in statement order rather than measured, because every one
//! of these is a straight-line `IF … THEN RAISE` before the first write — there
//! is no branch that could reorder them. The differential specs drive adjacent
//! pairs anyway, which is what turns "read off" into "checked".
//!
//! # WHICH GUARD: `leg`, conditionally, and only on the delete branch
//!
//! R-5, and the same condition [`super::delete_transaction`] uses — reused from
//! there rather than re-derived, exactly as [`crate::verbs`]'s guard table asks.
//! The delete branch removes a transaction, so if a split line anywhere links to
//! it, SQLite applies `ON DELETE SET NULL` as an UPDATE of that line and
//! `trg_protect_linked_leg` raises `split_leg_locked`.
//!
//! The other two branches hold nothing, and each for a checked reason:
//!
//! * the move and release UPDATEs write `type` and `category`, which
//!   `trg_protect_split_type` and `trg_protect_split_category` watch — but only
//!   `WHEN OLD.is_split = 1`, and refusal 7 has already refused every such row.
//!   The refusal ORDER is what makes the guard unnecessary, which is the same
//!   slightly alarming dependency the rest of this family has and is why it is
//!   written down.
//! * the fresh counterpart is an INSERT, and no trigger on `transactions` fires
//!   on an INSERT.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::account::{self, AccountRow};
use crate::row::category::transfer_category_for;
use crate::row::{self, TransactionRow, WrittenTransaction};

use super::transfer;

/// What becomes of the counterpart a re-point displaces.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    /// It changes address with the pairing.
    Move,
    /// It stays where it is and becomes a plain unlinked row.
    Release,
    /// It is removed and its account reversed.
    Delete,
}

impl Default for Disposition {
    /// `p_disposition text DEFAULT 'move'`.
    fn default() -> Self {
        Self::Move
    }
}

/// The command. `(p_id, p_target_account_id, p_disposition, p_user_id)` as one
/// object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RepointTransfer {
    /// `p_id`. One half of an existing linked pair.
    pub id: String,
    /// `p_target_account_id`. Where the other half should be.
    pub target_account_id: String,
    /// `p_disposition`. Defaults to `move`.
    ///
    /// A serde enum rather than a string tested in the body, which changes ONE
    /// refusal's shape: the cloud raises `unknown disposition "x"` with SQLSTATE
    /// 22023 and this refuses at the boundary with `invalid_command` naming the
    /// same key and listing the three it knows. Both refuse, before any read,
    /// with nothing written — and the typed version cannot be forgotten by a
    /// later branch.
    #[serde(default)]
    pub disposition: Disposition,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What became of the displaced counterpart, in the seam's own three shapes.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Displaced {
    /// It changed address; the row itself is the result's `counterpart`.
    Moved {
        /// The account it left.
        from_account_id: String,
    },
    /// It stayed put and stopped being half of a transfer.
    Released {
        /// The row as it now stands — uncategorised, unlinked, for review.
        ///
        /// The RESULT projection, like every other row an answer carries: a
        /// released row is the one a person is most likely to be looking at
        /// next, and `needs_review` is what the register bolds it by.
        transaction: Box<WrittenTransaction>,
    },
    /// It is gone, and its account has been reversed by its amount.
    Deleted {
        /// The row that was removed.
        id: String,
        /// The account that was reversed.
        account_id: String,
        /// By how much.
        amount: Money,
    },
}

/// What the verb hands back — the RPC's `{source, counterpart, displaced}`, with
/// `source` under the `transaction` key every result in this crate carries.
#[derive(Debug, Serialize)]
pub struct RepointTransferResult {
    /// The edited row, re-filed to face its new counterpart.
    pub transaction: WrittenTransaction,
    /// The row now sitting in the target account and linked to the source.
    pub counterpart: WrittenTransaction,
    /// What became of the counterpart this displaced.
    pub displaced: Displaced,
    /// Dense sequence number of the audit row written for the source.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Point an existing linked transfer at a different account, in one transaction.
///
/// # Errors
/// [`CoreError::Refused`] for any of the named refusals in the module docs, or a
/// rule the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value, clippy::too_many_lines)]
pub fn repoint_transfer(
    connection: &mut Connection,
    command: RepointTransfer,
) -> CoreResult<RepointTransferResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    // ── 2. ──────────────────────────────────────────────────────────────────
    let Some(source) = row::read_owned_transaction(&write, &command.id, owner)? else {
        return Err(not_found());
    };

    // ── 3. ──────────────────────────────────────────────────────────────────
    let Some(counterpart_id) = source.linked_transfer_id.clone() else {
        return Err(CoreError::refuse(
            "transfer_not_linked",
            "that transaction is not half of a linked transfer",
        ));
    };

    // ── 4. Read by id AND by the SOURCE's owner, which is the RPC's
    //       `user_id = v_src.user_id` rather than the caller's argument. On a
    //       pair that straddles two owners — which only a restored cloud backup
    //       can produce — this is what refuses rather than repointing half of
    //       somebody else's transfer.
    let Some(displaced) = row::read_owned_transaction(&write, &counterpart_id, Some(&source.user_id))?
    else {
        return Err(not_found());
    };

    // ── 5. Mutual, both ways round, so a stale client list cannot re-point a
    //       pair that has moved on underneath it.
    if displaced.linked_transfer_id.as_deref() != Some(source.id.as_str()) {
        return Err(CoreError::refuse(
            "transfer_pair_stale",
            "those two rows are not linked to each other any more — reload and look again",
        ));
    }

    // ── 6-10. ───────────────────────────────────────────────────────────────
    if source.account_id == command.target_account_id {
        return Err(transfer::needs_two_accounts());
    }
    if source.is_split || displaced.is_split {
        return Err(transfer::split_cannot_become_transfer());
    }
    if source.linked_transfer_split_id.is_some() || displaced.linked_transfer_split_id.is_some() {
        return Err(CoreError::refuse(
            "transfer_leg_lives_on_a_split_line",
            "the other half of this transfer is one line of a split — edit that split to move it",
        ));
    }
    if source.archived || displaced.archived {
        return Err(CoreError::refuse(
            "archived_row_not_repairable",
            "one of these rows is archived — bring it back into the register before moving it",
        ));
    }
    if source.amount == Money::ZERO {
        return Err(CoreError::refuse(
            "zero_amount_cannot_become_transfer",
            "a zero-amount transaction cannot be a transfer",
        ));
    }

    // ── 11. The target, which is also the balance audit's `before`. ─────────
    let Some(target) = account::read_owned(&write, &command.target_account_id, &source.user_id)?
    else {
        return Err(not_owned());
    };

    // ── 12. The same guard create_transfer_counterpart applies, for the same
    //        reason: the two sides are exact negations with no conversion, so a
    //        pair straddling two currencies would be arithmetic nonsense.
    if let Some(from) = account::read_owned(&write, &source.account_id, &source.user_id)? {
        if !from.currency.is_empty()
            && !target.currency.is_empty()
            && from.currency != target.currency
        {
            return Err(CoreError::refuse(
                "transfer_currency_mismatch",
                &format!(
                    "transfers between accounts in different currencies are not supported yet ({} and {})",
                    from.currency, target.currency
                ),
            ));
        }
    }

    let from_account = displaced.account_id.clone();

    let (counterpart, outcome) = match command.disposition {
        Disposition::Move => move_it(&write, &source, &displaced, &target, &now)?,
        Disposition::Release => {
            let released = release_it(&write, &displaced, &now)?;
            let minted = mint(&write, &source, &target, &now)?;
            (
                minted,
                Displaced::Released {
                    transaction: Box::new(row::written(&write, released)?),
                },
            )
        }
        Disposition::Delete => {
            delete_it(&write, &displaced, &now)?;
            let minted = mint(&write, &source, &target, &now)?;
            (
                minted,
                Displaced::Deleted {
                    id: displaced.id.clone(),
                    account_id: from_account.clone(),
                    amount: displaced.amount,
                },
            )
        }
    };

    // ── The edited row, re-filed to face where its other half now is ────────
    let source_after = reface_the_source(&write, &source, &counterpart, &now)?;
    let entry = audit::write(
        &write,
        &source_after.user_id,
        "transaction",
        &source_after.id,
        Action::Update,
        Some(&super::json_of(&source)?),
        Some(&super::json_of(&source_after)?),
        &now,
    )?;

    // The result projection, taken before the commit and beside the audit
    // rather than instead of it: every `json_of` above still serialises the
    // audit projection, and these add the one column an answer needs.
    let source_after = row::written(&write, source_after)?;
    let counterpart = row::written(&write, counterpart)?;

    write.commit()?;

    Ok(RepointTransferResult {
        transaction: source_after,
        counterpart,
        displaced: outcome,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// A figure, negated, with the negation CHECKED.
///
/// `i64::MIN` has no positive counterpart, so a bare `-x` is a panic path in a
/// money statement. It cannot be stored (`transactions_amount_bounded`), and the
/// crate's lints refuse the unchecked spelling anyway — which is the point: this
/// is the third verb in the family to be told so by the compiler rather than by
/// a reviewer.
fn reversed(amount: Money) -> CoreResult<i64> {
    amount.minor().checked_neg().ok_or_else(|| {
        CoreError::refuse("amount_out_of_range", "that amount has no negation in minor units")
    })
}

fn not_found() -> CoreError {
    CoreError::Refused(
        Refusal::named("transaction_not_found", "transaction_not_found")
            .with_hint("The transaction does not exist or does not belong to this user."),
    )
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

/// The counterpart changes address, and the money goes with the row.
///
/// The category is derived from the pairing as it WILL be — the source's
/// account, never the counterpart's own — which is the crossover, and it is
/// computed before the account moves so that "the other side" means the same
/// thing on both lines.
fn move_it(
    write: &rusqlite::Transaction<'_>,
    source: &TransactionRow,
    displaced: &TransactionRow,
    target: &AccountRow,
    now: &str,
) -> CoreResult<(TransactionRow, Displaced)> {
    let category =
        transfer_category_for(write, &source.user_id, &source.account_id, displaced.amount)?;
    let changed = write.execute(
        "UPDATE transactions
            SET account_id          = ?1,
                type                = 'transfer',
                category            = ?2,
                transfer_account_id = ?3,
                updated_at          = ?4
          WHERE id = ?5",
        params![target.id, category, source.account_id, now, displaced.id],
    )?;
    if changed != 1 {
        return Err(transfer::vanished("the counterpart"));
    }
    let moved = row::read_transaction(write, &displaced.id)?;

    // Only when it actually changed address. An unchanged target is a re-file,
    // and a re-file moves no money.
    if displaced.account_id != target.id {
        move_balance(write, &source.user_id, &displaced.account_id, reversed(moved.amount)?, now)?;
        move_balance(write, &source.user_id, &target.id, moved.amount.minor(), now)?;
    }

    audit::write(
        write,
        &moved.user_id,
        "transaction",
        &moved.id,
        Action::Update,
        Some(&super::json_of(displaced)?),
        Some(&super::json_of(&moved)?),
        now,
    )?;

    let outcome = Displaced::Moved { from_account_id: displaced.account_id.clone() };
    Ok((moved, outcome))
}

/// Everything that made it half of a transfer comes off, and nothing else does.
///
/// Same account, same amount, same date, same description. Typed by the money's
/// own direction and left with no category, because the app does not know what
/// this payment was — only that it was not this transfer. `needs_review` says so
/// where it will be seen: in the register of the account it stayed in, which is
/// not the one the user is looking at.
fn release_it(
    write: &rusqlite::Transaction<'_>,
    displaced: &TransactionRow,
    now: &str,
) -> CoreResult<TransactionRow> {
    let changed = write.execute(
        "UPDATE transactions
            SET linked_transfer_id  = NULL,
                transfer_account_id = NULL,
                category            = NULL,
                category_confirmed  = 1,
                needs_review        = 1,
                type                = CASE WHEN amount_minor < 0 THEN 'expense' ELSE 'income' END,
                updated_at          = ?1
          WHERE id = ?2",
        params![now, displaced.id],
    )?;
    if changed != 1 {
        return Err(transfer::vanished("the released row"));
    }
    let released = row::read_transaction(write, &displaced.id)?;

    audit::write(
        write,
        &released.user_id,
        "transaction",
        &released.id,
        Action::Update,
        Some(&super::json_of(displaced)?),
        Some(&super::json_of(&released)?),
        now,
    )?;
    Ok(released)
}

/// The displaced row is removed and its account reversed by exactly its amount.
fn delete_it(
    write: &rusqlite::Transaction<'_>,
    displaced: &TransactionRow,
    now: &str,
) -> CoreResult<()> {
    // R-5, the same condition the delete verb uses. SQLite applies ON DELETE SET
    // NULL as an UPDATE of the child row, and that UPDATE wakes
    // trg_protect_linked_leg — so the remedy the error message itself recommends
    // would be refused without this.
    let guarded = super::delete_transaction::touches_a_transfer_leg(write, &displaced.id)?;
    if guarded {
        write.execute("INSERT OR IGNORE INTO _rpc_guard VALUES ('leg')", [])?;
    }

    let removed = write.execute("DELETE FROM transactions WHERE id = ?1", params![displaced.id])?;

    if guarded {
        write.execute("DELETE FROM _rpc_guard WHERE flag = 'leg'", [])?;
    }
    if removed != 1 {
        return Err(transfer::vanished("the displaced row"));
    }

    move_balance(
        write,
        &displaced.user_id,
        &displaced.account_id,
        reversed(displaced.amount)?,
        now,
    )?;

    audit::write(
        write,
        &displaced.user_id,
        "transaction",
        &displaced.id,
        Action::Delete,
        Some(&super::json_of(displaced)?),
        None,
        now,
    )?;
    Ok(())
}

/// A fresh counterpart in the target, exactly as `create_transfer_counterpart`
/// makes one: the source's amount negated, no conversion, uncleared, and new
/// work in an account the user is not looking at.
fn mint(
    write: &rusqlite::Transaction<'_>,
    source: &TransactionRow,
    target: &AccountRow,
    now: &str,
) -> CoreResult<TransactionRow> {
    let amount = source
        .amount
        .minor()
        .checked_neg()
        .map(Money::from_minor)
        .ok_or_else(|| {
            CoreError::refuse("amount_out_of_range", "that amount has no negation in minor units")
        })?;
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
    let minted = row::read_transaction(write, &id)?;

    move_balance(write, &source.user_id, &target.id, minted.amount.minor(), now)?;

    audit::write(
        write,
        &minted.user_id,
        "transaction",
        &minted.id,
        Action::Create,
        None,
        Some(&super::json_of(&minted)?),
        now,
    )?;
    Ok(minted)
}

/// The edited row: typed, pointed at the row that is now its other half, and
/// filed under the TARGET account's To/From category.
fn reface_the_source(
    write: &rusqlite::Transaction<'_>,
    source: &TransactionRow,
    counterpart: &TransactionRow,
    now: &str,
) -> CoreResult<TransactionRow> {
    let category =
        transfer_category_for(write, &source.user_id, &counterpart.account_id, source.amount)?;
    let changed = write.execute(
        "UPDATE transactions
            SET type                = 'transfer',
                category            = ?1,
                transfer_account_id = ?2,
                linked_transfer_id  = ?3,
                updated_at          = ?4
          WHERE id = ?5",
        params![category, counterpart.account_id, counterpart.id, now, source.id],
    )?;
    if changed != 1 {
        return Err(transfer::vanished("the source row"));
    }
    row::read_transaction(write, &source.id)
}

/// B-2, with the before/after snapshot the RPC audits every movement with.
///
/// One function for four movements because all four are the same statement with
/// a different delta, and a balance written any other way is a balance somebody
/// computed outside SQL.
fn move_balance(
    write: &rusqlite::Transaction<'_>,
    owner: &str,
    account_id: &str,
    delta: i64,
    now: &str,
) -> CoreResult<()> {
    let Some(before) = account::read_owned(write, account_id, owner)? else {
        return Err(not_owned());
    };
    let moved = write.execute(
        "UPDATE accounts
            SET balance_minor = balance_minor + ?1,
                updated_at    = ?2
          WHERE id = ?3
            AND user_id = ?4",
        params![delta, now, account_id, owner],
    )?;
    if moved != 1 {
        // Unreachable: the same predicate found the row one statement ago,
        // inside this transaction. Asserted because a balance that silently did
        // not move is a permanent B-1 violation, and SQLite reports it by saying
        // nothing at all.
        return Err(not_owned());
    }
    let after = account::read_owned(write, account_id, owner)?.ok_or_else(not_owned)?;
    audit::write(
        write,
        owner,
        "account",
        account_id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        now,
    )?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{Disposition, RepointTransfer};

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<RepointTransfer>(
            r#"{"id":"x","target_account_id":"y","dispositon":"move"}"#,
        )
        .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("dispositon"), "{error}");
    }

    #[test]
    fn the_disposition_defaults_to_move_and_names_the_three_it_knows() {
        let command =
            serde_json::from_str::<RepointTransfer>(r#"{"id":"x","target_account_id":"y"}"#)
                .expect("disposition is optional");
        assert_eq!(command.disposition, Disposition::Move);

        let error = serde_json::from_str::<RepointTransfer>(
            r#"{"id":"x","target_account_id":"y","disposition":"shred"}"#,
        )
        .expect_err("an unknown disposition must refuse");
        let message = error.to_string();
        for known in ["move", "release", "delete"] {
            assert!(message.contains(known), "the refusal must name {known}: {message}");
        }
    }
}
