/**
 * Payee cleanup — sorting the payee list from its column headers.
 *
 * The owner's ask, on the same page as the suggestions work: click Payee,
 * Looks like, Transactions or Total to order the list by that column, click
 * again to turn it round, with the arrow saying which way it is.
 *
 * The fixture gives every column a DIFFERENT answer, so nothing here can pass
 * on a list that happens to already be in the right order:
 *
 *   apple grove 22    10 transactions   £10    APPLE GROVE
 *   SQ *NORTH CAFE     3 transactions   £120   (no merchant readable)
 *   MIDDLE MARKET 33   2 transactions   £50    MIDDLE MARKET
 *   TIE ALPHA 44       2 transactions   £50    TIE ALPHA
 *   TIE BRAVO 55       2 transactions   £50    TIE BRAVO
 *   ZEBRA STORES 11    1 transaction    £300   ZEBRA STORES   (a refund)
 *
 * Six payees, so the table takes its plain non-virtualised path and every row
 * is in the DOM to be read in order. None of them share a merchant with another,
 * so no suggestion is offered and the list is the only thing on the page that
 * has an order — this file is about the table and nothing else.
 *
 * Every payee and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PayeeCleanup from './PayeeCleanup';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { summarisePayees } from '../../utils/payeeCleanup';
import type { Transaction } from '../../types';

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(),
    showWarning: vi.fn(), showInfo: vi.fn(), dismissToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

const runOf = (
  count: number, description: string, amount: number, prefix: string
): Transaction[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    description,
    date: new Date('2026-03-01'),
    amount,
    category: 'cat-1',
    accountId: 'acc-1',
    type: amount < 0 ? ('expense' as const) : ('income' as const),
  }));

const REGISTER: Transaction[] = [
  ...runOf(10, 'apple grove 22', -1, 'ap'),
  ...runOf(3, 'SQ *NORTH CAFE', -40, 'sq'),
  ...runOf(2, 'MIDDLE MARKET 33', -25, 'mi'),
  ...runOf(2, 'TIE ALPHA 44', -25, 'ta'),
  ...runOf(2, 'TIE BRAVO 55', -25, 'tb'),
  // Money coming BACK, and the biggest figure on the page either way.
  ...runOf(1, 'ZEBRA STORES 11', 300, 'ze'),
];

/** The three payees tied on both numbers, in the order the tie-break owes them. */
const TIED = ['MIDDLE MARKET 33', 'TIE ALPHA 44', 'TIE BRAVO 55'];

/**
 * The payees down the table, top to bottom.
 *
 * Read off each row's own checkbox, which is labelled with the payee text — the
 * one thing in a row that is unambiguously that row and nothing else.
 */
const rowOrder = (): string[] =>
  screen.getAllByLabelText(/^Select /).map(box => {
    const label = box.getAttribute('aria-label');
    if (label === null) throw new Error('a payee row lost its label');
    return label.replace(/^Select /, '');
  });

type Header = 'Payee' | 'Looks like' | 'Transactions' | 'Total';

/** The header cell's button — its name carries the sort arrow once it is on. */
const header = (name: Header): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^${name}( [↑↓])?$`) });

const sortBy = (name: Header): void => { fireEvent.click(header(name)); };

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('Payee cleanup — the list opens as it always did', () => {
  it('shows the busiest payees first, untouched until a header is clicked', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    // Not a restatement of the expected order but the order the list has always
    // computed for itself, so a changed default cannot slip past this.
    expect(rowOrder()).toEqual(summarisePayees(REGISTER).map(p => p.description));
    expect(rowOrder()).toEqual([
      'apple grove 22', 'SQ *NORTH CAFE', ...TIED, 'ZEBRA STORES 11',
    ]);
  });

  it('says which column it is ordered by, and which way', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(header('Transactions')).toHaveTextContent('↓');
    expect(header('Payee')).not.toHaveTextContent(/[↑↓]/);
  });
});

describe('Payee cleanup — each column puts the list in its own order', () => {
  it('orders by payee name, blind to case', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Payee');

    expect(rowOrder()).toEqual([
      'apple grove 22', 'MIDDLE MARKET 33', 'SQ *NORTH CAFE',
      'TIE ALPHA 44', 'TIE BRAVO 55', 'ZEBRA STORES 11',
    ]);
  });

  it('orders by the merchant a payee looks like, dashes last', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Looks like');

    // SQ has no readable merchant, so it goes to the foot — an absence rather
    // than the smallest name.
    expect(rowOrder()).toEqual([
      'apple grove 22', 'MIDDLE MARKET 33', 'TIE ALPHA 44', 'TIE BRAVO 55',
      'ZEBRA STORES 11', 'SQ *NORTH CAFE',
    ]);
  });

  it('orders by transactions as numbers, so 10 beats 3', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Transactions');

    // Ascending on the first click of a column, which is the house behaviour.
    expect(rowOrder()).toEqual([
      'ZEBRA STORES 11', ...TIED, 'SQ *NORTH CAFE', 'apple grove 22',
    ]);
  });

  it('orders by money, and a refund counts at its size', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Total');

    // ZEBRA's £300 came back rather than went out, and it is still the biggest
    // number on the page — so ascending puts it last, not first.
    expect(rowOrder()).toEqual([
      'apple grove 22', ...TIED, 'SQ *NORTH CAFE', 'ZEBRA STORES 11',
    ]);
  });
});

describe('Payee cleanup — clicking a header again turns it round', () => {
  it('flips the direction and the arrow with it', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Payee');
    expect(rowOrder()[0]).toBe('apple grove 22');
    expect(header('Payee')).toHaveTextContent('↑');

    sortBy('Payee');
    expect(rowOrder()[0]).toBe('ZEBRA STORES 11');
    expect(header('Payee')).toHaveTextContent('↓');
  });

  it('starts a different column afresh rather than keeping the old direction', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Payee');
    sortBy('Payee');
    expect(header('Payee')).toHaveTextContent('↓');

    sortBy('Total');

    expect(header('Total')).toHaveTextContent('↑');
    expect(header('Payee')).not.toHaveTextContent(/[↑↓]/);
    expect(rowOrder()[0]).toBe('apple grove 22');
  });

  it('keeps a run of equal figures in the same order whichever way the column points', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Transactions');
    expect(rowOrder().filter(d => TIED.includes(d))).toEqual(TIED);

    sortBy('Transactions');
    // The tie-break is not a second sort: reversing the column must not shuffle
    // the three payees that are level on it.
    expect(rowOrder().filter(d => TIED.includes(d))).toEqual(TIED);
  });
});

describe('Payee cleanup — sorting does not disturb the work in progress', () => {
  it('keeps every row, its checkbox and what was ticked', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    fireEvent.click(screen.getByLabelText('Select apple grove 22'));
    fireEvent.click(screen.getByLabelText('Select ZEBRA STORES 11'));
    expect(screen.getByText('2 selected · 11 transactions')).toBeInTheDocument();

    sortBy('Payee');
    sortBy('Payee');

    // Selection is held by payee text, not by row position, so re-ordering
    // cannot silently change what a rename is about to rewrite.
    expect(rowOrder()).toHaveLength(6);
    expect(screen.getByText('2 selected · 11 transactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Select apple grove 22')).toBeChecked();
    expect(screen.getByLabelText('Select ZEBRA STORES 11')).toBeChecked();
    expect(screen.getByLabelText('Select TIE ALPHA 44')).not.toBeChecked();
  });

  it('leaves the counts alone — an order is not a filter', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    sortBy('Total');

    expect(screen.getByText('Showing 6 of 6 payees')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select all shown (6)' })).toBeInTheDocument();
  });

  it('orders what the search left on screen, not the whole register', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    fireEvent.change(screen.getByLabelText('Search payees'), { target: { value: 'tie' } });
    sortBy('Payee');
    fireEvent.click(header('Payee'));

    expect(rowOrder()).toEqual(['TIE BRAVO 55', 'TIE ALPHA 44']);
    expect(screen.getByText('Showing 2 of 6 payees')).toBeInTheDocument();
  });
});
