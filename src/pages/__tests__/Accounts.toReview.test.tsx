/**
 * The Accounts list's "To Review" column.
 *
 * The owner asked for the size of the job to be visible from outside the
 * account: the three figures that were there (Bank Bal / Account Bal /
 * Unreconciled) shift left and a To Review column joins them, "showing each
 * account's unreviewed count at a glance", with "zero rendering as a quiet 0
 * like Unreconciled does".
 *
 * That last clause is why the two counters in this feature disagree about zero,
 * and the disagreement is deliberate: this is a COLUMN, and a blank cell in a
 * column of figures reads as "not known" rather than "none". The register's own
 * counter is chrome, and there absence is the message. Both are tested, in
 * their own files, so neither can be "tidied" into matching the other by
 * somebody who has only seen one.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Transaction } from '../../types';

const NATWEST: Account = {
  id: 'acc-natwest', name: 'Synthetic Natwest', type: 'current', balance: 0,
  currency: 'GBP', institution: 'Natwest', lastUpdated: new Date('2026-01-01'),
  openingBalance: 0, isActive: true,
};

const MONZO: Account = {
  id: 'acc-monzo', name: 'Synthetic Monzo', type: 'current', balance: 0,
  currency: 'GBP', institution: 'Monzo', lastUpdated: new Date('2026-01-01'),
  openingBalance: 0, isActive: true,
};

const row = (id: string, accountId: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  accountId,
  date: new Date('2026-05-04'),
  amount: -9.99,
  description: `Synthetic ${id}`,
  category: 'det-sundries',
  type: 'expense',
  // Reviewed AND reconciled unless a test says otherwise, so the Unreconciled
  // column beside this one stays out of the way of what is being measured.
  cleared: true,
  ...over,
});

const renderAccounts = () =>
  render(
    <MemoryRouter initialEntries={['/accounts']}>
      <PreferencesProvider>
        <ToastProvider>
          <Accounts />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

/**
 * The card for one account: the SMALLEST ancestor of its heading that also
 * carries the stat columns.
 *
 * Climbed rather than selected by class, so the helper does not have to know
 * the card's markup, and stopped at the FIRST ancestor that has the columns —
 * one step further up is the group, which has every other account's columns
 * too and would make every assertion below ambiguous.
 */
const card = (name: string): HTMLElement => {
  let node: HTMLElement | null = screen.getByRole('heading', { level: 3, name }).parentElement;
  while (node && within(node).queryAllByText('To Review').length === 0) {
    node = node.parentElement;
  }
  if (!node) throw new Error(`no account card carrying the stat columns for "${name}"`);
  return node;
};

/** The figure under a stat column's label, inside one account's card. */
const stat = (accountName: string, label: string): string => {
  const labelNode = within(card(accountName)).getByText(label);
  const value = labelNode.nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`"${label}" has no figure under it`);
  return value.textContent ?? '';
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Accounts list — the To Review column', () => {
  it('shows each account its own count, rolled up from the ledger', async () => {
    __setAppContextValue({
      accounts: [NATWEST, MONZO],
      transactions: [
        row('t1', NATWEST.id, { needsReview: true }),
        row('t2', NATWEST.id, { needsReview: true }),
        row('t3', NATWEST.id, { needsReview: false }),
        row('t4', MONZO.id, { needsReview: true }),
        // No flag at all — a pre-migration row. Reads as reviewed.
        row('t5', MONZO.id),
      ],
      isLoading: false,
    });

    renderAccounts();
    await screen.findByRole('heading', { level: 3, name: 'Synthetic Natwest' });

    expect(stat('Synthetic Natwest', 'To Review')).toBe('2');
    expect(stat('Synthetic Monzo', 'To Review')).toBe('1');
  });

  it('shows a quiet 0 when an account has nothing waiting', async () => {
    __setAppContextValue({
      accounts: [NATWEST],
      transactions: [row('t1', NATWEST.id, { needsReview: false })],
      isLoading: false,
    });

    renderAccounts();
    await screen.findByRole('heading', { level: 3, name: 'Synthetic Natwest' });

    // A 0, not a blank: the column beside it has said 0 the same way since the
    // page was built, and a hole in a column of figures reads as "unknown".
    expect(stat('Synthetic Natwest', 'To Review')).toBe('0');
    expect(stat('Synthetic Natwest', 'Unreconciled')).toBe('0');
  });

  it('keeps the three figures that were already there', async () => {
    // The new column took its room from the space before the buttons, not from
    // one of these. Losing a balance to gain a counter would be a bad trade.
    __setAppContextValue({
      accounts: [{ ...NATWEST, bankBalance: 250 }],
      transactions: [row('t1', NATWEST.id, { needsReview: true })],
      isLoading: false,
    });

    renderAccounts();
    await screen.findByRole('heading', { level: 3, name: 'Synthetic Natwest' });

    const columns = card('Synthetic Natwest');
    expect(within(columns).getByText('Bank Bal')).toBeInTheDocument();
    expect(within(columns).getByText('Account Bal')).toBeInTheDocument();
    expect(within(columns).getByText('Unreconciled')).toBeInTheDocument();
    expect(within(columns).getByText('To Review')).toBeInTheDocument();
  });

  it('reads quiet slate while there is work and blue when there is none — a count is not a next action (ruling A)', async () => {
    __setAppContextValue({
      accounts: [NATWEST, MONZO],
      transactions: [
        row('t1', NATWEST.id, { needsReview: true }),
        row('t2', MONZO.id, { needsReview: false }),
      ],
      isLoading: false,
    });

    renderAccounts();
    await screen.findByRole('heading', { level: 3, name: 'Synthetic Natwest' });

    const waiting = within(card('Synthetic Natwest')).getByText('To Review').nextElementSibling;
    const clear = within(card('Synthetic Monzo')).getByText('To Review').nextElementSibling;
    expect(waiting?.className).toContain('text-slate-600');
    expect(clear?.className).toContain('text-blue-600');
  });
});
