/**
 * Categories Microsoft Money INVENTS, as opposed to ones a person created.
 *
 * When you delete an account in Money, the transfers that pointed at it survive
 * on the other side but their counterpart is gone with the account. Money does
 * not leave those orphaned legs uncategorised — it generates a category to hold
 * them, one per direction, sitting at the top level of each tree:
 *
 *     "Xfer to Deleted Account"     under Money's EXPENSE root
 *     "Xfer from Deleted Account"   under Money's INCOME root
 *
 * Both names are verbatim from Money, and both were present in the reference
 * .mny file this importer was built against (level 1, no children of their own,
 * transactions filed directly on them).
 *
 * WHAT IS MATCHED, AND WHY IT IS THIS NARROW: the whole normalised name, exactly
 * equal to one of those two strings — nothing else. It is deliberately NOT a
 * "name contains transfer/xfer" test. A person's own "Transfer to savings"
 * category and the app's generated "To/From <account>" categories are real,
 * meaningful filings; sweeping those into the adjustment bucket would take money
 * that genuinely was spent or earned out of the totals. Money's generated name
 * is fixed and specific, so the match can be too.
 *
 * WHY IT MATTERS: a transfer whose other side no longer exists is not spending
 * and not income — it is money that moved, which is exactly what this app calls
 * an adjustment (`isRevaluationCategory`, see utils/incomeExpense). Imported
 * with Money's own income/expense typing instead, these categories report as
 * earnings and spending that never happened.
 */

const DELETED_ACCOUNT_TRANSFER_NAMES: ReadonlySet<string> = new Set([
  'xfer to deleted account',
  'xfer from deleted account',
]);

/** Case- and whitespace-insensitive, so "Xfer  To  Deleted Account" matches too. */
const normalise = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * True when this is one of the categories Microsoft Money generates to hold the
 * transfers left behind by a deleted account.
 */
export function isDeletedAccountTransferCategory(name: string): boolean {
  return DELETED_ACCOUNT_TRANSFER_NAMES.has(normalise(name));
}
