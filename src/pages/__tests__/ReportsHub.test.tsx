import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import ReportsHub from '../ReportsHub';

/**
 * The gallery is the entry point to every report, so these cover the three
 * things that must never break: the groups render, choosing a report opens
 * it at its own URL, and the period the user picked follows them from one
 * report to the next.
 *
 * The app context is the shared test double from src/test/setup.ts (synthetic
 * data only — this repo is public).
 */

/**
 * Every report is code-split, so opening one waits on a real dynamic import of
 * a chart-heavy chunk. Testing Library's 1s default is the wrong budget for
 * that on a loaded machine — these tests share a runner with the rest of the
 * suite — so every wait on a report gets an explicit one. Long enough that
 * load alone cannot fail it, short enough that a report which never renders
 * still fails the run.
 */
const LOADS_LAZY_REPORT = { timeout: 15_000 } as const;

const renderHub = (initialPath = '/reports') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PreferencesProvider>
        {/* The reports' clean-up tools report through the app's toasts, as
            they do inside the real provider stack. */}
        <ToastProvider>
          <Routes>
            <Route path="/reports" element={<ReportsHub />} />
            <Route path="/reports/:reportId" element={<ReportsHub />} />
          </Routes>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

describe('ReportsHub gallery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists the reports, grouped by the question they answer', () => {
    renderHub();

    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What I have' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spending' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Custom reports' })).toBeInTheDocument();

    // Titles are matched exactly, so "Net worth" cannot be satisfied by
    // "Net worth over time".
    for (const title of [
      'Net worth',
      'Net worth over time',
      'Account balances',
      'Monthly income and expenses',
      'Spending by category',
      'Income and spending over time',
      'Spending by payee',
      'This period vs last',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // "Custom reports" names both its group and the report inside it.
    expect(screen.getAllByText('Custom reports')).toHaveLength(2);

    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
      '/reports/net-worth',
      '/reports/net-worth-over-time',
      '/reports/account-balances',
      '/reports/monthly-income-expenses',
      '/reports/spending-by-category',
      '/reports/income-and-spending-over-time',
      '/reports/spending-by-payee',
      '/reports/period-comparison',
      '/reports/custom-reports',
    ]);
  });

  it('gives every report its own URL so it can be linked to and pinned', () => {
    renderHub();

    expect(screen.getByRole('link', { name: /Account balances/ })).toHaveAttribute(
      'href',
      '/reports/account-balances'
    );
    expect(screen.getByRole('link', { name: /Spending by payee/ })).toHaveAttribute(
      'href',
      '/reports/spending-by-payee'
    );
  });

  it('opens the chosen report, and comes back to the gallery', async () => {
    renderHub();

    fireEvent.click(screen.getByRole('link', { name: /Account balances/ }));

    // The report is code-split, so it arrives after its chunk resolves.
    expect(await screen.findByRole('heading', { name: 'Balances by account' }, LOADS_LAZY_REPORT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Account balances' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'All reports' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Net worth over time/ })).toBeInTheDocument();
  });

  it('keeps the chosen period as the user moves between reports', async () => {
    renderHub();

    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('link', { name: /Account balances/ }));
    await screen.findByRole('heading', { name: 'Balances by account' }, LOADS_LAZY_REPORT);

    // Still last month — the hub owns the period, not the report.
    expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('link', { name: 'All reports' }));
    fireEvent.click(screen.getByRole('link', { name: /Net worth over time/ }));

    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );
  });

  // The report's own heading is NOT a signal that its default period has been
  // applied: the heading comes from a lazily-loaded child, and the default is
  // applied by an effect that lands a render later. Waiting on the heading and
  // then asserting the button synchronously passes on an idle machine and fails
  // under load — so every one of these waits for the button itself.
  it('opens each report on the window it is worth reading over', async () => {
    // A month of net worth is a dot, not a trend.
    renderHub('/reports/net-worth-over-time');
    await screen.findByRole('heading', { name: 'Net Worth Over Time' }, LOADS_LAZY_REPORT);
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('gives a month-by-month report a year to compare', async () => {
    renderHub('/reports/income-and-spending-over-time');
    await screen.findByRole('heading', { name: 'Income against spending' }, LOADS_LAZY_REPORT);

    await waitFor(
      () => expect(screen.getByRole('button', { name: '12 months' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );
  });

  it('leaves reports without a preference on this month', async () => {
    renderHub('/reports/spending-by-category');
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    await waitFor(
      () => expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );
  });

  it('applies the default of the report being opened, not the one just closed', async () => {
    renderHub();

    fireEvent.click(screen.getByRole('link', { name: /Net worth over time/ }));
    await screen.findByRole('heading', { name: 'Net Worth Over Time' }, LOADS_LAZY_REPORT);
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );

    fireEvent.click(screen.getByRole('link', { name: 'All reports' }));
    fireEvent.click(screen.getByRole('link', { name: /Spending by category/ }));
    await screen.findByRole('heading', { name: 'Where the money went' }, LOADS_LAZY_REPORT);

    // "All time" was never asked for, so it does not stick to the next report.
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true'),
      LOADS_LAZY_REPORT
    );
  });

  it('never overrides a period the user chose, whatever the report prefers', async () => {
    renderHub();

    fireEvent.click(screen.getByRole('button', { name: 'Tax year' }));

    fireEvent.click(screen.getByRole('link', { name: /Net worth over time/ }));
    await screen.findByRole('heading', { name: 'Net Worth Over Time' }, LOADS_LAZY_REPORT);
    expect(screen.getByRole('button', { name: 'Tax year' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('link', { name: 'All reports' }));
    fireEvent.click(screen.getByRole('link', { name: /Income and spending over time/ }));
    await screen.findByRole('heading', { name: 'Income against spending' }, LOADS_LAZY_REPORT);

    expect(screen.getByRole('button', { name: 'Tax year' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '12 months' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('remembers the choice after a reload, so no report can undo it', async () => {
    const first = renderHub();
    fireEvent.click(screen.getByRole('button', { name: 'Tax year' }));
    first.unmount();

    // A fresh visit — straight to the report with the strongest preference.
    renderHub('/reports/net-worth-over-time');
    await screen.findByRole('heading', { name: 'Net Worth Over Time' }, LOADS_LAZY_REPORT);

    expect(screen.getByRole('button', { name: 'Tax year' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('treats a custom range as a choice like any other', async () => {
    renderHub();

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Custom period start date'), {
      target: { value: '2026-01-10' },
    });

    fireEvent.click(screen.getByRole('link', { name: /Net worth over time/ }));
    await screen.findByRole('heading', { name: 'Net Worth Over Time' }, LOADS_LAZY_REPORT);

    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Custom period start date')).toHaveValue('2026-01-10');
  });

  it('sends an unknown report id back to the gallery instead of an empty frame', () => {
    renderHub('/reports/no-such-report');

    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
  });

  // Each report is code-split and only ever rendered through the hub, so this
  // is the one place a runtime error in a report view would surface.
  it.each([
    ['net-worth', 'What you own'],
    ['net-worth-over-time', 'Net Worth Over Time'],
    ['account-balances', 'Balances by account'],
    ['monthly-income-expenses', 'Top Transactions'],
    ['spending-by-category', 'Where the money went'],
    ['income-and-spending-over-time', 'Income against spending'],
    ['spending-by-payee', 'Biggest payees'],
    ['period-comparison', 'Biggest movers'],
  ])('renders the %s report', async (id, heading) => {
    renderHub(`/reports/${id}`);

    expect(await screen.findByRole('heading', { name: heading }, LOADS_LAZY_REPORT)).toBeInTheDocument();
  });

  it('hides the period picker for reports that carry their own filters', async () => {
    renderHub('/reports/custom-reports');

    expect(await screen.findByRole('heading', { level: 1, name: 'Custom reports' }, LOADS_LAZY_REPORT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Last month' })).not.toBeInTheDocument();
  });
});
