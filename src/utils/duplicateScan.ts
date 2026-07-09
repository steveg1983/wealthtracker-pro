import type { Transaction } from '../types';
import { toDecimal } from './decimal';

/**
 * Duplicate-transaction scanning.
 *
 * Extracted from DuplicateDetection.tsx and restructured so the common case no
 * longer does an O(n²) pairwise sweep with a Levenshtein computation per pair
 * (~16k transactions ⇒ ~128 million string comparisons that froze the main
 * thread for seconds):
 *
 * - A pair can only reach the similarity threshold when its dates are within
 *   the date threshold IF the threshold is above what amount + description
 *   alone can contribute (70%). Above that (the 80% default), candidates come
 *   from a date-sorted index and each transaction is compared only against its
 *   date-window neighbours — ~O(n log n) on real data.
 * - At thresholds ≤ 70% distant dates can still match, so the scan falls back
 *   to all pairs — but computes the cheap date/amount scores first and skips
 *   the expensive Levenshtein whenever even a perfect description score could
 *   not reach the threshold (plus a length-difference upper bound on the
 *   description score, since edit distance is at least the length difference).
 *
 * Scoring is kept bit-for-bit identical to the original algorithm, with ONE
 * deliberate fix: the original divided the amount difference by the SIGNED
 * larger amount, so two negative amounts (e.g. -5 and -10) scored above 100%
 * "similarity" and auto-matched as duplicates regardless of date or
 * description. The denominator is now the larger ABSOLUTE amount, keeping the
 * amount score in 0..100 (which is also what makes the date-window pruning
 * mathematically sound).
 */

export interface DuplicateThresholds {
  /** Days within which two dates are considered close. */
  dateThreshold: number;
  /** Absolute currency difference treated as an exact amount match. */
  amountThreshold: number;
  /** Minimum total score (0–100) for a pair to count as duplicates. */
  similarityThreshold: number;
}

export interface SimilarityScore {
  dateScore: number;
  amountScore: number;
  descriptionScore: number;
  totalScore: number;
}

export interface DuplicateGroup {
  original: Transaction;
  potential: Transaction[];
  confidence: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;
/**
 * Highest total score reachable with a date score of 0, computed with the
 * exact float operations the total uses (100 * 0.3 is 30.000000000000004 in
 * IEEE-754, so this is deliberately NOT written as the literal 70).
 */
const MAX_SCORE_WITHOUT_DATE = 0 * 0.3 + 100 * 0.4 + 100 * 0.3;
const MAX_DESCRIPTION_CONTRIBUTION = 100 * 0.3;

const timeOf = (date: Date | string): number =>
  (date instanceof Date ? date : new Date(date)).getTime();

/** Two-row Levenshtein distance — same DP as the original full matrix. */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  let prev: number[] = new Array<number>(len1 + 1);
  let curr: number[] = new Array<number>(len1 + 1);
  for (let j = 0; j <= len1; j++) prev[j] = j;

  for (let i = 1; i <= len2; i++) {
    curr[0] = i;
    for (let j = 1; j <= len1; j++) {
      curr[j] = s2.charCodeAt(i - 1) === s1.charCodeAt(j - 1)
        ? prev[j - 1]
        : Math.min(prev[j - 1] + 1, curr[j - 1] + 1, prev[j] + 1);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[len1];
}

/** Similarity of two ALREADY normalized (lowercased + trimmed) strings, 0–100. */
function normalizedStringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 100;
  // s1 === s2 covers the both-empty case, so maxLen > 0 here.
  const maxLen = Math.max(s1.length, s2.length);
  return Math.round((1 - levenshteinDistance(s1, s2) / maxLen) * 100);
}

/** String similarity as a percentage (case/whitespace-insensitive). */
export function calculateStringSimilarity(str1: string, str2: string): number {
  return normalizedStringSimilarity(str1.toLowerCase().trim(), str2.toLowerCase().trim());
}

function dateScoreOf(time1: number, time2: number, dateThreshold: number): number {
  const daysDiff = Math.abs((time1 - time2) / DAY_MS);
  return daysDiff <= dateThreshold ? 100 - (daysDiff / dateThreshold) * 50 : 0;
}

function amountScoreOf(amount1: number, amount2: number, amountThreshold: number): number {
  const amountDiff = Math.abs(amount1 - amount2);
  return amountDiff <= amountThreshold
    ? 100
    : Math.max(0, 100 - (amountDiff / Math.max(Math.abs(amount1), Math.abs(amount2))) * 100);
}

/** Full similarity breakdown between two transactions. */
export function calculateSimilarity(
  t1: Transaction,
  t2: Transaction,
  thresholds: DuplicateThresholds
): SimilarityScore {
  const dateScore = dateScoreOf(timeOf(t1.date), timeOf(t2.date), thresholds.dateThreshold);
  const amountScore = amountScoreOf(
    toDecimal(t1.amount).toNumber(),
    toDecimal(t2.amount).toNumber(),
    thresholds.amountThreshold
  );
  const descriptionScore = calculateStringSimilarity(t1.description, t2.description);
  const totalScore = dateScore * 0.3 + amountScore * 0.4 + descriptionScore * 0.3;
  return { dateScore, amountScore, descriptionScore, totalScore };
}

interface PreparedTransaction {
  txn: Transaction;
  /** Position in the original transactions array (group/member ordering). */
  index: number;
  time: number;
  amount: number;
  /** Normalized (lowercased + trimmed) description. */
  desc: string;
}

export interface DuplicateScanIndex {
  prepared: PreparedTransaction[];
  /** Valid-dated transactions, ascending by time (candidate window lookups). */
  byTime: PreparedTransaction[];
  thresholds: DuplicateThresholds;
  /** Whether the threshold is high enough that matches require close dates. */
  datePruned: boolean;
}

/** Build the reusable index once, then match many candidates against it. */
export function buildDuplicateScanIndex(
  transactions: Transaction[],
  thresholds: DuplicateThresholds
): DuplicateScanIndex {
  const prepared = transactions.map((txn, index) => ({
    txn,
    index,
    time: timeOf(txn.date),
    amount: toDecimal(txn.amount).toNumber(),
    desc: txn.description.toLowerCase().trim(),
  }));
  const byTime = prepared
    .filter(p => !Number.isNaN(p.time))
    .sort((a, b) => a.time - b.time);
  return {
    prepared,
    byTime,
    thresholds,
    datePruned: thresholds.similarityThreshold > MAX_SCORE_WITHOUT_DATE,
  };
}

/** First position in byTime whose time is >= target. */
function lowerBound(byTime: PreparedTransaction[], target: number): number {
  let lo = 0;
  let hi = byTime.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (byTime[mid].time < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function candidatesFor(index: DuplicateScanIndex, time: number): PreparedTransaction[] {
  if (!index.datePruned) {
    return index.prepared;
  }
  if (Number.isNaN(time)) {
    // An invalid date always scores 0 on the date axis, which cannot reach a
    // date-pruned threshold — no candidates can match.
    return [];
  }
  const windowMs = index.thresholds.dateThreshold * DAY_MS;
  const lo = lowerBound(index.byTime, time - windowMs);
  const out: PreparedTransaction[] = [];
  for (let i = lo; i < index.byTime.length && index.byTime[i].time <= time + windowMs; i++) {
    out.push(index.byTime[i]);
  }
  return out;
}

/**
 * Total score if the pair meets the threshold, else null. Computes the cheap
 * date/amount scores first and only runs the Levenshtein when a perfect (or
 * length-bounded) description score could still reach the threshold.
 */
function matchScore(
  time: number,
  amount: number,
  desc: string,
  other: PreparedTransaction,
  thresholds: DuplicateThresholds
): number | null {
  const threshold = thresholds.similarityThreshold;
  const dateScore = dateScoreOf(time, other.time, thresholds.dateThreshold);
  const amountScore = amountScoreOf(amount, other.amount, thresholds.amountThreshold);
  // Same association as the original total: (date*0.3 + amount*0.4) + desc*0.3
  const partial = dateScore * 0.3 + amountScore * 0.4;
  // NaN partials fail this check, matching the original "NaN never matches".
  if (!(partial + MAX_DESCRIPTION_CONTRIBUTION >= threshold)) {
    return null;
  }

  let descriptionScore: number;
  if (desc === other.desc) {
    descriptionScore = 100;
  } else {
    // Edit distance is at least the length difference, so this bounds the
    // description score from above without running the DP.
    const maxLen = Math.max(desc.length, other.desc.length);
    const descriptionBound = Math.round((1 - Math.abs(desc.length - other.desc.length) / maxLen) * 100);
    if (partial + descriptionBound * 0.3 < threshold) {
      return null;
    }
    descriptionScore = normalizedStringSimilarity(desc, other.desc);
  }

  const totalScore = partial + descriptionScore * 0.3;
  return totalScore >= threshold ? totalScore : null;
}

/**
 * Match one candidate transaction (e.g. an imported row) against the indexed
 * set. Matches are returned in the indexed transactions' original order;
 * confidence is the best match's total score (0 when there are no matches).
 */
export function findDuplicateMatches(
  index: DuplicateScanIndex,
  candidate: Transaction
): { matches: Transaction[]; confidence: number } {
  const time = timeOf(candidate.date);
  const amount = toDecimal(candidate.amount).toNumber();
  const desc = candidate.description.toLowerCase().trim();

  const found: Array<{ entry: PreparedTransaction; score: number }> = [];
  for (const other of candidatesFor(index, time)) {
    const score = matchScore(time, amount, desc, other, index.thresholds);
    if (score !== null) {
      found.push({ entry: other, score });
    }
  }
  found.sort((a, b) => a.entry.index - b.entry.index);
  return {
    matches: found.map(f => f.entry.txn),
    confidence: found.length > 0 ? Math.max(...found.map(f => f.score)) : 0,
  };
}

/**
 * Group duplicate transactions. Semantics match the original pairwise sweep
 * exactly: transactions are seeded in array order, a seed's group contains
 * every not-yet-claimed transaction that meets the threshold against the seed
 * (in array order), claimed transactions never join another group, and the
 * group's confidence is its best match score.
 */
export function findDuplicateGroups(
  transactions: Transaction[],
  thresholds: DuplicateThresholds
): DuplicateGroup[] {
  const index = buildDuplicateScanIndex(transactions, thresholds);
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (const seed of index.prepared) {
    if (processed.has(seed.txn.id)) continue;

    const matches: Array<{ entry: PreparedTransaction; score: number }> = [];
    for (const other of candidatesFor(index, seed.time)) {
      if (other.index === seed.index || processed.has(other.txn.id)) continue;
      const score = matchScore(seed.time, seed.amount, seed.desc, other, thresholds);
      if (score !== null) {
        matches.push({ entry: other, score });
      }
    }

    if (matches.length > 0) {
      matches.sort((a, b) => a.entry.index - b.entry.index);
      for (const m of matches) processed.add(m.entry.txn.id);
      processed.add(seed.txn.id);
      groups.push({
        original: seed.txn,
        potential: matches.map(m => m.entry.txn),
        confidence: Math.max(...matches.map(m => m.score)),
      });
    }
  }

  return groups;
}
