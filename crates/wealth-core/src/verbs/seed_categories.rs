//! `seed_categories` — the categories a ledger is read through, put into a file
//! that has none. Divergence B-4, made true.
//!
//! # What it is a port OF
//!
//! `planningService.ensureCategories` (`:426-487`) — the whole method, not just
//! the RPC inside it. Its body is three steps and this verb is the same three:
//!
//! ```text
//! rows = SELECT * FROM categories WHERE user_id = … ORDER BY level, name
//! if rows.length > 0  -> return rows                       (nothing is written)
//! else                -> migrate_categories_atomic(user, the client's list)
//!                        return what it answered
//! ```
//!
//! The cloud's third step is `20260724100000:48-136`, the live definition of
//! three. THE VERB IS ONE CROSSING WHERE THE CLIENT MAKES TWO, and that is not a
//! convenience: the emptiness test and the insert have to be one act or two
//! callers can both find the file empty. The cloud gets away with two round trips
//! because the RPC re-asks the question itself and raises
//! `categories_already_migrated` when a concurrent session won the race; a local
//! file has no second session, and a verb that answered a refusal for the
//! ordinary case would make the port BRANCH ON A REFUSAL CODE, which PHASE3-PLAN
//! D-3 forbids in as many words (*"code/hint non-enumerable, NO branching"*).
//!
//! So the already-seeded case is an ANSWER here and a refusal there, and it is
//! reached by a caller that would never have asked in the cloud. That is a
//! difference in where the question is asked rather than in what the ledger does:
//! both engines end with the stored set, unchanged, and nothing written.
//!
//! # B-4: IT SEEDS, AND IT NEVER REMAPS
//!
//! The cloud's four passes exist to move a category tree between two ID SPACES:
//! the localStorage era gave categories slugs (`'type-income'`, `'transfer-in'`)
//! and `categories.id` there is a `uuid`, so pass 1 mints a fresh uuid for every
//! incoming id, pass 2 inserts under the new ids, pass 3 re-wires the parents
//! through the map and **pass 4 rewrites `transactions.category` and
//! `budgets.category`** so that no reference is left pointing at an id that
//! stopped existing.
//!
//! A local file has one id space. `schema.sql`'s `categories.id` is `TEXT`, and
//! the uuid CHECK lives on `users.id` alone (PHASE3-PLAN D-5, grepped) — so the
//! defaults keep the ids they arrive with, `'type-income'` and `'transfer-in'`
//! included, and there is nothing whatever to remap. **Pass 1 and pass 4 do not
//! exist here.** That is the whole of divergence B-4, and it is the reason this
//! verb is not named `migrate_categories`: it does one of the two things that
//! function does, and the one it does not do is the one the name describes.
//!
//! Pass 2 and pass 3 DO survive, and pass 3 is not vestigial without a remap:
//! `parent_id` is an IMMEDIATE foreign key in this file, so a list that names a
//! child before its parent cannot be inserted in one go. The cloud defers the
//! links for its own reason (*"so the client does not need to send parents before
//! children"*) and the same two passes buy the same tolerance here.
//!
//! A `parentId` naming a row that is NOT in the batch is left NULL, which is the
//! cloud's `v_map ? (v_item->>'parentId')` guard reproduced: a link to something
//! outside the seed is a link to nothing, and this verb only ever runs against a
//! file with nothing in it.
//!
//! # THE DEFAULT SET IS THE CALLER'S, AND THAT IS DELIBERATE
//!
//! The tree crosses the seam in the payload, exactly as `p_categories` does. It
//! is NOT a constant in this crate, and the reason is that there would then be
//! two of it: `src/data/defaultCategories.ts` is what browser storage answers
//! with, what the cloud migrates, and what a device seeds, and a second copy in
//! Rust would go stale the first time a group was added to the starter tree with
//! nothing to catch it. One list, three engines.
//!
//! What the verb owns is what a seed MEANS — when it happens, that it happens
//! once, and that the ids survive it.
//!
//! # IT DOES NOT BACKFILL THE To/From CATEGORIES, AND HERE IS WHY
//!
//! C-3 mints an account's `To/From <name>` category on the account INSERT, and it
//! stands down when the file has no Transfer anchor yet — *"categories seed
//! lazily; a parentless category renders as junk"*, which is the cloud's own
//! comment and the thing that makes a restore's account-first order safe (R-6).
//! So an account created BEFORE this verb runs has no To/From category, and
//! seeding the anchor afterwards does not go back for it.
//!
//! `20260708140000`'s section 4 does exactly that backfill — once, as a data
//! repair, in the migration itself. `ensureCategories` has never done it, and
//! neither does this. The order that would need it does not arise in a device:
//! a new file seeds at its first boot, before any account can be typed, and a
//! restored file already carries its own To/From rows (which is R-6's collision,
//! guarded by C-3's `NOT EXISTS`). If a file ever does reach that state,
//! `verify_integrity` reports it by name — `account_missing_transfer_category` —
//! which is a better answer than a verb quietly minting rows nobody asked for
//! while its caller was expecting a list of names.
//!
//! # IT AUDITS NOTHING
//!
//! [`super::delete_unused_categories`]'s three reasons, applied to the other end
//! of a category's life, and the answer comes out the same:
//!
//! 1. Nothing is referenced yet and no figure moved. A seed happens to a file
//!    with no categories, which in practice means no transactions either — there
//!    is no "what changed that number" for an entry to answer.
//! 2. It would cost the differential comparison a divergence per spec, and a
//!    family of divergences is how a real one gets missed.
//! 3. Seventy-seven `category/create` entries would be the FIRST thing in every
//!    new ledger's audit log, in front of the first transaction anybody records.
//!    A financial audit trail whose opening chapter is the app's own furniture is
//!    a trail nobody reads.
//!
//! Note the family disagrees with itself on purpose: [`super::create_category`]
//! DOES audit, because a category somebody typed is the start of a chain the
//! entry explains. If this one ever audits, it must be a DECLARED divergence in
//! DESIGN.md §5 and not a quiet improvement.
//!
//! # No guard, measured
//!
//! INSERTs and UPDATEs of `categories` only. C-5 is `BEFORE DELETE`;
//! `trg_categories_updated_at` stands down of its own accord because both passes
//! write `updated_at` themselves. C-3 is on `accounts`. `tests/category_writes.rs`
//! asserts the guard table empty across a seed.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::category::{self, CategoryRow};
use crate::wire::null_if_empty;

use super::create_category::CategoryDraft;

/// The command: `(p_user_id, p_categories)`, in one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SeedCategories {
    /// Owner. The file's one login (PHASE3-PLAN D-5).
    pub user_id: String,
    /// The default set, as the app holds it. Only looked at when the file has
    /// none of its own.
    #[serde(default)]
    pub categories: Vec<CategoryDraft>,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct SeedCategoriesResult {
    /// The answer, wrapped for the differential harness — see
    /// [`super::create_category::CreateCategoriesResult`], which wraps its list
    /// for the same reason. The READ verb `list_categories` answers with a bare
    /// `categories` key because nothing compares a read against a second engine
    /// through this door.
    pub answer: SeededCategories,
}

/// Every category the file now holds.
#[derive(Debug, Serialize)]
pub struct SeededCategories {
    /// The whole stored set, `ORDER BY level, name` — which is
    /// `ensureCategories`' own query and the RPC's own `RETURN QUERY`. Never
    /// empty: the seam says *"a ledger with no categories has nowhere to file
    /// anything, and the boot does not ask twice"*.
    pub categories: Vec<CategoryRow>,
}

/// Make sure this file has categories, then say what they are.
///
/// # Errors
/// [`CoreError::Refused`] for `categories_payload_empty`, `category_missing_id`,
/// or a rule the file enforced while inserting the set;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn seed_categories(
    connection: &mut Connection,
    command: SeedCategories,
) -> CoreResult<SeedCategoriesResult> {
    // BEGIN IMMEDIATE: the emptiness test and the insert are one act. See the
    // module docs — this is the whole reason the verb exists rather than the
    // port asking twice.
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;

    if !holds_a_category(&write, &command.user_id)? {
        seed(&write, &command)?;
    }

    let categories = category::list_all(&write, &command.user_id)?;
    write.commit()?;

    Ok(SeedCategoriesResult {
        answer: SeededCategories { categories },
    })
}

/// The RPC's idempotency guard, asked as a question instead of an exception.
///
/// `EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id)` — the
/// same predicate, in the same place in the sequence.
fn holds_a_category(write: &rusqlite::Transaction<'_>, user_id: &str) -> CoreResult<bool> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH categories USING COVERING INDEX idx_categories_user (user_id=?)
    let found: i64 = write.query_row(
        "SELECT EXISTS (SELECT 1 FROM categories WHERE user_id = ?1)",
        params![user_id],
        |record| record.get(0),
    )?;
    Ok(found != 0)
}

/// Passes 2 and 3 of `migrate_categories_atomic`, without passes 1 and 4.
fn seed(write: &rusqlite::Transaction<'_>, command: &SeedCategories) -> CoreResult<()> {
    if command.categories.is_empty() {
        return Err(CoreError::Refused(
            Refusal::named(
                "categories_payload_empty",
                "categories_payload_empty: a ledger has to have somewhere to file things, and \
                 this seed named no categories at all",
            )
            .with_hint("Send the default category set, or the tree this file should start with."),
        ));
    }

    let now = db::now(write)?;

    // Pass 2: every row, under ITS OWN ID, with the parent link deliberately
    // unwritten. The cloud's reason for deferring it is the client's ordering;
    // ours is the same ordering against an IMMEDIATE foreign key.
    let mut named: HashSet<&str> = HashSet::with_capacity(command.categories.len());
    for draft in &command.categories {
        let Some(id) = null_if_empty(draft.id.as_deref()) else {
            // The RPC's own refusal, and the reason it has one: the ids ARE the
            // seed. A row with none would be filed under something invented,
            // and the app's `'transfer-in'` would then name nothing.
            return Err(CoreError::Refused(
                Refusal::named(
                    "category_missing_id",
                    "category_missing_id: every category in a seed has to name its own id, \
                     because the ids are what the app files transactions under",
                )
                .with_hint(
                    "Unlike a create, a seed never mints an id: 'transfer-in' has to still be \
                     'transfer-in' when the ledger asks for it.",
                ),
            ));
        };
        named.insert(id);
        super::create_category::insert(write, draft, &command.user_id, id, None, &now)?;
    }

    // Pass 3: the links, for the rows this call brought in. A parent outside the
    // batch is left NULL — the cloud's `v_map ? (v_item->>'parentId')`.
    for draft in &command.categories {
        let (Some(id), Some(parent)) = (
            null_if_empty(draft.id.as_deref()),
            null_if_empty(draft.parent_id.as_deref()),
        ) else {
            continue;
        };
        if !named.contains(parent) {
            continue;
        }
        write.execute(
            "UPDATE categories SET parent_id = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4",
            params![parent, now, id, command.user_id],
        )?;
    }

    Ok(())
}
