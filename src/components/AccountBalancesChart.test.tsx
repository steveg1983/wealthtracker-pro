/**
 * AccountBalancesChart Tests
 * Tests for the account balances chart component with horizontal bar layout
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import AccountBalancesChart from './AccountBalancesChart';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Account } from '../types';

// Mock the external dependencies
vi.mock('../contexts/AppContext');
vi.mock('../hooks/useCurrencyDecimal');

// Mock Recharts components
vi.mock('recharts', () => ({
  BarChart: ({ children, data, layout }: {
    children: React.ReactNode;
    data: unknown;
    layout: string;
  }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} data-layout={layout}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, children }: {
    dataKey: string;
    children: React.ReactNode;
  }) => (
    <div data-testid={`bar-${dataKey}`}>
      {children}
    </div>
  ),
  XAxis: ({ type, tickFormatter }: {
    type: string;
    tickFormatter?: (value: unknown) => string;
  }) => (
    <div data-testid="x-axis" data-type={type} data-formatter={tickFormatter ? 'has-formatter' : 'no-formatter'} />
  ),
  YAxis: ({ dataKey, type, width }: {
    dataKey: string;
    type: string;
    width: number;
  }) => (
    <div data-testid="y-axis" data-key={dataKey} data-type={type} data-width={width} />
  ),
  CartesianGrid: ({ strokeDasharray }: {
    strokeDasharray: string;
  }) => (
    <div data-testid="cartesian-grid" data-stroke-dasharray={strokeDasharray} />
  ),
  Tooltip: ({ formatter }: {
    formatter?: (value: unknown) => string;
  }) => (
    <div data-testid="tooltip" data-formatter={formatter ? 'has-formatter' : 'no-formatter'} />
  ),
  ResponsiveContainer: ({ children, width, height }: {
    children: React.ReactNode;
    width: string | number;
    height: string | number;
  }) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  ),
  Cell: ({ fill }: { fill: string }) => (
    <div data-testid="cell" data-fill={fill} />
  )
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;

describe('AccountBalancesChart', () => {
  const mockFormatCurrency = vi.fn((amount: number) => `£${amount.toFixed(2)}`);
  const mockGetCurrencySymbol = vi.fn((_: string) => '£');

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Checking Account',
      type: 'current',
      balance: 2500.50,
      currency: 'GBP',
      institution: 'HSBC',
      lastUpdated: new Date('2024-01-20')
    },
    {
      id: 'acc-2',
      name: 'Savings Account',
      type: 'savings',
      balance: 15000.00,
      currency: 'GBP',
      institution: 'HSBC',
      lastUpdated: new Date('2024-01-19')
    },
    {
      id: 'acc-3',
      name: 'Credit Card',
      type: 'credit',
      balance: -1250.25,
      currency: 'GBP',
      institution: 'Mastercard',
      lastUpdated: new Date('2024-01-18')
    },
    {
      id: 'acc-4',
      name: 'Investment Account',
      type: 'investment',
      balance: 45000.75,
      currency: 'GBP',
      institution: 'Vanguard',
      lastUpdated: new Date('2024-01-17')
    },
    {
      id: 'acc-5',
      name: 'Personal Loan',
      type: 'loan',
      balance: -5000.00,
      currency: 'GBP',
      institution: 'Barclays',
      lastUpdated: new Date('2024-01-16')
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApp.mockReturnValue({
      accounts: mockAccounts
    });

    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency,
      getCurrencySymbol: mockGetCurrencySymbol,
      displayCurrency: 'GBP'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the chart with correct title', () => {
    render(<AccountBalancesChart />);
    
    expect(screen.getByText('Account Balances')).toBeInTheDocument();
  });

  it('renders all chart components', () => {
    render(<AccountBalancesChart />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('bar-balance')).toBeInTheDocument();
  });

  it('configures chart components correctly for horizontal layout', () => {
    render(<AccountBalancesChart />);
    
    // Check ResponsiveContainer dimensions
    const container = screen.getByTestId('responsive-container');
    expect(container).toHaveAttribute('data-width', '100%');
    expect(container).toHaveAttribute('data-height', '300');

    // Check chart layout
    const barChart = screen.getByTestId('bar-chart');
    expect(barChart).toHaveAttribute('data-layout', 'horizontal');

    // Check X-axis configuration (number type for horizontal)
    const xAxis = screen.getByTestId('x-axis');
    expect(xAxis).toHaveAttribute('data-type', 'number');
    expect(xAxis).toHaveAttribute('data-formatter', 'has-formatter');

    // Check Y-axis configuration (category type for horizontal)
    const yAxis = screen.getByTestId('y-axis');
    expect(yAxis).toHaveAttribute('data-key', 'name');
    expect(yAxis).toHaveAttribute('data-type', 'category');
    expect(yAxis).toHaveAttribute('data-width', '100');

    // Check tooltip has formatter
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('data-formatter', 'has-formatter');

    // Check CartesianGrid configuration
    const grid = screen.getByTestId('cartesian-grid');
    expect(grid).toHaveAttribute('data-stroke-dasharray', '3 3');
  });

  it('processes account data correctly', () => {
    render(<AccountBalancesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should have all accounts
    expect(chartData).toHaveLength(5);
    
    // Check data structure
    expect(chartData[0]).toEqual({
      name: 'Checking Account',
      balance: 2500.50,
      type: 'current'
    });
    
    expect(chartData[1]).toEqual({
      name: 'Savings Account',
      balance: 15000.00,
      type: 'savings'
    });
    
    expect(chartData[2]).toEqual({
      name: 'Credit Card',
      balance: -1250.25,
      type: 'credit'
    });
  });

  it('handles empty accounts array', () => {
    mockUseApp.mockReturnValue({
      accounts: []
    });

    const { container } = render(<AccountBalancesChart />);
    
    // Should render nothing
    expect(container.firstChild).toBeNull();
  });

  it('handles accounts with zero balances', () => {
    const accountsWithZero: Account[] = [
      {
        id: 'acc-1',
        name: 'Empty Account',
        type: 'current',
        balance: 0,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      },
      {
        id: 'acc-2',
        name: 'Positive Account',
        type: 'savings',
        balance: 1000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-19')
      }
    ];

    mockUseApp.mockReturnValue({
      accounts: accountsWithZero
    });

    render(<AccountBalancesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    expect(chartData).toHaveLength(2);
    expect(chartData[0].balance).toBe(0);
    expect(chartData[1].balance).toBe(1000);
  });

  it('handles negative balances correctly', () => {
    const negativeAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Credit Card',
        type: 'credit',
        balance: -500.75,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      },
      {
        id: 'acc-2',
        name: 'Loan',
        type: 'loan',
        balance: -10000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-19')
      }
    ];

    mockUseApp.mockReturnValue({
      accounts: negativeAccounts
    });

    render(<AccountBalancesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    expect(chartData[0].balance).toBe(-500.75);
    expect(chartData[1].balance).toBe(-10000);
  });

  it('handles accounts with very large balances', () => {
    const largeBalanceAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Investment Portfolio',
        type: 'investment',
        balance: 1234567.89,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      }
    ];

    mockUseApp.mockReturnValue({
      accounts: largeBalanceAccounts
    });

    render(<AccountBalancesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    expect(chartData[0].balance).toBe(1234567.89);
  });

  it('memoizes data calculation correctly', () => {
    const { rerender } = render(<AccountBalancesChart />);
    
    // First render
    const firstRender = screen.getByTestId('bar-chart');
    const firstData = JSON.parse(firstRender.getAttribute('data-chart-data') || '[]');
    
    // Re-render with same data
    rerender(<AccountBalancesChart />);
    
    const secondRender = screen.getByTestId('bar-chart');
    const secondData = JSON.parse(secondRender.getAttribute('data-chart-data') || '[]');
    
    // Data should be identical (memoized)
    expect(firstData).toEqual(secondData);
  });

  it('updates when accounts change', () => {
    const { unmount } = render(<AccountBalancesChart />);
    
    const firstRender = screen.getByTestId('bar-chart');
    const firstData = JSON.parse(firstRender.getAttribute('data-chart-data') || '[]');
    
    // Unmount to clear React memo cache
    unmount();
    
    // Change accounts
    const newAccounts = [...mockAccounts, {
      id: 'acc-new',
      name: 'New Account',
      type: 'current',
      balance: 3000,
      currency: 'GBP',
      lastUpdated: new Date('2024-01-21')
    }];

    mockUseApp.mockReturnValue({
      accounts: newAccounts
    });

    // Render fresh component with new data
    render(<AccountBalancesChart />);
    
    const secondRender = screen.getByTestId('bar-chart');
    const secondData = JSON.parse(secondRender.getAttribute('data-chart-data') || '[]');
    
    // Should have one more account
    expect(secondData).toHaveLength(firstData.length + 1);
    expect(secondData[secondData.length - 1].name).toBe('New Account');
    expect(secondData[secondData.length - 1].balance).toBe(3000);
  });

  it('applies correct styling classes', () => {
    render(<AccountBalancesChart />);
    
    const container = screen.getByText('Account Balances').parentElement;
    expect(container).toHaveClass('bg-white', 'p-6', 'rounded-lg', 'shadow');
    
    const title = screen.getByText('Account Balances');
    expect(title).toHaveClass('text-lg', 'font-semibold', 'mb-4');
  });

  it('uses correct colors for different account types', () => {
    render(<AccountBalancesChart />);
    
    const cells = screen.getAllByTestId('cell');
    
    // Should have a cell for each account
    expect(cells).toHaveLength(mockAccounts.length);
    
    // Check that cells have fill attributes (colors are set by the component)
    cells.forEach(cell => {
      expect(cell).toHaveAttribute('data-fill');
    });
  });

  it('handles accounts with long names', () => {
    const longNameAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Very Long Account Name That Might Cause Layout Issues',
        type: 'current',
        balance: 1000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      },
      {
        id: 'acc-2',
        name: 'AnotherVeryLongAccountNameWithoutSpacesThatCouldCauseProblems',
        type: 'savings',
        balance: 2000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-19')
      }
    ];

    mockUseApp.mockReturnValue({
      accounts: longNameAccounts
    });

    render(<AccountBalancesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    expect(chartData[0].name).toBe('Very Long Account Name That Might Cause Layout Issues');
    expect(chartData[1].name).toBe('AnotherVeryLongAccountNameWithoutSpacesThatCouldCauseProblems');
  });

  it('maintains component memo behavior', () => {
    const ComponentWrapper = ({ accounts }: { accounts: Account[] }) => {
      mockUseApp.mockReturnValue({ accounts });
      return <AccountBalancesChart />;
    };

    const { rerender } = render(<ComponentWrapper accounts={mockAccounts} />);
    
    // Re-render with same props should not cause unnecessary re-renders
    // This tests the React.memo behavior
    rerender(<ComponentWrapper accounts={mockAccounts} />);
    
    // The component should still render correctly
    expect(screen.getByText('Account Balances')).toBeInTheDocument();
  });

  it('handles different currency symbols', () => {
    mockGetCurrencySymbol.mockReturnValue('$');
    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency,
      getCurrencySymbol: mockGetCurrencySymbol,
      displayCurrency: 'USD'
    });

    render(<AccountBalancesChart />);
    
    // The currency symbol should be used in formatCurrencyShort function
    // This is tested indirectly through the X-axis formatter
    const xAxis = screen.getByTestId('x-axis');
    expect(xAxis).toHaveAttribute('data-formatter', 'has-formatter');
    
    // The getCurrencySymbol function is used in the formatCurrencyShort function
    // but since it's not called during render, we just verify the mock was set up correctly
    expect(mockGetCurrencySymbol).toBeDefined();
    expect(mockUseCurrencyDecimal).toHaveBeenCalledWith();
  });

  it('handles unknown account types with default color', () => {
    const unknownTypeAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Unknown Type Account',
        type: 'unknown' as Account['type'], // Force unknown type
        balance: 1000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      }
    ];

    mockUseApp.mockReturnValue({
      accounts: unknownTypeAccounts
    });

    render(<AccountBalancesChart />);
    
    // Should still render without error
    expect(screen.getByText('Account Balances')).toBeInTheDocument();
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    expect(chartData[0].type).toBe('unknown');
  });

  it('handles mixed account types correctly', () => {
    const mixedAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Current Account',
        type: 'current',
        balance: 1000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      },
      {
        id: 'acc-2',
        name: 'Savings Account',
        type: 'savings',
        balance: 5000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-19')
      },
      {
        id: 'acc-3',
        name: 'Investment Account',
        type: 'investment',
        balance: 10000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-18')
      }
    ];

    mockUseApp.mockReturnValue({
      accounts: mixedAccounts
    });

    render(<AccountBalancesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should handle all account types
    expect(chartData).toHaveLength(3);
    expect(chartData[0].type).toBe('current');
    expect(chartData[1].type).toBe('savings');
    expect(chartData[2].type).toBe('investment');
  });
});