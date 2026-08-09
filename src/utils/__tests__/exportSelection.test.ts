import { describe, it, expect } from 'vitest';
import { selectExportData, describeExportRange } from '../exportSelection';
import { exportTransactionsToCSV } from '../csvExport';
import { resolvePeriod } from '../../hooks/usePeriod';
import type { Account, Category, Transaction, TransactionSplit } from '../../types';

/**
 * The Export Data page asks exactly one question — "what goes in the file?" —
 * and this is where it is answered, for the preview panel and for every
 * format at once. Before, the panel counted the whole dataset while the file
 * was date-filtered, and Quick Export read raw transactions while the other
 * buttons expanded splits, so the same period exported different totals
 * depending on which button was pressed.
 */

const accounts: Account[] = [
  { id: 'acc-1', name: 'Everyday Account', type: 'current', balance: 100, currency: 'GBP', lastUpdated: new Date('2025-03-01') },
  { id: 'acc-2', name: 'Savings', type: 'savings', balance: 500, currency: 'GBP', lastUpdated: new Date('2025-03-01') }
];

const categories: Category[] = [
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'sub' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'cat-food' },
  { id: 'cat-fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'cat-food' }
];

const transaction = (overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'amount'>): Transaction => ({
  description: 'Payment',
  category: 'cat-groceries',
  accountId: 'acc-1',
  type: 'expense',
  ...overrides
});

const march = { from: new Date(2025, 2, 1), to: new Date(2025, 2, 31, 23, 59, 59, 999) };

describe('selectExportData', () => {
  it('keeps only the rows inside the period', () => {
    const selection = selectExportData({
      transactions: [
        transaction({ id: 'before', date: new Date(2025, 1, 28), amount: -1 }),
        transaction({ id: 'inside', date: new Date(2025, 2, 15), amount: -2 }),
        transaction({ id: 'after', date: new Date(2025, 3, 1), amount: -3 })
      ],
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: false,
      accountsScope: 'all'
    });

    expect(selection.transactions?.map(t => t.id)).toEqual(['inside']);
  });

  it('treats an unbounded range as everything', () => {
    const selection = selectExportData({
      transactions: [
        transaction({ id: 'old', date: new Date(1999, 0, 1), amount: -1 }),
        transaction({ id: 'new', date: new Date(2030, 0, 1), amount: -2 })
      ],
      transactionSplits: [],
      accounts,
      categories,
      range: { from: null, to: null },
      includeTransactions: true,
      includeAccounts: false,
      accountsScope: 'all'
    });

    expect(selection.transactions).toHaveLength(2);
  });

  /**
   * A split parent becomes one row per line. The lines sum to the parent, so
   * the file's total is unchanged — but each line carries its own category,
   * which is the whole reason the other exporters already did this.
   */
  it('expands split parents into one row per line', () => {
    const splits: TransactionSplit[] = [
      { id: 's1', transactionId: 'parent', category: 'cat-groceries', amount: -30, sortOrder: 0 },
      { id: 's2', transactionId: 'parent', category: 'cat-fuel', amount: -20, sortOrder: 1 }
    ];

    const selection = selectExportData({
      transactions: [transaction({ id: 'parent', date: new Date(2025, 2, 10), amount: -50, isSplit: true })],
      transactionSplits: splits,
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: false,
      accountsScope: 'all'
    });

    expect(selection.transactions).toHaveLength(2);
    expect(selection.transactions?.map(t => t.categoryLabel)).toEqual(['Food : Groceries', 'Food : Fuel']);
    const total = selection.transactions?.reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBe(-50);
  });

  it('resolves category and account NAMES, so no id can reach a file', () => {
    const selection = selectExportData({
      transactions: [transaction({ id: 't1', date: new Date(2025, 2, 10), amount: -5 })],
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: false,
      accountsScope: 'all'
    });

    expect(selection.transactions?.[0].categoryLabel).toBe('Food : Groceries');
    expect(selection.transactions?.[0].accountLabel).toBe('Everyday Account');
  });

  it('orders rows oldest first, and identically every time', () => {
    const rows = [
      transaction({ id: 'c', date: new Date(2025, 2, 20), amount: -1 }),
      transaction({ id: 'a', date: new Date(2025, 2, 2), amount: -1 }),
      transaction({ id: 'b', date: new Date(2025, 2, 2), amount: -1 })
    ];

    const first = selectExportData({
      transactions: rows,
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: false,
      accountsScope: 'all'
    });
    const second = selectExportData({
      transactions: [...rows].reverse(),
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: false,
      accountsScope: 'all'
    });

    expect(first.transactions?.map(t => t.id)).toEqual(['a', 'b', 'c']);
    expect(second.transactions?.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('says null — not empty — for a section the user did not ask for', () => {
    const selection = selectExportData({
      transactions: [transaction({ id: 't1', date: new Date(2025, 2, 10), amount: -5 })],
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: false,
      includeAccounts: false,
      accountsScope: 'all'
    });

    expect(selection.transactions).toBeNull();
    expect(selection.accounts).toBeNull();
  });

  /**
   * QIF and OFX name an account as a header for the rows beneath it, so an
   * account with nothing in the period would arrive at the far end as an empty
   * account nobody asked to create.
   */
  it('narrows accounts to the ones with transactions for the interchange formats', () => {
    const selection = selectExportData({
      transactions: [transaction({ id: 't1', date: new Date(2025, 2, 10), amount: -5, accountId: 'acc-1' })],
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: true,
      accountsScope: 'with-transactions'
    });

    expect(selection.accounts?.map(a => a.id)).toEqual(['acc-1']);
  });

  it('lists every account for a PDF or a spreadsheet', () => {
    const selection = selectExportData({
      transactions: [transaction({ id: 't1', date: new Date(2025, 2, 10), amount: -5, accountId: 'acc-1' })],
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: true,
      accountsScope: 'all'
    });

    expect(selection.accounts?.map(a => a.id)).toEqual(['acc-1', 'acc-2']);
  });

  /**
   * The property the preview panel depends on: the number it shows is a count
   * OF the file, because both come from this one selection.
   */
  it('gives the preview a count that matches the rows written to the file', () => {
    const rows = [
      transaction({ id: 'before', date: new Date(2025, 1, 1), amount: -1 }),
      transaction({ id: 'in-1', date: new Date(2025, 2, 3), amount: -2 }),
      transaction({ id: 'in-2', date: new Date(2025, 2, 4), amount: -3 })
    ];

    const selection = selectExportData({
      transactions: rows,
      transactionSplits: [],
      accounts,
      categories,
      range: march,
      includeTransactions: true,
      includeAccounts: false,
      accountsScope: 'all'
    });

    const previewCount = selection.transactions?.length ?? 0;
    const csvBodyLines = exportTransactionsToCSV(selection.transactions ?? [], accounts, categories)
      .split('\n')
      .slice(1);

    expect(previewCount).toBe(2);
    expect(csvBodyLines).toHaveLength(previewCount);
  });
});

describe('describeExportRange', () => {
  const now = new Date(2025, 2, 20);

  it('names the period AND the dates it resolved to', () => {
    const range = resolvePeriod('last-month', '', '', now);
    expect(describeExportRange('last-month', range, now)).toBe('Last month: 01/02/2025 to 28/02/2025');
  });

  it('prints an open-ended period as running to today, the last day it can contain', () => {
    const range = resolvePeriod('this-month', '', '', now);
    expect(describeExportRange('this-month', range, now)).toBe('This month: 01/03/2025 to 20/03/2025');
  });

  it('says All time without inventing dates for it', () => {
    const range = resolvePeriod('all', '', '', now);
    expect(describeExportRange('all', range, now)).toBe('All time');
  });
});
