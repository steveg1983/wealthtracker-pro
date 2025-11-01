/**
 * CashFlowWidget Tests
 * Tests for the cash flow widget component with forecasting and multiple size variants
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import CashFlowWidget from './CashFlowWidget';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction } from '../../types';

// Mock the external dependencies
vi.mock('../../contexts/AppContext');
vi.mock('../../hooks/useCurrencyDecimal');

// Mock icons
vi.mock('../../components/icons', () => ({
  TrendingUpIcon: ({ size }: { size?: number }) => (
    <div data-testid="trending-up-icon" data-size={size} />
  ),
  TrendingDownIcon: ({ size }: { size?: number }) => (
    <div data-testid="trending-down-icon" data-size={size} />
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="alert-circle-icon" data-size={size} className={className} />
  )
}));

// Mock Recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ type, dataKey, stroke, strokeWidth, dot, strokeDasharray }: any) => (
    <div 
      data-testid="line" 
      data-type={type} 
      data-key={dataKey} 
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-dot={JSON.stringify(dot)}
      data-stroke-dasharray={strokeDasharray}
    />
  ),
  XAxis: ({ dataKey, stroke, fontSize }: any) => (
    <div data-testid="x-axis" data-key={dataKey} data-stroke={stroke} data-font-size={fontSize} />
  ),
  YAxis: ({ stroke, fontSize, tickFormatter }: any) => (
    <div 
      data-testid="y-axis" 
      data-stroke={stroke} 
      data-font-size={fontSize}
      data-formatter={tickFormatter ? 'has-formatter' : 'no-formatter'}
    />
  ),
  ReferenceLine: ({ y, stroke, strokeDasharray }: any) => (
    <div 
      data-testid="reference-line" 
      data-y={y} 
      data-stroke={stroke}
      data-stroke-dasharray={strokeDasharray}
    />
  ),
  Tooltip: ({ formatter, labelFormatter, contentStyle }: any) => (
    <div 
      data-testid="tooltip" 
      data-formatter={formatter ? 'has-formatter' : 'no-formatter'}
      data-label-formatter={labelFormatter ? 'has-label-formatter' : 'no-label-formatter'}
      data-content-style={JSON.stringify(contentStyle)}
    />
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

// Mock Math.random for consistent testing
const mockRandom = vi.fn();
global.Math.random = mockRandom;

describe('CashFlowWidget', () => {
  const mockFormatCurrency = vi.fn((amount: any) => {
    const value = typeof amount === 'number' ? amount : amount.toNumber();
    return `£${value.toFixed(2)}`;
  });

  const mockTransactions: Transaction[] = [
    // January 2024 transactions
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
      date: new Date('2024-01-20'),
      description: 'Groceries',
      category: 'food',
      type: 'expense',
      amount: 300,
      accountId: 'acc-1',
      cleared: true
    },
    // December 2023 transactions
    {
      id: 'tx-4',
      date: new Date('2023-12-15'),
      description: 'Salary',
      category: 'income',
      type: 'income',
      amount: 3000,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-5',
      date: new Date('2023-12-10'),
      description: 'Rent',
      category: 'housing',
      type: 'expense',
      amount: 1200,
      accountId: 'acc-1',
      cleared: true
    },
    // November 2023 transactions
    {
      id: 'tx-6',
      date: new Date('2023-11-15'),
      description: 'Salary',
      category: 'income',
      type: 'income',
      amount: 3000,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-7',
      date: new Date('2023-11-10'),
      description: 'Rent',
      category: 'housing',
      type: 'expense',
      amount: 1200,
      accountId: 'acc-1',
      cleared: true
    }
  ];

  const defaultProps = {
    size: 'medium' as const,
    settings: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock current date to be January 25, 2024 for consistent testing
    const mockDate = new Date('2024-01-25');
    vi.setSystemTime(mockDate);

    // Mock Math.random to return predictable values
    mockRandom
      .mockReturnValueOnce(0.5)  // First income variation
      .mockReturnValueOnce(0.5)  // First expense variation
      .mockReturnValueOnce(0.3)  // Second income variation
      .mockReturnValueOnce(0.7)  // Second expense variation
      .mockReturnValueOnce(0.4)  // Third income variation
      .mockReturnValueOnce(0.6)  // Third expense variation
      .mockReturnValueOnce(0.2)  // Fourth income variation
      .mockReturnValueOnce(0.8)  // Fourth expense variation
      .mockReturnValueOnce(0.1)  // Fifth income variation
      .mockReturnValueOnce(0.9)  // Fifth expense variation
      .mockReturnValueOnce(0.45) // Sixth income variation
      .mockReturnValueOnce(0.55);// Sixth expense variation

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

  describe('Small Size', () => {
    it('renders small widget with current month flow', () => {
      render(<CashFlowWidget size="small" settings={{}} />);
      
      // Should display "This Month" label
      expect(screen.getByText('This Month')).toBeInTheDocument();
      
      // Current month flow = income - expenses = 3000 - (1200 + 300) = 1500
      expect(screen.getByText('£1500.00')).toBeInTheDocument();
      
      // Should show trending up icon for positive flow
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('trending-down-icon')).not.toBeInTheDocument();
    });

    it('shows projected average in small size', () => {
      render(<CashFlowWidget size="small" settings={{}} />);
      
      // Should show projected flow with "Proj:" prefix
      // Get the span that contains "Proj:" text
      const projectedSpan = screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && content.startsWith('Proj:');
      });
      expect(projectedSpan).toBeInTheDocument();
      
      // Should include a currency value after "Proj:"
      expect(projectedSpan.textContent).toMatch(/Proj: £[\d,]+\.[\d]{2}/);
    });

    it('shows negative flow with down icon and red styling', () => {
      // Create transactions that result in negative cash flow
      const negativeFlowTransactions = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Salary',
          category: 'income',
          type: 'income' as const,
          amount: 1000,
          accountId: 'acc-1',
          cleared: true
        },
        {
          id: 'tx-2',
          date: new Date('2024-01-10'),
          description: 'Big Expense',
          category: 'expense',
          type: 'expense' as const,
          amount: 2000,
          accountId: 'acc-1',
          cleared: true
        }
      ];

      mockUseApp.mockReturnValue({
        transactions: negativeFlowTransactions
      });

      render(<CashFlowWidget size="small" settings={{}} />);
      
      // Should show negative amount (1000 - 2000 = -1000)
      expect(screen.getByText('£-1000.00')).toBeInTheDocument();
      
      // Should have red styling
      const amountElement = screen.getByText('£-1000.00');
      expect(amountElement).toHaveClass('text-red-600', 'dark:text-red-400');
      
      // Should show trending down icon
      expect(screen.getByTestId('trending-down-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('trending-up-icon')).not.toBeInTheDocument();
    });

    it('applies correct styling classes', () => {
      render(<CashFlowWidget size="small" settings={{}} />);
      
      const container = screen.getByText('This Month').parentElement;
      expect(container).toHaveClass('text-center');
      
      const monthLabel = screen.getByText('This Month');
      expect(monthLabel).toHaveClass('text-sm', 'text-gray-600', 'dark:text-gray-400', 'mb-1');
      
      const amountElement = screen.getByText('£1500.00');
      expect(amountElement).toHaveClass('text-2xl', 'font-bold', 'mb-2', 'text-green-600', 'dark:text-green-400');
    });

    it('does not show chart or detailed breakdown in small size', () => {
      render(<CashFlowWidget size="small" settings={{}} />);
      
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    });
  });

  describe('Medium Size', () => {
    it('renders medium widget with averages', () => {
      render(<CashFlowWidget size="medium" settings={{}} />);
      
      // Should display current month flow
      expect(screen.getByText('Current Month Flow')).toBeInTheDocument();
      
      // Get the current month flow value specifically from the main display area
      const currentFlowContainer = screen.getByText('Current Month Flow').parentElement;
      const currentFlowValue = currentFlowContainer?.querySelector('.text-2xl');
      expect(currentFlowValue).toHaveTextContent('£1500.00');
      
      // Should show projected average
      expect(screen.getByText('Projected Avg')).toBeInTheDocument();
      
      // Should show average income and expenses
      expect(screen.getByText('Avg Income')).toBeInTheDocument();
      expect(screen.getByText('Avg Expenses')).toBeInTheDocument();
    });

    it('calculates and displays averages correctly', () => {
      render(<CashFlowWidget size="medium" settings={{}} />);
      
      // The component calculates averages over the last 6 months
      // Should show these labels with currency values
      const avgIncomeLabel = screen.getByText('Avg Income');
      const avgExpensesLabel = screen.getByText('Avg Expenses');
      
      // Get the next sibling which should contain the value
      const avgIncomeValue = avgIncomeLabel.nextElementSibling;
      const avgExpensesValue = avgExpensesLabel.nextElementSibling;
      
      expect(avgIncomeValue).toHaveClass('font-medium', 'text-green-600');
      expect(avgExpensesValue).toHaveClass('font-medium', 'text-red-600');
      
      // Values should be formatted as currency
      expect(avgIncomeValue?.textContent).toMatch(/£[\d,]+\.[\d]{2}/);
      expect(avgExpensesValue?.textContent).toMatch(/£[\d,]+\.[\d]{2}/);
    });

    it('shows warning for negative projected cash flow', () => {
      // Create transactions that result in negative average flow
      const negativeAvgTransactions = mockTransactions.map(t => ({
        ...t,
        amount: t.type === 'expense' ? t.amount * 3 : t.amount // Triple all expenses
      }));

      mockUseApp.mockReturnValue({
        transactions: negativeAvgTransactions
      });

      render(<CashFlowWidget size="medium" settings={{}} />);
      
      // Should show warning alert
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Projected negative cash flow')).toBeInTheDocument();
    });

    it('does not show chart in medium size', () => {
      render(<CashFlowWidget size="medium" settings={{}} />);
      
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    });

    it('applies correct styling classes for medium size', () => {
      const { container } = render(<CashFlowWidget size="medium" settings={{}} />);
      
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass('h-full', 'flex', 'flex-col');
    });
  });

  describe('Large Size', () => {
    it('renders large widget with chart', () => {
      render(<CashFlowWidget size="large" settings={{}} />);
      
      // Should display current month flow and projected avg
      expect(screen.getByText('Current Month Flow')).toBeInTheDocument();
      expect(screen.getByText('Projected Avg')).toBeInTheDocument();
      
      // Should show chart components
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
      expect(screen.getByTestId('reference-line')).toBeInTheDocument();
      
      // Should have three lines (income, expenses, net flow)
      expect(screen.getAllByTestId('line')).toHaveLength(3);
    });

    it('configures chart components correctly', () => {
      render(<CashFlowWidget size="large" settings={{}} />);
      
      // Check ResponsiveContainer
      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveAttribute('data-width', '100%');
      expect(container).toHaveAttribute('data-height', '100%');

      // Check axes
      const xAxis = screen.getByTestId('x-axis');
      expect(xAxis).toHaveAttribute('data-key', 'month');
      expect(xAxis).toHaveAttribute('data-stroke', '#9CA3AF');
      expect(xAxis).toHaveAttribute('data-font-size', '12');

      const yAxis = screen.getByTestId('y-axis');
      expect(yAxis).toHaveAttribute('data-stroke', '#9CA3AF');
      expect(yAxis).toHaveAttribute('data-formatter', 'has-formatter');

      // Check reference line at y=0
      const refLine = screen.getByTestId('reference-line');
      expect(refLine).toHaveAttribute('data-y', '0');
      expect(refLine).toHaveAttribute('data-stroke', '#9CA3AF');
      expect(refLine).toHaveAttribute('data-stroke-dasharray', '3 3');

      // Check lines
      const lines = screen.getAllByTestId('line');
      
      // Income line (green)
      expect(lines[0]).toHaveAttribute('data-key', 'income');
      expect(lines[0]).toHaveAttribute('data-stroke', '#10B981');
      expect(lines[0]).toHaveAttribute('data-stroke-width', '2');
      
      // Expenses line (red)
      expect(lines[1]).toHaveAttribute('data-key', 'expenses');
      expect(lines[1]).toHaveAttribute('data-stroke', '#EF4444');
      
      // Net flow line (blue)
      expect(lines[2]).toHaveAttribute('data-key', 'netFlow');
      expect(lines[2]).toHaveAttribute('data-stroke', '#3B82F6');
    });

    it('generates correct chart data with historical and forecast', () => {
      render(<CashFlowWidget size="large" settings={{}} />);
      
      const chartElement = screen.getByTestId('line-chart');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
      
      // Default forecast period is 6, so total should be 6 historical + 6 forecast = 12
      expect(chartData).toHaveLength(12);
      
      // Check historical data (first 6 points)
      const historicalData = chartData.slice(0, 6);
      historicalData.forEach((point: any) => {
        expect(point).toHaveProperty('month');
        expect(point).toHaveProperty('income');
        expect(point).toHaveProperty('expenses');
        expect(point).toHaveProperty('netFlow');
        expect(point).toHaveProperty('date');
        expect(point.type).toBe('historical');
      });
      
      // Check forecast data (last 6 points)
      const forecastData = chartData.slice(6);
      forecastData.forEach((point: any) => {
        expect(point).toHaveProperty('month');
        expect(point).toHaveProperty('income');
        expect(point).toHaveProperty('expenses');
        expect(point).toHaveProperty('netFlow');
        expect(point).toHaveProperty('date');
        expect(point.type).toBe('forecast');
      });
    });

    it('respects custom forecast period setting', () => {
      render(<CashFlowWidget size="large" settings={{ forecastPeriod: 3 }} />);
      
      const chartElement = screen.getByTestId('line-chart');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
      
      // Should have 6 historical + 3 forecast = 9 total
      expect(chartData).toHaveLength(9);
      
      // Verify last 3 are forecast
      const forecastData = chartData.slice(6);
      expect(forecastData).toHaveLength(3);
      forecastData.forEach((point: any) => {
        expect(point.type).toBe('forecast');
      });
    });

    it('shows warning alert for negative projected flow', () => {
      // Create transactions that result in negative average flow
      const negativeAvgTransactions = mockTransactions.map(t => ({
        ...t,
        amount: t.type === 'expense' ? t.amount * 3 : t.amount
      }));

      mockUseApp.mockReturnValue({
        transactions: negativeAvgTransactions
      });

      render(<CashFlowWidget size="large" settings={{}} />);
      
      // Should show warning section
      const warning = screen.getByText('Projected negative cash flow');
      expect(warning).toBeInTheDocument();
      
      // Should have warning icon
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      
      // Warning container should have correct styling
      const warningContainer = warning.closest('div.mt-4');
      expect(warningContainer).toHaveClass('p-3', 'bg-red-50', 'dark:bg-red-900/20');
    });
  });

  describe('Data Processing', () => {
    it('calculates current month flow correctly', () => {
      render(<CashFlowWidget {...defaultProps} />);
      
      // January 2024: Income 3000 - Expenses (1200 + 300) = 1500
      // Get the specific current month flow value
      const currentFlowContainer = screen.getByText('Current Month Flow').parentElement;
      const currentFlowValue = currentFlowContainer?.querySelector('.text-2xl');
      expect(currentFlowValue).toHaveTextContent('£1500.00');
    });

    it('calculates historical averages correctly', () => {
      render(<CashFlowWidget size="medium" settings={{}} />);
      
      // The widget should calculate averages over the last 6 months
      // and display them in the grid
      expect(screen.getByText('Avg Income')).toBeInTheDocument();
      expect(screen.getByText('Avg Expenses')).toBeInTheDocument();
    });

    it('handles empty transactions', () => {
      mockUseApp.mockReturnValue({
        transactions: []
      });

      render(<CashFlowWidget {...defaultProps} />);
      
      // Should show £0.00 for current month - get specific element
      const currentFlowContainer = screen.getByText('Current Month Flow').parentElement;
      const currentFlowValue = currentFlowContainer?.querySelector('.text-2xl');
      expect(currentFlowValue).toHaveTextContent('£0.00');
    });

    it('handles transactions with decimal amounts', () => {
      const decimalTransactions = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Salary',
          category: 'income',
          type: 'income' as const,
          amount: 3000.55,
          accountId: 'acc-1',
          cleared: true
        },
        {
          id: 'tx-2',
          date: new Date('2024-01-10'),
          description: 'Expense',
          category: 'expense',
          type: 'expense' as const,
          amount: 1234.89,
          accountId: 'acc-1',
          cleared: true
        }
      ];

      mockUseApp.mockReturnValue({
        transactions: decimalTransactions
      });

      render(<CashFlowWidget size="small" settings={{}} />);
      
      // 3000.55 - 1234.89 = 1765.66
      expect(screen.getByText('£1765.66')).toBeInTheDocument();
    });

    it('filters transactions by date correctly', () => {
      // Add some past transactions that should only affect historical data
      const mixedTransactions = [
        ...mockTransactions,
        {
          id: 'tx-old',
          date: new Date('2023-06-15'), // Old transaction
          description: 'Old Income',
          category: 'income',
          type: 'income' as const,
          amount: 5000,
          accountId: 'acc-1',
          cleared: true
        }
      ];

      mockUseApp.mockReturnValue({
        transactions: mixedTransactions
      });

      render(<CashFlowWidget size="small" settings={{}} />);
      
      // The widget shows transactions from current month start onwards
      // Current date is mocked as January 25, 2024
      // So it includes all January 2024 transactions (including those after the 25th)
      // January: Income 3000 - Expenses (1200 + 300) = 1500
      const thisMonthElement = screen.getByText('This Month');
      const amountElement = thisMonthElement.parentElement?.querySelector('.text-2xl');
      expect(amountElement).toHaveTextContent('£1500.00');
    });
  });

  describe('Forecasting', () => {
    it('applies variation to forecast data', () => {
      render(<CashFlowWidget size="large" settings={{}} />);
      
      const chartElement = screen.getByTestId('line-chart');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
      
      // Get forecast data
      const forecastData = chartData.slice(6);
      
      // Since we mocked Math.random, we can verify the variations were applied
      forecastData.forEach((point: any) => {
        expect(point.income).toBeGreaterThan(0);
        expect(point.expenses).toBeGreaterThan(0);
        // Net flow should be income - expenses
        expect(point.netFlow).toBeCloseTo(point.income - point.expenses, 5);
      });
    });

    it('generates consistent month labels', () => {
      render(<CashFlowWidget size="large" settings={{}} />);
      
      const chartElement = screen.getByTestId('line-chart');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
      
      // All points should have month labels
      chartData.forEach((point: any) => {
        expect(point.month).toMatch(/^[A-Za-z]{3}$/); // Three letter month abbreviation
      });
    });
  });

  describe('Styling and Layout', () => {
    it('applies correct container classes for different sizes', () => {
      const { container, rerender } = render(<CashFlowWidget size="small" settings={{}} />);
      
      // Small size
      let rootElement = container.firstChild as HTMLElement;
      expect(rootElement).toHaveClass('text-center');
      
      // Medium size
      rerender(<CashFlowWidget size="medium" settings={{}} />);
      rootElement = container.firstChild as HTMLElement;
      expect(rootElement).toHaveClass('h-full', 'flex', 'flex-col');
      
      // Large size
      rerender(<CashFlowWidget size="large" settings={{}} />);
      rootElement = container.firstChild as HTMLElement;
      expect(rootElement).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('uses correct colors for positive/negative values', () => {
      render(<CashFlowWidget size="small" settings={{}} />);
      
      // Positive flow should be green
      const positiveAmount = screen.getByText('£1500.00');
      expect(positiveAmount).toHaveClass('text-green-600', 'dark:text-green-400');
      
      // Projected flow indicator should also have appropriate color
      const projectedContainer = screen.getByText(/Proj:/).parentElement;
      expect(projectedContainer).toHaveClass('text-green-600', 'dark:text-green-400');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid transaction data gracefully', () => {
      const invalidTransactions = [
        {
          id: 'tx-1',
          date: null, // Invalid date
          description: 'Invalid',
          category: 'income',
          type: 'income' as const,
          amount: 1000,
          accountId: 'acc-1',
          cleared: true
        }
      ] as any;

      mockUseApp.mockReturnValue({
        transactions: invalidTransactions
      });

      expect(() => {
        render(<CashFlowWidget {...defaultProps} />);
      }).not.toThrow();
    });

    it('handles transactions with missing amount', () => {
      const missingAmountTransactions = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Missing Amount',
          category: 'income',
          type: 'income' as const,
          amount: undefined, // Missing amount
          accountId: 'acc-1',
          cleared: true
        }
      ] as any;

      mockUseApp.mockReturnValue({
        transactions: missingAmountTransactions
      });

      expect(() => {
        render(<CashFlowWidget {...defaultProps} />);
      }).not.toThrow();
    });
  });

  describe('Memoization', () => {
    it('memoizes calculations based on transactions and forecast period', () => {
      const { rerender } = render(<CashFlowWidget size="medium" settings={{}} />);
      
      // Initial render - get specific current month flow value
      const currentFlowContainer = screen.getByText('Current Month Flow').parentElement;
      const currentFlowValue = currentFlowContainer?.querySelector('.text-2xl');
      expect(currentFlowValue).toHaveTextContent('£1500.00');
      
      // Re-render with same props - should use memoized values
      rerender(<CashFlowWidget size="medium" settings={{}} />);
      expect(currentFlowValue).toHaveTextContent('£1500.00');
      
      // Change forecast period - should recalculate
      rerender(<CashFlowWidget size="medium" settings={{ forecastPeriod: 12 }} />);
      // Should still show same current month flow
      expect(currentFlowValue).toHaveTextContent('£1500.00');
    });
  });
});
