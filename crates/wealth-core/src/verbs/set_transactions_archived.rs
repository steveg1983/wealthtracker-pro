//! `set_transactions_archived` — the per-row archive, which is never a delete.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260805145035_repair_claimed_transfer.sql:172-229`,
//! the live definition. The client calls it at one place
//! (`transactionService.setTransactionArchived`), which passes ONE id in the
//! array — the seam's `setTransactionArchived(id, archived)` — and the two
//! callers behind that are the register's own hide, and the transfer sweep's
//! "file this away" (`strandedTransferActions.ts`).
//!
//! The verb keeps the RPC's plural name and its array argument. A verb string
//! that differs from the function it ports is a verb string somebody will
//! eventually map to the wrong function, and the seam's singular is a narrowing
//! the PORT applies, not a different operation.
//!
//! # ARCHIVING IS A VIEW FLAG. IT IS NOT A DELETE AND IT IS NOT MONEY
//!
//! The row stays in the table, stays counted in the account's balance, stays in
//! every report and every export, and is hidden only from the live register.
//! That is why this verb is balance-neutral by construction: one boolean and a
//! timestamp, no amount, no account, no sign.
//!
//! The Microsoft Money lesson the soft archive was built from
//! (`20260721130000:5-8`): Money HARD-DELETED archived rows and adjusted each
//! account's opening balance to compensate — *"a fragile, unrecoverable
//! operation people were warned off"*. We do neither.
//!
//! # THE ONE REFUSAL, AND THE CASE IT KEEPS APART FROM ITSELF
//!
//! `count(DISTINCT p_ids)` against the number of rows found and owned; a
//! mismatch raises `transaction_not_found`. So an id nobody has, and an id
//! belonging to somebody else, are both refused — and the whole call is lost,
//! not just that id.
//!
//! That is the OPPOSITE of the bulk-verb shape
//! [`super::apply_category_to_uncategorized`] and
//! [`super::set_transactions_cleared`] have, where a foreign row is skipped in
//! silence, and the RPC's own comment says why the pair of behaviours is right:
//! *"an 'archive this' that runs twice is a no-op, not an error, and the raise
//! above is what still distinguishes 'the row was already archived' from 'the
//! row is not there'."* A tick is a bulk gesture over a list a screen built; an
//! archive is a decision about a named row, and silently archiving four of five
//! would leave the fifth on screen with no explanation.
//!
//! `p_archived IS NULL` raises too, with the RPC's own wording. It is the only
//! verb in this family whose boolean argument is guarded rather than simply
//! required by the signature, and the port keeps that difference: on both
//! engines the message is *"p_archived must be true or false"*.
//!
//! # ORDER BY id, and it is not decoration
//!
//! The RPC's cursor carries `ORDER BY id` with the comment *"concurrent calls
//! walk the rows the same way"*. A local file has one writer at a time, so the
//! deadlock argument does not apply — but the ORDER is also the order the audit
//! entries are written in, and two engines that audited the same batch in
//! different orders would produce different chains for the same call.
//! [`super::distinct_ids`] gives the same walk from a `BTreeSet`.
//!
//! # Which guard it holds: none, and measured
//!
//! `archived` and `updated_at`. No split protection watches either
//! (`BEFORE UPDATE OF` over `is_split`, `amount_minor`, `type`, `category`), and
//! the reconcile sweep is `AFTER UPDATE OF is_reconciled`, which this verb does
//! not write — so archiving a row cannot archive it twice or un-archive it by
//! accident. `tests/reconciliation_family.rs` asserts the guard table empty.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::{self, WrittenTransaction};
use crate::wire::Flag;

/// The command: `(p_ids, p_archived, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetTransactionsArchived {
    /// `p_ids`. The rows being hidden, or brought back.
    #[serde(default)]
    pub ids: Option<Vec<String>>,
    /// `p_archived`. Which way. Absent is refused by name, exactly as a NULL is
    /// in the RPC — this argument has a DEFAULT of nothing there, and the
    /// function's first act is to check it.
    #[serde(default)]
    pub archived: Option<Flag>,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back. The RPC returns a bare integer.
#[derive(Debug, Serialize)]
pub struct SetTransactionsArchivedResult {
    /// The FIRST row named, as stored after the call.
    pub transaction: Option<WrittenTransaction>,
    /// How many rows really changed. A row already in the requested state is
    /// skipped and not counted.
    pub changed: i64,
    /// Those rows, as stored, in the order they were written (by id).
    pub transactions: Vec<WrittenTransaction>,
    /// Dense sequence number of the LAST audit row written, when any was.
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    pub audit_row_hash: Option<String>,
}

/// Hide rows from the live register, or bring them back.
///
/// # Errors
/// [`CoreError::Refused`] for `p_archived must be true or false` and for
/// `transaction_not_found`; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn set_transactions_archived(
    connection: &mut Connection,
    command: SetTransactionsArchived,
) -> CoreResult<SetTransactionsArchivedResult> {
    let named = command.ids.clone().unwrap_or_default();
    // `IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN RETURN 0` — and
    // it is FIRST, before the NULL check on the flag, so an empty call with no
    // direction is a nothing rather than a refusal. Ported in that order.
    if named.is_empty() {
        return Ok(SetTransactionsArchivedResult {
            transaction: None,
            changed: 0,
            transactions: Vec::new(),
            audit_seq: None,
            audit_row_hash: None,
        });
    }

    let Some(flag) = command.archived.as_ref() else {
        return Err(CoreError::refuse(
            "p_archived_must_be_true_or_false",
            "p_archived must be true or false",
        ));
    };
    let archived = flag
        .resolve()
        .map_err(|message| CoreError::InvalidCommand(format!("archived: {message}")))?;

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    // The count guard, before any write: every named id must be a row this
    // owner has. `distinct_ids` is `count(DISTINCT x)`.
    let wanted = super::distinct_ids(&named);
    let mut rows = Vec::new();
    for id in &wanted {
        let Some(row) = row::read_owned_transaction(&write, id, owner)? else {
            return Err(CoreError::Refused(
                Refusal::named("transaction_not_found", "transaction_not_found").with_hint(
                    "One of the transactions named for archiving no longer exists, or is not \
                     yours.",
                ),
            ));
        };
        rows.push(row);
    }

    let mut written = Vec::new();
    let mut entry = None;
    for before in rows {
        // `archived IS DISTINCT FROM p_archived`, in the cursor: a row already
        // in the requested state is not written, not audited, and its
        // `updated_at` does not move.
        if before.archived == archived {
            continue;
        }

        let changed = write.execute(
            "UPDATE transactions
                SET archived   = ?1,
                    updated_at = ?2
              WHERE id = ?3",
            params![i64::from(archived), now, before.id],
        )?;
        if changed != 1 {
            return Err(CoreError::refuse(
                "transaction_not_found",
                "a transaction being archived disappeared between finding it and writing it",
            ));
        }
        let after = row::read_transaction(&write, &before.id)?;

        entry = Some(audit::write(
            &write,
            &after.user_id,
            "transaction",
            &after.id,
            Action::Update,
            Some(&super::json_of(&before)?),
            Some(&super::json_of(&after)?),
            &now,
        )?);
        // The result projection, taken beside the audit rather than instead of
        // it: `after` is what the audit above serialised and this adds the one
        // column the answer needs and the chain does not.
        written.push(row::written(&write, after)?);
    }

    let first = named
        .first()
        .map(|id| row::read_owned_transaction(&write, id, None))
        .transpose()?
        .flatten()
        .map(|row| row::written(&write, row))
        .transpose()?;

    let count = super::count(written.len())?;

    write.commit()?;

    Ok(SetTransactionsArchivedResult {
        transaction: first,
        changed: count,
        transactions: written,
        audit_seq: entry.as_ref().map(|entry| entry.seq),
        audit_row_hash: entry.map(|entry| entry.row_hash),
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::SetTransactionsArchived;

    #[test]
    fn a_direction_that_is_absent_is_not_a_direction() {
        let command: SetTransactionsArchived =
            serde_json::from_str(r#"{"ids":["a"]}"#).expect("an absent flag parses");
        assert!(command.archived.is_none(), "the refusal is the verb's, not serde's");
    }

    #[test]
    fn there_is_nowhere_to_delete_from() {
        // Archiving is never a delete, and the safety is the absence of the
        // argument: this command cannot be made to mean one.
        let error = serde_json::from_str::<SetTransactionsArchived>(
            r#"{"ids":["a"],"archived":true,"delete":true}"#,
        )
        .expect_err("there is no delete here");
        assert!(error.to_string().contains("`delete`"), "{error}");
    }
}
