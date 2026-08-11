//! `repair_claimed_transfer` — the whole re-pair, atomically.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260805145035_repair_claimed_transfer.sql:260-450`.
//! Traced by grep: defined once, never redefined.
//!
//! # What it repairs
//!
//! The commonest wrong link in real data (`:12-22`): a counterpart is linked to
//! the wrong row, while the row that genuinely matches it sits stranded a few
//! days away. Putting that right is three changes that must all happen or none:
//!
//! 1. break the wrong pairing — **both** sides, because a half-broken pair IS a
//!    one-sided transfer;
//! 2. file the row that pairing displaces as Account Adjustment (a revaluation:
//!    neither income nor spending), so the correction cannot strand a row in its
//!    turn;
//! 3. link the counterpart to the row that really matches it.
//!
//! The client used to do this in three round trips with a hand-written
//! compensation. *"That is a saga, not a transaction"* (`:24`).
//!
//! # T-14, and why the link step is spelled out rather than delegated
//!
//! `:246-252`: every one of the three rows is written **exactly once**, so each
//! row's audit entry — `before` = what the user was looking at, `after` = the
//! finished state — is the whole story of what this repair did to it. Calling
//! `link_transfer_pair` from inside would record its own entries with `before`
//! set to the intermediate, half-repaired state.
//!
//! The local port keeps that property and it is the reason for a shape that
//! otherwise looks careless: the three UPDATEs are issued from the rows read at
//! the *top* of the function, and nothing is re-read in between. Each row's
//! `before` is therefore what storage held when the user pressed the button, and
//! the ports of the T-1/T-2 checks run against those same reads.
//!
//! # Balance-neutral by construction
//!
//! `:35-37`: no amount, sign or `account_id` is written by any statement here,
//! so no balance arithmetic appears — the same property, and the same reasoning,
//! as `link_transfer_pair`. There is no `accounts` statement in this file.
//!
//! # The refusal ORDER is part of the contract, and it was measured
//!
//! MEASURED against the reference cluster, 2026-08-08
//! (`scratchpad/local-core/probe-transfers3.sh`), adjacent pairs driven by
//! payloads that break both rules:
//!
//! ```text
//!  1  repair_needs_three_distinct_rows
//!  2  transaction_not_found                        (stranded, counterpart, partner — three HINTs)
//!  3  transactions belong to different users
//!  4  transfer_pair_not_linked
//!  5  a split transaction cannot become a transfer — remove the split first
//!  6  transfer_leg_locked_by_split_line
//!  7  archived_row_not_repairable
//!  8  stranded_row_already_linked
//!  9  stranded_row_already_categorised
//! 10  a transfer needs two different accounts
//! 11  transfer sides must have exactly opposite non-zero amounts (% vs %)
//! 12  unknown or transfer category: %
//! ```
//!
//! Three of those are worth naming:
//!
//! * **1 beats 2.** Passing the same missing id twice says "three distinct rows",
//!   not "not found".
//! * **4 beats everything structural.** A stale tab whose pair has already been
//!   re-arranged is told *that*, before it is told the row is split or archived.
//!   T-15 is the first thing checked about the rows themselves, and deliberately.
//! * **11 beats 12.** A caller who sends a category id nobody has *and* a
//!   mismatched pair is told about the amounts. The category check is last.
//!
//! # T-7 is checked here and nowhere else, and this port matches that
//!
//! `:327-331` is the **only** place in the entire schema that tests mutual
//! linkage (DESIGN.md §1.3, T-7: *"Enforced nowhere as a constraint. Only
//! `repair_claimed_transfer` even checks it"*). It is checked both ways round —
//! `counterpart.linked = partner.id AND partner.linked = counterpart.id` — and a
//! failure either way is `transfer_pair_not_linked`.
//!
//! The other verbs in this family do **not** check it, and this port does not
//! add it to them: `link_transfer_pair` will happily link a row whose
//! `linked_transfer_split_id` points at a split line that does not point back
//! (MEASURED), and `clear_transfer_links` will happily leave one side pointing at
//! the other. Those gaps are recorded in those verbs' documentation and answered
//! by `verify_integrity()`, not closed by a port that would then refuse calls the
//! cloud accepts.
//!
//! # "Uncategorised" means what the sweep means by it
//!
//! Refusal 9 does not test `category IS NULL`. It tests *"blank, or naming a
//! category this user does not actually have"* (`:356-367`), so a legacy sentinel
//! like `'transfer-out'` — which resolves to no row — does **not** count as a
//! filing and the repair proceeds. MEASURED
//! (`rct-stranded-sentinel-category`, `rct-stranded-blank-category`): both
//! accepted, both re-paired. Reproducing `IS NULL` here would refuse the exact
//! population the sweep exists to repair.
//!
//! # Which guard this verb holds: none, and measured rather than assumed
//!
//! All three UPDATEs write `type` and `category`, which `trg_protect_split_type`
//! and `trg_protect_split_category` watch — but only `WHEN OLD.is_split = 1`, and
//! refusal 5 has already refused any of the three being split. `is_split` and
//! `amount_minor` are never written. `transaction_splits` is never touched;
//! refusal 6 has already refused a row whose leg lives on a line.

use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::category::{is_fileable_adjustment, transfer_category_for};
use crate::row::{self, TransactionRow, WrittenTransaction};

use super::transfer;

/// The command. The RPC's five arguments as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RepairClaimedTransfer {
    /// `p_stranded_id`. The uncategorised, unlinked row that really matches the
    /// counterpart.
    pub stranded_id: String,
    /// `p_counterpart_id`. The row currently linked to the WRONG partner.
    pub counterpart_id: String,
    /// `p_partner_id`. That wrong partner — the row this repair displaces and
    /// files as an adjustment.
    pub partner_id: String,
    /// `p_adjustment_category_id`. The user's OWN 'Account Adjustment' category,
    /// resolved client-side from their tree: never created, never assumed,
    /// validated here.
    pub adjustment_category_id: String,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back: the three finished rows, so the client updates its
/// state from what the database wrote rather than from what it hoped for.
#[derive(Debug, Serialize)]
pub struct RepairClaimedTransferResult {
    /// The row that was stranded, now half of a transfer. The RPC's `stranded`,
    /// under the `transaction` key every result in this crate carries.
    pub transaction: WrittenTransaction,
    /// The row that was linked to the wrong partner, now pointed at the right
    /// one.
    pub counterpart: WrittenTransaction,
    /// The displaced row, now an unlinked adjustment.
    pub partner: WrittenTransaction,
    /// Dense sequence number of the audit row written for the stranded row.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// The three rows, past every one of the twelve refusals.
struct Rows {
    stranded: TransactionRow,
    counterpart: TransactionRow,
    partner: TransactionRow,
    /// The stranded row's owner, which is what the RPC's `v_owner` is and what
    /// the other two are measured against — not `p_user_id`, which may be
    /// absent.
    owner_id: String,
}

/// Break a wrong pairing, file the row it displaces, and link the right pair —
/// in one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for any of the twelve named refusals or a constraint
/// the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn repair_claimed_transfer(
    connection: &mut Connection,
    command: RepairClaimedTransfer,
) -> CoreResult<RepairClaimedTransferResult> {
    // ── 1. Before the lock and before any read, exactly as the RPC. ─────────
    if command.stranded_id == command.counterpart_id
        || command.stranded_id == command.partner_id
        || command.counterpart_id == command.partner_id
    {
        return Err(CoreError::refuse(
            "repair_needs_three_distinct_rows",
            "repair_needs_three_distinct_rows: the stranded row, its other side, and the row that side is linked to today must be three different transactions",
        ));
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    // The cloud takes `FOR UPDATE` on all three in id order (`:290-296`).
    // SQLite has one writer and `BEGIN IMMEDIATE` has already taken it, so there
    // is no deadlock for a lock order to prevent and nothing to port.

    let Rows {
        stranded,
        counterpart,
        partner,
        owner_id,
    } = open(&write, &command)?;

    // ── 1 + 2. The displaced partner: unlinked and filed, in ONE write. ────
    // The transfer scaffolding goes with the link: type by the money's own
    // direction, no target account, filed under the adjustment. The CASE is in
    // SQL against the stored column, not in Rust against a copy of it — the same
    // discipline B-2 imposes on balances, for the same reason.
    let changed = write.execute(
        "UPDATE transactions
            SET linked_transfer_id = NULL,
                transfer_account_id = NULL,
                category = ?1,
                type = CASE WHEN amount_minor < 0 THEN 'expense' ELSE 'income' END,
                updated_at = ?2
          WHERE id = ?3",
        params![command.adjustment_category_id, now, partner.id],
    )?;
    if changed != 1 {
        return Err(transfer::vanished("the displaced row"));
    }
    let partner_after = row::read_transaction(&write, &partner.id)?;

    // ── 3. The right pair, each side filed under the OTHER account (T-6). ──
    let counterpart_after = repoint(&write, &counterpart, &stranded, &owner_id, &now)?;
    let stranded_after = repoint(&write, &stranded, &counterpart, &owner_id, &now)?;

    // U-1 + T-14: one entry per row, each row written once, in the RPC's order.
    audit_row(&write, &owner_id, &partner, &partner_after, &now)?;
    audit_row(&write, &owner_id, &counterpart, &counterpart_after, &now)?;
    let entry = audit_row(&write, &owner_id, &stranded, &stranded_after, &now)?;

    // The result projection, taken before the commit and beside the audit
    // rather than instead of it: every `json_of` above still serialises the
    // audit projection, and these add the one column an answer needs.
    let stranded_after = row::written(&write, stranded_after)?;
    let counterpart_after = row::written(&write, counterpart_after)?;
    let partner_after = row::written(&write, partner_after)?;

    write.commit()?;

    Ok(RepairClaimedTransferResult {
        transaction: stranded_after,
        counterpart: counterpart_after,
        partner: partner_after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// Refusals 2 to 12, in the order the reference cluster produces them.
///
/// Held apart from the writing half on purpose, exactly as the split writer
/// holds `resolve_line` apart from `store_line`: everything here reads and
/// refuses and touches nothing, so a reader checking the order against the
/// migration only has to read this function.
fn open(write: &rusqlite::Transaction<'_>, command: &RepairClaimedTransfer) -> CoreResult<Rows> {
    // ── 2. Three reads, three HINTs. The code is the same for all three; the
    // hint is the only thing telling the user WHICH row went. ───────────────
    let owner = command.user_id.as_deref();
    let Some(stranded) = row::read_owned_transaction(write, &command.stranded_id, owner)? else {
        return Err(missing("The stranded transaction"));
    };
    let Some(counterpart) = row::read_owned_transaction(write, &command.counterpart_id, owner)?
    else {
        return Err(missing("The counterpart transaction"));
    };
    let Some(partner) = row::read_owned_transaction(write, &command.partner_id, owner)? else {
        return Err(missing("The transaction being displaced"));
    };

    // ── 3. T-4. ─────────────────────────────────────────────────────────────
    let owner_id = stranded.user_id.clone();
    if counterpart.user_id != owner_id || partner.user_id != owner_id {
        return Err(transfer::different_users());
    }

    // ── 4. T-15. Mutual, both ways round — the only place in the schema that
    // checks T-7 at all. ────────────────────────────────────────────────────
    if counterpart.linked_transfer_id.as_deref() != Some(partner.id.as_str())
        || partner.linked_transfer_id.as_deref() != Some(counterpart.id.as_str())
    {
        return Err(CoreError::refuse(
            "transfer_pair_not_linked",
            "transfer_pair_not_linked: those two rows are not linked to each other any more — reload and look again",
        ));
    }

    // ── 5, 6, 7. Structures this repair must not touch. ─────────────────────
    if stranded.is_split || counterpart.is_split || partner.is_split {
        return Err(transfer::split_cannot_become_transfer());
    }
    if stranded.linked_transfer_split_id.is_some()
        || counterpart.linked_transfer_split_id.is_some()
        || partner.linked_transfer_split_id.is_some()
    {
        return Err(CoreError::refuse(
            "transfer_leg_locked_by_split_line",
            "transfer_leg_locked_by_split_line: one of these legs is the opposite side of a split line — edit the split to unpick it first",
        ));
    }
    if stranded.archived || counterpart.archived || partner.archived {
        return Err(transfer::archived(true));
    }

    // ── 8, 9. The stranded row must genuinely be free. ─────────────────────
    if stranded.linked_transfer_id.is_some() {
        return Err(CoreError::refuse(
            "stranded_row_already_linked",
            "stranded_row_already_linked: that row has been linked to something else since this list was built — reload and look again",
        ));
    }
    if is_really_categorised(write, &stranded, &owner_id)? {
        return Err(CoreError::refuse(
            "stranded_row_already_categorised",
            "stranded_row_already_categorised: that row has been filed under a category since this list was built — reload and look again",
        ));
    }

    // ── 10, 11. Copied verbatim from link_transfer_pair, against the pair this
    // repair is about to make. Note the print order: counterpart first. ─────
    if counterpart.account_id == stranded.account_id {
        return Err(transfer::needs_two_accounts());
    }
    if !transfer::are_opposite(counterpart.amount, stranded.amount) {
        return Err(transfer::amounts_not_opposite(
            counterpart.amount,
            stranded.amount,
        ));
    }

    // ── 12. The adjustment category must be the user's own, and fileable. ──
    if !is_fileable_adjustment(write, &command.adjustment_category_id, &owner_id)? {
        return Err(CoreError::Refused(
            Refusal::named(
                "unknown_or_transfer_category",
                &format!(
                    "unknown or transfer category: {}",
                    command.adjustment_category_id
                ),
            )
            .with_hint(
                "The row this repair frees up is filed under your own Account Adjustment category, and that category could not be found.",
            ),
        ));
    }

    Ok(Rows {
        stranded,
        counterpart,
        partner,
        owner_id,
    })
}

fn missing(which: &str) -> CoreError {
    CoreError::Refused(
        Refusal::named("transaction_not_found", "transaction_not_found")
            .with_hint(&format!("{which} no longer exists, or is not yours.")),
    )
}

/// `btrim(COALESCE(category,'')) <> '' AND EXISTS (a category of this user's
/// with that id)`.
///
/// Both halves matter and the second is the interesting one: a row filed under
/// `'transfer-out'` has a non-blank category that resolves to nothing, and the
/// sweep does not consider it categorised. See the module docs.
fn is_really_categorised(
    write: &rusqlite::Transaction<'_>,
    stranded: &TransactionRow,
    owner_id: &str,
) -> CoreResult<bool> {
    let Some(category) = stranded.category.as_deref() else {
        return Ok(false);
    };
    if category.trim().is_empty() {
        return Ok(false);
    }
    let found: Option<i64> = write
        .query_row(
            "SELECT 1 FROM categories WHERE id = ?1 AND user_id = ?2",
            params![category, owner_id],
            |record| record.get(0),
        )
        .optional()?;
    Ok(found.is_some())
}

/// One side of the corrected pair. Identical in shape to `link_transfer_pair`'s
/// write, and deliberately not shared with it: this one must not audit, because
/// T-14 says the audit for this row happens once, later, with the `before` the
/// user saw.
fn repoint(
    write: &rusqlite::Transaction<'_>,
    side: &TransactionRow,
    other: &TransactionRow,
    owner_id: &str,
    now: &str,
) -> CoreResult<TransactionRow> {
    let category = transfer_category_for(write, owner_id, &other.account_id, side.amount)?;
    let changed = write.execute(
        "UPDATE transactions
            SET type = 'transfer',
                category = ?1,
                transfer_account_id = ?2,
                linked_transfer_id = ?3,
                updated_at = ?4
          WHERE id = ?5",
        params![category, other.account_id, other.id, now, side.id],
    )?;
    if changed != 1 {
        return Err(transfer::vanished("one side of the repaired pair"));
    }
    row::read_transaction(write, &side.id)
}

fn audit_row(
    write: &rusqlite::Transaction<'_>,
    owner_id: &str,
    before: &TransactionRow,
    after: &TransactionRow,
    now: &str,
) -> CoreResult<audit::AuditEntry> {
    audit::write(
        write,
        owner_id,
        "transaction",
        &after.id,
        Action::Update,
        Some(&json_of(before)?),
        Some(&json_of(after)?),
        now,
    )
}

/// Anything serialisable, as the audit column's TEXT.
fn json_of<T: Serialize>(value: &T) -> CoreResult<String> {
    serde_json::to_string(value)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::RepairClaimedTransfer;

    #[test]
    fn every_id_is_required_and_the_owner_is_not() {
        let command: RepairClaimedTransfer = serde_json::from_str(
            r#"{"stranded_id":"a","counterpart_id":"b","partner_id":"c","adjustment_category_id":"d"}"#,
        )
        .expect("four ids and no owner is a legitimate call");
        assert!(command.user_id.is_none());

        let error = serde_json::from_str::<RepairClaimedTransfer>(
            r#"{"stranded_id":"a","counterpart_id":"b","partner_id":"c"}"#,
        )
        .expect_err("the adjustment category is not optional");
        assert!(error.to_string().contains("adjustment_category_id"), "{error}");
    }
}
