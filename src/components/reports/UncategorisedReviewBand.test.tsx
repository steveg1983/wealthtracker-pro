/**
 * The review band is INFORMATION, not an alarm (Design, 23 Aug §2).
 *
 * The first shipped draft carried five signals in one strip: an amber border
 * and tint, a green figure, a red figure, a red-BORDERED box around the net —
 * a piece of furniture nothing else in the app has — and an amber action link
 * stacked above two blue ones, three routes to the same job in two colours.
 * These specs pin the calm version: a neutral house card, the three figures
 * in the money colours they would wear anywhere else with no box, a zero net
 * in no colour at all, and every route in the one link colour.
 *
 * The flows are built the way the report pages build them
 * (computeIncomeExpense over invented rows). Every figure below is invented;
 * the repo is public.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UncategorisedReviewBand from './UncategorisedReviewBand';
import { computeIncomeExpense } from '../../utils/incomeExpense';
import type { Category, Transaction } from '../../types';

// The three ways out open real working surfaces with their own suites; here
// they only stand in for "a route exists".
vi.mock('../TransferSweepModal', () => ({ default: () => null }));
vi.mock('../BulkCategorizeModal', () => ({ default: () => null }));
vi.mock('./ReportDrillModal', () => ({ default: () => null }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}`,
  }),
}));

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -10,
  description: 'synthetic row',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  cleared: false,
  ...over,
});

const flowsOf = (transactions: Transaction[]) =>
  computeIncomeExpense(transactions, [], CATEGORIES);

const bandFor = (transactions: Transaction[]) => {
  const { container } = render(
    <UncategorisedReviewBand flows={flowsOf(transactions)} categories={CATEGORIES} />
  );
  return container;
};

describe('the uncategorised review band is information, not an alarm', () => {
  const unfiled = [
    txn({ id: 't-in', amount: 120, type: 'income' }),
    txn({ id: 't-out', amount: -200, type: 'expense' }),
  ];

  it('wears the neutral house surface — no amber anywhere in the band', () => {
    const container = bandFor(unfiled);
    expect(container.innerHTML).not.toMatch(/amber/);
  });

  it('states the net in a money colour with NO box around it', () => {
    const container = bandFor(unfiled);
    const net = screen.getByText(/net out/);
    expect(net.className).toContain('text-red-600');
    // The bordered chip was furniture nothing else in the app has.
    expect(net.className).not.toMatch(/border/);
    expect(container.innerHTML).toContain('£120.00');
    expect(container.innerHTML).toContain('£200.00');
  });

  it('a zero net wears no colour at all', () => {
    bandFor([
      txn({ id: 't-in', amount: 150, type: 'income' }),
      txn({ id: 't-out', amount: -150, type: 'expense' }),
    ]);
    const zero = screen.getByText('nets to zero');
    expect(zero.className).toContain('text-gray-500');
    expect(zero.className).not.toMatch(/border|amber|red|green/);
  });

  // The colour changed under this test on 29 Aug 2026 and its POINT did not:
  // all three routes still speak in one voice, and that voice is now the app's
  // own navy rather than a stock blue. Link blue survives only on an `<a>` that
  // leaves the app (`design-system/linkBlue.ts`); in-app navigation has always
  // had `text-primary`, which index.css gives a dark counterpart.
  it('all three routes to filing speak in the one in-app link colour', () => {
    bandFor(unfiled);
    const review = screen.getByText('Click to review and categorise');
    const sweep = screen.getByText(/match transfers automatically/);
    const payee = screen.getByText(/categorise by payee/);
    expect(review.className).toContain('text-primary');
    for (const route of [sweep, payee]) {
      expect(route.className).toContain('text-primary');
    }
  });

  it('renders nothing at all when every row is filed', () => {
    const { container } = render(
      <UncategorisedReviewBand
        flows={flowsOf([txn({ id: 't-filed', category: 'type-expense' })])}
        categories={CATEGORIES}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
