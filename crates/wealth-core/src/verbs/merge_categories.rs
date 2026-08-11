//! `merge_categories` — *"these two are the same thing"*, as one transaction.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260805214322_merge_categories.sql:82-396`. Traced by
//! grep across every migration: defined once, never redefined, and the client
//! calls it at exactly one place (`planningService.ts:610`).
//!
//! # SEVENTEEN refusals, not twelve — counted rather than read
//!
//! The brief that commissioned this port said twelve. The function has
//! **seventeen** `RAISE` sites carrying **sixteen** distinct codes (two spell
//! `category_not_found` and differ only in HINT), and every one of them is
//! REACHABLE. Measured on the reference cluster, `probe-merge1.sh`, 2026-08-08 —
//! the same lesson the splits verb learned when the documented count was 19 and
//! the reachable count was 14, arriving from the other direction.
//!
//! ```text
//!  1 merge_needs_two_categories          either id NULL
//!  2 merge_source_is_target              the same id twice
//!  3 category_not_found (HINT: away)     source absent or not yours
//!  4 category_not_found (HINT: into)     target absent or not yours
//!  5 categories belong to different …    reachable ONLY with no owner named
//!  6 merge_source_is_type_root
//!  7 merge_source_is_transfer_category
//!  8 merge_source_is_system_category     is_revaluation OR is_system — ONE code, TWO causes
//!  9 merge_source_is_unassigned_bucket
//! 10 merge_source_has_children
//! 11 merge_target_is_type_root
//! 12 merge_target_is_transfer_category
//! 13 merge_target_is_unassigned_bucket
//! 14 merge_target_inactive
//! 15 merge_target_is_group
//! 16 merge_direction_mismatch
//! 17 merge_left_references               after every move, before the delete
//! ```
//!
//! Three of those need saying out loud:
//!
//! * **5 has no code.** Every other refusal here is `code: sentence`; this one is
//!   the bare sentence *"categories belong to different users"*. The client
//!   surfaces `error.message` verbatim, so that string is what a human sees. It is
//!   carried over exactly, under a local code of
//!   `categories_belong_to_different_users`, because this crate's contract is that
//!   a refusal has a name — but the *message* is not improved, because improving
//!   it would change what the two editions show for the same event. It is also
//!   only reachable when no owner is named: with `p_user_id` supplied, both
//!   lookups are already scoped and a foreign row reads as absent (3/4).
//! * **17 is reachable**, and finding the route was the work. Every reference
//!   surface is moved with the same predicate the final check uses — except one:
//!   the split-lines loop walks *parents* scoped by `transactions.user_id`, while
//!   the final check scans *lines* scoped by `transaction_splits.user_id`. A line
//!   this user owns on a parent somebody else owns therefore survives the move and
//!   trips the check. MEASURED (`probe-merge1.sh`, `m-left-references`).
//! * **8 is one code for two flags**, so a spec that only sets `is_system` proves
//!   half of it.
//!
//! # The ORDER is the code's order, measured pairwise
//!
//! `probe-merge2.sh`, fifteen cases, each making two rules true at once. The
//! answer is the linear order above, every time — no constraint, trigger or lock
//! gets in front of a check. Two are worth keeping:
//!
//! * `same id + neither exists` → 2, not 3. A caller who names one category twice
//!   is told what they did, not that it is missing.
//! * `direction mismatch + a left reference` → 16. Every guard runs before the
//!   first write, so 17 can only ever fire on a call that had nothing else wrong
//!   with it.
//!
//! # The guard: `leg`, conditionally — and this is the R-5 trap in a new place
//!
//! `verbs/mod.rs` records that the guard a verb needs is a fact about the
//! triggers *and* about the verb's own writes, and has to be measured per verb.
//! Measured here, it is the first verb outside `delete_transaction` to need one:
//!
//! ```text
//! postgres   merge a category a LINKED split leg is filed under  -> OK, leg re-filed, pair intact
//! sqlite     the same UPDATE, no guard held                      -> REFUSED  split_leg_locked
//! sqlite     the same UPDATE, holding _rpc_guard('leg')          -> OK
//! sqlite     the same UPDATE on an UNLINKED line, no guard       -> OK
//! ```
//!
//! (`probe-merge4.sh` and `probe-local-triggers.mjs`, 2026-08-08.)
//!
//! The asymmetry is the one `schema.sql` §S-9 already documents: in the cloud the
//! linked-leg rules are *procedural*, inside `set_transaction_splits_with_legs`,
//! so nothing watches `transaction_splits.category`; locally they are TRIGGERS,
//! and `category` is one of the four columns `trg_protect_linked_leg` watches. A
//! merge re-files that column. So without the guard the local edition refuses a
//! merge the cloud performs — and it would refuse it for the commonest split
//! shape there is: the MS Money import's linked legs filed under ordinary
//! categories (`_shared.mjs` records 86 of 364 lines in that shape).
//!
//! It is held **per parent, only where a line about to move is linked**, for the
//! reason `delete_transaction` gives: *"a guard that is always on is not a
//! guard"*. Held across the whole call it would also stand S-9 down for the
//! budgets and recurring loops, which have no business being able to touch a leg.
//!
//! ## Which guard it does NOT need, and why that had to be checked too
//!
//! `trg_protect_split_category` (S-5) fires `BEFORE UPDATE OF category … WHEN
//! OLD.is_split = 1 AND trim(NEW.category) <> ''`. The transactions loop *does*
//! name `category` in its SET list for a split parent — reached through the uuid
//! twin, whose `category` is blank by design — and the trigger is therefore
//! consulted on every such row. It stands down because the `CASE` leaves the
//! blank alone, which is exactly what `20260805214322:213-217` says the `CASE` is
//! for. MEASURED both ways (`probe-local-triggers.mjs`, `l4` accepted, `l5`
//! refused with `split_category_locked`): the guard is unnecessary *because of the
//! CASE*, not because nothing is watching.
//!
//! A split parent reached that way is counted **twice** and audited **twice** —
//! once by the transactions loop (its `category_id` moved) and once by the
//! split-lines loop (its line moved). MEASURED (`probe-merge2.sh`, `x1`:
//! `transactions: 1, split_lines: 1, split_transactions: 1`, three audit rows).
//! That looks like double counting and is not: they are two different facts about
//! two different columns, and a port that deduplicated them would report a
//! smaller number than the cloud for the same merge.
//!
//! # Balance-neutral by construction
//!
//! No amount, sign or `account_id` is written by any statement here, so there is
//! no balance arithmetic — the same property, and the same reasoning, as
//! `link_transfer_pair` and `repair_claimed_transfer` (`20260805214322:39-42`).
//! Every spec asserts B-1 anyway, because "no arithmetic" is a claim about the
//! code and B-1 is a fact about the file.
//!
//! # What it leaves behind ON PURPOSE
//!
//! Another user's row filed under the merged-away category keeps its dangling
//! `category` text, and its `category_id` is nulled by the foreign key, unaudited.
//! MEASURED (`probe-merge3.sh`, `e8`). Nothing here fixes that, for the reason
//! `clear_transfer_links` gives about reciprocals: the cloud leaves it, RLS makes
//! it unreachable there, and a local port that tidied it would touch a row the
//! cloud does not. `verify_integrity()`'s dangling-category check is where the
//! local edition reports it.
//!
//! # The one thing that is a local decision rather than a port
//!
//! The audit entries are written in the cloud's *code* order — transactions, then
//! split parents, then budgets, then recurring, then the category delete — and
//! the rows within each loop in `id` order. Postgres has no ordering guarantee to
//! port here (all its entries share one transaction timestamp; `probe-merge3.sh`
//! `e10` reads them back in whatever order it likes). Locally `seq` is dense and
//! the hash chains, so *some* order is load-bearing, and the code's own order is
//! the only one that is not arbitrary.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::budget::{self, BudgetRow};
use crate::row::category::{self, CategoryRow};
use crate::row::recurring::{self, RecurringRow};
use crate::row::split::{self, SplitRow};
use crate::row::{self as transaction_row, TransactionRow, WrittenTransaction};

/// The command. `(p_source_id, p_target_id, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MergeCategories {
    /// `p_source_id`. The category being merged away — it is removed at the end.
    ///
    /// `Option` because `p_source_id IS NULL` is the RPC's first named refusal,
    /// and reproducing the shape rather than the outcome is what makes that
    /// refusal reachable from a payload on both engines.
    #[serde(default)]
    pub source_id: Option<String>,
    /// `p_target_id`. The category everything is filed under afterwards.
    #[serde(default)]
    pub target_id: Option<String>,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The RPC returns the five counts as jsonb; those are here under the same names.
/// `transaction` is the house key every result in this crate carries so the
/// harness can compare one stored row field by field across the two engines — see
/// the module docs on which row it is.
#[derive(Debug, Serialize)]
pub struct MergeCategoriesResult {
    /// The FIRST whole transaction the merge moved, in id order, as stored
    /// afterwards. `None` when the merge moved no whole transaction — which is
    /// an ordinary outcome, not an error: a category may be referenced only by
    /// split lines, or by nothing at all.
    pub transaction: Option<WrittenTransaction>,
    /// `source_id` from the RPC's jsonb. Echoed because the source is gone and
    /// this is the only record of which id the caller named.
    pub source_id: String,
    /// `target_id`.
    pub target_id: String,
    /// Whole transactions whose `category`, `category_id` or both moved.
    pub transactions: i64,
    /// Split LINES re-filed.
    pub split_lines: i64,
    /// Split PARENTS at least one of whose lines moved. Audited one entry per
    /// parent, carrying the whole line set before and after, exactly as the
    /// split writer does.
    pub split_transactions: i64,
    /// Budgets re-pointed.
    pub budgets: i64,
    /// Recurring templates re-pointed.
    pub recurring: i64,
    /// Dense sequence number of the LAST audit row written — always the
    /// category delete, because that is the last thing this verb does.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Join two categories: every reference moves and the source is removed, in one
/// SQLite transaction, or none of it happens.
///
/// # Errors
/// [`CoreError::Refused`] for any of the seventeen refusals in the module docs,
/// or for a constraint the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value, clippy::too_many_lines)]
pub fn merge_categories(
    connection: &mut Connection,
    command: MergeCategories,
) -> CoreResult<MergeCategoriesResult> {
    // 1 and 2 are answered before anything is opened, exactly as the RPC does.
    let (Some(source_id), Some(target_id)) = (&command.source_id, &command.target_id) else {
        return Err(CoreError::refuse(
            "merge_needs_two_categories",
            "a merge needs the category to merge away and the category to merge it into",
        ));
    };
    if source_id == target_id {
        return Err(CoreError::refuse(
            "merge_source_is_target",
            "a category cannot be merged into itself",
        ));
    }

    // The RPC opens with `SELECT … FOR UPDATE` over both ids in id order so that
    // concurrent merges take them the same way round. SQLite has one writer and
    // BEGIN IMMEDIATE takes it before the first read, which is the same guarantee
    // arrived at by having no second writer rather than by ordering locks.
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    let source = read_side(&write, source_id, owner, "away")?;
    let target = read_side(&write, target_id, owner, "into")?;

    let owner_id = source.user_id.clone();
    if target.user_id != owner_id {
        return Err(CoreError::refuse(
            // The cloud's only un-coded refusal. Message verbatim; see the
            // module docs for why it is not improved.
            "categories_belong_to_different_users",
            "categories belong to different users",
        ));
    }

    refuse_bad_source(&write, &source)?;
    refuse_bad_target(&write, &target)?;

    // Direction. A `both` target takes either side because it carries no
    // direction of its own; a `both` SOURCE cannot go to a directional target,
    // since its rows may point both ways.
    if target.kind != "both" && target.kind != source.kind {
        return Err(CoreError::refuse(
            "merge_direction_mismatch",
            &format!(
                "merge_direction_mismatch: \"{}\" is an {} category and \"{}\" is an {} one — \
                 merging across the two would file money on the wrong side of every report",
                source.name, source.kind, target.name, target.kind
            ),
        ));
    }

    let moved_transactions = move_transactions(&write, &owner_id, &source, &target, &now)?;
    let (split_lines, split_parents) = move_split_lines(&write, &owner_id, &source, &target, &now)?;
    let budgets = move_budgets(&write, &owner_id, &source, &target, &now)?;
    let recurring = move_recurring(&write, &owner_id, &source, &target, &now)?;

    // 17. The invariant that makes the delete safe, CHECKED rather than assumed:
    // a reference surface added later without teaching this verb about it fails
    // loudly here, and the refusal rolls every move above back with it, so
    // "nothing has been changed" is literally true.
    if still_referenced(&write, &owner_id, &source.id)? {
        return Err(CoreError::refuse(
            "merge_left_references",
            &format!(
                "merge_left_references: something still refers to \"{}\" after the move, \
                 so nothing has been changed",
                source.name
            ),
        ));
    }

    // A hard delete, because that is what deleting a category already does.
    // `is_active` is NOT the convention here: it is the account lifecycle's way
    // of hiding a closed account's To/From category, and a deactivated leftover
    // would sit in this user's tree for ever meaning nothing.
    let removed = write.execute(
        "DELETE FROM categories WHERE id = ?1 AND user_id = ?2",
        params![source.id, owner_id],
    )?;
    if removed != 1 {
        // Unreachable under BEGIN IMMEDIATE — nothing can take the row between
        // the read and the delete — but SQLite reports zero changed rows and
        // raises nothing at all, so the assert is what turns a silent no-op into
        // a refusal. The same assert every verb in this crate makes after a
        // write it believes must land.
        return Err(CoreError::refuse(
            "category_not_found",
            "the category disappeared between finding it and deleting it",
        ));
    }

    let entry = audit::write(
        &write,
        &owner_id,
        "category",
        &source.id,
        Action::Delete,
        Some(&super::json_of(&source)?),
        // U-6: a delete has no `after`.
        None,
        &now,
    )?;

    // The result projection, taken before the commit and beside the audit
    // rather than instead of it: every `json_of` above still serialises the
    // audit projection, and these add the one column an answer needs.
    let first_moved = moved_transactions
        .first()
        .cloned()
        .map(|row| transaction_row::written(&write, row))
        .transpose()?;

    write.commit()?;

    Ok(MergeCategoriesResult {
        transaction: first_moved,
        source_id: source.id,
        target_id: target.id,
        transactions: super::count(moved_transactions.len())?,
        split_lines,
        split_transactions: split_parents,
        budgets,
        recurring,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// One side of the merge, or the refusal that names which side went missing.
///
/// The two `category_not_found` raises differ only in HINT, and that HINT is the
/// only thing telling the user *which* of the two categories they can no longer
/// see. MEASURED verbatim (`probe-merge2.sh`, `o2b`/`o2c`).
fn read_side(
    write: &rusqlite::Transaction<'_>,
    id: &str,
    owner: Option<&str>,
    which: &str,
) -> CoreResult<CategoryRow> {
    category::read_owned(write, id, owner)?.ok_or_else(|| {
        CoreError::Refused(
            Refusal::named("category_not_found", "category_not_found").with_hint(&format!(
                "The category being merged {which} no longer exists, or is not yours."
            )),
        )
    })
}

/// Refusals 6 to 10: what may not be merged AWAY.
fn refuse_bad_source(write: &rusqlite::Transaction<'_>, source: &CategoryRow) -> CoreResult<()> {
    if source.level == "type" {
        return Err(CoreError::refuse(
            "merge_source_is_type_root",
            &format!(
                "merge_source_is_type_root: \"{}\" is a top-level heading, not a category \
                 things are filed under",
                source.name
            ),
        ));
    }
    if source.is_transfer_category {
        return Err(CoreError::refuse(
            "merge_source_is_transfer_category",
            "merge_source_is_transfer_category: transfer categories are managed automatically \
             from their account — close the account instead",
        ));
    }
    // Revaluation leaves and anything else the app files under by itself: the
    // code resolves these by FLAG, so merging one away would break a write path,
    // not just a report. One code, two causes.
    if source.is_revaluation_category || source.is_system {
        return Err(CoreError::refuse(
            "merge_source_is_system_category",
            &format!(
                "merge_source_is_system_category: \"{}\" is a built-in category the app files \
                 transactions under automatically, so it cannot be merged away",
                source.name
            ),
        ));
    }
    // The import's Unassigned bucket means NOT categorised. Merging it into a
    // real category would file every unreviewed row as something the user never
    // chose — the exact guess that flag exists to stop.
    if source.is_unassigned_bucket {
        return Err(CoreError::refuse(
            "merge_source_is_unassigned_bucket",
            &format!(
                "merge_source_is_unassigned_bucket: rows in \"{}\" are not categorised at all — \
                 file them from the review band rather than merging the whole bucket into a \
                 real category",
                source.name
            ),
        ));
    }
    // v1 is leaf-to-leaf. Merging a GROUP means re-parenting its children as
    // well — a different operation, with its own consequences to explain.
    if category::has_children(write, &source.id)? {
        return Err(CoreError::refuse(
            "merge_source_has_children",
            &format!(
                "merge_source_has_children: \"{}\" has categories under it — merging a whole \
                 group is not supported yet; merge its detail categories one at a time, or \
                 move them first",
                source.name
            ),
        ));
    }
    Ok(())
}

/// Refusals 11 to 15: what may not be merged INTO.
///
/// Note what is absent, and MEASURED absent (`probe-merge3.sh`): a **system**
/// target is allowed, a **revaluation** target is allowed, and an **inactive
/// source** is allowed. Only the source is guarded for the first two, because
/// filing something into a built-in category is ordinary and merging one away
/// breaks a write path; and only the target is guarded for the third, because
/// hiding a category you are emptying is not a reason to refuse to empty it.
fn refuse_bad_target(write: &rusqlite::Transaction<'_>, target: &CategoryRow) -> CoreResult<()> {
    if target.level == "type" {
        return Err(CoreError::refuse(
            "merge_target_is_type_root",
            &format!(
                "merge_target_is_type_root: \"{}\" is a top-level heading — nothing is filed \
                 against one",
                target.name
            ),
        ));
    }
    if target.is_transfer_category {
        return Err(CoreError::refuse(
            "merge_target_is_transfer_category",
            &format!(
                "merge_target_is_transfer_category: \"{}\" belongs to an account's transfer \
                 bookkeeping — filing ordinary transactions there would invent transfers that \
                 never happened",
                target.name
            ),
        ));
    }
    if target.is_unassigned_bucket {
        return Err(CoreError::refuse(
            "merge_target_is_unassigned_bucket",
            &format!(
                "merge_target_is_unassigned_bucket: \"{}\" means \"not categorised\" — merging \
                 into it would un-file transactions that are already filed",
                target.name
            ),
        ));
    }
    if !target.is_active {
        return Err(CoreError::refuse(
            "merge_target_inactive",
            &format!(
                "merge_target_inactive: \"{}\" is hidden, so nothing can be filed under it — \
                 pick a category that is in use",
                target.name
            ),
        ));
    }
    if category::has_children(write, &target.id)? {
        return Err(CoreError::refuse(
            "merge_target_is_group",
            &format!(
                "merge_target_is_group: \"{}\" is a group, and transactions belong to a \
                 category inside it — pick one of its detail categories",
                target.name
            ),
        ));
    }
    Ok(())
}

/// Loop 1: whole transactions, both reference columns together.
///
/// The `CASE` on `category` is not decoration. A split parent reached through the
/// uuid column has a blank `category` BY DESIGN, and `trg_protect_split_category`
/// rejects any update that gives a split parent one — leaving the blank alone is
/// what lets that row's `category_id` move without tripping the trigger. See the
/// module docs for the measurement.
fn move_transactions(
    write: &rusqlite::Transaction<'_>,
    owner: &str,
    source: &CategoryRow,
    target: &CategoryRow,
    now: &str,
) -> CoreResult<Vec<TransactionRow>> {
    let ids = collect_ids(
        write,
        "SELECT id FROM transactions
          WHERE user_id = ?1
            AND (category = ?2 OR category_id = ?2)
          ORDER BY id",
        owner,
        &source.id,
    )?;

    let mut moved = Vec::with_capacity(ids.len());
    for id in ids {
        let before = transaction_row::read_transaction(write, &id)?;
        let changed = write.execute(
            "UPDATE transactions
                SET category    = CASE WHEN category = ?1 THEN ?2 ELSE category END,
                    category_id = CASE WHEN category_id = ?1 THEN ?2 ELSE category_id END,
                    updated_at  = ?3
              WHERE id = ?4",
            params![source.id, target.id, now, id],
        )?;
        assert_one(changed, "a transaction named by the merge")?;
        let after = transaction_row::read_transaction(write, &id)?;

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
        moved.push(after);
    }
    Ok(moved)
}

/// Loop 2: split lines, audited on their PARENT.
///
/// The house pattern `set_transaction_splits` established: one entry per affected
/// parent carrying the whole line set before and after, rather than a per-line
/// entity nothing else in the schema writes.
///
/// Two lines of one parent landing on the same target stay two lines: their memos
/// and their history are the user's, and silently adding them together would
/// destroy both. MEASURED (`probe-merge2.sh`, `x2`: two lines, one audit entry,
/// `split_lines: 2, split_transactions: 1`).
///
/// Returns `(lines moved, parents touched)`.
fn move_split_lines(
    write: &rusqlite::Transaction<'_>,
    owner: &str,
    source: &CategoryRow,
    target: &CategoryRow,
    now: &str,
) -> CoreResult<(i64, i64)> {
    let parents = collect_ids(
        write,
        "SELECT t.id FROM transactions t
          WHERE t.user_id = ?1
            AND t.id IN (SELECT s.transaction_id FROM transaction_splits s
                          WHERE s.user_id = ?1 AND s.category = ?2)
          ORDER BY t.id",
        owner,
        &source.id,
    )?;

    let mut lines_moved: i64 = 0;
    let mut parents_touched: i64 = 0;
    for parent_id in parents {
        let parent = transaction_row::read_transaction(write, &parent_id)?;
        let before = split::read_lines(write, &parent_id)?;

        // S-9, conditionally. Only a LINKED line needs the guard, and only the
        // lines of this parent are about to move.
        let guarded = touches_a_linked_leg(write, &parent_id, &source.id)?;
        if guarded {
            write.execute("INSERT OR IGNORE INTO _rpc_guard VALUES ('leg')", [])?;
        }
        let changed = write.execute(
            "UPDATE transaction_splits
                SET category = ?1,
                    updated_at = ?2
              WHERE transaction_id = ?3
                AND category = ?4",
            params![target.id, now, parent_id, source.id],
        )?;
        if guarded {
            // Inside the same transaction as the write it authorised, so a
            // refusal anywhere below rolls the flag back with everything else.
            write.execute("DELETE FROM _rpc_guard WHERE flag = 'leg'", [])?;
        }

        // A parent whose lines moved on under us between the lookup and the
        // write gets no entry — the same "no write, no audit noise" rule
        // `clear_transfer_links` follows, and it keeps the returned counts true.
        // Unreachable under one writer; kept because the cloud's cursor really
        // can see it and the counts must mean the same thing on both engines.
        if changed == 0 {
            continue;
        }

        let after = split::read_lines(write, &parent_id)?;
        audit::write(
            write,
            &parent.user_id,
            "transaction",
            &parent.id,
            Action::Update,
            Some(&with_lines(&parent, &before)?),
            Some(&with_lines(&parent, &after)?),
            now,
        )?;

        lines_moved = lines_moved.saturating_add(super::count(changed)?);
        parents_touched = parents_touched.saturating_add(1);
    }
    Ok((lines_moved, parents_touched))
}

/// Loop 3: budgets — the surface the delete-and-reassign dialog never moved.
fn move_budgets(
    write: &rusqlite::Transaction<'_>,
    owner: &str,
    source: &CategoryRow,
    target: &CategoryRow,
    now: &str,
) -> CoreResult<i64> {
    let ids = collect_ids(
        write,
        "SELECT id FROM budgets
          WHERE user_id = ?1
            AND (category = ?2 OR category_id = ?2)
          ORDER BY id",
        owner,
        &source.id,
    )?;

    let mut moved: i64 = 0;
    for id in ids {
        let before: BudgetRow = budget::read(write, &id)?;
        let changed = write.execute(
            "UPDATE budgets
                SET category    = CASE WHEN category = ?1 THEN ?2 ELSE category END,
                    category_id = CASE WHEN category_id = ?1 THEN ?2 ELSE category_id END,
                    updated_at  = ?3
              WHERE id = ?4",
            params![source.id, target.id, now, id],
        )?;
        assert_one(changed, "a budget named by the merge")?;
        let after = budget::read(write, &id)?;

        audit::write(
            write,
            &after.user_id,
            "budget",
            &after.id,
            Action::Update,
            Some(&super::json_of(&before)?),
            Some(&super::json_of(&after)?),
            now,
        )?;
        moved = moved.saturating_add(1);
    }
    Ok(moved)
}

/// Loop 4: recurring templates, matched on the category id ALONE.
///
/// Deliberately unscoped by owner, because the cloud's is — see
/// [`crate::row::recurring`] for the whole argument.
fn move_recurring(
    write: &rusqlite::Transaction<'_>,
    _owner: &str,
    source: &CategoryRow,
    target: &CategoryRow,
    now: &str,
) -> CoreResult<i64> {
    let mut statement = write.prepare(
        "SELECT id FROM recurring_transactions WHERE category = ?1 ORDER BY id",
    )?;
    let mut ids = Vec::new();
    for id in statement.query_map(params![source.id], |record| record.get::<_, String>(0))? {
        ids.push(id?);
    }
    drop(statement);

    let mut moved: i64 = 0;
    for id in ids {
        let before: RecurringRow = recurring::read(write, &id)?;
        let changed = write.execute(
            "UPDATE recurring_transactions
                SET category = ?1,
                    updated_at = ?2
              WHERE id = ?3",
            params![target.id, now, id],
        )?;
        assert_one(changed, "a recurring template named by the merge")?;
        let after = recurring::read(write, &id)?;

        audit::write(
            write,
            &after.user_id,
            "recurring_transaction",
            &after.id,
            Action::Update,
            Some(&super::json_of(&before)?),
            Some(&super::json_of(&after)?),
            now,
        )?;
        moved = moved.saturating_add(1);
    }
    Ok(moved)
}

/// Refusal 17's question, as one statement — the five surfaces in the RPC's own
/// order.
fn still_referenced(
    write: &rusqlite::Transaction<'_>,
    owner: &str,
    source_id: &str,
) -> CoreResult<bool> {
    let found: i64 = write.query_row(
        "SELECT
           EXISTS (SELECT 1 FROM transactions
                    WHERE user_id = ?1 AND (category = ?2 OR category_id = ?2))
        OR EXISTS (SELECT 1 FROM transaction_splits
                    WHERE user_id = ?1 AND category = ?2)
        OR EXISTS (SELECT 1 FROM budgets
                    WHERE user_id = ?1 AND (category = ?2 OR category_id = ?2))
        OR EXISTS (SELECT 1 FROM recurring_transactions WHERE category = ?2)
        OR EXISTS (SELECT 1 FROM categories WHERE parent_id = ?2)",
        params![owner, source_id],
        |record| record.get(0),
    )?;
    Ok(found != 0)
}

/// Is one of the lines this UPDATE is about to move half of a transfer?
///
/// The condition the `leg` guard is held on. `delete_transaction`'s
/// `touches_a_transfer_leg` is the same question about a different write, and
/// the two are deliberately not shared: that one asks about a row being deleted
/// (both link directions), this one about the lines of one parent that carry one
/// category. A shared helper would have to take both meanings and would be right
/// about neither.
fn touches_a_linked_leg(
    write: &rusqlite::Transaction<'_>,
    parent_id: &str,
    source_id: &str,
) -> CoreResult<bool> {
    let touches: i64 = write.query_row(
        "SELECT EXISTS (
           SELECT 1 FROM transaction_splits
            WHERE transaction_id = ?1
              AND category = ?2
              AND linked_transfer_id IS NOT NULL
         )",
        params![parent_id, source_id],
        |record| record.get(0),
    )?;
    Ok(touches != 0)
}

/// Every id one of the loops will walk, in the cloud's `ORDER BY id`.
///
/// Read out in full before the first write rather than held open as a cursor:
/// SQLite's behaviour when a statement's own rows are modified mid-iteration is
/// undefined, and the cloud's `FOR UPDATE` snapshot is not something a cursor
/// here reproduces.
fn collect_ids(
    write: &rusqlite::Transaction<'_>,
    sql: &str,
    owner: &str,
    source_id: &str,
) -> CoreResult<Vec<String>> {
    let mut statement = write.prepare(sql)?;
    let mut ids = Vec::new();
    for id in statement.query_map(params![owner, source_id], |record| {
        record.get::<_, String>(0)
    })? {
        ids.push(id?);
    }
    Ok(ids)
}

/// A write this verb believes must land, and the refusal if it did not.
fn assert_one(changed: usize, what: &str) -> CoreResult<()> {
    if changed == 1 {
        return Ok(());
    }
    Err(CoreError::refuse(
        "merge_row_vanished",
        &format!("{what} disappeared between finding it and writing it"),
    ))
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

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::MergeCategories;

    #[test]
    fn a_null_id_and_an_absent_one_are_both_accepted_by_the_wire() {
        let null: MergeCategories = serde_json::from_str(r#"{"source_id": null}"#)
            .expect("a null id is the RPC's own first case");
        assert!(null.source_id.is_none());
        assert!(null.target_id.is_none());
        let absent: MergeCategories = serde_json::from_str("{}").expect("absent");
        assert!(absent.source_id.is_none());
    }

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<MergeCategories>(r#"{"source":"x"}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("`source`"), "{error}");
    }
}
