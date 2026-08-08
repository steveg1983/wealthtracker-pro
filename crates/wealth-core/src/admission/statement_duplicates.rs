//! TS-I7 / TS-I6 — "is this statement row already in the register?"
//!
//! Port of `src/utils/statementDuplicates.ts`. Nothing here writes anything and
//! nothing here decides anything either: it reports two tiers, and the caller
//! chooses.
//!
//! # Two tiers, because they are not equally certain
//!
//! 1. **FITID on both sides** — the bank's own per-transaction id, saying "this
//!    is the same transaction". Proof. Reported as `certain`, and TS-I6 says it
//!    is never overridable by an "import anyway" tick, because there the bank
//!    itself is the one asserting the identity.
//! 2. **Same account, same amount to the exact penny, date within tolerance** —
//!    strong evidence, not proof. Reported as `possible`, for a person to
//!    confirm.
//!
//! The FITID pass runs first and claims its rows first, so a pairing the bank
//! named can never be broken up by the weaker rule.
//!
//! # Why description cannot be a gate, and is not
//!
//! The two sides of a real pair look like this (shapes, not anyone's statement):
//!
//! ```text
//! already held                     | in the file
//! ---------------------------------+-------------------------------------
//! Sweep Transfer from account 5566 | Sweep Transfer from account 55667788
//! Direct Debit - STREAMCO          | Direct Debit - STREAMCO  0011002233
//! Nadia                            | Immediate Faster Payment (Online) to…
//! ```
//!
//! Held descriptions are truncated by whatever wrote them, and users rename
//! payees to something they will recognise a year later. The third row shares
//! not one token with its own other half. Requiring the descriptions to agree —
//! or merely to be similar — misses most true duplicates, so similarity RANKS
//! and never gates.
//!
//! # Why genuine same-day same-amount pairs survive
//!
//! Two £20 cash withdrawals on one day is a real thing. Matching is strictly
//! 1:1 and greedy: each held row is claimed by at most one file row and each
//! file row claims at most one held row. If the register holds ONE £20
//! withdrawal and the file carries TWO, exactly one is flagged and the other
//! imports. The count of flagged rows can never exceed the count of held rows
//! that could account for them.
//!
//! # What the port changes, and it is one thing
//!
//! `exactPence` disappears. In the TypeScript it is a defence —
//! `toDecimal(amount).times(100).round().toNumber()` — because `amount` is a
//! double and `===` on two doubles is not a comparison of two amounts of money.
//! Here the amount is a [`Money`], which is already an `i64` count of minor
//! units, so the defence has nothing to defend against and the comparison is
//! `==` on two integers. A defence replaced by a type is the only kind of
//! simplification this port is allowed to make.
//!
//! It has a visible edge, and it is DECLARED rather than hidden: `exactPence`
//! *rounds* a three-decimal amount (`-12.345` → `-1235` minor, half away from
//! zero) and [`Money::parse`](crate::money::Money::parse) *refuses* it. So a
//! statement quoting sub-penny amounts is deduplicated by the TypeScript and
//! refused outright by this port. That is the same divergence
//! `crate::money` already declares against both Postgres and the TypeScript
//! money boundary, arriving at a third site; the differential lane pins both
//! sides of it.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use super::day::Day;
use super::text::description_similarity;
use crate::money::Money;

/// Feeds post on the settlement date; a hand-entered or Money-sourced row
/// carries the transaction date. Three days is what `findFeedOverlap` settled
/// on for the same reason, and the 1:1 rule bounds what a wider window costs.
pub const DEFAULT_DATE_TOLERANCE_DAYS: i64 = 3;

/// A row arriving from the file. Identified by its position in the list.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct IncomingRow {
    /// The file's date for this row, as text. Unreadable text is a real input.
    #[serde(default)]
    pub date: Option<String>,
    /// Signed amount.
    pub amount: Money,
    /// What the file calls it.
    #[serde(default)]
    pub description: String,
    /// The file's FITID for this row, when it has one.
    #[serde(default)]
    pub fit_id: Option<String>,
}

/// A transaction the register already holds.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HeldRow {
    /// The register's own id.
    pub id: String,
    /// Which account it sits in. Rows outside the destination are never
    /// considered.
    pub account_id: String,
    /// The stored date, as text.
    #[serde(default)]
    pub date: Option<String>,
    /// Signed amount.
    pub amount: Money,
    /// What the register calls it — possibly what the user renamed it to.
    #[serde(default)]
    pub description: String,
    /// The stored notes, which is the ONLY place a FITID can be read back from.
    #[serde(default)]
    pub notes: Option<String>,
    /// Carried through only so the review list can say where the row came from.
    #[serde(default)]
    pub cleared: Option<bool>,
}

/// How the match was made.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum MatchBasis {
    /// The bank's own id, on both sides. Proof.
    #[serde(rename = "fitid")]
    FitId,
    /// Same account, exact pence, near date. Evidence.
    #[serde(rename = "amount-and-date")]
    AmountAndDate,
}

/// One file row the register already holds, and the row it holds.
#[derive(Debug, Clone, Serialize)]
pub struct DuplicateMatch {
    /// Index into the `incoming` list — the file row that is already held.
    pub incoming_index: usize,
    /// The file's id for that row, when it has one.
    pub fit_id: Option<String>,
    /// The held row it matches.
    pub held_id: String,
    /// The held row's description, for the review list.
    pub held_description: String,
    /// The held row's day, or `None` when the register's own date is
    /// unreadable — which the FITID tier can reach and the amount tier cannot.
    pub held_date: Option<String>,
    /// The held row's amount.
    pub held_amount: Money,
    /// Whether the held row was already reconciled.
    pub held_cleared: bool,
    /// Which tier this is.
    pub basis: MatchBasis,
    /// Whole days between the two dates (0 = same day).
    pub day_gap: i64,
    /// 0–1 token overlap of the two descriptions. Ranking and display only.
    pub description_similarity: f64,
}

/// Which rows of an incoming statement the register already holds.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanStatementDuplicates {
    /// The destination. An empty one matches nothing: an import with no
    /// destination has no register to compare against.
    pub account_id: String,
    /// Days of settlement slack. Absent means [`DEFAULT_DATE_TOLERANCE_DAYS`];
    /// a negative one is clamped to zero.
    #[serde(default)]
    pub date_tolerance_days: Option<i64>,
    /// The file's rows, in file order.
    pub incoming: Vec<IncomingRow>,
    /// What the register holds. May be the whole register; only rows in
    /// `account_id` are ever considered.
    pub held: Vec<HeldRow>,
}

/// The two tiers, reported separately.
#[derive(Debug, Clone, Serialize)]
pub struct PlanStatementDuplicatesResult {
    /// Proven duplicates — the bank's own id on both sides.
    pub certain: Vec<DuplicateMatch>,
    /// Same account, exact amount, near date. For a human to confirm.
    pub possible: Vec<DuplicateMatch>,
}

/// The FITID this importer wrote into a transaction's notes, or nothing.
///
/// Port of `readFitId`, whose regular expression is
/// `/(?:^|\n)FITID:[ \t]*(\S+)[ \t]*(?:\r?$)/m`. Written as a scan rather than
/// with a regex engine because this crate has no regex dependency and does not
/// want one for eleven lines.
///
/// The anchoring is the point and is reproduced exactly: the tag must start a
/// line, and the id must be the whole of the rest of it. Without that,
/// `FITID: 123` would match a row whose id is `1234`, and every transaction in
/// a bank's sequential range would answer to its neighbours' queries.
#[must_use]
pub fn read_fit_id(notes: Option<&str>) -> Option<String> {
    let notes = notes?;
    // `(?:^|\n)` matches at the start of the string or immediately after a
    // newline, which is exactly the start of each `\n`-delimited segment.
    for line in notes.split('\n') {
        let Some(rest) = line.strip_prefix("FITID:") else {
            continue;
        };
        let rest = rest.trim_start_matches([' ', '\t']);
        // `\S+`, greedy but unable to cross whitespace.
        let id: String = rest.chars().take_while(|c| !c.is_whitespace()).collect();
        if id.is_empty() {
            continue;
        }
        let Some(tail) = rest.get(id.len()..) else {
            continue;
        };
        let tail = tail.trim_start_matches([' ', '\t']);
        // `[ \t]*(?:\r?$)` — with the `m` flag `$` sits at the end of the line,
        // so anything else after the id means this line is not a FITID line.
        if tail.is_empty() || tail == "\r" {
            return Some(id);
        }
    }
    None
}

/// A held row that is a candidate on amount, with its day resolved once.
struct Candidate<'a> {
    row: &'a HeldRow,
    day: Day,
}

fn day_of(text: Option<&str>) -> Option<Day> {
    text.and_then(Day::parse)
}

fn to_match(
    incoming_index: usize,
    fit_id: Option<String>,
    held: &HeldRow,
    basis: MatchBasis,
    day_gap: i64,
    similarity: f64,
) -> DuplicateMatch {
    DuplicateMatch {
        incoming_index,
        fit_id,
        held_id: held.id.clone(),
        held_description: held.description.clone(),
        held_date: day_of(held.date.as_deref()).map(Day::to_iso),
        held_amount: held.amount,
        held_cleared: held.cleared == Some(true),
        basis,
        day_gap,
        description_similarity: similarity,
    }
}

/// Report which rows of an incoming statement the register already holds.
///
/// Neither input is mutated and nothing is decided: the caller chooses what to
/// do with each tier.
#[must_use]
pub fn plan_statement_duplicates(
    command: &PlanStatementDuplicates,
) -> PlanStatementDuplicatesResult {
    let mut certain: Vec<DuplicateMatch> = Vec::new();
    let mut possible: Vec<DuplicateMatch> = Vec::new();
    if command.account_id.is_empty() {
        return PlanStatementDuplicatesResult { certain, possible };
    }

    let tolerance = command
        .date_tolerance_days
        .unwrap_or(DEFAULT_DATE_TOLERANCE_DAYS)
        .max(0);

    let mut by_fit_id: BTreeMap<String, Vec<&HeldRow>> = BTreeMap::new();
    let mut by_amount: BTreeMap<i64, Vec<Candidate<'_>>> = BTreeMap::new();

    for row in &command.held {
        if row.account_id != command.account_id {
            continue;
        }
        if let Some(held_fit_id) = read_fit_id(row.notes.as_deref()) {
            by_fit_id.entry(held_fit_id).or_default().push(row);
        }
        // A row whose date cannot be read is a duplicate of nothing on the
        // amount tier: it has no position on the calendar to compare, and
        // guessing one would pair it with whatever happened to share its
        // amount. It stays indexed by FITID, where the bank has already said
        // the two are the same and the date is not being used as evidence.
        if let Some(day) = day_of(row.date.as_deref()) {
            by_amount
                .entry(row.amount.minor())
                .or_default()
                .push(Candidate { row, day });
        }
    }

    // Held ids already accounted for. Each may explain at most one file row.
    let mut claimed: BTreeSet<String> = BTreeSet::new();

    // ── Pass 1: the bank's own id, on both sides ────────────────────────────
    // First, so a FITID pair can never be broken up by the weaker rule below.
    let mut matched_incoming: BTreeSet<usize> = BTreeSet::new();
    for (index, row) in command.incoming.iter().enumerate() {
        let Some(fit_id) = row.fit_id.as_deref() else {
            continue;
        };
        // In INSERTION order, and the first unclaimed one: two held rows can
        // carry the same FITID, and which of them answers is part of the 1:1
        // guarantee rather than an accident.
        let Some(held) = by_fit_id
            .get(fit_id)
            .and_then(|rows| rows.iter().find(|held| !claimed.contains(&held.id)))
        else {
            continue;
        };
        claimed.insert(held.id.clone());
        matched_incoming.insert(index);
        let gap = match (day_of(row.date.as_deref()), day_of(held.date.as_deref())) {
            (Some(left), Some(right)) => left.gap(right),
            // `Number.isFinite(gap) ? gap : 0` — an unreadable date on either
            // side leaves the gap unstated rather than invented.
            _ => 0,
        };
        certain.push(to_match(
            index,
            row.fit_id.clone(),
            held,
            MatchBasis::FitId,
            gap,
            description_similarity(&row.description, &held.description),
        ));
    }

    // ── Pass 2: same account, exact pence, near date ─────────────────────────
    for (index, row) in command.incoming.iter().enumerate() {
        if matched_incoming.contains(&index) {
            continue;
        }
        let Some(day) = day_of(row.date.as_deref()) else {
            continue;
        };

        let mut best: Option<(&HeldRow, i64, f64)> = None;
        for candidate in by_amount.get(&row.amount.minor()).into_iter().flatten() {
            if claimed.contains(&candidate.row.id) {
                continue;
            }
            let gap = candidate.day.gap(day);
            if gap > tolerance {
                continue;
            }
            let similarity = description_similarity(&row.description, &candidate.row.description);
            // Nearest date wins; description breaks ties, so when several held
            // rows are eligible the most plausible pairing is the one offered.
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

        let Some((held, gap, similarity)) = best else {
            continue;
        };
        claimed.insert(held.id.clone());
        possible.push(to_match(
            index,
            row.fit_id.clone(),
            held,
            MatchBasis::AmountAndDate,
            gap,
            similarity,
        ));
    }

    PlanStatementDuplicatesResult { certain, possible }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::read_fit_id;

    #[test]
    fn reads_the_id_the_ofx_importer_writes_and_only_a_whole_one() {
        assert_eq!(
            read_fit_id(Some("FITID: 2026060401\nCheck #: 1234")).as_deref(),
            Some("2026060401")
        );
        assert_eq!(
            read_fit_id(Some("Ref: 99\nFITID: ABC-123")).as_deref(),
            Some("ABC-123")
        );
        assert_eq!(read_fit_id(Some("FITID:ABC")).as_deref(), Some("ABC"));
        assert_eq!(read_fit_id(Some("FITID: ABC \r")).as_deref(), Some("ABC"));
        // Anchored: a longer id must not answer to a shorter query, or every
        // transaction in a bank's sequential range would match its neighbours.
        assert_ne!(read_fit_id(Some("FITID: 12345")).as_deref(), Some("1234"));
        assert_eq!(read_fit_id(Some("paid the FITID: 7 invoice")), None);
        assert_eq!(read_fit_id(Some("FITID: A B")), None);
        assert_eq!(read_fit_id(Some("FITID:")), None);
        assert_eq!(read_fit_id(Some("FITID:   ")), None);
        assert_eq!(read_fit_id(Some("")), None);
        assert_eq!(read_fit_id(None), None);
    }

    #[test]
    fn the_first_fitid_line_wins_and_a_broken_one_does_not_stop_the_scan() {
        // `.exec` returns the first match; a line that is not a FITID line is
        // skipped rather than ending the search.
        assert_eq!(
            read_fit_id(Some("FITID: A B\nFITID: GOOD")).as_deref(),
            Some("GOOD")
        );
        assert_eq!(
            read_fit_id(Some("FITID: FIRST\nFITID: SECOND")).as_deref(),
            Some("FIRST")
        );
    }
}
