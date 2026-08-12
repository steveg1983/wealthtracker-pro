/**
 * PAYEE CLEANUP'S THREE KINDS OF NOTHING (DESIGN_PASS §4).
 *
 * This screen already told them apart in prose — it was one of the few that
 * did — but it said them as bare sentences with no count and no way out. The
 * count is what turns "my payees are gone" back into "they are hidden", and on
 * a screen whose entire purpose is bulk-editing thousands of payees, that
 * distinction is the difference between a search that missed and a tidy-up
 * that ate the list.
 *
 *   empty      the ledger has no transactions, so there are no payees at all;
 *   hidden     every payee has been dismissed off this page;
 *   searched   the payees are right there and the query is over them.
 *
 * Every payee below is invented: this repo is public.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import PayeeCleanup from './PayeeCleanup';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { payeeHiddenDismissalKey } from '../../utils/suggestionDismissals';
import type { SuggestionDismissal, Transaction } from '../../types';

const toast = vi.hoisted(() => ({
  showToast: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(),
  showWarning: vi.fn(), showInfo: vi.fn(), dismissToast: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

const txn = (over: Partial<Transaction> & { id: string; description: string }): Transaction => ({
  date: new Date('2026-03-01'),
  amount: -10,
  category: 'cat-1',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

const BOOTS = 'BOOTS';
const TESCO = 'TESCO STORES 3411';
const REGISTER: Transaction[] = [
  txn({ id: 't1', description: BOOTS }),
  txn({ id: 't2', description: TESCO }),
];

const dismissal = (subjectKey: string): SuggestionDismissal => ({
  id: `d-${subjectKey}`, kind: 'payee-hidden', subjectKey, subjectIds: [],
  dismissedAt: new Date('2026-06-01'),
});

const searchFor = (term: string): void => {
  fireEvent.change(screen.getByLabelText('Search payees'), { target: { value: term } });
};

beforeEach(() => {
  toast.showSuccess.mockClear();
  toast.showError.mockClear();
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('payee cleanup with no payees at all', () => {
  it('says what is absent and what would put something here', () => {
    __setAppContextValue({ transactions: [] });
    render(<PayeeCleanup />);

    expect(screen.getByRole('heading', { level: 3, name: 'No payees to tidy yet' })).toBeInTheDocument();
    // The consequence, and where payees actually come from — this screen
    // gathers them, it does not create them.
    expect(screen.getByText(/nothing here to merge or rename/)).toBeInTheDocument();
    // No fabricated remedy: nothing on THIS page makes a payee.
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('payee cleanup emptied by the search is not payee cleanup with nothing in it', () => {
  it('names how many payees are hidden and the query hiding them', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    searchFor('quenchless');

    expect(
      screen.getByRole('heading', { level: 3, name: 'No payees match your search' })
    ).toBeInTheDocument();
    // THE COUNT IS THE POINT: both payees still exist.
    expect(screen.getByText(/payees are hidden by/)).toBeInTheDocument();
    expect(screen.getByText('Search: quenchless')).toBeInTheDocument();
  });

  it('is distinguishable from the empty screen by every word that matters', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    searchFor('quenchless');

    expect(screen.queryByRole('heading', { name: 'No payees to tidy yet' })).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing here to merge or rename/)).not.toBeInTheDocument();
  });

  it('offers one control that gives them back, and it gives them back', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    searchFor('quenchless');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.queryByRole('heading', { name: 'No payees match your search' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Search payees')).toHaveValue('');
    expect(screen.getByLabelText(`Select ${BOOTS}`)).toBeInTheDocument();
  });
});

describe('payee cleanup with every payee dismissed off the page', () => {
  it('is its own state: the payees exist, they are simply not here', () => {
    __setAppContextValue({
      transactions: REGISTER,
      suggestionDismissals: [
        dismissal(payeeHiddenDismissalKey(BOOTS)),
        dismissal(payeeHiddenDismissalKey(TESCO)),
      ],
    });
    render(<PayeeCleanup />);

    const heading = screen.getByRole('heading', { level: 3, name: 'Every payee is hidden' });
    // The count, because "hidden" without a number is still indistinguishable
    // from "lost" — and the place the individual undo lives. Scoped to the
    // state itself: the toolbar above prints its own "2 hidden" tally, and an
    // unscoped match would pass on that one without this state saying anything.
    const emptyState = heading.parentElement as HTMLElement;
    expect(within(emptyState).getByText('2')).toBeInTheDocument();
    expect(within(emptyState).getByText(/still on your transactions/)).toBeInTheDocument();
    // Not the first-run sentence, which would claim there is nothing to tidy.
    expect(screen.queryByRole('heading', { name: 'No payees to tidy yet' })).not.toBeInTheDocument();
  });
});
