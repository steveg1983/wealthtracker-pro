import type { Transaction } from '../types';

/**
 * Was this row BORN as the other half of its transfer, or is it a real
 * transaction that was matched to one?
 *
 * ─ WHY THE QUESTION MATTERS ────────────────────────────────────────────────
 * Re-pointing a transfer moves its counterpart into the new account. That is
 * exactly right when the counterpart is scaffolding the app put there itself
 * ("create the other side"), and exactly wrong when it is a row that came off a
 * bank statement: that row is evidence of something the bank actually did in
 * THAT account, and dragging it into another one puts two registers out by its
 * amount and leaves a reconciliation that can never be made to balance again.
 *
 * ─ WHAT ACTUALLY MARKS AN IMPORTED ROW, AND WHAT DOES NOT ──────────────────
 * The honest answer first: THERE IS NO PROVENANCE FIELD IN MEMORY. The columns
 * that state where a row came from — `import_source`, `import_source_id`,
 * `external_transaction_id`, `external_provider`, `connection_id` — are all
 * deliberately absent from the boot select (see BOOT_TRANSACTION_COLUMNS in
 * transactionService.ts, which cut the boot payload from ~46 MB to ~29 MB by
 * dropping them across 51,000 rows). Asking for them back to power one rare
 * dialog would put roughly a tenth of the transactions payload back on every
 * single boot, for every user, forever. `reconciledWith` — the field behind the
 * editor's "Linked to bank statement" tick — is not loaded either, and is not
 * written by the cloud updater at all (divergence D-7 on
 * DataPort.updateTransaction lists the sixteen fields it honours; that is not
 * one of them). So it can be read as no evidence whatsoever.
 *
 * What IS in memory is a proof of a different shape, and it is sound:
 *
 *   `updatedAt === createdAt` means the row has never been UPDATEd since it was
 *   inserted — `update_transactions_updated_at` is a BEFORE UPDATE trigger on
 *   every row of the table, so any write at all moves the two apart.
 *
 * A row that is linked AND has never been updated must therefore have been
 * INSERTED already linked. Only two writers do that, and both of them are the
 * app creating scaffolding: `create_transfer_counterpart` and the split-leg
 * counterpart insert inside `set_transaction_splits_with_legs`. Every path that
 * links a PRE-EXISTING row does it with an UPDATE and so fails the test:
 * `link_transfer_pair`, `repair_claimed_transfer`, the MS Money importer (which
 * inserts its rows unlinked and applies `transferLinks` afterwards) and the
 * backup restore (whose second pass patches the links once the rows are in).
 * The file and bank-feed importers never write a link at all.
 *
 * So the verdict is one-way and conservative BY CONSTRUCTION: it can prove
 * "the app made this", and it can never prove the opposite. Anything it cannot
 * prove is treated as a real row and the user is asked. Three further signals
 * are consulted on top — a row that was reconciled, that carries a statement
 * position, or that is still waiting to be reviewed after an import is
 * self-evidently the bank's and not ours — so that a future writer which
 * inserted a link alongside real provenance could not slip through the
 * timestamp test alone.
 *
 * The direction of the remaining error is the safe one. Asking unnecessarily
 * costs one click. Moving a statement row silently costs a register that
 * disagrees with a bank, discovered months later.
 */
export interface CounterpartOriginVerdict {
  /**
   * True ONLY when the row is provably scaffolding — created by the app as this
   * transfer's other half and untouched since. Safe to move without asking.
   */
  systemCreated: boolean;
  /**
   * Why it could not be proved, in the words the dialog uses. Empty when
   * `systemCreated` is true. Ordered strongest first, and the first entry is
   * the one worth printing when there is only room for one.
   */
  reasons: string[];
}

/**
 * The verdict for one counterpart. See the interface above for the whole
 * argument; this function is only the conjunction.
 */
export function describeCounterpartOrigin(
  counterpart: Pick<
    Transaction,
    'cleared' | 'statementSequence' | 'needsReview' | 'createdAt' | 'updatedAt'
  >
): CounterpartOriginVerdict {
  const reasons: string[] = [];

  if (counterpart.cleared === true) {
    reasons.push('it has been reconciled, so it has been checked against a real statement');
  }
  if (counterpart.statementSequence !== null && counterpart.statementSequence !== undefined) {
    reasons.push('it came in on a statement file, in the bank’s own order');
  }
  if (counterpart.needsReview === true) {
    reasons.push('it arrived on an import and nobody has been through it yet');
  }

  // The proof. Both timestamps have to be present to prove anything: the
  // browser/demo store does not stamp them, and a row from before they were
  // recorded has neither — in both cases the honest answer is "cannot tell".
  const created = toTime(counterpart.createdAt);
  const updated = toTime(counterpart.updatedAt);
  if (created === null || updated === null) {
    reasons.push('there is no record of when it was created, so it cannot be told apart from a real transaction');
  } else if (created !== updated) {
    reasons.push('it existed before it became half of this transfer — it was matched to it, not created for it');
  }

  return { systemCreated: reasons.length === 0, reasons };
}

/** Milliseconds, or null when the value is absent or not a usable date. */
function toTime(value: Date | string | undefined): number | null {
  if (value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}
