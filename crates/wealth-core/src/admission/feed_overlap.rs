//! TS-I12 / TS-I13 — bank-feed overlap suppression for the MS Money import,
//! and the transfer-leg handover that goes with it.
//!
//! Port of `src/services/import/msMoney/feedOverlap.ts`.
//!
//! # The problem
//!
//! A Money file is a complete history up to the day it was exported. A live
//! bank feed backfills its own history from the day the account was linked.
//! Where the two windows overlap, the SAME real-world transaction exists twice:
//! once written by the file import (no feed id) and once by the feed (carrying
//! `external_transaction_id`). The importer's own `import_source_id`
//! idempotency cannot help — the two copies come from different systems with
//! different identifiers — so they have to be matched on what they describe.
//!
//! # The rule, deliberately narrow, because a false positive deletes real money
//!
//! A Money transaction is suppressed only when a bank-feed row in the SAME
//! account has the EXACT same amount and a date within tolerance (default 3
//! days: feeds post on the settlement date, Money records the transaction
//! date). Matching is strictly 1:1 and greedy, so at most `feed_rows.len()`
//! Money rows can ever be dropped. Candidates are ranked by date distance
//! first, then by description similarity. Description is a RANKING signal,
//! never a gate: feed descriptions are the bank's raw strings, Money's are payee
//! names, and requiring them to agree would miss most true duplicates.
//!
//! # Transfer legs: handover, not exemption
//!
//! A transfer leg used to be exempt outright, on the reasoning that dropping one
//! leg strands its counterpart. In a fed account that reasoning left the LARGEST
//! rows in the overlap window duplicated — card payments, standing transfers —
//! because the feed reports them exactly like any other movement.
//!
//! So a leg is not exempt; it is HANDED OVER. The Money leg is suppressed and
//! the feed row takes its place in the transfer, carrying the leg's target and
//! its counterpart, which is re-pointed at the feed row. Nothing is stranded and
//! the payment exists exactly once.
//!
//! The handover never widens the match: it fires only on a pairing that already
//! qualifies, and only after every ordinary row has had its chance at that feed
//! row — which is what the two passes are for. It is REFUSED, and the leg kept
//! as before, when the feed row could not honestly become a transfer: a split
//! parent (the database's own trigger forbids re-typing one) or a row already
//! half of some other linked pair.
//!
//! Split parents are never suppressed at all — their category breakdown lives in
//! child rows the feed has no equivalent for — and a transfer that is ALSO a
//! split parent counts as a split parent, because the stricter rule wins.
//!
//! # Two things this port pins that the TypeScript leaves to V8
//!
//! * **`dayOf` here is not `dayOf` in `statementDuplicates.ts`.** This one is
//!   `Date.parse(iso.slice(0, 10) + 'T00:00:00.000Z')` — the first ten
//!   characters, forced into the standard format. That closes V8's fallback
//!   parser by construction: `"2026-5-10"` becomes `"2026-5-10T00:00:00.000Z"`,
//!   which is not a date at all. So this module's date handling and the port's
//!   are the same function, where the statement module needed a declared
//!   divergence.
//! * **A feed row with an unreadable date can match nothing, and its position in
//!   the ordering is not a rule.** The sort comparator is
//!   `dayOf(a.date) - dayOf(b.date)`, which is NaN when either side is
//!   unreadable, and a NaN comparator has no defined answer. MEASURED (node
//!   22.17.0): one bad date in five leaves the array **completely unsorted**;
//!   a different arrangement of three comes back partially sorted. Those two
//!   observations contradict each other, so it is an artefact of V8's sort and
//!   not a behaviour to port. This module sorts unreadable days first, states
//!   that it is a choice, and the differential lane deliberately carries **no**
//!   spec with an unreadable feed date — a spec that constructed one would be
//!   asserting the artefact. The property that matters (such a row matches
//!   nothing) is a crate test, where one feed row means there is no order.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::day::Day;
use super::text::description_similarity;
use crate::money::Money;

/// Feeds post on the settlement date; Money records the transaction date.
pub const DEFAULT_DATE_TOLERANCE_DAYS: i64 = 3;

/// What a Money row is, as far as this rule is concerned.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RowType {
    /// Money in.
    Income,
    /// Money out.
    Expense,
    /// One leg of a movement between two accounts.
    Transfer,
}

/// A transaction from the Money file, app-shaped by `transformMsMoneyExport`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MoneyRow {
    /// `mny-txn-<htrn>` — the import's own id for the row.
    pub id: String,
    /// Account id in the IMPORT's namespace.
    pub account_id: String,
    /// The row's date, as text.
    #[serde(default)]
    pub date: Option<String>,
    /// Signed amount.
    pub amount: Money,
    /// The payee name Money recorded.
    #[serde(default)]
    pub description: String,
    /// Income, expense or transfer.
    pub r#type: RowType,
    /// A split parent is never suppressed; its lines would be orphaned.
    #[serde(default)]
    pub is_split: bool,
    /// The account on the other side of the transfer, if any.
    #[serde(default)]
    pub transfer_account_id: Option<String>,
    /// The other leg, if the pair was linked.
    #[serde(default)]
    pub linked_transfer_id: Option<String>,
    /// The split LINE the other side is, when the counterpart is a split leg.
    #[serde(default)]
    pub linked_transfer_split_id: Option<String>,
}

/// A transaction already in the database that came from a bank feed.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FeedRow {
    /// Database row id — used for reporting and for the handover.
    pub id: String,
    /// Account id translated into the IMPORT's namespace by the caller.
    pub account_id: String,
    /// `yyyy-mm-dd`.
    #[serde(default)]
    pub date: Option<String>,
    /// Signed amount.
    pub amount: Money,
    /// The bank's own wording.
    #[serde(default)]
    pub description: String,
    /// Is this feed row a split parent? One cannot be re-typed as a transfer —
    /// `protect_split_transaction_fields` rejects it — so it is never handed a
    /// transfer leg.
    #[serde(default)]
    pub is_split: bool,
    /// Is this feed row already one side of a linked transfer? Then it belongs
    /// to that pair and is never re-pointed at another.
    #[serde(default)]
    pub linked_transfer_id: Option<String>,
}

/// One Money row the feed already covers.
#[derive(Debug, Clone, Serialize)]
pub struct OverlapMatch {
    /// The Money row that will not be imported.
    pub import_source_id: String,
    /// The feed row that covers it.
    pub feed_transaction_id: String,
    /// The account both sides share, in the Money side's namespace.
    pub account_id: String,
    /// Whole days between the two dates (0 = same day).
    pub day_gap: i64,
    /// 0–1 token overlap of the two descriptions; ranking only.
    pub description_similarity: f64,
    /// True when the suppressed row was a transfer leg.
    pub is_transfer_handover: bool,
}

/// A suppressed transfer leg and the feed row that inherits its place.
///
/// Everything the importer needs to rebuild the pair without the leg, still in
/// the SEED's namespace, because the importer is the only thing that knows what
/// database ids those become.
#[derive(Debug, Clone, Serialize)]
pub struct TransferHandover {
    /// The Money leg being suppressed.
    pub import_source_id: String,
    /// The feed row that takes its place.
    pub feed_transaction_id: String,
    /// The account the leg sits in.
    pub account_id: String,
    /// The account on the OTHER side of the transfer, if any.
    pub transfer_account_id: Option<String>,
    /// The other leg, if the pair was linked.
    pub counterpart_source_id: Option<String>,
    /// The split LINE the other side is, when the counterpart is a split leg.
    pub counterpart_split_source_id: Option<String>,
    /// Whole days between the two dates.
    pub day_gap: i64,
    /// Ranking only.
    pub description_similarity: f64,
}

/// Overlaps found but deliberately left in place, by reason.
#[derive(Debug, Clone, Default, Serialize)]
pub struct KeptDespiteOverlap {
    /// Legs whose handover was refused because the feed row could not honestly
    /// become a transfer.
    pub transfers: i64,
    /// Split parents the feed also covers.
    pub split_parents: i64,
}

/// Decide which Money transactions the bank feed already covers.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanFeedOverlap {
    /// Days of settlement slack. Absent means [`DEFAULT_DATE_TOLERANCE_DAYS`].
    #[serde(default)]
    pub date_tolerance_days: Option<i64>,
    /// The rows the Money file would import.
    pub transactions: Vec<MoneyRow>,
    /// The user's existing bank-fed transactions.
    pub feed_rows: Vec<FeedRow>,
}

/// What the importer must do about the overlap.
#[derive(Debug, Clone, Serialize)]
pub struct PlanFeedOverlapResult {
    /// Money rows the feed already covers — do not import these.
    pub matches: Vec<OverlapMatch>,
    /// Fast membership list over `matches`, in the same order.
    pub suppressed_source_ids: Vec<String>,
    /// Feed rows with no Money counterpart — spending the file never had.
    pub unmatched_feed_ids: Vec<String>,
    /// The residual, counted so it is visible rather than silent.
    pub kept_despite_overlap: KeptDespiteOverlap,
    /// The subset of `matches` that suppressed a TRANSFER leg, with the link
    /// columns the feed row must inherit. Acting on these is not optional: the
    /// counterpart's link now points at a row that will not be imported.
    pub transfer_handovers: Vec<TransferHandover>,
}

/// `Date.parse(iso.slice(0, 10) + 'T00:00:00.000Z')`.
fn day_of(text: Option<&str>) -> Option<Day> {
    let text = text?;
    if text.len() < 10 || !text.is_char_boundary(10) {
        return None;
    }
    text.get(..10).and_then(Day::parse)
}

/// One Money row, indexed.
struct Candidate<'a> {
    row: &'a MoneyRow,
    day: Option<Day>,
}

/// The best unclaimed candidate for a feed row: nearest date, description
/// breaks ties.
fn pick_best<'a>(
    pool: &[Candidate<'a>],
    claimed: &std::collections::BTreeSet<String>,
    feed_day: Option<Day>,
    feed_description: &str,
    tolerance: i64,
) -> Option<(&'a MoneyRow, i64, f64)> {
    let feed_day = feed_day?;
    let mut best: Option<(&'a MoneyRow, i64, f64)> = None;
    for candidate in pool {
        if claimed.contains(&candidate.row.id) {
            continue;
        }
        // A candidate whose own date is unreadable produces a NaN gap in the
        // TypeScript, and every comparison against NaN is false — so it can
        // never win. `None` here is the same answer arrived at honestly.
        let Some(day) = candidate.day else { continue };
        let gap = day.gap(feed_day);
        if gap > tolerance {
            continue;
        }
        let similarity = description_similarity(&candidate.row.description, feed_description);
        let better = match best {
            None => true,
            Some((_, best_gap, best_similarity)) => {
                gap < best_gap || (gap == best_gap && similarity > best_similarity)
            }
        };
        if better {
            best = Some((candidate.row, gap, similarity));
        }
    }
    best
}

/// Apply TS-I12 and TS-I13.
#[must_use]
#[allow(clippy::too_many_lines)]
pub fn plan_feed_overlap(command: &PlanFeedOverlap) -> PlanFeedOverlapResult {
    let tolerance = command
        .date_tolerance_days
        .unwrap_or(DEFAULT_DATE_TOLERANCE_DAYS)
        .max(0);

    // Index the Money rows by account + exact minor units, in three pools:
    // ordinary rows (suppressible outright), transfer legs (suppressible only
    // by handover) and split parents (never suppressed at all).
    let mut ordinary: BTreeMap<(String, i64), Vec<Candidate<'_>>> = BTreeMap::new();
    let mut transfers: BTreeMap<(String, i64), Vec<Candidate<'_>>> = BTreeMap::new();
    let mut split_parents: BTreeMap<(String, i64), Vec<Candidate<'_>>> = BTreeMap::new();
    let mut kept = KeptDespiteOverlap::default();

    for row in &command.transactions {
        let key = (row.account_id.clone(), row.amount.minor());
        let candidate = Candidate {
            row,
            day: day_of(row.date.as_deref()),
        };
        // A transfer that is ALSO a split parent counts as a split parent: the
        // stricter rule wins.
        if row.is_split {
            split_parents.entry(key).or_default().push(candidate);
        } else if row.r#type == RowType::Transfer {
            transfers.entry(key).or_default().push(candidate);
        } else {
            ordinary.entry(key).or_default().push(candidate);
        }
    }

    let mut matches: Vec<OverlapMatch> = Vec::new();
    let mut handovers: Vec<TransferHandover> = Vec::new();
    let mut claimed: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    let mut matched_feed_ids: std::collections::BTreeSet<String> =
        std::collections::BTreeSet::new();

    // Oldest feed row first, so a run of same-amount rows pairs off in order.
    // Stable, and unreadable days sort first — see the module documentation for
    // why that is a choice rather than a port.
    let mut ordered: Vec<&FeedRow> = command.feed_rows.iter().collect();
    ordered.sort_by_key(|feed| day_of(feed.date.as_deref()));

    let key_of = |feed: &FeedRow| (feed.account_id.clone(), feed.amount.minor());

    // ── Pass 1: ordinary rows ────────────────────────────────────────────────
    for feed in &ordered {
        let pool = ordinary.get(&key_of(feed)).map_or(&[][..], Vec::as_slice);
        let Some((row, gap, similarity)) = pick_best(
            pool,
            &claimed,
            day_of(feed.date.as_deref()),
            &feed.description,
            tolerance,
        ) else {
            continue;
        };
        claimed.insert(row.id.clone());
        matched_feed_ids.insert(feed.id.clone());
        matches.push(OverlapMatch {
            import_source_id: row.id.clone(),
            feed_transaction_id: feed.id.clone(),
            account_id: row.account_id.clone(),
            day_gap: gap,
            description_similarity: similarity,
            is_transfer_handover: false,
        });
    }

    // ── Pass 2: transfer legs, handed over to the feed row ───────────────────
    for feed in &ordered {
        if matched_feed_ids.contains(&feed.id) {
            continue;
        }
        let pool = transfers.get(&key_of(feed)).map_or(&[][..], Vec::as_slice);
        let Some((row, gap, similarity)) = pick_best(
            pool,
            &claimed,
            day_of(feed.date.as_deref()),
            &feed.description,
            tolerance,
        ) else {
            continue;
        };

        // The pairing qualifies. Can the feed row honestly BECOME the transfer?
        if feed.is_split || feed.linked_transfer_id.is_some() {
            claimed.insert(row.id.clone());
            kept.transfers = kept.transfers.saturating_add(1);
            continue;
        }

        claimed.insert(row.id.clone());
        matched_feed_ids.insert(feed.id.clone());
        matches.push(OverlapMatch {
            import_source_id: row.id.clone(),
            feed_transaction_id: feed.id.clone(),
            account_id: row.account_id.clone(),
            day_gap: gap,
            description_similarity: similarity,
            is_transfer_handover: true,
        });
        handovers.push(TransferHandover {
            import_source_id: row.id.clone(),
            feed_transaction_id: feed.id.clone(),
            account_id: row.account_id.clone(),
            transfer_account_id: row.transfer_account_id.clone(),
            counterpart_source_id: row.linked_transfer_id.clone(),
            counterpart_split_source_id: row.linked_transfer_split_id.clone(),
            day_gap: gap,
            description_similarity: similarity,
        });
    }

    // ── Pass 3: bookkeeping for the overlaps left standing ───────────────────
    let mut unmatched_feed_ids: Vec<String> = Vec::new();
    for feed in &ordered {
        if matched_feed_ids.contains(&feed.id) {
            continue;
        }
        unmatched_feed_ids.push(feed.id.clone());
        let pool = split_parents
            .get(&key_of(feed))
            .map_or(&[][..], Vec::as_slice);
        let Some((row, _, _)) = pick_best(
            pool,
            &claimed,
            day_of(feed.date.as_deref()),
            &feed.description,
            tolerance,
        ) else {
            continue;
        };
        claimed.insert(row.id.clone());
        kept.split_parents = kept.split_parents.saturating_add(1);
    }

    PlanFeedOverlapResult {
        suppressed_source_ids: matches
            .iter()
            .map(|entry| entry.import_source_id.clone())
            .collect(),
        matches,
        unmatched_feed_ids,
        kept_despite_overlap: kept,
        transfer_handovers: handovers,
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{day_of, plan_feed_overlap, FeedRow, MoneyRow, PlanFeedOverlap, RowType};
    use crate::money::Money;

    fn money(id: &str, amount: &str, date: &str) -> MoneyRow {
        MoneyRow {
            id: id.to_owned(),
            account_id: "mny-acct-1".to_owned(),
            date: Some(date.to_owned()),
            amount: Money::parse(amount).unwrap_or(Money::ZERO),
            description: "Corner Shop".to_owned(),
            r#type: RowType::Expense,
            is_split: false,
            transfer_account_id: None,
            linked_transfer_id: None,
            linked_transfer_split_id: None,
        }
    }

    fn feed(id: &str, amount: &str, date: Option<&str>) -> FeedRow {
        FeedRow {
            id: id.to_owned(),
            account_id: "mny-acct-1".to_owned(),
            date: date.map(ToOwned::to_owned),
            amount: Money::parse(amount).unwrap_or(Money::ZERO),
            description: "CORNER SHOP LTD 4471".to_owned(),
            is_split: false,
            linked_transfer_id: None,
        }
    }

    #[test]
    fn this_modules_day_reader_closes_v8s_fallback_by_construction() {
        // `iso.slice(0,10) + 'T00:00:00.000Z'` cannot reach the fallback
        // parser: a short or non-standard head produces a string that is not a
        // date in either language.
        assert!(day_of(Some("2026-05-10")).is_some());
        assert!(day_of(Some("2026-05-10T13:00:00.000Z")).is_some());
        assert_eq!(day_of(Some("2026-5-10")), None);
        assert_eq!(day_of(Some("not a date")), None);
        assert_eq!(day_of(Some("2026-05")), None);
        assert_eq!(day_of(None), None);
        // …and the rollover survives the truncation, as it does in node.
        assert_eq!(
            day_of(Some("2027-02-30T00:00:00.000Z")).map(super::Day::to_iso),
            Some("2027-03-02".to_owned())
        );
    }

    #[test]
    fn a_feed_row_whose_date_is_unreadable_matches_nothing() {
        // One feed row, so the ordering the TypeScript leaves to V8 is not in
        // play — which is why this is a crate test and not a differential spec.
        let plan = plan_feed_overlap(&PlanFeedOverlap {
            date_tolerance_days: None,
            transactions: vec![money("mny-txn-1", "-12.34", "2026-05-10")],
            feed_rows: vec![feed("feed-1", "-12.34", Some("not a date"))],
        });
        assert!(plan.matches.is_empty());
        assert_eq!(plan.unmatched_feed_ids, vec!["feed-1".to_owned()]);
    }

    #[test]
    fn a_money_row_whose_date_is_unreadable_is_never_the_one_chosen() {
        let mut unreadable = money("mny-txn-bad", "-12.34", "2026-05-10");
        unreadable.date = Some("nonsense".to_owned());
        let plan = plan_feed_overlap(&PlanFeedOverlap {
            date_tolerance_days: None,
            transactions: vec![unreadable, money("mny-txn-good", "-12.34", "2026-05-10")],
            feed_rows: vec![feed("feed-1", "-12.34", Some("2026-05-10"))],
        });
        assert_eq!(plan.suppressed_source_ids, vec!["mny-txn-good".to_owned()]);
    }
}
