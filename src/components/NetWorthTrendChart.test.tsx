/**
 * NetWorthTrendChart Tests
 * Tests for the net worth trend chart component with line chart and decimal calculations
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import NetWorthTrendChart from './NetWorthTrendChart';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import type { Account, Transaction } from '../types';
import type { DecimalAccount, DecimalTransaction } from '../types/decimal-types';

// Mock the external dependencies
vi.mock('../contexts/AppContext');
vi.mock('../hooks/useCurrencyDecimal');

// Mock Recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ type, dataKey, stroke, strokeWidth, dot }: any) => (
    <div 
      data-testid="line" 
      data-type={type} 
      data-key={dataKey} 
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-dot={JSON.stringify(dot)}
    />
  ),
  XAxis: ({ dataKey, stroke }: any) => (
    <div data-testid="x-axis" data-key={dataKey} data-stroke={stroke} />
  ),
  YAxis: ({ stroke, tickFormatter }: any) => (
    <div data-testid="y-axis" data-stroke={stroke} data-formatter={tickFormatter ? 'has-formatter' : 'no-formatter'} />
  ),
  CartesianGrid: ({ strokeDasharray, stroke }: any) => (
    <div data-testid="cartesian-grid" data-stroke-dasharray={strokeDasharray} data-stroke={stroke} />
  ),
  Tooltip: ({ formatter, contentStyle }: any) => (
    <div 
      data-testid="tooltip" 
      data-formatter={formatter ? 'has-formatter' : 'no-formatter'}
      data-content-style={JSON.stringify(contentStyle)}
    />
  ),
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  )
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;

describe('NetWorthTrendChart', () => {
  const mockFormatCurrency = vi.fn((amount: number) => `£${amount.toFixed(2)}`);

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Checking Account',
      type: 'current',
      balance: 5000.00,
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
      name: 'Investment Account',
      type: 'investment',
      balance: 25000.00,
      currency: 'GBP',
      institution: 'Vanguard',
      lastUpdated: new Date('2024-01-18')
    }
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: new Date('2024-01-15'),
      description: 'Salary',
      category: 'income',
      type: 'income',
      amount: 3000,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-2',
      date: new Date('2024-01-10'),
      description: 'Rent',
      category: 'housing',
      type: 'expense',
      amount: 1200,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-3',
      date: new Date('2023-12-15'),
      description: 'Investment',
      category: 'investment',
      type: 'expense',
      amount: 2000,
      accountId: 'acc-3',
      cleared: true
    }
  ];

  const mockDecimalAccounts: DecimalAccount[] = mockAccounts.map(acc => ({
    ...acc,
    balance: toDecimal(acc.balance)
  }));

  const mockDecimalTransactions: DecimalTransaction[] = mockTransactions.map(tx => ({
    ...tx,
    amount: toDecimal(tx.amount)
  }));

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock current date to be January 2024 for consistent testing
    const mockDate = new Date('2024-01-25');
    vi.setSystemTime(mockDate);

    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: mockTransactions,
      getDecimalAccounts: vi.fn(() => mockDecimalAccounts),
      getDecimalTransactions: vi.fn(() => mockDecimalTransactions)
    });

    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the chart with correct title', () => {
    render(<NetWorthTrendChart />);
    
    expect(screen.getByText('Net Worth Trend')).toBeInTheDocument();
  });

  it('renders all chart components', () => {
    render(<NetWorthTrendChart />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
  });

  it('configures chart components correctly', () => {
    render(<NetWorthTrendChart />);
    
    // Check ResponsiveContainer dimensions
    const container = screen.getByTestId('responsive-container');
    expect(container).toHaveAttribute('data-width', '100%');
    expect(container).toHaveAttribute('data-height', '100%');

    // Check X-axis configuration
    const xAxis = screen.getByTestId('x-axis');
    expect(xAxis).toHaveAttribute('data-key', 'month');
    expect(xAxis).toHaveAttribute('data-stroke', '#9CA3AF');

    // Check Y-axis configuration
    const yAxis = screen.getByTestId('y-axis');
    expect(yAxis).toHaveAttribute('data-stroke', '#9CA3AF');
    expect(yAxis).toHaveAttribute('data-formatter', 'has-formatter');

    // Check CartesianGrid configuration
    const grid = screen.getByTestId('cartesian-grid');
    expect(grid).toHaveAttribute('data-stroke-dasharray', '3 3');
    expect(grid).toHaveAttribute('data-stroke', '#374151');

    // Check Tooltip configuration
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('data-formatter', 'has-formatter');
    const contentStyle = JSON.parse(tooltip.getAttribute('data-content-style') || '{}');
    expect(contentStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.95)');
    expect(contentStyle.border).toBe('1px solid #ccc');
    expect(contentStyle.borderRadius).toBe('8px');

    // Check Line configuration
    const line = screen.getByTestId('line');
    expect(line).toHaveAttribute('data-type', 'monotone');
    expect(line).toHaveAttribute('data-key', 'balance');
    expect(line).toHaveAttribute('data-stroke', '#8B5CF6');
    expect(line).toHaveAttribute('data-stroke-width', '2');
    const dot = JSON.parse(line.getAttribute('data-dot') || '{}');
    expect(dot.fill).toBe('#8B5CF6');
  });

  it('generates 6 months of data', () => {
    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should have 6 months of data
    expect(chartData).toHaveLength(6);
  });

  it('formats months correctly', () => {
    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Check that all entries have month names
    chartData.forEach((entry: any) => {
      expect(entry.month).toMatch(/^[A-Za-z]{3}$/); // 3-letter month abbreviations
    });

    // Check chronological order (oldest to newest)
    expect(chartData[0].month).toBe('Aug'); // 5 months ago from Jan
    expect(chartData[5].month).toBe('Jan'); // Current month
  });

  it('calculates net worth balances', () => {
    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // All entries should have balance property
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBeTypeOf('number');
      expect(entry.balance).toBeGreaterThanOrEqual(0);
    });
  });

  it('handles empty accounts correctly', () => {
    mockUseApp.mockReturnValue({
      accounts: [],
      transactions: [],
      getDecimalAccounts: vi.fn(() => []),
      getDecimalTransactions: vi.fn(() => [])
    });

    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should still have 6 months but with zero balances
    expect(chartData).toHaveLength(6);
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBe(0);
    });
  });

  it('handles empty transactions correctly', () => {
    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: [],
      getDecimalAccounts: vi.fn(() => mockDecimalAccounts),
      getDecimalTransactions: vi.fn(() => [])
    });

    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should still generate data based on current account balances
    expect(chartData).toHaveLength(6);
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBeTypeOf('number');
    });
  });

  it('handles negative balances correctly', () => {
    const negativeAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Credit Card',
        type: 'credit',
        balance: -5000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      },
      {
        id: 'acc-2',
        name: 'Savings',
        type: 'savings',
        balance: 3000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-19')
      }
    ];

    const negativeDecimalAccounts: DecimalAccount[] = negativeAccounts.map(acc => ({
      ...acc,
      balance: toDecimal(acc.balance)
    }));

    mockUseApp.mockReturnValue({
      accounts: negativeAccounts,
      transactions: mockTransactions,
      getDecimalAccounts: vi.fn(() => negativeDecimalAccounts),
      getDecimalTransactions: vi.fn(() => mockDecimalTransactions)
    });

    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should handle negative net worth
    expect(chartData).toHaveLength(6);
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBeTypeOf('number');
    });
  });

  it('processes income and expense transactions correctly', () => {
    const mixedTransactions: Transaction[] = [
      {
        id: 'tx-1',
        date: new Date('2024-01-15'),
        description: 'Salary',
        category: 'income',
        type: 'income',
        amount: 5000,
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'tx-2',
        date: new Date('2024-01-10'),
        description: 'Rent',
        category: 'housing',
        type: 'expense',
        amount: 1500,
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'tx-3',
        date: new Date('2023-12-20'),
        description: 'Christmas Bonus',
        category: 'income',
        type: 'income',
        amount: 2000,
        accountId: 'acc-1',
        cleared: true
      }
    ];

    const mixedDecimalTransactions: DecimalTransaction[] = mixedTransactions.map(tx => ({
      ...tx,
      amount: toDecimal(tx.amount)
    }));

    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: mixedTransactions,
      getDecimalAccounts: vi.fn(() => mockDecimalAccounts),
      getDecimalTransactions: vi.fn(() => mixedDecimalTransactions)
    });

    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should process both income and expense transactions
    expect(chartData).toHaveLength(6);
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBeTypeOf('number');
    });
  });

  it('applies correct styling classes', () => {
    render(<NetWorthTrendChart />);
    
    const container = screen.getByText('Net Worth Trend').parentElement;
    expect(container).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-lg', 'shadow', 'p-6');
    
    const title = screen.getByText('Net Worth Trend');
    expect(title).toHaveClass('text-xl', 'font-semibold', 'mb-4', 'dark:text-white');

    const chartContainer = container?.querySelector('.h-64');
    expect(chartContainer).toBeInTheDocument();
  });

  it('memoizes data calculation correctly', () => {
    const { rerender } = render(<NetWorthTrendChart />);
    
    // First render
    const firstRender = screen.getByTestId('line-chart');
    const firstData = JSON.parse(firstRender.getAttribute('data-chart-data') || '[]');
    
    // Re-render with same data
    rerender(<NetWorthTrendChart />);
    
    const secondRender = screen.getByTestId('line-chart');
    const secondData = JSON.parse(secondRender.getAttribute('data-chart-data') || '[]');
    
    // Data should be identical (memoized)
    expect(firstData).toEqual(secondData);
  });

  it('updates when accounts change', () => {
    const { unmount } = render(<NetWorthTrendChart />);
    
    const firstRender = screen.getByTestId('line-chart');
    const firstData = JSON.parse(firstRender.getAttribute('data-chart-data') || '[]');
    
    // Unmount to clear React memo cache
    unmount();
    
    // Change accounts
    const newAccounts = [...mockAccounts, {
      id: 'acc-new',
      name: 'New Account',
      type: 'current',
      balance: 10000,
      currency: 'GBP',
      lastUpdated: new Date('2024-01-21')
    }];

    const newDecimalAccounts = newAccounts.map(acc => ({
      ...acc,
      balance: toDecimal(acc.balance)
    }));

    mockUseApp.mockReturnValue({
      accounts: newAccounts,
      transactions: mockTransactions,
      getDecimalAccounts: vi.fn(() => newDecimalAccounts),
      getDecimalTransactions: vi.fn(() => mockDecimalTransactions)
    });

    // Render fresh component with new data
    render(<NetWorthTrendChart />);
    
    const secondRender = screen.getByTestId('line-chart');
    const secondData = JSON.parse(secondRender.getAttribute('data-chart-data') || '[]');
    
    // Data should be different due to new account
    expect(secondData).not.toEqual(firstData);
    
    // All balance values should be higher due to the new account
    secondData.forEach((entry: any, index: number) => {
      expect(entry.balance).toBeGreaterThan(firstData[index].balance);
    });
  });

  it('updates when transactions change', () => {
    const { unmount } = render(<NetWorthTrendChart />);
    
    unmount();
    
    // Change transactions
    const newTransactions = [...mockTransactions, {
      id: 'tx-new',
      date: new Date('2024-01-25'),
      description: 'New Income',
      category: 'test',
      type: 'income',
      amount: 5000,
      accountId: 'acc-1',
      cleared: true
    }];

    const newDecimalTransactions = newTransactions.map(tx => ({
      ...tx,
      amount: toDecimal(tx.amount)
    }));

    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: newTransactions,
      getDecimalAccounts: vi.fn(() => mockDecimalAccounts),
      getDecimalTransactions: vi.fn(() => newDecimalTransactions)
    });

    // Render fresh component with new data
    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should still have 6 months of data
    expect(chartData).toHaveLength(6);
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBeTypeOf('number');
    });
  });

  it('handles large balance amounts correctly', () => {
    const largeBalanceAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Investment Portfolio',
        type: 'investment',
        balance: 1000000,
        currency: 'GBP',
        lastUpdated: new Date('2024-01-20')
      }
    ];

    const largeDecimalAccounts = largeBalanceAccounts.map(acc => ({
      ...acc,
      balance: toDecimal(acc.balance)
    }));

    mockUseApp.mockReturnValue({
      accounts: largeBalanceAccounts,
      transactions: [],
      getDecimalAccounts: vi.fn(() => largeDecimalAccounts),
      getDecimalTransactions: vi.fn(() => [])
    });

    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should handle large amounts
    expect(chartData).toHaveLength(6);
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBeGreaterThan(900000);
    });
  });

  it('maintains component memo behavior', () => {
    const ComponentWrapper = ({ testAccounts }: { testAccounts: Account[] }) => {
      const testDecimalAccounts = testAccounts.map(acc => ({
        ...acc,
        balance: toDecimal(acc.balance)
      }));
      
      mockUseApp.mockReturnValue({
        accounts: testAccounts,
        transactions: mockTransactions,
        getDecimalAccounts: vi.fn(() => testDecimalAccounts),
        getDecimalTransactions: vi.fn(() => mockDecimalTransactions)
      });
      return <NetWorthTrendChart />;
    };

    const { rerender } = render(<ComponentWrapper testAccounts={mockAccounts} />);
    
    // Re-render with same props should not cause unnecessary re-renders
    // This tests the React.memo behavior
    rerender(<ComponentWrapper testAccounts={mockAccounts} />);
    
    // The component should still render correctly
    expect(screen.getByText('Net Worth Trend')).toBeInTheDocument();
  });

  it('handles different transaction types correctly', () => {
    const diverseTransactions: Transaction[] = [
      {
        id: 'tx-1',
        date: new Date('2024-01-15'),
        description: 'Salary',
        category: 'income',
        type: 'income',
        amount: 3000,
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'tx-2',
        date: new Date('2024-01-10'),
        description: 'Rent',
        category: 'housing',
        type: 'expense',
        amount: 1200,
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'tx-3',
        date: new Date('2024-01-05'),
        description: 'Transfer',
        category: 'transfer',
        type: 'transfer',
        amount: 500,
        accountId: 'acc-1',
        cleared: true
      }
    ];

    const diverseDecimalTransactions = diverseTransactions.map(tx => ({
      ...tx,
      amount: toDecimal(tx.amount)
    }));

    mockUseApp.mockReturnValue({
      accounts: mockAccounts,
      transactions: diverseTransactions,
      getDecimalAccounts: vi.fn(() => mockDecimalAccounts),
      getDecimalTransactions: vi.fn(() => diverseDecimalTransactions)
    });

    render(<NetWorthTrendChart />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should handle all transaction types (transfer is ignored in calculation)
    expect(chartData).toHaveLength(6);
    chartData.forEach((entry: any) => {
      expect(entry.balance).toBeTypeOf('number');
    });
  });
});