/**
 * The Reports pages have the same anatomy as the rest of the app.
 *
 * Every other page — Accounts, Budget, Categories, Transactions, Settings —
 * says its name in a plain heading and then stacks content cards under it.
 * Reports alone put its heading INSIDE a white bar clamped to the top of the
 * window (negative margins to escape the layout's padding, a border under it,
 * the period control sitting in it), so a user moving from Accounts to Reports
 * met what looked like a different application.
 *
 * These tests pin the convergence, on the hub AND on a report detail page —
 * they are one component, so it is one header — and pin that nothing
 * functional was traded for it: the period control still works, and the way
 * back (which work-stream C made provenance-aware) is untouched.
 *
 * Every account, category and figure below is invented: this repo is public.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { preferences } from '../../services/preferencesService';
import PageWrapper from '../../components/PageWrapper';
import Accounts from '../Accounts';
import ReportsHub from '../ReportsHub';
import type { Account, Category, Transaction } from '../../types';

/** Reports are code-split; a loaded machine needs more than the 1s default. */
const LOADS_LAZY_REPORT = { timeout: 15_000 } as const;

const PERIOD_KEYS = ['reportsPeriod', 'reportsPeriodExplicit', 'reportsPeriodCustomStart', 'reportsPeriodCustomEnd'];

const ACCOUNT: Account = {
  id: 'acc-anatomy', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
];

const TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-one', date: new Date('2026-08-15'), description: 'Synthetic shop',
    amount: -50, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
];

const renderHub = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PreferencesProvider>
        <ToastProvider>
          <Routes>
            <Route path="/reports" element={<ReportsHub />} />
            <Route path="/reports/:reportId" element={<ReportsHub />} />
          </Routes>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  for (const key of PERIOD_KEYS) preferences.removeItem(key);
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    transactionSplits: [],
  });
});

afterEach(() => {
  __resetAppContextValue();
});

/**
 * The one definition of "the app's page heading": PageWrapper's own h1. Read
 * from the component rather than copied, so this test cannot drift from it —
 * if the app's heading changes, Reports has to change with it or fail here.
 */
function appHeadingClasses(): string {
  render(<PageWrapper title="Reference">{null}</PageWrapper>);
  const heading = screen.getByRole('heading', { level: 1, name: 'Reference' });
  const classes = heading.className;
  screen.getByRole('heading', { level: 1, name: 'Reference' }).remove();
  return classes;
}

describe('the Reports heading is the app’s heading', () => {
  it('the hub says its name in a plain h1, not inside a bar of its own', () => {
    renderHub('/reports');

    const heading = screen.getByRole('heading', { level: 1, name: 'Reports' });
    expect(heading.className).toBe(appHeadingClasses());

    // The bar it used to live in: a white block that broke out of the page's
    // padding with negative margins and drew a border across the window.
    const bar = heading.closest('.bg-white');
    expect(bar).toBeNull();
    expect(heading.closest('[class*="-mx-"]')).toBeNull();
    expect(heading.closest('[class*="border-b"]')).toBeNull();
  });

  it('matches the page it is converging on, class for class', () => {
    // Accounts is the reference implementation; if these two ever disagree the
    // app has three heading styles again, which is what this is here to stop.
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <ToastProvider>
            <Accounts />
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
    const accountsHeading = screen.getByRole('heading', { level: 1, name: 'Accounts' });

    renderHub('/reports');
    const reportsHeading = screen.getByRole('heading', { level: 1, name: 'Reports' });

    expect(reportsHeading.className).toBe(accountsHeading.className);
    expect(reportsHeading.tagName).toBe(accountsHeading.tagName);
  });

  it('a report detail page gets the same heading, and keeps its subtitle', async () => {
    renderHub('/reports/spending-by-category');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    const heading = screen.getByRole('heading', { level: 1, name: 'Spending by category' });
    expect(heading.className).toBe(appHeadingClasses());
    expect(heading.closest('.bg-white')).toBeNull();
    expect(screen.getByText('What you spent on what, ranked, with the share of the total.'))
      .toBeInTheDocument();
  });

  it('trades none of the report’s own furniture for the new shape', async () => {
    // Restructuring a header is exactly the change that quietly loses the
    // things attached to it, so the report's export bar is asserted alive.
    renderHub('/reports/spending-by-category');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
  });
});

describe('the period control is a control, in a box of its own', () => {
  it('sits below the heading, in a card, and still governs the report', () => {
    renderHub('/reports');

    const group = screen.getByRole('group', { name: 'Reporting period' });
    // A content card, like everything else stacked under a page heading.
    const card = group.closest('.rounded-2xl');
    expect(card).not.toBeNull();
    expect(card?.className).toContain('bg-white');

    // Below the heading, not beside it inside the header.
    const heading = screen.getByRole('heading', { level: 1, name: 'Reports' });
    expect(heading.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.parentElement?.contains(group)).toBe(false);

    // And it is still the live control: a choice sticks and is written down.
    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');
    expect(preferences.getItem('reportsPeriod')).toBe('last-month');
  });

  it('is absent, not inert, on a report that shows no period', async () => {
    renderHub('/reports/account-distribution');
    await screen.findByRole('heading', { name: 'Where the money sits' }, LOADS_LAZY_REPORT);

    expect(screen.queryByRole('group', { name: 'Reporting period' })).not.toBeInTheDocument();
  });
});
