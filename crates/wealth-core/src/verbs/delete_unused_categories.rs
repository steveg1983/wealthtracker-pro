//! `delete_unused_categories` — the Money-set "replace" import's bulk prune.
//!
//! # What it is a port OF
//!
//! The **live** definition, `20260713100000:320-363`. Traced by grep across every
//! migration: defined twice, and only the newer counts — `20260708160000:24-63`
//! is the original and `20260713100000` recreates it verbatim with one addition,
//! the `transaction_splits` guard, which its own comment explains
//! (`:314-318`). Nothing after that redefines it; `20260725120000:323` only
//! re-grants it. The client calls it at exactly one place,
//! `planningService.ts:511`, from one caller, `AppContextSupabase.tsx:1370`.
//!
//! # It has NO refusal of its own, and that is the design
//!
//! Every protection is a `WHERE` clause, not a `RAISE`. A row that fails any
//! check is skipped in silence and the function returns how many rows it actually
//! removed. MEASURED across twenty cases on the reference cluster
//! (`scratchpad/local-core/probe-prune1.sh`, `probe-prune2.sh`, 2026-08-08): not
//! one of them produced an exception from the function itself.
//!
//! That is deliberate and the migration says so: the client *plans* the prune
//! from a snapshot that may be stale, and the RPC re-verifies every row so *"a
//! stale client can never destroy referenced data"*. A refusal would lose the
//! whole batch because one category in it acquired a transaction while the user
//! was looking at the dialog.
//!
//! ```text
//! level = 'type'                       skipped
//! is_transfer_category                 skipped
//! referenced by a transaction          skipped
//! referenced by a split line           skipped
//! referenced by a budget               skipped
//! referenced by a recurring template   skipped
//! has a child OUTSIDE the batch        skipped
//! ```
//!
//! ## Which is not to say it cannot refuse
//!
//! One shape makes it raise, and the refusal comes from the FILE rather than
//! from the function. Name a prunable category AND a To/From category that sits
//! under it: the To/From row is skipped by `is_transfer_category`, but being *in
//! the batch* it no longer keeps its parent alive, so the parent is deleted and
//! `parent_id ON DELETE CASCADE` takes the protected row with it — into C-5's
//! `BEFORE DELETE` trigger, which raises.
//!
//! ```text
//! postgres   parent + its To/From child, both named  -> ERROR transfer_category_protected
//! sqlite     the same                                -> ERROR transfer_category_protected
//! sqlite     the same, holding _rpc_guard('split')   -> ERROR transfer_category_protected
//! ```
//!
//! (MEASURED: `probe-prune2.sh` `p2-parent-and-transfer-child-both-named`,
//! `probe-prune-sqlite3.mjs` `c-parent-and-transfer-child`.) Both engines lose
//! the whole call and nothing is deleted, which is the right outcome and the
//! same outcome. The guard row in the third line is there to record that no flag
//! in `_rpc_guard` stands C-5 down: it is a protection, not a nuisance, and the
//! verb does not try.
//!
//! # THE HOLE, measured and reproduced rather than quietly fixed
//!
//! The migration's promise — *"a stale client can never destroy referenced
//! data"* — is FALSE in one shape, on both engines, and the local port
//! reproduces it exactly:
//!
//! ```text
//! parent P and child C both named, C referenced by a transaction
//!   postgres  -> returns 1, C is GONE, the transaction's category text dangles
//!   sqlite    -> returns 1, C is GONE, the transaction's category text dangles
//! ```
//!
//! C's own check skips it; P's "child outside the batch" check passes *because C
//! is in the batch*; P is deleted; the cascade takes C. The same is true three
//! generations deep (`p2-grandchild-referenced-parents-named` → 2, grandchild
//! gone). It is not fixed here for the reason `merge_categories` gives about what
//! it leaves behind: a local port that tidied it would do something the cloud
//! does not, and the two would no longer be implementations of one verb. What the
//! local edition does instead is REPORT it —
//! [`super::verify_integrity`]'s `dangling_category_ref` is exactly this
//! wreckage, and the spec that plants it says so.
//!
//! The same hole eats a *budget's* uuid reference
//! (`p2-cascade-eats-a-budgeted-child`: `category` text dangles,
//! `category_id` nulled by the key) and, without any cascade at all, a
//! transaction filed through `category_id` alone
//! (`p-used-by-transaction-uuid-only` → deleted, column nulled): the transaction
//! check is on the TEXT column only, while the budget check reads both. That
//! asymmetry is in the cloud's own WHERE clause and travels with it.
//!
//! # The one thing the port could NOT do the cloud's way
//!
//! The cloud is a single `DELETE … WHERE id = ANY(p_ids) AND …` and returns
//! `ROW_COUNT`. Spelled that way locally it gives a DIFFERENT NUMBER for the same
//! file:
//!
//! ```text
//! parent + child, both named, both prunable
//!   postgres        -> 2
//!   sqlite, one DELETE -> 1     (same six categories left; different answer)
//! three generations, all named
//!   postgres        -> 3
//!   sqlite, one DELETE -> 1
//! ```
//!
//! (MEASURED, `probe-prune-sqlite.mjs`.) Postgres decides which rows to delete
//! from one snapshot and counts each; SQLite scans, deletes the parent, the
//! cascade removes the child, and by the time the scan reaches the child there is
//! nothing there to count. The FILE ends up identical either way — this is a
//! disagreement about the answer, not about the ledger — but the answer is what
//! the import summary shows the user.
//!
//! So the port qualifies the rows FIRST (the cloud's WHERE, as a SELECT), then
//! deletes them one at a time, **deepest first**, so no cascade can ever
//! pre-empt a row this call is going to count. Every one of the twenty measured
//! cases then matches the cloud, including the refusal
//! (`probe-prune-sqlite3.mjs`).
//!
//! Deepest-first is safe rather than lucky: a named row can only be a descendant
//! of another named row if every category between them is named too, because an
//! unnamed intermediate would be a "child outside the batch" and would disqualify
//! the ancestor. [`deepest_first`] carries the cycle guard anyway —
//! `parent_id` has no constraint against a loop, and a topological walk that
//! trusts the data is a hang waiting to happen.
//!
//! # It audits nothing, and that is a decision rather than an oversight
//!
//! The cloud writes no audit row here — MEASURED, `probe-prune1.sh`
//! `p-plain-unused`: `financial_audit_log` is empty afterwards — and this port
//! writes none either. The argument for adding one is real and is recorded so
//! nobody has to reconstruct it: the cloud's own newer `merge_categories` audits
//! a category delete (`20260805214322:382-384`, `entity 'category'`), so the
//! event has an established shape, and PHASE1-PLAN §2.2 sets a precedent for the
//! local edition FIXING an audit gap the cloud has.
//!
//! It is not taken here, for three reasons in increasing order of weight:
//!
//! 1. Every row this verb deletes is, by its own precondition, referenced by
//!    nothing. No figure moved and nothing was re-filed; there is no "what
//!    changed that number" for the entry to answer.
//! 2. §2.2's precedent cost nothing because budgets and goals have no verb yet.
//!    Here it would cost the differential comparison: every spec would carry a
//!    declared divergence, and a family of divergences is how a real one gets
//!    missed.
//! 3. `merge_categories` audits its delete because that delete is the tail of a
//!    chain of moves the entry's `before` explains. This one has no chain.
//!
//! If it is ever added, it must be a DECLARED divergence in DESIGN.md §5 and not
//! a quiet improvement.
//!
//! # The guard: none, and measured so
//!
//! The verb touches `categories` only. The cascade reaches `categories` (children)
//! and the two `ON DELETE SET NULL` keys on `transactions.category_id` and
//! `budgets.category_id`. None of the four `trg_protect_split_*` triggers watches
//! `category_id` — they watch `is_split`, `amount_minor`, `type` and `category` —
//! so nulling a SPLIT PARENT's `category_id` is not examined at all. MEASURED
//! (`probe-prune-sqlite3.mjs`, `c-split-parent-filed-by-uuid`: accepted, column
//! nulled, no guard held).

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;

/// The command. `(p_ids, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteUnusedCategories {
    /// `p_ids`. Absent, null and empty are the same request and the same answer:
    /// zero. MEASURED on the cloud (`p-null-array`, `p-empty-array`), where
    /// `id = ANY(NULL)` and `id = ANY('{}')` both match nothing.
    #[serde(default)]
    pub ids: Option<Vec<String>>,
    /// `p_user_id`. Absent means "name no owner", and the cloud then reaches
    /// EVERY login's categories — MEASURED (`p-no-owner-named-reaches-everyone`:
    /// a stranger's category deleted). Passed through rather than required, for
    /// the reason [`super::user_financial_data_is_empty`] gives: in the cloud RLS
    /// has already narrowed what the caller can see, and in a single-login file
    /// the two readings are the same answer.
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct DeleteUnusedCategoriesResult {
    /// The projection both engines are compared on. The RPC returns a bare
    /// integer; this is that integer, in the object shape the harness reads.
    pub answer: PruneAnswer,
}

/// The RPC's return value.
#[derive(Debug, Serialize)]
pub struct PruneAnswer {
    /// How many categories this call removed BY NAME. Rows that disappeared as
    /// a cascade of one of them are not counted — that is what `ROW_COUNT`
    /// counts in the cloud, and the module docs carry the measurement.
    pub deleted: i64,
}

/// One row that qualifies for deletion, and the link that decides its turn.
struct Doomed {
    id: String,
    parent_id: Option<String>,
}

/// Prune the categories that nothing refers to.
///
/// # Errors
/// [`CoreError::Refused`] when the FILE refuses — the only reachable case is
/// C-5's `transfer_category_protected`, through the cascade, and it loses the
/// whole call on both engines. [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn delete_unused_categories(
    connection: &mut Connection,
    command: DeleteUnusedCategories,
) -> CoreResult<DeleteUnusedCategoriesResult> {
    let named = command.ids.clone().unwrap_or_default();
    if named.is_empty() {
        return Ok(DeleteUnusedCategoriesResult {
            answer: PruneAnswer { deleted: 0 },
        });
    }

    // BEGIN IMMEDIATE before the first read, as every writing verb here does:
    // the qualifying set is read and then acted on, and nothing may change
    // between the two. It is also what makes the C-5 refusal roll the whole
    // batch back rather than half of it.
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let owner = command.user_id.as_deref();

    let doomed = qualifying(&write, &named, owner)?;

    let mut deleted = 0_i64;
    for row in deepest_first(&doomed) {
        // Scoped by owner again, not because the qualifying read left a gap —
        // it did not — but because a DELETE that names one id and no owner is
        // one edit away from being a DELETE that names none.
        let removed = write.execute(
            "DELETE FROM categories WHERE id = ?1 AND (?2 IS NULL OR user_id = ?2)",
            params![row.id, owner],
        )?;
        // Counted, not asserted. Deepest-first means nothing should have taken
        // the row first — but if some future shape breaks that reasoning, the
        // count degrades to exactly what SQLite's own single-statement DELETE
        // would have said, rather than reporting a deletion that did not happen.
        deleted = deleted.saturating_add(super::count(removed)?);
    }

    write.commit()?;

    Ok(DeleteUnusedCategoriesResult {
        answer: PruneAnswer { deleted },
    })
}

/// The cloud's `WHERE` clause, asked as a question instead of an instruction.
///
/// Every `NOT EXISTS` is the RPC's, in the RPC's order, and two of them are
/// deliberately NOT scoped the way a reader expects:
///
/// * `recurring_transactions` is matched on the category id ALONE, because the
///   cloud's is (`20260713100000:349-352`). MEASURED
///   (`p-used-by-recurring-of-a-stranger`): another login's template saves the
///   category. The migration's own reasoning is that a category id is a globally
///   unique uuid, so matching on it can only reach rows that mean this category.
/// * `transactions` and `transaction_splits` ARE scoped to the category's owner,
///   so a stranger's row filed under it does NOT save it — MEASURED
///   (`p2-strangers-transaction-does-not-save-it`, and the split twin). The
///   asymmetry is the cloud's and it travels with the port.
///
/// The child check reads `NOT IN (the batch)`, which is `NOT (ch.id = ANY(p_ids))`
/// spelled for SQLite. A NULL id cannot occur — `categories.id` is the primary
/// key — so the three-valued trap `NOT IN` normally carries is unreachable here.
fn qualifying(
    write: &rusqlite::Transaction<'_>,
    named: &[String],
    owner: Option<&str>,
) -> CoreResult<Vec<Doomed>> {
    // The named set, once each, in id order. `id = ANY(p_ids)` matches each row
    // once however many times its id appears — MEASURED (`p-same-id-twice` → 1) —
    // which is what the shared `distinct_ids` reproduces.
    let distinct: Vec<&str> = super::distinct_ids(named).into_iter().collect();
    // `?1` is the owner, so the ids start at `?2`.
    let placeholders = (2..=distinct.len().saturating_add(1))
        .map(|position| format!("?{position}"))
        .collect::<Vec<_>>()
        .join(", ");

    let sql = format!(
        "SELECT c.id, c.parent_id
           FROM categories c
          WHERE c.id IN ({placeholders})
            AND (?1 IS NULL OR c.user_id = ?1)
            AND c.level <> 'type'
            AND c.is_transfer_category <> 1
            AND NOT EXISTS (SELECT 1 FROM transactions t
                             WHERE t.user_id = c.user_id AND t.category = c.id)
            AND NOT EXISTS (SELECT 1 FROM transaction_splits s
                             WHERE s.user_id = c.user_id AND s.category = c.id)
            AND NOT EXISTS (SELECT 1 FROM budgets b
                             WHERE b.user_id = c.user_id
                               AND (b.category = c.id OR b.category_id = c.id))
            AND NOT EXISTS (SELECT 1 FROM recurring_transactions r
                             WHERE r.category = c.id)
            AND NOT EXISTS (SELECT 1 FROM categories ch
                             WHERE ch.parent_id = c.id
                               AND ch.id NOT IN ({placeholders}))
          ORDER BY c.id"
    );

    let mut statement = write.prepare(&sql)?;
    let mut bound: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(distinct.len().saturating_add(1));
    bound.push(&owner);
    for id in &distinct {
        bound.push(id);
    }

    let rows = statement.query_map(bound.as_slice(), |record| {
        Ok(Doomed {
            id: record.get(0)?,
            parent_id: record.get(1)?,
        })
    })?;

    let mut doomed = Vec::new();
    for row in rows {
        doomed.push(row?);
    }
    Ok(doomed)
}

/// Descendants before ancestors, so a cascade never removes a row this call is
/// about to delete and count.
///
/// Depth is measured WITHIN the qualifying set: a parent outside it cannot be
/// deleted by this call, so it cannot pre-empt anything. Ties break on id, which
/// is the order [`qualifying`] already returns and the order the cloud's own
/// answer is insensitive to.
///
/// The `seen` set is a cycle guard. `categories.parent_id` has no constraint
/// forbidding a loop in either engine — `parent_id <> id` is not even checked —
/// and a walk that trusts the data would hang on a file somebody edited with a
/// SQLite browser. A row in a cycle gets whatever depth the walk reached before
/// it closed, which is arbitrary and harmless: every member of a cycle is
/// mutually an ancestor, so no order is more correct than another.
fn deepest_first(doomed: &[Doomed]) -> Vec<&Doomed> {
    let depth_of = |start: &Doomed| -> usize {
        let mut seen = std::collections::BTreeSet::from([start.id.as_str()]);
        let mut steps = 0_usize;
        let mut current = start;
        while let Some(parent) = current.parent_id.as_deref() {
            let Some(next) = doomed.iter().find(|row| row.id == parent) else {
                break;
            };
            if !seen.insert(next.id.as_str()) {
                break;
            }
            current = next;
            steps = steps.saturating_add(1);
        }
        steps
    };

    let mut ordered: Vec<(usize, &Doomed)> = doomed.iter().map(|row| (depth_of(row), row)).collect();
    ordered.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.id.cmp(&right.1.id)));
    ordered.into_iter().map(|(_, row)| row).collect()
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{deepest_first, DeleteUnusedCategories, Doomed};

    fn row(id: &str, parent: Option<&str>) -> Doomed {
        Doomed {
            id: id.to_owned(),
            parent_id: parent.map(ToOwned::to_owned),
        }
    }

    fn order(rows: &[Doomed]) -> Vec<String> {
        deepest_first(rows)
            .into_iter()
            .map(|row| row.id.clone())
            .collect()
    }

    #[test]
    fn a_child_is_deleted_before_its_parent() {
        assert_eq!(order(&[row("a", None), row("b", Some("a"))]), ["b", "a"]);
    }

    #[test]
    fn three_generations_come_out_deepest_first() {
        let rows = [row("a", None), row("b", Some("a")), row("c", Some("b"))];
        assert_eq!(order(&rows), ["c", "b", "a"]);
    }

    #[test]
    fn a_parent_outside_the_set_does_not_count_as_depth() {
        // Both are leaves as far as this call is concerned, so id order stands.
        let rows = [row("b", Some("nobody")), row("a", Some("nobody"))];
        assert_eq!(order(&rows), ["a", "b"]);
    }

    #[test]
    fn a_cycle_terminates_instead_of_hanging() {
        let rows = [row("a", Some("b")), row("b", Some("a"))];
        assert_eq!(order(&rows).len(), 2);
    }

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<DeleteUnusedCategories>(r#"{"category_ids":["a"]}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("`category_ids`"), "{error}");
    }

    #[test]
    fn an_absent_list_and_a_null_list_are_the_same_request() {
        let absent: DeleteUnusedCategories = serde_json::from_str("{}").unwrap();
        let null: DeleteUnusedCategories = serde_json::from_str(r#"{"ids":null}"#).unwrap();
        assert!(absent.ids.is_none() && null.ids.is_none());
    }
}
