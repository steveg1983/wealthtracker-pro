import { describe, it, expect } from 'vitest';
import { buildPayeeTotals, payeeKeyOf, NO_PAYEE_KEY } from './spendingByPayee';
import { computeIncomeExpense } from './incomeExpense';
import type { Category, Transaction } from '../types';

/** Synthetic fixtures only — no real payees or amounts in this repo. */
const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-shopping', name: 'Shopping', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-supplies', name: 'Supplies', type: 'expense', level: 'detail', parentId: 'grp-shopping' },
  { id: 'cat-books', name: 'Books', type: 'expense', level: 'detail', parentId: 'grp-shopping' },
  { id: 'grp-pay', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
];

const txn = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'description'>): Transaction => ({
  date: new Date(2026, 0, 10),
  category: 'cat-supplies',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

describe('payeeKeyOf', () => {
  it('normalises case and padding so one payee is one row', () => {
    expect(payeeKeyOf('  test shop  ')).toBe('TEST SHOP');
    expect(payeeKeyOf('Test Shop')).toBe(payeeKeyOf('TEST SHOP'));
  });

  it('folds description-less rows into a key that cannot collide with a payee', () => {
    expect(payeeKeyOf('')).toBe(NO_PAYEE_KEY);
    expect(payeeKeyOf('   ')).toBe(NO_PAYEE_KEY);
    // The bank-sync sentinel is not a payee identity.
    expect(payeeKeyOf('Bank transaction')).toBe(NO_PAYEE_KEY);
    expect(NO_PAYEE_KEY).toBe(NO_PAYEE_KEY.toLowerCase());
  });
});

describe('buildPayeeTotals', () => {
  const totalsFor = (transactions: Transaction[]) => {
    const flows = computeIncomeExpense(transactions, [], CATEGORIES);
    return buildPayeeTotals(flows.expenseRows, 'expense', CATEGORIES);
  };

  it('groups by normalised payee and ranks by value', () => {
    const { rows, total } = totalsFor([
      txn({ id: 't1', amount: -10, description: 'Test Shop' }),
      txn({ id: 't2', amount: -15, description: 'TEST SHOP' }),
      txn({ id: 't3', amount: -40, description: 'Other Merchant' }),
    ]);

    expect(total).toBe(65);
    expect(rows.map(r => r.payee)).toEqual(['OTHER MERCHANT', 'TEST SHOP']);
    expect(rows[0].total).toBe(40);
    expect(rows[1].total).toBe(25);
    expect(rows[1].count).toBe(2);
    // Original casing is kept for display; the key is what groups.
    expect(rows[1].displayName).toBe('Test Shop');
  });

  it('states each payee as a share of the side total', () => {
    const { rows } = totalsFor([
      txn({ id: 't1', amount: -75, description: 'Payee A' }),
      txn({ id: 't2', amount: -25, description: 'Payee B' }),
    ]);

    expect(rows[0].share).toBe(75);
    expect(rows[1].share).toBe(25);
  });

  it('nets a refund down instead of counting it as income', () => {
    const { rows, total } = totalsFor([
      txn({ id: 't1', amount: -60, description: 'Payee A' }),
      // A credit filed under an EXPENSE category is a refund, not income.
      txn({ id: 't2', amount: 20, description: 'Payee A', type: 'income' }),
    ]);

    expect(total).toBe(40);
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(40);
    expect(rows[0].count).toBe(2);
  });

  it('keeps decimals exact over many rows (no floating-point drift)', () => {
    const rows: Transaction[] = Array.from({ length: 10 }, (_, i) =>
      txn({ id: `t${i}`, amount: -0.1, description: 'Payee A' })
    );

    expect(totalsFor(rows).rows[0].total).toBe(1);
  });

  it('reports the category the payee is filed under most often, by name', () => {
    const { rows } = totalsFor([
      txn({ id: 't1', amount: -10, description: 'Payee A', category: 'cat-supplies' }),
      txn({ id: 't2', amount: -10, description: 'Payee A', category: 'cat-supplies' }),
      txn({ id: 't3', amount: -10, description: 'Payee A', category: 'cat-books' }),
    ]);

    expect(rows[0].topCategoryName).toBe('Shopping : Supplies');
    expect(rows[0].topCategoryCount).toBe(2);
  });

  it('never counts transfers or uncategorised rows', () => {
    const { rows, total } = totalsFor([
      txn({ id: 't1', amount: -10, description: 'Payee A' }),
      txn({ id: 't2', amount: -999, description: 'Payee B', type: 'transfer' }),
      txn({ id: 't3', amount: -999, description: 'Payee C', category: '' }),
      txn({ id: 't4', amount: -999, description: 'Payee D', category: 'no-such-category' }),
    ]);

    expect(total).toBe(10);
    expect(rows.map(r => r.payee)).toEqual(['PAYEE A']);
  });

  it('ranks the income side the same way, with positive magnitudes', () => {
    const flows = computeIncomeExpense(
      [
        txn({ id: 't1', amount: 500, description: 'Payer A', category: 'grp-pay', type: 'income' }),
        txn({ id: 't2', amount: 250, description: 'Payer B', category: 'grp-pay', type: 'income' }),
      ],
      [],
      CATEGORIES
    );
    const { rows, total } = buildPayeeTotals(flows.incomeRows, 'income', CATEGORIES);

    expect(total).toBe(750);
    expect(rows.map(r => r.total)).toEqual([500, 250]);
  });

  it('labels rows with no payee rather than dropping their value', () => {
    const { rows, total } = totalsFor([
      txn({ id: 't1', amount: -10, description: '' }),
      txn({ id: 't2', amount: -5, description: 'BANK TRANSACTION' }),
    ]);

    expect(total).toBe(15);
    expect(rows).toHaveLength(1);
    expect(rows[0].payee).toBe(NO_PAYEE_KEY);
    expect(rows[0].displayName).toBe('No payee recorded');
  });

  it('returns nothing for an empty period', () => {
    expect(totalsFor([])).toEqual({ rows: [], total: 0 });
  });
});
