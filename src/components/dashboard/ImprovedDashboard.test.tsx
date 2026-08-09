/**
 * The dashboard's three claims about itself:
 *
 *  - every "Needs Your Attention" row says WHY, on screen and to a screen
 *    reader, in the same words (they used to be written by two different rules,
 *    and the on-screen half went blank for any threshold but £500);
 *  - the account picker can start from everything or from nothing;
 *  - the two halves of "Your Reports" keep their own clocks.
 *
 * Every account name, figure and institution here is invented.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ImprovedDashboard } from './ImprovedDashboard';
import type { Account, Transaction } from '../../types';
import type { BankConnection } from '../../services/bankConnectionService';
import type { PeriodRange } from '../../hooks/usePeriod';

const USER_ID = 'user_testonly_0001';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    transactionSplits: [],
    budgets: [],
    categories: [],
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

// The widgets' own maths is tested where it lives; here they only have to
// report the window they were handed, so the two pickers can be told apart.
const describeRange = (range: PeriodRange): string =>
  `${range.from ? range.from.toISOString().slice(0, 10) : 'none'}..${range.to ? range.to.toISOString().slice(0, 10) : 'none'}`;

vi.mock('./reportWidgets/DashboardReportWidgets', () => ({
  NetWorthWidget: ({ range }: { range: PeriodRange }) => (
    <div data-testid="net-worth-widget">{describeRange(range)}</div>
  ),
  IncomeExpenseTrendWidget: ({ range }: { range: PeriodRange }) => (
    <div data-testid="income-expense-widget">{describeRange(range)}</div>
  ),
  ExpenseCategoriesWidget: ({ range }: { range: PeriodRange }) => (
    <div data-testid="expense-categories-widget">{describeRange(range)}</div>
  ),
  CustomReportWidget: () => <div data-testid="custom-report-widget" />,
}));

vi.mock('../charts/DashboardCharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: () => <div data-testid="pie-chart" />,
  BarChart: () => <div data-testid="bar-chart" />,
}));

vi.mock('../AddTransactionModal', () => ({ default: () => null }));
vi.mock('../EditTransactionModal', () => ({ default: () => null }));
vi.mock('../IncomeExpenseBreakdownModal', () => ({ default: () => null }));
vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../services/customReportService', () => ({
  customReportService: { getCustomReports: () => [] },
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
  mocks.navigate.mockReset();
  mocks.app.accounts = [];
  mocks.app.transactions = [];
  mocks.app.isLoading = false;
  mocks.connections = [];
});

describe('Needs Your Attention', () => {
  const armed = account({
    id: 'acc-a',
    name: 'Feed Account A',
    openingBalance: 12.5,
    lowBalanceAlertEnabled: true,
    // Anything but the £500 the row's old label hard-coded.
    lowBalanceThreshold: 250,
  });

  it('states a reason on every row, and repeats it to a screen reader', () => {
    mocks.app.accounts = [
      armed,
      // A card IN CREDIT: nothing owed, nothing to warn about.
      account({ id: 'card-1', name: 'Sample Card', type: 'credit', creditLimit: 1000, openingBalance: 400 }),
    ];

    render(<ImprovedDashboard />);

    const rows = screen.getAllByTestId('attention-row');
    expect(rows).toHaveLength(1);

    const reason = 'Down to £12.50 — below the £250.00 you asked to be warned at.';
    expect(within(rows[0]).getByText(reason)).toBeInTheDocument();
    expect(rows[0].getAttribute('aria-label')).toContain(reason);
    expect(rows[0].getAttribute('aria-label')).toContain('Feed Account A');
    // The action is named, not left to a bare chevron.
    expect(within(rows[0]).getByText('Open register')).toBeInTheDocument();
  });

  it('sends a low-balance row to that account, and a broken feed to the feeds', () => {
    mocks.app.accounts = [armed, account({ id: 'acc-b', name: 'Feed Account B' })];
    mocks.connections = [{
      id: 'conn-1',
      provider: 'truelayer',
      institutionId: 'inst-1',
      institutionName: 'Sample Bank',
      status: 'reauth_required',
      lastSync: new Date(Date.now() - 72 * 60 * 60 * 1000),
      accounts: [],
      linkedAccountIds: ['acc-b'],
    }];

    render(<ImprovedDashboard />);

    const rows = screen.getAllByTestId('attention-row');
    expect(rows).toHaveLength(2);

    fireEvent.click(rows[0]);
    expect(mocks.navigate).toHaveBeenLastCalledWith('/accounts/acc-a');

    expect(rows[1].getAttribute('aria-label')).toContain('needs you to sign in again');
    fireEvent.click(rows[1]);
    expect(mocks.navigate).toHaveBeenLastCalledWith('/open-banking');
  });

  it('is a region that waits its turn, not an alert that interrupts', () => {
    mocks.app.accounts = [armed];
    render(<ImprovedDashboard />);

    const region = screen.getByRole('region', { name: 'Needs Your Attention' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says nothing while the transactions are still arriving', () => {
    // Until they land every balance is just its opening balance, so an
    // alert-armed account would flash onto the list and off it again.
    mocks.app.accounts = [armed];
    mocks.app.isLoading = true;

    render(<ImprovedDashboard />);

    expect(screen.queryByTestId('attention-row')).not.toBeInTheDocument();
    expect(screen.queryByText('Needs Your Attention')).not.toBeInTheDocument();
  });
});

describe('Key Account Balances — select all / clear all', () => {
  beforeEach(() => {
    mocks.app.accounts = [
      account({ id: 'acc-a', name: 'Feed Account A', openingBalance: 100 }),
      account({ id: 'acc-b', name: 'Feed Account B', type: 'savings', openingBalance: 200 }),
      account({ id: 'acc-c', name: 'Feed Account C', type: 'credit', openingBalance: -50 }),
    ];
  });

  const openPanel = (): void => {
    fireEvent.click(screen.getByLabelText('Customize displayed accounts'));
  };

  it('takes every listed account in one click', () => {
    localStorage.setItem('dashboardKeyAccounts', JSON.stringify([]));
    render(<ImprovedDashboard />);
    openPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));

    expect(screen.getAllByTestId('account-balance-card')).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem('dashboardKeyAccounts') ?? '[]').sort())
      .toEqual(['acc-a', 'acc-b', 'acc-c']);
  });

  it('empties the choice without breaking the widget', () => {
    localStorage.setItem('dashboardKeyAccounts', JSON.stringify(['acc-a', 'acc-b', 'acc-c']));
    render(<ImprovedDashboard />);
    openPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(screen.queryByTestId('account-balance-card')).not.toBeInTheDocument();
    expect(screen.getByText('No accounts selected')).toBeInTheDocument();
    expect(localStorage.getItem('dashboardKeyAccounts')).toBe('[]');
  });
});

describe('Your Reports — two columns, two clocks', () => {
  beforeEach(() => {
    mocks.app.accounts = [account({ id: 'acc-a', name: 'Feed Account A', openingBalance: 100 })];
    localStorage.setItem('dashboardPinnedReports', JSON.stringify(['net-worth', 'expense-categories']));
  });

  const assetsPills = (): HTMLElement => screen.getByRole('group', { name: 'Period for net worth reports' });
  const flowsPills = (): HTMLElement => screen.getByRole('group', { name: 'Period for income and spending reports' });

  it('gives each column its own period, and leaves the other one alone', () => {
    render(<ImprovedDashboard />);

    fireEvent.click(within(assetsPills()).getByRole('button', { name: 'All time' }));
    const netWorthWindow = screen.getByTestId('net-worth-widget').textContent;
    expect(netWorthWindow).toBe('none..none');

    fireEvent.click(within(flowsPills()).getByRole('button', { name: 'Last month' }));

    // The left column is untouched by the right column's choice.
    expect(screen.getByTestId('net-worth-widget').textContent).toBe(netWorthWindow);
    expect(screen.getByTestId('expense-categories-widget').textContent).not.toBe('none..none');

    expect(within(assetsPills()).getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(flowsPills()).getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('remembers the two choices under separate keys', () => {
    render(<ImprovedDashboard />);

    fireEvent.click(within(assetsPills()).getByRole('button', { name: 'All time' }));
    fireEvent.click(within(flowsPills()).getByRole('button', { name: 'Last month' }));

    expect(localStorage.getItem('dashboardReports')).toBe('all');
    expect(localStorage.getItem('dashboardReportsFlows')).toBe('last-month');
  });

  it('carries an existing choice over to the column that used to share it', () => {
    // The split must not silently reset half of what the user had chosen.
    localStorage.setItem('dashboardReports', 'all');
    localStorage.setItem('dashboardReportsExplicit', 'true');

    render(<ImprovedDashboard />);

    expect(within(assetsPills()).getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(flowsPills()).getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the account distribution beside the reports, on today’s figures', () => {
    render(<ImprovedDashboard />);

    const reports = screen.getByRole('region', { name: 'Your Reports' });
    expect(within(reports).getByText('Account Distribution')).toBeInTheDocument();
    // Stated, because the period pills above it do not govern it.
    expect(within(reports).getByText('Current balances')).toBeInTheDocument();
  });
});
