import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTransactionFilters } from '../useTransactionFilters';
import type { Account, Category, Transaction } from '../../types';

/**
 * The Transactions list orders its rows here, and prints a per-account running
 * balance beside them that it accumulates elsewhere (runningBalances on the
 * page). The two therefore have to agree about which of a day's transactions
 * came last — and a date-only compare left that to Array.prototype.sort's
 * stability, which is not an agreement, only a coincidence.
 *
 * Every figure and date here is invented; this repo is public.
 */
describe('useTransactionFilters — the display order', () => {
  const ACCOUNTS: Account[] = [
    {
      id: 'acc-1', name: 'Synthetic Current', type: 'current', balance: 0,
      currency: 'GBP', lastUpdated: new Date('2024-02-20'), openingBalance: 0,
    }
  ];
  const CATEGORIES: Category[] = [];

  const txn = (over: Partial<Transaction>): Transaction => ({
    id: 'x',
    date: new Date('2024-02-19'),
    amount: -10,
    description: 'Synthetic row',
    category: '',
    accountId: 'acc-1',
    type: 'expense',
    cleared: false,
    ...over
  });

  const FILTERS = {
    filterType: 'all' as const,
    filterAccountId: '',
    searchQuery: '',
    dateFrom: '',
    dateTo: ''
  };

  const orderedIds = (
    transactions: Transaction[],
    direction: 'asc' | 'desc'
  ): string[] => {
    const { result } = renderHook(() =>
      useTransactionFilters(transactions, ACCOUNTS, CATEGORIES, FILTERS, {
        field: 'date',
        direction
      })
    );
    return result.current.transactions.map(t => t.id);
  };

  const SAME_DAY_IN = txn({ id: 'in', type: 'income', amount: 450 });
  const SAME_DAY_OUT = txn({ id: 'out', type: 'expense', amount: -450 });
  const EARLIER = txn({ id: 'earlier', date: new Date('2024-02-05'), amount: -12.75 });

  it('reverses exactly under desc, so the newest row really is on top', () => {
    const list = [SAME_DAY_OUT, SAME_DAY_IN, EARLIER];

    expect(orderedIds(list, 'asc')).toEqual(['earlier', 'in', 'out']);
    // Not ['in', 'out', 'earlier'] — reversing only the day would leave the
    // same-day pair forwards, and the running balance beside them is the
    // balance AFTER each row, so the top one would be the day's first
    // transaction wearing the account's balance.
    expect(orderedIds(list, 'desc')).toEqual(['out', 'in', 'earlier']);
  });

  it('does not take its answer from the order it was handed', () => {
    const list = [SAME_DAY_OUT, SAME_DAY_IN, EARLIER];
    expect(orderedIds([...list].reverse(), 'desc')).toEqual(orderedIds(list, 'desc'));
  });
});
