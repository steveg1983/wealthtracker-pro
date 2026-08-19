import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Calendar from '../Calendar';

// Mock the app context
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: [
      { id: '1', date: new Date(), amount: -50, type: 'expense', description: 'Test expense', accountId: 'acc1', category: 'Food' },
      { id: '2', date: new Date(), amount: 200, type: 'income', description: 'Test income', accountId: 'acc1', category: 'Salary' },
      // No category at all: the week view must NAME this remainder rather
      // than fold it into a figure that would then claim to be complete.
      { id: '3', date: new Date(), amount: -12.5, type: 'expense', description: 'Unfiled expense', accountId: 'acc1', category: '' },
    ],
    accounts: [
      { id: 'acc1', name: 'Test Account', type: 'current', balance: 1000, openingBalance: 1000 },
    ],
    // The Income/Expenditure tiles run computeIncomeExpense, which needs both.
    transactionSplits: [],
    categories: [
      { id: 'Food', name: 'Food', type: 'expense', level: 'detail' },
      { id: 'Salary', name: 'Salary', type: 'income', level: 'detail' },
    ],
    // The forward panel reads the recurring verdicts; none here, so it shows
    // its "nothing confirmed yet" line.
    suggestionDismissals: [],
  }),
}));

// Mock currency hook
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) =>
      Number(amount) < 0
        ? `(£${Math.abs(Number(amount)).toFixed(2)})`
        : `£${Number(amount).toFixed(2)}`,
  }),
}));

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the calendar page with title', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('shows the forward panel gated on CONFIRMED patterns, with the way to confirm', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );

    // No verdicts in the mock, so the panel states its gate rather than
    // projecting the app's unconfirmed opinions onto future days (§5).
    expect(screen.getByText('Due in the next 30 days')).toBeInTheDocument();
    expect(screen.getByText(/Nothing confirmed yet/)).toBeInTheDocument();
    // Its own page under Plan since 18 Aug, not a report in the gallery.
    expect(screen.getByRole('link', { name: /What I’m committed to/ }))
      .toHaveAttribute('href', '/recurring-payments');
    expect(screen.getByRole('link', { name: 'Recurring Payments' }))
      .toHaveAttribute('href', '/recurring-payments');
  });

  it('renders day headers', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('renders month navigation', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    expect(screen.getByLabelText('Next month')).toBeInTheDocument();
  });

  it('renders month summary stats', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    // OVERRULED 18 Aug (owner): the day CELLS stay a cash-movement ledger,
    // but the month's headline tiles now speak Income/Expenditure — computed
    // through utils/incomeExpense (transfers and revaluations excluded) —
    // because a month whose "Money in" included transfers between his own
    // accounts read as earnings that never happened.
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenditure')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('navigates to previous month', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    const prevButton = screen.getByLabelText('Previous month');
    fireEvent.click(prevButton);
    // Should not crash — month display should change
  });

  it('navigates to next month', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    const nextButton = screen.getByLabelText('Next month');
    fireEvent.click(nextButton);
    // Should not crash
  });

  it('renders the calendar without ARIA grid semantics', () => {
    // role="grid" was removed deliberately: ARIA grid demands a strict
    // grid>row>gridcell tree plus arrow-key navigation, which this CSS-grid
    // month view never implemented (axe flagged aria-required-children).
    // Days with transactions are reachable buttons instead.
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Financial calendar')).toBeInTheDocument();
  });
});

/**
 * WEEK / MONTH / YEAR (owner, 19 Aug: Apple-style buttons beside Today; the
 * figures above follow whichever stretch is on screen, and the arrows step
 * by the view's own unit).
 */
describe('Calendar — the three views', () => {
  const renderCalendar = (initialPath = '/calendar') =>
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Calendar />
      </MemoryRouter>
    );

  it('offers Week, Month and Year beside Today, with Month pressed by default', () => {
    renderCalendar();

    const group = screen.getByRole('group', { name: 'Calendar view' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Year' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('week view shows the week BY CATEGORY, split income from expenditure, naming the unfiled', () => {
    renderCalendar();

    fireEvent.click(screen.getByRole('button', { name: 'Week' }));

    // The month grid is gone; the category split is here.
    expect(screen.queryByLabelText('Financial calendar')).not.toBeInTheDocument();
    const split = within(screen.getByLabelText('Week by category'));
    // Resolved categories read as the register reads them…
    expect(split.getByText('Salary')).toBeInTheDocument();
    expect(split.getByText('Food')).toBeInTheDocument();
    expect(split.getByText('+£200.00')).toBeInTheDocument();
    expect(split.getByText('(£50.00)')).toBeInTheDocument();
    // …and the unfiled remainder is NAMED, never silently folded in.
    expect(split.getByText('Uncategorised — not yet filed')).toBeInTheDocument();
    expect(split.getByText('(£12.50)')).toBeInTheDocument();

    // The arrows now step by the week.
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument();
    expect(screen.getByLabelText('Next week')).toBeInTheDocument();
  });

  it('the tiles follow the visible window — stepping back a week changes the figures', () => {
    renderCalendar('/calendar?view=week');

    // This week holds the mock's rows…
    expect(within(screen.getByLabelText('Week by category')).getByText('+£200.00')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous week'));

    // …last week holds nothing, and the split says so honestly.
    expect(screen.getByText('No income recorded this week.')).toBeInTheDocument();
    expect(screen.getByText('No expenditure recorded this week.')).toBeInTheDocument();
  });

  it('year view shows twelve months, and a month is a door into its month view', () => {
    renderCalendar();

    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getByLabelText('Year by month')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous year')).toBeInTheDocument();

    const currentYear = new Date().getFullYear();
    fireEvent.click(screen.getByRole('button', { name: `Open March ${currentYear}` }));

    // Landed in March's month view.
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(`March ${currentYear}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Financial calendar')).toBeInTheDocument();
  });

  it('the view survives a refresh — it lives in the URL', () => {
    renderCalendar('/calendar?view=year');

    expect(screen.getByRole('button', { name: 'Year' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Year by month')).toBeInTheDocument();
  });
});

/**
 * CLICKING A DAY.
 *
 * This link had never worked. It pointed at `/transactions?dateFrom=…&dateTo=…`
 * and the global list read one parameter — `?account=` — so the day the user
 * clicked was thrown away and they arrived at the whole ledger. It now goes to
 * Find, which reads a range, shows it and offers a way to clear it.
 */
describe('Calendar — a day with movement in it', () => {
  function WhereAmI(): React.JSX.Element {
    const location = useLocation();
    return <div data-testid="landed">{`${location.pathname}${location.search}`}</div>;
  }

  it('opens that day in Find, with the range on the URL', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/find" element={<WhereAmI />} />
        </Routes>
      </MemoryRouter>
    );

    // The suite pins the clock to 20 January 2025, and both seeded rows are
    // dated "now" — so today is the day with movement in it.
    fireEvent.click(screen.getByRole('button', { name: 'Day 20, 3 transactions' }));

    expect(screen.getByTestId('landed'))
      .toHaveTextContent('/find?dateFrom=2025-01-20&dateTo=2025-01-20');
  });
});
