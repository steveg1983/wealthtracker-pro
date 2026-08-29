import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import RecurringCommitmentsReport from '../RecurringCommitmentsReport';
import type { Account, Transaction } from '../../../types';

/**
 * HOW A PRICE RISE READS.
 *
 * The owner, 29 Aug 2026, on a line that said "£294.82 → £308.09 in Apr 2026
 * · +£159.24 a year": every figure in it was right — two are what one payment
 * cost either side of the rise, the third is what the rise costs over a year
 * — but nothing said the third had changed both its unit and its subject, so
 * it read as a total that reconciled with nothing beside it. His verdict was
 * "a little confusing to read", which for a line whose whole job is a price
 * rise is the only verdict that matters.
 *
 * So the rise is stated first in the unit of the figures beside it, then the
 * annual consequence follows. This file is what keeps it that way.
 *
 * Every payee and figure invented: the repo is public.
 */

const ACCOUNTS: Account[] = [
  {
    id: 'acc-a', name: 'Synthetic Current', type: 'current', balance: 0,
    currency: 'GBP', lastUpdated: new Date(), openingBalance: 0, isActive: true,
    institution: 'Northgate Bank',
  },
];

/**
 * A commitment that stepped six months ago: six payments at the old figure,
 * then six at the new one. Dated relative to now — the suite runs on a fixed
 * clock, so a hard-coded month would fall outside the detector's reach.
 */
const stepped = (
  description: string,
  before: number,
  after: number,
  idPrefix: string
): Transaction[] => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => ({
    id: `${idPrefix}-${i}`,
    accountId: 'acc-a',
    description,
    // i counts backwards from the most recent payment.
    amount: -(i < 6 ? after : before),
    date: new Date(now.getFullYear(), now.getMonth() - i, 12),
    type: 'expense' as const,
    category: 'cat-x',
  }));
};

const renderReport = (transactions: Transaction[]): void => {
  __setAppContextValue({
    accounts: ACCOUNTS,
    transactions,
    isLoading: false,
    suggestionDismissals: [],
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

/** The whole row for a payee, so a line can be read in its own context. */
const rowFor = (payee: string): HTMLElement => {
  const heading = screen.getByText(payee);
  return heading.closest('li') ?? heading.closest('div') ?? heading.parentElement!;
};

beforeEach(() => localStorage.clear());
afterEach(() => __resetAppContextValue());

describe('a price rise, as the reader meets it', () => {
  it('states the rise in the unit of the figures beside it, then the year', () => {
    // £10.99 → £12.99 a month: £2.00 more a month, £24.00 a year.
    renderReport(stepped('SYNTHETIC STREAMING', 10.99, 12.99, 's'));
    const row = rowFor('SYNTHETIC STREAMING');

    // The step itself, in months — the unit the two figures are in.
    expect(within(row).getByText(/£2\.00 a month more/)).toBeInTheDocument();
    // …and the consequence over a year, which is the decision-sized figure.
    expect(within(row).getByText(/£24\.00 a year/)).toBeInTheDocument();
  });

  it('reconciles with the annual total beside it — the same monthly figure, twelve times', () => {
    renderReport(stepped('SYNTHETIC STREAMING', 10.99, 12.99, 's'));
    const row = rowFor('SYNTHETIC STREAMING');

    // £12.99 × 12 = £155.88. The reader who multiplies what they see gets
    // what the page says, which is the whole point of the rewrite.
    expect(within(row).getByText(/£155\.88 a year/)).toBeInTheDocument();
    expect(within(row).getByText(/£12\.99 monthly/)).toBeInTheDocument();
  });

  it('says "less" when a price falls, and keeps the figures positive', () => {
    renderReport(stepped('SYNTHETIC BROADBAND', 45.00, 39.00, 'b'));
    const row = rowFor('SYNTHETIC BROADBAND');

    expect(within(row).getByText(/£6\.00 a month less/)).toBeInTheDocument();
    expect(within(row).getByText(/£72\.00 a year/)).toBeInTheDocument();
    // No minus signs in the magnitudes: the direction is carried by the word
    // and the hue, never by a sign the reader has to parse twice.
    expect(within(row).queryByText(/−£6\.00/)).not.toBeInTheDocument();
  });
});
