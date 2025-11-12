import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExpenseBreakdownWidget from './ExpenseBreakdownWidget';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { formatCurrency as formatCurrencyDecimal, getCurrencySymbol as getCurrencySymbolDecimal } from '../../utils/currency-decimal';
import type { Transaction, Category } from '../../types';

// Mock the contexts and hooks
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: vi.fn(),
}));
vi.mock('../../hooks/useCurrencyDecimal');

// Mock recharts to avoid canvas issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ data, children }: { data: Array<{ name: string; value: number }> ; children?: React.ReactNode }) => (
    <div data-testid="pie" data-value={data.length}>
      {data.map((item, index) => (
        <div key={index} data-testid={`pie-segment-${index}`}>
          {item.name}: {item.value}
        </div>
      ))}
      {children}
    </div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" style={{ backgroundColor: fill }} />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: ({ formatter }: { formatter?: () => string }) => (
    <div data-testid="legend">{formatter ? 'Legend' : null}</div>
  ),
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;

// Mock data
const mockCategories: Category[] = [
  { id: 'cat1', name: 'Groceries', icon: 'shopping-cart', color: '#3B82F6' },
  { id: 'cat2', name: 'Utilities', icon: 'zap', color: '#10B981' },
  { id: 'cat3', name: 'Entertainment', icon: 'film', color: '#F59E0B' },
  { id: 'cat4', name: 'Transport', icon: 'car', color: '#EF4444' },
  { id: 'cat5', name: 'Healthcare', icon: 'heart', color: '#8B5CF6' },
];

const mockTransactions: Transaction[] = [
  {
    id: '1',
    accountId: 'acc1',
    amount: 150,
    category: 'cat1', // Use category ID
    description: 'Grocery Store',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    type: 'expense',
    cleared: true,
  },
  {
    id: '2',
    accountId: 'acc1',
    amount: 200,
    category: 'cat2', // Use category ID
    description: 'Electric Bill',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    type: 'expense',
    cleared: true,
  },
  {
    id: '3',
    accountId: 'acc1',
    amount: 50,
    category: 'cat3', // Use category ID
    description: 'Movie tickets',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    type: 'expense',
    cleared: false,
  },
  {
    id: '4',
    accountId: 'acc1',
    amount: 80,
    category: 'cat4', // Use category ID
    description: 'Gas',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    type: 'expense',
    cleared: true,
  },
  {
    id: '5',
    accountId: 'acc1',
    amount: 300,
    category: 'cat1', // Use category ID
    description: 'Grocery Store 2',
    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    type: 'expense',
    cleared: true,
  },
  {
    id: '6',
    accountId: 'acc1',
    amount: 1000,
    category: 'income',
    description: 'Salary',
    date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    type: 'income',
    cleared: true,
  },
  // Old transaction (more than a year ago)
  {
    id: '7',
    accountId: 'acc1',
    amount: 500,
    category: 'cat5', // Use category ID
    description: 'Doctor visit',
    date: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
    type: 'expense',
    cleared: true,
  },
];

describe('ExpenseBreakdownWidget', () => {
  const mockFormatCurrency = vi.fn((amount: any, currency: string = 'USD') =>
    formatCurrencyDecimal(
      typeof amount === 'number'
        ? amount
        : typeof amount?.toNumber === 'function'
          ? amount.toNumber()
          : Number(amount),
      currency
    )
  );
  const mockGetCurrencySymbol = vi.fn((currency: string = 'USD') => getCurrencySymbolDecimal(currency));

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useApp to return our test data
    mockUseApp.mockReturnValue({
      transactions: mockTransactions,
      categories: mockCategories,
    });

    // Mock useCurrencyDecimal
    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency,
      getCurrencySymbol: mockGetCurrencySymbol,
      displayCurrency: 'USD',
    });
  });

  describe('Basic Rendering', () => {
    it('renders widget with expense data', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      // Check if total is displayed
      expect(screen.getByText('$780.00')).toBeInTheDocument();
      expect(screen.getByText('Total Monthly Expenses')).toBeInTheDocument();
    });

    it('renders empty state when no expenses', () => {
      mockUseApp.mockReturnValue({
        transactions: [],
        categories: mockCategories,
      });

      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('No expense data')).toBeInTheDocument();
      expect(screen.getByText('Make some transactions to see breakdown')).toBeInTheDocument();
    });

    it('renders only expense transactions', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      // Should not include the income transaction
      const pieChart = screen.getByTestId('pie');
      expect(pieChart).toHaveAttribute('data-value', '4'); // 4 categories of expense transactions within the month
    });
  });

  describe('Size Variations', () => {
    it('renders small size correctly', () => {
      render(<ExpenseBreakdownWidget size="small" settings={{}} />);
      
      // Should show top 3 categories in list
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
      
      // Should not show legend in small size
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });

    it('renders medium size correctly', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      // Should show legend
      expect(screen.getByTestId('legend')).toBeInTheDocument();
      
      // Should not show category list
      expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
    });

    it('renders large size correctly', () => {
      render(<ExpenseBreakdownWidget size="large" settings={{}} />);
      
      // Should show legend
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('limits categories based on size', () => {
      // Create many transactions with different categories
      const manyTransactions: Transaction[] = Array.from({ length: 20 }, (_, i) => ({
        id: `t${i}`,
        accountId: 'acc1',
        amount: 100,
        category: `cat${i % 15}`, // 15 different categories
        description: `Transaction ${i}`,
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        type: 'expense' as const,
        cleared: true,
      }));

      mockUseApp.mockReturnValue({
        transactions: manyTransactions,
        categories: Array.from({ length: 15 }, (_, i) => ({
          id: `cat${i}`,
          name: `Category ${i}`,
          icon: 'folder',
          color: '#000000',
        })),
      });

      const { rerender } = render(<ExpenseBreakdownWidget size="small" settings={{}} />);

      let pieSegments = screen.getAllByTestId(/pie-segment-/);
      expect(pieSegments).toHaveLength(5); // Small size shows 5 categories

      rerender(<ExpenseBreakdownWidget size="medium" settings={{}} />);

      pieSegments = screen.getAllByTestId(/pie-segment-/);
      expect(pieSegments).toHaveLength(8); // Medium size shows 8 categories

      rerender(<ExpenseBreakdownWidget size="large" settings={{}} />);

      pieSegments = screen.getAllByTestId(/pie-segment-/);
      expect(pieSegments).toHaveLength(12); // Large size shows 12 categories
    });
  });

  describe('Period Settings', () => {
    it('filters by week period', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{ period: 'week' }} />);
      
      // Only transactions within last 7 days: t1, t3, t4
      expect(screen.getByText('$280.00')).toBeInTheDocument();
      expect(screen.getByText('Total Weekly Expenses')).toBeInTheDocument();
    });

    it('filters by month period', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{ period: 'month' }} />);
      
      // Transactions within last month (excluding the 400-day old one)
      expect(screen.getByText('$780.00')).toBeInTheDocument();
      expect(screen.getByText('Total Monthly Expenses')).toBeInTheDocument();
    });

    it('filters by quarter period', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{ period: 'quarter' }} />);
      
      // All recent transactions
      expect(screen.getByText('$780.00')).toBeInTheDocument();
      expect(screen.getByText('Total Quarterly Expenses')).toBeInTheDocument();
    });

    it('filters by year period', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{ period: 'year' }} />);
      
      // Note: The 400-day-old transaction is older than 1 year, so it won't be included
      expect(screen.getByText('$780.00')).toBeInTheDocument();
      expect(screen.getByText('Total Yearly Expenses')).toBeInTheDocument();
    });
  });

  describe('Legend Settings', () => {
    it('shows legend when enabled', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{ showLegend: true }} />);
      
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('hides legend when disabled', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{ showLegend: false }} />);
      
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });

    it('never shows legend in small size regardless of setting', () => {
      render(<ExpenseBreakdownWidget size="small" settings={{ showLegend: true }} />);
      
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    it('sorts categories by expense amount', () => {
      render(<ExpenseBreakdownWidget size="small" settings={{}} />);
      
      // Categories should be sorted by total amount
      const segments = screen.getAllByTestId(/pie-segment-/);
      expect(segments[0]).toHaveTextContent('Groceries: 450'); // 150 + 300
      expect(segments[1]).toHaveTextContent('Utilities: 200');
      expect(segments[2]).toHaveTextContent('Transport: 80');
    });

    it('handles uncategorized transactions', () => {
      const transactionsWithUncategorized: Transaction[] = [
        {
          id: 'unc1',
          accountId: 'acc1',
          amount: 100,
          category: 'nonexistent', // Non-existent category ID
          description: 'Unknown category',
          date: new Date(),
          type: 'expense',
          cleared: true,
        },
      ];

      mockUseApp.mockReturnValue({
        transactions: transactionsWithUncategorized,
        categories: mockCategories,
      });

      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('pie-segment-0')).toHaveTextContent('Uncategorized: 100');
    });

    it('excludes income transactions', () => {
      const mixedTransactions: Transaction[] = [
        {
          id: 'exp1',
          accountId: 'acc1',
          amount: 100,
          category: 'cat1',
          description: 'Expense',
          date: new Date(),
          type: 'expense',
          cleared: true,
        },
        {
          id: 'inc1',
          accountId: 'acc1',
          amount: 500,
          category: 'cat1',
          description: 'Income',
          date: new Date(),
          type: 'income',
          cleared: true,
        },
      ];

      mockUseApp.mockReturnValue({
        transactions: mixedTransactions,
        categories: mockCategories,
      });

      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      // Total should only include expense
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('applies correct colors to chart segments', () => {
      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      const cells = screen.getAllByTestId('cell');
      expect(cells.length).toBeGreaterThan(0);
      
      // First cell should have the first color
      expect(cells[0]).toHaveStyle({ backgroundColor: '#3B82F6' });
    });

    it('shows category colors in small size list', () => {
      render(<ExpenseBreakdownWidget size="small" settings={{}} />);
      
      // Look for color indicators
      const categoryItems = screen.getByText('Groceries').closest('div');
      expect(categoryItems).toBeInTheDocument();
      
      // Check if the parent div contains a colored element
      const parentDiv = categoryItems?.parentElement;
      const colorIndicator = parentDiv?.querySelector('div[style*="background"]');
      expect(colorIndicator).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles single transaction correctly', () => {
      const singleTransaction: Transaction[] = [
        {
          id: '1',
          accountId: 'acc1',
          amount: 100,
          category: 'cat1',
          description: 'Single expense',
          date: new Date(),
          type: 'expense',
          cleared: true,
        },
      ];

      mockUseApp.mockReturnValue({
        transactions: singleTransaction,
        categories: mockCategories,
      });

      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByTestId('pie')).toHaveAttribute('data-value', '1');
    });

    it('handles all transactions in same category', () => {
      const sameCategoryTransactions: Transaction[] = [
        {
          id: '1',
          accountId: 'acc1',
          amount: 100,
          category: 'cat1',
          description: 'Expense 1',
          date: new Date(),
          type: 'expense',
          cleared: true,
        },
        {
          id: '2',
          accountId: 'acc1',
          amount: 200,
          category: 'cat1',
          description: 'Expense 2',
          date: new Date(),
          type: 'expense',
          cleared: true,
        },
      ];

      mockUseApp.mockReturnValue({
        transactions: sameCategoryTransactions,
        categories: mockCategories,
      });

      render(<ExpenseBreakdownWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('$300.00')).toBeInTheDocument();
      expect(screen.getByTestId('pie')).toHaveAttribute('data-value', '1'); // One category
      expect(screen.getByTestId('pie-segment-0')).toHaveTextContent('Groceries: 300');
    });
  });
});
