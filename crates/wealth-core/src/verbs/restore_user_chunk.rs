//! `restore_user_chunk` — the port of the verb that puts a backup back.
//!
//! # What it is a port OF
//!
//! The **live** definition,
//! `supabase/migrations/20260807083000_user_data_restore.sql:230-374`. Defined
//! once, never redefined. The column translation it needs is [`crate::backup`],
//! which also records the one thing this verb must NOT become: a second copy of
//! `backupService.remapBackupIds`, which runs on the client.
//!
//! # The refusal ORDER, measured
//!
//! Five outcomes, and four of them are decided before a row is looked at.
//! MEASURED on the reference cluster:
//!
//! ```text
//! owner absent                          -> owner_unknown
//! rows is a JSON object                 -> rows_not_an_array
//! rows is a JSON null                   -> rows_not_an_array
//! rows is SQL NULL (the key is absent)  -> 0, no refusal          <- a hole, ported
//! rows is [] , entity = accounts        -> 0, no refusal          <- beats the precondition
//! rows is [] , entity = not_a_table     -> 0, no refusal          <- beats the whitelist
//! rows is [row], target holds data      -> restore_target_not_empty  (accounts only)
//! rows is [row], entity = not_a_table   -> restore_entity_unknown
//! ```
//!
//! Two of those are surprises worth keeping rather than tidying:
//!
//! * **An empty chunk is always accepted**, whatever the entity is called. The
//!   length test comes before both the precondition and the whitelist, so a
//!   restore that sends no rows for a table it invented is not told about it.
//! * **`rows_not_an_array` does not catch SQL NULL.** `jsonb_typeof(NULL)` is
//!   NULL, `NULL <> 'array'` is NULL, and a plpgsql `IF` treats NULL as false —
//!   so the guard is silently skipped and the function returns 0. [`Chunk::rows`]
//!   is a [`crate::wire::Field`] precisely so that a Rust type can tell the three
//!   states apart and reproduce this rather than accidentally improving it.
//!
//! # The precondition is checked on `accounts`, and only on `accounts`
//!
//! MEASURED: a `transactions` chunk sent into a login that already holds data is
//! NOT refused. The precondition is therefore only as strong as the caller's
//! ordering — which is why `backupService.RESTORE_STEPS` puts accounts first and
//! says so, and why the entity name is compared as a **string** here, before
//! [`crate::backup::Entity::parse`] runs. Resolving the entity earlier would make
//! `restore_entity_unknown` fire ahead of `restore_target_not_empty`, and the
//! order would silently stop matching.
//!
//! The rule bites in a second direction that is easy to miss: MEASURED, sending
//! `categories` first and `accounts` second gets `restore_target_not_empty` on
//! the accounts chunk, because the categories made the login non-empty. Accounts
//! are not merely conventionally first; nothing else can go first.
//!
//! # One transaction, and why that is allowed to differ
//!
//! DESIGN.md §5 divergence 6: *"Restore is chunked, not atomic | Restore is one
//! transaction | X-7. No request-size cliff locally."* The cloud chunks because a
//! 50k-transaction dataset is tens of megabytes and a single request that size is
//! a cliff waiting to be hit on the one operation a user cannot afford to have
//! fail; its own comment calls the resulting non-atomicity *"honest"* and leans on
//! the empty-login precondition to make a half-restore survivable.
//!
//! Locally there is no request. So this verb takes a LIST of chunks and applies
//! them in ONE SQLite transaction. Three things make that the right call rather
//! than a liberty:
//!
//! 1. R-11. `transactions.linked_transfer_split_id` and
//!    `transaction_splits.linked_transfer_id` form a cycle that Postgres cannot
//!    close in one pass — nothing in that schema is DEFERRABLE, which is what
//!    `finalize_user_restore` exists for. This schema declares both keys
//!    `DEFERRABLE INITIALLY DEFERRED`, and
//!    `specs/r11-deferred-keys-close-the-transaction-split-cycle` proves the cycle
//!    closes in one COMMIT. The second pass is a workaround for a thing that is
//!    not true here.
//! 2. `localBackupService.restoreLocalBackup` already promises all-or-nothing —
//!    its store's `setMany` is one IndexedDB readwrite transaction *"so a restore
//!    either lands completely or leaves the previous contents untouched"*. A
//!    SQLite edition that could half-restore would be the weaker of the two local
//!    engines.
//! 3. The cloud's own fallback is *"recovery is wipe and retry"*. Not needing it
//!    is strictly better and costs nothing.
//!
//! `finalize_user_restore` is still ported and still called, and that is
//! deliberate: the links travel in the backup file as a separate payload, both
//! engines must apply them the same way, and a local edition that reached the
//! same rows by a different route would make the two files diverge in what they
//! mean. See that verb for what it does that this one cannot.
//!
//! # No guard, and that is a fact about both engines
//!
//! The RPC opens with `set_config('app.split_rpc', '1', true)`, which reads like
//! a restore needing the split guard. It does not. MEASURED on the reference
//! cluster: every split protection in the cloud is `BEFORE UPDATE` —
//! `trg_protect_split_transaction_fields` and `trg_sweep_reconciled_into_archive`
//! both are — and a restore only ever INSERTs. The same is true here: all four
//! `trg_protect_split_*` triggers are `BEFORE UPDATE OF`, and MEASURED, inserting
//! a row with `is_split = 1` and no guard at all is accepted. So this verb holds
//! nothing, and the cloud's `set_config` is belt-and-braces rather than a rule
//! that was missed.
//!
//! The `restore` guard is not held here either, for a plainer reason: the
//! `updated_at` triggers are `AFTER UPDATE`, and an INSERT does not fire one.
//! `updated_at` survives because the write is an INSERT, which is exactly the
//! argument the migration makes at `:35-38`.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::backup::{self, BackupRow, Dropped, Entity};
use crate::error::{CoreError, CoreResult, Refusal};
use crate::wire::Field;

/// One entity's rows — the RPC's `(p_entity, p_rows)` pair.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Chunk {
    /// `p_entity`. Matched against a fixed list; there is no dynamic SQL.
    pub entity: String,
    /// `p_rows`. Absent is the SQL-NULL hole above; JSON null is a refusal.
    #[serde(default)]
    pub rows: Field<Value>,
}

/// The command.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RestoreUserChunk {
    /// One or more chunks, applied in the order given, in one transaction.
    pub chunks: Vec<Chunk>,
    /// `p_user_id`. Every restored row is re-owned to this login (X-6).
    #[serde(default)]
    pub user_id: Option<String>,
}

/// The RPC's return value, plus the one thing the cloud has no equivalent for.
#[derive(Debug, Serialize)]
pub struct RestoreAnswer {
    /// Rows inserted, across every chunk. The RPC returns this as a bare bigint.
    pub inserted: i64,
    /// What the file carried and this ledger has nowhere to keep. Absent when
    /// there was nothing, so an ordinary restore's answer is the RPC's answer and
    /// nothing else.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub dropped: Vec<Dropped>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct RestoreUserChunkResult {
    /// The projection both engines are compared on.
    pub answer: RestoreAnswer,
}

/// Insert one or more entities' whole rows from a backup, re-owning each to the
/// caller.
///
/// # Errors
/// [`CoreError::Refused`] for the five named refusals above, or
/// `restore_row_refused` naming the row a rule stopped;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn restore_user_chunk(
    connection: &mut Connection,
    command: RestoreUserChunk,
) -> CoreResult<RestoreUserChunkResult> {
    let Some(owner) = command.user_id.clone() else {
        return Err(CoreError::refuse(
            "owner_unknown",
            "could not establish which login to restore into",
        ));
    };

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let mut inserted = 0_i64;
    let mut dropped: Vec<Dropped> = Vec::new();

    for chunk in &command.chunks {
        // The three states of p_rows, in the RPC's own order.
        let rows: &[Value] = match &chunk.rows {
            // SQL NULL. The guard below cannot see it in the cloud either.
            Field::Absent => &[],
            Field::Null => {
                return Err(CoreError::refuse(
                    "rows_not_an_array",
                    "each chunk must be a JSON array of whole rows",
                ))
            }
            Field::Value(value) => match value.as_array() {
                Some(array) => array.as_slice(),
                None => {
                    return Err(CoreError::refuse(
                        "rows_not_an_array",
                        "each chunk must be a JSON array of whole rows",
                    ))
                }
            },
        };

        // An empty chunk beats BOTH the precondition and the whitelist, because
        // the length test comes before either. The entity is still a string at
        // this point, and must be.
        if rows.is_empty() {
            continue;
        }

        if chunk.entity == Entity::Accounts.as_str() && !is_empty(&transaction, &owner)? {
            return Err(CoreError::Refused(
                Refusal::named(
                    "restore_target_not_empty",
                    "this login already holds data — clear it first, because restoring on top \
                     would mix two datasets and silently re-date your history",
                )
                .with_hint("Erase everything first, or restore into a fresh login."),
            ));
        }

        let entity = Entity::parse(&chunk.entity)?;
        for row in rows {
            let Some(object) = row.as_object() else {
                return Err(CoreError::refuse(
                    "rows_not_an_array",
                    "each chunk must be a JSON array of whole rows",
                ));
            };
            let row: &BackupRow = object;
            backup::insert_row(&transaction, entity, row, &owner, &mut dropped)?;
            inserted = inserted.checked_add(1).ok_or_else(|| {
                CoreError::refuse("amount_out_of_range", "that is more rows than this ledger can count")
            })?;
        }
    }

    transaction.commit()?;

    Ok(RestoreUserChunkResult { answer: RestoreAnswer { inserted, dropped } })
}

/// The precondition's own question, asked inside the restore's transaction.
///
/// Deliberately the same three tables [`super::user_financial_data_is_empty`]
/// asks about, and deliberately not a call to it: that verb takes a `&Connection`
/// and would be reading outside this transaction's view of the file.
fn is_empty(transaction: &rusqlite::Transaction<'_>, owner: &str) -> CoreResult<bool> {
    let found: i64 = transaction.query_row(
        "SELECT EXISTS (
           SELECT 1 FROM accounts     WHERE user_id = ?1
            UNION ALL
           SELECT 1 FROM categories   WHERE user_id = ?1
            UNION ALL
           SELECT 1 FROM transactions WHERE user_id = ?1
         )",
        params![owner],
        |row| row.get(0),
    )?;
    Ok(found == 0)
}
