//! `clear_transfer_links` — the audited un-doing of a link.
//!
//! # Establishing what the unlink path actually IS
//!
//! `TransactionService.clearTransferLinks` used to be a direct table UPDATE, and
//! the client comment at `src/services/api/transactionService.ts:1244-1256`
//! records the change: it now *"goes through the clear\_transfer\_links RPC
//! (migration 20260805145035), not a table UPDATE"*, because *"every financial
//! write in this app writes financial\_audit\_log in the same database
//! transaction, and an unlink is a financial write"*. Verified by grep: the only
//! `.rpc('clear_transfer_links')` call is that one, `dataService.ts:1005`
//! delegates to it, and no `.update({ linked_transfer_id: … })` survives
//! anywhere in `src/` or `api/`. So the unlink path is an RPC, and this is a
//! port of it:
//! `supabase/migrations/20260805145035_repair_claimed_transfer.sql:101-155`,
//! defined once and never redefined.
//!
//! # Why the argument is a LIST
//!
//! `20260805145035:52-63` is unusually explicit, and the reasoning is the whole
//! design of this verb:
//!
//! > `linked_transfer_id` is not an ordinary column. It is one half of a MUTUAL
//! > pointer. A generic per-row partial update that could set it would let a
//! > caller point A at B without B pointing back — the API meant to protect the
//! > invariant would become the easiest way to break it. […] "Unlink this pair"
//! > is two rows that must move together.
//!
//! Hence a list, and hence `update_transaction_atomic` carrying neither this
//! column nor `archived`.
//!
//! # T-12, and the gap this verb leaves open ON PURPOSE
//!
//! It does **not** chase reciprocals. Naming one side of a linked pair unlinks
//! that side and leaves the other pointing at it — a one-sided link, which is
//! precisely what T-7 forbids and precisely what nothing in the cloud enforces.
//! MEASURED (`probe-transfers3.sh`, `ctl-one-side-only`): count 1, one audit
//! row, and the survivor still carrying `linked_transfer_id`.
//!
//! That is not a bug in this port and it is not fixed here. The migration's own
//! reason (`:94-97`): *"the caller names every row it means to unlink (the repair
//! below names both sides of the pair it breaks), and silently editing rows the
//! caller did not name would make the returned count a fiction and the client's
//! local state wrong."* A local port that chased the reciprocal would unlink a
//! row the cloud leaves alone — a divergence in the direction of "more correct",
//! which is still a divergence, and one that would make the two editions
//! disagree about how many rows a call touched.
//!
//! Where the local edition answers this is `verify_integrity()`'s
//! `transfer_link_not_mutual` check (DESIGN.md T-7, class **V**): after the fact,
//! by name, in a report — because that is the only place a rule enforced nowhere
//! in the cloud can be enforced without diverging from it.
//!
//! # The three guarantees, in order, all MEASURED
//!
//! `probe-transfers3.sh`, 2026-08-08:
//!
//! ```text
//! ctl-null              NULL array          -> 0, no writes, no audit
//! ctl-empty             empty array         -> 0, no writes, no audit
//! ctl-unknown-id        an id nobody has    -> transaction_not_found
//! ctl-unknown-with-good one good, one bad   -> transaction_not_found, NOTHING unlinked
//! ctl-not-mine          somebody else's     -> transaction_not_found
//! ctl-duplicate-ids     [X, X]              -> 1  (count(DISTINCT) vs count(*))
//! ctl-one-side-only     one side of a pair  -> 1, the other side still points at it
//! ctl-both-sides        both                -> 2
//! ctl-already-unlinked  an unlinked row     -> 0, no write, no audit noise
//! ctl-split-leg-skipped a split-line leg    -> 0, skipped, not an error
//! ```
//!
//! Two are worth spelling out because a natural implementation gets them wrong:
//!
//! * **All or nothing.** One unknown id refuses the *whole* call, including the
//!   rows that were fine. The migration says why (`:84-86`): *"a caller naming a
//!   row that is not there has a stale picture and should be told, not quietly
//!   given a smaller number."*
//! * **`[X, X]` is one row, not a not-found.** The count is
//!   `count(DISTINCT x)` against `count(*)` of matching rows, so a repeated id
//!   matches one row and the check passes. `count(*)` on the left would refuse a
//!   perfectly good call.
//!
//! # Balance-neutral, and structurally so
//!
//! No amount, sign or account is touched: the only column written is
//! `linked_transfer_id` (plus `updated_at`). `transfer_account_id` is
//! deliberately **left** — MEASURED — so the row stays a transfer that has lost
//! its partner, which is what makes it eligible for re-linking rather than
//! rubbish.
//!
//! # Which guard this verb holds: none, and measured rather than assumed
//!
//! Every split guard is `BEFORE UPDATE OF <column>`: `is_split`, `amount_minor`,
//! `type`, `category`. This verb writes `linked_transfer_id` and `updated_at`,
//! which appear in no trigger's column list, so none of them is even consulted —
//! not even for a split parent that happens to be linked. The leg triggers are on
//! `transaction_splits`, which this verb does not touch.

use std::collections::BTreeSet;

use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::{self, TransactionRow};

use super::transfer;

/// The command. `(p_ids, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClearTransferLinks {
    /// `p_ids`. Every row the caller means to unlink.
    ///
    /// `Option<Vec<…>>` because the RPC distinguishes a NULL array from an empty
    /// one in its first line and then treats them identically. Reproducing the
    /// shape rather than the outcome costs nothing and means a caller that sends
    /// `null` is not a deserialiser error on one engine and a zero on the other.
    #[serde(default)]
    pub ids: Option<Vec<String>>,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The RPC returns a bare integer. `unlinked` is that integer; the rest is what
/// a client needs and an integer cannot say.
#[derive(Debug, Serialize)]
pub struct ClearTransferLinksResult {
    /// The FIRST row named, as stored after the call — under the `transaction`
    /// key every result in this crate carries, so the harness can compare it
    /// field by field against the same projection on the Postgres side.
    ///
    /// `None` only when the caller named nothing at all: any other call has
    /// already refused every id that does not resolve.
    pub transaction: Option<TransactionRow>,
    /// The RPC's return value: how many rows were **actually** unlinked. Rows
    /// already unlinked, and rows whose link lives on a split line, are not
    /// counted, because no write happened.
    pub unlinked: i64,
    /// Those rows, as stored after the write, in the order they were written
    /// (by id, as the cloud's cursor walks them).
    pub transactions: Vec<TransactionRow>,
    /// Dense sequence number of the LAST audit row written, when any was.
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    pub audit_row_hash: Option<String>,
}

/// Clear `linked_transfer_id` on the named rows, and audit every real change —
/// in one SQLite transaction, or none of them.
///
/// # Errors
/// [`CoreError::Refused`] when a named id is not an owned row, or for a
/// constraint the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn clear_transfer_links(
    connection: &mut Connection,
    command: ClearTransferLinks,
) -> CoreResult<ClearTransferLinksResult> {
    let named = command.ids.clone().unwrap_or_default();
    // `p_ids IS NULL OR array_length(p_ids, 1) IS NULL` — the RPC returns 0
    // before opening anything, and so does this.
    if named.is_empty() {
        return Ok(ClearTransferLinksResult {
            transaction: None,
            unlinked: 0,
            transactions: Vec::new(),
            audit_seq: None,
            audit_row_hash: None,
        });
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    // `SELECT count(DISTINCT x) … <> SELECT count(*) …` — one statement per
    // distinct id rather than an `id = ANY(…)`, because an `IN` list assembled
    // from a Vec is SQL by concatenation and DESIGN.md §6.4 says there is none
    // of that here. A BTreeSet gives the DISTINCT *and* the cloud's `ORDER BY
    // id` in one step: for canonical lowercase uuid text, byte order and
    // Postgres's uuid order are the same order.
    let distinct: BTreeSet<&str> = named.iter().map(String::as_str).collect();
    for id in &distinct {
        let found: Option<i64> = write
            .query_row(
                "SELECT 1 FROM transactions
                  WHERE id = ?1
                    AND (?2 IS NULL OR user_id = ?2)",
                params![id, owner],
                |record| record.get(0),
            )
            .optional()?;
        if found.is_none() {
            return Err(CoreError::Refused(
                Refusal::named("transaction_not_found", "transaction_not_found").with_hint(
                    "One of the transactions named for unlinking no longer exists, or is not yours.",
                ),
            ));
        }
    }

    let mut unlinked = Vec::new();
    let mut entry = None;
    for id in &distinct {
        // The cursor's WHERE clause, per row: linked, and not a split-line leg
        // (T-12). A row that fails either is skipped — no write, no audit noise,
        // and not counted.
        let Some(before) = row::read_owned_transaction(&write, id, owner)? else {
            return Err(transfer::vanished("a transaction named for unlinking"));
        };
        if before.linked_transfer_id.is_none() || before.linked_transfer_split_id.is_some() {
            continue;
        }

        let changed = write.execute(
            "UPDATE transactions
                SET linked_transfer_id = NULL,
                    updated_at = ?1
              WHERE id = ?2",
            params![now, before.id],
        )?;
        if changed != 1 {
            return Err(transfer::vanished("a transaction named for unlinking"));
        }
        let after = row::read_transaction(&write, &before.id)?;

        entry = Some(audit::write(
            &write,
            &after.user_id,
            "transaction",
            &after.id,
            Action::Update,
            Some(&json_of(&before)?),
            Some(&json_of(&after)?),
            &now,
        )?);
        unlinked.push(after);
    }

    // The first id the CALLER named, not the first in id order: the client's
    // list is its own, and the Postgres side of the harness projects
    // `p_ids->>0` for the same reason.
    let first = named
        .first()
        .map(|id| row::read_transaction(&write, id))
        .transpose()?;

    let count = i64::try_from(unlinked.len()).map_err(|_| {
        CoreError::refuse(
            "amount_out_of_range",
            "that is more rows than this ledger can count",
        )
    })?;

    write.commit()?;

    Ok(ClearTransferLinksResult {
        transaction: first,
        unlinked: count,
        transactions: unlinked,
        audit_seq: entry.as_ref().map(|entry| entry.seq),
        audit_row_hash: entry.map(|entry| entry.row_hash),
    })
}

/// Anything serialisable, as the audit column's TEXT.
fn json_of<T: Serialize>(value: &T) -> CoreResult<String> {
    serde_json::to_string(value)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::ClearTransferLinks;

    #[test]
    fn a_null_list_and_an_absent_one_are_both_accepted() {
        let null: ClearTransferLinks =
            serde_json::from_str(r#"{"ids": null}"#).expect("a null list is the RPC's own case");
        assert!(null.ids.is_none());
        let absent: ClearTransferLinks = serde_json::from_str("{}").expect("absent");
        assert!(absent.ids.is_none());
    }

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<ClearTransferLinks>(r#"{"id":"x"}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("`id`"), "{error}");
    }
}
