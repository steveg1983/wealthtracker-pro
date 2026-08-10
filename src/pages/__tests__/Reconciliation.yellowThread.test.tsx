/**
 * "This yellow is why that yellow."
 *
 * The balance bar's closing-balance affordance and the header's Finalize
 * Reconciliation button are refusing for ONE reason: the figure has not been
 * confirmed. The design says the eye should be able to follow that from one to
 * the other, which only works if they are literally the same yellow.
 *
 * So these tests are structural, not cosmetic. They do not check that either
 * control is amber-100; they check that the amber vocabulary on each is
 * EXACTLY the shared token's, which is a claim two hand-maintained class lists
 * cannot satisfy for long. Hardcode a near-miss on either side and the
 * comparison goes red before anyone has to notice the shades drifting apart on
 * screen.
 *
 * Every name and figure here is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Reconciliation from '../Reconciliation';
import {
  UNCONFIRMED_YELLOW,
  CONFIRM_BALANCE_HINT_ID,
} from '../../components/reconciliation/unconfirmedYellow';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Transaction } from '../../types';

const ACCOUNT: Account = {
  id: 'acc-thread',
  name: 'Everyday Invented',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  institution: 'Invented Bank',
  lastUpdated: new Date('2026-05-01'),
  openingBalance: 0,
  isActive: true,
  bankBalance: 40,
  bankBalanceDate: '2026-05-01',
};

const MARKED_ROW: Transaction = {
  id: 'txn-thread-1',
  accountId: ACCOUNT.id,
  date: new Date('2026-05-04'),
  amount: 40,
  description: 'Invented deposit',
  category: 'det-sundries',
  type: 'income',
  cleared: true,
  reconciled: false,
};

const openAccount = (account: Account = ACCOUNT): void => {
  __setAppContextValue({
    accounts: [account],
    transactions: [MARKED_ROW],
    updateAccount: vi.fn(),
    finalizeReconciliation: vi.fn(async () => 1),
    isLoading: false,
  });
  render(
    <MemoryRouter initialEntries={[`/reconciliation?account=${account.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          {/* The page mounts EditTransactionModal, which reads the notification
              context even while closed. */}
          <NotificationProvider>
            <Reconciliation />
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/** Every amber utility an element carries, order-insensitive. */
const amber = (el: Element): string[] =>
  el.className.split(/\s+/).filter(cls => cls.includes('amber-')).sort();

const TOKEN = UNCONFIRMED_YELLOW.split(/\s+/).filter(Boolean).sort();

const finalizeButton = (): HTMLElement =>
  screen.getByRole('button', { name: /Finalize Reconciliation/ });
const figure = (): HTMLElement => screen.getByTitle('Click to change or remove');

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Reconciliation — the yellow thread', () => {
  it('the shared token is a real treatment: border, text and wash, in both themes', () => {
    // Without this guard the comparisons below could be satisfied by emptying
    // the token — two elements agreeing that neither is yellow at all.
    const has = (pattern: RegExp): boolean => TOKEN.some(cls => pattern.test(cls));
    expect(has(/^bg-amber-/)).toBe(true);
    expect(has(/^text-amber-/)).toBe(true);
    expect(has(/^border-amber-/)).toBe(true);
    expect(has(/^dark:bg-amber-/)).toBe(true);
    expect(has(/^dark:text-amber-/)).toBe(true);
    expect(has(/^dark:border-amber-/)).toBe(true);
  });

  it('HEADLINE: the unconfirmed figure and the refusing Finalize wear the SAME yellow', () => {
    openAccount();

    expect(amber(figure())).toEqual(TOKEN);
    expect(amber(finalizeButton())).toEqual(TOKEN);
    // Said the other way round as well, because THAT is the design: not "both
    // happen to be amber" but "both are the one yellow".
    expect(amber(figure())).toEqual(amber(finalizeButton()));
    expect(finalizeButton()).toBeDisabled();
  });

  it('confirming resolves both yellows together, and opens the gate', () => {
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(amber(figure())).toEqual([]);
    expect(amber(finalizeButton())).toEqual([]);
    expect(finalizeButton()).toBeEnabled();
  });

  it('Enter in the box resolves both in one keystroke', () => {
    // The commonest path: read the statement, type the figure, press Enter.
    openAccount();
    fireEvent.click(figure());
    const box = screen.getByLabelText('Closing balance');
    fireEvent.change(box, { target: { value: '61.25' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(amber(figure())).toEqual([]);
    expect(amber(finalizeButton())).toEqual([]);
    expect(finalizeButton()).toBeEnabled();
  });

  it('editing after confirming brings both yellows back', () => {
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(amber(finalizeButton())).toEqual([]);

    fireEvent.click(figure());
    fireEvent.change(screen.getByLabelText('Closing balance'), { target: { value: '55' } });

    // The box the user is typing in is the affordance now, and it is yellow
    // again alongside Finalize — the agreement lapsed with the keystroke.
    expect(amber(screen.getByLabelText('Closing balance'))).toEqual(TOKEN);
    expect(amber(finalizeButton())).toEqual(TOKEN);
    expect(amber(screen.getByLabelText('Closing balance'))).toEqual(amber(finalizeButton()));
    expect(finalizeButton()).toBeDisabled();
  });

  it('an account with no figure at all invites one in the same yellow', () => {
    openAccount({ ...ACCOUNT, bankBalance: null, bankBalanceDate: null });

    const invitation = screen.getByRole('button', { name: 'Enter balance' });
    expect(amber(invitation)).toEqual(TOKEN);
    expect(amber(finalizeButton())).toEqual(TOKEN);
    expect(finalizeButton()).toBeDisabled();
  });

  it('the yellow is never the only signal: both controls point at the same printed reason', () => {
    openAccount();

    expect(figure()).toHaveAttribute('aria-describedby', CONFIRM_BALANCE_HINT_ID);
    expect(finalizeButton()).toHaveAttribute('aria-describedby', CONFIRM_BALANCE_HINT_ID);
    expect(document.getElementById(CONFIRM_BALANCE_HINT_ID))
      .toHaveTextContent(/Confirm the closing balance to finish/);
    // And the refusal itself is carried by the disabled attribute, not by paint.
    expect(finalizeButton()).toBeDisabled();
  });

  it('drops the description when the reason is gone, rather than dangling', () => {
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(figure()).not.toHaveAttribute('aria-describedby');
    expect(finalizeButton()).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById(CONFIRM_BALANCE_HINT_ID)).toBeNull();
  });

  it('Finalize keeps its border width in both states, so the gate opening cannot resize it', () => {
    openAccount();
    expect(finalizeButton()).toHaveClass('border');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(finalizeButton()).toHaveClass('border', 'border-transparent');
  });
});

describe('Reconciliation — Money’s word for the figure', () => {
  it('the bar labels it Closing Balance, and the reconciling screen never says Bank Balance', () => {
    openAccount();
    expect(screen.getByText('Closing Balance')).toBeInTheDocument();
    expect(screen.queryByText('Bank Balance')).not.toBeInTheDocument();
  });

  it('the finalize dialog uses the same word for the same figure', () => {
    // 40 marked against a closing balance of 100 leaves 60 to explain, which is
    // the branch of the dialog that names both figures.
    openAccount({ ...ACCOUNT, bankBalance: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: /Finalize Reconciliation/ }));

    expect(screen.getByText(/Difference between closing balance and cleared balance/))
      .toBeInTheDocument();
    expect(screen.getByText(/Closing Balance: £100\.00/)).toBeInTheDocument();
  });
});
