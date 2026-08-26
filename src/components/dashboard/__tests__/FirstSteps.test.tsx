import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FirstSteps from '../FirstSteps';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import { preferences } from '../../../services/preferencesService';
import type { Account, Category, Transaction } from '../../../types';

/**
 * THE FIRST-STEPS CARD DERIVES EVERY TICK AND STANDS DOWN BY ITSELF.
 *
 * The owner asked for "more of a walk through" (26 Aug); the house answer
 * is a checklist whose state is DERIVED from the ledger, never stored — a
 * stored tick can lie, a derived one cannot, and a seasoned ledger (or a
 * restored backup on a fresh browser) hides the card with no flag anywhere.
 *
 * Every figure below is invented; this repo is public.
 */

const account: Account = {
  id: 'acc-1', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date(2026, 0, 1),
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'det-food', name: 'Food', type: 'expense', level: 'detail', parentId: 'type-expense' },
];

const txn = (id: string, category: string): Transaction => ({
  id, date: new Date(2026, 1, 1), description: 'Payment ' + id, amount: -10,
  type: 'expense', accountId: 'acc-1', category,
});

const renderCard = () =>
  render(
    <MemoryRouter>
      <FirstSteps />
    </MemoryRouter>
  );

const setLedger = (over: { accounts?: Account[]; transactions?: Transaction[] }) => {
  __setAppContextValue({
    accounts: over.accounts ?? [],
    transactions: over.transactions ?? [],
    transactionSplits: [],
    categories: CATEGORIES,
  });
};

beforeEach(() => {
  preferences.removeItem('firstStepsDismissed');
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('the first-steps card', () => {
  it('walks an empty ledger from the first step, with the remedy as the link', () => {
    setLedger({});
    renderCard();
    expect(screen.getByTestId('first-steps')).toBeInTheDocument();
    // The undone step is a link to where it is done.
    expect(screen.getByRole('link', { name: 'Add your first account' }))
      .toHaveAttribute('href', '/accounts?action=add');
    expect(screen.getByRole('link', { name: 'Add or import transactions' }))
      .toHaveAttribute('href', '/import');
  });

  it('derives a tick the moment the data proves the step', () => {
    setLedger({ accounts: [account] });
    renderCard();
    // Done steps stop being links — nothing to do there any more.
    expect(screen.queryByRole('link', { name: 'Add your first account' })).toBeNull();
    expect(screen.getByText('Add your first account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add or import transactions' })).toBeInTheDocument();
  });

  it('counts an unfiled transaction against the categorise step', () => {
    setLedger({ accounts: [account], transactions: [txn('t1', 'det-food'), txn('t2', '')] });
    renderCard();
    expect(screen.getByRole('link', { name: 'Categorise them' }))
      .toHaveAttribute('href', '/categorisation');
  });

  it('stands down by itself when the ledger is under way — no stored flag', () => {
    setLedger({ accounts: [account], transactions: [txn('t1', 'det-food')] });
    renderCard();
    expect(screen.queryByTestId('first-steps')).toBeNull();
  });

  it('dismissal is a choice, stored, and honoured', () => {
    setLedger({});
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss first steps' }));
    expect(screen.queryByTestId('first-steps')).toBeNull();
    cleanup();
    renderCard();
    expect(screen.queryByTestId('first-steps')).toBeNull();
  });
});
