/**
 * Arriving at a report from somewhere else — the three things that used to be
 * lost on the way.
 *
 * 1. THE PERIOD. The Dashboard's cards sit under their own period control, and
 *    clicking one opened a report on whatever window it had last stored: "This
 *    month" on the card, "All time" on the report. The window now travels with
 *    the click and is applied on arrival — and, just as importantly, is NOT
 *    written down: it is a look at something, not a change of mind about which
 *    window this page opens on.
 * 2. THE POINT. A click on a point lands on that point, highlighted, rather
 *    than at the top of a report the reader then has to search.
 * 3. THE WAY BACK. "All reports" is the right way back from the gallery and the
 *    wrong one from the Dashboard.
 *
 * Every account, category and figure below is invented: this repo is public.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { preferences } from '../../services/preferencesService';
import type { Account, Category, Transaction } from '../../types';
import ReportsHub from '../ReportsHub';

/** Reports are code-split; a loaded machine needs more than the 1s default. */
const LOADS_LAZY_REPORT = { timeout: 15_000 } as const;

const PERIOD_KEYS = ['reportsPeriod', 'reportsPeriodExplicit', 'reportsPeriodCustomStart', 'reportsPeriodCustomEnd'];

const ACCOUNT: Account = {
  id: 'acc-drill', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'det-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
];

const TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-aug', date: new Date('2026-08-15'), description: 'Synthetic shop',
    amount: -50, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-jul', date: new Date('2026-07-15'), description: 'Synthetic pay',
    amount: 1000, type: 'income', category: 'det-salary', accountId: ACCOUNT.id, cleared: false,
  },
];

/** The address bar, so a consumed arrival can be seen to have been consumed. */
function ShowLocation(): React.JSX.Element {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

const renderHub = (entry: string | { pathname: string; search?: string; state?: unknown }) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PreferencesProvider>
        <ToastProvider>
          <ShowLocation />
          <Routes>
            <Route path="/reports" element={<ReportsHub />} />
            <Route path="/reports/:reportId" element={<ReportsHub />} />
            <Route path="/dashboard" element={<h1>Dashboard</h1>} />
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

describe('a drill-down brings its own window', () => {
  it('opens on the window the card was read over, not the one this page stored', async () => {
    // The user's own standing choice for the reports hub: all time.
    preferences.setItem('reportsPeriod', 'all');
    preferences.setItem('reportsPeriodExplicit', 'true');

    renderHub('/reports/spending-by-category?period=this-month');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    // The FIRST pill assertion waits — the heading is the lazy child's first
    // paint and the pills land a render later (the sibling file's footer
    // rule). Once one pill has rendered, its neighbour has too.
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('leaves the period this page had stored exactly as the user set it', async () => {
    preferences.setItem('reportsPeriod', 'all');
    preferences.setItem('reportsPeriodExplicit', 'true');

    const view = renderHub('/reports/spending-by-category?period=this-month');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);
    view.unmount();

    // Borrowed for the visit, never written down.
    expect(preferences.getItem('reportsPeriod')).toBe('all');
  });

  it('takes the arrival out of the address bar, so the picker is back in charge', async () => {
    renderHub('/reports/spending-by-category?period=last-month&focus=det-groceries');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    expect(screen.getByTestId('where')).toHaveTextContent('/reports/spending-by-category');
    expect(screen.getByTestId('where').textContent).not.toContain('period=');
    expect(screen.getByTestId('where').textContent).not.toContain('focus=');

    // And the control still works, on the window that arrived. The first
    // pill assertion waits — same footer rule as the sibling file.
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tax year' }));
    expect(screen.getByRole('button', { name: 'Tax year' })).toHaveAttribute('aria-pressed', 'true');
    // NOW it is a choice, and it is written down.
    expect(preferences.getItem('reportsPeriod')).toBe('tax-year');
  });

  it('applies no window to a report that has none, whatever the link says', async () => {
    // Account distribution is a snapshot of today and hides the picker. A
    // period smuggled in on the URL must not move the window the NEXT report
    // opens on from a control this page does not show.
    preferences.setItem('reportsPeriod', 'all');
    preferences.setItem('reportsPeriodExplicit', 'true');

    renderHub('/reports/account-distribution?period=this-month');
    await screen.findByRole('heading', { name: 'Where the money sits' }, LOADS_LAZY_REPORT);

    expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument();
    expect(preferences.getItem('reportsPeriod')).toBe('all');
  });
});

describe('a drill-down from a point lands on that point', () => {
  it('highlights the month that was clicked, in the month-by-month table', async () => {
    renderHub('/reports/income-and-spending-over-time?period=all&focus=2026-08');
    await screen.findByRole('heading', { name: 'Income against spending' }, LOADS_LAZY_REPORT);

    const highlighted = await screen.findByRole('row', { current: true }, LOADS_LAZY_REPORT);
    expect(highlighted).toHaveTextContent('Aug 2026');
    // And only that one — a highlight on two rows points at neither.
    expect(screen.getAllByRole('row', { current: true })).toHaveLength(1);
  });

  it('highlights the category that was clicked, in the ranked table', async () => {
    renderHub('/reports/spending-by-category?period=all&focus=det-groceries');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    const highlighted = await screen.findByRole('row', { current: true }, LOADS_LAZY_REPORT);
    expect(highlighted).toHaveTextContent('Groceries');
  });

  it('opens that day’s balances on the net-worth line, which has no row to land on', async () => {
    // This report answers a point with the day's balances and nothing else, so
    // arriving on a point does what clicking the same point on the chart does.
    // A fixed custom window, so the point cadence is daily whenever this runs.
    renderHub('/reports/net-worth-over-time?period=custom&periodFrom=2026-07-01&periodTo=2026-07-31&focus=2026-07-20');
    await screen.findByRole('heading', { name: 'Net Worth Over Time' }, LOADS_LAZY_REPORT);

    expect(await screen.findByText('Balances on 20 July 2026', {}, LOADS_LAZY_REPORT)).toBeInTheDocument();
  });

  it('highlights nothing at all on an ordinary arrival', async () => {
    renderHub('/reports/income-and-spending-over-time?period=all');
    await screen.findByRole('heading', { name: 'Income against spending' }, LOADS_LAZY_REPORT);

    expect(screen.queryAllByRole('row', { current: true })).toHaveLength(0);
  });
});

describe('the way back knows where the user came from', () => {
  it('returns to the Dashboard when the Dashboard sent them', async () => {
    renderHub({
      pathname: '/reports/spending-by-category',
      state: { from: { path: '/dashboard', label: 'Back to Dashboard' } },
    });
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    const back = screen.getByRole('link', { name: 'Back to Dashboard' });
    expect(back).toHaveAttribute('href', '/dashboard');

    fireEvent.click(back);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('still says All reports when nobody said otherwise — a bookmark, a typed URL', async () => {
    renderHub('/reports/spending-by-category');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    expect(screen.getByRole('link', { name: 'All reports' })).toHaveAttribute('href', '/reports');
    expect(screen.queryByRole('link', { name: 'Back to Dashboard' })).not.toBeInTheDocument();
  });

  it('survives the arrival being consumed, which replaces the history entry', async () => {
    // The replace that strips ?period= used to be where provenance died: React
    // Router gives a replaced entry null state unless it is carried over.
    renderHub({
      pathname: '/reports/spending-by-category',
      search: '?period=this-month',
      state: { from: { path: '/dashboard', label: 'Back to Dashboard' } },
    });
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toBeInTheDocument();
  });
});
