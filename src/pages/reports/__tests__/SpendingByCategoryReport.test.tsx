import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { usePeriod } from '../../../hooks/usePeriod';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import SpendingByCategoryReport from '../SpendingByCategoryReport';
import type { Account, Category, Transaction } from '../../../types';

/**
 * The account multi-select on a spending report: ticking accounts off has to
 * move the FIGURES, not just the label — every category total, every share and
 * the period's own total.
 *
 * The app context is the shared test double from src/test/setup.ts, given a
 * synthetic three-account history here (no real payees, amounts or account
 * names ever appear in this repo's fixtures) so the figures can be asserted
 * exactly, over a fixed window so they do not move with the day the suite runs.
 */

const PERIOD_KEY = 'test.reportsPeriod';
const ACCOUNT_IDS_KEY = 'reportsAccountFilterIds';

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Synthetic Current', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 2, 31), openingBalance: 0 },
  { id: 'acc-2', name: 'Synthetic Savings', type: 'savings', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 2, 31), openingBalance: 0 },
  { id: 'acc-3', name: 'Synthetic Card', type: 'credit', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 2, 31), openingBalance: 0 },
];

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food Related Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'grp-travel', name: 'Travel Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'cat-fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'grp-travel' },
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

/** One category spread across two accounts, one confined to a third. */
const TRANSACTIONS: Transaction[] = [
  txn({ id: 'e1', amount: -100 }),
  txn({ id: 'e2', amount: -50, accountId: 'acc-2' }),
  txn({ id: 'e3', amount: -30, accountId: 'acc-3', category: 'cat-fuel' }),
];

const Harness = (): React.JSX.Element => {
  const picker = usePeriod(PERIOD_KEY, 'this-month');
  return <SpendingByCategoryReport picker={picker} />;
};

const renderReport = (): void => {
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
};

/** A fixed window, so the fixture is always the whole period. */
const useMarch2026 = (): void => {
  localStorage.setItem(PERIOD_KEY, 'custom');
  localStorage.setItem(`${PERIOD_KEY}Explicit`, 'true');
  localStorage.setItem(`${PERIOD_KEY}CustomStart`, '2026-03-01');
  localStorage.setItem(`${PERIOD_KEY}CustomEnd`, '2026-03-31');
};

const accountTrigger = (): HTMLElement => screen.getByRole('button', { name: /^Account filter/ });

const openAccounts = (): void => fireEvent.click(accountTrigger());

/** Every category row, and the Total listed footer, as they read on screen. */
const tableLines = (): string[][] =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(row => [
      within(row).getByRole('rowheader').textContent?.trim() ?? '',
      ...within(row).getAllByRole('cell').map(cell => cell.textContent?.trim() ?? ''),
    ]);

describe('SpendingByCategoryReport — the accounts the spending is read over', () => {
  beforeEach(() => {
    localStorage.clear();
    useMarch2026();
    __setAppContextValue({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: TRANSACTIONS });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('opens on every account, and totals all three', () => {
    renderReport();

    expect(accountTrigger()).toHaveTextContent('All accounts');
    expect(tableLines()).toEqual([
      ['Groceries', '2', '83.3%', '£150.00'],
      ['Fuel', '1', '16.7%', '£30.00'],
      ['Total listed', '', '', '£180.00'],
    ]);
    // Nothing netted away, so the rows ARE the period's spending.
    expect(screen.queryByText(/Total spending for the period is/)).not.toBeInTheDocument();
  });

  it('narrows every figure to the ticked accounts once saved', () => {
    renderReport();
    openAccounts();

    // Ticks are a draft until Save — the report must not move underneath.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Savings' }));
    expect(accountTrigger()).toHaveTextContent('All accounts');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(accountTrigger()).toHaveTextContent('2 accounts');
    expect(tableLines()).toEqual([
      ['Groceries', '1', '76.9%', '£100.00'],
      ['Fuel', '1', '23.1%', '£30.00'],
      ['Total listed', '', '', '£130.00'],
    ]);
  });

  it('drops a category entirely when the only account it was spent from goes', () => {
    renderReport();
    openAccounts();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(tableLines()).toEqual([
      ['Groceries', '2', '100.0%', '£150.00'],
      ['Total listed', '', '', '£150.00'],
    ]);
    expect(screen.queryByRole('rowheader', { name: 'Fuel' })).not.toBeInTheDocument();
  });

  it('files the accounts under the Accounts page sections', () => {
    renderReport();
    openAccounts();

    expect(
      within(screen.getByRole('group', { name: 'Current Accounts' }))
        .getByRole('checkbox', { name: 'Synthetic Current' })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Savings Accounts' }))
        .getByRole('checkbox', { name: 'Synthetic Savings' })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Credit Cards' }))
        .getByRole('checkbox', { name: 'Synthetic Card' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Loans' })).not.toBeInTheDocument();
  });

  it('opens on the subset another report was left showing', () => {
    // The gallery shares one answer to "which money" across every report.
    localStorage.setItem(ACCOUNT_IDS_KEY, '["acc-1"]');
    renderReport();

    expect(accountTrigger()).toHaveTextContent('Synthetic Current');
    expect(tableLines()).toEqual([
      ['Groceries', '1', '100.0%', '£100.00'],
      ['Total listed', '', '', '£100.00'],
    ]);
  });

  it('shows honest zeros when no account is ticked', () => {
    renderReport();
    openAccounts();

    fireEvent.click(screen.getByRole('button', { name: 'Deselect all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(accountTrigger()).toHaveTextContent('No accounts');
    expect(screen.getAllByText('No categorised spending in this period').length).toBeGreaterThan(0);
  });
});

describe('the ring stands down when the fold would dominate it (Design, 24 Aug §2)', () => {
  // Seven near-equal categories: the cap would show four and fold three, and
  // the fold would outweigh the largest named slice — spread, not
  // concentrated. Every figure is invented; the repo is public.
  const SPREAD_CATEGORIES: Category[] = [
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `cat-s${i}`,
      name: `Synthetic Category ${i}`,
      type: 'expense' as const,
      level: 'detail' as const,
      parentId: 'type-expense',
    })),
  ];
  const spreadTxns: Transaction[] = Array.from({ length: 7 }, (_, i) =>
    txn({ id: `s${i}`, amount: -10, category: `cat-s${i}` })
  );

  beforeEach(() => {
    localStorage.clear();
    useMarch2026();
  });
  afterEach(() => __resetAppContextValue());

  it('says the shape of the data instead of drawing one enormous quiet wedge', () => {
    __setAppContextValue({ accounts: ACCOUNTS, categories: SPREAD_CATEGORIES, transactions: spreadTxns, transactionSplits: [] });
    renderReport();
    const note = screen.getByTestId('spending-spread-note');
    expect(note.textContent).toContain('spread across 7 categories');
    expect(note.textContent).toContain('14.3%');
    expect(document.querySelector('.recharts-responsive-container')).toBeNull();
    // The subtitle stops promising slices that are not there.
    expect(screen.queryByText(/click a slice/)).toBeNull();
  });

  it('keeps the ring for genuinely concentrated spending', () => {
    const concentrated = [
      txn({ id: 'big', amount: -100, category: 'cat-s0' }),
      ...Array.from({ length: 6 }, (_, i) => txn({ id: `small${i}`, amount: -5, category: `cat-s${i + 1}` })),
    ];
    __setAppContextValue({ accounts: ACCOUNTS, categories: SPREAD_CATEGORIES, transactions: concentrated, transactionSplits: [] });
    renderReport();
    expect(screen.queryByTestId('spending-spread-note')).toBeNull();
    expect(document.querySelector('.recharts-responsive-container')).not.toBeNull();
  });
});
