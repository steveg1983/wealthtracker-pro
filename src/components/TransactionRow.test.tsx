/**
 * TransactionRow Tests
 * Tests for the transaction row component with various configurations
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { TransactionRow } from './TransactionRow';
import type { Transaction, Account } from '../types';

// Mock the external components and hooks
vi.mock('./LocalMerchantLogo', () => ({
  default: ({ description, size }: any) => (
    <div data-testid="merchant-logo" data-description={description} data-size={size}>
      Logo
    </div>
  )
}));

vi.mock('./MarkdownNote', () => ({
  default: ({ content }: any) => (
    <div data-testid="markdown-note" data-content={content}>
      {content}
    </div>
  )
}));

vi.mock('../hooks/useFormattedValues', () => ({
  useFormattedDate: vi.fn((date: Date) => {
    return new Date(date).toLocaleDateString('en-GB');
  })
}));

// Mock icons
vi.mock('./icons', () => ({
  TrendingUpIcon: ({ className, size }: any) => (
    <div data-testid="trending-up-icon" className={className} data-size={size} />
  ),
  TrendingDownIcon: ({ className, size }: any) => (
    <div data-testid="trending-down-icon" className={className} data-size={size} />
  ),
  CheckIcon: ({ className, size }: any) => (
    <div data-testid="check-icon" className={className} data-size={size} />
  ),
  EditIcon: ({ size }: any) => (
    <div data-testid="edit-icon" data-size={size} />
  ),
  DeleteIcon: ({ size }: any) => (
    <div data-testid="delete-icon" data-size={size} />
  )
}));

vi.mock('./icons/IconButton', () => ({
  IconButton: ({ icon, onClick, className, title, size, 'data-testid': dataTestId }: any) => (
    <button
      onClick={onClick}
      className={className}
      title={title}
      data-size={size}
      data-testid={dataTestId}
    >
      {icon}
    </button>
  )
}));

describe('TransactionRow', () => {
  const mockFormatCurrency = vi.fn((amount: number, currency?: string) => {
    const symbol = currency === 'USD' ? '$' : '£';
    return `${symbol}${amount.toFixed(2)}`;
  });

  const mockTransaction: Transaction = {
    id: 'tx-1',
    date: new Date('2024-01-15'),
    description: 'Grocery Store Purchase',
    category: 'cat-1',
    type: 'expense',
    amount: 45.50,
    accountId: 'acc-1',
    cleared: true,
    notes: 'Weekly groceries',
    tags: ['food', 'essentials']
  };

  const mockAccount: Account = {
    id: 'acc-1',
    name: 'Checking Account',
    type: 'current',
    balance: 5000,
    currency: 'GBP',
    institution: 'HSBC',
    lastUpdated: new Date('2024-01-15')
  };

  const defaultProps = {
    transaction: mockTransaction,
    account: mockAccount,
    categoryPath: 'Food & Dining > Groceries',
    compactView: false,
    formatCurrency: mockFormatCurrency,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    columnOrder: ['date', 'reconciled', 'account', 'description', 'category', 'amount', 'actions'],
    columnWidths: {
      date: 120,
      reconciled: 60,
      account: 150,
      description: 300,
      category: 200,
      amount: 120,
      actions: 100
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders all transaction details correctly', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} />
          </tbody>
        </table>
      );

      // Date
      expect(screen.getByText('15/01/2024')).toBeInTheDocument();
      
      // Account
      expect(screen.getByText('Checking Account')).toBeInTheDocument();
      
      // Description
      expect(screen.getByText('Grocery Store Purchase')).toBeInTheDocument();
      
      // Category
      expect(screen.getByText('Food & Dining > Groceries')).toBeInTheDocument();
      
      // Amount
      expect(screen.getByText('-£45.50')).toBeInTheDocument();
      
      // Notes
      expect(screen.getByTestId('markdown-note')).toHaveAttribute('data-content', 'Weekly groceries');
      
      // Tags
      expect(screen.getByText('food')).toBeInTheDocument();
      expect(screen.getByText('essentials')).toBeInTheDocument();
    });

    it('renders income transaction with correct styling', () => {
      const incomeTransaction = {
        ...mockTransaction,
        type: 'income' as const,
        amount: 3000
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} transaction={incomeTransaction} />
          </tbody>
        </table>
      );

      // Should show plus sign and green color
      expect(screen.getByText('+£3000.00')).toBeInTheDocument();
      expect(screen.getByText('+£3000.00')).toHaveClass('text-green-600');
      
      // Should show up trending icon
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('renders expense transaction with correct styling', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} />
          </tbody>
        </table>
      );

      // Should show minus sign and red color
      expect(screen.getByText('-£45.50')).toBeInTheDocument();
      expect(screen.getByText('-£45.50')).toHaveClass('text-red-600');
      
      // Should show down trending icon
      expect(screen.getByTestId('trending-down-icon')).toBeInTheDocument();
    });

    it('shows check icon for cleared transactions', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} />
          </tbody>
        </table>
      );

      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    it('does not show check icon for uncleared transactions', () => {
      const unclearedTransaction = {
        ...mockTransaction,
        cleared: false
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} transaction={unclearedTransaction} />
          </tbody>
        </table>
      );

      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
    });
  });

  describe('Compact View', () => {
    it('applies compact styling when compactView is true', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} compactView={true} />
          </tbody>
        </table>
      );

      // Check icon sizes
      const trendingIcon = screen.getByTestId('trending-down-icon');
      expect(trendingIcon).toHaveAttribute('data-size', '16');

      const checkIcon = screen.getByTestId('check-icon');
      expect(checkIcon).toHaveAttribute('data-size', '14');

      // Check merchant logo size
      const merchantLogo = screen.getByTestId('merchant-logo');
      expect(merchantLogo).toHaveAttribute('data-size', 'sm');

      // Check button icon sizes
      const editIcon = screen.getByTestId('edit-icon');
      expect(editIcon).toHaveAttribute('data-size', '14');
    });

    it('applies normal styling when compactView is false', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} compactView={false} />
          </tbody>
        </table>
      );

      // Check icon sizes
      const trendingIcon = screen.getByTestId('trending-down-icon');
      expect(trendingIcon).toHaveAttribute('data-size', '20');

      const checkIcon = screen.getByTestId('check-icon');
      expect(checkIcon).toHaveAttribute('data-size', '16');

      // Check merchant logo size
      const merchantLogo = screen.getByTestId('merchant-logo');
      expect(merchantLogo).toHaveAttribute('data-size', 'md');
    });
  });

  describe('Actions', () => {
    it('calls onEdit when edit button is clicked', () => {
      const onEdit = vi.fn();
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} onEdit={onEdit} />
          </tbody>
        </table>
      );

      const editButton = screen.getByTestId('edit-button');
      fireEvent.click(editButton);

      expect(onEdit).toHaveBeenCalledWith(mockTransaction);
    });

    it('calls onDelete when delete button is clicked', () => {
      const onDelete = vi.fn();
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} onDelete={onDelete} />
          </tbody>
        </table>
      );

      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith('tx-1');
    });

    it('calls onView when description is clicked and onView is provided', () => {
      const onView = vi.fn();
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} onView={onView} />
          </tbody>
        </table>
      );

      const description = screen.getByText('Grocery Store Purchase');
      fireEvent.click(description);

      expect(onView).toHaveBeenCalledWith(mockTransaction);
    });

    it('does not make description clickable when onView is not provided', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} onView={undefined} />
          </tbody>
        </table>
      );

      const description = screen.getByText('Grocery Store Purchase');
      expect(description).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Bulk Selection', () => {
    it('shows checkbox when enableBulkSelection is true', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} enableBulkSelection={true} />
          </tbody>
        </table>
      );

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('does not show checkbox when enableBulkSelection is false', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} enableBulkSelection={false} />
          </tbody>
        </table>
      );

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('shows selected state correctly', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} enableBulkSelection={true} isSelected={true} />
          </tbody>
        </table>
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      
      // Check row has selected styling
      const row = checkbox.closest('tr');
      expect(row).toHaveClass('bg-blue-50', 'dark:bg-blue-900/20');
    });

    it('calls onToggleSelection when checkbox is clicked', () => {
      const onToggleSelection = vi.fn();
      render(
        <table>
          <tbody>
            <TransactionRow 
              {...defaultProps} 
              enableBulkSelection={true} 
              onToggleSelection={onToggleSelection} 
            />
          </tbody>
        </table>
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onToggleSelection).toHaveBeenCalledWith('tx-1');
    });

    it('calls onToggleSelection when row is clicked in bulk selection mode', () => {
      const onToggleSelection = vi.fn();
      render(
        <table>
          <tbody>
            <TransactionRow 
              {...defaultProps} 
              enableBulkSelection={true} 
              onToggleSelection={onToggleSelection} 
            />
          </tbody>
        </table>
      );

      const row = screen.getByRole('checkbox').closest('tr')!;
      fireEvent.click(row);

      expect(onToggleSelection).toHaveBeenCalledWith('tx-1');
    });
  });

  describe('Column Ordering', () => {
    it('renders columns in the specified order', () => {
      const customOrder = ['amount', 'description', 'date'];
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} columnOrder={customOrder} />
          </tbody>
        </table>
      );

      const cells = screen.getByRole('row').querySelectorAll('td');
      
      // First cell should be amount
      expect(cells[0].textContent).toContain('£45.50');
      
      // Second cell should be description
      expect(cells[1].textContent).toContain('Grocery Store Purchase');
      
      // Third cell should be date
      expect(cells[2].textContent).toContain('15/01/2024');
    });

    it('only renders columns that are in columnOrder', () => {
      const limitedOrder = ['date', 'description', 'amount'];
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} columnOrder={limitedOrder} />
          </tbody>
        </table>
      );

      // Should not show reconciled, account, category, or actions
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
      expect(screen.queryByText('Checking Account')).not.toBeInTheDocument();
      expect(screen.queryByText('Food & Dining > Groceries')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing account gracefully', () => {
      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} account={undefined} />
          </tbody>
        </table>
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('handles transaction without notes', () => {
      const transactionWithoutNotes = {
        ...mockTransaction,
        notes: undefined
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} transaction={transactionWithoutNotes} />
          </tbody>
        </table>
      );

      expect(screen.queryByTestId('markdown-note')).not.toBeInTheDocument();
    });

    it('handles transaction without tags', () => {
      const transactionWithoutTags = {
        ...mockTransaction,
        tags: undefined
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} transaction={transactionWithoutTags} />
          </tbody>
        </table>
      );

      expect(screen.queryByText('food')).not.toBeInTheDocument();
      expect(screen.queryByText('essentials')).not.toBeInTheDocument();
    });

    it('handles empty tags array', () => {
      const transactionWithEmptyTags = {
        ...mockTransaction,
        tags: []
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} transaction={transactionWithEmptyTags} />
          </tbody>
        </table>
      );

      expect(screen.queryByText('food')).not.toBeInTheDocument();
    });
  });

  describe('Transfer Transactions', () => {
    it('shows income styling for positive transfer', () => {
      const positiveTransfer = {
        ...mockTransaction,
        type: 'transfer' as const,
        amount: 100
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} transaction={positiveTransfer} />
          </tbody>
        </table>
      );

      expect(screen.getByText('+£100.00')).toHaveClass('text-green-600');
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('shows expense styling for negative transfer', () => {
      const negativeTransfer = {
        ...mockTransaction,
        type: 'transfer' as const,
        amount: -100
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} transaction={negativeTransfer} />
          </tbody>
        </table>
      );

      expect(screen.getByText('-£100.00')).toHaveClass('text-red-600');
      expect(screen.getByTestId('trending-down-icon')).toBeInTheDocument();
    });
  });

  describe('Currency Handling', () => {
    it('formats amount with account currency', () => {
      const usdAccount = {
        ...mockAccount,
        currency: 'USD'
      };

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} account={usdAccount} />
          </tbody>
        </table>
      );

      expect(screen.getByText('-$45.50')).toBeInTheDocument();
    });

    it('uses default formatting when account has no currency', () => {
      const accountWithoutCurrency = {
        ...mockAccount,
        currency: undefined
      } as any;

      render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} account={accountWithoutCurrency} />
          </tbody>
        </table>
      );

      expect(screen.getByText('-£45.50')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('memoizes component correctly', () => {
      const { rerender } = render(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} />
          </tbody>
        </table>
      );

      // Initial render
      expect(screen.getByText('Grocery Store Purchase')).toBeInTheDocument();

      // Re-render with same props - component should not re-render
      rerender(
        <table>
          <tbody>
            <TransactionRow {...defaultProps} />
          </tbody>
        </table>
      );

      expect(screen.getByText('Grocery Store Purchase')).toBeInTheDocument();
    });
  });
});