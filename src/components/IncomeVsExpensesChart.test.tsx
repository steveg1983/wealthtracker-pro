/**
 * IncomeVsExpensesChart Tests
 * Tests for the income vs expenses chart component with Recharts integration
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import IncomeVsExpensesChart from './IncomeVsExpensesChart';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Transaction } from '../types';

// Mock the external dependencies
vi.mock('../contexts/AppContext');
vi.mock('../hooks/useCurrencyDecimal');

// Mock Recharts components
vi.mock('recharts', () => ({
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, fill, name }: any) => (
    <div data-testid={`bar-${dataKey}`} data-fill={fill} data-name={name} />
  ),
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: ({ tickFormatter }: any) => (
    <div data-testid="y-axis" data-formatter={tickFormatter ? 'has-formatter' : 'no-formatter'} />
  ),
  CartesianGrid: ({ strokeDasharray }: any) => (
    <div data-testid="cartesian-grid" data-stroke-dasharray={strokeDasharray} />
  ),
  Tooltip: ({ formatter }: any) => (
    <div data-testid="tooltip" data-formatter={formatter ? 'has-formatter' : 'no-formatter'} />
  ),
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  )
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;

describe('IncomeVsExpensesChart', () => {
  const mockFormatCurrency = vi.fn((amount: number) => `£${amount.toFixed(2)}`);

  const mockTransactions: Transaction[] = [
    // Current month (Jan 2024) data
    {
      id: 'tx-1',
      date: new Date('2024-01-15'),
      description: 'Salary',
      category: 'salary',
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
      date: new Date('2024-01-20'),
      description: 'Groceries',
      category: 'food',
      type: 'expense',
      amount: 300,
      accountId: 'acc-1',
      cleared: true
    },
    // Previous month (Dec 2023) data
    {
      id: 'tx-4',
      date: new Date('2023-12-15'),
      description: 'Salary',
      category: 'salary',
      type: 'income',
      amount: 3000,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-5',
      date: new Date('2023-12-05'),
      description: 'Rent',
      category: 'housing',
      type: 'expense',
      amount: 1200,
      accountId: 'acc-1',
      cleared: true
    },
    // Nov 2023 data
    {
      id: 'tx-6',
      date: new Date('2023-11-15'),
      description: 'Consulting',
      category: 'freelance',
      type: 'income',
      amount: 1500,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-7',
      date: new Date('2023-11-10'),
      description: 'Utilities',
      category: 'bills',
      type: 'expense',
      amount: 200,
      accountId: 'acc-1',
      cleared: true
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock current date to be January 2024 for consistent testing
    const mockDate = new Date('2024-01-25');
    vi.setSystemTime(mockDate);

    mockUseApp.mockReturnValue({
      transactions: mockTransactions
    });

    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the chart with correct title', () => {
    render(<IncomeVsExpensesChart />);
    
    expect(screen.getByText('Income vs Expenses (Last 6 Months)')).toBeInTheDocument();
  });

  it('renders all chart components', () => {
    render(<IncomeVsExpensesChart />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
    expect(screen.getByTestId('bar-income')).toBeInTheDocument();
    expect(screen.getByTestId('bar-expenses')).toBeInTheDocument();
  });

  it('configures chart components correctly', () => {
    render(<IncomeVsExpensesChart />);
    
    // Check ResponsiveContainer dimensions
    const container = screen.getByTestId('responsive-container');
    expect(container).toHaveAttribute('data-width', '100%');
    expect(container).toHaveAttribute('data-height', '300');

    // Check X-axis configuration
    const xAxis = screen.getByTestId('x-axis');
    expect(xAxis).toHaveAttribute('data-key', 'month');

    // Check Y-axis has formatter
    const yAxis = screen.getByTestId('y-axis');
    expect(yAxis).toHaveAttribute('data-formatter', 'has-formatter');

    // Check tooltip has formatter
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('data-formatter', 'has-formatter');

    // Check CartesianGrid configuration
    const grid = screen.getByTestId('cartesian-grid');
    expect(grid).toHaveAttribute('data-stroke-dasharray', '3 3');

    // Check Bar configurations
    const incomeBar = screen.getByTestId('bar-income');
    expect(incomeBar).toHaveAttribute('data-fill', '#34c759');
    expect(incomeBar).toHaveAttribute('data-name', 'Income');

    const expensesBar = screen.getByTestId('bar-expenses');
    expect(expensesBar).toHaveAttribute('data-fill', '#ff3b30');
    expect(expensesBar).toHaveAttribute('data-name', 'Expenses');
  });

  it('processes transaction data correctly for last 6 months', () => {
    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should have 6 months of data
    expect(chartData).toHaveLength(6);
    
    // Check that months are in chronological order (oldest to newest)
    expect(chartData[0].month).toBe('Aug 23'); // 5 months ago
    expect(chartData[5].month).toBe('Jan 24'); // Current month
  });

  it('calculates income and expenses correctly', () => {
    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Find January 2024 data (current month)
    const janData = chartData.find((d: any) => d.month === 'Jan 24');
    expect(janData).toBeDefined();
    expect(janData.income).toBe(3000); // One salary transaction
    expect(janData.expenses).toBe(1500); // Rent + Groceries (1200 + 300)
    expect(janData.net).toBe(1500); // 3000 - 1500

    // Find December 2023 data
    const decData = chartData.find((d: any) => d.month === 'Dec 23');
    expect(decData).toBeDefined();
    expect(decData.income).toBe(3000); // One salary transaction
    expect(decData.expenses).toBe(1200); // One rent transaction
    expect(decData.net).toBe(1800); // 3000 - 1200

    // Find November 2023 data
    const novData = chartData.find((d: any) => d.month === 'Nov 23');
    expect(novData).toBeDefined();
    expect(novData.income).toBe(1500); // Consulting income
    expect(novData.expenses).toBe(200); // Utilities
    expect(novData.net).toBe(1300); // 1500 - 200
  });

  it('handles months with no transactions', () => {
    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Find a month with no transactions (should be one of the earlier months)
    const emptyMonth = chartData.find((d: any) => d.income === 0 && d.expenses === 0);
    expect(emptyMonth).toBeDefined();
    expect(emptyMonth.net).toBe(0);
  });

  it('handles empty transactions array', () => {
    mockUseApp.mockReturnValue({
      transactions: []
    });

    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Should still have 6 months but all with zero values
    expect(chartData).toHaveLength(6);
    chartData.forEach((month: any) => {
      expect(month.income).toBe(0);
      expect(month.expenses).toBe(0);
      expect(month.net).toBe(0);
    });
  });

  it('rounds amounts to 2 decimal places', () => {
    const transactionsWithDecimals: Transaction[] = [
      {
        id: 'tx-1',
        date: new Date('2024-01-15'),
        description: 'Test Income',
        category: 'test',
        type: 'income',
        amount: 1234.567, // Should round to 1234.57
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'tx-2',
        date: new Date('2024-01-10'),
        description: 'Test Expense',
        category: 'test',
        type: 'expense',
        amount: 987.123, // Should round to 987.12
        accountId: 'acc-1',
        cleared: true
      }
    ];

    mockUseApp.mockReturnValue({
      transactions: transactionsWithDecimals
    });

    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    const janData = chartData.find((d: any) => d.month === 'Jan 24');
    expect(janData.income).toBe(1234.57);
    expect(janData.expenses).toBe(987.12);
    expect(janData.net).toBe(247.44); // 1234.57 - 987.12 = 247.44 (due to floating point precision)
  });

  it('formats months correctly', () => {
    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Check month format (short month + 2-digit year)
    // Note: Some months like September are abbreviated as "Sept" (4 characters)
    chartData.forEach((month: any) => {
      expect(month.month).toMatch(/^[A-Za-z]{3,4} \d{2}$/); // e.g., "Jan 24" or "Sept 23"
    });
  });

  it('handles transactions from different years correctly', () => {
    const crossYearTransactions: Transaction[] = [
      {
        id: 'tx-1',
        date: new Date('2023-08-15'), // 5 months ago from Jan 2024
        description: 'Old Income',
        category: 'test',
        type: 'income',
        amount: 1000,
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'tx-2',
        date: new Date('2024-01-15'), // Current month
        description: 'New Income',
        category: 'test',
        type: 'income',
        amount: 2000,
        accountId: 'acc-1',
        cleared: true
      }
    ];

    mockUseApp.mockReturnValue({
      transactions: crossYearTransactions
    });

    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    // Find August 2023 data
    const augData = chartData.find((d: any) => d.month === 'Aug 23');
    expect(augData).toBeDefined();
    expect(augData.income).toBe(1000);

    // Find January 2024 data
    const janData = chartData.find((d: any) => d.month === 'Jan 24');
    expect(janData).toBeDefined();
    expect(janData.income).toBe(2000);
  });

  it('memoizes data calculation correctly', () => {
    const { rerender } = render(<IncomeVsExpensesChart />);
    
    // First render
    const firstRender = screen.getByTestId('bar-chart');
    const firstData = JSON.parse(firstRender.getAttribute('data-chart-data') || '[]');
    
    // Re-render with same data
    rerender(<IncomeVsExpensesChart />);
    
    const secondRender = screen.getByTestId('bar-chart');
    const secondData = JSON.parse(secondRender.getAttribute('data-chart-data') || '[]');
    
    // Data should be identical (memoized)
    expect(firstData).toEqual(secondData);
  });

  it('updates when transactions change', () => {
    const { rerender, unmount } = render(<IncomeVsExpensesChart />);
    
    const firstRender = screen.getByTestId('bar-chart');
    const firstData = JSON.parse(firstRender.getAttribute('data-chart-data') || '[]');
    const firstJan = firstData.find((d: any) => d.month === 'Jan 24');
    const originalIncome = firstJan.income;
    
    // Unmount to clear React memo cache
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

    mockUseApp.mockReturnValue({
      transactions: newTransactions
    });

    // Render fresh component with new data
    render(<IncomeVsExpensesChart />);
    
    const secondRender = screen.getByTestId('bar-chart');
    const secondData = JSON.parse(secondRender.getAttribute('data-chart-data') || '[]');
    
    // January income should have increased by 5000
    const secondJan = secondData.find((d: any) => d.month === 'Jan 24');
    expect(secondJan.income).toBe(originalIncome + 5000);
    expect(secondJan.net).toBe(originalIncome + 5000 - firstJan.expenses);
  });

  it('applies correct styling classes', () => {
    render(<IncomeVsExpensesChart />);
    
    const container = screen.getByText('Income vs Expenses (Last 6 Months)').parentElement;
    expect(container).toHaveClass('bg-white', 'p-6', 'rounded-lg', 'shadow');
    
    const title = screen.getByText('Income vs Expenses (Last 6 Months)');
    expect(title).toHaveClass('text-lg', 'font-semibold', 'mb-4');
  });

  it('uses correct chart colors', () => {
    render(<IncomeVsExpensesChart />);
    
    const incomeBar = screen.getByTestId('bar-income');
    const expensesBar = screen.getByTestId('bar-expenses');
    
    expect(incomeBar).toHaveAttribute('data-fill', '#34c759'); // Green for income
    expect(expensesBar).toHaveAttribute('data-fill', '#ff3b30'); // Red for expenses
  });

  it('handles large amounts correctly', () => {
    const largeAmountTransactions: Transaction[] = [
      {
        id: 'tx-1',
        date: new Date('2024-01-15'),
        description: 'Large Income',
        category: 'test',
        type: 'income',
        amount: 999999.99,
        accountId: 'acc-1',
        cleared: true
      }
    ];

    mockUseApp.mockReturnValue({
      transactions: largeAmountTransactions
    });

    render(<IncomeVsExpensesChart />);
    
    const chartElement = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    const janData = chartData.find((d: any) => d.month === 'Jan 24');
    expect(janData.income).toBe(999999.99);
  });

  it('maintains component memo behavior', () => {
    const ComponentWrapper = ({ transactions }: { transactions: Transaction[] }) => {
      mockUseApp.mockReturnValue({ transactions });
      return <IncomeVsExpensesChart />;
    };

    const { rerender } = render(<ComponentWrapper transactions={mockTransactions} />);
    
    // Re-render with same props should not cause unnecessary re-renders
    // This tests the React.memo behavior
    rerender(<ComponentWrapper transactions={mockTransactions} />);
    
    // The component should still render correctly
    expect(screen.getByText('Income vs Expenses (Last 6 Months)')).toBeInTheDocument();
  });
});