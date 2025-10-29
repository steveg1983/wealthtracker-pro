/**
 * CashFlowForecast Tests
 * Tests for the cash flow forecast component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import CashFlowForecast from './CashFlowForecast';
// import { format } from 'date-fns'; // Unused import
import { toDecimal } from '../utils/decimal';

// Mock icons
vi.mock('./icons', () => ({
  TrendingUpIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="trending-up-icon" className={className} style={{ fontSize: size }}>📈</span>
  ),
  TrendingDownIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="trending-down-icon" className={className} style={{ fontSize: size }}>📉</span>
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="alert-circle-icon" className={className} style={{ fontSize: size }}>⚠️</span>
  ),
  CalendarIcon: ({ size }: { size?: number }) => (
    <span data-testid="calendar-icon" style={{ fontSize: size }}>📅</span>
  ),
  RefreshCwIcon: ({ size }: { size?: number }) => (
    <span data-testid="refresh-icon" style={{ fontSize: size }}>🔄</span>
  ),
  PlusIcon: ({ size }: { size?: number }) => (
    <span data-testid="plus-icon" style={{ fontSize: size }}>➕</span>
  ),
  EditIcon: ({ size }: { size?: number }) => (
    <span data-testid="edit-icon" style={{ fontSize: size }}>✏️</span>
  ),
  DeleteIcon: ({ size }: { size?: number }) => (
    <span data-testid="delete-icon" style={{ fontSize: size }}>🗑️</span>
  ),
  ChevronRightIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="chevron-right-icon" className={className} style={{ fontSize: size }}>›</span>
  ),
  ActivityIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="activity-icon" className={className} style={{ fontSize: size }}>📊</span>
  )
}));

// Mock LoadingState component
vi.mock('./loading/LoadingState', () => ({
  LoadingState: ({ message }: { message: string }) => (
    <div data-testid="loading-state">{message}</div>
  )
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null
}));

// Mock hooks
const mockFormatCurrency = vi.fn((value: any) => {
  const num = typeof value === 'object' && value?.toNumber ? value.toNumber() : Number(value);
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(num);
});

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: mockFormatCurrency
  })
}));

// Mock forecast data
const mockForecast = {
  projections: [
    {
      date: new Date('2024-01-15'),
      projectedBalance: toDecimal(5000),
      projectedIncome: toDecimal(3000),
      projectedExpenses: toDecimal(2500),
      confidence: 85
    },
    {
      date: new Date('2024-01-22'),
      projectedBalance: toDecimal(5500),
      projectedIncome: toDecimal(0),
      projectedExpenses: toDecimal(500),
      confidence: 80
    },
    {
      date: new Date('2024-01-29'),
      projectedBalance: toDecimal(5000),
      projectedIncome: toDecimal(0),
      projectedExpenses: toDecimal(500),
      confidence: 75
    }
  ],
  summary: {
    projectedEndBalance: toDecimal(8000),
    averageMonthlyIncome: toDecimal(3000),
    averageMonthlyExpenses: toDecimal(2500),
    averageMonthlySavings: toDecimal(500),
    lowestProjectedBalance: toDecimal(4500),
    lowestBalanceDate: new Date('2024-02-15')
  },
  recurringPatterns: [
    {
      id: '1',
      type: 'income' as const,
      description: 'Monthly Salary',
      amount: toDecimal(3000),
      frequency: 'monthly' as const,
      nextOccurrence: new Date('2024-02-01'),
      confidence: 95
    },
    {
      id: '2',
      type: 'expense' as const,
      description: 'Rent Payment',
      amount: toDecimal(1200),
      frequency: 'monthly' as const,
      nextOccurrence: new Date('2024-02-01'),
      confidence: 98
    }
  ]
};

const mockUseCashFlowForecast = vi.fn();

vi.mock('../hooks/useCashFlowForecast', () => ({
  useCashFlowForecast: (props: any) => mockUseCashFlowForecast(props)
}));

describe('CashFlowForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCashFlowForecast.mockReturnValue({
      forecast: mockForecast,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      updatePattern: vi.fn(),
      removePattern: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Error States', () => {
    it('shows loading state', () => {
      mockUseCashFlowForecast.mockReturnValue({
        forecast: null,
        isLoading: true,
        error: null,
        refresh: vi.fn(),
        updatePattern: vi.fn(),
        removePattern: vi.fn()
      });

      render(<CashFlowForecast />);
      
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Analyzing cash flow patterns...')).toBeInTheDocument();
    });

    it('shows error state', () => {
      mockUseCashFlowForecast.mockReturnValue({
        forecast: null,
        isLoading: false,
        error: 'Failed to load forecast data',
        refresh: vi.fn(),
        updatePattern: vi.fn(),
        removePattern: vi.fn()
      });

      render(<CashFlowForecast />);
      
      expect(screen.getByText('Failed to load forecast data')).toBeInTheDocument();
    });

    it('renders nothing when no forecast data', () => {
      mockUseCashFlowForecast.mockReturnValue({
        forecast: null,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        updatePattern: vi.fn(),
        removePattern: vi.fn()
      });

      const { container } = render(<CashFlowForecast />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Header Section', () => {
    it('renders title and description', () => {
      render(<CashFlowForecast />);
      
      expect(screen.getByText('Cash Flow Forecast')).toBeInTheDocument();
      expect(screen.getByText('Based on your transaction history and detected patterns')).toBeInTheDocument();
    });

    it('renders month selector with options', () => {
      render(<CashFlowForecast />);
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('6');
      
      expect(screen.getByText('3 months')).toBeInTheDocument();
      expect(screen.getByText('6 months')).toBeInTheDocument();
      expect(screen.getByText('12 months')).toBeInTheDocument();
    });

    it('changes forecast months when selecting different option', () => {
      render(<CashFlowForecast />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '12' } });
      
      expect(mockUseCashFlowForecast).toHaveBeenCalledWith(
        expect.objectContaining({ months: 12 })
      );
    });

    it('calls refresh when refresh button clicked', () => {
      const mockRefresh = vi.fn();
      mockUseCashFlowForecast.mockReturnValue({
        forecast: mockForecast,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        updatePattern: vi.fn(),
        removePattern: vi.fn()
      });

      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByTitle('Refresh forecast'));
      
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Summary Cards', () => {
    it('displays projected end balance', () => {
      render(<CashFlowForecast />);
      
      expect(screen.getByText('Projected End Balance')).toBeInTheDocument();
      expect(screen.getByText('$8,000.00')).toBeInTheDocument();
      expect(screen.getByText('in 6 months')).toBeInTheDocument();
    });

    it('displays average monthly income', () => {
      render(<CashFlowForecast />);
      
      expect(screen.getByText('Avg Monthly Income')).toBeInTheDocument();
      expect(screen.getByText('+$3,000.00')).toBeInTheDocument();
    });

    it('displays average monthly expenses', () => {
      render(<CashFlowForecast />);
      
      expect(screen.getByText('Avg Monthly Expenses')).toBeInTheDocument();
      expect(screen.getByText('-$2,500.00')).toBeInTheDocument();
    });

    it('displays average monthly savings with positive color', () => {
      render(<CashFlowForecast />);
      
      expect(screen.getByText('Avg Monthly Savings')).toBeInTheDocument();
      expect(screen.getByText('+$500.00')).toBeInTheDocument();
      expect(screen.getByText('+$500.00')).toHaveClass('text-green-600');
    });

    it('displays average monthly savings with negative color', () => {
      mockUseCashFlowForecast.mockReturnValue({
        forecast: {
          ...mockForecast,
          summary: {
            ...mockForecast.summary,
            averageMonthlySavings: toDecimal(-200)
          }
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        updatePattern: vi.fn(),
        removePattern: vi.fn()
      });

      render(<CashFlowForecast />);
      
      expect(screen.getByText('-$200.00')).toHaveClass('text-red-600');
    });
  });

  describe('Low Balance Alert', () => {
    it('shows alert when projected balance is negative', () => {
      mockUseCashFlowForecast.mockReturnValue({
        forecast: {
          ...mockForecast,
          summary: {
            ...mockForecast.summary,
            lowestProjectedBalance: toDecimal(-500),
            lowestBalanceDate: new Date('2024-02-15')
          }
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        updatePattern: vi.fn(),
        removePattern: vi.fn()
      });

      render(<CashFlowForecast />);
      
      expect(screen.getByText('Projected Negative Balance')).toBeInTheDocument();
      expect(screen.getByText(/Your balance is projected to reach/)).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    it('does not show alert when balance stays positive', () => {
      render(<CashFlowForecast />);
      
      expect(screen.queryByText('Projected Negative Balance')).not.toBeInTheDocument();
    });
  });

  describe('Chart Section', () => {
    it('renders balance projection chart', () => {
      render(<CashFlowForecast />);
      
      expect(screen.getByText('Balance Projection')).toBeInTheDocument();
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  describe('Recurring Patterns', () => {
    it('shows pattern count in header', () => {
      render(<CashFlowForecast />);
      
      expect(screen.getByText('Detected Patterns (2)')).toBeInTheDocument();
    });

    it('toggles pattern details visibility', () => {
      render(<CashFlowForecast />);
      
      expect(screen.queryByText('Income Patterns (1)')).not.toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Show Details'));
      
      expect(screen.getByText('Income Patterns (1)')).toBeInTheDocument();
      expect(screen.getByText('Expense Patterns (1)')).toBeInTheDocument();
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });

    it('displays income patterns when expanded', () => {
      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByText('Show Details'));
      
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      expect(screen.getByText(/\$3,000\.00.*monthly/)).toBeInTheDocument();
    });

    it('displays expense patterns when expanded', () => {
      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByText('Show Details'));
      
      expect(screen.getByText('Rent Payment')).toBeInTheDocument();
      expect(screen.getByText(/\$1,200\.00.*monthly/)).toBeInTheDocument();
    });

    it('shows pattern confidence', () => {
      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByText('Show Details'));
      
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('98%')).toBeInTheDocument();
    });

    it('calls removePattern when delete button clicked', () => {
      const mockRemovePattern = vi.fn();
      mockUseCashFlowForecast.mockReturnValue({
        forecast: mockForecast,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        updatePattern: vi.fn(),
        removePattern: mockRemovePattern
      });

      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByText('Show Details'));
      
      const deleteButtons = screen.getAllByTitle('Remove pattern');
      fireEvent.click(deleteButtons[0]);
      
      expect(mockRemovePattern).toHaveBeenCalledWith('1');
    });
  });

  describe('Props', () => {
    it('passes accountIds to hook', () => {
      const accountIds = ['acc1', 'acc2'];
      render(<CashFlowForecast accountIds={accountIds} />);
      
      expect(mockUseCashFlowForecast).toHaveBeenCalledWith(
        expect.objectContaining({ accountIds })
      );
    });

    it('applies custom className', () => {
      const { container } = render(<CashFlowForecast className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Pattern Card', () => {
    it('shows correct color indicator for income', () => {
      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByText('Show Details'));
      
      const patternCard = screen.getByText('Monthly Salary').closest('.rounded-lg');
      const incomeIndicator = patternCard?.querySelector('.bg-green-500');
      
      expect(incomeIndicator).toBeInTheDocument();
    });

    it('shows correct color indicator for expense', () => {
      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByText('Show Details'));
      
      const patternCard = screen.getByText('Rent Payment').closest('.rounded-lg');
      const expenseIndicator = patternCard?.querySelector('.bg-red-500');
      
      expect(expenseIndicator).toBeInTheDocument();
    });

    it('formats next occurrence date', () => {
      render(<CashFlowForecast />);
      
      fireEvent.click(screen.getByText('Show Details'));
      
      const nextDateTexts = screen.getAllByText(/Next: Feb 1/);
      expect(nextDateTexts).toHaveLength(2); // One for income, one for expense
    });
  });

  describe('Chevron Animation', () => {
    it('rotates chevron when patterns expanded', () => {
      render(<CashFlowForecast />);
      
      const chevron = screen.getByTestId('chevron-right-icon');
      expect(chevron).not.toHaveClass('rotate-90');
      
      fireEvent.click(screen.getByText('Show Details'));
      
      expect(chevron).toHaveClass('rotate-90');
    });
  });
});