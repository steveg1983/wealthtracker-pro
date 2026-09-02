import { toDecimal } from './decimal';
import { calculateStringSimilarity } from './duplicateScan';
import {
  sweepTransferPairs,
  unmatchedSplitLegs,
  SWEEP_WINDOW_DAYS,
  type SplitLegSuggestion,
  type TransferPairSuggestion,
} from './transferSweep';
import {
  accountCurrencyIndex,
  compareCrossCurrencyCandidates,
  crossCurrencyCandidate,
  hasMultipleCurrencies,
  type AccountCurrencyIndex,
  type CrossCurrencyRateLookup,
} from './crossCurrencyMatch';
import type { CrossCurrency } from './crossCurrencyTransfer';
import type { Account, Category, Transaction, TransactionSplit } from '../types';
import { compareText } from './localeFormat';

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
  /**
   * Set when the twin is in an account counting in ANOTHER currency, oriented
   * row → counterpart. The two figures will not match and must not be expected
   * to; the UI shows both currencies so the user is judging a conversion rather
   * than an arithmetic error.
   */
  crossCurrency?: CrossCurrency;
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
  /**
   * The accounts, so a twin in another currency can be recognised as one.
   * Without them nothing here changes: every classifier keeps asking its
   * exact-amount question and gets its old answer.
   */
  accounts?: readonly Account[];
  /** A quote used to RANK cross-currency twins. Never to exclude one. */
  rateLookup?: CrossCurrencyRateLookup;
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
    // Threaded through so a row the CROSS-CURRENCY pass paired counts as swept
    // and never turns up here as stranded. A caller that passes its own
    // `sweepSuggestions` has already made that choice for itself.
    ...(opts.accounts ? { accounts: opts.accounts } : {}),
    ...(opts.rateLookup ? { rateLookup: opts.rateLookup } : {}),
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

  // Built only for a book that actually holds more than one currency, and
  // `null` otherwise — which is the state every existing ledger is in, and the
  // state in which every classifier below behaves exactly as it did.
  const crossIndex = buildCrossTwinIndex(transactions, opts);

  const findings: StrandedFinding[] = [];

  for (const row of population) {
    const finding =
      duplicateFindingFor(row, takenByDayAmount) ??
      claimedTwinFindingFor(row, allByAmount, byId, windowDays) ??
      categorisedTwinFindingFor(row, allByAmount, categoryById, windowDays, crossIndex) ??
      oneSidedFindingFor(row, allByAmount, windowDays);
    if (finding) findings.push(finding);
  }

  // Deterministic order: oldest first, so a re-run lists identically.
  findings.sort(
    (a, b) => timeOf(a.row.date) - timeOf(b.row.date) || compareText(a.row.id, b.row.id)
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
    .sort((a, b) => b.descriptionScore - a.descriptionScore || compareText(a.transaction.id, b.transaction.id));

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
      compareText(a.counterpart.id, b.counterpart.id)
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
  windowDays: number,
  crossIndex: CrossTwinIndex | null
): CategorisedTwinFinding | null {
  if (!isActionable(row)) return null;

  /** The shared eligibility of a twin, whatever currency it counts in. */
  const filedCategoryOf = (counterpart: Transaction): Category | null => {
    if (counterpart.id === row.id) return null;
    if (counterpart.accountId === row.accountId) return null;
    if (isTakenAsTransfer(counterpart)) return null;
    if (!isActionable(counterpart)) return null;

    const category = counterpart.category ? categoryById.get(counterpart.category) : undefined;
    // A transfer category or an importer's unassigned bucket is not a filing
    // the user made, so neither counts as "somebody categorised this".
    if (!category || category.isTransferCategory === true || category.isUnassignedBucket === true) {
      return null;
    }
    return category;
  };

  const candidates: CategorisedTwinFinding[] = [];
  for (const counterpart of allByAmount.get(-pennies(row.amount)) ?? []) {
    const category = filedCategoryOf(counterpart);
    if (!category) continue;

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
      compareText(a.counterpart.id, b.counterpart.id)
  );
  if (candidates[0]) return candidates[0];

  /**
   * ── AND ONLY THEN, ACROSS A CURRENCY BOUNDARY ─────────────────────────────
   *
   * Reached exclusively when no exact twin exists at all, which is what keeps
   * every same-currency answer above identical to the character: this branch
   * cannot run on a row that had one.
   *
   * The restraint is also what makes the offer usable. A cross-currency twin is
   * matched on SIGN alone — no magnitude test is permitted, because the ratio
   * between the magnitudes is the achieved rate — so on a busy fortnight a row
   * could otherwise be "twinned" with a dozen unrelated foreign rows. Requiring
   * that nothing exact exists first means the question is only ever asked where
   * it is the last remaining explanation.
   *
   * The finding's own framing carries the rest: it says the twin is EITHER a
   * mis-filed transfer leg OR a coincidence, and that nothing here can tell
   * which. That was already the honest sentence for two same-amount rows; it is
   * the same sentence, with the amounts no longer expected to match.
   */
  return crossIndex ? crossCurrencyTwinFor(row, filedCategoryOf, windowDays, crossIndex) : null;
}

/**
 * Free, categorised rows bucketed by calendar day and sign, so a cross-currency
 * twin can be looked for without an amount to key on.
 *
 * The same index the sweep's own cross-currency pass builds and for the same
 * reason: across a boundary the amount is not a lookup key, and the date is.
 */
interface CrossTwinIndex {
  currencies: AccountCurrencyIndex;
  positives: Map<number, Transaction[]>;
  negatives: Map<number, Transaction[]>;
  rateLookup?: CrossCurrencyRateLookup;
}

function buildCrossTwinIndex(
  transactions: Transaction[],
  opts: StrandedSweepOptions
): CrossTwinIndex | null {
  if (!opts.accounts) return null;
  const currencies = accountCurrencyIndex(opts.accounts);
  // A single-currency book can produce no cross-currency twin, so it pays for
  // no index at all.
  if (!hasMultipleCurrencies(currencies)) return null;

  const positives = new Map<number, Transaction[]>();
  const negatives = new Map<number, Transaction[]>();
  for (const t of transactions) {
    if (toDecimal(t.amount).isZero()) continue;
    if (!currencies.has(t.accountId)) continue;
    const bucket = toDecimal(t.amount).isNegative() ? negatives : positives;
    const day = dayNumberOf(t.date);
    const list = bucket.get(day);
    if (list) list.push(t);
    else bucket.set(day, [t]);
  }

  return {
    currencies,
    positives,
    negatives,
    ...(opts.rateLookup ? { rateLookup: opts.rateLookup } : {}),
  };
}

const dayNumberOf = (date: Date | string): number => Math.floor(timeOf(date) / DAY_MS);

/** The best cross-currency twin for a row, or null. Ranked date-first. */
function crossCurrencyTwinFor(
  row: Transaction,
  filedCategoryOf: (counterpart: Transaction) => Category | null,
  windowDays: number,
  crossIndex: CrossTwinIndex
): CategorisedTwinFinding | null {
  const bucket = toDecimal(row.amount).isNegative() ? crossIndex.positives : crossIndex.negatives;
  const span = Math.ceil(windowDays);
  const day = dayNumberOf(row.date);

  const candidates: Array<CategorisedTwinFinding & { rateDivergence?: number }> = [];
  for (let d = day - span; d <= day + span; d += 1) {
    for (const counterpart of bucket.get(d) ?? []) {
      const category = filedCategoryOf(counterpart);
      if (!category) continue;

      const daysApart = daysBetween(row, counterpart);
      if (daysApart > windowDays) continue;

      const match = crossCurrencyCandidate(row, counterpart, crossIndex.currencies, crossIndex.rateLookup);
      if (!match) continue;

      candidates.push({
        kind: 'categorised',
        row,
        counterpart,
        counterpartCategoryName: category.name,
        daysApart,
        descriptionScore: calculateStringSimilarity(row.description, counterpart.description),
        crossCurrency: match.pair,
        ...(match.rateDivergence === undefined ? {} : { rateDivergence: match.rateDivergence }),
      });
    }
  }

  candidates.sort(
    (a, b) =>
      compareCrossCurrencyCandidates(a, b) || compareText(a.counterpart.id, b.counterpart.id)
  );

  const best = candidates[0];
  if (!best) return null;
  // `rateDivergence` ranked this list and has no meaning to a reader of the
  // finding — a market's opinion is not evidence the UI should repeat.
  const { rateDivergence: _ranked, ...finding } = best;
  return finding;
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

/**
 * ── UNMATCHED SPLIT LEGS: the one-sided family, for a LINE ───────────────────
 *
 * A split line carrying a transfer target with no counterpart says "£30,000 of
 * this went to the loan account" while the loan account's register shows
 * nothing. That is a real inconsistency and the user should be told.
 *
 * It is DELIBERATELY not a member of StrandedFinding, and it carries NO
 * ACTION, because there is no honest one:
 *
 *  - Creating the missing row would invent money. The line may be unmatched
 *    because the counterpart was deleted, because the real row is sitting just
 *    outside the window, or because the line was mis-declared — and nothing
 *    here can tell which. set_transaction_splits_with_legs refuses to mint a
 *    counterpart for an already-targeted line for exactly this reason.
 *  - Filing it as Account Adjustment (the answer for a one-sided ROW) means
 *    editing the split, which rewrites what the user said the money was for,
 *    from a list that cannot show them the rest of the split.
 *
 * So: detect and explain, and let the user open the transaction. Every finding
 * therefore says as precisely as the data allows WHY no match was offered —
 * including when a row that would have matched exists but is unavailable,
 * which is the difference between "your loan account is missing this" and
 * "the row is there, it just isn't free".
 */

interface UnmatchedLegBase {
  kind: 'unmatched-leg';
  /** The line that declares a transfer with nothing on the other side. */
  split: TransactionSplit;
  /** The split parent — the line's date, payee and account. */
  parent: Transaction;
  /** The account the line names. */
  target: string;
}

/** Nothing anywhere in that account, in the window, is the line's opposite. */
export interface LegWithNoOpposite extends UnmatchedLegBase {
  reason: 'nothing-matches';
}

/** The opposite is there, but something makes it unpairable. */
export interface LegWithBlockedOpposite extends UnmatchedLegBase {
  /**
   * 'linked' — already half of a transfer; 'split' — a split parent, which
   * cannot become a transfer; 'archived' — out of the live register; 'taken' —
   * free, but already offered to another line or pair in this same sweep.
   */
  reason: 'linked' | 'split' | 'archived' | 'taken';
  blocker: Transaction;
}

/** The opposite is free, but somebody filed it — the same "or a coincidence?" question. */
export interface LegWithFiledOpposite extends UnmatchedLegBase {
  reason: 'filed';
  blocker: Transaction;
  blockerCategoryName: string;
}

export type UnmatchedSplitLegFinding =
  | LegWithNoOpposite
  | LegWithBlockedOpposite
  | LegWithFiledOpposite;

export interface UnmatchedLegSweepResult {
  findings: UnmatchedSplitLegFinding[];
  /** Unmatched legs considered (those the sweep could not match). */
  scanned: number;
}

export interface UnmatchedLegSweepOptions {
  windowDays?: number;
  /**
   * The sweep's output, when the caller already has it. BOTH are needed or
   * neither: a leg the sweep matched is not stranded, and a row the sweep is
   * offering elsewhere is not missing — it is taken.
   */
  sweepSuggestions?: TransferPairSuggestion[];
  legSuggestions?: SplitLegSuggestion[];
}

export function findUnmatchedSplitLegs(
  transactions: Transaction[],
  splits: TransactionSplit[],
  categories: Category[],
  opts: UnmatchedLegSweepOptions = {}
): UnmatchedLegSweepResult {
  if (splits.length === 0) return { findings: [], scanned: 0 };

  const windowDays = opts.windowDays ?? SWEEP_WINDOW_DAYS;
  const categoryIds = new Set(categories.map(c => c.id));
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const byId = new Map(transactions.map(t => [t.id, t]));

  const swept = opts.sweepSuggestions && opts.legSuggestions
    ? { suggestions: opts.sweepSuggestions, legSuggestions: opts.legSuggestions }
    : sweepTransferPairs(transactions, { windowDays, onlyUncategorised: true, categoryIds, splits });

  const matched = new Set(swept.legSuggestions.map(s => s.split.id));
  const taken = new Set<string>();
  for (const s of swept.suggestions) {
    taken.add(s.outgoing.id);
    taken.add(s.incoming.id);
  }
  for (const s of swept.legSuggestions) taken.add(s.candidate.id);

  const legs = unmatchedSplitLegs(splits, byId).filter(leg => !matched.has(leg.split.id));

  // Every row, by account + amount. The "is there anything over there at all?"
  // question is asked of the WHOLE history — linked, filed, archived and all —
  // exactly as the one-sided classifier asks it of a row.
  const byAccountAmount = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (toDecimal(t.amount).isZero()) continue;
    const key = `${t.accountId}|${pennies(t.amount)}`;
    const list = byAccountAmount.get(key);
    if (list) list.push(t);
    else byAccountAmount.set(key, [t]);
  }

  const findings: UnmatchedSplitLegFinding[] = [];
  for (const leg of legs) {
    const base = { kind: 'unmatched-leg' as const, split: leg.split, parent: leg.parent, target: leg.target };
    const opposites = (byAccountAmount.get(`${leg.target}|${-pennies(leg.split.amount)}`) ?? [])
      .map(t => ({ transaction: t, daysApart: Math.abs(timeOf(t.date) - leg.time) / DAY_MS }))
      .filter(c => c.daysApart <= windowDays)
      .sort((a, b) => a.daysApart - b.daysApart || compareText(a.transaction.id, b.transaction.id));

    const blocker = opposites[0]?.transaction;
    if (!blocker) {
      findings.push({ ...base, reason: 'nothing-matches' });
      continue;
    }

    if (isTakenAsTransfer(blocker)) {
      findings.push({ ...base, reason: 'linked', blocker });
    } else if (blocker.isSplit) {
      findings.push({ ...base, reason: 'split', blocker });
    } else if (blocker.archived === true) {
      findings.push({ ...base, reason: 'archived', blocker });
    } else if (blocker.category && categoryIds.has(blocker.category)) {
      // The sweep's own definition of "filed", so a finding can never
      // contradict what the sweep did with the row.
      findings.push({
        ...base,
        reason: 'filed',
        blocker,
        blockerCategoryName: categoryById.get(blocker.category)?.name ?? blocker.category,
      });
    } else if (taken.has(blocker.id)) {
      findings.push({ ...base, reason: 'taken', blocker });
    }
    // A free, unclaimed row is one the sweep would have offered. If one turns
    // up here the data moved under us mid-pass, and saying nothing is better
    // than saying something that is not true.
  }

  return { findings, scanned: legs.length };
}
