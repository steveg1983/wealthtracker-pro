//! The backup format, and how one of its rows becomes a row in this file.
//!
//! # What this module is a port of, and what it deliberately is not
//!
//! It is the translation half of `restore_user_chunk`
//! (`supabase/migrations/20260807083000_user_data_restore.sql:230-374`) — the
//! part that takes *whole rows* out of a backup and puts them in a table.
//!
//! It is **not** a port of `backupService.remapBackupIds`. That runs on the
//! CLIENT, before a single row is sent, and the RPCs insert what they are handed
//! verbatim (`:279-294` re-owns and strips columns; it never touches an `id`).
//! The boundary matters enough to state twice: **ids arrive already remapped, or
//! they do not arrive remapped at all.** Nothing here invents an id, rewrites a
//! reference or resolves a dangling one, because the function it ports does none
//! of those things — and a Rust copy of the remapper would be a second
//! implementation of a rule the TypeScript already owns, drifting from it the
//! first time a column is added.
//!
//! # The column list is not written twice
//!
//! The cloud hands each row to `jsonb_populate_recordset` against the table's own
//! rowtype rather than naming columns, and the migration explains why at length:
//! *"Naming them was the first draft and it was wrong within the hour"*. SQLite
//! has no such facility, so the names are written down here — once, in one table
//! per entity, with the cloud's key on the left and this schema's column on the
//! right. That table IS the map between the two schemas, and it is the only
//! place either name appears.
//!
//! Every column name in an INSERT built here comes from a `&'static str` in that
//! table. No caller value is ever concatenated into SQL; values travel as bound
//! parameters. DESIGN.md §6.4's *"you cannot bypass what does not exist"* holds
//! through the one verb that takes arbitrary JSON.
//!
//! # Four things the cloud does that this must do differently
//!
//! 1. **Scale.** `numeric(20,2)` becomes `INTEGER` minor units, quantities and
//!    prices become `_e8`, `alert_threshold` becomes basis points. Each is a
//!    [`Kind`] and each is exact: a decimal string is scaled by integer
//!    arithmetic and a value with more places than the column can hold is
//!    REFUSED, never rounded ([`crate::money`] makes the same choice for the same
//!    reason).
//! 2. **Arrays.** `transactions.tags` and `suggestion_dismissals.subject_ids` are
//!    `text[]` and `uuid[]` in the cloud and child tables here. They are written
//!    after their parent row, in the same transaction.
//! 3. **Money in `metadata`.** DESIGN.md §5 divergence 9, *"the one most likely
//!    to bite: it is a hard failure on real data"*. `transactions_no_money_in_metadata`
//!    refuses eleven keys that a cloud backup legitimately carries. Four have a
//!    typed home and are PROMOTED into it; the other eight are dropped and every
//!    drop is REPORTED. See [`strip_metadata_money`].
//! 4. **Absent keys.** The cloud refuses a row missing any NOT NULL key, because
//!    `jsonb_populate_recordset` supplies SQL NULL rather than the column's
//!    default — MEASURED: a row with no `low_balance_alert_enabled` is refused
//!    even though the column has a default. Here an absent (or JSON null) key
//!    simply omits the column, so the local default applies where there is one
//!    and the NOT NULL fires where there is not. The set of rows refused is
//!    therefore SMALLER locally, and the difference is reachable only from a
//!    hand-edited file: both exporters in this repo write whole rows, which is
//!    the contract the migration states. The columns that carry meaning — `name`,
//!    `amount`, `date`, `description`, `account_id` — have no default on either
//!    engine and are refused on both.
//!
//! # Unknown keys are ignored, because they are ignored in the cloud
//!
//! MEASURED: `jsonb_populate_recordset` silently discards a key that is not a
//! column. A row carrying `a_column_that_does_not_exist` inserts fine. So does
//! one here. That is not a preference — a stricter local reading would refuse
//! files the cloud accepts, including every backup taken before a column was
//! dropped.
//!
//! All examples in this file are invented.

use std::collections::BTreeSet;

use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, ToSql};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::{CoreError, CoreResult};

/// One row out of a backup file: the whole JSON object, keys as the cloud
/// spells them.
pub type BackupRow = Map<String, Value>;

/// Something the file carried that this ledger has nowhere to keep.
///
/// Reported rather than lost in silence. The cloud produces none of these — it
/// has the column, or it has no constraint — so a spec that provokes one
/// declares the divergence.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Dropped {
    /// Which table the row was going into.
    pub entity: String,
    /// The row's own id, as the file spells it.
    pub id: String,
    /// What was dropped, and why it had nowhere to go.
    pub what: String,
}

// ── Scales ──────────────────────────────────────────────────────────────────

/// How a JSON value becomes a column value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// TEXT, verbatim. Ids, names, enumerations, currency codes.
    Text,
    /// `boolean` → `INTEGER` 0/1. Accepts what Postgres's boolean cast accepts,
    /// through [`crate::wire::Flag`], so `"true"` works as well as `true`.
    Flag,
    /// `integer` → `INTEGER`. `statement_sequence`, `sort_order`, `role_order`.
    Ordinal,
    /// A decimal scaled by a power of ten: money (2), quantity and price (8),
    /// `alert_threshold` as basis points (2). More places than the scale can
    /// hold is a refusal, never a rounding.
    Scaled(u32),
    /// A calendar day, `YYYY-MM-DD`.
    Date,
    /// An instant, normalised to the shape this schema's column defaults use.
    Timestamp,
    /// A JSON document, stored as TEXT.
    Json,
}

/// One column of one entity: the key the file uses, the column this file has,
/// and how to get from one to the other.
#[derive(Debug, Clone, Copy)]
pub struct Column {
    /// The key in the backup row — the cloud's column name.
    pub key: &'static str,
    /// The column in `schema.sql`.
    pub column: &'static str,
    /// The conversion.
    pub kind: Kind,
}

const fn text(key: &'static str) -> Column {
    Column { key, column: key, kind: Kind::Text }
}
const fn flag(key: &'static str) -> Column {
    Column { key, column: key, kind: Kind::Flag }
}
const fn ordinal(key: &'static str) -> Column {
    Column { key, column: key, kind: Kind::Ordinal }
}
const fn date(key: &'static str) -> Column {
    Column { key, column: key, kind: Kind::Date }
}
const fn stamp(key: &'static str) -> Column {
    Column { key, column: key, kind: Kind::Timestamp }
}
const fn json(key: &'static str) -> Column {
    Column { key, column: key, kind: Kind::Json }
}
/// `numeric(20,2)` → `_minor`.
const fn money(key: &'static str, column: &'static str) -> Column {
    Column { key, column, kind: Kind::Scaled(2) }
}
/// `numeric(20,8)` → `_e8`.
const fn eight(key: &'static str, column: &'static str) -> Column {
    Column { key, column, kind: Kind::Scaled(8) }
}

// ── The column maps ─────────────────────────────────────────────────────────
//
// One `const` per entity, and each is the map between two schemas: the cloud's
// key on the left of every entry, this file's column on the right. They are
// items rather than array literals inside the match because a `const fn` cannot
// hand out a reference to a temporary — and `columns()` stays `const` so the
// match is exhaustive at compile time, which is canonical invariant #125: a new
// backup entity without a recorded storage decision does not build.

        // `plaid_account_id` and `plaid_connection_id` are absent on
        // purpose: the RPC strips both (`:282`) because they are GLOBALLY
        // unique and restoring them collides with whoever exported the file.
        // This schema has no such columns at all, so the strip is structural.
        // `parent_account_id` is absent for the other reason — it is
        // deferred to `finalize_user_restore`, which is where the cycle
        // closes.
const ACCOUNTS: &[Column] = &[
            text("id"),
            text("name"),
            text("type"),
            text("currency"),
            money("balance", "balance_minor"),
            money("initial_balance", "initial_balance_minor"),
            money("bank_balance", "bank_balance_minor"),
            date("bank_balance_date"),
            date("last_reconciled_date"),
            flag("low_balance_alert_enabled"),
            money("low_balance_threshold", "low_balance_threshold_minor"),
            date("opening_balance_date"),
            date("archive_through_date"),
            text("institution"),
            text("account_number"),
            text("sort_code"),
            text("icon"),
            text("color"),
            text("notes"),
            flag("is_active"),
            json("metadata"),
            stamp("created_at"),
            stamp("updated_at"),
];

const CATEGORIES: &[Column] = &[
            text("id"),
            text("name"),
            text("type"),
            text("level"),
            text("parent_id"),
            text("account_id"),
            text("color"),
            text("icon"),
            flag("is_system"),
            flag("is_transfer_category"),
            flag("is_revaluation_category"),
            flag("is_unassigned_bucket"),
            flag("is_active"),
            stamp("created_at"),
            stamp("updated_at"),
];

        // `linked_transfer_id` and `linked_transfer_split_id` are absent:
        // the RPC nulls both (`:288-289`) and finalize patches them.
        // `connection_id`, `external_transaction_id` and `external_provider`
        // are absent because the RPC strips them (`:285-286`) — this schema
        // HAS those columns, kept so a cloud backup restores losslessly, and
        // the strip is a decision rather than an accident of shape.
        //
        // `plaid_transaction_id` is stripped by the RPC and has no column
        // here. `transactions.plaid_account_id` is the one the RPC does NOT
        // strip — it survives a cloud restore and is dropped here for want of
        // a column. Recorded because it is the only asymmetry in this list
        // that is not deliberate on both sides.
        //
        // `fee_minor`, `original_amount_minor`, `original_currency` and
        // `fx_rate_e10` are not here either: they have no key in the backup
        // because the cloud keeps those figures in `metadata`. They are
        // filled by [`strip_metadata_money`].
const TRANSACTIONS: &[Column] = &[
            text("id"),
            text("account_id"),
            text("description"),
            money("amount", "amount_minor"),
            text("type"),
            date("date"),
            text("category"),
            text("category_id"),
            text("notes"),
            text("merchant_name"),
            text("location_city"),
            text("location_country"),
            text("payment_channel"),
            flag("is_recurring"),
            flag("is_cleared"),
            flag("is_split"),
            flag("archived"),
            ordinal("statement_sequence"),
            flag("category_confirmed"),
            text("transfer_account_id"),
            text("import_source"),
            text("import_source_id"),
            json("metadata"),
            stamp("created_at"),
            stamp("updated_at"),
];

        // `linked_transfer_id` IS carried here, and that is the RPC's
        // behaviour rather than an oversight: its re-owning CASE has no
        // branch for `transaction_splits`, so the column travels. It
        // resolves because splits are sent after transactions.
const TRANSACTION_SPLITS: &[Column] = &[
            text("id"),
            text("transaction_id"),
            text("category"),
            money("amount", "amount_minor"),
            text("memo"),
            ordinal("sort_order"),
            text("transfer_account_id"),
            text("linked_transfer_id"),
            stamp("created_at"),
            stamp("updated_at"),
];

        // `alert_threshold` is numeric(5,2) meaning a percentage; this
        // schema stores basis points of a percent, so 80.00% is 8000 —
        // scale 2, the same integer arithmetic as money and not money.
const BUDGETS: &[Column] = &[
            text("id"),
            text("name"),
            money("amount", "amount_minor"),
            text("period"),
            text("category"),
            text("category_id"),
            date("start_date"),
            date("end_date"),
            money("spent", "spent_minor"),
            flag("rollover"),
            money("rollover_amount", "rollover_amount_minor"),
            Column { key: "alert_threshold", column: "alert_threshold_bp", kind: Kind::Scaled(2) },
            flag("is_active"),
            text("notes"),
            json("metadata"),
            stamp("created_at"),
            stamp("updated_at"),
];

const GOALS: &[Column] = &[
            text("id"),
            text("name"),
            text("description"),
            money("target_amount", "target_amount_minor"),
            money("current_amount", "current_amount_minor"),
            date("target_date"),
            text("category"),
            text("priority"),
            text("status"),
            text("account_id"),
            text("contribution_frequency"),
            flag("auto_contribute"),
            text("icon"),
            text("color"),
            stamp("completed_at"),
            json("metadata"),
            stamp("created_at"),
            stamp("updated_at"),
];

const GOAL_CONTRIBUTIONS: &[Column] = &[
            text("id"),
            text("goal_id"),
            money("amount", "amount_minor"),
            text("transaction_id"),
            date("date"),
            text("notes"),
            stamp("created_at"),
];

        // THE PRICE FIX (DESIGN.md §3.2): the cloud stores unit prices at
        // numeric(10,2) against quantities at numeric(20,8), so a fund
        // priced at £12.345 cannot be written there. This schema stores them
        // at 8 dp. A cloud→local restore is therefore EXACT and a local→cloud
        // export would round — declared divergence 4.
const INVESTMENTS: &[Column] = &[
            text("id"),
            text("account_id"),
            text("symbol"),
            text("name"),
            text("asset_type"),
            text("exchange"),
            text("currency"),
            eight("quantity", "quantity_e8"),
            money("cost_basis", "cost_basis_minor"),
            eight("current_price", "current_price_e8"),
            money("market_value", "market_value_minor"),
            date("purchase_date"),
            eight("purchase_price", "purchase_price_e8"),
            stamp("last_updated"),
            text("notes"),
            stamp("created_at"),
            stamp("updated_at"),
];

        // `tax_minor` has no key: the cloud has nowhere to keep stamp duty
        // except `transactions.metadata.investmentData.stampDuty`, which
        // belongs to a different row. It takes this schema's default of 0,
        // which is the honest value for "the file did not say".
const INVESTMENT_TRANSACTIONS: &[Column] = &[
            text("id"),
            text("investment_id"),
            text("transaction_type"),
            eight("quantity", "quantity_e8"),
            eight("price", "unit_price_e8"),
            money("total_amount", "total_amount_minor"),
            money("fees", "fee_minor"),
            date("date"),
            text("notes"),
            stamp("created_at"),
];

        // R-10. In the cloud `user_id` is TEXT against
        // `user_profiles(clerk_user_id)`, which is why the RPC has to
        // overwrite it a SECOND time with a Clerk id (`:337-346`). There is
        // no Clerk here and the column is a plain `users(id)` foreign key, so
        // the special case disappears — this entity is re-owned exactly like
        // every other one, and `clerk_identity_unknown` has no local twin.
const RECURRING_TRANSACTIONS: &[Column] = &[
            text("id"),
            text("account_id"),
            text("description"),
            money("amount", "amount_minor"),
            text("type"),
            text("category"),
            text("frequency"),
            date("start_date"),
            date("end_date"),
            date("next_date"),
            flag("is_active"),
            flag("auto_create"),
            stamp("created_at"),
            stamp("updated_at"),
];

const NOTIFICATIONS: &[Column] = &[
            text("id"),
            text("type"),
            text("title"),
            text("message"),
            flag("is_read"),
            text("action_label"),
            text("action_url"),
            stamp("created_at"),
            stamp("updated_at"),
];

const DASHBOARD_LAYOUTS: &[Column] = &[
            text("id"),
            text("name"),
            json("widgets"),
            flag("is_default"),
            stamp("created_at"),
            stamp("updated_at"),
];

const WIDGET_PREFERENCES: &[Column] = &[
            text("id"),
            text("widget_type"),
            json("settings"),
            flag("is_collapsed"),
            stamp("last_refreshed"),
            stamp("created_at"),
            stamp("updated_at"),
];

        // `subject_ids` is a uuid[] in the cloud with a GIN index and a
        // column comment PROMISING every id resolves. Here it is the child
        // table `suggestion_dismissal_subjects`, where the promise is a
        // foreign key — see [`insert_row`] for what happens to a subject the
        // file names and the ledger does not have.
const SUGGESTION_DISMISSALS: &[Column] = &[
            text("id"),
            text("kind"),
            text("subject_key"),
            stamp("dismissed_at"),
];

// ── The entities ────────────────────────────────────────────────────────────

/// Everything `restore_user_chunk` will accept, spelled exactly as the RPC's
/// `p_entity` branch list spells it.
///
/// The match in [`Entity::columns`] is exhaustive, which is canonical invariant
/// #125 made structural: *"Every backup entity must have a recorded storage
/// decision — a new table without one is a compile error."*
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Entity {
    /// Must be first in any restore: the emptiness precondition is checked here.
    Accounts,
    /// Sent level by level by the client, so `parent_id` always resolves.
    Categories,
    /// The ledger.
    Transactions,
    /// Split lines, after their parents.
    TransactionSplits,
    /// Budgets.
    Budgets,
    /// Goals.
    Goals,
    /// Contributions, after their goals.
    GoalContributions,
    /// Holdings.
    Investments,
    /// Holding movements, after their holdings.
    InvestmentTransactions,
    /// Templates. The cloud's odd one out; see [`Entity::columns`].
    RecurringTransactions,
    /// Carried so a cloud backup restores whole.
    Notifications,
    /// Carried so a cloud backup restores whole.
    DashboardLayouts,
    /// Carried so a cloud backup restores whole.
    WidgetPreferences,
    /// Carried so a cloud backup restores whole.
    SuggestionDismissals,
}

impl Entity {
    /// The table this entity is stored in.
    #[must_use]
    pub const fn table(self) -> &'static str {
        match self {
            Self::Accounts => "accounts",
            Self::Categories => "categories",
            Self::Transactions => "transactions",
            Self::TransactionSplits => "transaction_splits",
            Self::Budgets => "budgets",
            Self::Goals => "goals",
            Self::GoalContributions => "goal_contributions",
            Self::Investments => "investments",
            Self::InvestmentTransactions => "investment_transactions",
            Self::RecurringTransactions => "recurring_transactions",
            Self::Notifications => "notifications",
            Self::DashboardLayouts => "dashboard_layouts",
            Self::WidgetPreferences => "widget_preferences",
            Self::SuggestionDismissals => "suggestion_dismissals",
        }
    }

    /// The name `p_entity` carries. Same string on both engines.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        self.table()
    }

    /// Resolve `p_entity`.
    ///
    /// # Errors
    /// [`CoreError::Refused`] with the RPC's own `restore_entity_unknown`.
    pub fn parse(name: &str) -> CoreResult<Self> {
        let entity = match name {
            "accounts" => Self::Accounts,
            "categories" => Self::Categories,
            "transactions" => Self::Transactions,
            "transaction_splits" => Self::TransactionSplits,
            "budgets" => Self::Budgets,
            "goals" => Self::Goals,
            "goal_contributions" => Self::GoalContributions,
            "investments" => Self::Investments,
            "investment_transactions" => Self::InvestmentTransactions,
            "recurring_transactions" => Self::RecurringTransactions,
            "notifications" => Self::Notifications,
            "dashboard_layouts" => Self::DashboardLayouts,
            "widget_preferences" => Self::WidgetPreferences,
            "suggestion_dismissals" => Self::SuggestionDismissals,
            other => {
                return Err(CoreError::refuse(
                    "restore_entity_unknown",
                    &format!("\"{other}\" is not something this backup format carries"),
                ))
            }
        };
        Ok(entity)
    }

    /// Which columns this entity's rows land in, and how each is converted.
    ///
    /// Read off the two schemas side by side, not off memory. Where the two
    /// disagree the disagreement is noted here rather than anywhere else.
    #[must_use]
    pub const fn columns(self) -> &'static [Column] {
        match self {
            Self::Accounts => ACCOUNTS,
            Self::Categories => CATEGORIES,
            Self::Transactions => TRANSACTIONS,
            Self::TransactionSplits => TRANSACTION_SPLITS,
            Self::Budgets => BUDGETS,
            Self::Goals => GOALS,
            Self::GoalContributions => GOAL_CONTRIBUTIONS,
            Self::Investments => INVESTMENTS,
            Self::InvestmentTransactions => INVESTMENT_TRANSACTIONS,
            Self::RecurringTransactions => RECURRING_TRANSACTIONS,
            Self::Notifications => NOTIFICATIONS,
            Self::DashboardLayouts => DASHBOARD_LAYOUTS,
            Self::WidgetPreferences => WIDGET_PREFERENCES,
            Self::SuggestionDismissals => SUGGESTION_DISMISSALS,
        }
    }
}

// ── Reading a value ─────────────────────────────────────────────────────────

/// The text of a JSON value, in the spelling `jsonb ->>` would produce.
///
/// Shares [`crate::wire::as_text`]'s decision so that a caller who has always
/// sent `{"amount": -15}` keeps working: a number arrives as its own spelling,
/// not as a float.
fn as_text(value: &Value) -> Option<String> {
    crate::wire::as_text(value)
}

/// Scale a decimal string by `10^places`, exactly.
///
/// `Money::parse` is the 2-place case and this is the same algorithm generalised,
/// with the same three refusals. It is written here rather than in [`crate::money`]
/// because quantities and prices are not money and must not acquire money's type.
///
/// # Errors
/// A refusal code from [`crate::money::MoneyError`], so the codes a caller sees
/// are the same whichever scale refused them.
fn scale(text: &str, places: u32) -> Result<i64, crate::money::MoneyError> {
    use crate::money::MoneyError;

    let (negative, digits) = match text.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, text),
    };
    if digits.is_empty() || digits.matches('.').count() > 1 {
        return Err(MoneyError::Malformed);
    }
    let mut parts = digits.splitn(2, '.');
    let whole = parts.next().unwrap_or("");
    let fraction = parts.next().unwrap_or("");
    if whole.is_empty() && fraction.is_empty() {
        return Err(MoneyError::Malformed);
    }
    if !whole.bytes().all(|b| b.is_ascii_digit()) || !fraction.bytes().all(|b| b.is_ascii_digit()) {
        return Err(MoneyError::Malformed);
    }
    // Trailing zeros beyond the scale are not extra precision: "1.500" at scale 2
    // is 150, and refusing it would refuse a value the file can express exactly.
    let significant = fraction.trim_end_matches('0');
    let width = usize::try_from(places).map_err(|_| MoneyError::OutOfRange)?;
    if significant.len() > width {
        return Err(MoneyError::SubMinorUnit);
    }

    let mut units: i64 = if whole.is_empty() {
        0
    } else {
        whole.parse::<i64>().map_err(|_| MoneyError::OutOfRange)?
    };
    for _ in 0..places {
        units = units.checked_mul(10).ok_or(MoneyError::OutOfRange)?;
    }
    let mut padded = String::from(significant);
    while padded.len() < width {
        padded.push('0');
    }
    if !padded.is_empty() {
        let fractional = padded.parse::<i64>().map_err(|_| MoneyError::OutOfRange)?;
        units = units.checked_add(fractional).ok_or(MoneyError::OutOfRange)?;
    }
    if negative {
        units = units.checked_neg().ok_or(MoneyError::OutOfRange)?;
    }
    Ok(units)
}

/// A calendar day, `YYYY-MM-DD`.
///
/// Canonical invariant #124 / TS-X4, and its second sentence is the one that
/// matters: *"a value already a day passes untouched"*. A day is passed through
/// without being parsed, because `new Date('2026-01-15')` invents a UTC midnight
/// and midnight belongs to a zone — which is how a transaction dated the 15th
/// comes back as the 14th west of Greenwich. A longer value is truncated
/// LEXICALLY, with no zone arithmetic at all, for the same reason.
fn as_day(text: &str) -> Option<String> {
    let day = text.get(..10)?;
    if crate::wire::is_calendar_date(day) {
        Some(day.to_owned())
    } else {
        None
    }
}

/// An instant, in the exact shape this schema's column defaults produce.
///
/// SQLite does the conversion, not Rust, for the reason [`crate::db::now`] gives:
/// a row written by a verb and a row written by a column default must be stamped
/// by the same clock in the same format, and a second implementation would
/// eventually drift from the first. MEASURED — `strftime('%Y-%m-%dT%H:%M:%fZ', ?)`
/// against the shapes a backup can hold:
///
/// ```text
/// 2019-01-01T00:00:00+00:00     -> 2019-01-01T00:00:00.000Z
/// 2019-05-04T09:30:00.123+01:00 -> 2019-05-04T08:30:00.123Z
/// 2019-01-01T00:00:00.000Z      -> 2019-01-01T00:00:00.000Z
/// not a time                    -> NULL
/// ```
///
/// The `+00:00` case is why this cannot be a string test: PostgREST renders
/// `timestamptz` with a numeric offset, and `transactions_timestamps_shaped`
/// requires the `Z`.
fn as_instant(connection: &Connection, text: &str) -> CoreResult<Option<String>> {
    Ok(connection.query_row(
        "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', ?1)",
        [text],
        |row| row.get::<_, Option<String>>(0),
    )?)
}

// ── The metadata money strip ────────────────────────────────────────────────

/// The eleven keys `transactions_no_money_in_metadata` refuses, and what becomes
/// of each.
///
/// DESIGN.md §3.3 is the table this is a transcription of. Four have a typed home
/// in this schema and are promoted into it; the rest are dropped, because the
/// figures they carry belong to a row in another table entirely (a transaction
/// carrying `investmentData.quantity` is an investment transaction written to the
/// wrong table) or to a reconciliation design that `is_cleared` + `bank_balance`
/// replaced.
///
/// **Every drop is reported.** The alternative — refusing the restore — was
/// rejected: it would make a real cloud backup unrestorable with no way forward
/// but hand-editing JSON, and DESIGN.md already decided these figures have no
/// home. The alternative in the other direction — dropping them quietly — is the
/// one thing a restore must never do with a number.
const PROMOTED: [(&str, &str, u32); 4] = [
    ("fees", "fee_minor", 2),
    ("originalAmount", "original_amount_minor", 2),
    ("exchangeRate", "fx_rate_e10", 10),
    // Not money and not banned by the CHECK, but the FX triple is all-or-nothing
    // (`transactions_fx_complete`), so the currency has to travel with the amount
    // and the rate or none of the three can land.
    ("originalCurrency", "original_currency", 0),
];

/// The banned keys with nowhere to go, and the sentence each drop reports.
const DROPPED_KEYS: [(&str, &str); 7] = [
    ("pricePerUnit", "a unit price belongs on the holding, not on a transaction"),
    ("marketValue", "a market value belongs on the holding, not on a transaction"),
    ("costBasis", "a cost basis belongs on the holding, not on a transaction"),
    ("units", "a unit count belongs on the holding, not on a transaction"),
    ("expectedAmount", "reconciliation is is_cleared and bank_balance now"),
    ("actualAmount", "reconciliation is is_cleared and bank_balance now"),
    ("discrepancy", "reconciliation is is_cleared and bank_balance now"),
];

/// What came out of one row's `metadata`.
#[derive(Debug, Default)]
pub struct MetadataStrip {
    /// Column name → value, for the four promoted figures.
    pub promoted: Vec<(&'static str, SqlValue)>,
    /// What was thrown away, and why.
    pub dropped: Vec<String>,
}

/// Lift the money out of a cloud `metadata` blob so the row can be stored.
///
/// Mutates the blob in place: after this returns, `metadata` contains none of the
/// eleven keys and `transactions_no_money_in_metadata` is satisfied. Everything
/// non-numeric — `transferType`, `reference`, `documentation`, the dates, the
/// labels — is left exactly as the file had it.
///
/// # Errors
/// [`CoreError::Refused`] if a promoted figure cannot be scaled: a rate with
/// eleven decimal places, or an amount past `i64`. Those are refusals rather than
/// drops because the figure DOES have a home and would be silently wrong in it.
pub fn strip_metadata_money(metadata: &mut Value) -> CoreResult<MetadataStrip> {
    let mut strip = MetadataStrip::default();

    if let Some(investment) = metadata.get("investmentData") {
        if !investment.is_null() {
            strip.dropped.push(
                "investmentData — a transaction carrying holding figures is an investment \
                 transaction written to the wrong table"
                    .to_owned(),
            );
        }
    }
    if let Some(object) = metadata.as_object_mut() {
        object.remove("investmentData");
    }

    let Some(transfer) = metadata.get_mut("transferMetadata").and_then(Value::as_object_mut) else {
        return Ok(strip);
    };

    for (key, column, places) in PROMOTED {
        let Some(value) = transfer.remove(key) else { continue };
        if value.is_null() {
            continue;
        }
        let Some(text) = as_text(&value) else { continue };
        if places == 0 {
            strip.promoted.push((column, SqlValue::Text(text)));
            continue;
        }
        let scaled = scale(&text, places).map_err(|error| {
            CoreError::refuse(
                error.code(),
                &format!(
                    "metadata.transferMetadata.{key} holds {text}, which this ledger stores in \
                     {column} and cannot represent: {error}"
                ),
            )
        })?;
        strip.promoted.push((column, SqlValue::Integer(scaled)));
    }

    for (key, why) in DROPPED_KEYS {
        if transfer.remove(key).is_some_and(|value| !value.is_null()) {
            strip.dropped.push(format!("metadata.transferMetadata.{key} — {why}"));
        }
    }

    Ok(strip)
}

// ── Writing a row ───────────────────────────────────────────────────────────

/// The two child tables a backup row can carry inside an array column.
fn child_array(entity: Entity, row: &BackupRow) -> Option<(&'static str, &[Value])> {
    let key = match entity {
        Entity::Transactions => "tags",
        Entity::SuggestionDismissals => "subject_ids",
        _ => return None,
    };
    row.get(key).and_then(Value::as_array).map(|values| (key, values.as_slice()))
}

/// Insert one backup row, re-owned to `owner`.
///
/// # Errors
/// [`CoreError::Refused`] naming the entity and the row's id, always — a restore
/// of fifty thousand rows that says only *"CHECK constraint failed"* has told the
/// user nothing they can act on.
#[allow(clippy::too_many_lines)]
pub fn insert_row(
    connection: &Connection,
    entity: Entity,
    row: &BackupRow,
    owner: &str,
    dropped: &mut Vec<Dropped>,
) -> CoreResult<()> {
    let id = row.get("id").and_then(Value::as_str).unwrap_or("(no id)").to_owned();
    let named = |error: CoreError| -> CoreError { name_the_row(error, entity, &id) };

    // X-6: the owner is supplied by the verb and never read from the file, so a
    // bundle exported by another login lands owned by whoever restored it.
    let mut columns: Vec<&'static str> = vec!["user_id"];
    let mut values: Vec<SqlValue> = vec![SqlValue::Text(owner.to_owned())];

    for column in entity.columns() {
        let Some(value) = row.get(column.key) else { continue };
        if value.is_null() {
            continue;
        }
        let stored = match column.kind {
            Kind::Json => SqlValue::Text(value.to_string()),
            Kind::Flag => {
                let flag: crate::wire::Flag = serde_json::from_value(value.clone())
                    .map_err(|error| CoreError::InvalidCommand(error.to_string()))
                    .map_err(&named)?;
                let resolved = flag
                    .resolve()
                    .map_err(|message| CoreError::refuse("invalid_boolean", &message))
                    .map_err(&named)?;
                SqlValue::Integer(i64::from(resolved))
            }
            Kind::Ordinal => {
                let Some(text) = as_text(value) else { continue };
                if text.is_empty() {
                    continue;
                }
                let number = text.parse::<i64>().map_err(|_| {
                    named(CoreError::refuse(
                        "invalid_integer",
                        &format!("{} is not an integer: {text:?}", column.key),
                    ))
                })?;
                SqlValue::Integer(number)
            }
            Kind::Scaled(places) => {
                let Some(text) = as_text(value) else { continue };
                let scaled = scale(&text, places)
                    .map_err(|error| {
                        CoreError::refuse(
                            error.code(),
                            &format!("{} holds {text}, which this ledger cannot store: {error}", column.key),
                        )
                    })
                    .map_err(&named)?;
                SqlValue::Integer(scaled)
            }
            Kind::Date => {
                let Some(text) = as_text(value) else { continue };
                let day = as_day(&text).ok_or_else(|| {
                    named(CoreError::refuse(
                        "date_invalid",
                        &format!("{} is not a calendar day: {text:?}", column.key),
                    ))
                })?;
                SqlValue::Text(day)
            }
            Kind::Timestamp => {
                let Some(text) = as_text(value) else { continue };
                let instant = as_instant(connection, &text)?.ok_or_else(|| {
                    named(CoreError::refuse(
                        "timestamp_unreadable",
                        &format!("{} is not an instant this file can date: {text:?}", column.key),
                    ))
                })?;
                SqlValue::Text(instant)
            }
            Kind::Text => SqlValue::Text(as_text(value).unwrap_or_default()),
        };
        columns.push(column.column);
        values.push(stored);
    }

    // Divergence 9. Done after the column loop so the promoted figures join the
    // same INSERT as the blob they came out of: a row whose fee landed and whose
    // metadata did not would be a row that says the fee twice.
    if entity == Entity::Transactions {
        let mut metadata = row.get("metadata").cloned().unwrap_or(Value::Null);
        if !metadata.is_null() {
            let strip = strip_metadata_money(&mut metadata).map_err(&named)?;
            for note in strip.dropped {
                dropped.push(Dropped { entity: entity.as_str().to_owned(), id: id.clone(), what: note });
            }
            for (column, value) in strip.promoted {
                columns.push(column);
                values.push(value);
            }
            if let Some(position) = columns.iter().position(|name| *name == "metadata") {
                if let Some(slot) = values.get_mut(position) {
                    *slot = SqlValue::Text(metadata.to_string());
                }
            }
        }
    }

    let placeholders = (1..=columns.len()).map(|n| format!("?{n}")).collect::<Vec<_>>().join(", ");
    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({placeholders})",
        entity.table(),
        columns.join(", ")
    );
    let bound: Vec<&dyn ToSql> = values.iter().map(|value| value as &dyn ToSql).collect();
    connection.execute(&sql, bound.as_slice()).map_err(|error| named(error.into()))?;

    if let Some((key, members)) = child_array(entity, row) {
        write_child_array(connection, entity, &id, key, members, owner, dropped).map_err(&named)?;
    }

    Ok(())
}

/// `text[]` and `uuid[]` become child tables here, so the array is written after
/// its parent row.
fn write_child_array(
    connection: &Connection,
    entity: Entity,
    id: &str,
    key: &str,
    members: &[Value],
    owner: &str,
    dropped: &mut Vec<Dropped>,
) -> CoreResult<()> {
    match entity {
        // A set, not a sequence: `PRIMARY KEY (transaction_id, tag)` is what
        // makes the two engines agree about a duplicate, and `INSERT OR IGNORE`
        // is how a duplicate in the file survives it — Postgres's `text[]` holds
        // one happily, so refusing here would refuse a row the cloud stores.
        Entity::Transactions => {
            let mut seen = BTreeSet::new();
            for member in members {
                let Some(tag) = member.as_str() else { continue };
                if tag.trim().is_empty() || !seen.insert(tag) {
                    continue;
                }
                connection.execute(
                    "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag) VALUES (?1, ?2)",
                    rusqlite::params![id, tag],
                )?;
            }
            Ok(())
        }
        // The cloud's column comment PROMISES every subject id resolves in
        // exactly one table; here it is a foreign key. A subject the file names
        // and the ledger does not hold is therefore unstorable — and it is
        // dropped rather than refused, because a dismissal is a suggestion the
        // user has waved away, not money, and losing a whole restore over one
        // would be absurd. The dismissal itself still lands: `subject_key` is
        // what identifies it.
        Entity::SuggestionDismissals => {
            for (position, member) in members.iter().enumerate() {
                let Some(subject) = member.as_str() else { continue };
                let known: i64 = connection.query_row(
                    "SELECT EXISTS (SELECT 1 FROM transactions WHERE id = ?1 AND user_id = ?2)",
                    rusqlite::params![subject, owner],
                    |row| row.get(0),
                )?;
                if known == 0 {
                    dropped.push(Dropped {
                        entity: entity.as_str().to_owned(),
                        id: id.to_owned(),
                        what: format!("{key}[{position}] names a transaction this ledger does not hold"),
                    });
                    continue;
                }
                let order = i64::try_from(position).map_err(|_| {
                    CoreError::refuse("amount_out_of_range", "more subjects than a dismissal can hold")
                })?;
                connection.execute(
                    "INSERT INTO suggestion_dismissal_subjects (dismissal_id, transaction_id, role_order)
                     VALUES (?1, ?2, ?3)",
                    rusqlite::params![id, subject, order],
                )?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

/// Put the entity and the row's id in front of whatever refused, and say what a
/// person can do about it.
///
/// The bounds in the hint are formatted from [`crate::money`]'s published
/// constants rather than written out, because the CONSTRAINT is what enforces
/// them and a second copy in prose would drift from it. MONEY-5: a cloud backup
/// may legally hold a `numeric(20,2)` row the local bound refuses, and the
/// obligation this discharges is that it is rejected *with a message*, never
/// silently rescaled — rescaling money is inventing it.
fn name_the_row(error: CoreError, entity: Entity, id: &str) -> CoreError {
    match error {
        CoreError::Storage(fault) => CoreError::Storage(fault),
        other => {
            let bound = crate::money::Money::from_minor(crate::money::Money::ROW_BOUND_MINOR);
            let stock = crate::money::Money::from_minor(crate::money::Money::STOCK_BOUND_MINOR);
            CoreError::Refused(
                crate::error::Refusal::named(
                    "restore_row_refused",
                    &format!("{} {id}: {other}", entity.as_str()),
                )
                .with_hint(&format!(
                    "This row is in the backup file but cannot be stored as it stands. If the \
                     figure is the problem: a single amount is bounded at ±{bound} and a stored \
                     balance at ±{stock}, because SQLite's integer sum RAISES at the int64 cliff \
                     where Postgres widens — one absurd row would leave the account with no \
                     computable balance at all rather than a wrong one. Correct the row in the \
                     file and restore again.",
                )),
            )
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{as_day, scale, strip_metadata_money, Entity};
    use crate::money::MoneyError;
    use serde_json::json;

    #[test]
    fn scaling_is_exact_at_every_scale_the_schema_uses() {
        assert_eq!(scale("-12.34", 2), Ok(-1_234));
        assert_eq!(scale("12", 2), Ok(1_200));
        assert_eq!(scale("1.5", 2), Ok(150));
        assert_eq!(scale("1.500", 2), Ok(150), "trailing zeros are not precision");
        assert_eq!(scale("0.00000001", 8), Ok(1));
        assert_eq!(scale("12.345", 8), Ok(1_234_500_000));
        assert_eq!(scale("80", 2), Ok(8_000), "alert_threshold as basis points");
        assert_eq!(scale("1.0000000001", 10), Ok(10_000_000_001));
        assert_eq!(scale("-0", 2), Ok(0));
    }

    #[test]
    fn a_value_finer_than_the_column_is_refused_rather_than_rounded() {
        assert_eq!(scale("12.345", 2), Err(MoneyError::SubMinorUnit));
        assert_eq!(scale("0.000000001", 8), Err(MoneyError::SubMinorUnit));
        assert_eq!(MoneyError::SubMinorUnit.code(), "amount_not_representable");
    }

    #[test]
    fn scaling_overflow_is_an_error_not_a_wrap() {
        assert_eq!(scale("99999999999999999999", 2), Err(MoneyError::OutOfRange));
        assert_eq!(scale("1000000000000", 8), Err(MoneyError::OutOfRange));
    }

    #[test]
    fn scaling_refuses_everything_that_is_not_a_plain_decimal() {
        for text in ["", "-", "1,000", "1e3", "£1", "1.2.3", "abc"] {
            assert_eq!(scale(text, 2), Err(MoneyError::Malformed), "scaling {text:?}");
        }
    }

    #[test]
    fn a_day_passes_through_and_anything_longer_is_truncated_lexically() {
        assert_eq!(as_day("2024-03-01").as_deref(), Some("2024-03-01"));
        // No zone arithmetic: the 15th stays the 15th.
        assert_eq!(as_day("2026-01-15T02:30:00+05:00").as_deref(), Some("2026-01-15"));
        assert_eq!(as_day("2023-02-29"), None, "not a real day");
        assert_eq!(as_day("2024-3-1"), None);
        assert_eq!(as_day(""), None);
    }

    #[test]
    fn the_metadata_strip_promotes_four_and_reports_the_rest() {
        let mut metadata = json!({
            "transferMetadata": {
                "fees": 12.5,
                "originalAmount": "-100.00",
                "originalCurrency": "EUR",
                "exchangeRate": "1.1234567891",
                "marketValue": 9.99,
                "discrepancy": 0.01,
                "transferType": "wire"
            },
            "investmentData": { "stampDuty": 5 },
            "reference": "kept"
        });
        let strip = strip_metadata_money(&mut metadata).unwrap();

        assert_eq!(
            strip.promoted.iter().map(|(column, _)| *column).collect::<Vec<_>>(),
            ["fee_minor", "original_amount_minor", "fx_rate_e10", "original_currency"]
        );
        assert_eq!(strip.dropped.len(), 3, "{:?}", strip.dropped);
        assert!(strip.dropped[0].contains("investmentData"));

        // Everything non-numeric survives, and nothing the CHECK watches is left.
        assert_eq!(metadata["reference"], json!("kept"));
        assert_eq!(metadata["transferMetadata"]["transferType"], json!("wire"));
        assert!(metadata["transferMetadata"].get("fees").is_none());
        assert!(metadata.get("investmentData").is_none());
    }

    #[test]
    fn a_rate_finer_than_ten_places_is_refused_not_dropped() {
        // It HAS a home (fx_rate_e10), so silently losing it would be wrong in a
        // way losing marketValue is not.
        let mut metadata = json!({ "transferMetadata": { "exchangeRate": "1.00000000001" } });
        let error = strip_metadata_money(&mut metadata).expect_err("eleven places");
        assert_eq!(error.code(), "amount_not_representable", "{error}");
    }

    #[test]
    fn a_blob_with_no_money_in_it_is_left_alone() {
        let mut metadata = json!({ "transferMetadata": { "transferType": "wire" } });
        let strip = strip_metadata_money(&mut metadata).unwrap();
        assert!(strip.promoted.is_empty());
        assert!(strip.dropped.is_empty());
        assert_eq!(metadata, json!({ "transferMetadata": { "transferType": "wire" } }));
    }

    #[test]
    fn every_entity_names_a_table_and_round_trips_its_own_name() {
        for entity in [
            Entity::Accounts, Entity::Categories, Entity::Transactions, Entity::TransactionSplits,
            Entity::Budgets, Entity::Goals, Entity::GoalContributions, Entity::Investments,
            Entity::InvestmentTransactions, Entity::RecurringTransactions, Entity::Notifications,
            Entity::DashboardLayouts, Entity::WidgetPreferences, Entity::SuggestionDismissals,
        ] {
            assert_eq!(Entity::parse(entity.as_str()).unwrap(), entity);
            assert!(!entity.columns().is_empty());
            // user_id is supplied by the verb, never taken from the file: X-6.
            assert!(
                entity.columns().iter().all(|column| column.key != "user_id"),
                "{} must not carry user_id from the file",
                entity.as_str()
            );
        }
    }

    #[test]
    fn an_unknown_entity_refuses_by_the_rpcs_own_name() {
        let error = Entity::parse("not_a_table").expect_err("unknown");
        assert_eq!(error.code(), "restore_entity_unknown");
        assert!(error.to_string().contains("not_a_table"), "{error}");
    }
}
