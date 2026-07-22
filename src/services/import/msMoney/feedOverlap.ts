/**
 * Bank-feed overlap suppression for the MS Money import.
 *
 * THE PROBLEM
 * -----------
 * A Money file is a complete history up to the day it was exported. A live
 * bank feed backfills its own history from the day the account was linked.
 * Where the two windows overlap, the SAME real-world transaction exists twice:
 * once written by the file import (no feed id) and once by the feed (carrying
 * `external_transaction_id`). Nothing reconciled them, so every overlapping
 * payment was counted twice in reports.
 *
 * The importer's own `import_source_id` idempotency cannot help here: the two
 * copies come from different systems with different identifiers. They have to
 * be matched on what they describe.
 *
 * THE RULE (deliberately narrow — a false positive deletes real spending)
 * ----------------------------------------------------------------------
 * A Money transaction is suppressed only when a bank-feed row in the SAME
 * account has the EXACT same amount (to the penny) and a date within
 * `dateToleranceDays` (default 3 — feeds post on the settlement date, Money
 * records the transaction date). Matching is strictly 1:1 and greedy: each
 * feed row claims at most one Money row and vice versa, so at most
 * `feedRows.length` Money rows can ever be dropped. Candidates are ranked by
 * date distance first, then by description similarity, so when several rows
 * are eligible the most plausible pairing wins.
 *
 * Description is a RANKING signal, never a gate. Feed descriptions are the
 * bank's raw strings ("AMZNMktplace ..."), Money's are payee names ("Amazon");
 * requiring them to agree would miss most true duplicates.
 *
 * WHAT IS NEVER SUPPRESSED
 * ------------------------
 *  - transfers: dropping one leg would strand its counterpart and break the
 *    linked pair. Overlapping transfer legs are reported, not removed.
 *  - split parents: their category breakdown lives in child rows the feed has
 *    no equivalent for; dropping the parent would orphan the split.
 * Both exclusions are counted in the result so the residual is visible rather
 * than silent.
 *
 * WHY THE FEED ROW IS THE ONE KEPT
 * --------------------------------
 * In the overlap window the feed row is what the bank actually reports, it
 * carries the provider's own id, and it is the row future syncs reconcile
 * against. It cannot be recreated from the Money file; the Money row can.
 */
import { toDecimal } from '../../../utils/decimal';
import type { Transaction } from '../../../types';

/** A transaction already in the database that came from a bank feed. */
export interface ExistingFeedTransaction {
  /** Database row id — only used for reporting. */
  id: string;
  /** Account id in the IMPORT's namespace (caller maps the DB uuid across). */
  accountId: string;
  /** yyyy-mm-dd */
  date: string;
  /** Signed amount; parsed through Decimal, never float. */
  amount: string | number;
  description: string;
}

export interface FeedOverlapOptions {
  /** Feeds post on settlement date; Money records the transaction date. */
  dateToleranceDays?: number;
}

export interface FeedOverlapMatch {
  /** `mny-txn-<htrn>` of the Money row the feed already covers. */
  importSourceId: string;
  /** Database id of the feed row that covers it. */
  feedTransactionId: string;
  /** Whole days between the two dates (0 = same day). */
  dayGap: number;
  /** 0–1 token overlap of the two descriptions; ranking only. */
  descriptionSimilarity: number;
}

export interface FeedOverlapResult {
  /** Money rows the feed already covers — do not import these. */
  matches: FeedOverlapMatch[];
  /** Fast membership test over `matches`. */
  suppressedSourceIds: Set<string>;
  /** Feed rows with no Money counterpart — spending the file never had. */
  unmatchedFeedIds: string[];
  /** Overlaps found but deliberately left in place, by reason. */
  keptDespiteOverlap: { transfers: number; splitParents: number };
}

const DEFAULT_TOLERANCE_DAYS = 3;
const MS_PER_DAY = 86_400_000;

/** Exact pence — Decimal in, integer out, no float arithmetic anywhere. */
const pence = (amount: string | number): number =>
  toDecimal(String(amount)).times(100).round().toNumber();

const dayOf = (value: Date | string): number => {
  const iso = value instanceof Date ? value.toISOString() : String(value);
  return Date.parse(`${iso.slice(0, 10)}T00:00:00.000Z`);
};

/** Alphanumeric word tokens, upper-cased; short noise words dropped. */
const tokens = (text: string): Set<string> =>
  new Set(
    text
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(t => t.length > 2)
  );

/** Jaccard overlap of the two token sets — 1 identical, 0 nothing in common. */
export function descriptionSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

interface Candidate {
  sourceId: string;
  day: number;
  description: string;
}

/**
 * Decide which Money transactions the bank feed already covers.
 *
 * `transactions` are the app-shaped rows from `transformMsMoneyExport`;
 * `feedRows` are the user's existing bank-fed transactions with their account
 * ids translated into the import's namespace. Neither input is mutated.
 */
export function findFeedOverlap(
  transactions: readonly Transaction[],
  feedRows: readonly ExistingFeedTransaction[],
  options: FeedOverlapOptions = {}
): FeedOverlapResult {
  const tolerance = Math.max(0, options.dateToleranceDays ?? DEFAULT_TOLERANCE_DAYS);

  // Index the importable Money rows by account + exact pence. Transfers and
  // split parents are indexed separately: they are never suppressed, but an
  // overlap involving one is still worth reporting.
  const byKey = new Map<string, Candidate[]>();
  const excludedByKey = new Map<string, (Candidate & { kind: 'transfer' | 'splitParent' })[]>();
  const kept = { transfers: 0, splitParents: 0 };

  for (const t of transactions) {
    const key = `${t.accountId}|${pence(t.amount)}`;
    const entry: Candidate = { sourceId: t.id, day: dayOf(t.date), description: t.description ?? '' };
    if (t.type === 'transfer' || t.isSplit === true) {
      const kind = t.type === 'transfer' ? 'transfer' : 'splitParent';
      const list = excludedByKey.get(key);
      if (list) list.push({ ...entry, kind });
      else excludedByKey.set(key, [{ ...entry, kind }]);
      continue;
    }
    const list = byKey.get(key);
    if (list) list.push(entry);
    else byKey.set(key, [entry]);
  }

  const matches: FeedOverlapMatch[] = [];
  const claimed = new Set<string>();
  const unmatchedFeedIds: string[] = [];

  // Oldest feed row first, so a run of same-amount rows pairs off in order.
  const ordered = [...feedRows].sort((a, b) => dayOf(a.date) - dayOf(b.date));

  for (const feed of ordered) {
    const key = `${feed.accountId}|${pence(feed.amount)}`;
    const feedDay = dayOf(feed.date);

    const pool = (byKey.get(key) ?? []).filter(c => !claimed.has(c.sourceId));
    let best: Candidate | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    let bestSimilarity = -1;

    for (const c of pool) {
      const gap = Math.abs(c.day - feedDay) / MS_PER_DAY;
      if (gap > tolerance) continue;
      const similarity = descriptionSimilarity(c.description, feed.description);
      // Nearest date wins; description breaks ties.
      if (gap < bestGap || (gap === bestGap && similarity > bestSimilarity)) {
        best = c;
        bestGap = gap;
        bestSimilarity = similarity;
      }
    }

    if (!best) {
      unmatchedFeedIds.push(feed.id);
      // A transfer leg or split parent within the same window and amount is an
      // overlap we deliberately chose to keep — count it once, so the residual
      // is visible instead of silent.
      const excludedMatch = (excludedByKey.get(key) ?? []).find(
        c => !claimed.has(c.sourceId) && Math.abs(c.day - feedDay) / MS_PER_DAY <= tolerance
      );
      if (excludedMatch) {
        claimed.add(excludedMatch.sourceId);
        if (excludedMatch.kind === 'transfer') kept.transfers++; else kept.splitParents++;
      }
      continue;
    }

    claimed.add(best.sourceId);
    matches.push({
      importSourceId: best.sourceId,
      feedTransactionId: feed.id,
      dayGap: bestGap,
      descriptionSimilarity: bestSimilarity,
    });
  }

  return {
    matches,
    suppressedSourceIds: new Set(matches.map(m => m.importSourceId)),
    unmatchedFeedIds,
    keptDespiteOverlap: kept,
  };
}
