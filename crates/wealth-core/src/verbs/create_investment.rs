//! `create_investment` — a position, and the one figure on it that is derived
//! rather than told.
//!
//! # What it is a port OF
//!
//! `InvestmentService.create` (`:224-256`). No RPC: `investments` is one of the
//! tables the cloud writes DIRECTLY over PostgREST — PHASE3-PLAN D-2, argued in
//! full at the head of [`super`], and this is the sixth family to reach it after
//! accounts, categories, budgets, goals and dismissals.
//!
//! ```text
//! const costBasis = draft.quantity.times(draft.averageCost);
//! .from('investments').insert({
//!    user_id, account_id,
//!    symbol: draft.symbol.trim().toUpperCase(),
//!    name: draft.name.trim() || draft.symbol.trim().toUpperCase(),
//!    quantity: draft.quantity.toString(),
//!    cost_basis: costBasis.toString(),
//!    purchase_price: draft.averageCost.toString(),
//!    purchase_date: …?.toISOString().slice(0, 10) ?? null,
//!    currency, asset_type: draft.assetType ?? 'stock', notes: draft.notes ?? null
//! }).select(SELECTED_COLUMNS).single()
//! ```
//!
//! # COST BASIS IS DERIVED HERE, AND THAT IS WHY THE PAYLOAD HAS NO KEY FOR IT
//!
//! The writer's own comment states the rule and the reason: *"`cost_basis` is
//! DERIVED from quantity × averageCost rather than stored beside it: two numbers
//! that must agree are two numbers that will not."* The cloud does the
//! multiplication in JavaScript with `Decimal` and sends the answer; this verb
//! does it in `i128` and stores the answer. **Neither takes a `cost_basis` from a
//! caller**, and this payload has no field for one, so a caller cannot state a
//! cost that contradicts the position it describes.
//!
//! The arithmetic lives in [`crate::scaled::market_value_minor`], which rounds
//! HALF-AWAY-FROM-ZERO because that is what `numeric(10,2)` does to the same
//! product in the cloud. Three units at £12.345 cost £37.035, which is £37.04 in
//! both engines and −£37.04 for the same position held short. `schema.sql`
//! anticipated this exact computation: *"`cost_basis_minor` likewise [computed]
//! in the command layer in i128, rounded half-up to minor units, and stored"*.
//!
//! A position bought at no stated price costs nothing — `purchase_price` absent
//! means `cost_basis_minor` is zero, which is the column's own default and is
//! what the cloud's `quantity.times(undefined)` case cannot even reach (the
//! app's `InvestmentDraft.averageCost` is required). It is written out rather
//! than refused because a RESTORE brings rows this verb never wrote.
//!
//! # THE SYMBOL IS THE CLIENT'S TO UPPER-CASE
//!
//! `draft.symbol.trim().toUpperCase()` happens in `investmentService.ts`, before
//! either engine sees it, exactly as `accountTypeToDb`'s 'current' → 'checking'
//! rename does for an account (`columns.ts` states the rule: *"a verb that
//! renamed it would be a second opinion about what a payload means"*). So the
//! crate stores the text it is given. What it does NOT do is accept an empty
//! one: `symbol` is `NOT NULL` in both schemas, and an empty string is a symbol
//! nothing can be priced under — so `''` is refused by name here rather than
//! stored, because a CHECK for it exists in neither engine.
//!
//! # `name` FALLS BACK TO THE SYMBOL
//!
//! `draft.name.trim() || draft.symbol.trim().toUpperCase()` — FALSY, so an empty
//! name becomes the ticker rather than being stored. Reproduced with
//! [`null_if_empty`], the same helper [`super::create_goal`] uses for its own
//! falsy pair.
//!
//! # It audits — DIVERGENCE 10, a third time
//!
//! One `investment/create` entry, chained, in the same transaction; the cloud
//! writes none. [`super::create_budget`] carries the argument in full, and it
//! applies here with more force than it does to a budget: PHASE1-PLAN §2.2's
//! question is *"what changed that figure"*, and a holding's quantity is a figure
//! whose last edit decides what a portfolio is worth.
//!
//! # No guard, measured
//!
//! An INSERT into `investments`. `schema.sql` has no trigger on that table, and
//! `trg_unnest_account_references` — the one trigger that could reach it — is
//! `BEFORE DELETE ON accounts` and does not name this table at all (the R-12
//! composite key handles a deleted account by cascading). `tests/investment_family.rs`
//! asserts the guard table empty across a create.

use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use crate::audit::{self, Action};
use crate::db;
use crate::error::{CoreError, CoreResult, Refusal};
use crate::money::Money;
use crate::row::investment::{self, InvestmentRow};
use crate::scaled::{self, Scaled8};
use crate::wire::null_if_empty;

/// The asset kind a holding is born with when the caller states none — the
/// cloud writer's `draft.assetType ?? 'stock'`, named here because the COLUMN's
/// own default is not one (it is `NOT NULL` with no default in both schemas).
const DEFAULT_ASSET_TYPE: &str = "stock";

/// One holding as `InvestmentService.create` sends it, plus the owner.
///
/// Every key that writer can produce and not one more — a WHITELIST, so a field
/// it has no line for never reaches the cloud's table either. `cost_basis` is
/// deliberately absent; see the module docs.
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvestmentDraft {
    /// Client-minted, or minted here when absent — B-5.
    #[serde(default)]
    pub id: Option<String>,
    /// The investment account. `NOT NULL` on the app's own path; nullable in
    /// both schemas because a restore may bring a row without one.
    #[serde(default)]
    pub account_id: Option<String>,
    /// The ticker, already trimmed and upper-cased by the client.
    #[serde(default)]
    pub symbol: Option<String>,
    /// As shown. Falls back to the symbol — see the module docs.
    #[serde(default)]
    pub name: Option<String>,
    /// How many units. `NOT NULL`, no default.
    #[serde(default)]
    pub quantity: Option<Scaled8>,
    /// What ONE unit cost. `cost_basis` is derived from it and `quantity`.
    #[serde(default)]
    pub purchase_price: Option<Scaled8>,
    /// `YYYY-MM-DD`, when the buyer wrote one down.
    #[serde(default)]
    pub purchase_date: Option<String>,
    /// Three letters. Defaults to the column's 'GBP'.
    #[serde(default)]
    pub currency: Option<String>,
    /// One of eight. Defaults to 'stock' — the WRITER's default, not a column's.
    #[serde(default)]
    pub asset_type: Option<String>,
    /// Free text.
    #[serde(default)]
    pub notes: Option<String>,
}

/// The command: one holding, and whose.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateInvestment {
    /// Owner. `NOT NULL` and a foreign key in both engines.
    pub user_id: String,
    /// The holding, flattened into the command so the payload is the object the
    /// cloud's insert literally is, plus the owner.
    #[serde(flatten)]
    pub investment: InvestmentDraft,
}

/// What the verb hands back.
#[derive(Debug, Serialize)]
pub struct CreateInvestmentResult {
    /// The holding as stored — the same projection `list_investments` answers
    /// with, so a caller can put it straight into state without re-reading.
    pub answer: InvestmentRow,
    /// Dense sequence number of the audit row written for this create.
    pub audit_seq: i64,
    /// Its chained hash.
    pub audit_row_hash: String,
}

/// The code an empty symbol is refused under.
pub(super) const SYMBOL_REQUIRED: &str = "investment_symbol_required";

/// Store one holding and audit it — one SQLite transaction, or none of it.
///
/// # Errors
/// [`CoreError::Refused`] for [`SYMBOL_REQUIRED`], for a cost basis too large to
/// count, or for a rule the file enforced — `investments_asset_type_check`, the
/// currency length CHECK, the quantity and cost bounds, the purchase-date shape,
/// the accounts or users foreign key, a `NOT NULL` column nobody filled in;
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn create_investment(
    connection: &mut Connection,
    command: CreateInvestment,
) -> CoreResult<CreateInvestmentResult> {
    // Everything that can refuse without touching the file, before the file is
    // touched — the shape every write verb in this crate keeps.
    let symbol = null_if_empty(command.investment.symbol.as_deref())
        .ok_or_else(symbol_required)?
        .to_owned();
    let quantity = command.investment.quantity.unwrap_or(Scaled8::ZERO);
    let cost_basis = cost_of(quantity, command.investment.purchase_price)?;

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&transaction)?;

    let id = super::minted_uuid(command.investment.id.as_deref());
    // `draft.name.trim() || symbol` — falsy, so an empty name is the ticker.
    let name = null_if_empty(command.investment.name.as_deref()).unwrap_or(&symbol);

    transaction.execute(
        "INSERT INTO investments (
           id, user_id, account_id, symbol, name, asset_type, currency,
           quantity_e8, cost_basis_minor, current_price_e8, purchase_date,
           purchase_price_e8, last_updated, notes, created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, COALESCE(?6, ?7), COALESCE(?8, 'GBP'),
           ?9, ?10, NULL, ?11,
           ?12, NULL, ?13, ?14, ?14
         )",
        params![
            id,
            command.user_id,
            null_if_empty(command.investment.account_id.as_deref()),
            symbol,
            name,
            null_if_empty(command.investment.asset_type.as_deref()),
            DEFAULT_ASSET_TYPE,
            null_if_empty(command.investment.currency.as_deref()),
            quantity.raw(),
            cost_basis.minor(),
            null_if_empty(command.investment.purchase_date.as_deref()),
            command.investment.purchase_price.map(Scaled8::raw),
            command.investment.notes,
            now,
        ],
    )?;

    // Read back rather than reconstructed, for the reason `create_transaction`
    // states about `to_jsonb(v_tx)`: the audit's `after` and the caller's answer
    // must be what storage holds, defaults and CHECKs and all.
    let stored = read_back(&transaction, &id, &command.user_id)?;
    let entry = audit::write(
        &transaction,
        &command.user_id,
        "investment",
        &id,
        Action::Create,
        None,
        Some(&super::json_of(&stored)?),
        &now,
    )?;

    transaction.commit()?;

    Ok(CreateInvestmentResult {
        answer: stored,
        audit_seq: entry.seq,
        audit_row_hash: entry.row_hash,
    })
}

/// `quantity × unit price` as the money a position cost.
///
/// Shared with [`super::update_investment`], which has to recompute it whenever
/// either figure moves — the cloud does the same and says why: *"Quantity and
/// unit cost move `cost_basis` together or not at all; writing one without
/// recomputing the other would leave the row describing a position that was
/// never held."* One function, so the two verbs cannot round it two ways.
pub(super) fn cost_of(quantity: Scaled8, unit_price: Option<Scaled8>) -> CoreResult<Money> {
    let Some(price) = unit_price else {
        return Ok(Money::ZERO);
    };
    scaled::market_value_minor(quantity.raw(), price.raw())
        .map(Money::from_minor)
        .ok_or_else(|| {
            CoreError::refuse(
                "investment_cost_out_of_range",
                "that quantity at that price is more money than this ledger can count",
            )
        })
}

/// The stored holding, or the refusal for a row that vanished between writing it
/// and reading it back — unreachable, and named rather than unwrapped.
pub(super) fn read_back(
    transaction: &rusqlite::Transaction<'_>,
    id: &str,
    user_id: &str,
) -> CoreResult<InvestmentRow> {
    investment::read_owned(transaction, id, Some(user_id))?.ok_or_else(|| {
        CoreError::refuse(
            NOT_FOUND,
            "the holding disappeared between writing it and reading it back",
        )
    })
}

/// The code every investment verb refuses a missing row under.
pub(super) const NOT_FOUND: &str = "investment_not_found";

/// The prose a person reads when one does — `InvestmentService.update`'s own
/// sentence, for the reason [`super::create_budget::NOT_FOUND_MESSAGE`] gives:
/// the words come from the TypeScript writer this family ports, because there is
/// no Postgres function to take them from.
pub(super) const NOT_FOUND_MESSAGE: &str = "That holding no longer exists — reload the page.";

/// The refusal itself, so three verbs cannot word it three ways.
pub(super) fn not_found() -> CoreError {
    CoreError::Refused(Refusal::named(NOT_FOUND, NOT_FOUND_MESSAGE).with_hint(
        "That holding no longer exists, or is not yours. Reload the page and try again.",
    ))
}

/// The refusal for a holding with no symbol.
fn symbol_required() -> CoreError {
    CoreError::Refused(
        Refusal::named(
            SYMBOL_REQUIRED,
            "A holding needs a symbol — there is nothing to price it under.",
        )
        .with_hint("Enter the ticker the position is quoted under, such as SHEL.L."),
    )
}
