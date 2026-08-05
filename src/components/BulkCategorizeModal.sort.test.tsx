/**
 * BulkCategorizeModal — sorting the payee table.
 *
 * The rules worth pinning: the list opens in the order buildPayeeGroups
 * emitted (biggest payees first) so nothing moves before it is asked to, the
 * money column sorts by magnitude, and the Category column puts the payees
 * still undecided LAST in both directions — that column is clicked to see
 * what has already been settled.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BulkCategorizeModal from './BulkCategorizeModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Category, Transaction } from '../types';

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(),
    convertAndFormat: vi.fn(),
    convertAndSum: vi.fn(),
  }),
}));

vi.mock('../hooks/useAccountNames', () => ({
  useAccountNames: () => (id: string) => (id === 'acc-current' ? 'Current account' : id),
}));

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail' },
  { id: 'cat-home', name: 'Home', type: 'expense', level: 'detail' },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -10,
  description: 'Mango Ltd',
  category: '',
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

const uncategorised = (payee: string, amounts: number[]): Transaction[] =>
  amounts.map((amount, i) => txn({ id: `${payee}-${i}`, description: payee, amount }));

/** Rows filed before, so the group arrives with its category already chosen. */
const filedBefore = (payee: string, categoryId: string, howMany: number): Transaction[] =>
  Array.from({ length: howMany }, (_, i) =>
    txn({ id: `${payee}-hist-${i}`, description: payee, amount: -5, category: categoryId })
  );

/**
 * Three payees that disagree on every column:
 *   Mango Ltd    5 rows  £1200  → Food (filed 3 of 3 before)
 *   Alpha Store  4 rows  £30    → undecided
 *   Zebra Cafe   3 rows  £500   → Home (filed 2 of 2 before)
 */
const HISTORY: Transaction[] = [
  ...uncategorised('Mango Ltd', [-300, -300, -300, -200, -100]),
  ...filedBefore('Mango Ltd', 'cat-food', 3),
  ...uncategorised('Alpha Store', [-10, -10, -5, -5]),
  ...uncategorised('Zebra Cafe', [-200, -200, -100]),
  ...filedBefore('Zebra Cafe', 'cat-home', 2),
];

const renderModal = (): void => {
  render(
    <MemoryRouter>
      <BulkCategorizeModal isOpen onClose={vi.fn()} />
    </MemoryRouter>
  );
};

/** The payee rows in render order, each identified by its Rows count. */
const rowCounts = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[1].textContent?.trim() ?? '');

beforeEach(() => {
  __setAppContextValue({ transactions: HISTORY, categories: CATEGORIES });
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('BulkCategorizeModal — sorting the payee table', () => {
  it('opens with the biggest payees first, exactly as the groups arrive', () => {
    renderModal();

    expect(rowCounts()).toEqual(['5', '4', '3']);
    expect(screen.getByRole('button', { name: 'Rows ↓' })).toBeInTheDocument();
  });

  it('flips Rows to fewest-first on a click', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Rows/ }));

    expect(rowCounts()).toEqual(['3', '4', '5']);
    expect(screen.getByRole('button', { name: 'Rows ↑' })).toBeInTheDocument();
  });

  it('sorts Total by magnitude, biggest first, and flips on a second click', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Total/ }));
    // £1200, £500, £30 — not the row counts, which run 5, 3, 4 here.
    expect(rowCounts()).toEqual(['5', '3', '4']);

    fireEvent.click(screen.getByRole('button', { name: /^Total/ }));
    expect(rowCounts()).toEqual(['4', '3', '5']);
  });

  it('sorts Payee alphabetically, ignoring case', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Payee/ }));

    // Alpha Store, Mango Ltd, Zebra Cafe.
    expect(rowCounts()).toEqual(['4', '5', '3']);
  });

  it('sorts Category by the chosen name, keeping undecided payees last BOTH ways', () => {
    renderModal();
    // Alpha Store is the undecided one — nothing in its history to pre-fill.
    expect(screen.getByText('Choose a category…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Category/ }));
    // Food (Mango, 5), Home (Zebra, 3), then the undecided Alpha (4).
    expect(rowCounts()).toEqual(['5', '3', '4']);

    fireEvent.click(screen.getByRole('button', { name: /^Category/ }));
    // The chosen two swap; the undecided payee does NOT rise to the top.
    expect(rowCounts()).toEqual(['3', '5', '4']);
  });

  it('sends a payee to the undecided block the moment its category is cleared', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Category/ }));
    expect(rowCounts()).toEqual(['5', '3', '4']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear category for Mango Ltd' }));

    // Home (Zebra, 3) is now the only decision left; both blanks follow it.
    expect(rowCounts()[0]).toBe('3');
    expect(rowCounts().slice(1).sort()).toEqual(['4', '5']);
  });
});
