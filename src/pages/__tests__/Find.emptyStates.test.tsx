/**
 * FIND'S THREE KINDS OF NOTHING, and why they must never wear each other's
 * words (DESIGN_PASS §4).
 *
 * Find is the one page in the app whose MAIN empty state is a filtered one: a
 * search that hits nothing is the normal way to use it. That makes the failure
 * mode acute — a page that says "nothing matches" when the truth is "nothing
 * has loaded yet" tells the user their money is not there, and they go looking
 * somewhere else.
 *
 * So:
 *   loading    the shape of the table, never a verdict on the search;
 *   empty      no transactions exist to search, which is not the search's
 *              fault and does not blame it;
 *   filtered   they exist, this search is over them, and here is the count,
 *              the culprit and the way out.
 *
 * Every name, figure and date below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { LOADING_REVEAL_DELAY_MS } from '../../hooks/useDelayedFlag';
import Find from '../Find';
import type { Account, Transaction } from '../../types';

const ACCOUNT: Account = {
  id: 'acc-find-empty', name: 'Everyday Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const ROWS: Transaction[] = [
  {
    id: 'txn-a', description: 'Halberd Ironmongers', amount: -141.5, type: 'expense',
    accountId: ACCOUNT.id, category: '', cleared: false, date: new Date(Date.UTC(2026, 3, 1)),
  },
  {
    id: 'txn-b', description: 'Wexford Bakery', amount: -22.75, type: 'expense',
    accountId: ACCOUNT.id, category: '', cleared: false, date: new Date(Date.UTC(2026, 3, 2)),
  },
];

const openFind = (
  { transactions = ROWS, isLoading = false }: { transactions?: Transaction[]; isLoading?: boolean } = {}
): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions,
    categories: [],
    isLoading,
    getSubCategories: () => [],
    getDetailCategories: () => [],
  });
  render(
    <MemoryRouter initialEntries={['/find']}>
      <PreferencesProvider>
        <Routes>
          <Route path="/find" element={<Find />} />
          <Route path="/enhanced-import" element={<div>Import page</div>} />
          <Route path="/accounts" element={<div>Accounts page</div>} />
        </Routes>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const type = (text: string): void => {
  fireEvent.change(screen.getByLabelText('Find transactions by description or amount'), {
    target: { value: text }
  });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  __resetAppContextValue();
  vi.clearAllMocks();
});

describe('Find with nothing to search', () => {
  it('says the ledger is empty rather than blaming the search', async () => {
    openFind({ transactions: [] });

    expect(
      await screen.findByRole('heading', { level: 3, name: 'There are no transactions to search yet' })
    ).toBeInTheDocument();
    // The consequence: why every search here will come back empty.
    expect(screen.getByText(/every search here comes back empty/)).toBeInTheDocument();
    // Remedies as real controls.
    expect(screen.getByRole('button', { name: 'Import a statement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Accounts' })).toBeInTheDocument();
  });

  it('keeps saying it once a query is typed, because the query is not why', async () => {
    openFind({ transactions: [] });
    type('ironmongers');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 3, name: 'There are no transactions to search yet' })
      ).toBeInTheDocument();
    });
    // Never the filtered sentence: there is nothing behind the filter to count,
    // and "0 are hidden by Search: ironmongers" is an absurdity.
    expect(screen.queryByText(/are hidden by/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('Find emptied by the search is not Find with nothing in it', () => {
  it('names the count, the query doing it, and the way out', async () => {
    openFind();
    type('quenchless');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 3, name: 'No transactions match these filters' })
      ).toBeInTheDocument();
    });
    // THE COUNT IS THE POINT: two rows still exist, across the accounts.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/across your accounts are hidden by/)).toBeInTheDocument();
    expect(screen.getByText('Search: quenchless')).toBeInTheDocument();
  });

  it('is distinguishable from the empty state by every word that matters', async () => {
    openFind();
    type('quenchless');

    await waitFor(() => {
      expect(screen.getByText('Search: quenchless')).toBeInTheDocument();
    });
    // None of the empty state's voice may appear here: no "nothing to search",
    // and no remedy that treats the absence as the user's to fix by importing.
    expect(
      screen.queryByRole('heading', { name: 'There are no transactions to search yet' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import a statement' })).not.toBeInTheDocument();
  });

  it('gives them back when the one control is pressed', async () => {
    openFind();
    type('quenchless');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'No transactions match these filters' })).not.toBeInTheDocument();
    });
    // Back to the page's opening question, and the box is empty too — a
    // "Clear" that left the query sitting in the field would read as broken.
    expect(screen.getByRole('heading', { name: 'Find looks through every account at once' })).toBeInTheDocument();
    expect(screen.getByLabelText('Find transactions by description or amount')).toHaveValue('');
  });
});

describe('Find while the ledger is still arriving', () => {
  beforeEach(() => {
    // The shared setup has already mocked the clock with setSystemTime, and
    // faking timers over the top of that throws — hand the real clock back
    // first (the same dance useDelayedFlag.test.ts does).
    vi.useRealTimers();
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('shows NOTHING for the first 200ms — a fast load must look fast', () => {
    openFind({ transactions: [], isLoading: true });

    expect(screen.queryByRole('status', { name: 'Loading transactions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('then shows the shape of the table, and never a verdict on the search', () => {
    openFind({ transactions: [], isLoading: true });
    act(() => { vi.advanceTimersByTime(LOADING_REVEAL_DELAY_MS); });

    expect(screen.getByRole('status', { name: 'Loading transactions' })).toBeInTheDocument();
    // THE FALSE NEGATIVE THIS EXISTS TO PREVENT. Before this wiring, a query
    // typed while the rows were still loading was answered "Nothing matches" —
    // a page telling somebody their transaction is not there, about their own
    // money, when it simply had not arrived.
    expect(screen.queryByText(/No transactions match/)).not.toBeInTheDocument();
    expect(screen.queryByText(/There are no transactions to search yet/)).not.toBeInTheDocument();
  });

  it('draws the placeholder with one cell per column the real table has', () => {
    // The results table is hand-written <th>s rather than a Column[], so the
    // placeholder's geometry is the one thing here that could silently drift
    // out of step with it — and a placeholder of the wrong shape is a layout
    // shift with extra steps. Count both, in the DOM, and compare.
    openFind({ transactions: [], isLoading: true });
    act(() => { vi.advanceTimersByTime(LOADING_REVEAL_DELAY_MS); });
    const skeletonRow = screen.getByRole('status', { name: 'Loading transactions' }).firstElementChild;
    const placeholderCells = skeletonRow?.children.length ?? 0;
    cleanup();

    openFind();
    type('bakery');
    act(() => { vi.advanceTimersByTime(500); });
    const headerCells = screen.getAllByRole('columnheader').length;

    expect(placeholderCells).toBe(headerCells);
  });
});
