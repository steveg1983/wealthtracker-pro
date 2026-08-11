/**
 * The phone card's version of Microsoft Money's bold.
 *
 * A phone looking at an account register is still looking at the register: the
 * same To Review box sits above the list and the same filter narrows it, so the
 * rows have to say the same thing about themselves. What differs is only how —
 * a card has two lines rather than eight columns, so the pair that carries the
 * weight is the description and the date line under it.
 *
 * And it is OPT-IN. A list with no To Review counter above it and no filter
 * beside it — a report, a Find result — marks nothing: marking rows where there
 * is nothing to do about them as a set is how people learn to ignore the
 * marking on the screen where it matters. So only the register asks for it.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwipeableTransactionRow } from './SwipeableTransactionRow';
import type { Transaction } from '../types';

const handlers = {
  formatCurrency: (n: number) => `£${Math.abs(n).toFixed(2)}`,
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

const descriptionLine = (): HTMLElement => screen.getByText(/Synthetic card row/);

describe('SwipeableTransactionRow — a row that has just arrived', () => {
  it('draws it bold where the register asks for it', () => {
    render(
      <SwipeableTransactionRow
        {...handlers}
        transaction={card({ needsReview: true })}
        categoryName="Groceries"
        markNewArrivals
      />
    );

    expect(descriptionLine().className).toContain('font-bold');
    // Words as well as weight, for anyone who cannot see the difference.
    expect(screen.getByText(/new, not reviewed yet/)).toBeInTheDocument();
  });

  it('leaves a row that has been dealt with at its ordinary weight', () => {
    render(
      <SwipeableTransactionRow
        {...handlers}
        transaction={card({ needsReview: false })}
        categoryName="Groceries"
        markNewArrivals
      />
    );

    expect(descriptionLine().className).toContain('font-medium');
    expect(descriptionLine().className).not.toContain('font-bold');
  });

  it('treats a row with no review flag as already dealt with', () => {
    render(
      <SwipeableTransactionRow
        {...handlers}
        transaction={card()}
        categoryName="Groceries"
        markNewArrivals
      />
    );

    expect(descriptionLine().className).not.toContain('font-bold');
  });

  it('says nothing at all on a screen that did not ask — the mark needs somewhere to lead', () => {
    render(
      <SwipeableTransactionRow
        {...handlers}
        transaction={card({ needsReview: true })}
        categoryName="Groceries"
      />
    );

    expect(descriptionLine().className).not.toContain('font-bold');
    expect(screen.queryByText(/new, not reviewed yet/)).not.toBeInTheDocument();
  });
});
