//! `update_investment` — the port of a PostgREST `UPDATE`, of the `.single()` on
//! the end of it, and of the read-modify-write in front of it that keeps a
//! position's cost from contradicting the position.
//!
//! # What it is a port OF
//!
//! `InvestmentService.update` (`:258-300`): a conditional `findOne` and then
//!
//! ```text
//! .from('investments').update(columns)
//!   .eq('id', id).eq('user_id', userId).select(SELECTED_COLUMNS).single()
//! ```
//!
//! No RPC. PHASE3-PLAN D-2; [`super::create_investment`] carries the family's
//! argument.
//!
//! # THE READ IN FRONT OF THE WRITE IS THE WHOLE VERB
//!
//! The cloud's own words: *"Quantity and unit cost move `cost_basis` together or
//! not at all — writing one without recomputing the other would leave the row
//! describing a position that was never held."* So when a patch names EITHER
//! figure, the stored row is read, the missing half is taken from it, and all
//! three columns are written together.
//!
//! The cloud reads with a second round trip (`this.findOne(userId, id)`) and can
//! therefore lose a race: a price refresh landing between its read and its write
//! is silently overwritten. Here the read is inside the transaction that does the
//! write, which is `SELECT … FOR UPDATE` without needing to say so, and it is
//! free besides — the audit entry's `before` needs the row anyway. That is a
//! divergence in the file's favour and it is asserted rather than assumed: a
//! contract rule sends quantity alone and checks the cost followed it.
//!
//! **`averageCost` IS `purchase_price`.** The app's `InvestmentChanges` calls it
//! `averageCost`, `toHolding` derives `averageCost` as `costBasis ÷ quantity`,
//! and the COLUMN that holds what one unit cost is `purchase_price`. The
//! writer's own line is `columns.purchase_price = averageCost.toString()`, so the
//! collapse from two app spellings to one column happens in `mappers/writes.ts`
//! beside the goal's `progress ?? currentAmount`, and what arrives here is the
//! column.
//!
//! # ONE presence rule, and it is the writer's `!== undefined`
//!
//! Every field is the `p ? 'k'` class [`super::update_account`] describes:
//! absent means leave it alone, stated means write it, `null` included. Where the
//! column is `NOT NULL` (`symbol`, `name`, `asset_type`, `currency`, `quantity`)
//! a stated null is refused by the file, on both engines.
//!
//! `current_price` and `last_updated` are NOT in this patch, and their absence is
//! the point: a price is what [`super::apply_investment_prices`] writes, from a
//! quote, and an edit dialog that could set one by hand would be a way to make a
//! holding claim a price no exchange ever printed.
//!
//! # It audits — DIVERGENCE 10
//!
//! One `investment/update` entry with `before` and `after`, chained, in the same
//! transaction; the cloud writes none.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult};
use crate::row::investment::{self, InvestmentRow};
use crate::scaled::Scaled8;
use crate::wire::Field;

use super::create_investment::{cost_of, not_found, read_back, NOT_FOUND};

/// The fields an edit may change — `InvestmentChanges` mapped to columns.
///
/// A WHITELIST for the reason [`super::create_investment::InvestmentDraft`] is
/// one, and a narrower one: five keys, where the create has ten.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvestmentPatch {
    /// The ticker, already trimmed and upper-cased by the client.
    #[serde(default)]
    pub symbol: Field<String>,
    /// As shown. Unlike the create, an empty one is stored: an edit that clears
    /// a name is a person deleting text, not a writer filling a blank.
    #[serde(default)]
    pub name: Field<String>,
    /// How many units. Moves `cost_basis` with it.
    #[serde(default)]
    pub quantity: Field<Scaled8>,
    /// What ONE unit cost — the app's `averageCost`. Moves `cost_basis` too.
    #[serde(default)]
    pub purchase_price: Field<Scaled8>,
    /// Three letters.
    #[serde(default)]
    pub currency: Field<String>,
    /// One of eight.
    #[serde(default)]
    pub asset_type: Field<String>,
    /// Free text.
    #[serde(default)]
    pub notes: Field<String>,
}

/// The command: which holding, whose, and what changes.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateInvestment {
    /// The row.
    pub id: String,
    /// Whose. Absent stands the ownership clause down — the cloud RPCs' own
    /// `p_user_id IS NULL OR user_id = p_user_id` shape.
    #[serde(default)]
    pub user_id: Option<String>,
    /// The changes.
    #[serde(default)]
    pub patch: InvestmentPatch,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct UpdateInvestmentResult {
    /// The holding as it now stands.
    pub answer: InvestmentRow,
    /// Dense sequence number of the audit row written for this edit.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// Change one holding and audit it — one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for [`NOT_FOUND`], for a cost basis too large to
/// count, or for a rule the file enforced; [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn update_investment(
    connection: &mut Connection,
    command: UpdateInvestment,
) -> CoreResult<UpdateInvestmentResult> {
    // BEGIN IMMEDIATE: the write lock up front, so the read-then-update below is
    // the cloud's second round trip without its race.
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let owner = command.user_id.as_deref();
    let Some(before) = investment::read_owned(&transaction, &command.id, owner)? else {
        return Err(not_found());
    };

    // The two figures that move `cost_basis` together or not at all. Neither
    // stated means the cost is left exactly as it is — including for a row whose
    // stored cost disagrees with its own figures, which a RESTORE can bring and
    // which an unrelated edit has no business silently correcting.
    let cost = match (
        command.patch.quantity.value(),
        command.patch.purchase_price.value(),
    ) {
        (None, None) => None,
        (quantity, price) => {
            let quantity = quantity.copied().unwrap_or(before.quantity);
            // `?? current.averageCost` in the writer, which is the STORED unit
            // cost — `purchase_price`, not `cost_basis ÷ quantity`. The two agree
            // for every row this verb wrote; where they do not, the column is the
            // figure a person typed and the quotient is arithmetic.
            let price = price.copied().or(before.purchase_price);
            Some(cost_of(quantity, price)?)
        }
    };

    let changed = apply(&transaction, &command, cost, &now)?;
    // Unreachable — the row was found above, inside this transaction — and named
    // rather than silent, exactly as `update_goal` names it.
    if changed != 1 {
        return Err(CoreError::refuse(
            NOT_FOUND,
            "the holding disappeared between finding it and editing it",
        ));
    }

    let after = read_back(&transaction, &command.id, &before.user_id)?;

    let entry = audit::write(
        &transaction,
        &before.user_id,
        "investment",
        &command.id,
        Action::Update,
        Some(&super::json_of(&before)?),
        Some(&super::json_of(&after)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(UpdateInvestmentResult {
        answer: after,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// The UPDATE itself: every column a `CASE WHEN stated THEN … ELSE column END`,
/// which is the SQL shape of the writer's `if (changes.x !== undefined)`.
fn apply(
    transaction: &rusqlite::Transaction<'_>,
    command: &UpdateInvestment,
    cost: Option<crate::money::Money>,
    now: &str,
) -> CoreResult<usize> {
    Ok(transaction.execute(
        "UPDATE investments SET
           symbol             = CASE WHEN ?3  THEN ?4  ELSE symbol END,
           name               = CASE WHEN ?5  THEN ?6  ELSE name END,
           quantity_e8        = CASE WHEN ?7  THEN ?8  ELSE quantity_e8 END,
           purchase_price_e8  = CASE WHEN ?9  THEN ?10 ELSE purchase_price_e8 END,
           currency           = CASE WHEN ?11 THEN ?12 ELSE currency END,
           asset_type         = CASE WHEN ?13 THEN ?14 ELSE asset_type END,
           notes              = CASE WHEN ?15 THEN ?16 ELSE notes END,
           cost_basis_minor   = CASE WHEN ?17 THEN ?18 ELSE cost_basis_minor END,
           updated_at         = ?19
         WHERE id = ?1
           AND (?2 IS NULL OR user_id = ?2)",
        params![
            command.id,
            command.user_id,
            command.patch.symbol.is_present(),
            command.patch.symbol.value(),
            command.patch.name.is_present(),
            command.patch.name.value(),
            command.patch.quantity.is_present(),
            command.patch.quantity.value().map(|q| q.raw()),
            command.patch.purchase_price.is_present(),
            command.patch.purchase_price.value().map(|p| p.raw()),
            command.patch.currency.is_present(),
            command.patch.currency.value(),
            command.patch.asset_type.is_present(),
            command.patch.asset_type.value(),
            command.patch.notes.is_present(),
            command.patch.notes.value(),
            cost.is_some(),
            cost.map(crate::money::Money::minor),
            now,
        ],
    )?)
}
