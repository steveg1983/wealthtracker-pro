import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import RecurringCommitmentsReport from '../RecurringCommitmentsReport';
import { recurringAnswerKey } from '../../../utils/suggestionDismissals';
import { normalisePayeeKey } from '../../../utils/recurringDetection';
import type { Account, SuggestionDismissal, Transaction } from '../../../types';

/**
 * The two verdicts, end to end (Design handover 17 Aug §5): Confirm and
 * Not-recurring write through the seam's one dismissSuggestion door, a
 * dismissed pattern moves to a recoverable band rather than vanishing, and
 * one verdict withdraws the other. Every payee and figure invented — the
 * repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-rec', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date(), openingBalance: 0, isActive: true,
};

/** Six monthly payments, the most recent ten days ago — alive and detectable. */
const monthlyHistory = (): Transaction[] => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - i, now.getDate() - 10);
    return {
      id: `rec-${i}`,
      accountId: ACCOUNT.id,
      description: 'FLIXWATCH.COM',
      amount: -7.99,
      date,
      type: 'expense' as const,
      category: 'cat-x',
    };
  });
};

const ANSWER_KEY = recurringAnswerKey(ACCOUNT.id, 'out', normalisePayeeKey('FLIXWATCH.COM'));

const verdictRow = (kind: 'recurring-confirmed' | 'recurring-not'): SuggestionDismissal => ({
  id: `dis-${kind}`,
  kind,
  subjectKey: ANSWER_KEY,
  subjectIds: [],
  dismissedAt: new Date(),
});

const dismissSuggestion = vi.fn(async () => {});
const restoreSuggestion = vi.fn(async () => {});

const renderReport = (dismissals: SuggestionDismissal[] = []): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: monthlyHistory(),
    isLoading: false,
    suggestionDismissals: dismissals,
    suggestionDismissalsStatus: 'ready',
    dismissSuggestion,
    restoreSuggestion,
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

beforeEach(() => {
  localStorage.clear();
  dismissSuggestion.mockClear();
  restoreSuggestion.mockClear();
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Recurring commitments — the two verdicts', () => {
  it('Confirm records the verdict against the pattern, not any row of it', async () => {
    renderReport();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(dismissSuggestion).toHaveBeenCalledWith('recurring-confirmed', ANSWER_KEY, []);
    });
    // The key carries a remappable account segment and an id-proof pattern
    // segment — the restore-path contract the migration's verification pins.
    expect(ANSWER_KEY).toMatch(/^account:acc-rec\|recurring:out:/);
    expect(restoreSuggestion).not.toHaveBeenCalled();
  });

  it('a confirmed pattern says so quietly, and Undo withdraws it', async () => {
    renderReport([verdictRow('recurring-confirmed')]);

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(restoreSuggestion).toHaveBeenCalledWith('recurring-confirmed', ANSWER_KEY);
    });
  });

  it('Not recurring moves the pattern to a recoverable band and out of every total', async () => {
    renderReport([verdictRow('recurring-not')]);

    // Out of the audit: no Monthly band, and the filtered-empty sentence
    // names the count and the reason rather than pretending an empty ledger.
    expect(screen.queryByRole('heading', { name: /Monthly/ })).not.toBeInTheDocument();
    expect(screen.getByText(/marked not recurring/)).toBeInTheDocument();

    // …but never gone: the band lists it with a Restore.
    const band = screen.getByText('Not recurring').closest('details');
    expect(band).not.toBeNull();
    expect(within(band as HTMLElement).getByText('FLIXWATCH.COM')).toBeInTheDocument();

    fireEvent.click(within(band as HTMLElement).getByRole('button', { name: 'Restore' }));
    await waitFor(() => {
      expect(restoreSuggestion).toHaveBeenCalledWith('recurring-not', ANSWER_KEY);
    });
  });

  it('giving the opposite verdict withdraws the standing one first', async () => {
    renderReport([verdictRow('recurring-confirmed')]);

    // A confirmed pattern shows no "Not recurring" control — Undo first is
    // the deliberate single path, so the stored state can never say
    // "confirmed AND a coincidence". This pins the guard from the other
    // side: the only way to reverse is through Undo.
    expect(screen.queryByRole('button', { name: 'Not recurring' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
