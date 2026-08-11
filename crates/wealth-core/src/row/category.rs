//! The category: the two questions the write verbs ask about one, and — since
//! `merge_categories` — the whole row, because one verb now deletes one.
//!
//! # Why this is a module and not a private function in each verb
//!
//! `transfer_category_for` is a **shared** Postgres function
//! (`20260716100000:43-61`), and the migration that added the third caller says
//! in as many words why that matters
//! (`20260805145035:253-255`): *"the category each side lands on comes from the
//! same shared helper, transfer\_category\_for, so there is only one definition of
//! that rule."* Five call sites in the cloud —
//! `link_transfer_pair` (twice), `create_transfer_counterpart` (twice),
//! `repair_claimed_transfer` (twice), `set_transaction_splits_with_legs` and
//! `link_split_line_transfer` — resolve T-6 through one function. A local port
//! with a private copy per verb would have five definitions of one rule, and the
//! day the legacy sentinels are retired four of them would be missed.
//!
//! [`read_filing`] is the other half: the two flags the split writer's S-8 checks
//! read, and — through [`is_fileable_adjustment`] — the four conditions
//! `repair_claimed_transfer` puts on the Account Adjustment category.
//!
//! # And now a row type, because a category can be audited
//!
//! `crate::row`'s module documentation used to say a category *"has no row type
//! here"* because *"no verb audits a category row"*. `merge_categories` is the
//! verb that changed that: it ends by deleting the source and writing
//! `write_financial_audit(v_owner, 'category', v_source.id, 'delete',
//! to_jsonb(v_source), NULL)` — *"the line that says 'the merge happened, and
//! when'"* (`20260805214322:61-62`). [`CategoryRow`] is that `to_jsonb`.
//!
//! Unlike [`crate::row::account::AccountRow`], which is a deliberate projection
//! of a thirty-column table, this is the **whole** row: `categories` has sixteen
//! columns locally and the reference cluster reports the same sixteen keys in
//! `before_data` (probe `probe-merge3.sh`, case `e6`). A projection would make
//! the local delete entry a smaller record than the cloud's of the same event,
//! and the entry exists precisely so the deleted category can be reconstructed.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::CoreResult;
use crate::money::Money;

/// The To/From category id for an account, with the cloud's legacy fallback.
///
/// The port of `transfer_category_for` (`20260716100000:43-61`). The sentinels
/// are not dead code: `transactions.category` is TEXT with no foreign key (R-3)
/// precisely so that `'transfer-out'` and `'transfer-in'` — which predate the
/// To/From lifecycle — keep resolving.
///
/// The fallback looks unreachable, because C-3's trigger mints a To/From
/// category on every account INSERT and C-5's trigger refuses to let one be
/// deleted while its account exists. It is reachable, and MEASURED so: the
/// lookup is scoped by `user_id`, so a transaction of *this* user filed against
/// *another* user's account resolves to nothing and lands on the sentinel.
/// `probe-transfers2.sh`'s `ctc-source-account-foreign` case produced exactly
/// that — a minted counterpart categorised `transfer-in`.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn transfer_category_for(
    connection: &Connection,
    user_id: &str,
    account_id: &str,
    amount: Money,
) -> CoreResult<String> {
    let found: Option<String> = connection
        .query_row(
            "SELECT id FROM categories
              WHERE user_id = ?1
                AND is_transfer_category = 1
                AND account_id = ?2
              LIMIT 1",
            params![user_id, account_id],
            |record| record.get(0),
        )
        .optional()?;
    Ok(found.unwrap_or_else(|| {
        if amount.minor() < 0 {
            "transfer-out".to_owned()
        } else {
            "transfer-in".to_owned()
        }
    }))
}

/// A category as stored: every column, in the serialised order.
///
/// The three semantic flags are separate booleans because they mean three
/// different things and the schema keeps them apart (`categories_flags_exclusive`
/// says at most one may be set, which is a *constraint* on a triple, not an
/// enum). Collapsing them would invent a fourth state — "none of the above" —
/// that the columns do not have, and would make the audit entry a translation of
/// the row rather than the row.
#[derive(Debug, Clone, Serialize)]
// Five booleans, because the table has five boolean columns. The same reasoning
// `TransactionRow` gives: this is a row, not a designed API.
#[allow(clippy::struct_excessive_bools)]
pub struct CategoryRow {
    /// Primary key.
    pub id: String,
    /// Owner.
    pub user_id: String,
    /// As shown. For a To/From category, `'To/From ' || account.name`, kept in
    /// step by C-4's trigger.
    pub name: String,
    /// `income` | `expense` | `both`. The direction `merge_direction_mismatch`
    /// compares; `both` is the one that takes either side.
    #[serde(rename = "type")]
    pub kind: String,
    /// `type` | `sub` | `detail`. A `type` row is a heading, and nothing may be
    /// merged into or out of one.
    pub level: String,
    /// The category above this one. `ON DELETE CASCADE`, which is why
    /// `merge_source_has_children` refuses rather than orphaning a subtree.
    pub parent_id: Option<String>,
    /// The account this To/From category belongs to (C-3). Locally constrained
    /// to transfer categories only; the cloud has no such constraint.
    pub account_id: Option<String>,
    /// Display only.
    pub color: Option<String>,
    /// Display only.
    pub icon: Option<String>,
    /// A built-in the app files under by itself.
    pub is_system: bool,
    /// An account's To/From category (C-3).
    pub is_transfer_category: bool,
    /// The revaluation leaf a valuation adjustment lands on.
    pub is_revaluation_category: bool,
    /// The import's Unassigned bucket, which means *not categorised at all*
    /// (`20260724100000:21-23`) — the one flag that DECLASSIFIES.
    pub is_unassigned_bucket: bool,
    /// Hidden from the pickers. A closed account's To/From category mirrors this
    /// from its account (C-4).
    pub is_active: bool,
    /// When the row was made.
    pub created_at: String,
    /// When it last changed.
    pub updated_at: String,
}

/// Read one category of this user's, whole.
///
/// `None` is *"unknown category"* — absent, or somebody else's — deliberately not
/// told apart, for the reason [`crate::row::account::read_owned`] gives. A NULL
/// `user_id` stands the owner guard down, which is the cloud's
/// `p_user_id IS NULL OR user_id = p_user_id` and, locally, the whole gate.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_owned(
    connection: &Connection,
    id: &str,
    user_id: Option<&str>,
) -> CoreResult<Option<CategoryRow>> {
    Ok(connection
        .query_row(
            "SELECT id, user_id, name, type, level, parent_id, account_id, color, icon,
                    is_system, is_transfer_category, is_revaluation_category,
                    is_unassigned_bucket, is_active, created_at, updated_at
               FROM categories
              WHERE id = ?1
                AND (?2 IS NULL OR user_id = ?2)",
            params![id, user_id],
            |record| {
                Ok(CategoryRow {
                    id: record.get(0)?,
                    user_id: record.get(1)?,
                    name: record.get(2)?,
                    kind: record.get(3)?,
                    level: record.get(4)?,
                    parent_id: record.get(5)?,
                    account_id: record.get(6)?,
                    color: record.get(7)?,
                    icon: record.get(8)?,
                    is_system: record.get::<_, i64>(9)? != 0,
                    is_transfer_category: record.get::<_, i64>(10)? != 0,
                    is_revaluation_category: record.get::<_, i64>(11)? != 0,
                    is_unassigned_bucket: record.get::<_, i64>(12)? != 0,
                    is_active: record.get::<_, i64>(13)? != 0,
                    created_at: record.get(14)?,
                    updated_at: record.get(15)?,
                })
            },
        )
        .optional()?)
}

/// Every category this login has, in the order the app reads them.
///
/// The port of `planningService.ensureCategories`' query, which is where a
/// signed-in boot's category list actually comes from: `.eq('user_id', …)`,
/// `.order('level')`, `.order('name')`. Three things about it are worth stating
/// because none of them is a guess:
///
/// * **There is no `is_active` filter, and that is deliberate.** A hidden
///   category still has to be in the list: it is what the register's category
///   column resolves an old row's id through, and a closed account's To/From
///   category is hidden by C-4 while its transactions stay exactly where they
///   are. The pickers filter; the read does not.
/// * **`level` sorts as TEXT**, so the order is `detail`, `sub`, `type` —
///   alphabetical, not hierarchical. That is what PostgREST's `.order('level')`
///   does on a text column and therefore what the app has always received; a
///   port that "corrected" it to a hierarchy would be a different list.
/// * **The one type serves both readers.** Unlike an account, a category's
///   audit entry and its listed form want the same sixteen columns — the whole
///   row — so there is one type here and not two. See [`CategoryRow`].
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn list_all(connection: &Connection, user_id: &str) -> CoreResult<Vec<CategoryRow>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH categories USING INDEX idx_categories_user (user_id=?)
    //   USE TEMP B-TREE FOR ORDER BY
    let mut statement = connection.prepare(
        "SELECT id, user_id, name, type, level, parent_id, account_id, color, icon,
                is_system, is_transfer_category, is_revaluation_category,
                is_unassigned_bucket, is_active, created_at, updated_at
           FROM categories
          WHERE user_id = ?1
          ORDER BY level, name, id",
    )?;
    let rows = statement.query_map(params![user_id], |record| {
        Ok(CategoryRow {
            id: record.get(0)?,
            user_id: record.get(1)?,
            name: record.get(2)?,
            kind: record.get(3)?,
            level: record.get(4)?,
            parent_id: record.get(5)?,
            account_id: record.get(6)?,
            color: record.get(7)?,
            icon: record.get(8)?,
            is_system: record.get::<_, i64>(9)? != 0,
            is_transfer_category: record.get::<_, i64>(10)? != 0,
            is_revaluation_category: record.get::<_, i64>(11)? != 0,
            is_unassigned_bucket: record.get::<_, i64>(12)? != 0,
            is_active: record.get::<_, i64>(13)? != 0,
            created_at: record.get(14)?,
            updated_at: record.get(15)?,
        })
    })?;

    let mut categories = Vec::new();
    for category in rows {
        categories.push(category?);
    }
    Ok(categories)
}

/// Does anything sit under this category?
///
/// The port of `EXISTS (SELECT 1 FROM public.categories WHERE parent_id = …)`,
/// which `merge_categories` asks twice — of the source (v1 is leaf-to-leaf) and
/// of the target (transactions belong to a leaf, not to a group).
///
/// Deliberately **not** scoped by owner, because the cloud's is not. MEASURED
/// (`probe-merge3.sh`, `e5`): a child belonging to somebody else still refuses
/// the merge with `merge_source_has_children`. That is the safe direction — the
/// subtree would cascade away with the parent — and a scoped port would delete a
/// category the cloud refuses to touch.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn has_children(connection: &Connection, id: &str) -> CoreResult<bool> {
    let found: i64 = connection.query_row(
        "SELECT EXISTS (SELECT 1 FROM categories WHERE parent_id = ?1)",
        params![id],
        |record| record.get(0),
    )?;
    Ok(found != 0)
}

/// One category, as much of it as the callers' checks need.
pub struct Filing {
    /// Is this an account's To/From category (C-3)?
    pub is_transfer_category: bool,
    /// The account it belongs to, when it is one.
    pub account_id: Option<String>,
}

/// Read a category of this user's, by the id `transactions.category` holds.
///
/// `None` is *"unknown category"*: the id names nothing, or it names something
/// belonging to somebody else. The two are deliberately not told apart, for the
/// reason [`crate::row::account::read_owned`] gives.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn read_filing(
    connection: &Connection,
    category: &str,
    user_id: &str,
) -> CoreResult<Option<Filing>> {
    Ok(connection
        .query_row(
            "SELECT is_transfer_category, account_id
               FROM categories
              WHERE id = ?1
                AND user_id = ?2",
            params![category, user_id],
            |record| {
                Ok(Filing {
                    is_transfer_category: record.get::<_, i64>(0)? != 0,
                    account_id: record.get(1)?,
                })
            },
        )
        .optional()?)
}

/// Is this a category `repair_claimed_transfer` may file the displaced row
/// under?
///
/// The port of `20260805145035:384-391`, condition for condition: the user's
/// own, not a To/From category, active, and not a bare type root. The cloud
/// spells the middle two three-valued (`IS NOT TRUE`, `IS NOT FALSE`) because
/// its columns are nullable; locally both are `NOT NULL … CHECK (x IN (0,1))`,
/// so `= 0` and `= 1` are the same test and the third state does not exist. That
/// is a degeneracy, not a divergence.
///
/// The revaluation flag is deliberately **not** required, and the migration says
/// why (`:381-383`): a category tree that predates the flag can still hold a
/// legitimate 'Account Adjustment' leaf, and the client resolves that same
/// fallback.
///
/// # Errors
/// [`crate::error::CoreError`] if the read fails.
pub fn is_fileable_adjustment(
    connection: &Connection,
    category: &str,
    user_id: &str,
) -> CoreResult<bool> {
    let found: i64 = connection.query_row(
        "SELECT EXISTS (
           SELECT 1 FROM categories
            WHERE id = ?1
              AND user_id = ?2
              AND is_transfer_category = 0
              AND is_active = 1
              AND level <> 'type'
         )",
        params![category, user_id],
        |record| record.get(0),
    )?;
    Ok(found != 0)
}
