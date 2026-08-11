//! `create_category` and `create_categories` — one name, and a tree's worth of
//! them, whose oracle is a TypeScript writer rather than a Postgres function.
//!
//! # What they are a port OF
//!
//! `planningService.createCategory` (`:489-505`) and `planningService
//! .createCategories` (`:546-566`): `categoryToDb(category, userId)` sent as
//! `.from('categories').insert(row).select().single()`, and the same map over a
//! list sent as one `.insert(rows).select()`. There is no
//! `create_category_atomic` and there never has been — `categories` is one of the
//! tables the cloud writes directly over PostgREST — so what is ported is the
//! WRITE ITSELF, its column list and its defaulting, exactly as
//! [`super::create_account`] ports an `accounts` insert and [`super::reads`]
//! ports a `.select()`.
//!
//! That is PHASE3-PLAN D-2. `verbs/mod.rs` used to say of this family that *"a
//! verb here would be a port of nothing"*; the sentence was true of the CLOUD and
//! false of a device, where DESIGN.md §6.4 leaves no SQL door and a table with no
//! verb is a table the local edition cannot write at all.
//!
//! # TWO VERBS, NOT ONE WITH A LIST
//!
//! The seam names two operations and they answer different shapes — one category,
//! and one category per category supplied — and the singular's answer is used on
//! the very next line (B-5: *"as the value of the select it just added the option
//! to, and as the `parentId` of the children created in the same breath"*). A
//! single plural verb would make every singular create unwrap a list and invent a
//! refusal for the empty answer that cannot happen. They share the INSERT below,
//! so there is one definition of what a category row is made of, and two verbs
//! deciding how many of them a caller asked for.
//!
//! The bulk create's own emptiness rule is the CALLER's and stays there: *"empty
//! in, empty out, and nothing written"* is a statement about not opening a store,
//! which a verb cannot make about itself once it has been asked. `localDataPort`
//! answers `[]` without crossing the seam, exactly as `planningService` and
//! `DataServiceImpl` both return before they look at the connection.
//!
//! # THE ID IS MINTED HERE WHEN THE CALLER SENDS NONE (B-5)
//!
//! `categories.id` in the cloud is a uuid column with `DEFAULT gen_random_uuid()`
//! and the client leaves it out; `schema.sql`'s is `TEXT PRIMARY KEY` with **no
//! default**, because the same column also holds the slug ids a local file's
//! defaults are seeded under (`'type-income'`, `'transfer-in'` — see
//! [`super::seed_categories`], and PHASE3-PLAN D-5 for why only `users.id`
//! carries the uuid CHECK). A column that defaulted would be a column that
//! silently replaced a caller's slug.
//!
//! So the verb mints a v4 uuid when the payload names none, which is B-5's
//! *"an id the client mints"* with the file as the client — the same shape
//! [`super::create_account`] and [`super::create_transaction`] use, and the same
//! shape the app already relies on: `DataServiceImpl.createCategory` mints one
//! for browser storage from its own injected generator.
//!
//! # WHAT `categoryToDb` DOES, AND THE ONE PLACE IT SURPRISES
//!
//! Eleven `if (c.k !== undefined)` lines and nothing else: a field the caller did
//! not state is not sent, and the COLUMN DEFAULT answers. Both engines default
//! `is_system`, the three semantic flags and `is_active` identically (false,
//! false, false, false, true), so an unstated flag is the same row on either
//! side.
//!
//! The surprise is two lines: `row.parent_id = c.parentId || null` and
//! `row.account_id = c.accountId || null`. **Falsy, not nullish** — an empty
//! string becomes SQL NULL rather than being stored. That is reproduced here with
//! [`crate::wire::null_if_empty`] rather than tidied, because a port that stored
//! `''` in `parent_id` would put a category under a parent that cannot exist and
//! the tree would render it as junk. Every other text field is passed through as
//! it stands, `''` included, which is what the mapper does.
//!
//! `name`, `type` and `level` are `NOT NULL` on both engines with no default, and
//! they are accepted here as optional for exactly that reason: the cloud's writer
//! can send an object without them and the TABLE is what refuses it. Requiring
//! them in the payload struct would move that refusal from a named constraint to
//! a deserialiser error, and the two are told apart by the caller.
//!
//! # WHAT THE FILE ENFORCES THAT THE CLOUD DOES NOT
//!
//! Two CHECKs `schema.sql` added and the cloud has never had, both stated there
//! as NEW:
//!
//! * `categories_account_only_for_transfer` — only a To/From category may name an
//!   account. In the cloud an ordinary category can quietly acquire an
//!   `account_id`, which is a row nothing in the app has a meaning for.
//! * `categories_flags_exclusive` — at most one of the three semantic flags. Two
//!   of them on one row has no defined meaning in `utils/incomeExpense.ts`:
//!   `is_unassigned_bucket` DECLASSIFIES while the other two CLASSIFY.
//!
//! Both refuse from the FILE, with the constraint's own name in the message, so
//! neither is a rule this verb re-implements.
//!
//! # IT AUDITS, AND THE CLOUD DOES NOT
//!
//! One `category/create` entry per row, chained, in the same transaction. The
//! cloud writes none — there is no function to write one from — and this is the
//! same declared divergence the account family carries, for the same reason:
//! locally there is one door into the file and it audits.
//!
//! It is NOT the answer [`super::delete_unused_categories`] reached, and the
//! difference is which of its three reasons applies. That verb's rows are
//! *unreferenced by definition* and its entry would have no chain to explain; a
//! category somebody typed is the start of one — every transaction filed under it
//! carries its id, and `merge_categories` already audits the other end of that
//! life (`category/delete`, `20260805214322:382-384`). [`super::seed_categories`]
//! goes the other way and audits nothing, and says why.
//!
//! # No guard, measured
//!
//! An INSERT into `categories`. The only triggers on that table are C-5
//! (`BEFORE DELETE`) and `trg_categories_updated_at` (`BEFORE`/`AFTER UPDATE`),
//! neither of which fires on an insert; C-3 fires on an `accounts` INSERT, not on
//! this one. `tests/category_writes.rs` asserts the guard table empty across a
//! create rather than reasoning about it, which is the rule `verbs/mod.rs` sets
//! for every verb.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::row::category::{self, CategoryRow};
use crate::wire::{null_if_empty, Flag};

/// One category as `categoryToDb` sends it.
///
/// Every column that mapper can produce, each optional because the mapper omits
/// what the caller did not state. `deny_unknown_fields` is this crate's usual
/// strengthening; here it is also parity, because a key `categoryToDb` has no
/// line for is a key that never reaches the cloud's table either — the mapper is
/// a whitelist, so `description` (a field of the app's `Category` with no column
/// in either engine) is dropped on that side and must be dropped before it
/// reaches this one. `mappers/writes.ts` does exactly that and says so.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CategoryDraft {
    /// Client-minted, or minted here when absent — B-5. See the module docs for
    /// why this column has no default in `schema.sql`.
    #[serde(default)]
    pub id: Option<String>,
    /// `NOT NULL` in both engines, with no default. Absent is refused by the
    /// table, which is where the cloud refuses it too.
    #[serde(default)]
    pub name: Option<String>,
    /// `income` | `expense` | `both` — enumerated by CHECK in both engines.
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    /// `type` | `sub` | `detail` — enumerated by CHECK in both engines.
    #[serde(default)]
    pub level: Option<String>,
    /// The category above this one. `|| null`: an empty string is not a parent.
    #[serde(default)]
    pub parent_id: Option<String>,
    /// The account a To/From category belongs to (C-3). `|| null`. The file
    /// refuses one on any other kind of category.
    #[serde(default)]
    pub account_id: Option<String>,
    /// Display only, and passed through as it stands — `''` is stored.
    #[serde(default)]
    pub color: Option<String>,
    /// Display only, same rule.
    #[serde(default)]
    pub icon: Option<String>,
    /// A built-in the app files under by itself. Defaults false.
    #[serde(default)]
    pub is_system: Option<Flag>,
    /// An account's To/From category. Defaults false. Minting one BY HAND is
    /// allowed here because a restore does exactly that; C-3's trigger is what
    /// makes the ordinary case automatic.
    #[serde(default)]
    pub is_transfer_category: Option<Flag>,
    /// The revaluation leaf a valuation adjustment lands on. Defaults false.
    #[serde(default)]
    pub is_revaluation_category: Option<Flag>,
    /// The import's Unassigned bucket — *not categorised at all*. Defaults false.
    #[serde(default)]
    pub is_unassigned_bucket: Option<Flag>,
    /// Hidden from the pickers. Defaults TRUE, as the column does.
    #[serde(default)]
    pub is_active: Option<Flag>,
}

/// The command: one category, and whose.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateCategory {
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// The category, flattened into the command so the payload is the object
    /// `categoryToDb` produces plus the owner — which is what the cloud's insert
    /// row literally is.
    #[serde(flatten)]
    pub category: CategoryDraft,
}

/// The command: a tree's worth at once.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateCategories {
    /// Owner.
    pub user_id: String,
    /// The rows, in the order the caller listed them. A parent may follow its
    /// own child in this list: the parent link is written in a second pass, for
    /// the reason [`super::seed_categories`] gives at length.
    #[serde(default)]
    pub categories: Vec<CategoryDraft>,
}

/// What one create hands back.
#[derive(Debug, Serialize)]
pub struct CreateCategoryResult {
    /// The category as stored — the whole row, which is the same projection
    /// `list_categories` answers with, so a caller can put it straight into
    /// state without re-reading.
    pub answer: CategoryRow,
    /// Dense sequence number of the audit row written for this create.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// What a bulk create hands back.
#[derive(Debug, Serialize)]
pub struct CreateCategoriesResult {
    /// The rows as stored. Wrapped in an object rather than answered as a bare
    /// list because that is what the differential harness compares a verb ON —
    /// see `lib/verb-sqlite.mjs`, which reads `result.transaction ?? result
    /// .answer`.
    pub answer: CreatedCategories,
}

/// The bulk create's answer.
#[derive(Debug, Serialize)]
pub struct CreatedCategories {
    /// One row per category supplied, **in id order**. The seam says callers
    /// match answers to requests BY NAME and never by position, so the order is
    /// the harness's need rather than the app's: two engines cannot compare two
    /// lists that are not in the same order, and insertion order is not a thing
    /// PostgREST promises.
    pub categories: Vec<CategoryRow>,
}

/// Store one category.
///
/// # Errors
/// [`CoreError::Refused`] for a rule the file enforced — `categories_type_check`,
/// `categories_level_check`, `categories_account_only_for_transfer`,
/// `categories_flags_exclusive`, `ux_categories_user_name_parent`, the parent or
/// users foreign key; [`CoreError::Storage`] for a fault.
// Consumed rather than borrowed, for the reason every write verb here gives: it
// writes an audit row, and `&command` is an invitation to do it twice.
#[allow(clippy::needless_pass_by_value)]
pub fn create_category(
    connection: &mut Connection,
    command: CreateCategory,
) -> CoreResult<CreateCategoryResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let id = super::minted_uuid(command.category.id.as_deref());
    let parent = null_if_empty(command.category.parent_id.as_deref()).map(ToOwned::to_owned);
    let stored = insert(
        &transaction,
        &command.category,
        &command.user_id,
        &id,
        parent.as_deref(),
        &now,
    )?;

    let entry = audit::write(
        &transaction,
        &command.user_id,
        "category",
        &id,
        Action::Create,
        None,
        Some(&super::json_of(&stored)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(CreateCategoryResult {
        answer: stored,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// Store several categories, all or none.
///
/// # Errors
/// As [`create_category`]. One row the file refuses loses the whole list, which
/// is what a single `.insert(rows)` does in the cloud too — PostgREST sends one
/// statement and Postgres rolls it back entire.
#[allow(clippy::needless_pass_by_value)]
pub fn create_categories(
    connection: &mut Connection,
    command: CreateCategories,
) -> CoreResult<CreateCategoriesResult> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    // Pass 1: every row, with its parent link deliberately unwritten. A caller
    // may list a child before its parent (a tree import's second level is
    // computed from the first, and nothing sorts the result), and `parent_id`
    // is an IMMEDIATE foreign key here — so writing the link now would refuse a
    // list the cloud accepts. `migrate_categories_atomic` defers it for exactly
    // this reason and says so; this is the same two-pass shape without the id
    // remap, which is the whole of B-4.
    let mut ids = Vec::with_capacity(command.categories.len());
    for draft in &command.categories {
        let id = super::minted_uuid(draft.id.as_deref());
        insert(&transaction, draft, &command.user_id, &id, None, &now)?;
        ids.push(id);
    }

    // Pass 2: the links, now that every row named in this call exists.
    for (draft, id) in command.categories.iter().zip(&ids) {
        let Some(parent) = null_if_empty(draft.parent_id.as_deref()) else {
            continue;
        };
        transaction.execute(
            "UPDATE categories SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![parent, now, id],
        )?;
    }

    // One entry per row, and the `after` is read AFTER the links are wired so
    // that the audited state is the state the file actually holds. Reading them
    // in the first pass would record every child as parentless.
    let mut stored = Vec::with_capacity(ids.len());
    for id in &ids {
        let row = read_back(&transaction, id, &command.user_id)?;
        audit::write(
            &transaction,
            &command.user_id,
            "category",
            id,
            Action::Create,
            None,
            Some(&super::json_of(&row)?),
            &now,
        )?;
        stored.push(row);
    }
    stored.sort_by(|left, right| left.id.cmp(&right.id));

    transaction.commit()?;

    Ok(CreateCategoriesResult {
        answer: CreatedCategories { categories: stored },
    })
}

/// The INSERT itself — `categoryToDb`'s column list, once, for both verbs and
/// for [`super::seed_categories`].
///
/// `parent_id` is a parameter rather than being read off the draft because the
/// three callers disagree about WHEN it is written: the singular create writes it
/// now, the two bulk paths defer it to a second pass so a child may precede its
/// parent. Everything else about a category row is decided here and nowhere else.
///
/// The row is READ BACK rather than reconstructed, for the reason
/// `create_transaction` states about `to_jsonb(v_tx)`: the audit's `after` and
/// the caller's answer must be what storage holds, defaults and CHECKs and all.
pub(super) fn insert(
    transaction: &rusqlite::Transaction<'_>,
    draft: &CategoryDraft,
    user_id: &str,
    id: &str,
    parent_id: Option<&str>,
    now: &str,
) -> CoreResult<CategoryRow> {
    let flag = |flag: Option<&Flag>, fallback: bool, field: &str| -> CoreResult<i64> {
        Flag::resolve_or(flag, fallback)
            .map(i64::from)
            .map_err(|message| {
                CoreError::Refused(
                    Refusal::named("boolean_invalid", &format!("{field}: {message}")).with_hint(
                        "Postgres refuses this too, as an invalid input syntax for type boolean.",
                    ),
                )
            })
    };

    transaction.execute(
        "INSERT INTO categories (
           id, user_id, name, type, level, parent_id, account_id, color, icon,
           is_system, is_transfer_category, is_revaluation_category,
           is_unassigned_bucket, is_active, created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
           ?10, ?11, ?12, ?13, ?14, ?15, ?15
         )",
        params![
            id,
            user_id,
            draft.name,
            draft.kind,
            draft.level,
            parent_id,
            null_if_empty(draft.account_id.as_deref()),
            draft.color,
            draft.icon,
            flag(draft.is_system.as_ref(), false, "is_system")?,
            flag(
                draft.is_transfer_category.as_ref(),
                false,
                "is_transfer_category"
            )?,
            flag(
                draft.is_revaluation_category.as_ref(),
                false,
                "is_revaluation_category"
            )?,
            flag(
                draft.is_unassigned_bucket.as_ref(),
                false,
                "is_unassigned_bucket"
            )?,
            flag(draft.is_active.as_ref(), true, "is_active")?,
            now,
        ],
    )?;

    read_back(transaction, id, user_id)
}

/// The stored row, or the refusal for a row that vanished between writing it and
/// reading it back — unreachable, and named rather than unwrapped.
pub(super) fn read_back(
    transaction: &rusqlite::Transaction<'_>,
    id: &str,
    user_id: &str,
) -> CoreResult<CategoryRow> {
    category::read_owned(transaction, id, Some(user_id))?.ok_or_else(|| {
        CoreError::refuse(
            "category_not_found",
            "the category disappeared between writing it and reading it back",
        )
    })
}
