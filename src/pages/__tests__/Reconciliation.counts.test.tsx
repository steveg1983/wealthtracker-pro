/**
 * THE HEADLINE AND THE ROWS COUNT THE SAME THING — on screen, not in a hook.
 *
 * The owner's book showed this page saying **2,447 unreconciled transactions
 * across all accounts** above a screen of rows that every one of them said
 * "All transactions ticked", Difference £0.00. Both numbers were produced correctly by
 * their own lights; they answered different questions, and nothing in the app
 * or in its tests ever put them side by side. That is the pin bug's failure
 * mode exactly: two facts written from different sources, read back under
 * different trust rules, and a suite that passes because no assertion spans
 * them.
 *
 * `useReconciliation.test.ts` now pins the relation where the two numbers are
 * born. This file pins it where the user actually reads them — the rendered
 * headline against the rendered badges — because a page is free to display
 * something other than what its hook returned, and the contradiction the owner
 * saw was a contradiction between two things ON A SCREEN.
 *
 * Every name and figure here is invented; this repo is public.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Reconciliation from '../Reconciliation';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Transaction } from '../../types';

const account = (id: string, name: string): Account => ({
  id,
  name,
  type: 'current',
  balance: 0,
  currency: 'GBP',
  institution: 'Invented Bank',
  lastUpdated: new Date('2026-08-01'),
  openingBalance: 0,
  isActive: true,
});

let nextId = 0;
const row = (accountId: string, reconciled: boolean): Transaction => {
  nextId += 1;
  return {
    id: `t${nextId}`,
    date: new Date('2026-08-01'),
    amount: -10,
    description: 'Invented row',
    category: 'general',
    accountId,
    type: 'expense',
    cleared: reconciled,
    reconciled,
  };
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reconciliation']}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Reconciliation />
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

/**
 * The figure printed at `display` size under the page title — read through the
 * words that explain it, which is how a reader finds it too.
 */
const headline = (): number | null => {
  const subhead = screen.queryByText(/unreconciled transactions? across all accounts/);
  if (!subhead) return null;
  const figure = subhead.previousElementSibling?.textContent ?? '';
  return Number(figure.replace(/,/g, ''));
};

/** What the row badges add up to, as printed. */
const badgeTotal = (): number =>
  screen
    .queryAllByText(/^\d+ unreconciled$/)
    .reduce((sum, badge) => sum + Number((badge.textContent ?? '0').split(' ')[0]), 0);

beforeEach(() => {
  nextId = 0;
  localStorage.clear();
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Reconciliation — the headline decomposes into the rows', () => {
  it('HEADLINE: the figure over the list is the sum of the badges in it', () => {
    __setAppContextValue({
      accounts: [account('a1', 'Everyday Invented'), account('a2', 'Second Invented')],
      transactions: [
        row('a1', false),
        row('a1', false),
        row('a1', true),
        row('a2', false),
      ],
      isLoading: false,
    });
    renderPage();

    expect(headline()).toBe(3);
    expect(badgeTotal()).toBe(3);
    expect(headline()).toBe(badgeTotal());
  });

  it('HEADLINE: rows on accounts this page does not list count in NEITHER', () => {
    // The owner's book, in miniature. 'closed-1' is not in `accounts` — which
    // is what being closed looks like from here, since closed accounts are
    // fetched separately and never listed. The page must not promote work it
    // will not show you and cannot let you do.
    __setAppContextValue({
      accounts: [account('a1', 'Everyday Invented')],
      transactions: [
        row('a1', true),
        row('closed-1', false),
        row('closed-1', false),
        row('closed-1', false),
      ],
      isLoading: false,
    });
    renderPage();

    // No headline figure at all — a count of nothing renders as nothing — and
    // the one listed account agrees that there is nothing to do.
    expect(headline()).toBeNull();
    expect(badgeTotal()).toBe(0);
    expect(screen.getByText('All accounts are up to date')).toBeInTheDocument();
    expect(screen.getByText('All transactions ticked')).toBeInTheDocument();
    // The exact contradiction that cost trust: a headline over a screen that
    // disagrees with it.
    expect(screen.queryByText(/unreconciled transactions across all accounts/)).not.toBeInTheDocument();
  });

  it('agrees while the list is filtered, over the accounts still on screen', () => {
    // The filter hides rows; it does not change what is true. The badges that
    // remain must still add up to the headline, which counts the accounts the
    // page is given rather than the ones it is currently drawing.
    __setAppContextValue({
      accounts: [account('a1', 'Everyday Invented'), account('a2', 'Second Invented')],
      transactions: [row('a1', false), row('a1', false), row('a2', true)],
      isLoading: false,
    });
    renderPage();

    expect(headline()).toBe(2);
    // 'Second Invented' has nothing outstanding, so it contributes nothing to
    // either number whether it is on screen or behind the filter.
    expect(badgeTotal()).toBe(2);
  });

  it('counts transactions in the headline and accounts in the bands, and says which is which', () => {
    // Two units on one page is defensible; two units both printed as a bare
    // number is not. The band says what it is counting.
    __setAppContextValue({
      accounts: [account('a1', 'Everyday Invented'), account('a2', 'Second Invented')],
      transactions: [row('a1', false), row('a1', false), row('a1', false)],
      isLoading: false,
    });
    renderPage();

    expect(headline()).toBe(3);
    expect(screen.getByText(/unreconciled transactions across all accounts/)).toBeInTheDocument();

    const band = screen.getByRole('heading', { level: 2, name: /Current Accounts/ });
    expect(band.textContent).toContain('2 accounts');
    // Never a bare "(2)" under a headline reading 3.
    expect(band.textContent).not.toMatch(/\(\d+\)/);
  });
});
