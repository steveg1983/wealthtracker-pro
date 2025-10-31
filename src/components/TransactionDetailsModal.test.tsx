/**
 * TransactionDetailsModal Tests
 * Comprehensive tests for the transaction details modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionDetailsModal from './TransactionDetailsModal';
import type { Transaction, Account } from '../types';

// Mock dependencies
vi.mock('./icons/XIcon', () => ({
  XIcon: ({ size, className }: any) => (
    <div data-testid="x-icon" data-size={size} className={className}>✕</div>
  ),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => {
      if (amount === 85.5) return '$85.5';
      if (amount === 1234567.89) return '$1,234,567.89';
      return `$${amount.toLocaleString()}`;
    },
  }),
}));

vi.mock('../utils/decimal', () => ({
  toDecimal: (value: number) => ({
    plus: function(other: any) {
      const result = this.value + (other?.value ?? other);
      return { 
        value: result, 
        plus: this.plus, 
        toString: () => result.toString() 
      };
    },
    value: value,
    toString: () => value.toString(),
  }),
}));

describe('TransactionDetailsModal', () => {
  const mockOnClose = vi.fn();

  const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
    id: 'acc-1',
    name: 'Checking Account',
    type: 'checking',
    balance: 1000,
    currency: 'USD',
    lastUpdated: new Date(),
    ...overrides,
  });

  const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'txn-1',
    description: 'Test Transaction',
    amount: 100,
    type: 'expense',
    accountId: 'acc-1',
    date: new Date('2023-01-15'),
    category: 'Food',
    tags: [],
    notes: '',
    cleared: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (
    isOpen = true,
    transactions: Transaction[] = [createMockTransaction()],
    title = 'January 2023 Transactions',
    accounts: Account[] = [createMockAccount()]
  ) => {
    return render(
      <TransactionDetailsModal
        isOpen={isOpen}
        onClose={mockOnClose}
        transactions={transactions}
        title={title}
        accounts={accounts}
      />
    );
  };

  describe('rendering', () => {
    it('renders when open', () => {
      renderModal(true);
      
      expect(screen.getByText('Transaction Details')).toBeInTheDocument();
      expect(screen.getByText('January 2023 Transactions')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderModal(false);
      
      expect(screen.queryByText('Transaction Details')).not.toBeInTheDocument();
    });

    it('displays close button with X icon', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('displays modal title and subtitle', () => {
      renderModal(true, [createMockTransaction()], 'Custom Title');
      
      expect(screen.getByText('Transaction Details')).toBeInTheDocument();
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('has proper modal structure and styling', () => {
      renderModal();
      
      const modal = screen.getByText('Transaction Details').closest('.bg-white');
      expect(modal).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-lg', 'max-w-3xl');
    });
  });

  describe('transaction display', () => {
    it('displays individual transactions correctly', () => {
      const transaction = createMockTransaction({
        description: 'Grocery Shopping',
        amount: 85.50,
        date: new Date('2023-01-15'),
        type: 'expense',
      });
      renderModal(true, [transaction]);
      
      expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
      const amountElements = screen.getAllByText('$85.5');
      expect(amountElements).toHaveLength(2); // One for transaction, one for total
      expect(screen.getByText('1/15/2023')).toBeInTheDocument();
    });

    it('displays account names correctly', () => {
      const accounts = [
        createMockAccount({ id: 'acc-1', name: 'Checking Account' }),
        createMockAccount({ id: 'acc-2', name: 'Savings Account' }),
      ];
      const transactions = [
        createMockTransaction({ accountId: 'acc-1' }),
        createMockTransaction({ id: 'txn-2', accountId: 'acc-2' }),
      ];
      renderModal(true, transactions, 'Test', accounts);
      
      expect(screen.getByText('Checking Account')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
    });

    it('handles unknown account IDs gracefully', () => {
      const transaction = createMockTransaction({ accountId: 'unknown-acc' });
      renderModal(true, [transaction]);
      
      expect(screen.getByText('Unknown Account')).toBeInTheDocument();
    });

    it('applies correct colors for income transactions', () => {
      const transaction = createMockTransaction({
        type: 'income',
        amount: 2000,
      });
      renderModal(true, [transaction]);
      
      const transactionAmountElement = screen.getAllByText('$2,000').find(el => 
        el.classList.contains('font-semibold') && !el.classList.contains('text-lg')
      );
      expect(transactionAmountElement).toHaveClass('text-green-600', 'dark:text-green-400');
    });

    it('applies correct colors for expense transactions', () => {
      const transaction = createMockTransaction({
        type: 'expense',
        amount: 150,
      });
      renderModal(true, [transaction]);
      
      const transactionAmountElement = screen.getAllByText('$150').find(el => 
        el.classList.contains('font-semibold') && !el.classList.contains('text-lg')
      );
      expect(transactionAmountElement).toHaveClass('text-red-600', 'dark:text-red-400');
    });

    it('displays multiple transactions', () => {
      const transactions = [
        createMockTransaction({ id: 'txn-1', description: 'Transaction 1', amount: 100 }),
        createMockTransaction({ id: 'txn-2', description: 'Transaction 2', amount: 200 }),
        createMockTransaction({ id: 'txn-3', description: 'Transaction 3', amount: 300 }),
      ];
      renderModal(true, transactions);
      
      expect(screen.getByText('Transaction 1')).toBeInTheDocument();
      expect(screen.getByText('Transaction 2')).toBeInTheDocument();
      expect(screen.getByText('Transaction 3')).toBeInTheDocument();
    });

    it('handles hover effects on transaction rows', () => {
      const transaction = createMockTransaction();
      renderModal(true, [transaction]);
      
      const transactionRow = screen.getByText('Test Transaction').closest('.bg-gray-50');
      expect(transactionRow).toHaveClass('hover:bg-gray-100', 'dark:hover:bg-gray-600');
    });
  });

  describe('totals calculation', () => {
    it('calculates and displays total for single transaction', () => {
      const transaction = createMockTransaction({ amount: 150 });
      renderModal(true, [transaction]);
      
      expect(screen.getByText('Total')).toBeInTheDocument();
      const amountElements = screen.getAllByText('$150');
      expect(amountElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('1 transaction')).toBeInTheDocument();
    });

    it('calculates and displays total for multiple transactions', () => {
      const transactions = [
        createMockTransaction({ amount: 100 }),
        createMockTransaction({ id: 'txn-2', amount: 200 }),
        createMockTransaction({ id: 'txn-3', amount: 150 }),
      ];
      renderModal(true, transactions);
      
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('3 transactions')).toBeInTheDocument();
    });

    it('handles negative amounts correctly in total', () => {
      const transactions = [
        createMockTransaction({ amount: -100, type: 'expense' }),
        createMockTransaction({ id: 'txn-2', amount: -200, type: 'expense' }),
      ];
      renderModal(true, transactions);
      
      // Should use absolute values for calculation
      const amount100Elements = screen.getAllByText('$100');
      const amount200Elements = screen.getAllByText('$200');
      expect(amount100Elements.length).toBeGreaterThanOrEqual(1);
      expect(amount200Elements.length).toBeGreaterThanOrEqual(1);
    });

    it('applies correct color to total based on transaction type', () => {
      const incomeTransactions = [
        createMockTransaction({ type: 'income', amount: 1000 }),
      ];
      renderModal(true, incomeTransactions);
      
      const totalAmountContainer = screen.getByText('Total').parentElement;
      const totalAmountElement = totalAmountContainer?.querySelector('.text-lg.font-bold');
      expect(totalAmountElement).toHaveClass('text-green-600', 'dark:text-green-400');
    });

    it('handles mixed transaction types for total color', () => {
      const transactions = [
        createMockTransaction({ type: 'expense', amount: 100 }),
        createMockTransaction({ id: 'txn-2', type: 'income', amount: 200 }),
      ];
      renderModal(true, transactions);
      
      // Should use color of first transaction
      const totalAmountContainer = screen.getByText('Total').parentElement;
      const totalAmountElement = totalAmountContainer?.querySelector('.text-lg.font-bold');
      expect(totalAmountElement).toHaveClass('text-red-600', 'dark:text-red-400');
    });
  });

  describe('empty state', () => {
    it('displays empty state when no transactions', () => {
      renderModal(true, []);
      
      expect(screen.getByText('No transactions found for this period')).toBeInTheDocument();
      expect(screen.queryByText('Total')).not.toBeInTheDocument();
    });

    it('centers empty state message', () => {
      renderModal(true, []);
      
      const emptyMessage = screen.getByText('No transactions found for this period');
      expect(emptyMessage).toHaveClass('text-center', 'py-8');
    });

    it('does not display transaction list when empty', () => {
      renderModal(true, []);
      
      expect(screen.queryByText('Total')).not.toBeInTheDocument();
      expect(screen.queryByText('transactions')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const closeButton = screen.getByRole('button');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button clicked with fireEvent', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('handles multiple close button clicks', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const closeButton = screen.getByRole('button');
      await user.click(closeButton);
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });

    it('supports keyboard navigation', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button');
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('styling and layout', () => {
    it('has proper modal overlay styling', () => {
      renderModal();
      
      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black', 'bg-opacity-50');
    });

    it('has proper modal content styling', () => {
      renderModal();
      
      const modalContent = screen.getByText('Transaction Details').closest('.bg-white');
      expect(modalContent).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-lg');
    });

    it('has proper header styling', () => {
      renderModal();
      
      const header = screen.getByText('Transaction Details').closest('.border-b');
      expect(header).toHaveClass('p-6', 'border-b', 'border-gray-200');
    });

    it('has proper transaction row styling', () => {
      renderModal();
      
      const transactionRow = screen.getByText('Test Transaction').closest('.bg-gray-50');
      expect(transactionRow).toHaveClass(
        'flex', 'items-center', 'justify-between', 'p-3', 
        'bg-gray-50', 'rounded-lg'
      );
    });

    it('has proper totals section styling', () => {
      renderModal();
      
      const totalsSection = screen.getByText('Total').closest('.border-t');
      expect(totalsSection).toHaveClass('pt-4', 'border-t', 'border-gray-200');
    });

    it('has scrollable content area', () => {
      renderModal();
      
      const contentArea = screen.getByText('Test Transaction').closest('.overflow-y-auto');
      expect(contentArea).toHaveClass('overflow-y-auto', 'max-h-[60vh]');
    });
  });

  describe('accessibility', () => {
    it('has proper modal structure', () => {
      renderModal();
      
      // Modal should be properly contained
      const modal = screen.getByText('Transaction Details').closest('.bg-white');
      expect(modal).toBeInTheDocument();
    });

    it('has proper close button', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('has proper heading structure', () => {
      renderModal();
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Transaction Details');
    });

    it('supports keyboard interaction', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button');
      
      // Should be focusable
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('date formatting', () => {
    it('formats dates correctly', () => {
      const transaction = createMockTransaction({
        date: new Date('2023-02-28'),
      });
      renderModal(true, [transaction]);
      
      expect(screen.getByText('2/28/2023')).toBeInTheDocument();
    });

    it('handles different date formats', () => {
      const transactions = [
        createMockTransaction({ id: 'txn-1', date: new Date('2023-01-01') }),
        createMockTransaction({ id: 'txn-2', date: new Date('2023-12-31') }),
      ];
      renderModal(true, transactions);
      
      expect(screen.getByText('1/1/2023')).toBeInTheDocument();
      expect(screen.getByText('12/31/2023')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles very long transaction descriptions', () => {
      const longDescription = 'A'.repeat(100);
      const transaction = createMockTransaction({
        description: longDescription,
      });
      renderModal(true, [transaction]);
      
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('handles very large amounts', () => {
      const transaction = createMockTransaction({
        amount: 1234567.89,
      });
      renderModal(true, [transaction]);
      
      const amountElements = screen.getAllByText('$1,234,567.89');
      expect(amountElements.length).toBeGreaterThanOrEqual(1);
    });

    it('handles zero amounts', () => {
      const transaction = createMockTransaction({
        amount: 0,
      });
      renderModal(true, [transaction]);
      
      const zeroAmountElements = screen.getAllByText('$0');
      expect(zeroAmountElements.length).toBeGreaterThanOrEqual(1);
    });

    it('handles modal state changes during interaction', () => {
      const { rerender } = renderModal(true);
      
      expect(screen.getByText('Transaction Details')).toBeInTheDocument();
      
      rerender(
        <TransactionDetailsModal
          isOpen={false}
          onClose={mockOnClose}
          transactions={[createMockTransaction()]}
          title="Test"
          accounts={[createMockAccount()]}
        />
      );
      
      expect(screen.queryByText('Transaction Details')).not.toBeInTheDocument();
    });

    it('handles large number of transactions', () => {
      const transactions = Array.from({ length: 100 }, (_, i) => 
        createMockTransaction({ 
          id: `txn-${i}`, 
          description: `Transaction ${i}`,
          amount: (i + 1) * 10,
        })
      );
      renderModal(true, transactions);
      
      expect(screen.getByText('100 transactions')).toBeInTheDocument();
      expect(screen.getByText('Transaction 0')).toBeInTheDocument();
      expect(screen.getByText('Transaction 99')).toBeInTheDocument();
    });

    it('handles missing account data gracefully', () => {
      const transaction = createMockTransaction({
        accountId: 'missing-account',
      });
      renderModal(true, [transaction], 'Test', []);
      
      expect(screen.getByText('Unknown Account')).toBeInTheDocument();
    });
  });

  describe('real-world scenarios', () => {
    it('displays monthly expense summary correctly', () => {
      const expenses = [
        createMockTransaction({ 
          id: 'exp-1', 
          description: 'Groceries', 
          amount: 125.50, 
          type: 'expense',
          date: new Date('2023-01-05'),
        }),
        createMockTransaction({ 
          id: 'exp-2', 
          description: 'Gas Station', 
          amount: 45.00, 
          type: 'expense',
          date: new Date('2023-01-10'),
        }),
        createMockTransaction({ 
          id: 'exp-3', 
          description: 'Restaurant', 
          amount: 78.25, 
          type: 'expense',
          date: new Date('2023-01-15'),
        }),
      ];
      
      renderModal(true, expenses, 'January 2023 Expenses');
      
      expect(screen.getByText('January 2023 Expenses')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Gas Station')).toBeInTheDocument();
      expect(screen.getByText('Restaurant')).toBeInTheDocument();
      expect(screen.getByText('3 transactions')).toBeInTheDocument();
      
      // All amounts should be red (expense)
      const transactionRows = screen.getAllByText(/\$\d+/).filter(el => 
        el.classList.contains('font-semibold') && 
        (el.classList.contains('text-red-600') || el.classList.contains('text-green-600'))
      );
      transactionRows.forEach(element => {
        expect(element).toHaveClass('text-red-600');
      });
    });

    it('displays income summary correctly', () => {
      const income = [
        createMockTransaction({ 
          id: 'inc-1', 
          description: 'Salary', 
          amount: 3000, 
          type: 'income',
        }),
        createMockTransaction({ 
          id: 'inc-2', 
          description: 'Freelance Work', 
          amount: 500, 
          type: 'income',
        }),
      ];
      
      renderModal(true, income, 'January 2023 Income');
      
      expect(screen.getByText('January 2023 Income')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Freelance Work')).toBeInTheDocument();
      expect(screen.getByText('2 transactions')).toBeInTheDocument();
      
      // All amounts should be green (income)
      const transactionRows = screen.getAllByText(/\$\d+/).filter(el => 
        el.classList.contains('font-semibold') && 
        (el.classList.contains('text-red-600') || el.classList.contains('text-green-600'))
      );
      transactionRows.forEach(element => {
        expect(element).toHaveClass('text-green-600');
      });
    });

    it('displays multi-account transactions correctly', () => {
      const accounts = [
        createMockAccount({ id: 'checking', name: 'Main Checking' }),
        createMockAccount({ id: 'savings', name: 'High Yield Savings' }),
        createMockAccount({ id: 'credit', name: 'Credit Card' }),
      ];
      
      const transactions = [
        createMockTransaction({ 
          accountId: 'checking', 
          description: 'Direct Deposit',
          type: 'income',
        }),
        createMockTransaction({ 
          id: 'txn-2',
          accountId: 'savings', 
          description: 'Interest Payment',
          type: 'income',
        }),
        createMockTransaction({ 
          id: 'txn-3',
          accountId: 'credit', 
          description: 'Online Purchase',
          type: 'expense',
        }),
      ];
      
      renderModal(true, transactions, 'Multi-Account Summary', accounts);
      
      expect(screen.getByText('Main Checking')).toBeInTheDocument();
      expect(screen.getByText('High Yield Savings')).toBeInTheDocument();
      expect(screen.getByText('Credit Card')).toBeInTheDocument();
    });

    it('handles user closing modal after review', async () => {
      const user = userEvent.setup();
      renderModal();
      
      // User reviews the transactions
      expect(screen.getByText('Test Transaction')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      
      // User closes the modal
      const closeButton = screen.getByRole('button');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('displays empty period correctly', () => {
      renderModal(true, [], 'March 2023 - No Activity');
      
      expect(screen.getByText('March 2023 - No Activity')).toBeInTheDocument();
      expect(screen.getByText('No transactions found for this period')).toBeInTheDocument();
      expect(screen.queryByText('Total')).not.toBeInTheDocument();
    });
  });
});
