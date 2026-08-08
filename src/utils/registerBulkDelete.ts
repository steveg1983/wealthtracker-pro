import { deleteBlockOf } from './duplicateSweep';
import { describeDeleteStranding } from './transferOtherSide';
import type { Account, Transaction } from '../types';

/**
 * What a bulk delete would actually do — worked out BEFORE anything is asked,
 * so the confirmation can say it row by row.
 *
 * The rule this module exists to enforce: a bulk delete may never be quieter
 * than the same deletes done one at a time. Selecting ten rows and pressing
 * Delete has to admit to everything ten separate confirmations would have
 * admitted to, and it has to refuse everything they would have refused.
 */
export interface BulkDeletePlan {
  /** The rows that will go, in the order the register lists them. */
  deleting: readonly Transaction[];
  /**
   * The ones among them that leave half a movement behind somewhere else,
   * each with the sentence the single-row confirmation would have shown —
   * naming the account that keeps the stranded half.
   */
  stranding: readonly { transaction: Transaction; message: string }[];
  /** The rows this refuses to touch, and why, named so nobody assumes they went. */
  excluded: readonly { transaction: Transaction; reason: string }[];
}

/**
 * Why a bulk delete leaves these two kinds of row alone.
 *
 * They are exactly the rows the duplicate sweep's delete gate refuses
 * (deleteBlockOf), minus the plain linked transfer — which a single delete
 * DOES allow, with a warning, and which is therefore allowed here with the
 * same warning.
 *
 * A split parent and a split-line counterpart are different in kind. What
 * survives a split delete is not a whole transaction anybody can go and tidy
 * up: it is one line inside somebody else's split, and the rest of that split
 * is unrelated spending that stays exactly where it is. That consequence
 * cannot be honestly summarised twelve rows at a time, so the answer is to not
 * do it in a batch — the full editor still deletes either of them, one at a
 * time, where the whole story is on screen.
 */
const EXCLUSION_REASONS: Record<'split-parent' | 'split-line-counterpart', string> = {
  'split-parent':
    'is split across several categories. Deleting it takes every one of its lines with it, and any of those lines may be one half of a transfer — open it and delete it on its own if that is what you mean.',
  'split-line-counterpart':
    'is the other half of a single LINE inside a split transaction elsewhere. Deleting it would leave that line pointing at nothing while the rest of the split stays put — open it and delete it on its own if that is what you mean.',
};

/**
 * Sort the chosen rows into "will go", "will go and strand something", and
 * "will not be touched, and here is why".
 *
 * @param chosen the selected rows, already in the register's display order
 * @param transactions every loaded transaction — the other halves live here
 * @param openAccounts the app context's accounts (OPEN ones only, which is
 *   what lets the stranding message say "the account it faces" rather than
 *   printing a name it does not have)
 */
export function planBulkDelete(
  chosen: readonly Transaction[],
  transactions: readonly Transaction[],
  openAccounts: readonly Account[]
): BulkDeletePlan {
  const deleting: Transaction[] = [];
  const stranding: { transaction: Transaction; message: string }[] = [];
  const excluded: { transaction: Transaction; reason: string }[] = [];

  for (const transaction of chosen) {
    const block = deleteBlockOf(transaction);
    if (block === 'split-parent' || block === 'split-line-counterpart') {
      excluded.push({ transaction, reason: EXCLUSION_REASONS[block] });
      continue;
    }

    deleting.push(transaction);

    // 'linked-transfer' is the one block a single delete overrides, so this
    // does too — and carries across the exact sentence it would have shown.
    const strandingHere = describeDeleteStranding(transaction, transactions, openAccounts);
    if (strandingHere) {
      stranding.push({ transaction, message: strandingHere.message });
    }
  }

  return { deleting, stranding, excluded };
}
