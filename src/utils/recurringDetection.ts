import { toDecimal, type DecimalInstance } from './decimal';

/**
 * Recurring-payment detection — the app noticing a pattern in the ledger.
 *
 * DESIGN (Claude Design handover, 17 Aug 2026): a detection is an INFERENCE,
 * not a fact, and must carry its evidence — the payment count, the span, the
 * most recent date and the next expected one are the confidence, stated in
 * terms the reader can check. No confidence percentages, ever: "87% sure" is
 * a number the app cannot justify to a reader. Irregular patterns say so in
 * words rather than being rounded to "monthly".
 *
 * ── HOW A PATTERN QUALIFIES ────────────────────────────────────────────────
 * The discriminator between a subscription and a habit is the AMOUNT. Netflix
 * is the same figure to the penny month after month; a supermarket is a
 * different figure every visit. So rows are grouped by payee-and-account,
 * and within a group only RUNS of consecutive identical amounts count —
 * two or more payments at exactly the same figure. A one-off odd amount at a
 * regular payee (a top-up, a partial refund) drops out without breaking the
 * pattern around it; a payee whose every amount differs produces no runs and
 * no detection. Three qualifying payments is the floor — two of anything is
 * a coincidence.
 *
 * A change of run — one sustained figure giving way to another — is a PRICE
 * CHANGE, the single most useful thing this detection can surface, and is
 * reported with its date and annual impact.
 *
 * ── A PAYEE THE USER HAS VOUCHED FOR IS READ LENIENTLY ─────────────────────
 * The amount rule tells a subscription from a shop, but it also silences a
 * commitment whose figure genuinely moves — a tradesman's retainer, a
 * variable utility. When the user has CONFIRMED a pattern (the report's
 * Confirm, or Mark as recurring on a transaction), that judgment outranks the
 * heuristic: every payment at the payee counts, two payments are enough to
 * show a rhythm, and the cadence is still classified honestly — a vouched
 * pattern that wanders says "roughly every 5 weeks" like any other. What
 * vouching never does is invent payments or a rhythm; one payment is still
 * one payment, and shows nothing.
 *
 * ── A RENAMED PAYEE IS STILL ONE COMMITMENT ────────────────────────────────
 * Banks re-label. The owner's own case (18 Aug): a maintenance payment that
 * ran for years under one wording, then reappeared under a longer one — same
 * account, same figure, same category, same day-of-month — and the detector
 * reported a stopped pattern plus a young one. So groups are STITCHED when
 * the evidence is overwhelming, all five conditions at once:
 *
 *   1. one label's words are contained in the other's (a rename extends or
 *      truncates; "ACME" ⊂ "ACME PROPERTY MAINTENANCE" stitches, while two
 *      unrelated payees that merely share a figure never do);
 *   2. the figure at the joint matches to the penny;
 *   3. the category at the joint matches, and both rows have one;
 *   4. both sides are sustained — two or more payments each;
 *   5. the combined dates still hold ONE rhythm (which also rules out a gap
 *      at the joint: a rhythm with a hole in it is not regular).
 *
 * The newest label is the identity; the older ones are carried as
 * `formerLabels` so the evidence line can say "previously labelled …", and
 * `payeeKeys` carries every identity so a verdict stored before the rename
 * still finds its pattern. A replacement that shares no wording (one
 * supplier swapped for another at the same price) deliberately does NOT
 * stitch — that is a question for the user, not an inference.
 *
 * ── WHAT THIS NEVER DOES ───────────────────────────────────────────────────
 * Reads the register; never writes it. A detection is not a transaction and
 * must never be edited into one (handover §5). Confirm/dismiss state lives
 * beside the detections — not on the rows they were read from.
 */

export type RecurringCadence = 'weekly' | 'monthly' | 'annual' | 'irregular';

export interface RecurringPriceChange {
  /** Magnitudes, in the account's currency. */
  from: DecimalInstance;
  to: DecimalInstance;
  /** First payment at the new figure. */
  when: Date;
  /** Signed: positive when the commitment grew. Annualised at the cadence. */
  annualDelta: DecimalInstance;
}

export interface RecurringDetection {
  /** Stable identity for confirm/dismiss state: account + normalised payee + direction. */
  key: string;
  /** The most recent raw description — what the reader will recognise. */
  description: string;
  /**
   * The normalised payee identity the pattern was grouped by. Exposed so an
   * answer can be STORED against the pattern (utils/suggestionDismissals'
   * recurringAnswerKey) without re-deriving the normalisation at a call site
   * that could drift from this module's.
   */
  payeeKey: string;
  /**
   * EVERY identity this pattern has worn, newest first — `payeeKey` plus the
   * normalised keys of any stitched-away labels. A verdict is MATCHED against
   * all of them (a Confirm given before the bank renamed the payee must keep
   * feeding the calendar) and STORED against the first.
   */
  payeeKeys: string[];
  /**
   * The most recent raw description of each stitched-away label, oldest
   * first — what "previously labelled …" shows. Empty when nothing was
   * stitched.
   */
  formerLabels: string[];
  accountId: string;
  /** 'out' is a commitment; 'in' is recurring income (a salary), kept for the calendar. */
  direction: 'in' | 'out';
  cadence: RecurringCadence;
  /** "monthly", or in words when irregular: "roughly every 5 weeks". */
  cadenceLabel: string;
  /** The CURRENT figure — the latest sustained run's amount, as a magnitude. */
  amount: DecimalInstance;
  /** What a year of this costs (or brings), at the cadence. */
  annualEquivalent: DecimalInstance;
  /** The evidence: how many qualifying payments, over what span. */
  count: number;
  firstDate: Date;
  lastDate: Date;
  /** last + the observed rhythm. null when the pattern has stopped. */
  nextExpected: Date | null;
  /** Ran, then didn't: more than two rhythms of silence. */
  stopped: boolean;
  priceChange: RecurringPriceChange | null;
  medianIntervalDays: number;
  /**
   * True when the identical-amounts rule was WAIVED because the user vouched
   * for the payee: every payment counted, and the figure shown is simply the
   * latest. The evidence line says so — a claim resting on the user's own
   * judgment must not dress as one resting on the arithmetic.
   */
  relaxed: boolean;
}

interface TransactionLike {
  accountId: string;
  description: string;
  amount: number;
  date: Date | string;
  type: string;
  /** The category id, when filed — one of the stitch's corroborators. */
  category?: string;
}

export interface RecurringDetectionOptions {
  /**
   * Has the user vouched for this payee? Wired to the stored
   * 'recurring-confirmed' verdicts by every caller (the report, the
   * calendar), but taken as a predicate so this module never learns the
   * dismissal-key format.
   */
  isVouched?: (accountId: string, direction: 'in' | 'out', payeeKey: string) => boolean;
}

const DAY_MS = 86_400_000;

/** At least this many qualifying payments before a pattern is claimed. */
export const MIN_PAYMENTS = 3;

/** Payments enough to show a rhythm once the USER has said it is one. */
export const MIN_VOUCHED_PAYMENTS = 2;

/**
 * The direction a signed amount travels — one definition, used by the
 * detector and by every surface that writes a verdict about a transaction,
 * so a key built at a call site cannot disagree with the grouping here.
 */
export function recurringDirectionOf(amount: number): 'in' | 'out' {
  return amount < 0 ? 'out' : 'in';
}

/**
 * The payee identity behind a raw bank description: lowercased, with digits
 * and punctuation collapsed — "NETFLIX.COM 4029" and "NETFLIX.COM 5817" are
 * one payee wearing two reference numbers. A description that is ALL digits
 * keeps its raw form rather than collapsing to nothing.
 */
export function normalisePayeeKey(description: string): string {
  const collapsed = description
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z&' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return collapsed === '' ? description.toLowerCase().trim() : collapsed;
}

/** Median of a non-empty numeric array. */
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * The cadence a rhythm belongs to, with the windows deliberately generous —
 * a monthly direct debit lands on the nearest working day, so its intervals
 * wander 28–33 days. Everything outside a window is IRREGULAR and says so in
 * words (handover §2: rounding "roughly every 5 weeks" to "monthly" is not
 * honest).
 */
function classifyCadence(medianDays: number, maxDeviation: number): {
  cadence: RecurringCadence;
  label: string;
  annualFactor: DecimalInstance;
} {
  // A rhythm is only a rhythm if the intervals hold to it: one interval
  // straying more than half the median from it means the words below would
  // claim a regularity the dates do not show.
  const regular = maxDeviation <= medianDays * 0.5;
  if (regular && medianDays >= 6 && medianDays <= 8) {
    return { cadence: 'weekly', label: 'weekly', annualFactor: toDecimal(52) };
  }
  // 26–33, not 26–35: a real direct debit wanders to 33 (a 31-day month plus
  // a weekend shift), but 35 is five weeks — the handover's own example of a
  // rhythm that must NOT be rounded to "monthly".
  if (regular && medianDays >= 26 && medianDays <= 33) {
    return { cadence: 'monthly', label: 'monthly', annualFactor: toDecimal(12) };
  }
  if (regular && medianDays >= 350 && medianDays <= 380) {
    return { cadence: 'annual', label: 'annual', annualFactor: toDecimal(1) };
  }
  // In words, at the truthful unit: days under a fortnight, weeks under a
  // quarter, months beyond. 365.25/median annualises what was observed.
  const label =
    medianDays < 14 ? `roughly every ${Math.round(medianDays)} days`
      : medianDays < 90 ? `roughly every ${Math.round(medianDays / 7)} weeks`
        : `roughly every ${Math.round(medianDays / 30.44)} months`;
  return {
    cadence: 'irregular',
    label,
    annualFactor: toDecimal(365.25).dividedBy(toDecimal(medianDays)),
  };
}

interface QualifyingRow {
  date: Date;
  /** Magnitude, to the penny — the run identity. */
  amountKey: string;
  amount: DecimalInstance;
  description: string;
  /** The category id, or null when the row is unfiled. */
  category: string | null;
}

interface Group {
  accountId: string;
  direction: 'in' | 'out';
  payeeKey: string;
  /** Sorted by date, oldest first, before the stitch pass runs. */
  rows: QualifyingRow[];
  /** See {@link RecurringDetection.formerLabels}. */
  formerLabels: string[];
  /** The normalised keys of every stitched-away label. */
  formerPayeeKeys: string[];
}

const tokensOf = (payeeKey: string): Set<string> =>
  new Set(payeeKey.split(' ').filter(Boolean));

/** True when the smaller set's every token appears in the larger's. */
const oneLabelContainsTheOther = (a: string, b: string): boolean => {
  const [tokensA, tokensB] = [tokensOf(a), tokensOf(b)];
  const [small, large] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  for (const token of small) if (!large.has(token)) return false;
  return true;
};

/**
 * Do these dates, in order, hold to ONE rhythm? The same regularity test the
 * cadence words use (no interval straying more than half the median), which
 * is what makes it the right joint test for a stitch: a gap where a rhythm
 * paused between two labels fails it, and so does a same-day duplicate.
 */
const rhythmHolds = (rows: readonly QualifyingRow[]): boolean => {
  const intervals: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    intervals.push((rows[i].date.getTime() - rows[i - 1].date.getTime()) / DAY_MS);
  }
  if (intervals.length === 0 || intervals.some(days => days < 1)) return false;
  const medianDays = median(intervals);
  return intervals.every(days => Math.abs(days - medianDays) <= medianDays * 0.5);
};

/**
 * Merge groups that are one commitment under a renamed label — the five
 * conditions in the header, all required. The newest label absorbs the
 * older; a fixpoint loop lets a twice-renamed payee (A → B → C) stitch in
 * two passes, each joint proven on its own evidence.
 */
function stitchRenamedPayees(groups: Map<string, Group>): void {
  let merged = true;
  while (merged) {
    merged = false;
    const entries = [...groups.entries()];
    outer:
    for (const [, newer] of entries) {
      for (const [olderKey, older] of entries) {
        if (older === newer) continue;
        if (older.accountId !== newer.accountId || older.direction !== newer.direction) continue;
        if (older.rows.length < 2 || newer.rows.length < 2) continue;
        const olderLast = older.rows[older.rows.length - 1];
        const newerFirst = newer.rows[0];
        // The older label must have finished before the newer began — a
        // period where both labels were paying is two payees, not a rename.
        if (olderLast.date.getTime() >= newerFirst.date.getTime()) continue;
        if (olderLast.amountKey !== newerFirst.amountKey) continue;
        if (!olderLast.category || olderLast.category !== newerFirst.category) continue;
        if (!oneLabelContainsTheOther(older.payeeKey, newer.payeeKey)) continue;
        const combined = [...older.rows, ...newer.rows];
        if (!rhythmHolds(combined)) continue;

        newer.rows = combined;
        newer.formerLabels.push(...older.formerLabels, olderLast.description);
        newer.formerPayeeKeys.push(...older.formerPayeeKeys, older.payeeKey);
        groups.delete(olderKey);
        merged = true;
        break outer;
      }
    }
  }
}

/**
 * Find every recurring pattern in a transaction set.
 *
 * `now` is a parameter, not a read of the clock, so the same ledger always
 * produces the same detections in a test — and so "stopped" is a statement
 * about a date the caller chose to stand on.
 */
export function detectRecurring(
  transactions: readonly TransactionLike[],
  now: Date,
  options?: RecurringDetectionOptions
): RecurringDetection[] {
  // Transfers move money between the user's own accounts — a standing order
  // to savings is a rhythm, but not a commitment to anyone else, and the
  // transfer pages already show it.
  const groups = new Map<string, Group>();
  for (const t of transactions) {
    if (t.type !== 'income' && t.type !== 'expense') continue;
    if (t.amount === 0) continue;
    const date = t.date instanceof Date ? t.date : new Date(t.date);
    if (Number.isNaN(date.getTime())) continue;
    const direction = recurringDirectionOf(t.amount);
    const payeeKey = normalisePayeeKey(t.description);
    const key = `${t.accountId}::${direction}::${payeeKey}`;
    const amount = toDecimal(t.amount).abs();
    const row: QualifyingRow = {
      date,
      amount,
      amountKey: amount.toFixed(2),
      description: t.description,
      category: t.category ?? null,
    };
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else {
      groups.set(key, {
        accountId: t.accountId, direction, payeeKey,
        rows: [row], formerLabels: [], formerPayeeKeys: [],
      });
    }
  }

  for (const group of groups.values()) {
    group.rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  stitchRenamedPayees(groups);

  const detections: RecurringDetection[] = [];

  for (const [key, group] of groups) {
    const { accountId, direction, payeeKey, rows, formerLabels, formerPayeeKeys } = group;
    const payeeKeys = [payeeKey, ...formerPayeeKeys];
    // Vouched under ANY of its labels — a Confirm given before the bank
    // renamed the payee still counts.
    const vouched = payeeKeys.some(
      k => options?.isVouched?.(accountId, direction, k) ?? false
    );
    if (rows.length < (vouched ? MIN_VOUCHED_PAYMENTS : MIN_PAYMENTS)) continue;

    // Runs of consecutive identical amounts. Only runs of two or more
    // qualify: a sustained figure is what tells a subscription from a shop.
    const runs: QualifyingRow[][] = [];
    let current: QualifyingRow[] = [rows[0]];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].amountKey === current[current.length - 1].amountKey) {
        current.push(rows[i]);
      } else {
        runs.push(current);
        current = [rows[i]];
      }
    }
    runs.push(current);
    const sustained = runs.filter(run => run.length >= 2);
    let qualifying = sustained.flat();
    // The vouched relaxation: when the amount rule finds too little but the
    // user has said this IS a commitment, every payment counts as it stands.
    const relaxed = qualifying.length < MIN_PAYMENTS && vouched;
    if (relaxed) qualifying = rows;
    if (qualifying.length < (vouched ? MIN_VOUCHED_PAYMENTS : MIN_PAYMENTS)) continue;

    const intervals: number[] = [];
    for (let i = 1; i < qualifying.length; i++) {
      intervals.push((qualifying[i].date.getTime() - qualifying[i - 1].date.getTime()) / DAY_MS);
    }
    // Same-day duplicates (a split bill, a retried card) are not a rhythm.
    if (intervals.some(days => days < 1)) continue;
    const medianDays = median(intervals);
    const maxDeviation = Math.max(...intervals.map(days => Math.abs(days - medianDays)));
    const { cadence, label, annualFactor } = classifyCadence(medianDays, maxDeviation);

    const first = qualifying[0];
    const last = qualifying[qualifying.length - 1];
    // Relaxed patterns have no runs to lean on: the current figure is simply
    // the latest payment's, and no price change is claimed — a delta between
    // two figures that were never sustained is not a price change.
    const amount = relaxed
      ? last.amount
      : sustained[sustained.length - 1][0].amount;

    // Stopped: silence longer than two rhythms. Two, not one — a direct debit
    // that slipped a few days must not be pronounced dead (handover §3.2:
    // never delete a detection silently; stopped is a band, not an absence).
    const silenceDays = (now.getTime() - last.date.getTime()) / DAY_MS;
    const stopped = silenceDays > medianDays * 2;

    // Only a run at a DIFFERENT figure is a price change: two runs of the
    // same amount (a pattern briefly interrupted by a one-off) changed
    // nothing worth announcing.
    const previousRun = !relaxed && sustained.length >= 2 ? sustained[sustained.length - 2] : null;
    const currentRun = relaxed ? null : sustained[sustained.length - 1];
    const priceChange: RecurringPriceChange | null =
      previousRun && currentRun && !previousRun[0].amount.equals(amount)
        ? {
            from: previousRun[0].amount,
            to: amount,
            when: currentRun[0].date,
            annualDelta: amount.minus(previousRun[0].amount).times(annualFactor),
          }
        : null;

    detections.push({
      key,
      description: last.description,
      payeeKey,
      payeeKeys,
      formerLabels,
      accountId,
      direction,
      cadence,
      cadenceLabel: label,
      amount,
      annualEquivalent: amount.times(annualFactor),
      count: qualifying.length,
      firstDate: first.date,
      lastDate: last.date,
      nextExpected: stopped ? null : new Date(last.date.getTime() + Math.round(medianDays) * DAY_MS),
      stopped,
      priceChange,
      medianIntervalDays: medianDays,
      relaxed,
    });
  }

  // Largest commitment first within the caller's own banding.
  return detections.sort((a, b) => b.annualEquivalent.minus(a.annualEquivalent).toNumber());
}
