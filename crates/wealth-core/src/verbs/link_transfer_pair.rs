//! `link_transfer_pair` — join two rows that already exist into one transfer.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260716100000_transfer_linking.sql:65-147`. Traced by
//! grep across every migration: this function is defined **once** and has never
//! been redefined. `20260721090000` redefines its sibling
//! `create_transfer_counterpart` (to add the currency guard) and leaves this one
//! alone; `20260725120000` restates grants; `20260805145035` and
//! `20260806094058` *copy* its guards into new functions without touching it.
//!
//! # The Money model, and why there are two verbs and not one
//!
//! `20260716100000:11-16` states the split:
//!
//! * **both sides already exist** — typical when both accounts import from banks
//!   — so *join* them, which is what this verb does;
//! * **only one side exists** — old or incomplete data — so *make* the other,
//!   which is [`super::create_transfer_counterpart`].
//!
//! The consequence for this verb is the property its migration calls out and
//! this port asserts everywhere: **balance-neutral by construction.** No amount,
//! sign or `account_id` is written by any statement here, so no balance
//! arithmetic appears. B-2's rule ("balance moves only as `balance = balance ±
//! delta`, in SQL, inside a verb that also writes the row that justifies the
//! delta") is satisfied vacuously — there is no delta, because there is no new
//! money. A port that "helpfully" re-derived the balances would be wrong, and
//! `verb-specs/t1-*` asserts B-1 on both accounts to prove this one does not.
//!
//! # The refusal ORDER is part of the contract, and it was measured
//!
//! MEASURED against the reference cluster, 2026-08-08
//! (`scratchpad/local-core/probe-transfers.sh`), every adjacent pair driven by a
//! payload that breaks **both** rules, and the winner recorded:
//!
//! ```text
//! 1  a transaction cannot be linked to itself
//! 2  transaction_not_found                      (a, then b)
//! 3  transactions belong to different users
//! 4  a transfer needs two different accounts
//! 5  transfer sides must have exactly opposite non-zero amounts (% vs %)
//! 6  a split transaction cannot become a transfer — remove the split first
//! 7  transaction is already part of a linked transfer
//! ```
//!
//! Two of those are worth naming because reading the *source* rather than
//! *running* it gets them wrong in the plausible direction:
//!
//! * **1 beats 2.** `link_transfer_pair(X, X)` where X does not exist says
//!   "cannot be linked to itself", not "not found". The self-check is the first
//!   statement in the body, before the lock and before either SELECT.
//! * **5 beats 6.** A split parent whose amount does not match is told about the
//!   *amounts*, not about being split. A port that grouped "structural" checks
//!   (split, linked) before "value" checks (accounts, amounts) — which is how a
//!   human would naturally organise them — would produce the other sentence.
//!
//! # Seven refusals, and the four the cloud does NOT make
//!
//! The absences are as much a part of the port as the presences, because each
//! one is a thing a careful implementer would add and thereby diverge. All four
//! MEASURED as **accepted** by the live RPC:
//!
//! | not refused | what actually happens |
//! | --- | --- |
//! | an **archived** row | linked, and stays archived — unlike `repair_claimed_transfer` and `link_split_line_transfer`, which both refuse `archived_row_not_repairable` |
//! | two accounts in **different currencies** | linked. T-9 guards *minting* a counterpart (`create_transfer_counterpart`), where an amount is copied into another ledger; joining two rows that already exist moves nothing, so there is nothing to convert |
//! | a row whose `linked_transfer_split_id` points at a split line | linked, and T-11 quietly broken — the line does not point back |
//! | a row already **typed** `transfer` with some other `transfer_account_id` | overwritten |
//!
//! The third is a real gap and it is recorded rather than fixed here: T-7 and
//! T-11 are enforced *nowhere* in the cloud (DESIGN.md §1.3), and a local port
//! that closed a hole the cloud leaves open would refuse a call the cloud
//! accepts. `verify_integrity()`'s `transfer_link_not_mutual` and
//! `split_leg_link_not_mutual` checks are where the local edition answers this,
//! after the fact, by design.
//!
//! # Which guard this verb holds: none, and measured rather than assumed
//!
//! The splits verb's lesson (`verbs/mod.rs`) is that guard choice must be
//! measured per verb. Measured here:
//!
//! * `trg_protect_split_type` and `trg_protect_split_category` fire only when
//!   `OLD.is_split = 1`, and refusal 6 has already refused every such row before
//!   the first UPDATE. So neither can fire.
//! * `trg_protect_split_is_split` watches a column this verb never writes.
//! * `trg_protect_linked_leg*` are triggers on `transaction_splits`, which this
//!   verb does not touch at all.
//!
//! So no guard, and `tests/transfer_family.rs` proves it behaviourally rather
//! than by argument — it drives the happy path with the guard table asserted
//! empty throughout.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::category::transfer_category_for;
use crate::row::{self, TransactionRow, WrittenTransaction};

use super::transfer;

/// The command. The RPC's three arguments as one object, for the reason the
/// update verb gives: the differential harness sends **one** payload to both
/// engines and the Postgres driver unpacks it into the positional call.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LinkTransferPair {
    /// `p_id_a`. One side.
    pub id_a: String,
    /// `p_id_b`. The other.
    pub id_b: String,
    /// `p_user_id`. Absent means "name no owner" — defence in depth on top of
    /// RLS in the cloud, and the whole gate locally.
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The RPC returns `{a, b}`. Here side A is called `transaction` because every
/// verb result in this crate carries a `transaction` key the harness compares
/// field by field ([`crate::command`]), and side B keeps a name that says
/// what it is rather than which argument it was.
#[derive(Debug, Serialize)]
pub struct LinkTransferPairResult {
    /// Side A, as stored after the write. The RPC's `a`.
    pub transaction: WrittenTransaction,
    /// Side B, as stored after the write. The RPC's `b`.
    pub other_side: WrittenTransaction,
    /// Dense sequence number of the audit row written for side A.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Join two existing rows into a linked transfer pair, and audit both — in one
/// SQLite transaction, or neither.
///
/// # Errors
/// [`CoreError::Refused`] for any of the seven named refusals or a constraint
/// the file enforced; [`CoreError::Storage`] for a fault.
// Consumed rather than borrowed, for the reason the other verbs give: this
// writes two rows and two audit entries, and `&command` is an invitation to do
// all of it twice.
#[allow(clippy::needless_pass_by_value)]
pub fn link_transfer_pair(
    connection: &mut Connection,
    command: LinkTransferPair,
) -> CoreResult<LinkTransferPairResult> {
    // ── 1. Before the lock and before either read, exactly as the RPC. ───────
    if command.id_a == command.id_b {
        return Err(transfer::self_link());
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    // The cloud takes `FOR UPDATE` on both rows in id order so concurrent links
    // cannot deadlock (`:84-89`). SQLite has ONE writer and `BEGIN IMMEDIATE`
    // has already taken it, so the deadlock the lock order prevents cannot
    // occur; there is nothing to port. Recorded rather than silently dropped.

    // ── 2. Both sides, in the caller's order. ───────────────────────────────
    let owner = command.user_id.as_deref();
    let Some(side_a) = row::read_owned_transaction(&write, &command.id_a, owner)? else {
        return Err(not_found());
    };
    let Some(side_b) = row::read_owned_transaction(&write, &command.id_b, owner)? else {
        return Err(not_found());
    };

    // ── 3-7. Every rule, in the order the reference cluster produces them. ──
    if side_a.user_id != side_b.user_id {
        return Err(transfer::different_users());
    }
    if side_a.account_id == side_b.account_id {
        return Err(transfer::needs_two_accounts());
    }
    if !transfer::are_opposite(side_a.amount, side_b.amount) {
        return Err(transfer::amounts_not_opposite(side_a.amount, side_b.amount));
    }
    if side_a.is_split || side_b.is_split {
        return Err(transfer::split_cannot_become_transfer());
    }
    if side_a.linked_transfer_id.is_some() || side_b.linked_transfer_id.is_some() {
        return Err(transfer::already_linked());
    }

    // ── T-6. Each side files under the OTHER account's To/From category. ────
    // The commonest way to get this wrong is to file each side under its own,
    // which reads correctly in a register ("To/From Everyday" on the Everyday
    // row) and is backwards.
    let after_a = write_side(&write, &side_a, &side_b, &now)?;
    let after_b = write_side(&write, &side_b, &side_a, &now)?;

    // U-1: both entries in the same transaction as the writes they record, in
    // the RPC's order (`:140-143`), which is the order the local hash chain
    // then fixes for good.
    let entry = audit_side(&write, &side_a, &after_a, &now)?;
    audit_side(&write, &side_b, &after_b, &now)?;

    // The result projection, taken before the commit and beside the audit
    // rather than instead of it: every `json_of` above still serialises the
    // audit projection, and these add the one column an answer needs.
    let after_a = row::written(&write, after_a)?;
    let after_b = row::written(&write, after_b)?;

    write.commit()?;

    Ok(LinkTransferPairResult {
        transaction: after_a,
        other_side: after_b,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// Deliberately the same refusal for "no such row" and "somebody else's row":
/// telling them apart confirms an id exists to a caller who may not see it.
fn not_found() -> CoreError {
    CoreError::Refused(
        Refusal::named("transaction_not_found", "transaction_not_found")
            .with_hint("The transaction does not exist or does not belong to this user."),
    )
}

/// One side of the pair: typed, filed under the *other* account, pointed at the
/// *other* row.
///
/// Five columns and not one of them is money. That is the balance-neutrality
/// property, expressed as a SET list rather than as a comment: there is no
/// `amount_minor` here and no `accounts` statement anywhere in this file, so the
/// verb cannot move a balance even by accident.
fn write_side(
    write: &rusqlite::Transaction<'_>,
    side: &TransactionRow,
    other: &TransactionRow,
    now: &str,
) -> CoreResult<TransactionRow> {
    let category = transfer_category_for(write, &side.user_id, &other.account_id, side.amount)?;
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
        return Err(transfer::vanished("one side of the pair"));
    }
    row::read_transaction(write, &side.id)
}

fn audit_side(
    write: &rusqlite::Transaction<'_>,
    before: &TransactionRow,
    after: &TransactionRow,
    now: &str,
) -> CoreResult<audit::AuditEntry> {
    audit::write(
        write,
        &after.user_id,
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
    use super::LinkTransferPair;

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<LinkTransferPair>(r#"{"id_a":"x","id_b":"y","usr_id":"z"}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("usr_id"), "{error}");
    }

    #[test]
    fn an_owner_is_optional_because_the_rpc_defaults_it_to_null() {
        let command: LinkTransferPair =
            serde_json::from_str(r#"{"id_a":"x","id_b":"y"}"#).expect("no owner is legitimate");
        assert!(command.user_id.is_none());
    }
}
