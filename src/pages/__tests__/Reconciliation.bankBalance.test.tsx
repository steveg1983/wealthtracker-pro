import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Reconciliation from '../Reconciliation';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { todayIsoDay } from '../../utils/statementBankBalance';
import type { Account } from '../../types';

/**
 * What the page WRITES when the closing balance is removed. The screen calls it
 * the closing balance; the field it lands in is still the account's
 * `bankBalance`, because that is where the reconciliation's figure is kept.
 *
 * The figure and the date it is true for have to go together: a
 * bank_balance_date left behind describes nothing, and statementBankBalance
 * judges an incoming statement stale against exactly that date — so a stray one
 * would go on refusing statements after the balance it belonged to was
 * withdrawn.
 */
describe('Reconciliation — removing a closing balance', () => {
  const updateAccount = vi.fn();

  const account: Account = {
    id: 'acct-recon-1',
    name: 'Everyday Account',
    type: 'current',
    balance: 250,
    currency: 'GBP',
    institution: 'Test Bank',
    lastUpdated: new Date('2025-03-01'),
    bankBalance: 220,
    bankBalanceDate: '2025-03-01'
  };

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={[`/reconciliation?account=${account.id}`]}>
        <PreferencesProvider>
          <ToastProvider>
            {/* The page opens EditTransactionModal, which reads the
                notification context even while closed. */}
            <NotificationProvider>
              <Reconciliation />
            </NotificationProvider>
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

  beforeEach(() => {
    updateAccount.mockReset();
    __setAppContextValue({ accounts: [account], transactions: [], updateAccount });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('clears the recorded date along with the balance', () => {
    renderPage();

    fireEvent.click(screen.getByTitle('Click to change or remove'));
    fireEvent.click(screen.getByRole('button', { name: /Remove the closing balance/ }));

    expect(updateAccount).toHaveBeenCalledTimes(1);
    expect(updateAccount).toHaveBeenCalledWith(account.id, {
      bankBalance: null,
      bankBalanceDate: null
    });
  });

  it('dates a typed figure today rather than leaving the old statement date on it', () => {
    renderPage();

    fireEvent.click(screen.getByTitle('Click to change or remove'));
    const input = screen.getByLabelText('Closing balance');
    fireEvent.change(input, { target: { value: '199.99' } });
    fireEvent.blur(input);

    expect(updateAccount).toHaveBeenCalledWith(account.id, {
      bankBalance: 199.99,
      bankBalanceDate: todayIsoDay()
    });
    // Not the date the account arrived carrying.
    expect(todayIsoDay()).not.toBe(account.bankBalanceDate);
  });
});
