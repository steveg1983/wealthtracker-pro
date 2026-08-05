import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { usePeriod, resolvePeriod } from '../../../hooks/usePeriod';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import PeriodComparisonReport from '../PeriodComparisonReport';
import type { Account, Category, Transaction } from '../../../types';

/**
 * The two things this report cannot get wrong: WHICH accounts the figures
 * cover, and WHAT the comparison window is.
 *
 * The app context is the shared test double from src/test/setup.ts, given a
 * synthetic two-account history here (no real payees, amounts or account names
 * ever appear in this repo's fixtures) so the figures can be asserted exactly.
 *
 * The period is a fixed custom range wherever the figures matter, so the
 * windows do not move with the day the suite runs.
 */

const PERIOD_KEY = 'test.reportsPeriod';
const BASIS_KEY = 'reportsComparisonBasis';
/** The retired one-or-all dropdown's key — read for migration, never written. */
const LEGACY_ACCOUNT_KEY = 'reportsAccountFilter';
const ACCOUNT_IDS_KEY = 'reportsAccountFilterIds';

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Synthetic Current', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 2, 31), openingBalance: 0 },
  { id: 'acc-2', name: 'Synthetic Savings', type: 'savings', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 2, 31), openingBalance: 0 },
];

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'grp-food', name: 'Food Related Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date(2026, 2, 10),
  amount: -10,
  description: 'synthetic row',
  category: 'cat-groceries',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

/** The tax year in force today, from the one shared definition. */
const TAX_YEAR_START = resolvePeriod('tax-year', '', '').from ?? new Date();

const aYearBefore = (date: Date): Date => {
  const shifted = new Date(date);
  shifted.setFullYear(shifted.getFullYear() - 1);
  return shifted;
};

const daysBefore = (date: Date, days: number): Date => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() - days);
  return shifted;
};

const NOW = new Date();

const TRANSACTIONS: Transaction[] = [
  // March 2026 — the fixed custom window.
  txn({ id: 'i1', amount: 1000, type: 'income', category: 'grp-salary', description: 'synthetic pay' }),
  txn({ id: 'e1', amount: -100 }),
  txn({ id: 'e2', amount: -50, accountId: 'acc-2' }),
  // February 2026 — inside the equal-length window before it.
  txn({ id: 'e3', date: new Date(2026, 1, 10), amount: -60 }),

  // The tax-year story: this tax year, the same dates a year ago, and the
  // rump of the previous tax year that "Previous period" would otherwise pick
  // up. All three are outside the March window above.
  txn({ id: 't1', date: NOW, amount: 1000, type: 'income', category: 'grp-salary', description: 'synthetic tax year pay' }),
  txn({ id: 't2', date: aYearBefore(NOW), amount: -70 }),
  txn({ id: 't3', date: daysBefore(TAX_YEAR_START, 1), amount: -500 }),
];

const Harness = (): React.JSX.Element => {
  const picker = usePeriod(PERIOD_KEY, 'this-month');
  return <PeriodComparisonReport picker={picker} />;
};

const renderReport = (): ReturnType<typeof render> =>
  render(
    /* The review band and the drill-in navigate and toast, exactly as they do
       inside the real provider stack. */
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

/** A fixed window, so "the period before" is fixed too. */
const useMarch2026 = (): void => {
  localStorage.setItem(PERIOD_KEY, 'custom');
  localStorage.setItem(`${PERIOD_KEY}Explicit`, 'true');
  localStorage.setItem(`${PERIOD_KEY}CustomStart`, '2026-03-01');
  localStorage.setItem(`${PERIOD_KEY}CustomEnd`, '2026-03-31');
};

const accountTrigger = (): HTMLElement => screen.getByRole('button', { name: /^Account filter/ });

const openAccounts = (): void => fireEvent.click(accountTrigger());

const figureOf = (label: string): string =>
  screen.getByTitle(`${label} — view these transactions`).textContent?.trim() ?? '';

describe('PeriodComparisonReport — which accounts, and which comparison', () => {
  beforeEach(() => {
    localStorage.clear();
    __setAppContextValue({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: TRANSACTIONS });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  describe('the account multi-select', () => {
    beforeEach(useMarch2026);

    it('opens on every account, and says so', () => {
      renderReport();

      expect(accountTrigger()).toHaveTextContent('All accounts');
      expect(figureOf('Income')).toBe('£1,000.00');
      expect(figureOf('Expenses')).toBe('£150.00');

      openAccounts();
      expect(screen.getByRole('checkbox', { name: 'Synthetic Current' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Synthetic Savings' })).toBeChecked();
    });

    it('narrows the figures to the ticked accounts once saved, and names the only one left', () => {
      renderReport();
      openAccounts();

      // A tick is a draft: nothing outside the panel moves until Save.
      fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Savings' }));
      expect(figureOf('Expenses')).toBe('£150.00');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      // The savings account's £50 is out of the figures, and out of the label.
      expect(figureOf('Expenses')).toBe('£100.00');
      expect(figureOf('Income')).toBe('£1,000.00');
      expect(accountTrigger()).toHaveTextContent('Synthetic Current');
    });

    it('discards the draft when dismissed without saving', () => {
      renderReport();
      openAccounts();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Savings' }));
      fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Synthetic Savings' }), { key: 'Escape' });

      expect(accountTrigger()).toHaveTextContent('All accounts');
      expect(figureOf('Expenses')).toBe('£150.00');
    });

    it('counts them when more than one is ticked and fewer than all', () => {
      __setAppContextValue({
        accounts: [...ACCOUNTS, { id: 'acc-3', name: 'Synthetic Spare', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 2, 31), openingBalance: 0 }],
      });
      renderReport();
      openAccounts();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Spare' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(accountTrigger()).toHaveTextContent('2 accounts');
    });

    it('shows honest zeros when nothing is ticked, and everything again after Select all', () => {
      renderReport();
      openAccounts();

      fireEvent.click(screen.getByRole('button', { name: 'Deselect all' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(accountTrigger()).toHaveTextContent('No accounts');
      expect(figureOf('Income')).toBe('£0.00');
      expect(figureOf('Expenses')).toBe('£0.00');
      expect(screen.getAllByText('Nothing categorised in either period').length).toBeGreaterThan(0);

      openAccounts();
      fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(accountTrigger()).toHaveTextContent('All accounts');
      expect(figureOf('Expenses')).toBe('£150.00');
    });

    it('closes on Escape and on a click outside', () => {
      renderReport();

      openAccounts();
      fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Synthetic Current' }), { key: 'Escape' });
      expect(screen.queryByRole('checkbox', { name: 'Synthetic Current' })).not.toBeInTheDocument();
      expect(accountTrigger()).toHaveFocus();

      openAccounts();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('checkbox', { name: 'Synthetic Current' })).not.toBeInTheDocument();
    });

    it('remembers the selection for the next report, and retires the old key with it', () => {
      // What the dropdown this control replaced left behind.
      localStorage.setItem(LEGACY_ACCOUNT_KEY, 'all');
      const first = renderReport();
      openAccounts();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Savings' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(localStorage.getItem(ACCOUNT_IDS_KEY)).toBe('["acc-1"]');
      expect(localStorage.getItem(LEGACY_ACCOUNT_KEY)).toBeNull();

      first.unmount();
      renderReport();

      expect(accountTrigger()).toHaveTextContent('Synthetic Current');
      expect(figureOf('Expenses')).toBe('£100.00');
    });

    it('carries a choice made before every report went multi-select', () => {
      // Nothing but the retired dropdown's key: the account it named is still
      // the answer, not "every account".
      localStorage.setItem(LEGACY_ACCOUNT_KEY, 'acc-2');
      renderReport();

      expect(accountTrigger()).toHaveTextContent('Synthetic Savings');
      expect(figureOf('Expenses')).toBe('£50.00');
    });

    it('stores every account as no key at all, so a new one is included', () => {
      renderReport();
      openAccounts();

      fireEvent.click(screen.getByRole('button', { name: 'Deselect all' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(localStorage.getItem(ACCOUNT_IDS_KEY)).toBe('[]');

      openAccounts();
      fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(localStorage.getItem(ACCOUNT_IDS_KEY)).toBeNull();
    });

    it('files the accounts under the Accounts page sections', () => {
      renderReport();
      openAccounts();

      const current = screen.getByRole('group', { name: 'Current Accounts' });
      const savings = screen.getByRole('group', { name: 'Savings Accounts' });

      expect(within(current).getByRole('checkbox', { name: 'Synthetic Current' })).toBeInTheDocument();
      expect(within(savings).getByRole('checkbox', { name: 'Synthetic Savings' })).toBeInTheDocument();
      // Sections with nothing in them are not printed.
      expect(screen.queryByRole('group', { name: 'Credit Cards' })).not.toBeInTheDocument();
    });

    it('closes on Save, with the ticks applied', () => {
      renderReport();
      openAccounts();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Savings' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.queryByRole('checkbox', { name: 'Synthetic Current' })).not.toBeInTheDocument();
      expect(accountTrigger()).toHaveFocus();
      expect(figureOf('Expenses')).toBe('£100.00');
    });
  });

  describe('the comparison basis', () => {
    it('offers both windows for an ordinary period', () => {
      useMarch2026();
      renderReport();

      expect(screen.getByRole('button', { name: 'Previous period' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('columnheader', { name: 'Previous period' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Same period last year' }));

      expect(screen.getByRole('columnheader', { name: 'Same period last year' })).toBeInTheDocument();
    });

    it('compares a tax year with the same period last year, whatever was chosen before', () => {
      // The stored choice is the one the tax year cannot honour.
      localStorage.setItem(BASIS_KEY, 'previous-period');
      localStorage.setItem(PERIOD_KEY, 'tax-year');
      localStorage.setItem(`${PERIOD_KEY}Explicit`, 'true');
      renderReport();

      const previous = screen.getByRole('button', { name: 'Previous period' });
      expect(previous).toHaveAttribute('aria-disabled', 'true');
      expect(previous).toHaveAttribute('aria-pressed', 'false');
      expect(previous).toHaveAttribute('title', 'Tax year compares with the same period last year');
      expect(screen.getByRole('button', { name: 'Same period last year' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('columnheader', { name: 'Same period last year' })).toBeInTheDocument();
      expect(screen.getByText(/months before 6 April/)).toBeInTheDocument();

      // The figures follow the words: the comparison is last year's £70, not
      // the £500 sitting in the rump of the previous tax year.
      expect(screen.getByText('was £70.00')).toBeInTheDocument();
      expect(screen.queryByText('was £500.00')).not.toBeInTheDocument();

      // Pressing it changes nothing — the option is stated, not honoured.
      fireEvent.click(previous);

      expect(screen.getByRole('columnheader', { name: 'Same period last year' })).toBeInTheDocument();
      expect(screen.getByText('was £70.00')).toBeInTheDocument();
    });

    it('gives the choice back the moment the period is no longer the tax year', () => {
      localStorage.setItem(BASIS_KEY, 'previous-period');
      localStorage.setItem(PERIOD_KEY, 'tax-year');
      localStorage.setItem(`${PERIOD_KEY}Explicit`, 'true');
      const first = renderReport();

      expect(screen.getByRole('columnheader', { name: 'Same period last year' })).toBeInTheDocument();
      first.unmount();

      // The user's own choice was kept, not overwritten, while it could not apply.
      expect(localStorage.getItem(BASIS_KEY)).toBe('previous-period');

      useMarch2026();
      renderReport();

      expect(screen.getByRole('columnheader', { name: 'Previous period' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous period' })).not.toHaveAttribute('aria-disabled');
    });
  });
});
