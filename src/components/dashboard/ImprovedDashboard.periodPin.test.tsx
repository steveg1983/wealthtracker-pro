/**
 * THE DASHBOARD'S ONE CLOCK, AND ITS ONE STATED EXCEPTION.
 *
 * ImprovedDashboard.test.tsx holds the rule: one period control under the
 * heading, everything below it obeying, the storage key unmoved. Every one of
 * those assertions still passes untouched, and this file is deliberately
 * separate so that stays visible in a diff.
 *
 * What is added here is the amendment the owner asked for after living with the
 * rule: all-time net worth forced all-time income-vs-expenses, and a stock and
 * a flow are different lenses. So a card may be PINNED to a window of its own —
 * and because the crime the original ruling was written against was UNDECLARED
 * scope rather than divergence, a pinned card says so on its face, holds when
 * the page moves, blinks once to show it held on purpose, and hands itself back
 * in one tap.
 *
 * The Performance card is exercised through the REAL control; the three report
 * cards stand in for their windows, as they do in the sibling file, so which
 * card followed and which held is readable. The report cards' own declaration
 * is pinned where those cards live —
 * reportWidgets/DashboardReportWidgets.test.tsx.
 *
 * Every account name and figure here is invented.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ImprovedDashboard } from './ImprovedDashboard';
import { preferences } from '../../services/preferencesService';
import type { Account, Transaction } from '../../types';
import type { BankConnection } from '../../services/bankConnectionService';
import type { PeriodRange, UsePeriodResult } from '../../hooks/usePeriod';

const USER_ID = 'user_testonly_0002';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    transactionSplits: [],
    budgets: [],
    categories: [],
    // Listed inline by the report picker; see ImprovedDashboard.test.tsx.
    customReports: [],
    serverBalances: new Map<string, { balance: number; txnCount: number }>(),
    isLoading: false,
  },
  connections: [] as BankConnection[],
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: USER_ID, isSignedIn: true, getToken: vi.fn(), signOut: vi.fn() }),
  useUser: () => ({ user: null, isLoaded: true }),
  useSession: () => ({ session: null }),
}));

vi.mock('../../contexts/AppContextSupabase', () => ({ useApp: () => mocks.app }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
  }),
}));

vi.mock('../../hooks/useBankConnectionSnapshot', () => ({
  useBankConnectionSnapshot: () => mocks.connections,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ pathname: '/dashboard', search: '', hash: '', state: null, key: 'test' }),
  };
});

/** The window a card was handed, in a form a test can read at a glance. */
const describeRange = (range: PeriodRange): string =>
  `${range.from ? range.from.toISOString().slice(0, 10) : 'none'}..${range.to ? range.to.toISOString().slice(0, 10) : 'none'}`;

vi.mock('./reportWidgets/DashboardReportWidgets', () => ({
  NetWorthWidget: ({ picker }: { picker: UsePeriodResult }) => (
    <div data-testid="net-worth-widget">{describeRange(picker.range)}</div>
  ),
  IncomeExpenseTrendWidget: ({ picker }: { picker: UsePeriodResult }) => (
    <div data-testid="income-expense-widget">{describeRange(picker.range)}</div>
  ),
  ExpenseCategoriesWidget: ({ picker }: { picker: UsePeriodResult }) => (
    <div data-testid="expense-categories-widget">{describeRange(picker.range)}</div>
  ),
  CustomReportWidget: () => <div data-testid="custom-report-widget" />,
}));

vi.mock('../charts/DashboardCharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: () => <div data-testid="pie-chart" />,
  BarChart: () => <div data-testid="bar-chart" />,
}));

vi.mock('../EditTransactionModal', () => ({ default: () => null }));
vi.mock('../IncomeExpenseBreakdownModal', () => ({ default: () => null }));
vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const account = (over: Partial<Account> & { id: string; name: string }): Account => ({
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-05-01T00:00:00.000Z'),
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  // The preferences service is a module singleton and holds its document in
  // memory, so clearing the browser mirror alone would leave one test's pin
  // visible to the next. `detach` is the app's own "forget whose settings these
  // are" and is exactly the reset wanted here.
  preferences.detach();
  mocks.navigate.mockReset();
  mocks.app.accounts = [account({ id: 'acc-a', name: 'Feed Account A', openingBalance: 100 })];
  mocks.app.transactions = [];
  mocks.app.isLoading = false;
  mocks.connections = [];
  localStorage.setItem('dashboardPinnedReports', JSON.stringify(['net-worth', 'expense-categories']));
});

const periodBar = (): HTMLElement => screen.getByRole('group', { name: 'Period for this dashboard' });
const performanceCard = (): HTMLElement => screen.getByRole('region', { name: 'Performance' });

/** Pin the Performance card through the control a user would actually use. */
const pinPerformanceTo = (label: string): void => {
  fireEvent.click(within(performanceCard()).getByRole('button', {
    name: 'Performance: period follows the page. Pin this card to its own period',
  }));
  const menu = screen.getByRole('menu', { name: 'Window for Performance' });
  fireEvent.click(within(menu).getByRole('menuitemradio', { name: label }));
};

/**
 * Send the Performance card back to the page bar the way a user does now: the
 * menu's first entry. The separate "Follow page" button it replaced only ever
 * appeared once the card was ALREADY pinned, so the menu — the thing you open
 * to choose a window — never listed the state most cards are in.
 */
const releasePerformance = (from: string): void => {
  fireEvent.click(within(performanceCard()).getByRole('button', {
    name: `Performance: pinned to ${from}. Choose a different period for this card`,
  }));
  fireEvent.click(within(screen.getByRole('menu', { name: 'Window for Performance' }))
    .getByRole('menuitemradio', { name: 'Default' }));
};

describe('a card that has not been pinned', () => {
  it('shows no declaration and no new chrome — it is the page’s card', () => {
    render(<ImprovedDashboard />);

    // The whole point of P1: at rest an obedient card says nothing a page-level
    // bar is not already saying for it.
    expect(screen.queryByText(/^pinned ·/)).toBeNull();
    expect(screen.queryByRole('button', { name: /follow the page period/ })).toBeNull();
    // The window it is on is still named, exactly as before.
    expect(within(performanceCard()).getByText('12 months')).toBeInTheDocument();
  });

  it('writes nothing, so a dashboard with no pins is the dashboard it always was', () => {
    render(<ImprovedDashboard />);

    fireEvent.click(within(periodBar()).getByRole('button', { name: 'All time' }));

    expect(localStorage.getItem('dashboardReports')).toBe('all');
    expect(localStorage.getItem('dashboardReports.pin.performancePinned')).toBeNull();
    expect(localStorage.getItem('dashboardReports.pin.net-worthPinned')).toBeNull();
    expect(localStorage.getItem('dashboardReports.pin.income-expense-trendPinned')).toBeNull();
    expect(localStorage.getItem('dashboardReports.pin.expense-categoriesPinned')).toBeNull();
  });
});

describe('pinning a card to a window of its own', () => {
  it('declares the divergence in words, and drops the bare window name', () => {
    render(<ImprovedDashboard />);

    pinPerformanceTo('All time');

    // The declaration, in the label voice and in the card's resting state —
    // a scope you have to hover to discover is not declared.
    expect(within(performanceCard()).getByText('pinned · All time')).toBeInTheDocument();
    // …and it REPLACES the plain window name rather than sitting beside it:
    // the same words in the same place would no longer mean the same thing.
    expect(within(performanceCard()).queryByText('All time')).toBeNull();
  });

  it('holds when the page clock moves, while its unpinned siblings follow', () => {
    render(<ImprovedDashboard />);
    pinPerformanceTo('All time');

    fireEvent.click(within(periodBar()).getByRole('button', { name: 'Last month' }));

    // The page moved…
    expect(within(periodBar()).getByRole('button', { name: 'Last month' }))
      .toHaveAttribute('aria-pressed', 'true');
    const lastMonth = screen.getByTestId('net-worth-widget').textContent;
    expect(lastMonth).not.toBe('none..none');
    expect(screen.getByTestId('expense-categories-widget').textContent).toBe(lastMonth);
    // …and the pinned card did not, and still says why.
    expect(within(performanceCard()).getByText('pinned · All time')).toBeInTheDocument();
  });

  it('never unpins itself because the page moved', () => {
    render(<ImprovedDashboard />);
    pinPerformanceTo('Tax year');

    fireEvent.click(within(periodBar()).getByRole('button', { name: 'This month' }));
    fireEvent.click(within(periodBar()).getByRole('button', { name: 'All time' }));

    expect(within(performanceCard()).getByText('pinned · Tax year')).toBeInTheDocument();
  });

  /**
   * A pinned card sitting perfectly still while the whole page moves around it
   * is, at a glance, indistinguishable from a card that is broken. So the
   * marker blinks once — quiet, no colour, no movement — and clears itself when
   * the animation ends.
   */
  it('acknowledges the page moving, rather than sitting there', () => {
    render(<ImprovedDashboard />);
    pinPerformanceTo('All time');

    const marker = (): HTMLElement => within(performanceCard()).getByText('pinned · All time');
    expect(marker()).not.toHaveClass('animate-pin-ack');

    fireEvent.click(within(periodBar()).getByRole('button', { name: 'Last month' }));

    expect(marker()).toHaveClass('animate-pin-ack');

    // The element clears it itself, so nothing anywhere needs a timer.
    fireEvent.animationEnd(marker());
    expect(marker()).not.toHaveClass('animate-pin-ack');
  });

  it('pins one card without touching its neighbours', () => {
    render(<ImprovedDashboard />);
    pinPerformanceTo('All time');

    // Exactly one declaration on the page, and the page's own bar is unmoved.
    expect(screen.getAllByText(/^pinned ·/)).toHaveLength(1);
    expect(within(periodBar()).getByRole('button', { name: '12 months' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('survives a remount, because it is how the owner reads his figures', () => {
    const first = render(<ImprovedDashboard />);
    pinPerformanceTo('All time');
    expect(localStorage.getItem('dashboardReports.pin.performance')).toBe('all');
    expect(localStorage.getItem('dashboardReports.pin.performancePinned')).toBe('true');
    first.unmount();

    render(<ImprovedDashboard />);

    expect(within(performanceCard()).getByText('pinned · All time')).toBeInTheDocument();
  });
});

describe('releasing a card back to the page', () => {
  it('rejoins the page clock on one tap, and says nothing more', () => {
    render(<ImprovedDashboard />);
    pinPerformanceTo('All time');
    fireEvent.click(within(periodBar()).getByRole('button', { name: 'Last month' }));

    releasePerformance('All time');

    expect(within(performanceCard()).queryByText(/^pinned ·/)).toBeNull();
    // Back on the page's window, named the plain way again.
    expect(within(performanceCard()).getByText('Last month')).toBeInTheDocument();
  });

  it('forgets the pin, so a remount opens following the page', () => {
    const first = render(<ImprovedDashboard />);
    pinPerformanceTo('All time');
    releasePerformance('All time');
    expect(localStorage.getItem('dashboardReports.pin.performancePinned')).toBeNull();
    expect(localStorage.getItem('dashboardReports.pin.performance')).toBeNull();
    first.unmount();

    render(<ImprovedDashboard />);

    expect(screen.queryByText(/^pinned ·/)).toBeNull();
    expect(within(performanceCard()).getByText('12 months')).toBeInTheDocument();
  });
});
