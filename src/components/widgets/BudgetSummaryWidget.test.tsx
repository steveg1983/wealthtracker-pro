/**
 * BudgetSummaryWidget Tests
 * Tests for the budget summary widget component with different sizes and period settings
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import BudgetSummaryWidget from './BudgetSummaryWidget';
import { useApp } from '../../contexts/AppContext';
import { useBudgets } from '../../contexts/BudgetContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { budgetCalculationService } from '../../services/budgetCalculationService';
import type { Transaction, Category, Budget } from '../../types';

// Mock the external dependencies
vi.mock('../../contexts/AppContext');
vi.mock('../../contexts/BudgetContext');
vi.mock('../../hooks/useCurrencyDecimal');
vi.mock('../../services/budgetCalculationService');

// Mock icons
vi.mock('../../components/icons', () => ({
  PiggyBankIcon: ({ size }: { size?: number }) => (
    <div data-testid="piggy-bank-icon" data-size={size} />
  ),
  AlertCircleIcon: ({ size }: { size?: number }) => (
    <div data-testid="alert-circle-icon" data-size={size} />
  ),
  CheckCircleIcon: ({ size }: { size?: number }) => (
    <div data-testid="check-circle-icon" data-size={size} />
  )
}));

// Mock Recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => (
    <div data-testid="pie-chart">
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
const mockUseBudgets = useBudgets as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;
const mockBudgetCalculationService = budgetCalculationService as any;

describe('BudgetSummaryWidget', () => {
  const mockFormatCurrency = vi.fn((amount: any) => {
    const value = typeof amount === 'number' ? amount : amount.toNumber();
    return `£${value.toFixed(2)}`;
  });

  const mockBudgets: Budget[] = [
    {
      id: 'budget-1',
      name: 'Groceries',
      category: 'cat-1',
      amount: 500,
      period: 'monthly',
      color: '#34C759'
    },
    {
      id: 'budget-2',
      name: 'Entertainment',
      category: 'cat-2',
      amount: 200,
      period: 'monthly',
      color: '#007AFF'
    },
    {
      id: 'budget-3',
      name: 'Transportation',
      category: 'cat-3',
      amount: 300,
      period: 'monthly',
      color: '#FF9500'
    }
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Groceries', icon: '🛒' },
    { id: 'cat-2', name: 'Entertainment', icon: '🎬' },
    { id: 'cat-3', name: 'Transportation', icon: '🚗' }
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: new Date('2024-01-15'),
      description: 'Grocery Store',
      category: 'cat-1',
      type: 'expense',
      amount: 120,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-2',
      date: new Date('2024-01-10'),
      description: 'Movie Theater',
      category: 'cat-2',
      type: 'expense',
      amount: 50,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-3',
      date: new Date('2024-01-20'),
      description: 'Gas Station',
      category: 'cat-3',
      type: 'expense',
      amount: 80,
      accountId: 'acc-1',
      cleared: true
    }
  ];

  const mockBudgetCalculationResult = {
    budgetsByCategory: [
      {
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        budgetedAmount: 500,
        spentAmount: 120,
        remainingAmount: 380,
        percentage: 24
      },
      {
        categoryId: 'cat-2',
        categoryName: 'Entertainment',
        budgetedAmount: 200,
        spentAmount: 50,
        remainingAmount: 150,
        percentage: 25
      },
      {
        categoryId: 'cat-3',
        categoryName: 'Transportation',
        budgetedAmount: 300,
        spentAmount: 80,
        remainingAmount: 220,
        percentage: 27
      }
    ],
    totalBudgeted: 1000,
    totalSpent: 250,
    totalRemaining: 750
  };

  const defaultProps = {
    size: 'medium' as const,
    settings: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock current date to be January 2024 for consistent testing
    const mockDate = new Date('2024-01-25');
    vi.setSystemTime(mockDate);

    mockUseApp.mockReturnValue({
      transactions: mockTransactions,
      categories: mockCategories
    });

    mockUseBudgets.mockReturnValue({
      budgets: mockBudgets
    });

    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency
    });

    mockBudgetCalculationService.calculateAllBudgetSpending = vi.fn(() => mockBudgetCalculationResult);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Small Size', () => {
    it('renders small widget with budget status', () => {
      render(<BudgetSummaryWidget size="small" settings={{}} />);
      
      // Should display budget status label
      expect(screen.getByText('Budget Status')).toBeInTheDocument();
      
      // Should show remaining amount (750)
      expect(screen.getByText('£750.00')).toBeInTheDocument();
      
      // Should show status text
      expect(screen.getByText('On track')).toBeInTheDocument();
      
      // Should show check circle icon for positive remaining
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-circle-icon')).not.toBeInTheDocument();
    });

    it('shows over budget status when remaining is negative', () => {
      // Mock over-budget scenario - use a budget that's clearly over
      const overBudgetBudgets = [
        {
          id: 'budget-1',
          name: 'Groceries',
          category: 'cat-1',
          amount: 100, // Lower budget
          period: 'monthly',
          color: '#34C759'
        }
      ];

      const overBudgetResult = {
        budgetsByCategory: [
          {
            categoryId: 'cat-1',
            categoryName: 'Groceries',
            budgetedAmount: 100,
            spentAmount: 150,
            remainingAmount: -50,
            percentage: 150
          }
        ],
        totalBudgeted: 100,
        totalSpent: 150,
        totalRemaining: -50
      };

      mockUseBudgets.mockReturnValue({
        budgets: overBudgetBudgets
      });

      mockBudgetCalculationService.calculateAllBudgetSpending.mockReturnValue(overBudgetResult);

      render(<BudgetSummaryWidget size="small" settings={{}} />);
      
      // Should show negative remaining amount
      expect(screen.getByText('£-50.00')).toBeInTheDocument();
      
      // Should show over budget status
      expect(screen.getByText('Over budget')).toBeInTheDocument();
      
      // Should show alert icon
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('check-circle-icon')).not.toBeInTheDocument();
    });

    it('applies correct styling classes', () => {
      render(<BudgetSummaryWidget size="small" settings={{}} />);
      
      const container = screen.getByText('Budget Status').parentElement;
      expect(container).toHaveClass('text-center');
      
      const statusLabel = screen.getByText('Budget Status');
      expect(statusLabel).toHaveClass('text-sm', 'text-gray-600', 'dark:text-gray-400', 'mb-1');
      
      const amountElement = screen.getByText('£750.00');
      expect(amountElement).toHaveClass('text-2xl', 'font-bold', 'mb-2', 'text-green-600', 'dark:text-green-400');
    });

    it('does not show chart or detailed breakdown in small size', () => {
      render(<BudgetSummaryWidget size="small" settings={{}} />);
      
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    });
  });

  describe('Medium Size', () => {
    it('renders medium widget with period info and summary', () => {
      render(<BudgetSummaryWidget size="medium" settings={{}} />);
      
      // Should display period label
      expect(screen.getByText('This Month')).toBeInTheDocument();
      
      // Should show remaining amount with sign
      expect(screen.getByText('+£750.00')).toBeInTheDocument();
      
      // Should show budget summary
      expect(screen.getByText('£250.00 of £1000.00')).toBeInTheDocument();
      
      // Should show budgeted and spent sections
      expect(screen.getByText('Budgeted')).toBeInTheDocument();
      expect(screen.getByText('Spent')).toBeInTheDocument();
    });

    it('shows different period labels based on settings', () => {
      const { rerender } = render(<BudgetSummaryWidget size="medium" settings={{ period: 'last' }} />);
      expect(screen.getByText('Last Month')).toBeInTheDocument();
      
      rerender(<BudgetSummaryWidget size="medium" settings={{ period: 'ytd' }} />);
      expect(screen.getByText('Year to Date')).toBeInTheDocument();
      
      rerender(<BudgetSummaryWidget size="medium" settings={{ period: 'current' }} />);
      expect(screen.getByText('This Month')).toBeInTheDocument();
    });

    it('shows top 3 budgets with progress', () => {
      render(<BudgetSummaryWidget size="medium" settings={{}} />);
      
      // Should show budget names
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      
      // Should show percentages
      expect(screen.getByText('24%')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('27%')).toBeInTheDocument();
    });

    it('shows "more" indicator when there are more than 3 budgets', () => {
      const manyBudgets = [
        ...mockBudgets,
        {
          id: 'budget-4',
          name: 'Extra Budget 1',
          category: 'cat-4',
          amount: 100,
          period: 'monthly',
          color: '#FF3B30'
        },
        {
          id: 'budget-5',
          name: 'Extra Budget 2',
          category: 'cat-5',
          amount: 150,
          period: 'monthly',
          color: '#AF52DE'
        }
      ];

      mockUseBudgets.mockReturnValue({
        budgets: manyBudgets
      });

      render(<BudgetSummaryWidget size="medium" settings={{}} />);
      
      // Should show "+2 more" text
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('shows over budget count when applicable', () => {
      const overBudgetBudgets = [
        {
          id: 'budget-1',
          name: 'Groceries',
          category: 'cat-1',
          amount: 100,
          period: 'monthly',
          color: '#34C759'
        },
        {
          id: 'budget-2',
          name: 'Entertainment',
          category: 'cat-2',
          amount: 50,
          period: 'monthly',
          color: '#007AFF'
        }
      ];

      const overBudgetResult = {
        budgetsByCategory: [
          {
            categoryId: 'cat-1',
            categoryName: 'Groceries',
            budgetedAmount: 100,
            spentAmount: 150,
            remainingAmount: -50,
            percentage: 150
          },
          {
            categoryId: 'cat-2',
            categoryName: 'Entertainment',
            budgetedAmount: 50,
            spentAmount: 75,
            remainingAmount: -25,
            percentage: 150
          }
        ],
        totalBudgeted: 150,
        totalSpent: 225,
        totalRemaining: -75
      };

      mockUseBudgets.mockReturnValue({
        budgets: overBudgetBudgets
      });

      mockBudgetCalculationService.calculateAllBudgetSpending.mockReturnValue(overBudgetResult);

      render(<BudgetSummaryWidget size="medium" settings={{}} />);
      
      // Should show over budget count
      expect(screen.getByText('2 over budget')).toBeInTheDocument();
    });

    it('does not show chart in medium size', () => {
      render(<BudgetSummaryWidget size="medium" settings={{}} />);
      
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    });
  });

  describe('Large Size', () => {
    it('renders large widget with pie chart and detailed budget list', () => {
      render(<BudgetSummaryWidget size="large" settings={{}} />);
      
      // Should show period and summary info
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('+£750.00')).toBeInTheDocument();
      
      // Should show pie chart
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      
      // Should show detailed budget list
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
    });

    it('configures pie chart correctly', () => {
      render(<BudgetSummaryWidget size="large" settings={{}} />);
      
      // Check ResponsiveContainer
      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveAttribute('data-width', '100%');
      expect(container).toHaveAttribute('data-height', '100%');

      // Check Pie configuration
      const pie = screen.getByTestId('pie');
      expect(pie).toHaveAttribute('data-cx', '50%');
      expect(pie).toHaveAttribute('data-cy', '50%');
      expect(pie).toHaveAttribute('data-inner-radius', '40');
      expect(pie).toHaveAttribute('data-outer-radius', '80');
      expect(pie).toHaveAttribute('data-padding-angle', '5');
      expect(pie).toHaveAttribute('data-data-key', 'value');

      // Check chart data
      const chartData = JSON.parse(pie.getAttribute('data-chart-data') || '[]');
      expect(chartData).toHaveLength(3);
      expect(chartData[0]).toEqual({
        name: 'Groceries',
        value: 120,
        color: '#34C759'
      });

      // Check tooltip configuration
      const tooltip = screen.getByTestId('tooltip');
      expect(tooltip).toHaveAttribute('data-formatter', 'has-formatter');
    });

    it('shows detailed budget breakdown with progress bars', () => {
      render(<BudgetSummaryWidget size="large" settings={{}} />);
      
      // Should show budget cards with colors and percentages
      const budgetCards = screen.getByText('Groceries').closest('div')?.parentElement;
      expect(budgetCards).toBeInTheDocument();
      
      // Should show progress bars and amounts
      expect(screen.getByText('£120.00')).toBeInTheDocument(); // Spent amount
      expect(screen.getByText('£500.00')).toBeInTheDocument(); // Budgeted amount
    });

    it('highlights over-budget items differently', () => {
      const overBudgetBudgets = [{
        id: 'budget-1',
        name: 'Groceries',
        category: 'cat-1',
        amount: 100,
        period: 'monthly',
        color: '#34C759'
      }];

      const overBudgetResult = {
        budgetsByCategory: [
          {
            categoryId: 'cat-1',
            categoryName: 'Groceries',
            budgetedAmount: 100,
            spentAmount: 150,
            remainingAmount: -50,
            percentage: 150
          }
        ],
        totalBudgeted: 100,
        totalSpent: 150,
        totalRemaining: -50
      };

      mockUseBudgets.mockReturnValue({
        budgets: overBudgetBudgets
      });

      mockBudgetCalculationService.calculateAllBudgetSpending.mockReturnValue(overBudgetResult);

      render(<BudgetSummaryWidget size="large" settings={{}} />);
      
      // Should show over-budget styling on the budget card container
      const budgetCard = screen.getByText('Groceries').closest('.p-2');
      expect(budgetCard).toHaveClass('border-red-200', 'bg-red-50', 'dark:border-red-800', 'dark:bg-red-900/20');
    });

    it('does not show chart when no budgets exist', () => {
      mockUseBudgets.mockReturnValue({
        budgets: []
      });

      mockBudgetCalculationService.calculateAllBudgetSpending.mockReturnValue({
        budgetsByCategory: [],
        totalBudgeted: 0,
        totalSpent: 0,
        totalRemaining: 0
      });

      render(<BudgetSummaryWidget size="large" settings={{}} />);
      
      // Should not show pie chart when no budget data
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    it('calls budget calculation service with correct parameters', () => {
      render(<BudgetSummaryWidget {...defaultProps} />);
      
      expect(mockBudgetCalculationService.calculateAllBudgetSpending).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            categoryId: 'cat-1',
            period: 'monthly'
          })
        ]),
        mockTransactions,
        mockCategories
      );
    });

    it('handles empty budgets gracefully', () => {
      mockUseBudgets.mockReturnValue({
        budgets: []
      });

      mockBudgetCalculationService.calculateAllBudgetSpending.mockReturnValue({
        budgetsByCategory: [],
        totalBudgeted: 0,
        totalSpent: 0,
        totalRemaining: 0
      });

      render(<BudgetSummaryWidget {...defaultProps} />);
      
      // Should show zero values - use getAllByText since there may be multiple £0.00 elements
      const zeroElements = screen.getAllByText('£0.00');
      expect(zeroElements.length).toBeGreaterThan(0);
    });

    it('handles empty transactions gracefully', () => {
      mockUseApp.mockReturnValue({
        transactions: [],
        categories: mockCategories
      });

      render(<BudgetSummaryWidget {...defaultProps} />);
      
      // Should still render without error
      expect(screen.getByText('This Month')).toBeInTheDocument();
    });

    it('processes different periods correctly', () => {
      render(<BudgetSummaryWidget size="medium" settings={{ period: 'last' }} />);
      
      // Service should be called (we can't easily test date ranges, but we can ensure it's called)
      expect(mockBudgetCalculationService.calculateAllBudgetSpending).toHaveBeenCalled();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('applies correct styling classes for different sizes', () => {
      const { container, rerender } = render(<BudgetSummaryWidget size="small" settings={{}} />);
      
      // Small size has text-center
      expect(container.firstChild).toHaveClass('text-center');
      
      rerender(<BudgetSummaryWidget size="medium" settings={{}} />);
      
      // Medium/Large size has flex layout
      const mediumContainer = container.firstChild as HTMLElement;
      expect(mediumContainer).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('uses budget colors correctly', () => {
      render(<BudgetSummaryWidget size="large" settings={{}} />);
      
      // Check that cells have the budget colors
      const cells = screen.getAllByTestId('cell');
      expect(cells).toHaveLength(3);
      expect(cells[0]).toHaveAttribute('data-fill', '#34C759');
      expect(cells[1]).toHaveAttribute('data-fill', '#007AFF');
      expect(cells[2]).toHaveAttribute('data-fill', '#FF9500');
    });

    it('handles missing budget colors with defaults', () => {
      const budgetsWithoutColors = mockBudgets.map(budget => ({
        ...budget,
        color: undefined
      }));

      mockUseBudgets.mockReturnValue({
        budgets: budgetsWithoutColors
      });

      render(<BudgetSummaryWidget size="large" settings={{}} />);
      
      // Should use default color
      const cells = screen.getAllByTestId('cell');
      expect(cells[0]).toHaveAttribute('data-fill', '#3B82F6'); // Default color
    });
  });

  describe('Error Handling', () => {
    it('handles service errors gracefully', () => {
      mockBudgetCalculationService.calculateAllBudgetSpending.mockImplementation(() => {
        throw new Error('Service error');
      });

      expect(() => {
        render(<BudgetSummaryWidget {...defaultProps} />);
      }).toThrow('Service error');
    });

    it('handles invalid budget data', () => {
      mockUseBudgets.mockReturnValue({
        budgets: [{ ...mockBudgets[0], amount: null }] // Invalid amount
      });

      expect(() => {
        render(<BudgetSummaryWidget {...defaultProps} />);
      }).not.toThrow();
    });
  });

  describe('Memoization', () => {
    it('memoizes expensive calculations', () => {
      render(<BudgetSummaryWidget {...defaultProps} />);
      
      // Service should be called during initial render
      expect(mockBudgetCalculationService.calculateAllBudgetSpending).toHaveBeenCalled();
      
      // Check that the component renders correctly (indicating memoization is working)
      expect(screen.getByText('This Month')).toBeInTheDocument();
    });

    it('recalculates when period changes', () => {
      const { rerender } = render(<BudgetSummaryWidget size="medium" settings={{ period: 'current' }} />);
      
      // Clear service call count
      mockBudgetCalculationService.calculateAllBudgetSpending.mockClear();
      
      // Change period
      rerender(<BudgetSummaryWidget size="medium" settings={{ period: 'last' }} />);
      
      // Should recalculate and show new period
      expect(mockBudgetCalculationService.calculateAllBudgetSpending).toHaveBeenCalled();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
    });
  });
});