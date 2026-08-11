//! `update_category` — the port of a PostgREST `UPDATE`, and of the `.single()`
//! on the end of it.
//!
//! # What it is a port OF
//!
//! `planningService.updateCategory` (`:568-585`):
//!
//! ```text
//! .from('categories').update(categoryToDb(updates))
//!   .eq('id', id).eq('user_id', userId).select().single()
//! ```
//!
//! No RPC, for the reason [`super::create_category`] gives: `categories` is one
//! of the tables the cloud writes directly. PHASE3-PLAN D-2.
//!
//! # ONE presence rule, and it is `categoryToDb`'s
//!
//! Eleven `if (c.k !== undefined)` lines. `undefined` means *leave this alone*
//! and is dropped; anything else — `null` included — is sent. So every field
//! below is the `p ? 'k'` class [`super::update_account`] describes: **the key
//! being present is the whole test, and a JSON null stores NULL.** Where the
//! column is `NOT NULL` (`name`, `type`, `level`, the four flags, `is_active`) a
//! stated null is refused by the file, on both engines.
//!
//! The two exceptions are the same two the create has, and they are exceptions in
//! the mapper rather than here: `parent_id` and `account_id` are written
//! `c.parentId || null` — **falsy**, so an empty string clears the column instead
//! of being stored. Reproduced with [`crate::wire::null_if_empty`] on the stated
//! value, so `{"parent_id": ""}` un-parents a category on both engines.
//!
//! # A CATEGORY THAT IS NOT THERE IS REFUSED, AND A CATEGORY THAT IS GONE IS NOT
//!
//! `.single()` is the whole difference between this verb and
//! [`super::delete_category`], which accepts an id naming nothing. PostgREST
//! raises `PGRST116` when an update matches no row and `.single()` is on the
//! query; the delete has no `.single()` and no rows matched is a successful call
//! with nothing done.
//!
//! The seam states the same rule from the app's end: *"A category that is not
//! there is refused BY NAME rather than created, and the refusal leaves the store
//! exactly as it was."* The refusal is `category_not_found`, which is the name
//! [`super::merge_categories`] already uses for the same fact, so a caller has
//! one code to know rather than two.
//!
//! # THE To/From CATEGORIES ARE NOT PROTECTED FROM AN EDIT, AND THAT IS THE CLOUD
//!
//! C-5 (`protect_transfer_category`, `20260708140000:127-146`) is `BEFORE
//! DELETE` and nothing else. There is no trigger on a category UPDATE in either
//! engine, so renaming a To/From category — or hiding one — is ACCEPTED by both,
//! and C-4 puts the name back the next time the account it belongs to is renamed
//! or closed (`trg_sync_transfer_category_for_account`). A verb that refused it
//! would be a second implementation of a protection the schema deliberately did
//! not write, and the two would disagree the day the schema changed its mind.
//!
//! What DOES refuse is the file, and it refuses the states that have no meaning
//! rather than the edits that are merely unwise:
//!
//! | the edit | what happens |
//! | --- | --- |
//! | rename a To/From category | accepted on both; C-4 renames it back on the next account rename |
//! | hide one (`is_active: false`) | accepted on both; C-4 mirrors the account's own flag back over it |
//! | clear its `account_id` | accepted on both. The local CHECK is `(account_id IS NULL) OR is_transfer_category = 1`, which a To/From row with no account passes. What it leaves is a category C-3 will mint a SECOND of, and `verify_integrity` reports it as `account_missing_transfer_category` — a report the cloud does not have |
//! | put an `account_id` on an ORDINARY category | refused locally by that CHECK; accepted in the cloud, which has no such constraint |
//! | set two semantic flags at once | refused locally by `categories_flags_exclusive`; accepted in the cloud |
//!
//! Every one of those refusals comes from the FILE with the constraint's own name
//! in the message, so none of them is a rule this verb re-implements — and the
//! two the cloud lacks are `schema.sql`'s declared strengthenings, stated there
//! as NEW.
//!
//! # It audits; the cloud has nothing to audit from
//!
//! One `category/update` entry, `before` and `after`, in the same transaction.
//! See [`super::create_category`] for the family's argument and for why
//! [`super::seed_categories`] goes the other way.
//!
//! # No guard, measured
//!
//! An UPDATE of `categories`. The only trigger that fires is
//! `trg_categories_updated_at`, which stands down of its own accord because this
//! verb writes `updated_at` itself; C-5 is `BEFORE DELETE`. Every
//! `trg_protect_split_*` is `BEFORE UPDATE OF` a column on `transactions`.
//! `tests/category_writes.rs` asserts the guard table empty across a rename.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::category::{self, CategoryRow};
use crate::wire::{null_if_empty, Field, Flag};

use super::create_account::resolve_flag_field;

/// The command.
///
/// `(p_id, p, p_user_id)` in the shape every verb here uses, so the differential
/// harness can send ONE payload to both engines.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateCategory {
    /// Which category.
    pub id: String,
    /// Whose. Absent means "name no owner", which in the cloud falls back to RLS
    /// and here means the ownership clause is not applied — the decision
    /// [`super::update_transaction`] documents at length.
    #[serde(default)]
    pub user_id: Option<String>,
    /// The fields to change.
    #[serde(default)]
    pub patch: CategoryPatch,
}

/// The settable columns, each in the three states `jsonb` can present.
///
/// Every one is the `p ? 'k'` class. The two that are not plain assignments are
/// `parent_id` and `account_id`, which are `|| null` in the mapper.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CategoryPatch {
    /// As shown.
    #[serde(default)]
    pub name: Field<String>,
    /// `income` | `expense` | `both`.
    #[serde(default, rename = "type")]
    pub kind: Field<String>,
    /// `type` | `sub` | `detail`.
    #[serde(default)]
    pub level: Field<String>,
    /// The category above this one. `''` clears it — see the module docs.
    #[serde(default)]
    pub parent_id: Field<String>,
    /// The account a To/From category belongs to. `''` clears it.
    #[serde(default)]
    pub account_id: Field<String>,
    /// Display only.
    #[serde(default)]
    pub color: Field<String>,
    /// Display only.
    #[serde(default)]
    pub icon: Field<String>,
    /// A built-in the app files under by itself.
    #[serde(default)]
    pub is_system: Field<Flag>,
    /// An account's To/From category (C-3).
    #[serde(default)]
    pub is_transfer_category: Field<Flag>,
    /// The revaluation leaf.
    #[serde(default)]
    pub is_revaluation_category: Field<Flag>,
    /// The Unassigned bucket — the flag that DECLASSIFIES.
    #[serde(default)]
    pub is_unassigned_bucket: Field<Flag>,
    /// Hidden from the pickers.
    #[serde(default)]
    pub is_active: Field<Flag>,
}

/// What the verb hands back: the row as it now stands, and the audit entry.
#[derive(Debug, Serialize)]
pub struct UpdateCategoryResult {
    /// The category as stored after the edit — the whole row, so the caller can
    /// replace its copy with the answer.
    pub answer: CategoryRow,
    /// Dense sequence number of the audit row written for this update.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Edit one category and audit it — one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for `category_not_found`, `boolean_invalid`, or a rule
/// the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn update_category(
    connection: &mut Connection,
    command: UpdateCategory,
) -> CoreResult<UpdateCategoryResult> {
    let patch = &command.patch;

    // Everything that can refuse without touching the file, before the file is
    // touched — the ordering Postgres gets free from its casts.
    let flags = Flags {
        is_system: resolve_flag_field(&patch.is_system, "is_system")?,
        is_transfer_category: resolve_flag_field(
            &patch.is_transfer_category,
            "is_transfer_category",
        )?,
        is_revaluation_category: resolve_flag_field(
            &patch.is_revaluation_category,
            "is_revaluation_category",
        )?,
        is_unassigned_bucket: resolve_flag_field(
            &patch.is_unassigned_bucket,
            "is_unassigned_bucket",
        )?,
        is_active: resolve_flag_field(&patch.is_active, "is_active")?,
    };

    // BEGIN IMMEDIATE: the write lock up front, so the read-then-update below is
    // the cloud's `SELECT … FOR UPDATE` without the lock it has nothing to add.
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let owner = command.user_id.as_deref();
    let Some(before) = category::read_owned(&transaction, &command.id, owner)? else {
        return Err(CoreError::Refused(
            Refusal::named("category_not_found", "category_not_found").with_hint(
                "That category no longer exists, or is not yours. Reload the categories and try \
                 again.",
            ),
        ));
    };

    let changed = apply(&transaction, &command, flags, &now)?;
    // `id` is the primary key and the row was just proven to exist, so more than
    // one is unreachable and zero would mean the WHERE clause had drifted from
    // the one that found it. SQLite reports zero changed rows and raises nothing
    // at all, which is the silence this crate refuses to leave.
    if changed != 1 {
        return Err(CoreError::refuse(
            "category_not_found",
            "the category disappeared between finding it and editing it",
        ));
    }

    let after = super::create_category::read_back(&transaction, &command.id, &before.user_id)?;

    let entry = audit::write(
        &transaction,
        &before.user_id,
        "category",
        &command.id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(UpdateCategoryResult {
        answer: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The five booleans, already cast out of their text form.
///
/// Every field is named for its own column, so they share a prefix; renaming
/// them to please the lint would break the correspondence with the patch, which
/// is the one thing this struct is for.
#[derive(Debug, Clone, Copy)]
#[allow(clippy::struct_field_names)]
struct Flags {
    is_system: Option<bool>,
    is_transfer_category: Option<bool>,
    is_revaluation_category: Option<bool>,
    is_unassigned_bucket: Option<bool>,
    is_active: Option<bool>,
}

/// The single UPDATE, column for column against `categoryToDb`'s output.
///
/// One statement rather than a SET list assembled in Rust, for
/// [`super::update_transaction`]'s two reasons: a statement built by
/// concatenation is a SQL surface and this crate has none (DESIGN.md §6.4), and
/// `ELSE <column>` is what makes "leave it alone" mean *the stored value* rather
/// than *what this process read a moment ago*.
fn apply(
    transaction: &rusqlite::Transaction<'_>,
    command: &UpdateCategory,
    flags: Flags,
    now: &str,
) -> CoreResult<usize> {
    let patch = &command.patch;
    // `|| null` on the two link columns, applied to the STATED value only: an
    // absent key is still absence, and a stated `null` is still null.
    let parent_id = patch.parent_id.value().and_then(|value| null_if_empty(Some(value)));
    let account_id = patch
        .account_id
        .value()
        .and_then(|value| null_if_empty(Some(value)));

    Ok(transaction.execute(
        "UPDATE categories SET
           name                    = CASE WHEN ?1  THEN ?2  ELSE name END,
           type                    = CASE WHEN ?3  THEN ?4  ELSE type END,
           level                   = CASE WHEN ?5  THEN ?6  ELSE level END,
           parent_id               = CASE WHEN ?7  THEN ?8  ELSE parent_id END,
           account_id              = CASE WHEN ?9  THEN ?10 ELSE account_id END,
           color                   = CASE WHEN ?11 THEN ?12 ELSE color END,
           icon                    = CASE WHEN ?13 THEN ?14 ELSE icon END,
           is_system               = CASE WHEN ?15 THEN ?16 ELSE is_system END,
           is_transfer_category    = CASE WHEN ?17 THEN ?18 ELSE is_transfer_category END,
           is_revaluation_category = CASE WHEN ?19 THEN ?20 ELSE is_revaluation_category END,
           is_unassigned_bucket    = CASE WHEN ?21 THEN ?22 ELSE is_unassigned_bucket END,
           is_active               = CASE WHEN ?23 THEN ?24 ELSE is_active END,
           updated_at              = ?25
         WHERE id = ?26",
        params![
            patch.name.is_present(),
            patch.name.value(),
            patch.kind.is_present(),
            patch.kind.value(),
            patch.level.is_present(),
            patch.level.value(),
            patch.parent_id.is_present(),
            parent_id,
            patch.account_id.is_present(),
            account_id,
            patch.color.is_present(),
            patch.color.value(),
            patch.icon.is_present(),
            patch.icon.value(),
            patch.is_system.is_present(),
            flags.is_system.map(i64::from),
            patch.is_transfer_category.is_present(),
            flags.is_transfer_category.map(i64::from),
            patch.is_revaluation_category.is_present(),
            flags.is_revaluation_category.map(i64::from),
            patch.is_unassigned_bucket.is_present(),
            flags.is_unassigned_bucket.map(i64::from),
            patch.is_active.is_present(),
            flags.is_active.map(i64::from),
            now,
            command.id,
        ],
    )?)
}
