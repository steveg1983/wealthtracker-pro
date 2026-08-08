//! `apply_category_to_uncategorized` — payee memory, spread across the blanks.
//!
//! # What it is a port OF, and the rebase that ate a guard
//!
//! Four definitions exist. The LIVE one is the fourth:
//!
//! | migration | body |
//! | --- | --- |
//! | `20260708100000:200` | the original: fill blanks, one audit row per row |
//! | `20260713100000:275` | **adds `AND NOT is_split`**, and says why in a header |
//! | `20260808100000:387` | adds `category_confirmed = true` — **and drops `AND NOT is_split`** |
//! | `20260808180000:230` | puts the split guard back |
//!
//! The third file says of itself: *"Identical to
//! 20260708100000\_payee\_memory\_autocategorize.sql except that the rows it fills
//! are marked CONFIRMED."* It is — which is the bug. It was written from the
//! FIRST definition, so the guard the SECOND added was not in the live function.
//!
//! `20260713100000:269-274` is the header that added it, and it predicted the
//! failure exactly: *"A split parent's category is blank BY DESIGN — without this
//! guard the fan-out would treat it as uncategorised and stamp a single category
//! onto it (the trigger above would reject the write mid-loop and fail the whole
//! propagation)."*
//!
//! MEASURED on the reference cluster (`probe-cat1.sh`, then
//! `probe-apply-category.sql`, 2026-08-08), before the repair:
//!
//! ```text
//! a13   ids = [a blank row, A SPLIT PARENT, another blank row]
//!       -> REFUSED  split_category_locked
//!       -> the two blank rows are UNFILLED, audit log EMPTY
//! a13b  ids = [a split parent] alone
//!       -> REFUSED  split_category_locked
//! ```
//!
//! So the whole call was lost, not just the one row — which is what "fail the
//! whole propagation" meant. This is the second live cloud regression this port
//! found by tracing definitions rather than reading the newest file, and the two
//! are the same mistake: the first was `is_cleared`, dropped by a rebase onto a
//! superseded `create_transaction_atomic` and repaired by `20260808150000`.
//!
//! ## Why this port used to reproduce it, and why it no longer does
//!
//! It reproduced it on the rule `clear_transfer_links` states about reciprocals:
//! a local edition that refused fewer things than the cloud would make the two
//! editions disagree about what a call did, and *"a divergence in the direction
//! of 'more correct' is still a divergence"*. The fix belonged in a migration.
//!
//! `20260808180000_apply_category_skips_split_parents.sql` is that migration, so
//! the argument has expired exactly as it expired for `is_cleared`. **This verb
//! skips split parents**, and
//! `verb-specs/apply-a-split-parent-costs-the-whole-call.spec.mjs` — whose name
//! is kept for the lineage — proves both engines now file the other rows instead
//! of losing the call.
//!
//! MEASURED after the repair, same probe: the three-id call files **2** and
//! writes **2** audit rows, the split parent alone files **0**, and the parent's
//! category is still blank.
//!
//! Note what "both engines" means and does not mean here: the migration is
//! applied to the **reference cluster**, which is what the harness measures.
//! Production lags until the owner applies it. That is expected and it is the
//! right order — the differential proof is what makes applying it safe.
//!
//! ## What the local file would do without the skip
//!
//! It would refuse, for two reasons rather than one, and the first wins:
//! `trg_protect_split_category` (S-5) raises `split_category_locked`, and the
//! CHECK `transactions_split_parent_has_blank_category` would have refused as
//! well. SQLite runs BEFORE triggers ahead of constraint checking, so the code
//! and the message were the cloud's. MEASURED (`probe-local-triggers.mjs`, `l6`).
//!
//! Those two are unchanged and stay: a split parent's category genuinely must
//! stay blank, and this verb agreeing not to try is a third layer rather than a
//! replacement for either.
//!
//! ## Who could actually reach it
//!
//! Every client path filters split parents out before calling:
//! `payeeGroups.ts:96` (`if (t.isSplit) continue`), the local-mode mirror in
//! `AppContextSupabase.tsx:836`, and the drill's uncategorised bucket, which is
//! the split-EXPANDED view where a parent has been replaced by its lines. So this
//! was not a bug a user hit on the happy path. It was the defence-in-depth guard
//! going missing — and `20260708100000:190-196` says exactly what that guard is
//! for: *"the client computes its target list from a snapshot that can be stale
//! (backgrounded tab, second device)"*. A row that becomes a split on one device
//! while another device's list is stale is precisely the case, and the result was
//! that the whole bulk action failed and filed nothing.
//!
//! # What it will accept, all MEASURED and none of it guarded
//!
//! `p_category` is written verbatim with no validation whatsoever
//! (`probe-cat1.sh`, `a8`–`a12`):
//!
//! ```text
//! a category id nobody has  -> stored, count 1
//! a To/From category        -> stored, count 1   (nothing stops filing an ordinary row there)
//! ''                        -> stored as '', and the row is marked VOUCHED FOR
//! NULL                      -> stored as NULL, and the row is marked VOUCHED FOR
//! 'transfer-out'            -> stored; not a uuid, and the legacy sentinels live in this column (R-3)
//! ```
//!
//! The last two are worth staring at: a call that files nothing still records
//! that a human vouched for it. That is the live function's behaviour and it is
//! reproduced.
//!
//! # Which rows it touches
//!
//! `category IS NULL OR btrim(category) = ''` — three shapes of blank, all three
//! filled (`a1`). A row that already has a category is left alone, which is the
//! promise the whole feature rests on: *"a race could silently overwrite a
//! category the user set elsewhere — the one thing this feature promises never to
//! do"*. An unknown id is skipped rather than refused, `[X, X]` fills one row
//! rather than two, and an empty or NULL list is a zero with no writes.
//!
//! # Which guard it holds: none, and it MUST NOT hold one
//!
//! `_rpc_guard('split')` would make a split parent writable, and this verb would
//! then be able to do the one thing every layer of both schemas exists to stop:
//! stamp a category onto a row whose categorisation lives in its lines. The
//! absence is the point, and it is why the skip below is a `continue` rather
//! than a guard-and-write.
//!
//! # Balance-neutral
//!
//! `category`, `category_confirmed`, `updated_at`. No amount, no account, no
//! arithmetic (`a1`: the account balance is unmoved).

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::row::{self, TransactionRow};

/// The command. `(p_ids, p_category, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApplyCategoryToUncategorized {
    /// `p_ids`. The rows the client believes are still blank.
    ///
    /// `Option<Vec<…>>` so a caller sending `null` is a zero on both engines
    /// rather than a deserialiser error on one, for the reason
    /// `ClearTransferLinks::ids` gives.
    #[serde(default)]
    pub ids: Option<Vec<String>>,
    /// `p_category`. Written verbatim. `Option` because SQL NULL is a value this
    /// function accepts and stores — see the module docs.
    #[serde(default)]
    pub category: Option<String>,
    /// `p_user_id`. Absent means "name no owner", and MEASURED to reach every
    /// user's rows when absent (`a7`).
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The RPC returns a bare integer. `applied` is that integer.
#[derive(Debug, Serialize)]
pub struct ApplyCategoryToUncategorizedResult {
    /// The FIRST row named, as stored after the call — the house key the harness
    /// compares field by field across both engines. `None` when the caller named
    /// nothing, or named an id nobody has: unlike the unlink verb, this one does
    /// not refuse an unknown id, so an absent row here is an ordinary outcome.
    pub transaction: Option<TransactionRow>,
    /// How many rows were actually filled.
    pub applied: i64,
    /// Those rows, as stored, in the order they were written (by id).
    pub transactions: Vec<TransactionRow>,
    /// Dense sequence number of the LAST audit row written, when any was.
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    pub audit_row_hash: Option<String>,
}

/// File a category on every named row that is still blank and not split, and
/// audit each one.
///
/// A split parent among the named ids is SKIPPED, not refused — the cursor's
/// `AND NOT is_split` (`20260713100000:293`, restored by `20260808180000`).
/// Until that migration the live cloud refused the whole call with
/// `split_category_locked` and filed nothing, and this port reproduced it; the
/// module docs carry that history.
///
/// # Errors
/// [`CoreError::Refused`] for a rule the file enforced; [`CoreError::Storage`]
/// for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn apply_category_to_uncategorized(
    connection: &mut Connection,
    command: ApplyCategoryToUncategorized,
) -> CoreResult<ApplyCategoryToUncategorizedResult> {
    let named = command.ids.clone().unwrap_or_default();
    if named.is_empty() {
        return Ok(ApplyCategoryToUncategorizedResult {
            transaction: None,
            applied: 0,
            transactions: Vec::new(),
            audit_seq: None,
            audit_row_hash: None,
        });
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    let mut filled = Vec::new();
    let mut entry = None;
    for id in super::distinct_ids(&named) {
        // The cursor's WHERE clause, per row. `id = ANY(p_ids)` walks matching
        // rows once each however many times an id appears, which is what a
        // BTreeSet of the named ids reproduces — and in the same `id` order,
        // because for canonical lowercase uuid text, byte order and Postgres's
        // uuid order are the same order.
        let Some(before) = row::read_owned_transaction(&write, id, owner)? else {
            continue;
        };
        if !super::is_blank_category(before.category.as_deref()) {
            continue;
        }
        // `AND NOT is_split` — the cursor's third condition
        // (20260713100000:293, dropped by 20260808100000, restored by
        // 20260808180000). A split parent's category is blank BY DESIGN, so
        // without this it looks exactly like a row waiting to be filed, and
        // filing it raises `split_category_locked` and loses the WHOLE call
        // rather than one row.
        //
        // Skipped, not refused. That is the shape the cloud's cursor has: a row
        // the WHERE clause does not select is a row nobody was ever going to
        // write, so it is silent and it does not count.
        if before.is_split {
            continue;
        }

        let changed = write.execute(
            "UPDATE transactions
                SET category = ?1,
                    category_confirmed = 1,
                    updated_at = ?2
              WHERE id = ?3",
            params![command.category, now, before.id],
        )?;
        if changed != 1 {
            return Err(CoreError::refuse(
                "transaction_not_found",
                "a transaction being categorised disappeared between finding it and writing it",
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
        filled.push(after);
    }

    // The first id the CALLER named, not the first in id order — the client's
    // list is its own, and the Postgres side of the harness projects `p_ids->>0`
    // for the same reason.
    let first = named
        .first()
        .map(|id| row::read_owned_transaction(&write, id, None))
        .transpose()?
        .flatten();

    let applied = super::count(filled.len())?;

    write.commit()?;

    Ok(ApplyCategoryToUncategorizedResult {
        transaction: first,
        applied,
        transactions: filled,
        audit_seq: entry.as_ref().map(|entry| entry.seq),
        audit_row_hash: entry.map(|entry| entry.row_hash),
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::ApplyCategoryToUncategorized;

    #[test]
    fn a_null_category_is_a_value_and_not_an_absence() {
        let command: ApplyCategoryToUncategorized =
            serde_json::from_str(r#"{"ids":["a"],"category":null}"#).expect("null is a value here");
        assert!(command.category.is_none());
    }

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<ApplyCategoryToUncategorized>(r#"{"categories":"x"}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("`categories`"), "{error}");
    }
}
