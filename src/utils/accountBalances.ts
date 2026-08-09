import { toDecimal } from './decimal';
// Types only — erased at build, so this costs no import edge and no bytes.
import type { AccountBalanceSnapshot } from '../services/port/dataPort';

/**
 * One account's balance as the store itself computed it.
 *
 * The shape belongs to the seam now (`AccountBalanceSnapshot`): the cloud
 * answers it with the account_balances() RPC, a local core would answer it from
 * its own rows, and this file must not care which. An alias rather than a copy,
 * so the two cannot drift.
 */
export type ServerAccountBalance = AccountBalanceSnapshot;

interface AccountLike {
  id: string;
  openingBalance?: number;
}

interface TransactionAmountLike {
  accountId: string;
  amount: number;
}

/**
 * Ledger balance per account: openingBalance + Σ transaction amounts.
 *
 * Single pass over transactions (Decimal — float sums drift on 50k-row
 * histories), then one lookup per account, so it stays O(accounts +
 * transactions) rather than the product of the two.
 *
 * The transaction set arrives in ~52 pages and takes seconds on a long
 * history; until the first page lands every ledger sum is just the opening
 * balance, so where the server has already answered with the same invariant
 * (initial_balance + Σ amount, summed in Postgres) its figures stand in and
 * the dashboard opens on real money instead of zeros. They are only ever a
 * stand-in: the client sum is the source of truth and wins back the moment
 * any transaction is present.
 */
export function computeAccountBalances(
  accounts: readonly AccountLike[],
  transactions: readonly TransactionAmountLike[],
  serverBalances?: ReadonlyMap<string, ServerAccountBalance>
): Map<string, number> {
  const txnTotals = new Map<string, ReturnType<typeof toDecimal>>();
  for (const t of transactions) {
    txnTotals.set(t.accountId, (txnTotals.get(t.accountId) ?? toDecimal(0)).plus(toDecimal(t.amount)));
  }

  const seedFromServer = transactions.length === 0 && (serverBalances?.size ?? 0) > 0;
  const balances = new Map<string, number>();
  for (const acc of accounts) {
    const server = seedFromServer ? serverBalances?.get(acc.id) : undefined;
    balances.set(
      acc.id,
      server
        ? server.balance
        : toDecimal(acc.openingBalance ?? 0).plus(txnTotals.get(acc.id) ?? toDecimal(0)).toNumber()
    );
  }
  return balances;
}
