//! The command surface. One verb, one SQLite transaction, one or more audit
//! rows.
//!
//! # What is deliberately absent
//!
//! * **`set_account_balance`.** DESIGN.md §6.5: *"Note what is absent:
//!   `set_account_balance`. Deliberately. B-2."* Balance moves only as
//!   `balance = balance ± delta`, in SQL, inside a verb that also writes the row
//!   that justifies the delta. There is no way to set an absolute figure because
//!   there is no function that takes one.
//! * **Anything that accepts SQL.** DESIGN.md §6.4: *"Not a policy — an absence.
//!   There is no command that accepts a SQL string. You cannot bypass what does
//!   not exist."*
//! * **`create_category`, `update_category`, `delete_category`.** Not an
//!   omission — the cloud has no such RPC. `PlanningService` writes the table
//!   directly (`planningService.ts:479`, `:567`, `:638`), so the authority for
//!   those operations is the table and its constraints, and `schema.sql` already
//!   carries every one of them. A verb here would be a port of nothing.
//! * **The transfer-category lifecycle.** `create_transfer_category_for_account`,
//!   `sync_transfer_category_for_account` and `protect_transfer_category`
//!   (`20260708140000`) all `RETURN trigger`; nothing calls them as functions.
//!   They are C-3, C-4 and C-5 in `schema.sql`.
//!
//! # `migrate_categories_atomic` — OUT OF SCOPE, and this is the decision
//!
//! It was recorded here as *"needs a decision about what it would even do before
//! it needs a port"*. This is that decision: **it is not ported, and it should
//! not be.** Traced first, because "vestigial" would have been a much easier
//! answer and it is not the true one.
//!
//! **It is live.** `planningService.ts:446`, from `ensureCategories`, called
//! whenever a signed-in user's cloud category table is empty. Its live definition
//! is `20260724100000:48-136`, the third of three (`20260611100000:36`,
//! `20260723190000:54`), each recreating the previous one with one more column.
//!
//! **What it does** is four passes over a category tree the CLIENT is holding:
//! mint a fresh uuid for every incoming id (pass 1), insert every row under its
//! new id with `parent_id` deliberately NULL (pass 2), wire the parents through
//! the map (pass 3), and then rewrite `transactions.category` and
//! `budgets.category` through the same map (pass 4). It refuses with
//! `categories_already_migrated` if the user has any category at all.
//!
//! **Why it exists**: the localStorage era gave categories ids like `'food'` and
//! `'transfer-out'`, and the cloud's `categories.id` is a uuid. The function is
//! the one-way door between those two id spaces, and pass 4 is the whole point —
//! the references have to move in the same transaction as the rows, or a
//! half-migrated user has transactions filed under ids nothing answers to.
//!
//! **Why a local file never needs it**: there is no second id space. A local file
//! mints its own uuids at creation, and the two ways a category tree can arrive
//! in one are both already covered by verbs that exist and are proven:
//!
//! * a **restore** — [`restore_user_chunk`] inserts categories under the ids the
//!   backup carries, verbatim, and X-9 puts any remapping on the client, before a
//!   single row is sent (`crate::backup` carries that argument);
//! * a **seed** — a brand-new file's default set is inserted under ids the local
//!   edition generates, so there is nothing to remap and nothing to be atomic
//!   about beyond the insert itself. `categories` has no create/update/delete
//!   verb precisely because the cloud has none either; the table and its
//!   constraints are the authority.
//!
//! Porting it anyway would put a **second** category-tree writer in the crate,
//! one whose only distinguishing behaviour — the id remap — is a translation
//! between two id spaces the local edition does not have. Its idempotency guard
//! would then be the only part still doing work, and that guard is
//! [`user_financial_data_is_empty`]'s question asked about one table.
//!
//! The one thing that WOULD change this: a cloud→local migration path, where a
//! user's cloud tree is pulled into a fresh file. That is DESIGN.md §9.1's
//! explicitly out-of-scope *"cloud↔local sync"*, and if it is ever built it wants
//! `migrate_categories_atomic`'s shape rather than its code, because the
//! direction of travel is reversed and the id space that needs remapping is the
//! destination's.
//!
//! # Deliberately not done YET, and named so nobody has to re-derive it
//!
//! Nothing in the category family is now outstanding.
//! [`delete_unused_categories`] — the Money-set "replace" import's bulk prune,
//! `planningService.ts:511` — was the last of the two named here, and it is
//! ported. What it found is worth reading before touching it: the RPC has no
//! refusal of its own, the FILE has one anyway through C-5, the "a stale client
//! can never destroy referenced data" promise has a measured hole in it that the
//! port reproduces on purpose, and the cloud's single-statement DELETE cannot be
//! spelled as a single statement locally without changing the number it returns.
//!
//! # An obligation recorded before the verb that needs it existed — now DONE
//!
//! `scripts/local-sqlite/specs/r5-split-leg-links-are-set-null-never-cascaded.spec.mjs`
//! measured this and PHASE1-PLAN's addendum §A carries it: SQLite applies
//! `ON DELETE SET NULL` as an UPDATE of the child row, and that UPDATE fires
//! `trg_protect_linked_leg`, which raises `split_leg_locked`. So **every** path
//! that deletes a transaction a split line links to — the delete verb, the
//! duplicate sweep, the wipe, the restore's pre-clear, the transfer-unlink
//! repair — must hold `_rpc_guard('leg')` for the duration of the delete:
//!
//! ```sql
//! BEGIN IMMEDIATE;
//! INSERT OR IGNORE INTO _rpc_guard VALUES ('leg');  -- iff a split leg is touched
//! DELETE FROM transactions WHERE id = ?;
//! DELETE FROM _rpc_guard WHERE flag = 'leg';
//! COMMIT;
//! ```
//!
//! The trap it closes: the error the user is shown says *"delete that transfer
//! first, then edit the split"*, and without the guard that remedy is itself
//! refused.
//!
//! [`delete_transaction`] discharges this for the delete path, and while doing
//! so found the **second** direction the addendum had not seen — a split parent
//! whose own line is a leg, where the cascade fires
//! `trg_protect_linked_leg_delete` instead. Its module documentation is the
//! record. `delete_transaction::touches_a_transfer_leg` is the condition the
//! other paths should reuse rather than re-derive — and the two paragraphs below
//! are what became of the four that were still owing when it was written.
//!
//! `create_transaction` and `update_transaction` delete no transaction, so
//! neither carries the guard — and `update_transaction` deliberately does not
//! hold `_rpc_guard('split')` either; see its module documentation.
//!
//! Of the four remaining paths, **the transfer-unlink repair is now settled**:
//! [`clear_transfer_links`] and [`repair_claimed_transfer`] between them are the
//! whole of that path, and neither deletes a transaction — the unlink is an
//! UPDATE of `linked_transfer_id` and the repair is three UPDATEs. So the
//! obligation does not apply to them, which is a better outcome than discharging
//! it.
//!
//! **The wipe and the restore's pre-clear are the same path**, and it is now
//! discharged too: [`wipe_user_financial_data`] IS the pre-clear a restore
//! demands, and it holds `_rpc_guard('leg')` conditionally, on the same condition
//! [`delete_transaction`] uses. Its module documentation carries the measurement.
//! One path is left owing the guard: the duplicate sweep.
//!
//! Discharging it also found the half of the obligation that was about the
//! SCHEMA rather than about a verb. `trg_unnest_account_references` nulls
//! `transfer_account_id` in a BEFORE DELETE trigger — a workaround for SQLite
//! having no `ON DELETE SET NULL (column)` — which leaves a linked row
//! half-cleared for one statement, and `transactions_linked_has_target` (a CHECK
//! this schema has and the cloud does not) refuses that state. No guard could
//! have helped: the refusal is a CHECK, not a trigger. So "delete everything" was
//! refused outright on any file holding one linked transfer, and the repair is in
//! `schema.sql` rather than in a verb.
//!
//! # Which guard belongs to which verb — settled by measurement
//!
//! [`set_transaction_splits_with_legs`], the verb the guard mechanism was built
//! for, turns out to need only **one** of the two:
//!
//! | verb | `split` | `leg` |
//! | --- | --- | --- |
//! | [`create_transaction`] | no | no |
//! | [`update_transaction`] | no — deliberately; holding it would make it a split writer | no |
//! | [`delete_transaction`] | no | **conditionally** — both directions, R-5 |
//! | [`set_transaction_splits_with_legs`] | **always** — it IS the split writer | no, and proven so |
//! | [`link_transfer_pair`] | no | no |
//! | [`create_transfer_counterpart`] | no | no |
//! | [`clear_transfer_links`] | no | no |
//! | [`repair_claimed_transfer`] | no | no |
//! | [`link_split_line_transfer`] | no | no, and proven so |
//! | [`merge_categories`] | no — the CASE keeps a split parent's category blank | **conditionally** — it re-files split lines |
//! | [`apply_category_to_uncategorized`] | **no, and it must not** — see below | no |
//! | [`confirm_transaction_categories`] | no, and structurally so | no |
//! | [`user_financial_data_is_empty`] | no — it opens no transaction and writes nothing | no |
//! | [`wipe_user_financial_data`] | no | **conditionally** — the pre-clear, R-5 |
//! | [`restore_user_chunk`] | no, and proven so on BOTH engines | no |
//! | [`finalize_user_restore`] | no | no |
//! | [`link_bank_account_snap`] | no, and proven so | no |
//! | [`delete_unused_categories`] | no, and proven so — it deletes a category, and the cascade's only writes are `category_id` columns nothing watches | no |
//! | [`verify_integrity`] | no — it opens no transaction and writes nothing | no |
//!
//! The restore family adds a **third** flag to the table, which the first twelve
//! verbs never needed: `_rpc_guard('restore')`, held by
//! [`finalize_user_restore`] alone. It is the twin of the cloud's
//! `app.restore_in_progress` session flag, and it is the only flag in the schema
//! that stands down a *convenience* rather than a *protection* — the `updated_at`
//! triggers exist to stamp a timestamp on a row whose writer did not, and a
//! restore is precisely the writer that did. That difference is why it is the one
//! flag held unconditionally.
//!
//! The split writer's own module documentation carries the proof: every write it
//! makes to a *linked* line changes only `memo`, `sort_order` and `updated_at`,
//! which is exactly the set `trg_protect_linked_leg` does not watch, and the
//! leg-removal refusal fires before the DELETE, so
//! `trg_protect_linked_leg_delete` has nothing to fire on. Standing S-9 and S-10
//! down for the duration of the largest write in the schema — the one moment they
//! are most worth having — would have been the easy mistake, and it is a mistake
//! only because the triggers were measured rather than assumed.
//!
//! ## The transfer family's answer, and why it is not an assumption either
//!
//! Five verbs in a row needing **no** guard looks like a table nobody checked.
//! Each has a different reason and each was checked:
//!
//! * [`link_transfer_pair`], [`create_transfer_counterpart`] and
//!   [`repair_claimed_transfer`] write `type` and `category`, which
//!   `trg_protect_split_type` and `trg_protect_split_category` watch — but only
//!   `WHEN OLD.is_split = 1`, and all three refuse a split row *before* their
//!   first write. The refusal ORDER is what makes the guard unnecessary, which
//!   is a slightly alarming dependency and is why it is written down here.
//! * [`clear_transfer_links`] writes `linked_transfer_id` and `updated_at`, and
//!   every split guard is `BEFORE UPDATE OF <column>` over a column list that
//!   contains neither. Its writes are not merely permitted — they are not
//!   *examined*.
//! * [`link_split_line_transfer`] is the interesting one, because it does write
//!   to `transaction_splits`. `trg_protect_linked_leg` fires
//!   `WHEN OLD.linked_transfer_id IS NOT NULL`, and the verb refuses
//!   `split_line_already_linked` before touching the line — so the trigger is
//!   consulted and stands down. `tests/transfer_family.rs` proves that
//!   behaviourally, with the guard table asserted empty for the whole call.
//!
//! The general lesson the splits verb wrote down holds in both directions: the
//! guard a verb needs is a fact about the triggers and the verb's own refusal
//! order, and it has to be measured for each one. Four of these five were
//! measured to need nothing; the fifth was the one that looked most likely to
//! need something and needs nothing, for a reason that only shows up when you
//! read the trigger's WHEN clause against the verb's refusal list.
//!
//! ## The category family, and the R-5 trap turning up somewhere new
//!
//! Nine verbs in and the table had exactly one "yes" outside the split writer.
//! [`merge_categories`] is the second, and it was found the same way — by running
//! the write against the file rather than reasoning about it:
//!
//! * The merge re-files `transaction_splits.category`. In the cloud the
//!   linked-leg rules are PROCEDURAL, inside `set_transaction_splits_with_legs`,
//!   so nothing watches that column. Locally `schema.sql` turned them into
//!   TRIGGERS on purpose — *"so a future code path that forgets them still cannot
//!   break the pair"* — and `category` is one of the four columns
//!   `trg_protect_linked_leg` watches. MEASURED: Postgres re-files a **linked**
//!   leg happily; SQLite raises `split_leg_locked`. Without the guard the local
//!   edition would refuse a merge the cloud performs, for the commonest split
//!   shape in the owner's own data.
//! * The same verb also writes `transactions.category` for split parents and does
//!   **not** need `split`, because its `CASE` leaves a split parent's blank
//!   category blank. That was measured both ways rather than reasoned: the
//!   trigger IS consulted, and stands down.
//!
//! [`apply_category_to_uncategorized`] is the first verb where holding a guard
//! would be actively wrong. It stamps a category onto blank rows, and a split
//! parent's category is blank BY DESIGN — so `trg_protect_split_category` raises
//! `split_category_locked` and the whole call is lost. That is what the LIVE
//! cloud function does too (its `AND NOT is_split` was dropped by a rebase; the
//! verb's own documentation carries the evidence), so the local refusal is a
//! faithful port. `_rpc_guard('split')` would make the local edition silently
//! succeed where the cloud fails, which is a divergence dressed as a fix.
//!
//! ## The restore family, and a guard the cloud appears to need and does not
//!
//! [`restore_user_chunk`] is the one that looks most like it should hold
//! something: the RPC opens with `set_config('app.split_rpc', '1', true)` and its
//! comment says *"whitelists the split guard for this transaction so restored
//! split parents can carry is_split = true"*. MEASURED on the reference cluster,
//! by listing the triggers rather than reading the comment: every split
//! protection in the cloud is `BEFORE UPDATE` —
//! `trg_protect_split_transaction_fields` and `trg_sweep_reconciled_into_archive`
//! both — and a restore only ever INSERTs. The same is true here, where all four
//! `trg_protect_split_*` triggers are `BEFORE UPDATE OF`. So the answer is
//! *none*, on both engines, and the cloud's `set_config` is belt-and-braces
//! rather than a rule this port would have missed. Copying it would have meant
//! standing S-5 down for the largest INSERT in the product on the strength of a
//! comment.
//!
//! [`wipe_user_financial_data`] is the opposite case and the reason the guard
//! question is asked per verb: it holds nothing that a reading of its SQL would
//! suggest — it issues ten DELETEs and touches no split column — and it needs
//! `leg` anyway, because the cascade from `accounts` reaches
//! `transaction_splits` and `trg_protect_linked_leg_delete` fires there.
//!
//! ## The prune, and a protection no guard may stand down
//!
//! [`delete_unused_categories`] is the third deleting verb, and the guard
//! question has a new shape here: its cascade reaches a category the schema
//! PROTECTS. Name a prunable parent and a To/From category sitting under it, and
//! `parent_id ON DELETE CASCADE` walks the protected row straight into C-5's
//! `BEFORE DELETE` trigger. MEASURED on both engines, and the local answer is
//! `transfer_category_protected` on both — including with `_rpc_guard('split')`
//! held, which changes nothing, because C-5 has no guard clause and must not
//! acquire one. That is the difference between this and the R-5 leg trap: R-5's
//! refusal blocked the remedy the error message itself recommended, so standing
//! it down was the fix; here the refusal IS the answer, the cloud gives the same
//! answer, and both engines lose the whole batch. The verb holds nothing.
//!
//! [`verify_integrity`] is outside the table's premise entirely — it is the
//! second read-only verb in the crate — and it is the one place where the guard
//! table itself is a subject rather than a tool: `schema.sql` records that a
//! stray `_rpc_guard` row is impossible because the flag is set and cleared
//! inside the transaction it authorises, "and verify_integrity() reports one
//! anyway". It does not yet: no check in `v_integrity_violations` looks at
//! `_rpc_guard`. Recorded here rather than fixed, because a check for a row that
//! cannot exist needs a way to be planted before it can be proved, and every
//! route to one goes through a crash mid-transaction that this harness has no
//! way to stage.

mod apply_category_to_uncategorized;
mod clear_transfer_links;
mod confirm_transaction_categories;
mod create_transaction;
mod create_transfer_counterpart;
mod delete_transaction;
mod delete_unused_categories;
mod finalize_user_restore;
mod link_bank_account_snap;
mod link_split_line_transfer;
mod link_transfer_pair;
mod merge_categories;
mod repair_claimed_transfer;
mod restore_user_chunk;
mod set_transaction_splits_with_legs;
mod transfer;
mod update_transaction;
mod user_financial_data_is_empty;
mod verify_integrity;
mod wipe_user_financial_data;

pub use apply_category_to_uncategorized::{
    apply_category_to_uncategorized, ApplyCategoryToUncategorized,
    ApplyCategoryToUncategorizedResult,
};
pub use clear_transfer_links::{
    clear_transfer_links, ClearTransferLinks, ClearTransferLinksResult,
};
pub use confirm_transaction_categories::{
    confirm_transaction_categories, ConfirmTransactionCategories,
    ConfirmTransactionCategoriesResult,
};
pub use create_transaction::{create_transaction, CreateTransaction, CreateTransactionResult};
pub use create_transfer_counterpart::{
    create_transfer_counterpart, CreateTransferCounterpart, CreateTransferCounterpartResult,
};
pub use delete_transaction::{
    delete_transaction, DeleteTransaction, DeleteTransactionResult,
};
pub use delete_unused_categories::{
    delete_unused_categories, DeleteUnusedCategories, DeleteUnusedCategoriesResult, PruneAnswer,
};
pub use finalize_user_restore::{
    finalize_user_restore, AccountParent, FinalizeAnswer, FinalizeUserRestore,
    FinalizeUserRestoreResult, RestoreLinks, TransactionLink,
};
pub use link_bank_account_snap::{
    link_bank_account_snap, LinkBankAccountSnap, LinkBankAccountSnapResult,
};
pub use link_split_line_transfer::{
    link_split_line_transfer, LinkSplitLineTransfer, LinkSplitLineTransferResult,
};
pub use link_transfer_pair::{link_transfer_pair, LinkTransferPair, LinkTransferPairResult};
pub use merge_categories::{merge_categories, MergeCategories, MergeCategoriesResult};
pub use repair_claimed_transfer::{
    repair_claimed_transfer, RepairClaimedTransfer, RepairClaimedTransferResult,
};
pub use restore_user_chunk::{
    restore_user_chunk, Chunk, RestoreAnswer, RestoreUserChunk, RestoreUserChunkResult,
};
pub use set_transaction_splits_with_legs::{
    set_transaction_splits_with_legs, SetTransactionSplitsWithLegs,
    SetTransactionSplitsWithLegsResult,
};
pub use update_transaction::{
    update_transaction, TransactionPatch, UpdateTransaction, UpdateTransactionResult,
};
pub use user_financial_data_is_empty::{
    user_financial_data_is_empty, IsEmptyAnswer, UserFinancialDataIsEmpty,
    UserFinancialDataIsEmptyResult,
};
pub use verify_integrity::{
    verify_integrity, Finding, IntegrityReport, VerifyIntegrity, VerifyIntegrityResult,
};
pub use wipe_user_financial_data::{
    wipe_user_financial_data, WipeCounts, WipeUserFinancialData, WipeUserFinancialDataResult,
    CONFIRMATION,
};

// ── Three things the category family needed three copies of ─────────────────
//
// The nine transfer/transaction verbs each carry their own `json_of`, and they
// are deliberately left alone: churning nine green files to share four lines is
// a bad trade against the risk. The category family is three new verbs written
// at once, so they share from the start.

use serde::Serialize;
use std::collections::BTreeSet;

use crate::error::{CoreError, CoreResult};

/// Anything serialisable, as the audit column's TEXT.
fn json_of<T: Serialize>(value: &T) -> CoreResult<String> {
    serde_json::to_string(value)
        .map_err(|error| CoreError::InvalidCommand(format!("audit payload: {error}")))
}

/// A row count, as the `i64` every result in this crate reports.
///
/// The conversion cannot fail on any file a person owns; it is a refusal rather
/// than a panic because this crate does not panic on data.
fn count(value: usize) -> CoreResult<i64> {
    i64::try_from(value).map_err(|_| {
        CoreError::refuse(
            "amount_out_of_range",
            "that is more rows than this ledger can count",
        )
    })
}

/// The ids a `p_ids uuid[]` argument really names, once each, in the order the
/// cloud's cursor walks them.
///
/// `id = ANY(p_ids)` matches each row once however many times its id appears in
/// the array, and the RPCs then walk the matching rows in whatever order the
/// executor picks — which for these two functions is unobservable, because every
/// row gets the same treatment. A `BTreeSet` gives the DISTINCT and a stable
/// order in one step: for canonical lowercase uuid text, byte order and
/// Postgres's uuid order are the same order.
///
/// [`clear_transfer_links`] builds the same set inline because it needs it twice
/// and for a different purpose (its `count(DISTINCT …)` guarantee); this is the
/// plain version the two provenance verbs share.
fn distinct_ids(named: &[String]) -> BTreeSet<&str> {
    named.iter().map(String::as_str).collect()
}

/// The port of `category IS NULL OR btrim(category) = ''`.
///
/// One predicate, used in **opposite** directions by the two provenance verbs,
/// which is why it is here rather than duplicated in each with one of them
/// negated: [`apply_category_to_uncategorized`] fills the rows this is true of,
/// and [`confirm_transaction_categories`] skips them. A split parent's category
/// is blank by design, so this one function is what selects it into the first
/// verb's loop and out of the second's.
///
/// `str::trim` for `btrim`: both strip leading and trailing whitespace, and the
/// only spelling difference is which characters count as whitespace — Postgres's
/// `btrim` defaults to the space character alone, Rust's `trim` to Unicode
/// whitespace. A category id containing a tab is not a shape either engine
/// produces, and the wider test is the safer one.
fn is_blank_category(category: Option<&str>) -> bool {
    category.is_none_or(|value| value.trim().is_empty())
}
