import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CategoryTransactionsModal from './CategoryTransactionsModal';
import type { Transaction, Account } from '../types';

// Mock icons
vi.mock('./icons/XIcon', () => ({
  XIcon: ({ size }: any) => <div data-testid="x-icon">X</div>,
}));

vi.mock('./icons/CalendarIcon', () => ({
  CalendarIcon: ({ size, className }: any) => <div data-testid="calendar-icon" className={className}>Calendar</div>,
}));

vi.mock('./icons/SearchIcon', () => ({
  SearchIcon: ({ size, className }: any) => <div data-testid="search-icon" className={className}>Search</div>,
}));

vi.mock('./icons/XCircleIcon', () => ({
  XCircleIcon: ({ size }: any) => <div data-testid="x-circle-icon">XCircle</div>,
}));

// Mock hooks
const mockTransactions: Transaction[] = [
  {
    id: 't1',
    date: new Date('2024-01-15'),
    amount: 100,
    description: 'Grocery Store',
    type: 'expense',
    category: 'cat1',
    categoryName: 'Food',
    accountId: 'acc1',
    tags: ['groceries']
  },
  {
    id: 't2',
    date: new Date('2024-01-10'),
    amount: -50,
    description: 'Restaurant',
    type: 'expense',
    category: 'cat1',
    categoryName: 'Food',
    accountId: 'acc2',
    notes: 'Dinner with friends'
  },
  {
    id: 't3',
    date: new Date('2024-01-05'),
    amount: 200,
    description: 'Food Delivery Service',
    type: 'income',
    category: 'cat1',
    categoryName: 'Food',
    accountId: 'acc1'
  },
  {
    id: 't4',
    date: new Date('2024-01-20'),
    amount: -75,
    description: 'Utilities Bill',
    type: 'expense',
    category: 'cat2',
    categoryName: 'Utilities',
    accountId: 'acc1'
  },
  {
    id: 't5',
    date: new Date('2024-01-08'),
    amount: -30,
    description: 'Transfer to Savings',
    type: 'transfer',
    category: 'cat3',
    categoryName: 'Transfers',
    accountId: 'acc1'
  },
  {
    id: 't6',
    date: new Date('2024-01-12'),
    amount: 30,
    description: 'Transfer from Checking',
    type: 'transfer',
    category: 'cat3',
    categoryName: 'Transfers',
    accountId: 'acc2'
  }
];

const mockAccounts: Account[] = [
  {
    id: 'acc1',
    name: 'Checking',
    type: 'checking',
    balance: 1000,
    currency: 'USD',
    createdAt: new Date(),
    institution: 'Bank One'
  },
  {
    id: 'acc2',
    name: 'Savings',
    type: 'savings',
    balance: 5000,
    currency: 'USD',
    createdAt: new Date()
  }
];

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    transactions: mockTransactions,
    accounts: mockAccounts
  })
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `$${Math.abs(amount).toFixed(2)}`,
  })
}));

describe('CategoryTransactionsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    categoryId: 'cat1',
    categoryName: 'Food'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<CategoryTransactionsModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Transactions in "Food"')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      expect(screen.getByText('Transactions in "Food"')).toBeInTheDocument();
    });

    it('displays category name in header', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryName="Groceries" />);
      expect(screen.getByText('Transactions in "Groceries"')).toBeInTheDocument();
    });

    it('shows total transaction count', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      expect(screen.getByText('3 total transactions')).toBeInTheDocument();
    });

    it('displays all filter buttons', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      expect(screen.getByText('All Transactions')).toBeInTheDocument();
      expect(screen.getByText('All Income')).toBeInTheDocument();
      expect(screen.getByText('All Outgoings')).toBeInTheDocument();
    });

    it('shows date range inputs', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs).toHaveLength(2);
    });

    it('shows search input', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument();
    });
  });

  describe('Transaction Display', () => {
    it('displays transactions for the category', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
      expect(screen.getByText('Restaurant')).toBeInTheDocument();
      expect(screen.getByText('Food Delivery Service')).toBeInTheDocument();
    });

    it('does not display transactions from other categories', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      expect(screen.queryByText('Utilities Bill')).not.toBeInTheDocument();
    });

    it('shows transaction amounts with correct colors', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      // Find the amounts by looking for the formatted values
      const amounts = screen.getAllByText(/\$\d+\.\d+/);
      
      // Grocery Store expense ($100) - should be red
      const groceryAmount = amounts.find(el => el.textContent?.includes('100.00'));
      expect(groceryAmount).toHaveClass('text-red-600');
      
      // Food Delivery income ($200) - should be green  
      const incomeAmount = amounts.find(el => el.textContent?.includes('200.00'));
      expect(incomeAmount).toHaveClass('text-green-600');
    });

    it('shows transaction dates', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
      expect(screen.getByText(/1\/10\/2024/)).toBeInTheDocument();
    });

    it('shows account names', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      // There are multiple instances of account names, just verify they exist
      const checkingElements = screen.getAllByText(/Checking/);
      const savingsElements = screen.getAllByText(/Savings/);
      
      expect(checkingElements.length).toBeGreaterThan(0);
      expect(savingsElements.length).toBeGreaterThan(0);
    });

    it('sorts transactions by date (newest first)', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      // Get all transaction descriptions to check order
      const transactions = screen.getAllByText(/Grocery Store|Restaurant|Food Delivery Service/);
      
      // Should be ordered by date: Jan 15, Jan 10, Jan 5
      expect(transactions[0]).toHaveTextContent('Grocery Store'); // Jan 15
      expect(transactions[1]).toHaveTextContent('Restaurant');    // Jan 10
      expect(transactions[2]).toHaveTextContent('Food Delivery Service'); // Jan 5
    });
  });

  describe('Summary Calculations', () => {
    it('calculates totals correctly', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      // Income: $200
      expect(screen.getByText('Income:')).toBeInTheDocument();
      expect(screen.getByText('$200.00')).toBeInTheDocument();
      
      // Expense: $100 + $50 = $150
      expect(screen.getByText('Expense:')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();
      
      // Net: $200 - $150 = $50
      expect(screen.getByText('Net:')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('shows transfer labels for transfer category', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryId="cat3" categoryName="Transfers" />);
      
      expect(screen.getByText('Money In:')).toBeInTheDocument();
      expect(screen.getByText('Money Out:')).toBeInTheDocument();
    });

    it('shows checkmark for balanced transfers', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryId="cat3" categoryName="Transfers" />);
      
      // Find the Net: label and check its sibling content
      const netLabel = screen.getByText('Net:');
      const netContainer = netLabel.parentElement;
      
      // Should show checkmark for balanced transfers
      expect(netContainer).toHaveTextContent('✓');
    });
  });

  describe('Filter Functionality', () => {
    it('filters by transaction type - income', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('All Income'));
      
      expect(screen.getByText('Food Delivery Service')).toBeInTheDocument();
      expect(screen.queryByText('Grocery Store')).not.toBeInTheDocument();
      expect(screen.queryByText('Restaurant')).not.toBeInTheDocument();
    });

    it('filters by transaction type - expense', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('All Outgoings'));
      
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
      expect(screen.getByText('Restaurant')).toBeInTheDocument();
      expect(screen.queryByText('Food Delivery Service')).not.toBeInTheDocument();
    });

    it('highlights active filter button', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      const allButton = screen.getByText('All Transactions');
      const incomeButton = screen.getByText('All Income');
      
      // Initially "All" is active
      expect(allButton).toHaveClass('bg-primary');
      expect(incomeButton).not.toHaveClass('bg-green-500');
      
      // Click income
      fireEvent.click(incomeButton);
      
      expect(allButton).not.toHaveClass('bg-primary');
      expect(incomeButton).toHaveClass('bg-green-500');
    });

    it('filters by date range', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      const dateInputs = document.querySelectorAll('input[type="date"]');
      
      // Set from date to Jan 10
      fireEvent.change(dateInputs[0], { target: { value: '2024-01-10' } });
      
      // Should exclude Jan 5 transaction
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
      expect(screen.getByText('Restaurant')).toBeInTheDocument();
      expect(screen.queryByText('Food Delivery Service')).not.toBeInTheDocument();
    });

    it('sets initial date range from transactions', async () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      await waitFor(() => {
        const dateInputs = document.querySelectorAll('input[type="date"]');
        expect(dateInputs[0]).toHaveValue('2024-01-05'); // Earliest
        expect(dateInputs[1]).toHaveValue('2024-01-15'); // Latest
      });
    });
  });

  describe('Search Functionality', () => {
    it('shows search input functionality', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      expect(searchInput).toBeInTheDocument();
      
      // Can type in search input
      fireEvent.change(searchInput, { target: { value: 'test search' } });
      expect(searchInput).toHaveValue('test search');
    });


    it('shows clear search button', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      expect(screen.getByTitle('Clear search')).toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      expect(screen.getByTitle('Clear search')).toBeInTheDocument();
      
      fireEvent.click(screen.getByTitle('Clear search'));
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Empty States', () => {
    it('shows empty state for category with no transactions', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryId="cat999" />);
      
      expect(screen.getByText('No transactions in this category')).toBeInTheDocument();
    });

    it('shows placeholder text when empty', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryId="emptycat" />);
      
      // Should show empty state
      expect(screen.getByText('No transactions in this category')).toBeInTheDocument();
    });

    it('shows empty state for filtered results', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2025-01-01' } });
      
      expect(screen.getByText('No matching transactions found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your filters or date range')).toBeInTheDocument();
    });
  });

  describe('Transfer Transactions', () => {
    it('shows transfer type correctly', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryId="cat3" categoryName="Transfers" />);
      
      expect(screen.getByText('transfer (out)')).toBeInTheDocument();
      expect(screen.getByText('transfer (in)')).toBeInTheDocument();
    });

    it('filters transfers as income/expense based on amount', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryId="cat3" categoryName="Transfers" />);
      
      // Click income filter
      fireEvent.click(screen.getByText('All Income'));
      
      // Should show positive transfer
      expect(screen.getByText('Transfer from Checking')).toBeInTheDocument();
      expect(screen.queryByText('Transfer to Savings')).not.toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('shows filtered count', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      expect(screen.getByText('Showing 3 of 3 transactions')).toBeInTheDocument();
      
      // Apply filter
      fireEvent.click(screen.getByText('All Income'));
      
      expect(screen.getByText('Showing 1 of 3 transactions')).toBeInTheDocument();
    });

    it('has close button in footer', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      const closeButtons = screen.getAllByText('Close');
      expect(closeButtons).toHaveLength(1);
    });
  });

  describe('User Actions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(<CategoryTransactionsModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Close button clicked', () => {
      const onClose = vi.fn();
      render(<CategoryTransactionsModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Close'));
      expect(onClose).toHaveBeenCalled();
    });

    it('resets filters when modal closes', () => {
      const { rerender } = render(<CategoryTransactionsModal {...defaultProps} />);
      
      // Set some filters
      fireEvent.click(screen.getByText('All Income'));
      fireEvent.change(screen.getByPlaceholderText('Search transactions...'), { target: { value: 'test' } });
      
      // Close and reopen
      rerender(<CategoryTransactionsModal {...defaultProps} isOpen={false} />);
      rerender(<CategoryTransactionsModal {...defaultProps} isOpen={true} />);
      
      // Check filters are reset
      expect(screen.getByText('All Transactions')).toHaveClass('bg-primary');
      expect(screen.getByPlaceholderText('Search transactions...')).toHaveValue('');
    });
  });

  describe('Edge Cases', () => {
    it('displays all filter counts correctly', () => {
      render(<CategoryTransactionsModal {...defaultProps} />);
      
      // Click different filters and check counts
      fireEvent.click(screen.getByText('All Income'));
      expect(screen.getByText('Showing 1 of 3 transactions')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('All Outgoings'));
      expect(screen.getByText('Showing 2 of 3 transactions')).toBeInTheDocument();
    });

    it('handles empty category gracefully', () => {
      render(<CategoryTransactionsModal {...defaultProps} categoryId="nonexistent" />);
      
      expect(screen.getByText('0 total transactions')).toBeInTheDocument();
      expect(screen.getByText('No transactions in this category')).toBeInTheDocument();
    });
  });
});