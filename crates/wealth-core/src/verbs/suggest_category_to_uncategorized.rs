//! `suggest_category_to_uncategorized` — payee memory's fan-out, as the GUESS
//! it is.
//!
//! # Why a second verb exists beside [`super::apply_category_to_uncategorized`]
//!
//! The two verbs share a skeleton — fill the blanks among the named rows, skip
//! split parents, audit each row — and differ in exactly one thing: what the
//! write MEANS.
//!
//! `apply_category_to_uncategorized` is the DELIBERATE bulk verb. The user
//! chose a population (Categorise by payee, a report drill's blanks) and
//! pressed the button, so the rows arrive `category_confirmed = 1` and their
//! review ends (`needs_review = 0`) — the owner's ruling of 1 Sep 2026, which
//! its module docs carry in full, and which
//! `verb-specs/apply-filing-a-payee-vouches-for-it.spec.mjs` states as "a bulk
//! filing is a decision, not a suggestion".
//!
//! This verb is the OTHER case, ruled on 11 Sep 2026. The user acted on ONE
//! row; payee memory extrapolated to the rest of the payee. Reviewing his
//! card's feed, the owner confirmed one suggestion and watched the sibling
//! rows vanish from To Review "without my doing anything and without me
//! actually confirming I agreed" — the fan-out was travelling through the
//! deliberate verb and vouching on his behalf. His ruling: the auto-populate
//! is welcome, "but they should stay on the 'review list' as I have not
//! reviewed them yet."
//!
//! An extrapolation is a guess, and the schema has a shape for a guess
//! already — `category_confirmed = 0`, the shape every feed suggestion arrives
//! in (20260808100000) — so that is what this verb writes, and the row wears
//! the same Suggested badge every other machine guess wears.
//!
//! # Why `needs_review` is SET to 1 rather than left alone
//!
//! Every row this verb touches was blank, so it sat in To Review under the
//! unfiled arm of `transactionReview.ts`. Gaining a category lifts that arm —
//! which would drop the row off the list at the very moment it acquires
//! something worth checking. Setting the flag keeps the row where the reader
//! will look. It is also the truthful value: `needs_review` means "arrived and
//! nobody has dealt with it", and a machine guess is not anybody dealing with
//! it.
//!
//! # Everything else is its sibling's behaviour, on purpose
//!
//! Fill-blanks only (`category IS NULL OR btrim(category) = ''` — three shapes
//! of blank), a row that already has a category is never touched, an unknown
//! id is skipped rather than refused, a duplicate id fills once, an empty or
//! NULL list is a zero with no writes, `p_category` is written verbatim with
//! no validation, and a split parent among the ids is SKIPPED — the same
//! `continue`, for the same reason its sibling's module docs argue at length.
//! No `_rpc_guard` is held, and must not be.
//!
//! Cloud twin: `20260911100000_a_machine_guess_stays_a_guess.sql`.
//!
//! # Balance-neutral
//!
//! `category`, `category_confirmed`, `needs_review`, `updated_at`. No amount,
//! no account, no arithmetic.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::row::{self, WrittenTransaction};

/// The command. `(p_ids, p_category, p_user_id)` as one object.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SuggestCategoryToUncategorized {
    /// `p_ids`. The rows the client believes are still blank.
    ///
    /// `Option<Vec<…>>` so a caller sending `null` is a zero on both engines
    /// rather than a deserialiser error on one — the same reason its sibling
    /// gives.
    #[serde(default)]
    pub ids: Option<Vec<String>>,
    /// `p_category`. Written verbatim. `Option` because SQL NULL is a value the
    /// sibling accepts and stores, and the two must not drift.
    #[serde(default)]
    pub category: Option<String>,
    /// `p_user_id`. Absent means "name no owner".
    #[serde(default)]
    pub user_id: Option<String>,
}

/// What the verb hands back.
///
/// The RPC returns a bare integer. `suggested` is that integer.
#[derive(Debug, Serialize)]
pub struct SuggestCategoryToUncategorizedResult {
    /// The FIRST row named, as stored after the call — the house key the
    /// harness compares field by field across both engines. `None` when the
    /// caller named nothing, or named an id nobody has.
    pub transaction: Option<WrittenTransaction>,
    /// How many rows were actually written with the guess.
    pub suggested: i64,
    /// Those rows, as stored, in the order they were written (by id).
    pub transactions: Vec<WrittenTransaction>,
    /// Dense sequence number of the LAST audit row written, when any was.
    pub audit_seq: Option<i64>,
    /// Its chained hash.
    pub audit_row_hash: Option<String>,
}

/// Write a category as a GUESS onto every named row that is still blank and
/// not split — `category_confirmed = 0`, `needs_review = 1` — and audit each
/// one.
///
/// # Errors
/// [`CoreError::Refused`] for a rule the file enforced; [`CoreError::Storage`]
/// for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn suggest_category_to_uncategorized(
    connection: &mut Connection,
    command: SuggestCategoryToUncategorized,
) -> CoreResult<SuggestCategoryToUncategorizedResult> {
    let named = command.ids.clone().unwrap_or_default();
    if named.is_empty() {
        return Ok(SuggestCategoryToUncategorizedResult {
            transaction: None,
            suggested: 0,
            transactions: Vec::new(),
            audit_seq: None,
            audit_row_hash: None,
        });
    }

    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;
    let owner = command.user_id.as_deref();

    let mut written = Vec::new();
    let mut entry = None;
    for id in super::distinct_ids(&named) {
        let Some(before) = row::read_owned_transaction(&write, id, owner)? else {
            continue;
        };
        if !super::is_blank_category(before.category.as_deref()) {
            continue;
        }
        // The sibling's split skip, verbatim in spirit: a split parent's
        // category is blank BY DESIGN, and a row the cursor's WHERE clause
        // does not select is a row nobody was going to write.
        if before.is_split {
            continue;
        }

        let changed = write.execute(
            // The whole difference from apply_category_to_uncategorized: a
            // guess (`category_confirmed = 0`), on a row that still wants
            // eyes (`needs_review = 1`).
            "UPDATE transactions
                SET category = ?1,
                    category_confirmed = 0,
                    needs_review = 1,
                    updated_at = ?2
              WHERE id = ?3",
            params![command.category, now, before.id],
        )?;
        if changed != 1 {
            return Err(CoreError::refuse(
                "transaction_not_found",
                "a transaction being suggested to disappeared between finding it and writing it",
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
        written.push(row::written(&write, after)?);
    }

    // The first id the CALLER named, not the first in id order — the same
    // projection the sibling makes, for the same reason.
    let first = named
        .first()
        .map(|id| row::read_owned_transaction(&write, id, None))
        .transpose()?
        .flatten()
        .map(|row| row::written(&write, row))
        .transpose()?;

    let suggested = super::count(written.len())?;

    write.commit()?;

    Ok(SuggestCategoryToUncategorizedResult {
        transaction: first,
        suggested,
        transactions: written,
        audit_seq: entry.as_ref().map(|entry| entry.seq),
        audit_row_hash: entry.map(|entry| entry.row_hash),
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::SuggestCategoryToUncategorized;

    #[test]
    fn a_null_category_is_a_value_and_not_an_absence() {
        let command: SuggestCategoryToUncategorized =
            serde_json::from_str(r#"{"ids":["a"],"category":null}"#).expect("null is a value here");
        assert!(command.category.is_none());
    }

    #[test]
    fn the_command_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<SuggestCategoryToUncategorized>(r#"{"categories":"x"}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("`categories`"), "{error}");
    }
}
