import { findTransferCandidates, TRANSFER_MATCH_WINDOW_DAYS, type TransferCandidate } from './transferMatch';
import { crossedCurrencies } from './crossCurrencyTransfer';
import type { Account, Transaction } from '../types';
import { compareText } from './localeFormat';

/**
 * "This payee is a TRANSFER": what has to be decided before a whole merchant
 * can be converted in one press, and what still has to be asked one row at a
 * time.
 *
 * Observed live (owner, 31 Aug 2026): "Categorise by Payee does not allow to
 * 'transfer' — in my list is American Express, that is the payments from
 * Danielle's current account to pay her American Express credit card, but I
 * can't bulk transfer, only categorise for income or expense." Twenty-four
 * rows, one meaning, and the only route to it was opening twenty-four
 * transactions in the register.
 *
 * ─ WHY THIS IS ALLOWED TO BE A BULK ACTION AT ALL ──────────────────────────
 * utils/transferCoherence states the rule this appears to break: "there is no
 * BULK option: each transfer needs its target account resolved individually,
 * and a bulk filing that guessed would invent movements between accounts that
 * never happened." Both halves of that objection are answered here rather than
 * waived:
 *
 *   - The TARGET is not guessed. The user names one account for the payee, in
 *     a picker that cannot offer the accounts the payee's own rows sit in, so
 *     "Current Account → Current Account" is unofferable rather than refused.
 *   - The OTHER SIDE is not guessed either. Every row the target account might
 *     already hold is put to the user as a question — link it, or create a new
 *     one anyway — because the two answers are not interchangeable: linking
 *     moves no money and creating moves the target's balance. That is the one
 *     thing a sweep may never decide on someone's behalf, so it does not.
 *
 * What is bulk is the CLERICAL part: the rows with nothing plausible on the
 * other side. Those are the twenty of the twenty-four, and they are exactly
 * the rows the register would have made the user press "create the other side"
 * on, twenty times, with no information in front of them each time.
 *
 * ─ THE MATCH ───────────────────────────────────────────────────────────────
 * Deliberately not a second matcher: `findTransferCandidates` is the register's
 * own, so a row this screen offers to link is a row the register would have
 * offered, worded and ordered the same way (closest date first, description as
 * a tie-break only — the two banks never name one payment the same). Its
 * window is 4 days, and it stays 4 days here: a hand-dated payment and a bank's
 * posting date are the pair this exists to reconcile, and narrowing it for the
 * bulk screen would mean the same two rows matched in one place and not the
 * other.
 *
 * ─ MUTUAL EXCLUSION, THE importedRowAdoption CAUTION ───────────────────────
 * An existing row can be the other side of exactly ONE payment, so it is
 * offered exactly once: the first transaction (by date, then id) to reach it
 * claims it, and a second transaction that matched only that row falls through
 * to "create the other side" instead. Without the claim, two £250 card
 * payments a day apart would both be offered the same single row over there,
 * and answering "link" twice would either fail at the engine or silently point
 * two payments at one counterpart.
 *
 * Rows that some OTHER payee in the same press is itself about to convert are
 * never offered either. They are about to become transfers with their own
 * other sides; offering one as a counterpart would race the two decisions
 * against each other, and which won would depend on the order the screen
 * happened to list its payees in.
 *
 * ─ WHAT IS REFUSED, AND SAID OUT LOUD ──────────────────────────────────────
 * A refusal is a row, not a silence: the caller reports it in the summary with
 * its reason, because a transaction that quietly did not become a transfer is
 * indistinguishable from one the sweep forgot. Currency is the one that will
 * actually be met — creating the other side across a boundary needs the rate
 * that was really achieved, which is a question per transaction and therefore
 * the register's job, not this screen's.
 *
 * Everything here is pure. The writes live in the component, and they are the
 * register's own two service calls (`linkTransferPair`,
 * `createTransferCounterpart`) — this module only decides which of them each
 * row is owed, and which rows have to be asked about first.
 */

/** One payee row's instruction: these transactions, that account. */
export interface PayeeTransferBatch {
  /** The screen's own identity for the payee row — echoed back untouched. */
  key: string;
  /** The payee as it reads in the register, for the confirmation's wording. */
  displayName: string;
  transactions: readonly Transaction[];
  /** The account the user says the money moved to (or came from). */
  targetAccountId: string;
}

/**
 * Why a transaction cannot become a transfer to the account named.
 *
 * Each one is a real shape found in real data rather than a defensive
 * possibility, and each has a remedy the user can act on — see
 * PAYEE_TRANSFER_REFUSALS for the sentence that goes with it.
 */
export type PayeeTransferRefusalReason =
  | 'same-account'
  | 'cross-currency'
  | 'already-a-transfer'
  | 'split'
  | 'zero-amount';

/** One row on its way to becoming a transfer. */
export interface PayeeTransferConversion {
  batchKey: string;
  displayName: string;
  transaction: Transaction;
  targetAccountId: string;
}

/** A conversion that has to be put to the user first: link it, or create anyway. */
export interface PayeeTransferQuestion extends PayeeTransferConversion {
  /** The row already in the target account — the register's own best match. */
  candidate: TransferCandidate;
  /**
   * How many OTHER unclaimed rows over there matched as well.
   *
   * Shown, never hidden: "the closest in date" is a ranking, not a fact, and a
   * user answering "link these" is entitled to know the choice was between
   * three rows rather than one.
   */
  otherMatches: number;
}

export interface PayeeTransferRefusal extends PayeeTransferConversion {
  reason: PayeeTransferRefusalReason;
}

export interface PayeeTransferPlan {
  /** Nothing plausible on the other side: create it, no question asked. */
  createOutright: PayeeTransferConversion[];
  /** Something plausible IS on the other side: one question each, in order. */
  needsConfirmation: PayeeTransferQuestion[];
  /** Cannot be converted from here at all, each with the reason why. */
  refused: PayeeTransferRefusal[];
}

export interface PayeeTransferPlanOptions {
  /**
   * The accounts, for the currency test. Absent (or an account missing from
   * the list, as a closed one is) reads as "same currency", which keeps the
   * strict exact-amount matching in force — the conservative direction, and
   * the same reading `crossedCurrencyPair` takes.
   */
  accounts?: readonly Account[];
  /** Defaults to the register's own window. Overridable for tests. */
  windowDays?: number;
}

/** The refusal, in the user's terms: the consequence, then the remedy. */
export const PAYEE_TRANSFER_REFUSALS: Record<PayeeTransferRefusalReason, string> = {
  'same-account':
    'This row is already in that account, and money cannot move from an account to itself — pick the account on the other side of the payment.',
  'cross-currency':
    'That account counts in another currency, so the other side cannot be copied from this row — it needs the amount that actually arrived. Open the transaction in its register and make the transfer there, where you can confirm the rate.',
  'already-a-transfer':
    'This row is already a transfer, so it has its other side.',
  split:
    'This row is split into lines, and a split’s transfer lives in its lines — open it and make the line a transfer.',
  'zero-amount':
    'A zero-amount row moves nothing, so there is no other side to create.',
};

/**
 * Whether this row can become a transfer to the named account at all.
 *
 * Ordered most-specific first so the sentence the user reads is the one that
 * actually stops them: a split row in the same account is refused for being in
 * the same account, which is the thing they can fix in the picker in front of
 * them.
 */
function refusalFor(
  transaction: Transaction,
  targetAccountId: string,
  accounts: readonly Account[] | undefined
): PayeeTransferRefusalReason | null {
  if (transaction.accountId === targetAccountId) return 'same-account';
  if (transaction.type === 'transfer' || transaction.linkedTransferId) return 'already-a-transfer';
  if (transaction.isSplit) return 'split';
  if (transaction.amount === 0) return 'zero-amount';
  if (accounts && crossedCurrencies(accounts, transaction.accountId, targetAccountId)) {
    return 'cross-currency';
  }
  return null;
}

/** Oldest first, id as the tie-break, so one ledger always plans one way. */
function inLedgerOrder(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
    return byDate !== 0 ? byDate : compareText(a.id, b.id);
  });
}

/**
 * The whole press, decided in one pass over one snapshot of the ledger.
 *
 * ONE call for every payee row rather than one per payee, because the claim on
 * an existing counterpart has to be shared: two payees transferring into the
 * same account can otherwise be offered the same row twice. The snapshot is
 * read once, before anything is written, so a counterpart this press CREATES
 * can never come back round as a candidate for a later row of the same press.
 */
export function planPayeeTransfers(
  batches: readonly PayeeTransferBatch[],
  ledger: readonly Transaction[],
  options: PayeeTransferPlanOptions = {}
): PayeeTransferPlan {
  const { accounts, windowDays = TRANSFER_MATCH_WINDOW_DAYS } = options;

  const createOutright: PayeeTransferConversion[] = [];
  const needsConfirmation: PayeeTransferQuestion[] = [];
  const refused: PayeeTransferRefusal[] = [];

  // Every row this press is already spoken for — see the header. Built before
  // any matching so the exclusion holds in both directions, whichever payee
  // the screen happens to list first.
  const plannedIds = new Set<string>();
  for (const batch of batches) {
    for (const transaction of batch.transactions) plannedIds.add(transaction.id);
  }

  // The candidate pool per target account, filtered out of the ledger once.
  // findTransferCandidates walks whatever it is handed and keeps only the
  // target account's rows anyway; handing it the account instead of fifty
  // thousand transactions, once per row, is the same answer without the walk.
  const poolByAccount = new Map<string, Transaction[]>();
  const poolFor = (accountId: string): Transaction[] => {
    const cached = poolByAccount.get(accountId);
    if (cached) return cached;
    const pool = ledger.filter(t => t.accountId === accountId && !plannedIds.has(t.id));
    poolByAccount.set(accountId, pool);
    return pool;
  };

  /** Existing rows already offered as somebody's other side. One each. */
  const claimed = new Set<string>();

  for (const batch of batches) {
    for (const transaction of inLedgerOrder(batch.transactions)) {
      const conversion: PayeeTransferConversion = {
        batchKey: batch.key,
        displayName: batch.displayName,
        transaction,
        targetAccountId: batch.targetAccountId,
      };

      const reason = refusalFor(transaction, batch.targetAccountId, accounts);
      if (reason !== null) {
        refused.push({ ...conversion, reason });
        continue;
      }

      const candidates = findTransferCandidates(
        poolFor(batch.targetAccountId),
        transaction,
        batch.targetAccountId,
        windowDays,
        // Passed for correctness rather than for effect: a cross-currency pair
        // was refused above, so every pairing that reaches here shares a
        // currency and the strict exact-amount rule is the one that applies.
        { accounts }
      ).filter(candidate => !claimed.has(candidate.transaction.id));

      if (candidates.length === 0) {
        createOutright.push(conversion);
        continue;
      }

      claimed.add(candidates[0].transaction.id);
      needsConfirmation.push({
        ...conversion,
        candidate: candidates[0],
        otherMatches: candidates.length - 1,
      });
    }
  }

  return { createOutright, needsConfirmation, refused };
}
