import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import IncomeExpenseBreakdownModal from './IncomeExpenseBreakdownModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import type { Category, Transaction } from '../types';
import type { SplitExpandedTransaction } from '../utils/transactionSplits';

/**
 * THE DRILL READS IN THE ORDER THE CATEGORY LIST DOES (owner, 25 Aug):
 * "in the order of how I read the categories from top to bottom, which is
 * alphabetical groupings then alphabetical category names."
 *
 * Sections were ordered by |subtotal| — biggest spend first — which answers a
 * question nobody asked here. This drill is opened to FIND something: the
 * reader already knows the category and had to hunt for it down a list whose
 * order changed with every period.
 *
 * The fixture is built so the two orders DISAGREE: the alphabetically-first
 * group holds the smallest amount, so a test that passed under either rule
 * would prove nothing.
 *
 * Every payee, category and figure below is invented: this repo is public.
 */

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  // Groups deliberately NOT in alphabetical order here, so the sort cannot
  // be satisfied by insertion order.
  { id: 'grp-house', name: 'Household', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'grp-gifts', name: 'Gifts', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'grp-house' },
  { id: 'det-water', name: 'Water', type: 'expense', level: 'detail', parentId: 'grp-house' },
  { id: 'det-birthday', name: 'Birthday', type: 'expense', level: 'detail', parentId: 'grp-gifts' },
];

const txn = (id: string, category: string, amount: number): SplitExpandedTransaction =>
  ({
    id, date: new Date(Date.UTC(2026, 3, 6)), description: 'Payment ' + id,
    amount, type: 'expense', category, accountId: 'acc-1', cleared: false,
  } as Transaction as SplitExpandedTransaction);

/**
 * Gifts : Birthday is the SMALLEST and sorts FIRST; Household : Water is the
 * LARGEST and sorts LAST. Under the old |subtotal| rule the order was exactly
 * reversed, so this fixture separates the two rules cleanly.
 */
const ROWS: SplitExpandedTransaction[] = [
  txn('t1', 'det-water', -900),
  txn('t2', 'det-repairs', -500),
  txn('t3', 'det-birthday', -100),
];

const renderDrill = (): void => {
  render(
    <PreferencesProvider>
      <IncomeExpenseBreakdownModal
        isOpen
        onClose={vi.fn()}
        title="Expenses — Last month"
        bucket="expense"
        rows={ROWS}
        total={null}
        categories={CATEGORIES}
        onEditTransaction={vi.fn()}
      />
    </PreferencesProvider>
  );
};

/**
 * The section headings, top to bottom, as the reader meets them.
 *
 * The table renders a mobile and a desktop layout, so each heading appears
 * twice; the trailing "(n)" is the row count. Both are stripped so the spec
 * is about ORDER and nothing else.
 */
const sectionOrder = (): string[] => {
  const seen: string[] = [];
  for (const el of screen.getAllByText(/^(Gifts|Household) : /)) {
    const name = el.textContent!.trim().replace(/\s*\(\d+\)\s*$/, '');
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
};

beforeEach(() => {
  __setAppContextValue({
    categories: CATEGORIES,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
  });
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('the breakdown drill’s section order', () => {
  it('reads alphabetically by group, then by category — not by size', () => {
    renderDrill();
    expect(sectionOrder()).toEqual([
      'Gifts : Birthday',
      'Household : Repairs',
      'Household : Water',
    ]);
  });

  it('is the DEFAULT, so the reader gets it without touching a control', () => {
    // The drill opens on the category view; if biggest-first ever returns as
    // the default, the previous spec would still pass on a second click.
    renderDrill();
    expect(sectionOrder()[0]).toBe('Gifts : Birthday');
  });

  it('flips to Z→A on the Category header, which is what a name column means', () => {
    renderDrill();
    fireEvent.click(screen.getByRole('button', { name: /Category/ }));
    expect(sectionOrder()).toEqual([
      'Household : Water',
      'Household : Repairs',
      'Gifts : Birthday',
    ]);
  });
});
