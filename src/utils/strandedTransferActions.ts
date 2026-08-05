import { toDecimal } from './decimal';
import type { StrandedFinding, ClaimedTwinFinding } from './strandedTransfers';
import type { Transaction } from '../types';

/**
 * The four corrective actions behind a stranded-transfer finding.
 *
 * Written against injected operations rather than the app context so each
 * action is testable exactly as it runs.
 *
 * The rule every action serves: NEVER LEAVE A ONE-SIDED TRANSFER. Re-pairing a
 * counterpart necessarily unlinks whoever held it; that row is filed as
 * Account Adjustment by the SAME server-side transaction, so the correction
 * cannot create the very problem it is fixing — and cannot half-happen.
 */

export interface StrandedActionOperations {
  /** Join two rows into a linked transfer pair (atomic, server-side). */
  linkTransferPair: (idA: string, idB: string) => Promise<unknown>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<unknown>;
  /** Soft-archive (reversible, never a delete). */
  setTransactionArchived: (id: string, archived: boolean) => Promise<unknown>;
  /**
   * Break a wrong pairing, file the row it displaces under the given Account
   * Adjustment category, and link the right pair — one atomic operation.
   */
  repairClaimedTransfer: (
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ) => Promise<unknown>;
}

/** Income/expense by the money's direction — for a row that has stopped being a transfer. */
const typeBySign = (amount: number): 'income' | 'expense' =>
  toDecimal(amount).isNegative() ? 'expense' : 'income';

/**
 * File a row under Account Adjustment. The category is a revaluation, so the
 * row leaves income and expenses without pretending to be either — and the
 * transfer scaffolding (type, target account) goes with it, because a row
 * filed as an adjustment is no longer half of anything.
 */
export async function fileAsAccountAdjustment(
  row: Transaction,
  adjustmentCategoryId: string,
  ops: Pick<StrandedActionOperations, 'updateTransaction'>
): Promise<void> {
  await ops.updateTransaction(row.id, {
    category: adjustmentCategoryId,
    // Only a transfer-typed row is re-typed: an income/expense row already
    // records its direction correctly and nothing here should overrule it.
    ...(row.type === 'transfer' ? { type: typeBySign(row.amount) } : {}),
    // '' rather than undefined: the update RPC clears the column when the key
    // is present and empty, and ignores keys that are absent.
    ...(row.transferAccountId ? { transferAccountId: '' } : {}),
  });
}

/** Archive the spare copy of a duplicated leg. Reversible — the row is never deleted. */
export async function archiveDuplicateLeg(
  row: Transaction,
  ops: Pick<StrandedActionOperations, 'setTransactionArchived'>
): Promise<void> {
  await ops.setTransactionArchived(row.id, true);
}

/**
 * Accept a categorised twin as the real other side. One atomic call: the link
 * RPC re-types BOTH rows to 'transfer' and replaces their categories with the
 * facing accounts' To/From categories, so the twin's old category is cleared by
 * the same statement that links it. Nothing is stranded — both rows were free.
 */
export async function acceptCategorisedTwin(
  row: Transaction,
  counterpart: Transaction,
  ops: Pick<StrandedActionOperations, 'linkTransferPair'>
): Promise<void> {
  await ops.linkTransferPair(row.id, counterpart.id);
}

/**
 * Re-pair a counterpart onto the row that really matches it.
 *
 * ONE call. The repair_claimed_transfer RPC does all three changes in a single
 * database transaction:
 *
 *   1. break the wrong pairing (BOTH sides — a half-broken pair is exactly the
 *      one-sided transfer this feature refuses to create);
 *   2. file that displaced partner as Account Adjustment;
 *   3. link the counterpart to the stranded row.
 *
 * This used to be three round trips with a hand-written compensation, which is
 * a saga rather than a transaction: a closed tab between calls, or a
 * compensation that failed in its turn, left the ledger in a state no single
 * write intended. Now either the correction happens or nothing does, so there
 * is nothing to compensate and no half-applied state to explain. The RPC
 * validates every precondition against the rows as they are NOW and its errors
 * are surfaced verbatim, so a list built before somebody else changed the data
 * is refused rather than acted on.
 */
export async function repairClaimedTwin(
  finding: ClaimedTwinFinding,
  adjustmentCategoryId: string,
  ops: Pick<StrandedActionOperations, 'repairClaimedTransfer'>
): Promise<void> {
  const { row, counterpart, currentPartner } = finding;
  await ops.repairClaimedTransfer(row.id, counterpart.id, currentPartner.id, adjustmentCategoryId);
}

/** Every finding kind routed to its action — the single entry point the UI calls. */
export async function applyStrandedFinding(
  finding: StrandedFinding,
  adjustmentCategoryId: string | null,
  ops: StrandedActionOperations
): Promise<void> {
  switch (finding.kind) {
    case 'duplicate':
      return archiveDuplicateLeg(finding.row, ops);
    case 'categorised':
      return acceptCategorisedTwin(finding.row, finding.counterpart, ops);
    case 'claimed':
      if (!adjustmentCategoryId) {
        throw new Error(
          'Re-pairing needs an "Account Adjustment" category to file the row it frees up, and you have none.'
        );
      }
      return repairClaimedTwin(finding, adjustmentCategoryId, ops);
    case 'one-sided':
      if (!adjustmentCategoryId) {
        throw new Error('You have no "Account Adjustment" category to file this row under.');
      }
      return fileAsAccountAdjustment(finding.row, adjustmentCategoryId, ops);
  }
}
