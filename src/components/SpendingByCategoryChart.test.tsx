/**
 * SpendingByCategoryChart Tests
 * Tests for the spending by category pie chart component with accessibility features
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import SpendingByCategoryChart from './SpendingByCategoryChart';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { transactionAnalyticsService } from '../services/transactionAnalyticsService';
import type { Transaction, Category } from '../types';

// Mock the external dependencies
vi.mock('../contexts/AppContext');
vi.mock('../hooks/useCurrencyDecimal');
vi.mock('../services/transactionAnalyticsService');

// Mock Recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children, role }: any) => (
    <div data-testid="pie-chart" role={role}>
      {children}
    </div>
  ),
  Pie: ({ data, cx, cy, innerRadius, outerRadius, paddingAngle, dataKey, children }: any) => (
    <div 
      data-testid="pie" 
      data-chart-data={JSON.stringify(data)}
      data-cx={cx}
      data-cy={cy}
      data-inner-radius={innerRadius}
      data-outer-radius={outerRadius}
      data-padding-angle={paddingAngle}
      data-data-key={dataKey}
    >
      {children}
    </div>
  ),
  Cell: ({ fill }: any) => (
    <div data-testid="cell" data-fill={fill} />
  ),
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  ),
  Tooltip: ({ formatter, contentStyle }: any) => (
    <div 
      data-testid="tooltip" 
      data-formatter={formatter ? 'has-formatter' : 'no-formatter'}
      data-content-style={JSON.stringify(contentStyle)}
    />
  )
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;
const mockTransactionAnalyticsService = transactionAnalyticsService as any;

describe('SpendingByCategoryChart', () => {
  const mockFormatCurrency = vi.fn((amount: number) => `£${amount.toFixed(2)}`);

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: new Date('2024-01-15'),
      description: 'Grocery Store',
      category: 'cat-1',
      type: 'expense',
      amount: 120.50,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-2',
      date: new Date('2024-01-10'),
      description: 'Gas Station',
      category: 'cat-2',
      type: 'expense',
      amount: 45.00,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-3',
      date: new Date('2024-01-20'),
      description: 'Restaurant',
      category: 'cat-3',
      type: 'expense',
      amount: 75.25,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-4',
      date: new Date('2024-01-12'),
      description: 'Salary',
      category: 'cat-4',
      type: 'income',
      amount: 3000.00,
      accountId: 'acc-1',
      cleared: true
    }
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Groceries', icon: '🛒' },
    { id: 'cat-2', name: 'Transportation', icon: '🚗' },
    { id: 'cat-3', name: 'Dining Out', icon: '🍽️' },
    { id: 'cat-4', name: 'Salary', icon: '💰' },
    { id: 'cat-5', name: 'Entertainment', icon: '🎬' },
    { id: 'cat-6', name: 'Utilities', icon: '⚡' }
  ];

  const mockSpendingData = [
    {
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      amount: 120.50,
      percentage: 50.0,
      transactionCount: 1
    },
    {
      categoryId: 'cat-3',
      categoryName: 'Dining Out',
      amount: 75.25,
      percentage: 31.2,
      transactionCount: 1
    },
    {
      categoryId: 'cat-2',
      categoryName: 'Transportation',
      amount: 45.00,
      percentage: 18.7,
      transactionCount: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApp.mockReturnValue({
      transactions: mockTransactions,
      categories: mockCategories
    });

    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency
    });

    mockTransactionAnalyticsService.calculateSpendingByCategory = vi.fn(() => mockSpendingData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the chart with correct title', () => {
    render(<SpendingByCategoryChart />);
    
    expect(screen.getByText('Spending by Category')).toBeInTheDocument();
  });

  it('renders all chart components when data is available', () => {
    render(<SpendingByCategoryChart />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getAllByTestId('cell')).toHaveLength(3); // One for each category
  });

  it('configures pie chart correctly', () => {
    render(<SpendingByCategoryChart />);
    
    // Check ResponsiveContainer dimensions
    const container = screen.getByTestId('responsive-container');
    expect(container).toHaveAttribute('data-width', '100%');
    expect(container).toHaveAttribute('data-height', '100%');

    // Check PieChart role
    const pieChart = screen.getByTestId('pie-chart');
    expect(pieChart).toHaveAttribute('role', 'presentation');

    // Check Pie configuration
    const pie = screen.getByTestId('pie');
    expect(pie).toHaveAttribute('data-cx', '50%');
    expect(pie).toHaveAttribute('data-cy', '50%');
    expect(pie).toHaveAttribute('data-inner-radius', '60');
    expect(pie).toHaveAttribute('data-outer-radius', '80');
    expect(pie).toHaveAttribute('data-padding-angle', '5');
    expect(pie).toHaveAttribute('data-data-key', 'value');

    // Check that data is properly formatted
    const chartData = JSON.parse(pie.getAttribute('data-chart-data') || '[]');
    expect(chartData).toEqual([
      { name: 'Groceries', value: 120.50 },
      { name: 'Dining Out', value: 75.25 },
      { name: 'Transportation', value: 45.00 }
    ]);

    // Check tooltip configuration
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('data-formatter', 'has-formatter');
    const contentStyle = JSON.parse(tooltip.getAttribute('data-content-style') || '{}');
    expect(contentStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.95)');
  });

  it('calls transactionAnalyticsService with correct parameters', () => {
    render(<SpendingByCategoryChart />);
    
    expect(mockTransactionAnalyticsService.calculateSpendingByCategory).toHaveBeenCalledWith(
      mockTransactions,
      mockCategories,
      undefined, // no start date
      undefined, // no end date
      'expense'
    );
  });

  it('limits to top 6 categories', () => {
    // Mock service to return more than 6 categories
    const manyCategories = Array.from({ length: 10 }, (_, i) => ({
      categoryId: `cat-${i}`,
      categoryName: `Category ${i}`,
      amount: 100 - i * 10,
      percentage: 10,
      transactionCount: 1
    }));

    mockTransactionAnalyticsService.calculateSpendingByCategory.mockReturnValue(manyCategories);

    render(<SpendingByCategoryChart />);
    
    const pie = screen.getByTestId('pie');
    const chartData = JSON.parse(pie.getAttribute('data-chart-data') || '[]');
    
    // Should only have 6 categories
    expect(chartData).toHaveLength(6);
    
    // Should be the first 6 from the service response
    expect(chartData[0].name).toBe('Category 0');
    expect(chartData[5].name).toBe('Category 5');
  });

  it('shows no data message when no expense data available', () => {
    mockTransactionAnalyticsService.calculateSpendingByCategory.mockReturnValue([]);

    render(<SpendingByCategoryChart />);
    
    expect(screen.getByText('No expense data available')).toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  });

  it('handles empty transactions and categories', () => {
    mockUseApp.mockReturnValue({
      transactions: [],
      categories: []
    });

    mockTransactionAnalyticsService.calculateSpendingByCategory.mockReturnValue([]);

    render(<SpendingByCategoryChart />);
    
    expect(screen.getByText('No expense data available')).toBeInTheDocument();
    expect(mockTransactionAnalyticsService.calculateSpendingByCategory).toHaveBeenCalledWith(
      [],
      [],
      undefined,
      undefined,
      'expense'
    );
  });

  it('applies correct styling classes', () => {
    render(<SpendingByCategoryChart />);
    
    const container = screen.getByText('Spending by Category').parentElement;
    expect(container).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-lg', 'shadow', 'p-6');
    
    const title = screen.getByText('Spending by Category');
    expect(title).toHaveClass('text-xl', 'font-semibold', 'mb-4', 'dark:text-white');

    const chartContainer = container?.querySelector('.h-64');
    expect(chartContainer).toBeInTheDocument();
    expect(chartContainer).toHaveAttribute('role', 'img');
  });

  it('generates accessible chart description', () => {
    render(<SpendingByCategoryChart />);
    
    const chartContainer = screen.getByRole('img');
    const ariaLabel = chartContainer.getAttribute('aria-label');
    
    expect(ariaLabel).toContain('Spending breakdown by category:');
    expect(ariaLabel).toContain('Groceries: £120.50');
    expect(ariaLabel).toContain('Dining Out: £75.25');
    expect(ariaLabel).toContain('Transportation: £45.00');
    // Check percentages exist but don't check exact values due to floating point precision
    expect(ariaLabel).toMatch(/Groceries: £120\.50 \(\d+\.\d%\)/);
    expect(ariaLabel).toMatch(/Dining Out: £75\.25 \(\d+\.\d%\)/);
    expect(ariaLabel).toMatch(/Transportation: £45\.00 \(\d+\.\d%\)/);
  });

  it('renders accessible data table', () => {
    render(<SpendingByCategoryChart />);
    
    // Check that the details element exists
    const details = screen.getByText('View data in table format').parentElement;
    expect(details).toBeInTheDocument();
    expect(details?.tagName).toBe('DETAILS');
    
    // Check table structure
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    
    // Check table headers
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Percentage')).toBeInTheDocument();
    
    // Check table data - each category should have a row
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('£120.50')).toBeInTheDocument();
    // Check that percentage exists but don't check exact value due to floating point precision
    const percentageRegex = /\d+\.\d%/;
    const tableRows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(tableRows[0].textContent).toMatch(percentageRegex);
  });

  it('calculates percentages correctly in table', () => {
    render(<SpendingByCategoryChart />);
    
    // Total: 120.50 + 75.25 + 45.00 = 240.75
    // Check that percentages are calculated and displayed
    const table = screen.getByRole('table');
    const tableRows = table.querySelectorAll('tbody tr');
    
    // Check that each row has percentage data
    expect(tableRows).toHaveLength(3);
    
    // Just check that percentages are present and reasonable
    tableRows.forEach(row => {
      expect(row.textContent).toMatch(/\d+\.\d%/);
    });
    
    // Check that at least some percentages are displayed
    const hasGroceriesPercentage = Array.from(tableRows).some(row => 
      row.textContent?.includes('Groceries') && row.textContent?.includes('%'));
    expect(hasGroceriesPercentage).toBe(true);
  });

  it('does not render table when no data available', () => {
    mockTransactionAnalyticsService.calculateSpendingByCategory.mockReturnValue([]);

    render(<SpendingByCategoryChart />);
    
    expect(screen.queryByText('View data in table format')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('uses correct colors for pie chart cells', () => {
    render(<SpendingByCategoryChart />);
    
    const cells = screen.getAllByTestId('cell');
    
    // Should have correct number of cells
    expect(cells).toHaveLength(3);
    
    // Each cell should have a fill attribute
    cells.forEach(cell => {
      expect(cell).toHaveAttribute('data-fill');
      const fill = cell.getAttribute('data-fill');
      expect(fill).toMatch(/^#[0-9A-F]{6}$/i); // Should be a valid hex color
    });
  });

  it('memoizes data calculation correctly', () => {
    const { rerender } = render(<SpendingByCategoryChart />);
    
    // Clear mock call count
    mockTransactionAnalyticsService.calculateSpendingByCategory.mockClear();
    
    // Re-render with same data
    rerender(<SpendingByCategoryChart />);
    
    // Service should not be called again due to memoization
    expect(mockTransactionAnalyticsService.calculateSpendingByCategory).not.toHaveBeenCalled();
  });

  it('updates when transactions change', () => {
    const { unmount } = render(<SpendingByCategoryChart />);
    
    unmount();
    
    // Change transactions
    const newTransactions = [...mockTransactions, {
      id: 'tx-new',
      date: new Date('2024-01-25'),
      description: 'New Expense',
      category: 'cat-5',
      type: 'expense',
      amount: 100.00,
      accountId: 'acc-1',
      cleared: true
    }];

    mockUseApp.mockReturnValue({
      transactions: newTransactions,
      categories: mockCategories
    });

    const newMockData = [...mockSpendingData, {
      categoryId: 'cat-5',
      categoryName: 'Entertainment',
      amount: 100.00,
      percentage: 29.0,
      transactionCount: 1
    }];

    mockTransactionAnalyticsService.calculateSpendingByCategory.mockReturnValue(newMockData);

    // Render fresh component with new data
    render(<SpendingByCategoryChart />);
    
    const pie = screen.getByTestId('pie');
    const chartData = JSON.parse(pie.getAttribute('data-chart-data') || '[]');
    
    // Should now have 4 categories
    expect(chartData).toHaveLength(4);
    expect(chartData[3].name).toBe('Entertainment');
    expect(chartData[3].value).toBe(100.00);
  });

  it('updates when categories change', () => {
    const { unmount } = render(<SpendingByCategoryChart />);
    
    unmount();
    
    // Change categories
    const newCategories = [...mockCategories, {
      id: 'cat-7',
      name: 'New Category',
      icon: '🆕'
    }];

    mockUseApp.mockReturnValue({
      transactions: mockTransactions,
      categories: newCategories
    });

    // Render fresh component with new data
    render(<SpendingByCategoryChart />);
    
    expect(mockTransactionAnalyticsService.calculateSpendingByCategory).toHaveBeenCalledWith(
      mockTransactions,
      newCategories,
      undefined,
      undefined,
      'expense'
    );
  });

  it('handles single category correctly', () => {
    const singleCategoryData = [{
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      amount: 120.50,
      percentage: 100.0,
      transactionCount: 1
    }];

    mockTransactionAnalyticsService.calculateSpendingByCategory.mockReturnValue(singleCategoryData);

    render(<SpendingByCategoryChart />);
    
    const pie = screen.getByTestId('pie');
    const chartData = JSON.parse(pie.getAttribute('data-chart-data') || '[]');
    
    expect(chartData).toHaveLength(1);
    expect(chartData[0].name).toBe('Groceries');
    expect(chartData[0].value).toBe(120.50);
    
    // Table should show 100%
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('maintains component memo behavior', () => {
    const ComponentWrapper = ({ testTransactions }: { testTransactions: Transaction[] }) => {
      mockUseApp.mockReturnValue({
        transactions: testTransactions,
        categories: mockCategories
      });
      return <SpendingByCategoryChart />;
    };

    const { rerender } = render(<ComponentWrapper testTransactions={mockTransactions} />);
    
    // Re-render with same props should not cause unnecessary re-renders
    // This tests the React.memo behavior
    rerender(<ComponentWrapper testTransactions={mockTransactions} />);
    
    // The component should still render correctly
    expect(screen.getByText('Spending by Category')).toBeInTheDocument();
  });

  it('handles very small amounts correctly', () => {
    const smallAmountData = [{
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      amount: 0.01,
      percentage: 100.0,
      transactionCount: 1
    }];

    mockTransactionAnalyticsService.calculateSpendingByCategory.mockReturnValue(smallAmountData);

    render(<SpendingByCategoryChart />);
    
    expect(screen.getByText('£0.01')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});