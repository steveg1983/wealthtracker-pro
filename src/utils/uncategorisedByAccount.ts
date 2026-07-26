import type { SplitExpandedTransaction } from './transactionSplits';

export interface UncategorisedAccountGroup {
  accountId: string;
  rows: SplitExpandedTransaction[];
}

/**
 * Groups unfiled transactions by the account they sit in, worst first.
 *
 * Ties are broken by account name rather than left to the order the rows
 * happened to arrive in: two accounts with the same number outstanding would
 * otherwise swap places between renders, and a list that reorders itself under
 * your thumb is how you tap the wrong account.
 */
export function groupUncategorisedByAccount(
  rows: SplitExpandedTransaction[],
  accountName: (accountId: string) => string
): UncategorisedAccountGroup[] {
  const groups = new Map<string, SplitExpandedTransaction[]>();

  for (const row of rows) {
    const existing = groups.get(row.accountId);
    if (existing) existing.push(row);
    else groups.set(row.accountId, [row]);
  }

  return Array.from(groups.entries())
    .map(([accountId, accountRows]) => ({ accountId, rows: accountRows }))
    .sort(
      (a, b) =>
        b.rows.length - a.rows.length ||
        accountName(a.accountId).localeCompare(accountName(b.accountId))
    );
}
