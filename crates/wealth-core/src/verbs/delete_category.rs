//! `delete_category` — one category and everything under it, and the one row the
//! file will not let go of.
//!
//! # What it is a port OF
//!
//! `planningService.deleteCategory` (`:633-649`), whose whole body is:
//!
//! ```text
//! .from('categories').delete().eq('id', id).eq('user_id', userId)
//! ```
//!
//! plus a comment saying what the database does next: *"parent_id FK is ON DELETE
//! CASCADE — children go with the parent"*. No RPC; PHASE3-PLAN D-2, and
//! [`super::create_category`] carries the argument for why a table the cloud
//! writes directly still needs a verb here.
//!
//! # AN ID NAMING NOTHING IS NOT AN ERROR
//!
//! There is no `.single()` on that query, so a delete matching no row is a
//! successful call that did nothing — and both of the app's own implementations
//! agree: `DataServiceImpl.deleteCategory`'s local branch writes the list back
//! unchanged. This verb answers `deleted: 0` rather than refusing.
//!
//! That is the opposite of [`super::update_category`], which refuses
//! `category_not_found`, and the difference is not a preference: the update's
//! query ends in `.single()` and this one does not. Two ports of two queries.
//!
//! # THE CASCADE IS SPELLED OUT, AND THE REASON IS THE AUDIT
//!
//! The cloud lets `parent_id ON DELETE CASCADE` take the children. This verb
//! walks the subtree and deletes it DEEPEST FIRST, one row at a time, which
//! leaves the file in the identical state and buys three things a cascade cannot:
//!
//! * **an audit entry per row that went.** A category's delete entry exists so
//!   the row can be reconstructed (`crate::row::category` says so, and
//!   `merge_categories` writes the same entry for the same reason). A cascade
//!   removes rows this verb never saw, and an entry for the parent alone would
//!   claim a group vanished when a tree did.
//! * **a count that is the truth.** `deleted` is every row removed, not just the
//!   one named — the same figure `DataServiceImpl.deleteUnusedCategories` reports
//!   from the size of its own list before and after.
//! * **a refusal in the right place.** See below.
//!
//! The walk carries a cycle guard. `parent_id` has no constraint against a loop
//! in either engine, and a topological walk that trusts the data is a hang
//! waiting to happen — the same reason [`super::delete_unused_categories`]'s
//! `deepest_first` carries one. MEASURED on a planted two-row loop
//! (`tests/category_writes.rs`): the walk terminates, the file loses both rows,
//! and `deleted` reports **one** — because in a cycle there is no "deepest", so
//! the first delete's cascade takes the second row before the walk reaches it.
//! The count degrades to what SQLite's own single-statement DELETE would have
//! said rather than claiming a deletion this verb did not perform, and the row
//! the cascade took carries no entry. That is the price of a file whose parent
//! links form a loop, and the alternative is a log that lies.
//!
//! # C-5, AND THE PROSE THE USER SEES
//!
//! A To/From category is system bookkeeping for its account and the FILE refuses
//! to let one go while the account is there: `trg_protect_transfer_category`,
//! `BEFORE DELETE ON categories`, the port of `protect_transfer_category`
//! (`20260708140000:127-146`). It raises `transfer_category_protected` and the
//! whole call is lost — the row, its siblings, and every entry this verb had
//! written.
//!
//! **This verb does not pre-check it, and that is deliberate.** The protection
//! belongs to the schema in both engines, so refusing here would be a second
//! implementation of C-5 that could disagree with the first — and the one place
//! the two could disagree is the case the trigger was written for. What arrives
//! is `constraint_violated` carrying the trigger's own message, verbatim, which
//! is the seam's rule 4: a refusal's `message` is the prose the user reads, so it
//! must not be prefixed, wrapped or re-worded on its way out.
//!
//! The message is the bare code on both engines. The cloud attaches
//! `HINT = 'Transfer categories are managed automatically from the account. Close
//! the account instead.'` and `handleSupabaseError` shows `error.message`, which
//! is the code without the hint — so what a person sees today is the same string
//! in both editions. SQLite's `RAISE(ABORT, …)` carries one string and cannot
//! hold a second, so the hint has nowhere to ride even if this verb wanted it;
//! putting one on from here would make the local edition's refusal *better
//! worded* than the cloud's for one rule out of forty, which is how a divergence
//! starts. If that sentence is ever wanted it belongs in `schema.sql`'s RAISE, as
//! `split_leg_line_removed`'s already is, and in the cloud's alongside it.
//!
//! The same refusal reaches this verb the long way round, exactly as it reaches
//! the prune: delete a plain category that a To/From row happens to sit under,
//! and the subtree walk finds the protected row and deletes it directly instead
//! of cascading into it. Same refusal, same rollback, same answer as the cloud —
//! MEASURED for the prune on both engines (`probe-prune2.sh`,
//! `probe-prune-sqlite3.mjs`) and asserted for this verb in
//! `tests/category_writes.rs`.
//!
//! # WHAT IT DOES NOT DO
//!
//! It does not re-file what was filed under the category. The seam is explicit:
//! *"Removing a category that transactions still point at leaves those rows
//! pointing at nothing, so the screen that offers this refuses when anything
//! references the category and offers `mergeCategories` instead."* The rule lives
//! on the screen in both editions, `transactions.category` is TEXT with no
//! foreign key (R-3), and `verify_integrity`'s `dangling_category_ref` is what
//! reports the wreckage if a caller ignores it. A verb that refused here would
//! refuse the restore path and the prune as well, both of which legitimately
//! remove categories the schema still has text pointing at.
//!
//! # No guard, measured
//!
//! It deletes from `categories` and nothing else. The cascade reaches
//! `categories` (children, which this verb has already removed) and the two
//! `ON DELETE SET NULL` keys on `transactions.category_id` and
//! `budgets.category_id`; none of the four `trg_protect_split_*` triggers watches
//! `category_id` — they watch `is_split`, `amount_minor`, `type` and `category`.
//! That is [`super::delete_unused_categories`]'s measurement
//! (`probe-prune-sqlite3.mjs`, `c-split-parent-filed-by-uuid`), and
//! `tests/category_writes.rs` asserts the guard table empty across a delete.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::audit::{self, Action};
use crate::db;
use crate::error::CoreResult;
use crate::row::category::{self, CategoryRow};

/// The command. The two arguments the client's `.delete().eq().eq()` carries.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteCategory {
    /// Which category.
    pub id: String,
    /// Whose. Absent names no owner — see [`super::update_transaction`].
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct DeleteCategoryResult {
    /// The count, in the object shape the harness compares a verb on.
    pub answer: DeleteAnswer,
}

/// How much of the tree went.
#[derive(Debug, Serialize)]
pub struct DeleteAnswer {
    /// Every row removed — the category named, and every one under it. Zero
    /// when the id names nothing, which is a successful call.
    pub deleted: i64,
}

/// Remove one category and its descendants.
///
/// # Errors
/// [`CoreError::Refused`](crate::error::CoreError::Refused) when the FILE
/// refuses — C-5's `transfer_category_protected` is the only reachable case, and
/// it loses the whole call; [`CoreError::Storage`](crate::error::CoreError::Storage)
/// for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn delete_category(
    connection: &mut Connection,
    command: DeleteCategory,
) -> CoreResult<DeleteCategoryResult> {
    // BEGIN IMMEDIATE before the first read, as every writing verb here does:
    // the subtree is read and then acted on, and nothing may change between the
    // two. It is also what makes the C-5 refusal roll the whole tree back rather
    // than half of it.
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let owner = command.user_id.as_deref();

    let Some(named) = category::read_owned(&write, &command.id, owner)? else {
        // An id naming nothing, or naming somebody else's category. Not an
        // error: see the module docs.
        write.commit()?;
        return Ok(DeleteCategoryResult {
            answer: DeleteAnswer { deleted: 0 },
        });
    };

    let now = db::now(&write)?;
    let mut deleted = 0_i64;

    for row in subtree(&write, named)? {
        // Scoped by owner again, not because the subtree read left a gap — it
        // did not — but because a DELETE that names one id and no owner is one
        // edit away from being a DELETE that names none.
        let removed = write.execute(
            "DELETE FROM categories WHERE id = ?1 AND (?2 IS NULL OR user_id = ?2)",
            params![row.id, owner],
        )?;
        if removed == 0 {
            // Unreachable: the row was read inside this transaction and nothing
            // else holds the write lock. Counted rather than asserted, so a
            // future shape that broke that reasoning degrades to an honest
            // count instead of an entry for a deletion that did not happen.
            continue;
        }
        audit::write(
            &write,
            &row.user_id,
            "category",
            &row.id,
            Action::Delete,
            Some(&super::json_of(&row)?),
            None,
            &now,
        )?;
        deleted = deleted.saturating_add(super::count(removed)?);
    }

    write.commit()?;

    Ok(DeleteCategoryResult {
        answer: DeleteAnswer { deleted },
    })
}

/// The named category and everything under it, DEEPEST FIRST.
///
/// A breadth-first walk down `parent_id`, reversed — which puts every child
/// before its parent without a recursive CTE and without trusting the data to be
/// a tree. `seen` is the cycle guard: `parent_id` has no constraint against a
/// loop, and a walk that assumed one would hang on a file that has been through
/// a bad restore rather than reporting it.
///
/// Deliberately NOT scoped by owner, and for [`crate::row::category::has_children`]'s
/// reason: the cloud's cascade is not scoped either, so a child belonging to
/// somebody else still goes with its parent. Scoping the walk would leave that
/// child behind with a parent that no longer exists, un-auditied and invisible —
/// the file's own key would remove it anyway.
fn subtree(
    write: &rusqlite::Transaction<'_>,
    named: CategoryRow,
) -> CoreResult<Vec<CategoryRow>> {
    let mut seen: HashSet<String> = HashSet::new();
    seen.insert(named.id.clone());
    let mut order = vec![named];

    let mut cursor = 0_usize;
    while let Some(row) = order.get(cursor) {
        let parent = row.id.clone();
        // `saturating_add` rather than `+=` for the reason the whole crate
        // avoids bare arithmetic: an overflow here would be a silent wrap into a
        // loop, and a cursor that stops advancing at `usize::MAX` stops the walk
        // instead. Unreachable on any file a person owns.
        cursor = cursor.saturating_add(1);
        for child in children_of(write, &parent)? {
            if seen.insert(child.id.clone()) {
                order.push(child);
            }
        }
    }

    order.reverse();
    Ok(order)
}

/// One generation, in id order so the walk is deterministic.
fn children_of(
    write: &rusqlite::Transaction<'_>,
    parent_id: &str,
) -> CoreResult<Vec<CategoryRow>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH categories USING INDEX idx_categories_parent (parent_id=?)
    let mut statement = write.prepare("SELECT id FROM categories WHERE parent_id = ?1 ORDER BY id")?;
    let ids = statement
        .query_map(params![parent_id], |record| record.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut rows = Vec::with_capacity(ids.len());
    for id in ids {
        // Read whole, because the audit entry is the row: `read_owned` with no
        // owner named is "this id, whoever holds it", which is what the cascade
        // reaches.
        if let Some(row) = category::read_owned(write, &id, None)? {
            rows.push(row);
        }
    }
    Ok(rows)
}
