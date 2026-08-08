//! `confirm_transaction_categories` — *"yes, that guess was right"*.
//!
//! # What it is a port OF
//!
//! `supabase/migrations/20260808100000_category_provenance.sql:440-478`. New in
//! that migration and never redefined; the client calls it at exactly one place
//! (`transactionService.ts:867`).
//!
//! # The verb that is safe by SUBTRACTION
//!
//! `20260808100000:426-435` states the design and it is the whole point: *"It
//! takes NO category argument. That is a safety property, not an oversight —
//! confirming is agreeing with what is already stored, so this function is
//! incapable of changing a category (let alone an amount) no matter who calls it
//! or what they pass."*
//!
//! That is the same shape as `verbs/mod.rs`'s note about `set_account_balance`:
//! the guarantee comes from the absence of an argument, and it survives every
//! future edit that does not re-add one. This port keeps the absence — the
//! command struct has two fields, and there is nowhere to put a category.
//!
//! # Which rows it touches, MEASURED
//!
//! `probe-cat1.sh`, 2026-08-08, over five rows covering every state the WHERE
//! clause distinguishes:
//!
//! ```text
//! c1  blank / NULL / whitespace category   -> SKIPPED (nothing to vouch for)
//!     a filed row already confirmed        -> SKIPPED (re-confirming is free)
//!     a filed row not yet confirmed        -> confirmed; count 1; ONE audit row
//! c5  the same id twice                    -> 1
//! c6  an id nobody has                     -> 0, no writes
//! c7  somebody else's row                  -> 0, no writes
//! c9  a category id that resolves to NOTHING -> CONFIRMED anyway
//! ```
//!
//! `c9` is the interesting one. The guard is `category IS NOT NULL AND
//! btrim(category) <> ''` — a *blankness* test, not an existence test. A row
//! filed under a category that has since been deleted is still "filed" as far as
//! this function is concerned, and confirming it records that the user agreed
//! with a dangling id. That is deliberate at the schema level (R-3:
//! `transactions.category` is TEXT with no foreign key, precisely so the legacy
//! `'transfer-in'`/`'transfer-out'` sentinels keep resolving), so a port that
//! demanded the category exist would refuse to confirm every transfer in the
//! file.
//!
//! # A split parent is skipped, and that is structural rather than lucky
//!
//! `c8`: a split parent's category is blank BY DESIGN, so the blankness guard
//! excludes it before anything is written. Compare
//! [`super::apply_category_to_uncategorized`], where the same blankness is what
//! *selects* the row and the live cloud function has lost the `AND NOT is_split`
//! that used to save it. Two functions, one property of split parents, opposite
//! consequences — and only one of them needs a guard it no longer has.
//!
//! # Which guard it holds: none, and structurally so
//!
//! It writes `category_confirmed` and `updated_at`. Every split trigger in
//! `schema.sql` is `BEFORE UPDATE OF <column>` over a list containing `is_split`,
//! `amount_minor`, `type` and `category` — neither of the two columns this verb
//! writes appears in any of them, so no trigger is even consulted. MEASURED
//! (`probe-local-triggers.mjs`, `l7`: flipping the flag on a split parent is
//! accepted with nothing held).
//!
//! # Balance-neutral and category-neutral
//!
//! One boolean and a timestamp. `c1` asserts the account balance is unmoved,
//! which for a verb with no amount in it is not a formality: it is the difference
//! between "no arithmetic in the code" and "no arithmetic in the file".

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::row::{self, TransactionRow};

/// The command. `(p_ids, p_user_id)` as one object — and deliberately nothing
/// else. See the module docs.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConfirmTransactionCategories {
    /// `p_ids`. Every row the user is agreeing with.
    #[serde(default)]
    pub ids: Option<Vec<String>>,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The RPC returns a bare integer — *"the number of decisions actually
/// recorded"*.
#[derive(Debug, Serialize)]
pub struct ConfirmTransactionCategoriesResult {
    /// The FIRST row named, as stored after the call.
    pub transaction: Option<TransactionRow>,
    /// How many rows were actually confirmed. Rows already confirmed, and rows
    /// with nothing filed, are not counted, because no write happened.
    pub confirmed: i64,
    /// Those rows, as stored, in the order they were written (by id).
    pub transactions: Vec<TransactionRow>,
    /// Dense sequence number of the LAST audit row written, when any was.
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    pub audit_row_hash: Option<String>,
}

/// Record that the user agrees with the suggested category on these rows.
///
/// # Errors
/// [`CoreError::Refused`] for a rule the file enforced; [`CoreError::Storage`]
/// for a fault. There is no named refusal: every id that does not qualify is
/// skipped, which is what makes the returned count the number of decisions
/// recorded rather than the number of ids sent.
#[allow(clippy::needless_pass_by_value)]
pub fn confirm_transaction_categories(
    connection: &mut Connection,
    command: ConfirmTransactionCategories,
) -> CoreResult<ConfirmTransactionCategoriesResult> {
    let named = command.ids.clone().unwrap_or_default();
    if named.is_empty() {
        return Ok(ConfirmTransactionCategoriesResult {
            transaction: None,
            confirmed: 0,
            transactions: Vec::new(),
            audit_seq: None,
            audit_row_hash: None,
        });
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    let mut confirmed = Vec::new();
    let mut entry = None;
    for id in super::distinct_ids(&named) {
        let Some(before) = row::read_owned_transaction(&write, id, owner)? else {
            continue;
        };
        if before.category_confirmed {
            continue;
        }
        // A blank category has nothing to vouch for. Guarded here as well as in
        // the app so a stale client list cannot mark empty rows "checked".
        if super::is_blank_category(before.category.as_deref()) {
            continue;
        }

        let changed = write.execute(
            "UPDATE transactions
                SET category_confirmed = 1,
                    updated_at = ?1
              WHERE id = ?2",
            params![now, before.id],
        )?;
        if changed != 1 {
            return Err(CoreError::refuse(
                "transaction_not_found",
                "a transaction being confirmed disappeared between finding it and writing it",
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
        confirmed.push(after);
    }

    let first = named
        .first()
        .map(|id| row::read_owned_transaction(&write, id, None))
        .transpose()?
        .flatten();

    let count = super::count(confirmed.len())?;

    write.commit()?;

    Ok(ConfirmTransactionCategoriesResult {
        transaction: first,
        confirmed: count,
        transactions: confirmed,
        audit_seq: entry.as_ref().map(|entry| entry.seq),
        audit_row_hash: entry.map(|entry| entry.row_hash),
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::ConfirmTransactionCategories;

    #[test]
    fn there_is_nowhere_to_put_a_category() {
        // The safety property is the ABSENCE of the argument, so the test is
        // that sending one is refused rather than ignored.
        let error =
            serde_json::from_str::<ConfirmTransactionCategories>(r#"{"ids":["a"],"category":"x"}"#)
                .expect_err("a category has no place in this command");
        assert!(error.to_string().contains("`category`"), "{error}");
    }

    #[test]
    fn a_null_list_and_an_absent_one_are_both_accepted() {
        let null: ConfirmTransactionCategories =
            serde_json::from_str(r#"{"ids": null}"#).expect("a null list");
        assert!(null.ids.is_none());
        let absent: ConfirmTransactionCategories = serde_json::from_str("{}").expect("absent");
        assert!(absent.ids.is_none());
    }
}
