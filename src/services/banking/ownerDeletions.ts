/**
 * WHAT THE BANK OFFERS, SPLIT THREE WAYS — including the rows the owner threw
 * away on purpose.
 *
 * ── THE BUG THIS EXISTS FOR ─────────────────────────────────────────────────
 *
 * Reported live, 28 August 2026. The owner deleted a £8,321.54 "PAYMENT
 * RECEIVED" from his British Airways card, because that money was already in
 * the ledger as a transfer from his current account. The next sync brought it
 * straight back and the card was credited twice.
 *
 * Nothing had gone wrong with the matching. The dedup asks "which of these
 * external ids do I already have?" and answers by looking at rows that EXIST.
 * Deleting a fed row removes the only evidence its id ever arrived, so the id
 * reads as new, so it is inserted. A delete did not mean "do not bring this
 * back"; it meant "forget you saw this", which is a guarantee of return.
 *
 * The fix is a tombstone written by a database trigger (migration
 * 20260828140000), and this is the reading half of it.
 *
 * ── WHY THE SPLIT IS A FUNCTION AND NOT THREE FILTERS ───────────────────────
 *
 * Because the COUNTS are a claim. The sync tells the owner how many rows the
 * bank offered, how many were stored, and how many were skipped and why — and
 * those numbers have to add up, or the report is worse than no report. Three
 * inline filters can each be right while the arithmetic between them drifts;
 * one function that returns the whole partition cannot, and its test pins the
 * total rather than the parts.
 *
 * Deliberately NOT decided here: a deleted row is never offered again, with no
 * way back except lifting the tombstone. That is the behaviour the owner
 * asked for by deleting the row. A "restore this" control is a later question,
 * and it will delete a tombstone row rather than change anything in here.
 */

export interface OfferedRow {
  external_transaction_id: string;
}

export interface OfferedRowPartition<T extends OfferedRow> {
  /** Already in the ledger under this id — the ordinary duplicate. */
  alreadyPresent: T[];
  /** Deleted by the owner. Not imported, and not a duplicate either. */
  deletedByOwner: T[];
  /** Genuinely unseen. Still faces id-churn and transfer-adoption before insert. */
  unseen: T[];
}

/**
 * Split the rows a provider offered against what the ledger knows about them.
 *
 * A row that is BOTH present and tombstoned counts as present: it exists right
 * now, so the honest word for it is duplicate. (That pair happens when a row
 * was deleted, re-imported before this shipped, and is now sitting there
 * again — the tombstone is stale and the row in front of us is the truth.)
 */
export function partitionOfferedRows<T extends OfferedRow>(
  offered: readonly T[],
  existingIds: ReadonlySet<string>,
  deletedIds: ReadonlySet<string>
): OfferedRowPartition<T> {
  const alreadyPresent: T[] = [];
  const deletedByOwner: T[] = [];
  const unseen: T[] = [];

  for (const row of offered) {
    if (existingIds.has(row.external_transaction_id)) {
      alreadyPresent.push(row);
    } else if (deletedIds.has(row.external_transaction_id)) {
      deletedByOwner.push(row);
    } else {
      unseen.push(row);
    }
  }

  return { alreadyPresent, deletedByOwner, unseen };
}
