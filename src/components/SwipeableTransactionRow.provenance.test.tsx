/**
 * The phone card list's category line, when the app was the one who filled it
 * in.
 *
 * A phone card has one line for date, category and account, so the marker has
 * to be small — but it still has to be a WORD. The confirm-or-edit on a phone
 * is the full editor a tap opens, where the same badge sits over the picker and
 * saving records the answer; no second mechanism was invented here.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwipeableTransactionRow } from './SwipeableTransactionRow';
import type { Transaction } from '../types';

const handlers = {
  formatCurrency: (n: number) =>
      Number(n) < 0
        ? `(£${Math.abs(Number(n)).toFixed(2)})`
        : `£${Number(n).toFixed(2)}`,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onView: vi.fn(),
};

const card = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-card',
  date: new Date('2026-04-02'),
  description: 'Synthetic card row',
  amount: -18.25,
  type: 'expense',
  category: 'det-groceries',
  accountId: 'acc-a',
  cleared: false,
  ...over,
});

describe('SwipeableTransactionRow — a category the app guessed', () => {
  it('marks the line in words, beside the category it is about', () => {
    render(
      <SwipeableTransactionRow
        {...handlers}
        transaction={card({ categoryConfirmed: false })}
        categoryName="Groceries"
      />
    );

    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getByText(/category — not confirmed yet/)).toBeInTheDocument();
    expect(screen.getByText(/Groceries/)).toBeInTheDocument();
  });

  it('says nothing about a category the user stands behind', () => {
    render(
      <SwipeableTransactionRow
        {...handlers}
        transaction={card({ categoryConfirmed: true })}
        categoryName="Groceries"
      />
    );

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('treats a row with no provenance flag as the user\'s own', () => {
    render(
      <SwipeableTransactionRow {...handlers} transaction={card()} categoryName="Groceries" />
    );

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('never marks a transfer, whose category is not a judgement to make', () => {
    render(
      <SwipeableTransactionRow
        {...handlers}
        transaction={card({ type: 'transfer', categoryConfirmed: false })}
        categoryName="Transfer > Synthetic Savings"
      />
    );

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });
});
