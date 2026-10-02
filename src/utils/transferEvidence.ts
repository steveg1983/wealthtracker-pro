/**
 * Transfer evidence — "has this wording, in this account, always been a transfer?"
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The categoriser never learns transfers, on purpose (see its header): a
 * suggested "To/From Savings" written as a plain category is half a transfer
 * with no other side. But the exclusion had a perverse edge. On a swept
 * account every nightly "Two Way Sweep from account …" is a linked transfer —
 * hundreds of them — and the only rows with that wording the model was
 * ALLOWED to learn from were the three the user had once filed as "Account
 * Adjustment" to tidy a stranded pair. So three rows outvoted two hundred and
 * fifty-eight, and every new sweep arrived suggested as an adjustment (the
 * owner, 2 Oct 2026: "there is never a suggestion of a transfer, yet the
 * overwhelming amount of transactions with the same description… have been
 * transfers").
 *
 * This module is the other half of that rule. It does not write a category
 * and it does not create a counterpart. It answers one question from the
 * ledger's own history — in THIS account, has this wording overwhelmingly
 * moved money to ONE other account? — and the two callers act on the answer
 * in the only safe ways there are:
 *
 *   * the categoriser says NOTHING for such a row rather than offering the
 *     minority category, so the row arrives uncategorised instead of wrong;
 *   * the row editor opens with the Transfer toggle on and that account in
 *     the box, marked as a suggestion, so a save runs the match-or-create
 *     question that writes a real pair — the same question a hand-picked
 *     account would run. A proposal that costs one glance, never a row.
 *
 * ── WHAT COUNTS AS EVIDENCE ─────────────────────────────────────────────────
 * The key is the row's ACCOUNT plus its wording, normalised just enough to
 * forgive case, punctuation and spacing — a "very near match", not a payee
 * key. Digits are KEPT: "sweep from account 00001234" names the other side,
 * and the payee normaliser that strips them would merge sweeps between
 * different pairs. Keyed by account because the same sentence in two accounts
 * is two different movements (the Current's sweep goes to the Reserve; the
 * Reserve's goes back), and a tally across both would see no majority at all.
 *
 * For each key the history is read three ways:
 *   * a TRANSFER to a resolvable account counts for that target — the row's
 *     own `transferAccountId`, or the account its To/From category names;
 *   * a row FILED under a confirmed category, or split into lines, counts
 *     against ("this wording was something else at least once");
 *   * everything else — unfiled rows, and the app's own unconfirmed guesses —
 *     counts for nothing. The categoriser's mistakes must not be allowed to
 *     vote on whether the categoriser was right.
 *
 * "Overwhelming" is a minimum of three transfers to the same account and at
 * least four in five of the filed rows agreeing. Three, because two sweeps
 * are a coincidence and the bar for proposing a movement between accounts
 * should be higher than the bar for proposing Groceries. Four in five, so one
 * tidy-up filing among a dozen sweeps does not silence the proposal, while a
 * wording that is genuinely split between a transfer and a purchase stays
 * the user's call with no thumb on the scale.
 */

import type { Category, Transaction } from '../types';
import { isCategoryConfirmed } from './categoryProvenance';
import { transferTargetAccountFor } from './transferCoherence';

/** Fewer transfers than this to one account is a coincidence, not a habit. */
export const TRANSFER_EVIDENCE_MIN_TRANSFERS = 3;
/** The share of filed rows that must agree before the proposal is made. */
export const TRANSFER_EVIDENCE_MIN_SHARE = 0.8;

/** Enough of a row to be looked up, or to be counted. */
export type TransferEvidenceRow = Pick<
  Transaction,
  'accountId' | 'description' | 'type' | 'category' | 'categoryConfirmed' | 'isSplit' | 'transferAccountId'
>;

/** What the history says about one wording in one account. */
export interface TransferEvidence {
  /** The account the money has overwhelmingly moved to. */
  targetAccountId: string;
  /** Rows with this wording in this account that were transfers to it. */
  transfers: number;
  /** Rows with this wording in this account filed as anything else. */
  otherwise: number;
}

/**
 * The wording, forgiven its case, punctuation and spacing. Digits survive —
 * see the header for why — and an all-punctuation description collapses to
 * an empty key, which never matches anything.
 */
export function transferEvidenceWording(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function keyOf(accountId: string, description: string): string | null {
  const wording = transferEvidenceWording(description);
  if (!accountId || wording === '') return null;
  return `${accountId}\u0000${wording}`;
}

interface Tally {
  byTarget: Map<string, number>;
  otherwise: number;
}

/**
 * Which side of the ledger a historical row speaks for: the account it moved
 * money to, 'otherwise' when it was deliberately filed as something else, or
 * null when it says nothing either way.
 */
function voteOf(row: TransferEvidenceRow, categories: readonly Category[]): string | 'otherwise' | null {
  const target = row.transferAccountId || transferTargetAccountFor(categories, row.category);
  if (target) return target === row.accountId ? null : target;
  // A transfer whose target cannot be named (a legacy sentinel) is still a
  // transfer: it is not evidence of a category, but it cannot be proposed as
  // an account either, so it stays silent.
  if (row.type === 'transfer') return null;
  if (row.isSplit === true) return 'otherwise';
  return isCategoryConfirmed(row) ? 'otherwise' : null;
}

function countVote(tally: Tally, vote: string | 'otherwise'): void {
  if (vote === 'otherwise') {
    tally.otherwise += 1;
    return;
  }
  tally.byTarget.set(vote, (tally.byTarget.get(vote) ?? 0) + 1);
}

function verdictOf(tally: Tally | undefined): TransferEvidence | null {
  if (!tally || tally.byTarget.size === 0) return null;
  let targetAccountId = '';
  let transfers = 0;
  let allTransfers = 0;
  for (const [target, count] of tally.byTarget) {
    allTransfers += count;
    // Ties broken by id so two runs over the same ledger propose the same
    // account; a proposal that changes between renders is not a proposal.
    if (count > transfers || (count === transfers && target < targetAccountId)) {
      targetAccountId = target;
      transfers = count;
    }
  }
  // Transfers to OTHER accounts count against the winner exactly as a
  // category does: the question is whether ONE account is the habit.
  const otherwise = tally.otherwise + (allTransfers - transfers);
  if (transfers < TRANSFER_EVIDENCE_MIN_TRANSFERS) return null;
  if (transfers / (transfers + otherwise) < TRANSFER_EVIDENCE_MIN_SHARE) return null;
  return { targetAccountId, transfers, otherwise };
}

/** Is this a row the history can speak for at all? */
function canAsk(row: TransferEvidenceRow): boolean {
  // A row that is already a transfer, already split, or already filed under a
  // category the user vouched for has been answered by the user; the history
  // is only consulted for the blank and the guessed.
  if (row.type === 'transfer' || row.isSplit === true) return false;
  return !isCategoryConfirmed(row);
}

/** Every wording in every account, tallied once, for the importers. */
export interface TransferEvidenceIndex {
  /** The proposal for this row, or null when the history does not make one. */
  lookup(row: TransferEvidenceRow): TransferEvidence | null;
}

/**
 * Tally the whole history once. An import asks the question for every row in
 * the file, so the pass over the ledger is paid once rather than per row.
 */
export function buildTransferEvidenceIndex(
  history: readonly TransferEvidenceRow[],
  categories: readonly Category[]
): TransferEvidenceIndex {
  const tallies = new Map<string, Tally>();
  for (const row of history) {
    const key = keyOf(row.accountId, row.description);
    if (key === null) continue;
    const vote = voteOf(row, categories);
    if (vote === null) continue;
    let tally = tallies.get(key);
    if (!tally) {
      tally = { byTarget: new Map(), otherwise: 0 };
      tallies.set(key, tally);
    }
    countVote(tally, vote);
  }
  return {
    lookup(row) {
      if (!canAsk(row)) return null;
      const key = keyOf(row.accountId, row.description);
      return key === null ? null : verdictOf(tallies.get(key));
    },
  };
}

/**
 * The same question for ONE row, answered by a single pass that looks only at
 * the row's own account. The row editor asks it each time a row is opened;
 * the ledger in memory refreshes every few seconds, and re-indexing all of it
 * on each refresh would be paying for every wording to answer for one.
 */
export function transferEvidenceFor(
  history: readonly TransferEvidenceRow[],
  categories: readonly Category[],
  row: TransferEvidenceRow
): TransferEvidence | null {
  if (!canAsk(row)) return null;
  const key = keyOf(row.accountId, row.description);
  if (key === null) return null;
  const tally: Tally = { byTarget: new Map(), otherwise: 0 };
  for (const other of history) {
    if (other.accountId !== row.accountId) continue;
    if (keyOf(other.accountId, other.description) !== key) continue;
    const vote = voteOf(other, categories);
    if (vote !== null) countVote(tally, vote);
  }
  return verdictOf(tally);
}
