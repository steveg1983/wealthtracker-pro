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
//! # Deliberately not done YET, and named so nobody has to re-derive it
//!
//! Two category RPCs the client really does call are outside this batch, both
//! from `planningService.ts`:
//!
//! * `migrate_categories_atomic` (`:446`) — first-cloud-load seeding, which
//!   remaps every transaction and budget reference in one transaction. It has no
//!   meaning in a local file that was never on the cloud, so it needs a decision
//!   about *what it would even do* before it needs a port.
//! * `delete_unused_categories` (`:511`) — the Money-set "replace" import's bulk
//!   prune. Its live definition is `20260713100000:319`, it re-verifies every row
//!   server-side, and it is a straightforward port. It is simply not in this
//!   batch.
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
//! record. The four remaining paths (the duplicate sweep, the wipe, the
//! restore's pre-clear, the transfer-unlink repair) still owe the same guard,
//! and `delete_transaction::touches_a_transfer_leg` is the condition they should
//! reuse rather than re-derive.
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
//! it. Three paths still owe the guard: the duplicate sweep, the wipe, and the
//! restore's pre-clear.
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

mod apply_category_to_uncategorized;
mod clear_transfer_links;
mod confirm_transaction_categories;
mod create_transaction;
mod create_transfer_counterpart;
mod delete_transaction;
mod link_split_line_transfer;
mod link_transfer_pair;
mod merge_categories;
mod repair_claimed_transfer;
mod set_transaction_splits_with_legs;
mod transfer;
mod update_transaction;

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
pub use link_split_line_transfer::{
    link_split_line_transfer, LinkSplitLineTransfer, LinkSplitLineTransferResult,
};
pub use link_transfer_pair::{link_transfer_pair, LinkTransferPair, LinkTransferPairResult};
pub use merge_categories::{merge_categories, MergeCategories, MergeCategoriesResult};
pub use repair_claimed_transfer::{
    repair_claimed_transfer, RepairClaimedTransfer, RepairClaimedTransferResult,
};
pub use set_transaction_splits_with_legs::{
    set_transaction_splits_with_legs, SetTransactionSplitsWithLegs,
    SetTransactionSplitsWithLegsResult,
};
pub use update_transaction::{
    update_transaction, TransactionPatch, UpdateTransaction, UpdateTransactionResult,
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
