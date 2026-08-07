/**
 * "Is this statement row already in the register?" — for OFX/statement imports.
 *
 * THE PROBLEM
 * -----------
 * The OFX importer asked that question with
 *
 *     existing.notes?.includes(`FITID: ${fitId}`)
 *
 * and nothing else. FITID is the bank's own per-transaction id and it IS the
 * right answer — but only when BOTH sides carry one, and the only rows that
 * carry one are rows this same importer wrote (it puts `FITID: …` in `notes`).
 * A row that arrived from the bank feed, from the MS Money import, from QIF or
 * by hand has no FITID anywhere, so it matched nothing and every one of those
 * transactions was imported a second time.
 *
 * Description cannot rescue it either. The two sides of a real pair look like
 * this (shapes, not anyone's actual statement):
 *
 *     already held                    | in the file
 *     --------------------------------+--------------------------------------
 *     Sweep Transfer from account 5566| Sweep Transfer from account 55667788
 *     Direct Debit - STREAMCO         | Direct Debit - STREAMCO  0011002233
 *     Nadia                           | Immediate Faster Payment (Online) to…
 *
 * Held descriptions get truncated by whatever wrote them, and users rename
 * payees to something they will recognise a year later ("Nadia"). Requiring the
 * two to agree, or even to be similar, misses most true duplicates.
 *
 * The register's own duplicate sweep (utils/duplicateSweep) scores description
 * similarity into a weighted total and needs 80: the truncated pairs clear it,
 * the renamed ones cannot, and no threshold that would catch them is safe in a
 * tool that DELETES. Here the consequence is "not added", which is why this
 * rule can be the wider one — and why what it finds is offered for review.
 *
 * THE RULE
 * --------
 * Two tiers, and they are reported separately because they are not equally
 * certain:
 *
 *   1. FITID on both sides — the bank saying "this is the same transaction".
 *      Proof; no review needed.
 *   2. Same ACCOUNT, same amount to the exact penny, date within
 *      `dateToleranceDays`. Strong evidence, not proof, so it is offered for
 *      review rather than acted on silently.
 *
 * Description is a RANKING signal for tier 2 and never a gate — see the table
 * above for why. This mirrors `findFeedOverlap` (the MS Money ↔ bank feed
 * problem solved the same way in July 2026) deliberately: same shape, same
 * reasoning, one fewer thing to learn.
 *
 * WHY GENUINE SAME-DAY SAME-AMOUNT PAIRS SURVIVE
 * ----------------------------------------------
 * Two £20 cash withdrawals on one day are a real thing. Matching is strictly
 * 1:1 and greedy: each held row is claimed by at most one file row and vice
 * versa. So if the register holds ONE £20 withdrawal and the file carries TWO,
 * exactly one is flagged and the other imports. The count of flagged rows can
 * never exceed the count of held rows that could account for them.
 */
import { toDecimal } from './decimal';
import { toDateMs } from './dateBoundary';

/**
 * Feeds post on the settlement date; a hand-entered or Money-sourced row
 * carries the transaction date. Three days is what `findFeedOverlap` settled
 * on for the same reason, and the 1:1 rule bounds what a wider window can cost.
 */
export const DEFAULT_STATEMENT_DATE_TOLERANCE_DAYS = 3;

const MS_PER_DAY = 86_400_000;

/** How the match was made. 'fitid' is proof; 'amount-and-date' is evidence. */
export type StatementMatchBasis = 'fitid' | 'amount-and-date';

/** A row arriving from the file. Identified by its position in the list. */
export interface IncomingStatementRow {
  date: Date | string | number | null | undefined;
  amount: number;
  description: string;
  /**
   * The file's FITID for this row. Read from `notes` by {@link readFitId} when
   * the caller only has the drafted transaction.
   */
  fitId: string | null;
}

/** A transaction the register already holds. */
export interface HeldTransactionRow {
  id: string;
  accountId: string;
  date: Date | string | number | null | undefined;
  amount: number;
  description: string;
  notes?: string;
  /** Carried through only so the review list can say where the row came from. */
  cleared?: boolean;
}

export interface StatementDuplicateMatch {
  /** Index into the `incoming` array — the file row that is already held. */
  incomingIndex: number;
  /** The file's id for that row, when it has one. */
  fitId: string | null;
  /** The held row it matches. */
  heldId: string;
  heldDescription: string;
  heldDate: Date;
  heldAmount: number;
  heldCleared: boolean;
  basis: StatementMatchBasis;
  /** Whole days between the two dates (0 = same day). */
  dayGap: number;
  /** 0–1 token overlap of the two descriptions. Ranking and display only. */
  descriptionSimilarity: number;
}

export interface StatementDuplicateResult {
  /** Proven duplicates — the bank's own id on both sides. */
  certain: StatementDuplicateMatch[];
  /** Same account, exact amount, near date. For a human to confirm. */
  possible: StatementDuplicateMatch[];
}

/**
 * The FITID this importer wrote into a transaction's notes, or null.
 *
 * `notes` is the ONLY place the OFX importer records it — there is no column
 * for it, and the boot query does not fetch `bank_reference` or the feed's
 * `external_transaction_id`, so notes is also the only place a running app can
 * read one back from. Anchored to a line start and terminated by whitespace or
 * end-of-line, so `FITID: 123` cannot match a row whose id is `1234`.
 */
export function readFitId(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = /(?:^|\n)FITID:[ \t]*(\S+)[ \t]*(?:\r?$)/m.exec(notes);
  return match ? match[1] : null;
}

/** Exact pence — Decimal in, integer out. No float arithmetic on money. */
const pence = (amount: number): number => toDecimal(amount).times(100).round().toNumber();

/** Midnight UTC of the row's calendar day, or NaN when the date is unusable. */
const dayOf = (value: Date | string | number | null | undefined): number => {
  const ms = toDateMs(value);
  if (!Number.isFinite(ms)) return Number.NaN;
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
};

/** Alphanumeric word tokens, upper-cased; short noise words dropped. */
const tokens = (text: string): Set<string> =>
  new Set(
    text
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(token => token.length > 2)
  );

/** Jaccard overlap of the two token sets — 1 identical, 0 nothing in common. */
export function descriptionSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / (left.size + right.size - shared);
}

interface HeldCandidate {
  row: HeldTransactionRow;
  day: number;
}

/** Append into a bucketed index without re-reading it twice. */
function push<T>(index: Map<string, T[]>, key: string, entry: T): void {
  const list = index.get(key);
  if (list) list.push(entry);
  else index.set(key, [entry]);
}

function toMatch(
  incomingIndex: number,
  fitId: string | null,
  held: HeldTransactionRow,
  basis: StatementMatchBasis,
  dayGap: number,
  similarity: number
): StatementDuplicateMatch {
  return {
    incomingIndex,
    fitId,
    heldId: held.id,
    heldDescription: held.description,
    heldDate: new Date(toDateMs(held.date)),
    heldAmount: held.amount,
    heldCleared: held.cleared === true,
    basis,
    dayGap,
    descriptionSimilarity: similarity,
  };
}

/**
 * Which rows of an incoming statement the register already holds.
 *
 * `heldRows` may be the whole register; only rows in `accountId` are ever
 * considered, because the same amount on the same day in a DIFFERENT account is
 * a different transaction. An empty `accountId` matches nothing — an import
 * with no destination has no register to compare against.
 *
 * Neither input is mutated, and nothing is decided here: the caller chooses
 * what to do with each tier.
 */
export function findStatementDuplicates(
  incoming: readonly IncomingStatementRow[],
  heldRows: readonly HeldTransactionRow[],
  accountId: string,
  options: { dateToleranceDays?: number } = {}
): StatementDuplicateResult {
  const certain: StatementDuplicateMatch[] = [];
  const possible: StatementDuplicateMatch[] = [];
  if (!accountId) return { certain, possible };

  const tolerance = Math.max(0, options.dateToleranceDays ?? DEFAULT_STATEMENT_DATE_TOLERANCE_DAYS);

  const byFitId = new Map<string, HeldTransactionRow[]>();
  const byAmount = new Map<string, HeldCandidate[]>();

  for (const row of heldRows) {
    if (row.accountId !== accountId) continue;
    const heldFitId = readFitId(row.notes);
    if (heldFitId !== null) push(byFitId, heldFitId, row);
    const day = dayOf(row.date);
    // A row whose date cannot be read is a duplicate of nothing: it has no
    // position on the calendar to compare, and guessing one would pair it with
    // whatever happened to share its amount.
    if (Number.isFinite(day)) push(byAmount, String(pence(row.amount)), { row, day });
  }

  /** Held ids already accounted for. Each may explain at most one file row. */
  const claimed = new Set<string>();

  // ── Pass 1: the bank's own id, on both sides ───────────────────────────────
  // First, so a FITID pair can never be broken up by the weaker rule below.
  for (let index = 0; index < incoming.length; index++) {
    const row = incoming[index];
    if (row.fitId === null) continue;
    const held = (byFitId.get(row.fitId) ?? []).find(candidate => !claimed.has(candidate.id));
    if (!held) continue;
    claimed.add(held.id);
    const gap = Math.abs(dayOf(row.date) - dayOf(held.date)) / MS_PER_DAY;
    certain.push(
      toMatch(
        index,
        row.fitId,
        held,
        'fitid',
        Number.isFinite(gap) ? gap : 0,
        descriptionSimilarity(row.description, held.description)
      )
    );
  }

  const matchedIncoming = new Set(certain.map(match => match.incomingIndex));

  // ── Pass 2: same account, exact pence, near date ───────────────────────────
  for (let index = 0; index < incoming.length; index++) {
    if (matchedIncoming.has(index)) continue;
    const row = incoming[index];
    const day = dayOf(row.date);
    if (!Number.isFinite(day)) continue;

    let best: HeldCandidate | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    let bestSimilarity = -1;
    for (const candidate of byAmount.get(String(pence(row.amount))) ?? []) {
      if (claimed.has(candidate.row.id)) continue;
      const gap = Math.abs(candidate.day - day) / MS_PER_DAY;
      if (gap > tolerance) continue;
      const similarity = descriptionSimilarity(row.description, candidate.row.description);
      // Nearest date wins; description breaks ties, so when several held rows
      // are eligible the most plausible pairing is the one offered.
      if (gap < bestGap || (gap === bestGap && similarity > bestSimilarity)) {
        best = candidate;
        bestGap = gap;
        bestSimilarity = similarity;
      }
    }

    if (!best) continue;
    claimed.add(best.row.id);
    possible.push(toMatch(index, row.fitId, best.row, 'amount-and-date', bestGap, bestSimilarity));
  }

  return { certain, possible };
}
