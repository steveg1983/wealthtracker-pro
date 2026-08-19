import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import Forecast from '../Forecast';
import type { Account, Category, SuggestionDismissal, Transaction } from '../../types';

/**
 * THE FORECAST'S BASE (docs/forecast-direction.md step 4): twelve COMPLETE
 * months of category actuals, one-offs excludable with the exclusions
 * STATED. The rules pinned here:
 *
 *  - the current month is not in the base — a half-month understates;
 *  - a category's figures are the sum of the rows shown under it;
 *  - an exclusion is a verdict about ONE ROW ('forecast-excluded', key and
 *    subject id both the row's own id), and excluded rows are listed in a
 *    restorable band, never silently subtracted;
 *  - the unfiled remainder is a named line, excludable like any other;
 *  - the verdicts are lazy-loaded and this page ASKS (the #353 lesson);
 *  - the page says, in words, that it never writes to Budget.
 *
 * Every payee, category and figure invented — the repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-base', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date(), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail' },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail' },
];

const now = new Date();
/** The 15th of each of the twelve complete months before this one. */
const monthAgo = (monthsBack: number): Date =>
  new Date(now.getFullYear(), now.getMonth() - monthsBack, 15);

const ONE_OFF_ID = 'txn-one-off';

const LEDGER: Transaction[] = [
  // Twelve months of £100 Food and £2,000 Salary.
  ...Array.from({ length: 12 }, (_, i): Transaction[] => ([
    {
      id: `food-${i}`, accountId: ACCOUNT.id, description: 'Grocer',
      amount: -100, date: monthAgo(i + 1), type: 'expense', category: 'cat-food',
    },
    {
      id: `pay-${i}`, accountId: ACCOUNT.id, description: 'Payroll',
      amount: 2000, date: monthAgo(i + 1), type: 'income', category: 'cat-salary',
    },
  ])).flat(),
  // A £5,000 unfiled one-off — the roof.
  {
    id: ONE_OFF_ID, accountId: ACCOUNT.id, description: 'Roof repair',
    amount: -5000, date: monthAgo(3), type: 'expense', category: '',
  },
  // A transfer: neither income nor spending, counted out loud.
  {
    id: 'txn-transfer', accountId: ACCOUNT.id, description: 'To savings',
    amount: -500, date: monthAgo(2), type: 'transfer', category: '',
  },
  // THIS month — outside the base by definition.
  {
    id: 'txn-current', accountId: ACCOUNT.id, description: 'Current month spend',
    amount: -999, date: new Date(now.getFullYear(), now.getMonth(), 2), type: 'expense', category: 'cat-food',
  },
];

const dismissSuggestion = vi.fn(async () => {});
const restoreSuggestion = vi.fn(async () => {});
const refreshSuggestionDismissals = vi.fn(async () => {});

const renderForecast = (
  dismissals: SuggestionDismissal[] = [],
  status: 'idle' | 'ready' = 'ready'
): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    categories: CATEGORIES,
    transactions: LEDGER,
    isLoading: false,
    suggestionDismissals: dismissals,
    suggestionDismissalsStatus: status,
    refreshSuggestionDismissals,
    dismissSuggestion,
    restoreSuggestion,
  });
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <Forecast />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const excludedVerdict: SuggestionDismissal = {
  id: 'dis-roof',
  kind: 'forecast-excluded',
  subjectKey: ONE_OFF_ID,
  subjectIds: [ONE_OFF_ID],
  dismissedAt: new Date(),
};

beforeEach(() => {
  localStorage.clear();
  dismissSuggestion.mockClear();
  restoreSuggestion.mockClear();
  refreshSuggestionDismissals.mockClear();
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Forecast — the base', () => {
  it('shows twelve complete months by category, with honest averages — the current month left out', () => {
    renderForecast();

    // Food: 12 × £100 — and NOT 13: the current month's £999 is outside the
    // base, or the average would claim a typical month that never was.
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('(£1,200.00)')).toBeInTheDocument();
    // Salary: 12 × £2,000 — the figure appears TWICE by construction, as the
    // income side's total and as its only category's, and the two agreeing
    // is itself the property (a category's figures are the sum of its rows).
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getAllByText('+£24,000.00')).toHaveLength(2);
    expect(screen.getAllByText('£2,000.00 a month')).toHaveLength(2);

    // The unfiled one-off sits under its NAMED line on the expenditure side…
    expect(screen.getByText('Uncategorised — not yet filed')).toBeInTheDocument();
    // …and the transfer is left out BY NAME, with its count.
    expect(screen.getByText(/Transfers between your accounts are not income or spending/)).toBeInTheDocument();
    expect(screen.getByText(/\(1 in this stretch\)/)).toBeInTheDocument();

    // The ruling, in words, on the page.
    expect(screen.getByText(/Nothing here writes to your Budget/)).toBeInTheDocument();
  });

  it('a category expands to the rows its figure is the sum of, and Exclude records the verdict', async () => {
    renderForecast();

    fireEvent.click(screen.getByRole('button', { name: /Uncategorised — not yet filed/ }));
    expect(screen.getByText('Roof repair')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exclude' }));
    await waitFor(() => {
      // The verdict is about ONE ROW: key and subject id are both the row's
      // own id, so a restore remaps it and a deleted row cascades it away.
      expect(dismissSuggestion).toHaveBeenCalledWith('forecast-excluded', ONE_OFF_ID, [ONE_OFF_ID]);
    });
  });

  it('an excluded one-off leaves the figures and sits in a restorable band, stated in the headline', async () => {
    renderForecast([excludedVerdict]);

    // The expenditure side is Food alone now — the roof is out of the sums,
    // so the side total and Food's total agree at (£1,200.00).
    expect(screen.getAllByText('(£1,200.00)')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Uncategorised — not yet filed/ })).not.toBeInTheDocument();

    // …and STATED, twice: in the headline note and in the band.
    expect(screen.getByText(/1 one-off is excluded/)).toBeInTheDocument();
    const band = screen.getByText('Excluded from the base').closest('details') as HTMLElement;
    expect(within(band).getByText('Roof repair')).toBeInTheDocument();

    fireEvent.click(within(band).getByRole('button', { name: 'Restore' }));
    await waitFor(() => {
      expect(restoreSuggestion).toHaveBeenCalledWith('forecast-excluded', ONE_OFF_ID);
    });
  });

  it('ASKS for the lazy-loaded verdicts when they have never been loaded', async () => {
    renderForecast([], 'idle');

    await waitFor(() => {
      expect(refreshSuggestionDismissals).toHaveBeenCalled();
    });
  });
});
