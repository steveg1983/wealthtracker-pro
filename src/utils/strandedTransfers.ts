import { toDecimal } from './decimal';
import { calculateStringSimilarity } from './duplicateScan';
import { sweepTransferPairs, SWEEP_WINDOW_DAYS, type TransferPairSuggestion } from './transferSweep';
import type { Category, Transaction } from '../types';

/**
 * Stranded transfers — the residue the clean sweep cannot touch.
 *
 * sweepTransferPairs pairs the easy case: both sides uncategorised, unlinked,
 * exactly opposite, a few days apart. What is left over on real data is a tail
 * of rows that plainly ARE transfers but whose other side is taken, filed, or
 * simply missing. Measured on the owner's history, every one of these is real:
 *
 *  - a −£200 leg linked to a car-hire refund four days away, while the true
 *    same-day +£200 twin sits stranded (a wrong link, made by an earlier pass);
 *  - a same-account, same-day duplicate leg from a bank-feed/import overlap:
 *    one copy linked, its identical twin stranded with no counterpart at all;
 *  - a twin that carries a real category ("Dental"), which is sometimes a
 *    mis-filing and sometimes pure coincidence — two unrelated £180 rows;
 *  - rows with no counterpart anywhere.
 *
 * The product rule this file exists to serve: THE SYSTEM MUST NEVER CREATE OR
 * LEAVE A ONE-SIDED TRANSFER. So a row with no other side is never offered
 * "make it a transfer" — it is offered the Account Adjustment filing, which is
 * a revaluation and therefore leaves income and expenses alone.
 *
 * Nothing is mutated here. Each finding carries every row the UI needs to show
 * the evidence and every row the action needs to touch; the caller reviews one
 * finding at a time and confirms.
 */

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Descriptions that read like a movement between accounts rather than a
 * purchase: "Transfer (Online)", "Sweep to savings", "TO/FROM", and the UK
 * bank-feed shorthand that names both account tails ("1234 & 5678").
 */
export const TRANSFER_SHAPED_DESCRIPTION = /transfer|sweep|to\/from|\d{4}\s*&\s*\d{4}/i;

/** Description similarity (0–100) at which two same-day, same-amount rows in one account read as the same row twice. */
const DUPLICATE_DESCRIPTION_SIMILARITY = 85;

export type StrandedFindingKind = 'duplicate' | 'claimed' | 'categorised' | 'one-sided';

interface FindingBase {
  /** The stranded row: uncategorised, unlinked, and unmatched by the clean sweep. */
  row: Transaction;
}

/** An identical row in the same account is already linked — this one is the spare copy. */
export interface DuplicateFinding extends FindingBase {
  kind: 'duplicate';
  /** The same-account, same-day, same-amount row that is already a transfer. */
  duplicateOf: Transaction;
  descriptionScore: number;
}

/** The exact opposite exists, but it is already linked to someone else — and this row is a better match. */
export interface ClaimedTwinFinding extends FindingBase {
  kind: 'claimed';
  /** The opposite row, currently linked to `currentPartner`. */
  counterpart: Transaction;
  /** The row the counterpart is linked to today — the one a re-pair would strand. */
  currentPartner: Transaction;
  /** Days between the stranded row and the counterpart. */
  daysApart: number;
  /** Days between the counterpart and the partner it is linked to today. */
  partnerDaysApart: number;
  descriptionScore: number;
  /** True when this row won on wording alone (same day gap, transfer-shaped description). */
  wonOnDescription: boolean;
}

/** The exact opposite exists and is unlinked, but somebody filed it under a real category. */
export interface CategorisedTwinFinding extends FindingBase {
  kind: 'categorised';
  counterpart: Transaction;
  /** The category the counterpart carries today, for the "is this a coincidence?" question. */
  counterpartCategoryName: string;
  daysApart: number;
  descriptionScore: number;
}

/** Transfer-shaped, but nothing anywhere in the window is its opposite. */
export interface OneSidedFinding extends FindingBase {
  kind: 'one-sided';
}

export type StrandedFinding =
  | DuplicateFinding
  | ClaimedTwinFinding
  | CategorisedTwinFinding
  | OneSidedFinding;

export interface StrandedSweepResult {
  findings: StrandedFinding[];
  /** Rows considered (uncategorised, unlinked, unmatched by the clean sweep). */
  scanned: number;
}

export interface StrandedSweepOptions {
  windowDays?: number;
  /**
   * The clean sweep's suggestions, when the caller has already computed them.
   * Rows the clean sweep can pair are NOT stranded, and running the sweep twice
   * over a long history is wasted work.
   */
  sweepSuggestions?: TransferPairSuggestion[];
}

const pennies = (amount: number): number => toDecimal(amount).times(100).toDecimalPlaces(0).toNumber();

const timeOf = (date: Date | string): number => new Date(date).getTime();

/** Calendar day, in the same local frame every date in the app is read in. */
const dayKeyOf = (date: Date | string): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const daysBetween = (a: Transaction, b: Transaction): number =>
  Math.abs(timeOf(a.date) - timeOf(b.date)) / DAY_MS;

const isTransferShaped = (description: string): boolean =>
  TRANSFER_SHAPED_DESCRIPTION.test(description ?? '');

/** Linked, or typed as a transfer — either way, this row's transfer-hood is already claimed. */
const isTakenAsTransfer = (t: Transaction): boolean =>
  Boolean(t.linkedTransferId) || t.type === 'transfer';

/**
 * Rows a corrective action may touch. A split parent cannot become (or stop
 * being) a transfer, and a leg whose opposite is a split LINE unlinks through
 * a different structure entirely — neither is offered rather than half-handled.
 * Archived rows are excluded too: they are out of the live register, so an
 * offer to change one would act on something the user cannot see.
 */
const isActionable = (t: Transaction): boolean =>
  !t.isSplit && !t.linkedTransferSplitId && t.archived !== true;

/**
 * The user's "Account Adjustment" category — the filing for a transfer-shaped
 * row that has no other side.
 *
 * Resolved from the user's OWN categories, never hardcoded and never created:
 * it is a revaluation leaf (migration 20260725100000), so it is ruled out of
 * income and expenses by category semantics (utils/incomeExpense). The flag is
 * the identity; the name is the fallback for a category tree that predates the
 * flag. Returns null when the user has no such category, which the UI must
 * report rather than work around.
 */
export function resolveAdjustmentCategory(categories: Category[]): Category | null {
  const named = (c: Category): boolean => {
    const name = c.name.trim().toLowerCase();
    return name === 'account adjustment' || name === 'account adjustments';
  };
  const usable = (c: Category): boolean =>
    c.isActive !== false && c.isTransferCategory !== true && c.level !== 'type';

  return (
    categories.find(c => usable(c) && c.isRevaluationCategory === true && named(c)) ??
    categories.find(c => usable(c) && named(c)) ??
    null
  );
}

/**
 * Classify the leftovers. Every row gets AT MOST ONE finding, in priority
 * order — a duplicate is a duplicate whatever else it looks like, a claimed
 * twin outranks a categorised one, and "no other side at all" is the last
 * resort.
 */
export function findStrandedTransfers(
  transactions: Transaction[],
  categories: Category[],
  opts: StrandedSweepOptions = {}
): StrandedSweepResult {
  const windowDays = opts.windowDays ?? SWEEP_WINDOW_DAYS;
  const categoryIds = new Set(categories.map(c => c.id));
  const categoryById = new Map(categories.map(c => [c.id, c]));

  const suggestions = opts.sweepSuggestions ?? sweepTransferPairs(transactions, {
    windowDays,
    onlyUncategorised: true,
    categoryIds,
  }).suggestions;

  const swept = new Set<string>();
  for (const s of suggestions) {
    swept.add(s.outgoing.id);
    swept.add(s.incoming.id);
  }

  const byId = new Map(transactions.map(t => [t.id, t]));

  // Every row, by amount — the "is there an opposite ANYWHERE?" question is
  // asked of the whole history (linked, filed, archived and all), because a
  // row whose opposite is merely unavailable is not one-sided.
  const allByAmount = new Map<number, Transaction[]>();
  // Already-linked/typed transfers, keyed by account + day + amount, for the
  // duplicate-leg lookup.
  const takenByDayAmount = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (toDecimal(t.amount).isZero()) continue;
    const amountKey = pennies(t.amount);
    const list = allByAmount.get(amountKey);
    if (list) list.push(t);
    else allByAmount.set(amountKey, [t]);

    if (isTakenAsTransfer(t)) {
      const key = `${t.accountId}|${dayKeyOf(t.date)}|${amountKey}`;
      const taken = takenByDayAmount.get(key);
      if (taken) taken.push(t);
      else takenByDayAmount.set(key, [t]);
    }
  }

  const population = transactions.filter(t => {
    if (swept.has(t.id)) return false;
    if (t.isSplit || t.linkedTransferId || t.type === 'transfer') return false;
    if (t.archived === true) return false;
    if (toDecimal(t.amount).isZero()) return false;
    const hasRealCategory = Boolean(t.category) && categoryIds.has(t.category);
    return !hasRealCategory;
  });

  const findings: StrandedFinding[] = [];

  for (const row of population) {
    const finding =
      duplicateFindingFor(row, takenByDayAmount) ??
      claimedTwinFindingFor(row, allByAmount, byId, windowDays) ??
      categorisedTwinFindingFor(row, allByAmount, categoryById, windowDays) ??
      oneSidedFindingFor(row, allByAmount, windowDays);
    if (finding) findings.push(finding);
  }

  // Deterministic order: oldest first, so a re-run lists identically.
  findings.sort(
    (a, b) => timeOf(a.row.date) - timeOf(b.row.date) || a.row.id.localeCompare(b.row.id)
  );

  return { findings, scanned: population.length };
}

/**
 * 1. DUPLICATE SUSPECT — the same row twice in one account (a bank feed and a
 * Money import both carrying it), where the other copy is already the transfer.
 * Same account, same day, same amount INCLUDING SIGN, near-identical wording.
 */
function duplicateFindingFor(
  row: Transaction,
  takenByDayAmount: Map<string, Transaction[]>
): DuplicateFinding | null {
  if (!isActionable(row)) return null;

  const key = `${row.accountId}|${dayKeyOf(row.date)}|${pennies(row.amount)}`;
  const candidates = (takenByDayAmount.get(key) ?? [])
    .filter(t => t.id !== row.id)
    .map(t => ({ transaction: t, descriptionScore: calculateStringSimilarity(row.description, t.description) }))
    .filter(c => c.descriptionScore >= DUPLICATE_DESCRIPTION_SIMILARITY)
    .sort((a, b) => b.descriptionScore - a.descriptionScore || a.transaction.id.localeCompare(b.transaction.id));

  const best = candidates[0];
  if (!best) return null;
  return { kind: 'duplicate', row, duplicateOf: best.transaction, descriptionScore: best.descriptionScore };
}

/**
 * 2. CLAIMED TWIN — the exact opposite is already linked to something else, and
 * this row is a STRICTLY better match than that current partner: closer in
 * days, or (dead heat) transfer-shaped where the current partner is not.
 * "Strictly" is the whole point: an equal match is not evidence of a mistake.
 */
function claimedTwinFindingFor(
  row: Transaction,
  allByAmount: Map<number, Transaction[]>,
  byId: Map<string, Transaction>,
  windowDays: number
): ClaimedTwinFinding | null {
  if (!isActionable(row)) return null;

  const candidates: ClaimedTwinFinding[] = [];
  for (const counterpart of allByAmount.get(-pennies(row.amount)) ?? []) {
    if (counterpart.id === row.id) continue;
    if (counterpart.accountId === row.accountId) continue;
    if (!isTakenAsTransfer(counterpart)) continue;
    if (!isActionable(counterpart)) continue;

    const daysApart = daysBetween(row, counterpart);
    if (daysApart > windowDays) continue;

    // The partner must be a real, resolvable row: an unlinked typed-transfer
    // has nobody to strand, and its re-pairing is not this finding's business.
    const currentPartner = counterpart.linkedTransferId
      ? byId.get(counterpart.linkedTransferId)
      : undefined;
    if (!currentPartner || currentPartner.id === row.id) continue;
    if (!isActionable(currentPartner)) continue;

    const partnerDaysApart = daysBetween(counterpart, currentPartner);
    const wonOnDescription =
      daysApart === partnerDaysApart &&
      isTransferShaped(row.description) &&
      !isTransferShaped(currentPartner.description);
    if (daysApart >= partnerDaysApart && !wonOnDescription) continue;

    candidates.push({
      kind: 'claimed',
      row,
      counterpart,
      currentPartner,
      daysApart,
      partnerDaysApart,
      descriptionScore: calculateStringSimilarity(row.description, counterpart.description),
      wonOnDescription,
    });
  }

  candidates.sort(
    (a, b) =>
      a.daysApart - b.daysApart ||
      b.descriptionScore - a.descriptionScore ||
      a.counterpart.id.localeCompare(b.counterpart.id)
  );
  return candidates[0] ?? null;
}

/**
 * 3. CATEGORISED TWIN — the exact opposite is free (unlinked, not a transfer)
 * but carries a real category. That is EITHER a mis-filed transfer leg OR two
 * unrelated rows that happen to share an amount, and nothing here can tell
 * which; the finding exists so the user can look, and the UI must say so.
 */
function categorisedTwinFindingFor(
  row: Transaction,
  allByAmount: Map<number, Transaction[]>,
  categoryById: Map<string, Category>,
  windowDays: number
): CategorisedTwinFinding | null {
  if (!isActionable(row)) return null;

  const candidates: CategorisedTwinFinding[] = [];
  for (const counterpart of allByAmount.get(-pennies(row.amount)) ?? []) {
    if (counterpart.id === row.id) continue;
    if (counterpart.accountId === row.accountId) continue;
    if (isTakenAsTransfer(counterpart)) continue;
    if (!isActionable(counterpart)) continue;

    const category = counterpart.category ? categoryById.get(counterpart.category) : undefined;
    // A transfer category or an importer's unassigned bucket is not a filing
    // the user made, so neither counts as "somebody categorised this".
    if (!category || category.isTransferCategory === true || category.isUnassignedBucket === true) continue;

    const daysApart = daysBetween(row, counterpart);
    if (daysApart > windowDays) continue;

    candidates.push({
      kind: 'categorised',
      row,
      counterpart,
      counterpartCategoryName: category.name,
      daysApart,
      descriptionScore: calculateStringSimilarity(row.description, counterpart.description),
    });
  }

  candidates.sort(
    (a, b) =>
      a.daysApart - b.daysApart ||
      b.descriptionScore - a.descriptionScore ||
      a.counterpart.id.localeCompare(b.counterpart.id)
  );
  return candidates[0] ?? null;
}

/**
 * 4. ONE-SIDED — nothing anywhere in the window is this row's opposite, and it
 * reads like a transfer. Offered the Account Adjustment filing, never a
 * transfer: a transfer with one side is exactly what this feature refuses to
 * create. Ordinary merchant rows are NOT offered it — a lone "Tesco" row is
 * just an uncategorised purchase, and belongs in the review band.
 */
function oneSidedFindingFor(
  row: Transaction,
  allByAmount: Map<number, Transaction[]>,
  windowDays: number
): OneSidedFinding | null {
  if (!isTransferShaped(row.description)) return null;

  const hasOpposite = (allByAmount.get(-pennies(row.amount)) ?? []).some(
    t => t.id !== row.id && daysBetween(row, t) <= windowDays
  );
  if (hasOpposite) return null;

  return { kind: 'one-sided', row };
}
