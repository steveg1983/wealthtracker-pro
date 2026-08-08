//! `link_split_line_transfer` — pair an existing split LINE with an existing row.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260806094058_split_transfer_legs.sql:509-623`, the
//! second function in the split-legs migration. Traced by grep: defined once,
//! never redefined. Its sibling in the same file,
//! `set_transaction_splits_with_legs`, is a different verb and already ported.
//!
//! # What it is FOR
//!
//! `:498-503`: a split line carrying a `transfer_account_id` with a NULL
//! `linked_transfer_id` is an **unmatched leg** — the other side is sitting
//! somewhere in that account, already imported by its own bank, waiting to be
//! recognised rather than duplicated. This is the primitive the transfer-matching
//! sweep needs, and it is the split-line counterpart of
//! [`super::link_transfer_pair`]: both sides already exist, so nothing is minted
//! and no balance moves.
//!
//! # T-10 is the rule most likely to be mis-ported, and it lives here
//!
//! The amounts are compared against the **LINE**, never the parent
//! (`:576-582`, DESIGN.md T-10: *"the single most-likely-to-be-mis-ported rule in
//! the whole schema"*). The parent's total includes the other lines and is
//! *supposed* to differ — a −25.00 split of a −15.00 leg and a −10.00 line pairs
//! with a +15.00 row, and comparing against the parent would refuse exactly the
//! shape the feature exists for.
//!
//! # Balance-neutral by construction
//!
//! `:504-507`: no amount, sign or `account_id` is written by any statement here,
//! so no balance arithmetic appears — same property, same reasoning, as
//! `link_transfer_pair`. There is no `accounts` statement in this file. This is
//! the difference between *recognising* a leg's other side and *minting* one:
//! `set_transaction_splits_with_legs` mints, and moves a balance; this recognises,
//! and does not.
//!
//! # The refusal ORDER is part of the contract, and it was measured
//!
//! MEASURED against the reference cluster, 2026-08-08
//! (`scratchpad/local-core/probe-transfers3.sh` and `-4.sh`), adjacent pairs
//! driven by payloads that break both rules:
//!
//! ```text
//!  1  split_line_not_found: that split line no longer exists, or is not yours
//!  2  transaction_not_found                    (the PARENT of that line)
//!  3  transaction_not_found                    (the row being paired)
//!  4  a transaction cannot be linked to itself
//!  5  split_line_already_linked
//!  6  transaction is already part of a linked transfer
//!  7  a split transaction cannot become a transfer — remove the split first
//!  8  archived_row_not_repairable
//!  9  a transfer needs two different accounts
//! 10  split_line_target_mismatch
//! 11  transfer sides must have exactly opposite non-zero amounts (% vs %)
//! ```
//!
//! Two are worth naming:
//!
//! * **4 beats 5.** Pairing a *linked* line with its own parent says "cannot be
//!   linked to itself", not `split_line_already_linked`. MEASURED.
//! * **10 beats 11.** A row in the wrong account *and* of the wrong amount is
//!   told about the account. A port that checked the amount first — the more
//!   "fundamental" rule — would show the other sentence.
//!
//! # What refusal 6 tests that its message does not say
//!
//! `IF v_txn.linked_transfer_id IS NOT NULL OR v_txn.linked_transfer_split_id IS
//! NOT NULL` — **both** columns. A row that is already the other side of some
//! other split's line carries only the second, and without that clause it could
//! be stolen by a second line, leaving the first pointing at a row that points
//! back at somebody else.
//!
//! # Which guard this verb holds: none, and PROVEN so
//!
//! This is the verb of the four where the answer is least obvious, because it
//! writes to `transaction_splits` — the table `trg_protect_linked_leg` guards.
//!
//! * `trg_protect_linked_leg` fires `WHEN OLD.linked_transfer_id IS NOT NULL`.
//!   Refusal 5 has already refused every line for which that is true, so the
//!   trigger's WHEN clause is false on the only line this verb ever updates.
//! * `trg_protect_linked_leg_delete` is a BEFORE DELETE trigger; nothing is
//!   deleted here.
//! * `trg_protect_split_type`/`_category` fire `WHEN OLD.is_split = 1` on
//!   `transactions`; refusal 7 has already refused a split row, and the split
//!   PARENT — which is `is_split = 1` — is never written at all. It is read, and
//!   audited, and that is the whole of its involvement.
//!
//! The last point is the one worth being careful about: the parent appears in an
//! audit entry with `before` and `after` that differ, which looks like a write
//! and is not. The cloud does the same thing (`:613-616`): `to_jsonb(v_parent) ||
//! jsonb_build_object('splits', …)` twice, with the *same* parent row and two
//! different line sets. What changed is a child row, and the parent is where a
//! split's history is recorded (U-4).
//!
//! `tests/transfer_family.rs` proves the guard claim behaviourally rather than by
//! argument: it drives the pairing with the guard table asserted empty and shows
//! the triggers stay silent, and then breaks the verb's own rule to show they
//! would have fired.

use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::category::transfer_category_for;
use crate::row::split::{self, SplitRow};
use crate::row::{self, TransactionRow};

use super::transfer;

/// The command. `(p_split_id, p_transaction_id, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LinkSplitLineTransfer {
    /// `p_split_id`. The unmatched leg.
    pub split_id: String,
    /// `p_transaction_id`. The row in the other account that matches it.
    pub transaction_id: String,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back. The RPC's `{split, transaction}`, plus the parent —
/// which is what a client has to re-render, and what the audit entry is filed
/// against.
#[derive(Debug, Serialize)]
pub struct LinkSplitLineTransferResult {
    /// The row that is now the leg's other side, as stored.
    pub transaction: TransactionRow,
    /// The line, as stored, now naming both the account and the row.
    pub split: SplitRow,
    /// The split parent — unchanged, and returned so the caller can see the line
    /// set it now holds.
    pub parent: TransactionRow,
    /// The whole line set after the write, in display order.
    pub splits: Vec<SplitRow>,
    /// Dense sequence number of the audit row written for the paired row.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Link an existing split line to an existing transaction as the two halves of
/// one transfer, and audit both — in one SQLite transaction, or neither.
///
/// # Errors
/// [`CoreError::Refused`] for any of the eleven named refusals or a constraint
/// the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn link_split_line_transfer(
    connection: &mut Connection,
    command: LinkSplitLineTransfer,
) -> CoreResult<LinkSplitLineTransferResult> {
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    let Sides {
        line,
        parent,
        paired,
    } = open(&write, &command)?;

    // U-4: a split's history is recorded on its PARENT with the whole line set
    // embedded, so the `before` set has to be read before the line is written.
    let original_lines = split::read_lines(&write, &parent.id)?;

    // The line takes the account and the row. Both in one UPDATE, because
    // `transaction_splits_linked_has_target` says a linked line must name an
    // account and two statements would break that between them.
    let changed = write.execute(
        "UPDATE transaction_splits
            SET transfer_account_id = ?1,
                linked_transfer_id = ?2,
                updated_at = ?3
          WHERE id = ?4",
        params![paired.account_id, paired.id, now, line.id],
    )?;
    if changed != 1 {
        return Err(CoreError::refuse(
            "split_line_not_found",
            "a split line disappeared between finding it and writing it",
        ));
    }

    // The row over there files under the To/From category of the account the
    // SPLIT sits in (T-6), and points back at both the parent and the exact line
    // (T-11) — which is what makes the pair navigable from either end.
    let category = transfer_category_for(&write, &parent.user_id, &parent.account_id, paired.amount)?;
    let changed = write.execute(
        "UPDATE transactions
            SET type = 'transfer',
                category = ?1,
                transfer_account_id = ?2,
                linked_transfer_id = ?3,
                linked_transfer_split_id = ?4,
                updated_at = ?5
          WHERE id = ?6",
        params![
            category,
            parent.account_id,
            parent.id,
            line.id,
            now,
            paired.id
        ],
    )?;
    if changed != 1 {
        return Err(transfer::vanished("the row being paired"));
    }

    let paired_after = row::read_transaction(&write, &paired.id)?;
    let updated_lines = split::read_lines(&write, &parent.id)?;
    let line_after = updated_lines
        .iter()
        .find(|stored| stored.id == line.id)
        .cloned()
        .ok_or_else(|| {
            CoreError::refuse(
                "split_line_not_found",
                "a split line disappeared between writing it and reading it back",
            )
        })?;

    audit::write(
        &write,
        &paired_after.user_id,
        "transaction",
        &paired_after.id,
        Action::Update,
        Some(&json_of(&paired)?),
        Some(&json_of(&paired_after)?),
        &now,
    )?;
    // The parent row is byte-identical on both sides; only its line set differs.
    // That is the cloud's own shape (`:613-616`) and it is what makes the entry
    // say "a line of this split became a transfer leg" rather than nothing.
    let entry = audit::write(
        &write,
        &parent.user_id,
        "transaction",
        &parent.id,
        Action::Update,
        Some(&with_lines(&parent, &original_lines)?),
        Some(&with_lines(&parent, &updated_lines)?),
        &now,
    )?;

    write.commit()?;

    Ok(LinkSplitLineTransferResult {
        transaction: paired_after,
        split: line_after,
        parent,
        splits: updated_lines,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The three rows this verb needs, past every one of the eleven refusals.
struct Sides {
    line: SplitRow,
    parent: TransactionRow,
    paired: TransactionRow,
}

/// Refusals 1 to 11, in the order the reference cluster produces them.
///
/// Held apart from the writing half on purpose, exactly as the split writer
/// holds `resolve_line` apart from `store_line`: everything here reads and
/// refuses and touches nothing, so a reader checking the order against the
/// migration only has to read this function.
fn open(
    write: &rusqlite::Transaction<'_>,
    command: &LinkSplitLineTransfer,
) -> CoreResult<Sides> {
    let owner = command.user_id.as_deref();

    // ── 1. The line, scoped by ITS OWN user_id — not the parent's. ──────────
    // `transaction_splits.user_id` is a column of its own, copied from the
    // parent by every writer, and this is the RPC's gate. MEASURED: a line whose
    // parent belongs to somebody else is found here and refused at 2.
    let Some(line) = read_owned_line(write, &command.split_id, owner)? else {
        return Err(CoreError::refuse(
            "split_line_not_found",
            "split_line_not_found: that split line no longer exists, or is not yours",
        ));
    };

    // ── 2, 3. ───────────────────────────────────────────────────────────────
    let Some(parent) = row::read_owned_transaction(write, &line.transaction_id, owner)? else {
        return Err(missing("The split that line belongs to"));
    };
    let Some(paired) = row::read_owned_transaction(write, &command.transaction_id, owner)? else {
        return Err(missing("The transaction being paired with that line"));
    };

    // ── 4-11. ───────────────────────────────────────────────────────────────
    if paired.id == parent.id {
        return Err(transfer::self_link());
    }
    if line.linked_transfer_id.is_some() {
        return Err(CoreError::refuse(
            "split_line_already_linked",
            "split_line_already_linked: that line is already one half of a transfer — reload and look again",
        ));
    }
    // BOTH columns, and the second is the one that matters: a row that is
    // already the other side of some other split's line carries only
    // `linked_transfer_split_id`, and without this clause a second line could
    // steal it.
    if paired.linked_transfer_id.is_some() || paired.linked_transfer_split_id.is_some() {
        return Err(transfer::already_linked());
    }
    if paired.is_split {
        return Err(transfer::split_cannot_become_transfer());
    }
    if paired.archived {
        return Err(transfer::archived(false));
    }
    if paired.account_id == parent.account_id {
        return Err(transfer::needs_two_accounts());
    }
    // A line with no target at all is fine: it takes the row's account below.
    // Only a line that names a DIFFERENT account is a contradiction.
    if line
        .transfer_account_id
        .as_ref()
        .is_some_and(|target| *target != paired.account_id)
    {
        return Err(CoreError::refuse(
            "split_line_target_mismatch",
            "split_line_target_mismatch: that line transfers to a different account from the one that row sits in",
        ));
    }
    // T-10. Against the LINE, never the parent — and the zero test is on the
    // LINE, which is what `are_opposite`'s first argument means. The message
    // prints the row first and the line second, as the RPC does.
    if !transfer::are_opposite(line.amount, paired.amount) {
        return Err(transfer::amounts_not_opposite(paired.amount, line.amount));
    }

    Ok(Sides {
        line,
        parent,
        paired,
    })
}

fn missing(which: &str) -> CoreError {
    CoreError::Refused(
        Refusal::named("transaction_not_found", "transaction_not_found")
            .with_hint(&format!("{which} no longer exists, or is not yours.")),
    )
}

/// One split line, but only if it belongs to this user.
///
/// The line's own `user_id`, not its parent's: that is the column the RPC's
/// `WHERE` names, and the two can differ in restored data.
fn read_owned_line(
    write: &rusqlite::Transaction<'_>,
    id: &str,
    user_id: Option<&str>,
) -> CoreResult<Option<SplitRow>> {
    let owned: Option<String> = write
        .query_row(
            "SELECT transaction_id FROM transaction_splits
              WHERE id = ?1
                AND (?2 IS NULL OR user_id = ?2)",
            params![id, user_id],
            |record| record.get(0),
        )
        .optional()?;
    let Some(parent_id) = owned else {
        return Ok(None);
    };
    Ok(split::read_lines(write, &parent_id)?
        .into_iter()
        .find(|line| line.id == id))
}

/// A transaction row with its line set embedded — the cloud's
/// `to_jsonb(v_parent) || jsonb_build_object('splits', …)`.
fn with_lines(parent: &TransactionRow, lines: &[SplitRow]) -> CoreResult<String> {
    let mut value = serde_json::to_value(parent)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;
    let lines = serde_json::to_value(lines)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))?;
    if let serde_json::Value::Object(object) = &mut value {
        object.insert("splits".to_owned(), lines);
    }
    Ok(value.to_string())
}

/// Anything serialisable, as the audit column's TEXT.
fn json_of<T: Serialize>(value: &T) -> CoreResult<String> {
    serde_json::to_string(value)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::LinkSplitLineTransfer;

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<LinkSplitLineTransfer>(
            r#"{"split_id":"x","transaction_id":"y","splits":[]}"#,
        )
        .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("splits"), "{error}");
    }
}
