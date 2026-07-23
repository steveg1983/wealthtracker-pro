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
 * TRANSFER LEGS: HANDOVER, NOT EXEMPTION
 * --------------------------------------
 * A transfer leg used to be exempt outright, on the reasoning that dropping one
 * leg strands its counterpart. In a fed account that reasoning left the LARGEST
 * rows in the overlap window — card payments, standing transfers — duplicated,
 * because the feed reports them exactly like any other movement.
 *
 * So a transfer leg is not exempt; it is HANDED OVER. When the feed already
 * covers it, the Money leg is suppressed and the feed row TAKES ITS PLACE in
 * the transfer: typed `transfer`, carrying the leg's `transfer_account_id` and
 * transfer category, linked to the counterpart — and the counterpart's own link
 * is re-pointed at the feed row. Nothing is stranded, and the payment exists
 * exactly once.
 *
 * The handover NEVER widens the match. It fires only on a pairing that already
 * qualifies — same account, exact pence, within tolerance, strictly 1:1 — and
 * only after every ordinary row has had its chance to claim that feed row
 * (see the two passes below). It is refused, and the leg kept as before, when
 * the feed row could not honestly become a transfer: a split parent (the
 * database's own trigger forbids re-typing one) or a row already half of some
 * other linked pair.
 *
 * WHAT IS STILL NEVER SUPPRESSED
 * ------------------------------
 *  - split parents: their category breakdown lives in child rows the feed has
 *    no equivalent for; dropping the parent would orphan the split.
 *  - transfer legs whose handover was refused, for the reasons above.
 * Both are counted in the result so the residual is visible rather than silent.
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
  /**
   * Is this feed row a split parent? One cannot be re-typed as a transfer —
   * `protect_split_transaction_fields` (migration 20260713100000) rejects it —
   * so it is never handed a transfer leg. Omitted ⇒ not a split.
   */
  isSplit?: boolean;
  /**
   * Is this feed row already one side of a linked transfer? Then it belongs to
   * that pair and is never re-pointed at another. Omitted ⇒ unlinked.
   */
  linkedTransferId?: string | null;
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
  /** The account both sides share, in the Money side's namespace. */
  accountId: string;
  /** Whole days between the two dates (0 = same day). */
  dayGap: number;
  /** 0–1 token overlap of the two descriptions; ranking only. */
  descriptionSimilarity: number;
  /** True when the suppressed row was a transfer leg (see `transferHandovers`). */
  isTransferHandover: boolean;
}

/**
 * A suppressed transfer leg and the feed row that inherits its place in the
 * transfer. Everything the importer needs to rebuild the pair without the leg:
 * which account the transfer faced, and which row (or split line) the other
 * side is — still in the SEED's namespace, because the importer is the only
 * thing that knows what database ids those become.
 */
export interface TransferHandover {
  /** `mny-txn-<htrn>` of the Money transfer leg being suppressed. */
  importSourceId: string;
  /** Database id of the feed row that takes its place. */
  feedTransactionId: string;
  /** The account the leg sits in, in the Money side's namespace. */
  accountId: string;
  /** The account on the OTHER side of the transfer (seed namespace), if any. */
  transferAccountId: string | null;
  /** The other leg (seed namespace), if the pair was linked. */
  counterpartSourceId: string | null;
  /** The split LINE the other side is, when the counterpart is a split leg. */
  counterpartSplitSourceId: string | null;
  dayGap: number;
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
  /**
   * The subset of `matches` that suppressed a TRANSFER leg, with the link
   * columns the feed row must inherit. Every entry's `importSourceId` is in
   * `suppressedSourceIds`; acting on them is not optional, because the
   * counterpart's link now points at a row that will not be imported.
   */
  transferHandovers: TransferHandover[];
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
  accountId: string;
  day: number;
  description: string;
}

interface TransferCandidate extends Candidate {
  transferAccountId: string | null;
  counterpartSourceId: string | null;
  counterpartSplitSourceId: string | null;
}

/** Append into a bucketed index without re-reading it twice. */
function push<T>(index: Map<string, T[]>, key: string, entry: T): void {
  const list = index.get(key);
  if (list) list.push(entry);
  else index.set(key, [entry]);
}

/** The best unclaimed candidate for a feed row: nearest date, description breaks ties. */
function pickBest<T extends Candidate>(
  pool: readonly T[],
  claimed: ReadonlySet<string>,
  feedDay: number,
  feedDescription: string,
  tolerance: number
): { candidate: T; gap: number; similarity: number } | null {
  let best: T | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  let bestSimilarity = -1;
  for (const c of pool) {
    if (claimed.has(c.sourceId)) continue;
    const gap = Math.abs(c.day - feedDay) / MS_PER_DAY;
    if (gap > tolerance) continue;
    const similarity = descriptionSimilarity(c.description, feedDescription);
    if (gap < bestGap || (gap === bestGap && similarity > bestSimilarity)) {
      best = c;
      bestGap = gap;
      bestSimilarity = similarity;
    }
  }
  return best ? { candidate: best, gap: bestGap, similarity: bestSimilarity } : null;
}

/**
 * Decide which Money transactions the bank feed already covers.
 *
 * `transactions` are the app-shaped rows from `transformMsMoneyExport`;
 * `feedRows` are the user's existing bank-fed transactions with their account
 * ids translated into the import's namespace. Neither input is mutated.
 *
 * Two passes, in this order and for this reason:
 *
 *   1. ORDINARY rows. Unchanged, and it runs first so that adding the second
 *      pass cannot move a single pairing it used to make: a feed row only
 *      reaches the transfer pool once nothing ordinary wanted it.
 *   2. TRANSFER legs, over the feed rows pass 1 left unclaimed — the very rows
 *      that used to be written off as "an overlap we chose to keep". Matching
 *      is identical (same account, exact pence, ≤ tolerance, 1:1 against the
 *      same `claimed` set); the difference is what happens afterwards, which is
 *      a handover rather than a plain drop.
 */
export function findFeedOverlap(
  transactions: readonly Transaction[],
  feedRows: readonly ExistingFeedTransaction[],
  options: FeedOverlapOptions = {}
): FeedOverlapResult {
  const tolerance = Math.max(0, options.dateToleranceDays ?? DEFAULT_TOLERANCE_DAYS);

  // Index the Money rows by account + exact pence, in three pools: ordinary
  // rows (suppressible outright), transfer legs (suppressible only by handover)
  // and split parents (never suppressed at all). A transfer that is ALSO a
  // split parent counts as a split parent — the stricter rule wins.
  const byKey = new Map<string, Candidate[]>();
  const transferByKey = new Map<string, TransferCandidate[]>();
  const splitParentByKey = new Map<string, Candidate[]>();
  const kept = { transfers: 0, splitParents: 0 };

  for (const t of transactions) {
    const key = `${t.accountId}|${pence(t.amount)}`;
    const entry: Candidate = {
      sourceId: t.id, accountId: t.accountId, day: dayOf(t.date), description: t.description ?? '',
    };
    if (t.isSplit === true) push(splitParentByKey, key, entry);
    else if (t.type === 'transfer') {
      push(transferByKey, key, {
        ...entry,
        transferAccountId: t.transferAccountId ?? null,
        counterpartSourceId: t.linkedTransferId ?? null,
        counterpartSplitSourceId: t.linkedTransferSplitId ?? null,
      });
    } else push(byKey, key, entry);
  }

  const matches: FeedOverlapMatch[] = [];
  const transferHandovers: TransferHandover[] = [];
  const claimed = new Set<string>();
  const matchedFeedIds = new Set<string>();

  // Oldest feed row first, so a run of same-amount rows pairs off in order.
  const ordered = [...feedRows].sort((a, b) => dayOf(a.date) - dayOf(b.date));
  const keyOf = (feed: ExistingFeedTransaction): string => `${feed.accountId}|${pence(feed.amount)}`;

  // ── Pass 1: ordinary rows ──────────────────────────────────────────────────
  for (const feed of ordered) {
    const hit = pickBest(byKey.get(keyOf(feed)) ?? [], claimed, dayOf(feed.date), feed.description, tolerance);
    if (!hit) continue;
    claimed.add(hit.candidate.sourceId);
    matchedFeedIds.add(feed.id);
    matches.push({
      importSourceId: hit.candidate.sourceId,
      feedTransactionId: feed.id,
      accountId: hit.candidate.accountId,
      dayGap: hit.gap,
      descriptionSimilarity: hit.similarity,
      isTransferHandover: false,
    });
  }

  // ── Pass 2: transfer legs, handed over to the feed row ─────────────────────
  for (const feed of ordered) {
    if (matchedFeedIds.has(feed.id)) continue;
    const hit = pickBest(transferByKey.get(keyOf(feed)) ?? [], claimed, dayOf(feed.date), feed.description, tolerance);
    if (!hit) continue;

    // The pairing qualifies. Can the feed row honestly BECOME the transfer?
    // A split parent cannot be re-typed (the database's trigger refuses it) and
    // a row already half of another pair is not ours to re-point. Either way the
    // leg stays exactly as it was before handovers existed, and is counted.
    if (feed.isSplit === true || (feed.linkedTransferId ?? null) !== null) {
      claimed.add(hit.candidate.sourceId);
      kept.transfers++;
      continue;
    }

    claimed.add(hit.candidate.sourceId);
    matchedFeedIds.add(feed.id);
    matches.push({
      importSourceId: hit.candidate.sourceId,
      feedTransactionId: feed.id,
      accountId: hit.candidate.accountId,
      dayGap: hit.gap,
      descriptionSimilarity: hit.similarity,
      isTransferHandover: true,
    });
    transferHandovers.push({
      importSourceId: hit.candidate.sourceId,
      feedTransactionId: feed.id,
      accountId: hit.candidate.accountId,
      transferAccountId: hit.candidate.transferAccountId,
      counterpartSourceId: hit.candidate.counterpartSourceId,
      counterpartSplitSourceId: hit.candidate.counterpartSplitSourceId,
      dayGap: hit.gap,
      descriptionSimilarity: hit.similarity,
    });
  }

  // ── Pass 3: bookkeeping for the overlaps left standing ─────────────────────
  // A split parent the feed also covers is a real overlap that will not be
  // removed. Counting it keeps the residual visible instead of silent.
  const unmatchedFeedIds: string[] = [];
  for (const feed of ordered) {
    if (matchedFeedIds.has(feed.id)) continue;
    unmatchedFeedIds.push(feed.id);
    const hit = pickBest(splitParentByKey.get(keyOf(feed)) ?? [], claimed, dayOf(feed.date), feed.description, tolerance);
    if (!hit) continue;
    claimed.add(hit.candidate.sourceId);
    kept.splitParents++;
  }

  return {
    matches,
    suppressedSourceIds: new Set(matches.map(m => m.importSourceId)),
    unmatchedFeedIds,
    keptDespiteOverlap: kept,
    transferHandovers,
  };
}
