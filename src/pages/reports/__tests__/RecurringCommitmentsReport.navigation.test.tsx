import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import RecurringCommitmentsReport from '../RecurringCommitmentsReport';
import { recurringAnswerKey } from '../../../utils/suggestionDismissals';
import { normalisePayeeKey } from '../../../utils/recurringDetection';
import type { Account, SuggestionDismissal, Transaction } from '../../../types';

/**
 * Navigation, on the owner's ask of 18 Aug: "Offer up viewing by
 * 'institution' like on the accounts page. Offer sort by A-Z and by amount.
 * Offer a search function too. It needs to be easy to navigate."
 *
 * The rule these are held to: navigation changes how the page is WALKED and
 * never what it claims. The headline total stays the whole ledger's, and
 * anything a search hides is counted out loud rather than silently gone.
 *
 * Every payee, institution and figure invented — the repo is public.
 */

const ACCOUNTS: Account[] = [
  {
    id: 'acc-a', name: 'Synthetic Current', type: 'current', balance: 0,
    currency: 'GBP', lastUpdated: new Date(), openingBalance: 0, isActive: true,
    institution: 'Northgate Bank',
  },
  {
    id: 'acc-b', name: 'Synthetic Card', type: 'credit', balance: 0,
    currency: 'GBP', lastUpdated: new Date(), openingBalance: 0, isActive: true,
    institution: 'Westfell Cards',
  },
];

/** Twelve months of the same figure, most recent ten days ago. */
const monthly = (
  accountId: string,
  description: string,
  amount: number,
  idPrefix: string
): Transaction[] => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => ({
    id: `${idPrefix}-${i}`,
    accountId,
    description,
    amount: -amount,
    date: new Date(now.getFullYear(), now.getMonth() - i, now.getDate() - 10),
    type: 'expense' as const,
    category: 'cat-x',
  }));
};

const LEDGER: Transaction[] = [
  ...monthly('acc-a', 'ZEBRA GYM', 40, 'z'),          // £480 a year
  ...monthly('acc-a', 'ALPHA STREAMING', 10, 'a'),    // £120 a year
  ...monthly('acc-b', 'MIDLAND WATER', 25, 'm'),      // £300 a year
];

const renderReport = (dismissals: SuggestionDismissal[] = []): void => {
  __setAppContextValue({
    accounts: ACCOUNTS,
    transactions: LEDGER,
    isLoading: false,
    suggestionDismissals: dismissals,
    suggestionDismissalsStatus: 'ready',
    dismissSuggestion: vi.fn(async () => {}),
    restoreSuggestion: vi.fn(async () => {}),
  });
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <RecurringCommitmentsReport />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/** The payee names on screen, in the order the page presents them. */
const payeeOrder = (): string[] =>
  screen.getAllByRole('link')
    .map(link => link.textContent?.trim() ?? '')
    .filter(text => LEDGER.some(row => row.description === text));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Recurring commitments — navigation', () => {
  it('sorts by annual cost first, and A–Z on request', () => {
    renderReport();

    expect(payeeOrder()).toEqual(['ZEBRA GYM', 'MIDLAND WATER', 'ALPHA STREAMING']);

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'az' } });
    expect(payeeOrder()).toEqual(['ALPHA STREAMING', 'MIDLAND WATER', 'ZEBRA GYM']);
  });

  it('groups by institution, using the account’s own institution name', () => {
    renderReport();

    // Cadence is the default grouping (handover §4).
    expect(screen.getByRole('heading', { name: /Monthly/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'institution' } });

    const northgate = screen.getByRole('heading', { name: /Northgate Bank/ });
    const westfell = screen.getByRole('heading', { name: /Westfell Cards/ });
    expect(northgate).toBeInTheDocument();
    expect(westfell).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Monthly/ })).not.toBeInTheDocument();

    // The card's one commitment sits under the card's institution.
    const band = westfell.closest('div')?.parentElement as HTMLElement;
    expect(within(band).getByText('MIDLAND WATER')).toBeInTheDocument();
  });

  it('searches payee AND account, and says what the search is hiding', () => {
    renderReport();

    fireEvent.change(screen.getByLabelText('Search recurring payments'), {
      target: { value: 'zebra' },
    });

    expect(payeeOrder()).toEqual(['ZEBRA GYM']);
    // The hidden count is named — a filtered view must never read as the
    // whole picture (batch-7 rule).
    expect(screen.getByText(/2 hidden by the search/)).toBeInTheDocument();

    // The account name is searchable too, not just the payee.
    fireEvent.change(screen.getByLabelText('Search recurring payments'), {
      target: { value: 'Synthetic Card' },
    });
    expect(payeeOrder()).toEqual(['MIDLAND WATER']);
  });

  it('a search that matches nothing names the count, the filter and the way back', () => {
    renderReport();

    fireEvent.change(screen.getByLabelText('Search recurring payments'), {
      target: { value: 'nothing at all matches this' },
    });

    expect(screen.getByText(/3 are hidden by the search/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(payeeOrder()).toHaveLength(3);
  });

  it('the headline total is the whole ledger’s, whatever the search hides', () => {
    renderReport();

    const total = screen.getByText('£900.00');
    expect(total).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search recurring payments'), {
      target: { value: 'zebra' },
    });

    // Still £900: the page's one earned total answers "how much of my year is
    // spoken for", which a search does not change.
    expect(screen.getByText('£900.00')).toBeInTheDocument();
  });

  it('a verdict stored under a payee’s OLD label still reads as confirmed', () => {
    // The owner's Green GJ case: the bank renamed the payee mid-stream, so the
    // stitched pattern's current label is the long one — but the Confirm he
    // gave was recorded against the short one.
    const now = new Date();
    const renamed: Transaction[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `old-${i}`,
        accountId: 'acc-a',
        description: 'ACME LTD',
        amount: -250,
        date: new Date(now.getFullYear(), now.getMonth() - 11 + i, 3),
        type: 'expense' as const,
        category: 'cat-maint',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `new-${i}`,
        accountId: 'acc-a',
        description: 'ACME LTD PROPERTY MAINT',
        amount: -250,
        date: new Date(now.getFullYear(), now.getMonth() - 3 + i, 3),
        type: 'expense' as const,
        category: 'cat-maint',
      })),
    ];
    __setAppContextValue({
      accounts: ACCOUNTS,
      transactions: renamed,
      isLoading: false,
      suggestionDismissals: [{
        id: 'dis-old',
        kind: 'recurring-confirmed',
        subjectKey: recurringAnswerKey('acc-a', 'out', normalisePayeeKey('ACME LTD')),
        subjectIds: [],
        dismissedAt: new Date(),
      }],
      suggestionDismissalsStatus: 'ready',
      dismissSuggestion: vi.fn(async () => {}),
      restoreSuggestion: vi.fn(async () => {}),
    });
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <ToastProvider>
            <RecurringCommitmentsReport />
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

    // One pattern, wearing its current label, and the evidence names the old.
    expect(screen.getByText('ACME LTD PROPERTY MAINT')).toBeInTheDocument();
    expect(screen.getByText(/previously labelled ‘ACME LTD’/)).toBeInTheDocument();
    // And the standing verdict is FOUND rather than offered again.
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });
});
