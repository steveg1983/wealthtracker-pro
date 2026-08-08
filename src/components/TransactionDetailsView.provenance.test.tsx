/**
 * The details sheet's category line, when the app was the one who filled it in.
 *
 * This is the halfway house of the phone journey: on the transactions page a
 * tap opens THIS, not the editor. Marked in the list, silent here, marked again
 * in the editor behind it would read as three screens disagreeing about one
 * row.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TransactionDetailsView from './TransactionDetailsView';
import type { Account, Category, Transaction } from '../types';

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({ formatCurrency: (n: number) => `£${Math.abs(n).toFixed(2)}` }),
}));

const ACCOUNT: Account = {
  id: 'acc-a', name: 'Synthetic Current', type: 'current', balance: 500,
  currency: 'GBP', lastUpdated: new Date('2026-04-01'), isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail' },
];

const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-details',
  date: new Date('2026-04-02'),
  description: 'Synthetic details row',
  amount: -18.25,
  type: 'expense',
  category: 'det-groceries',
  accountId: 'acc-a',
  cleared: false,
  ...over,
});

const show = (transaction: Transaction) =>
  render(
    <TransactionDetailsView
      isOpen
      onClose={vi.fn()}
      transaction={transaction}
      accounts={[ACCOUNT]}
      categories={CATEGORIES}
    />
  );

describe('TransactionDetailsView — a category the app guessed', () => {
  it('marks the category in words', () => {
    show(row({ categoryConfirmed: false }));

    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getByText(/category — not confirmed yet/)).toBeInTheDocument();
  });

  it('says nothing about a category the user stands behind', () => {
    show(row({ categoryConfirmed: true }));

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('treats a row with no provenance flag as the user\'s own', () => {
    show(row());

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });
});
