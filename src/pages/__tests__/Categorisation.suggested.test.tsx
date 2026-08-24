import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Categorisation from '../Categorisation';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Category, Transaction } from '../../types';

/**
 * The bulk half of confirm-or-edit, on the page where the owner said he does
 * bulk work: "the individual can then either do it individually or go to the
 * categorisation page and do it in a bit more bulk there."
 *
 * Suggestions are grouped BY CATEGORY rather than offered as one "confirm
 * everything" button. A group is the smallest thing that can honestly be judged
 * at a glance; a blanket confirm would relabel every guess as a decision in one
 * click and put the user straight back to not knowing what he had checked.
 */
describe('Categorisation — suggested categories', () => {
  const confirmTransactionCategories = vi.fn(async () => 3);

  const account: Account = {
    id: 'acct-1',
    name: 'Everyday Account',
    type: 'current',
    balance: 0,
    currency: 'GBP',
    lastUpdated: new Date('2026-01-01')
  };

  const categories: Category[] = [
    { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
    { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
    { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
    { id: 'det-dining', name: 'Dining out', type: 'expense', level: 'detail', parentId: 'sub-food' }
  ];

  const txn = (
    id: string,
    category: string,
    categoryConfirmed: boolean | undefined
  ): Transaction => ({
    id,
    date: new Date('2026-02-01'),
    description: `Payment ${id}`,
    amount: -10,
    type: 'expense',
    accountId: 'acct-1',
    category,
    ...(categoryConfirmed === undefined ? {} : { categoryConfirmed })
  }) as Transaction;

  const renderPage = () =>
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <ToastProvider>
            <NotificationProvider>
              <Categorisation />
            </NotificationProvider>
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

  beforeEach(() => {
    confirmTransactionCategories.mockClear();
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('gathers suggestions by category, biggest group first, and counts them', () => {
    __setAppContextValue({
      accounts: [account],
      categories,
      transactionSplits: [],
      transactions: [
        txn('a', 'det-groceries', false),
        txn('b', 'det-groceries', false),
        txn('c', 'det-groceries', false),
        txn('d', 'det-dining', false),
        // Neither of these is outstanding: one the user chose, one has no
        // category at all (a different chore, counted separately above).
        txn('e', 'det-dining', true),
        txn('f', '', undefined)
      ],
      confirmTransactionCategories
    });

    renderPage();

    expect(screen.getByText('Suggested categories (4)')).toBeInTheDocument();
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
    expect(screen.getByText('1 transaction')).toBeInTheDocument();
  });

  it('confirms a whole category group in one call', async () => {
    __setAppContextValue({
      accounts: [account],
      categories,
      transactionSplits: [],
      transactions: [
        txn('a', 'det-groceries', false),
        txn('b', 'det-groceries', false),
        txn('c', 'det-dining', false)
      ],
      confirmTransactionCategories
    });

    renderPage();

    // Two groups, so two buttons; the first is the biggest (Groceries).
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirm these' })[0]);

    await waitFor(() => {
      expect(confirmTransactionCategories).toHaveBeenCalledWith(['a', 'b']);
    });
  });

  it('says nothing at all when every category is the user\'s own', () => {
    __setAppContextValue({
      accounts: [account],
      categories,
      transactionSplits: [],
      transactions: [
        txn('a', 'det-groceries', true),
        // No flag: a row from a database without the migration, or the local
        // store. Reads as confirmed — badging these would accuse the user's own
        // history of being guesswork.
        txn('b', 'det-dining', undefined)
      ],
      confirmTransactionCategories
    });

    renderPage();

    expect(screen.queryByText(/Suggested categories/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm these' })).not.toBeInTheDocument();
  });

  it('offers no blanket "confirm everything" button', () => {
    __setAppContextValue({
      accounts: [account],
      categories,
      transactionSplits: [],
      transactions: [txn('a', 'det-groceries', false), txn('b', 'det-dining', false)],
      confirmTransactionCategories
    });

    renderPage();

    expect(screen.queryByRole('button', { name: /confirm all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm everything/i })).not.toBeInTheDocument();
  });

  describe('the two views — by category, and by account (owner, 24 Aug)', () => {
    const second: Account = {
      id: 'acct-2',
      name: 'Second Account',
      type: 'current',
      balance: 0,
      currency: 'GBP',
      lastUpdated: new Date('2026-01-01')
    };
    const at = (id: string, accountId: string, category: string): Transaction => ({
      ...txn(id, category, false),
      accountId
    }) as Transaction;

    const givenTwoAccounts = (): void => {
      __setAppContextValue({
        accounts: [account, second],
        categories,
        transactionSplits: [],
        transactions: [
          at('a', 'acct-1', 'det-groceries'),
          at('b', 'acct-1', 'det-groceries'),
          at('c', 'acct-1', 'det-dining'),
          at('d', 'acct-2', 'det-groceries')
        ],
        confirmTransactionCategories
      });
    };

    it('opens on the category view, where a guess is judged against its category', () => {
      givenTwoAccounts();
      renderPage();
      expect(screen.getByRole('button', { name: 'By category' })).toHaveAttribute('aria-pressed', 'true');
      // Groceries across BOTH accounts is one group of three here.
      expect(screen.getByText('3 transactions')).toBeInTheDocument();
      expect(screen.queryByText('Everyday Account')).toBeNull();
    });

    it('shows each account with its own category groups when asked', () => {
      givenTwoAccounts();
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'By account' }));

      expect(screen.getByText('Everyday Account')).toBeInTheDocument();
      expect(screen.getByText('Second Account')).toBeInTheDocument();
      // Worst account first, and its own split: 2 groceries + 1 dining.
      expect(screen.getByText('3 suggested')).toBeInTheDocument();
      expect(screen.getByText('1 suggested')).toBeInTheDocument();
      // Groceries is no longer ONE group of three — it is per account.
      expect(screen.queryByText('3 transactions')).toBeNull();
    });

    it('confirms only the account it was asked about', async () => {
      givenTwoAccounts();
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'By account' }));

      const confirms = screen.getAllByRole('button', { name: 'Confirm these' });
      fireEvent.click(confirms[0]);

      await waitFor(() => expect(confirmTransactionCategories).toHaveBeenCalled());
      // The first group is Everyday Account's groceries — two rows, not the
      // three that share the category across both accounts.
      expect(confirmTransactionCategories).toHaveBeenCalledWith(['a', 'b']);
    });

    it('confirming is optional bookkeeping, so no button on this page wears amber', () => {
      givenTwoAccounts();
      const { container } = renderPage();
      // Design's ruling, 24 Aug §1a: seven amber buttons in a column was the
      // most amber the app had ever shown at once, and amber is "this one,
      // next" — singular.
      for (const button of screen.getAllByRole('button', { name: 'Confirm these' })) {
        expect(button.className).not.toMatch(/amber/);
      }
      expect(container.querySelectorAll('[class*="amber"]')).toHaveLength(0);
    });
  });
});
