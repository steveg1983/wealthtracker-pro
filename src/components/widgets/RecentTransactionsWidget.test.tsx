/**
 * RecentTransactionsWidget Tests
 * Tests for the recent transactions widget component with different sizes
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import RecentTransactionsWidget from './RecentTransactionsWidget';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { formatCurrency as formatCurrencyDecimal } from '../../utils/currency-decimal';
import type { Transaction, Account, Category } from '../../types';

// Mock the external dependencies
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: vi.fn(),
}));
vi.mock('../../hooks/useCurrencyDecimal');

// Mock icons
vi.mock('../../components/icons', () => ({
  ArrowUpRightIcon: ({ className, size }: { className?: string; size?: number }) => (
    <div data-testid="arrow-up-right-icon" className={className} data-size={size} />
  ),
  ArrowDownRightIcon: ({ className, size }: { className?: string; size?: number }) => (
    <div data-testid="arrow-down-right-icon" className={className} data-size={size} />
  ),
  CreditCardIcon: ({ size }: { size?: number }) => (
    <div data-testid="credit-card-icon" data-size={size} />
  )
}));

const mockUseApp = useApp as Mock;
const mockUseCurrencyDecimal = useCurrencyDecimal as Mock;

describe('RecentTransactionsWidget', () => {
  const mockFormatCurrency = vi.fn((amount: any, currency: string = 'GBP') =>
    formatCurrencyDecimal(
      typeof amount === 'number'
        ? amount
        : typeof amount?.toNumber === 'function'
          ? amount.toNumber()
          : Number(amount),
      currency
    )
  );

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: new Date('2024-01-25'),
      description: 'Monthly Salary',
      category: 'cat-1',
      type: 'income',
      amount: 3000,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-2',
      date: new Date('2024-01-24'),
      description: 'Grocery Shopping',
      category: 'cat-2',
      type: 'expense',
      amount: 120.50,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-3',
      date: new Date('2024-01-23'),
      description: 'Electric Bill',
      category: 'cat-3',
      type: 'expense',
      amount: 85.00,
      accountId: 'acc-2',
      cleared: false
    },
    {
      id: 'tx-4',
      date: new Date('2024-01-22'),
      description: 'Freelance Project',
      category: 'cat-1',
      type: 'income',
      amount: 500,
      accountId: 'acc-2',
      cleared: true
    },
    {
      id: 'tx-5',
      date: new Date('2024-01-21'),
      description: 'Coffee Shop',
      category: 'cat-4',
      type: 'expense',
      amount: 4.50,
      accountId: 'acc-1',
      cleared: true
    },
    {
      id: 'tx-6',
      date: new Date('2024-01-20'),
      description: 'Gas Station',
      category: 'cat-5',
      type: 'expense',
      amount: 65.00,
      accountId: 'acc-1',
      cleared: false
    }
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Checking Account',
      type: 'current',
      balance: 5000,
      currency: 'GBP',
      institution: 'HSBC',
      lastUpdated: new Date('2024-01-25')
    },
    {
      id: 'acc-2',
      name: 'Savings Account',
      type: 'savings',
      balance: 15000,
      currency: 'GBP',
      institution: 'HSBC',
      lastUpdated: new Date('2024-01-25')
    }
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Income', icon: '💰' },
    { id: 'cat-2', name: 'Groceries', icon: '🛒' },
    { id: 'cat-3', name: 'Utilities', icon: '💡' },
    { id: 'cat-4', name: 'Dining', icon: '🍽️' },
    { id: 'cat-5', name: 'Transportation', icon: '🚗' }
  ];

  const defaultProps = {
    size: 'medium' as const,
    settings: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApp.mockReturnValue({
      transactions: mockTransactions,
      accounts: mockAccounts,
      categories: mockCategories
    });

    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: mockFormatCurrency
    });
  });

  describe('Small Size', () => {
    it('renders small widget with 3 most recent transactions', () => {
      render(<RecentTransactionsWidget size="small" settings={{}} />);
      
      // Should show only the 3 most recent transactions
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      expect(screen.getByText('Electric Bill')).toBeInTheDocument();
      
      // Should not show older transactions
      expect(screen.queryByText('Freelance Project')).not.toBeInTheDocument();
      expect(screen.queryByText('Coffee Shop')).not.toBeInTheDocument();
    });

    it('shows correct icons for income and expense transactions', () => {
      render(<RecentTransactionsWidget size="small" settings={{}} />);
      
      // Should show down-right arrow for income
      const incomeIcons = screen.getAllByTestId('arrow-down-right-icon');
      expect(incomeIcons).toHaveLength(1); // Only one income transaction in top 3
      expect(incomeIcons[0]).toHaveClass('text-green-500');
      
      // Should show up-right arrow for expenses
      const expenseIcons = screen.getAllByTestId('arrow-up-right-icon');
      expect(expenseIcons).toHaveLength(2); // Two expense transactions in top 3
      expect(expenseIcons[0]).toHaveClass('text-red-500');
    });

    it('formats amounts correctly with sign', () => {
      render(<RecentTransactionsWidget size="small" settings={{}} />);
      
      // Check amounts are displayed correctly with signs
      expect(screen.getByText('+£3,000.00')).toBeInTheDocument();
      expect(screen.getByText('-£120.50')).toBeInTheDocument();
      expect(screen.getByText('-£85.00')).toBeInTheDocument();
    });

    it('applies correct styling classes', () => {
      render(<RecentTransactionsWidget size="small" settings={{}} />);
      
      // Check container has correct spacing
      const container = screen.getByText('Monthly Salary').closest('.space-y-2');
      expect(container).toBeInTheDocument();
      
      // Check transaction items have correct layout
      const transactionItem = screen.getByText('Monthly Salary').closest('.flex.items-center.justify-between');
      expect(transactionItem).toBeInTheDocument();
      expect(transactionItem).toHaveClass('flex', 'items-center', 'justify-between');
    });

    it('truncates long descriptions', () => {
      render(<RecentTransactionsWidget size="small" settings={{}} />);
      
      const description = screen.getByText('Monthly Salary');
      expect(description).toHaveClass('truncate');
    });
  });

  describe('Medium Size', () => {
    it('renders medium widget with default 5 transactions', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      // Should show 5 most recent transactions by default
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      expect(screen.getByText('Electric Bill')).toBeInTheDocument();
      expect(screen.getByText('Freelance Project')).toBeInTheDocument();
      expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
      
      // Should not show the 6th transaction
      expect(screen.queryByText('Gas Station')).not.toBeInTheDocument();
    });

    it('shows category names for each transaction', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      // Use getAllByText since there are multiple Income transactions
      const incomeElements = screen.getAllByText('Income');
      expect(incomeElements.length).toBeGreaterThan(0);
      
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
      expect(screen.getByText('Dining')).toBeInTheDocument();
    });

    it('shows formatted dates for transactions', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);

      // Assert using runtime locale formatting to avoid timezone/locale-specific flakiness.
      const expectedDates = mockTransactions
        .slice(0, 3)
        .map((transaction) => transaction.date.toLocaleDateString());

      expectedDates.forEach((formattedDate) => {
        expect(screen.getByText(formattedDate)).toBeInTheDocument();
      });
    });

    it('respects custom count setting', () => {
      render(<RecentTransactionsWidget size="medium" settings={{ count: 3 }} />);
      
      // Should show only 3 transactions
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      expect(screen.getByText('Electric Bill')).toBeInTheDocument();
      
      // Should not show 4th transaction
      expect(screen.queryByText('Freelance Project')).not.toBeInTheDocument();
    });

    it('has transaction cards with hover effects', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      const transactionCard = screen.getByText('Monthly Salary').closest('.bg-gray-50');
      expect(transactionCard).toHaveClass(
        'hover:bg-gray-100',
        'dark:hover:bg-gray-700',
        'transition-colors'
      );
    });

    it('shows colored icon backgrounds', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      // Get the icon container for income transaction
      const incomeIcon = screen.getAllByTestId('arrow-down-right-icon')[0];
      const incomeIconContainer = incomeIcon.parentElement;
      expect(incomeIconContainer).toHaveClass('bg-green-100', 'dark:bg-green-900/20');
      
      // Get the icon container for expense transaction
      const expenseIcon = screen.getAllByTestId('arrow-up-right-icon')[0];
      const expenseIconContainer = expenseIcon.parentElement;
      expect(expenseIconContainer).toHaveClass('bg-red-100', 'dark:bg-red-900/20');
    });
  });

  describe('Large Size', () => {
    it('renders large widget with account information', () => {
      render(<RecentTransactionsWidget size="large" settings={{}} />);
      
      // Should show account names (multiple transactions can use same account)
      const checkingAccounts = screen.getAllByText('Checking Account');
      expect(checkingAccounts.length).toBeGreaterThan(0);
      
      const savingsAccounts = screen.getAllByText('Savings Account');
      expect(savingsAccounts.length).toBeGreaterThan(0);
    });

    it('shows credit card icon for accounts', () => {
      render(<RecentTransactionsWidget size="large" settings={{}} />);
      
      const creditCardIcons = screen.getAllByTestId('credit-card-icon');
      expect(creditCardIcons.length).toBeGreaterThan(0);
      expect(creditCardIcons[0]).toHaveAttribute('data-size', '12');
    });

    it('shows cleared status for transactions', () => {
      render(<RecentTransactionsWidget size="large" settings={{}} />);
      
      // Should show "Cleared" badges for cleared transactions
      const clearedBadges = screen.getAllByText('Cleared');
      expect(clearedBadges.length).toBeGreaterThan(0);
      
      // Check badge styling
      expect(clearedBadges[0]).toHaveClass(
        'text-xs',
        'bg-green-100',
        'dark:bg-green-900/20',
        'text-green-800',
        'dark:text-green-400',
        'px-2',
        'py-1',
        'rounded-full'
      );
    });

    it('does not show cleared badge for uncleared transactions', () => {
      render(<RecentTransactionsWidget size="large" settings={{}} />);
      
      // Electric Bill is not cleared, so it should not have a cleared badge
      const electricBillCard = screen.getByText('Electric Bill').closest('.bg-gray-50');
      // Check that this specific card doesn't have "Cleared" text
      const clearedText = electricBillCard?.querySelector('.bg-green-100');
      expect(clearedText).toBeNull();
    });

    it('has correct layout for large size', () => {
      const { container } = render(<RecentTransactionsWidget size="large" settings={{}} />);
      
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass('h-full', 'flex', 'flex-col');
      
      const scrollContainer = rootContainer.firstChild as HTMLElement;
      expect(scrollContainer).toHaveClass('flex-1', 'overflow-y-auto', 'space-y-3');
    });
  });

  describe('Data Handling', () => {
    it('sorts transactions by date descending', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      // Get all transaction descriptions in order
      const descriptions = screen.getAllByText(/Monthly Salary|Grocery Shopping|Electric Bill|Freelance Project|Coffee Shop/)
        .map(el => el.textContent);
      
      // Should be in reverse chronological order
      expect(descriptions).toEqual([
        'Monthly Salary',     // Jan 25
        'Grocery Shopping',   // Jan 24
        'Electric Bill',      // Jan 23
        'Freelance Project',  // Jan 22
        'Coffee Shop'         // Jan 21
      ]);
    });

    it('handles missing account gracefully', () => {
      const transactionsWithInvalidAccount = [
        {
          ...mockTransactions[0],
          accountId: 'invalid-acc-id'
        }
      ];

      mockUseApp.mockReturnValue({
        transactions: transactionsWithInvalidAccount,
        accounts: mockAccounts,
        categories: mockCategories
      });

      render(<RecentTransactionsWidget size="large" settings={{}} />);
      
      expect(screen.getByText('Unknown Account')).toBeInTheDocument();
    });

    it('handles missing category gracefully', () => {
      const transactionsWithInvalidCategory = [
        {
          ...mockTransactions[0],
          category: 'invalid-cat-id'
        }
      ];

      mockUseApp.mockReturnValue({
        transactions: transactionsWithInvalidCategory,
        accounts: mockAccounts,
        categories: mockCategories
      });

      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    it('shows empty state when no transactions', () => {
      mockUseApp.mockReturnValue({
        transactions: [],
        accounts: mockAccounts,
        categories: mockCategories
      });

      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('No recent transactions')).toBeInTheDocument();
    });

    it('handles all transactions when count exceeds available', () => {
      mockUseApp.mockReturnValue({
        transactions: mockTransactions.slice(0, 2), // Only 2 transactions
        accounts: mockAccounts,
        categories: mockCategories
      });

      render(<RecentTransactionsWidget size="medium" settings={{ count: 10 }} />);
      
      // Should show only the 2 available transactions
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      
      // Should not show empty state since there are transactions
      expect(screen.queryByText('No recent transactions')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies correct colors for income amounts', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      const incomeAmount = screen.getByText('+£3,000.00');
      expect(incomeAmount).toHaveClass('text-green-600', 'dark:text-green-400');
    });

    it('applies correct colors for expense amounts', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      const expenseAmount = screen.getByText('-£120.50');
      expect(expenseAmount).toHaveClass('text-red-600', 'dark:text-red-400');
    });

    it('has proper dark mode classes', () => {
      render(<RecentTransactionsWidget size="medium" settings={{}} />);
      
      // Check transaction card dark mode styling
      const transactionCard = screen.getByText('Monthly Salary').closest('.bg-gray-50');
      expect(transactionCard).toHaveClass('dark:bg-gray-700/50');
      
      // Check text dark mode styling
      const description = screen.getByText('Monthly Salary');
      expect(description).toHaveClass('text-gray-900', 'dark:text-white');
    });
  });

  describe('Memoization', () => {
    it('memoizes transaction sorting', () => {
      const { rerender } = render(<RecentTransactionsWidget {...defaultProps} />);
      
      // Initial render
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      
      // Re-render with same props
      rerender(<RecentTransactionsWidget {...defaultProps} />);
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      
      // Change count setting
      rerender(<RecentTransactionsWidget size="medium" settings={{ count: 3 }} />);
      
      // Should still show the same transactions but limited to 3
      expect(screen.getByText('Monthly Salary')).toBeInTheDocument();
      expect(screen.queryByText('Freelance Project')).not.toBeInTheDocument();
    });
  });
});
