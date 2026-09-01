import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Categorisation from '../Categorisation';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Category, Transaction } from '../../types';

/**
 * THE THREE WAYS THROUGH, ADDRESSED (owner, 1 Sep 2026).
 *
 * Two of this page's tools are modal state and the third is a disclosure, so
 * until this ruling the only way to send somebody to one was to land them here
 * and tell them which card to press — an instruction the reader has to carry
 * across a navigation, which is precisely what a link is for. The history guide
 * on the dashboard was the surface that made it plain: seven one-line steps,
 * three of them ending in a sentence about a button.
 *
 * What these pin is the whole contract of `?open=` (utils/pageOpenLink):
 *
 *  - each value opens ITS tool and no other;
 *  - it is read ONCE, on mount — the address says how the page was opened, not
 *    what it must keep doing, so closing the thing closes it for good;
 *  - an unknown value does nothing at all, which is what a stale link from an
 *    older build, or a mistyped one, has to be worth.
 *
 * The two dialogs are stubbed: what is under test is the page's answer to an
 * address, and each modal's own behaviour is pinned where it lives.
 *
 * Every name and amount below is invented: this repo is public.
 */

vi.mock('../../components/TransferSweepModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="transfer-sweep">
        <button type="button" onClick={onClose}>Close the transfer sweep</button>
      </div>
    ) : null,
}));

vi.mock('../../components/BulkCategorizeModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="payee-sweep">
        <button type="button" onClick={onClose}>Close the payee sweep</button>
      </div>
    ) : null,
}));

const ACCOUNT: Account = {
  id: 'acc-current',
  name: 'Everyday Account',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date(2024, 0, 1),
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'sub-day', name: 'Day to day', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-food', name: 'Food shopping', type: 'expense', level: 'detail', parentId: 'sub-day' },
];

const walkChildren = (parentId?: string): Category[] =>
  CATEGORIES.filter(category => category.parentId === parentId);

/** One row still waiting, so all three ways through are on the page at once. */
const UNFILED: Transaction = {
  id: 'txn-unfiled',
  date: new Date(2024, 10, 5),
  amount: -18.4,
  description: 'Ashvale Market',
  category: '',
  accountId: ACCOUNT.id,
  type: 'expense',
};

/** Open the page at an address, the way a link from another surface does. */
const openAt = (address: string): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: [UNFILED],
    transactionSplits: [],
    categories: CATEGORIES,
    getSubCategories: walkChildren,
    getDetailCategories: walkChildren,
  });
  render(
    <MemoryRouter initialEntries={[address]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Categorisation />
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/** The filter-and-file list is a disclosure, so its filter row is the proof. */
const filterListIsOpen = (): boolean =>
  screen.queryByLabelText('What to filter by, filter 1') !== null;

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); __resetAppContextValue(); });

describe('Categorisation — the address opens the tool', () => {
  it('?open=transfers brings up the transfer sweep, and nothing else', () => {
    openAt('/categorisation?open=transfers');

    expect(screen.getByTestId('transfer-sweep')).toBeInTheDocument();
    expect(screen.queryByTestId('payee-sweep')).not.toBeInTheDocument();
    expect(filterListIsOpen()).toBe(false);
  });

  it('?open=payees brings up the payee sweep, and nothing else', () => {
    openAt('/categorisation?open=payees');

    expect(screen.getByTestId('payee-sweep')).toBeInTheDocument();
    expect(screen.queryByTestId('transfer-sweep')).not.toBeInTheDocument();
    expect(filterListIsOpen()).toBe(false);
  });

  it('?open=file reveals the filter-and-file list where it stands', () => {
    openAt('/categorisation?open=file');

    expect(filterListIsOpen()).toBe(true);
    // The card that reveals it says so too — the disclosure and its control
    // cannot disagree about whether the list is showing.
    expect(screen.getByRole('button', { name: /^Filter and file/ }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByTestId('transfer-sweep')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payee-sweep')).not.toBeInTheDocument();
  });
});

describe('Categorisation — how the page was opened, not a standing instruction', () => {
  it('lets the reader close what the address opened, and it stays closed', () => {
    openAt('/categorisation?open=transfers');

    fireEvent.click(screen.getByRole('button', { name: 'Close the transfer sweep' }));

    // The parameter is still in the address; a value re-read on every render
    // would put the dialog straight back in the reader's face.
    expect(screen.queryByTestId('transfer-sweep')).not.toBeInTheDocument();
  });

  it('lets the reader hide the list the address revealed', () => {
    openAt('/categorisation?open=file');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));

    expect(filterListIsOpen()).toBe(false);
  });
});

describe('Categorisation — an unknown ask does nothing', () => {
  it('opens nothing for a value this build has never heard of', () => {
    // A link from an older build, or a typed address: the page it lands on is
    // an ordinary visit, never an error and never a guess at what was meant.
    openAt('/categorisation?open=something-else');

    expect(screen.queryByTestId('transfer-sweep')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payee-sweep')).not.toBeInTheDocument();
    expect(filterListIsOpen()).toBe(false);
    // …and the page is fully itself, with all three ways through offered.
    expect(screen.getByRole('button', { name: /^Match transfers/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Categorise by payee/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filter and file/ })).toBeInTheDocument();
  });

  it('opens nothing on an ordinary visit', () => {
    openAt('/categorisation');

    expect(screen.queryByTestId('transfer-sweep')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payee-sweep')).not.toBeInTheDocument();
    expect(filterListIsOpen()).toBe(false);
  });
});
