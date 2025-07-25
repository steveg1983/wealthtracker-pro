import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SplitTransactionModal from './SplitTransactionModal';
import type { Transaction } from '../types';

// Mock icons
vi.mock('./icons/XIcon', () => ({
  XIcon: ({ size }: any) => <div data-testid="x-icon">X</div>,
}));

vi.mock('./icons/PlusIcon', () => ({
  PlusIcon: ({ size }: any) => <div data-testid="plus-icon">Plus</div>,
}));

vi.mock('./icons/DeleteIcon', () => ({
  DeleteIcon: ({ size }: any) => <div data-testid="delete-icon">Delete</div>,
}));

// Mock useApp hook
const mockUpdateTransaction = vi.fn();
const mockAddTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    updateTransaction: mockUpdateTransaction,
    addTransaction: mockAddTransaction,
    deleteTransaction: mockDeleteTransaction,
  })
}));

describe('SplitTransactionModal', () => {
  const mockTransaction: Transaction = {
    id: 't1',
    date: new Date('2024-01-15'),
    amount: 100,
    description: 'Grocery Shopping',
    type: 'expense',
    category: 'food',
    accountId: 'acc1'
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    transaction: mockTransaction
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<SplitTransactionModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Split Transaction')).not.toBeInTheDocument();
    });

    it('renders nothing when transaction is null', () => {
      render(<SplitTransactionModal {...defaultProps} transaction={null as any} />);
      expect(screen.queryByText('Split Transaction')).not.toBeInTheDocument();
    });

    it('renders modal when open with transaction', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
    });

    it('displays original amount', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      expect(screen.getByText('Original Amount:')).toBeInTheDocument();
      expect(screen.getByText('£100.00')).toBeInTheDocument();
    });

    it('displays remaining amount', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      expect(screen.getByText('Remaining:')).toBeInTheDocument();
      expect(screen.getByText('£0.00')).toBeInTheDocument();
    });

    it('initializes with transaction data', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const categoryInput = screen.getByPlaceholderText('Category') as HTMLInputElement;
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      const descriptionInput = screen.getByPlaceholderText('Description') as HTMLInputElement;
      
      expect(categoryInput.value).toBe('food');
      expect(amountInput.value).toBe('100');
      expect(descriptionInput.value).toBe('Grocery Shopping');
    });

    it('loads existing splits if present', () => {
      const transactionWithSplits = {
        ...mockTransaction,
        splits: [
          { category: 'food', amount: 60, description: 'Groceries' },
          { category: 'household', amount: 40, description: 'Cleaning supplies' }
        ]
      };
      
      render(<SplitTransactionModal {...defaultProps} transaction={transactionWithSplits} />);
      
      const categoryInputs = screen.getAllByPlaceholderText('Category');
      expect(categoryInputs).toHaveLength(2);
      expect(categoryInputs[0]).toHaveValue('food');
      expect(categoryInputs[1]).toHaveValue('household');
    });
  });

  describe('Split Management', () => {
    it('adds new split when Add Split clicked', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Add Split'));
      
      const categoryInputs = screen.getAllByPlaceholderText('Category');
      expect(categoryInputs).toHaveLength(2);
    });

    it('sets remaining amount as default for new split', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Change first split amount to 60
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '60' } });
      
      // Add new split
      fireEvent.click(screen.getByText('Add Split'));
      
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      expect(amountInputs[1].value).toBe('40'); // Remaining amount
    });

    it('removes split when delete button clicked', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Add a second split
      fireEvent.click(screen.getByText('Add Split'));
      
      // Should have delete buttons now
      const deleteButtons = screen.getAllByTestId('delete-icon');
      expect(deleteButtons).toHaveLength(2);
      
      // Remove first split
      fireEvent.click(deleteButtons[0].parentElement!);
      
      const categoryInputs = screen.getAllByPlaceholderText('Category');
      expect(categoryInputs).toHaveLength(1);
    });

    it('does not show delete button when only one split', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      expect(screen.queryByTestId('delete-icon')).not.toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    it('updates category input', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const categoryInput = screen.getByPlaceholderText('Category') as HTMLInputElement;
      fireEvent.change(categoryInput, { target: { value: 'entertainment' } });
      
      expect(categoryInput.value).toBe('entertainment');
    });

    it('updates amount input', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '75.50' } });
      
      expect(amountInput.value).toBe('75.50');
    });

    it('updates description input', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const descriptionInput = screen.getByPlaceholderText('Description') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'New description' } });
      
      expect(descriptionInput.value).toBe('New description');
    });

    it('handles invalid amount input', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: 'abc' } });
      
      expect(amountInput.value).toBe('0');
    });
  });

  describe('Remaining Amount Calculation', () => {
    it('updates remaining amount when split amounts change', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '60' } });
      
      expect(screen.getByText('£40.00')).toBeInTheDocument();
    });

    it('shows red text when remaining amount is not zero', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '60' } });
      
      // Find the element that contains the remaining amount styling
      const remainingElement = screen.getByText('Remaining:').closest('p');
      expect(remainingElement).toHaveClass('text-red-600');
    });

    it('shows green text when remaining amount is zero', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const remainingElement = screen.getByText('Remaining:').closest('p');
      expect(remainingElement).toHaveClass('text-green-600');
    });

    it('calculates correctly with multiple splits', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Change first split to 60
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '60' } });
      
      // Add second split
      fireEvent.click(screen.getByText('Add Split'));
      
      // Change second split to 30
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      fireEvent.change(amountInputs[1], { target: { value: '30' } });
      
      // Remaining should be 10
      expect(screen.getByText('£10.00')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('prevents save when amounts do not match total', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Change amount to not match total
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '50' } });
      
      // Save button should be disabled
      const saveButton = screen.getByText('Save Split');
      expect(saveButton).toBeDisabled();
      
      // Clicking should not call any functions
      fireEvent.click(saveButton);
      expect(mockUpdateTransaction).not.toHaveBeenCalled();
      expect(mockDeleteTransaction).not.toHaveBeenCalled();
    });

    it('updates transaction when single split', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Change category
      const categoryInput = screen.getByPlaceholderText('Category') as HTMLInputElement;
      fireEvent.change(categoryInput, { target: { value: 'dining' } });
      
      fireEvent.click(screen.getByText('Save Split'));
      
      expect(mockUpdateTransaction).toHaveBeenCalledWith('t1', {
        ...mockTransaction,
        category: 'dining',
        description: 'Grocery Shopping'
      });
      expect(mockDeleteTransaction).not.toHaveBeenCalled();
      expect(mockAddTransaction).not.toHaveBeenCalled();
    });

    it('creates split transactions when multiple splits', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Change first split
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '60' } });
      
      // Add second split
      fireEvent.click(screen.getByText('Add Split'));
      
      // Configure second split
      const categoryInputs = screen.getAllByPlaceholderText('Category') as HTMLInputElement[];
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      const descriptionInputs = screen.getAllByPlaceholderText('Description') as HTMLInputElement[];
      
      fireEvent.change(categoryInputs[1], { target: { value: 'household' } });
      fireEvent.change(amountInputs[1], { target: { value: '40' } });
      fireEvent.change(descriptionInputs[1], { target: { value: 'Cleaning' } });
      
      fireEvent.click(screen.getByText('Save Split'));
      
      // Should delete original
      expect(mockDeleteTransaction).toHaveBeenCalledWith('t1');
      
      // Should create two new transactions
      expect(mockAddTransaction).toHaveBeenCalledTimes(2);
      expect(mockAddTransaction).toHaveBeenCalledWith({
        date: mockTransaction.date,
        amount: 60,
        description: 'Grocery Shopping (Split 1/2)',
        type: 'expense',
        category: 'food',
        accountId: 'acc1',
        isSplit: true,
        notes: 'Split from transaction: t1'
      });
      expect(mockAddTransaction).toHaveBeenCalledWith({
        date: mockTransaction.date,
        amount: 40,
        description: 'Cleaning (Split 2/2)',
        type: 'expense',
        category: 'household',
        accountId: 'acc1',
        isSplit: true,
        notes: 'Split from transaction: t1'
      });
    });

    it('calls onClose after successful save', () => {
      const onClose = vi.fn();
      render(<SplitTransactionModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Save Split'));
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Button States', () => {
    it('disables save button when amounts do not match', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '50' } });
      
      const saveButton = screen.getByText('Save Split');
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveClass('cursor-not-allowed');
    });

    it('enables save button when amounts match', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      const saveButton = screen.getByText('Save Split');
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveClass('bg-primary');
    });
  });

  describe('User Actions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(<SplitTransactionModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button clicked', () => {
      const onClose = vi.fn();
      render(<SplitTransactionModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero amount transaction', () => {
      const zeroTransaction = { ...mockTransaction, amount: 0 };
      render(<SplitTransactionModal {...defaultProps} transaction={zeroTransaction} />);
      
      // There are two £0.00 values (original and remaining)
      const zeroAmounts = screen.getAllByText('£0.00');
      expect(zeroAmounts).toHaveLength(2);
    });

    it('handles negative amount transaction', () => {
      const negativeTransaction = { ...mockTransaction, amount: -100 };
      render(<SplitTransactionModal {...defaultProps} transaction={negativeTransaction} />);
      
      expect(screen.getByText('-£100.00')).toBeInTheDocument();
    });

    it('handles very small remaining amounts (floating point precision)', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Set amounts that might cause floating point issues
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '33.33' } });
      
      fireEvent.click(screen.getByText('Add Split'));
      fireEvent.click(screen.getByText('Add Split'));
      
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      fireEvent.change(amountInputs[1], { target: { value: '33.33' } });
      fireEvent.change(amountInputs[2], { target: { value: '33.34' } });
      
      // Should allow save (total is 99.99999... which rounds to 100)
      const saveButton = screen.getByText('Save Split');
      expect(saveButton).not.toBeDisabled();
    });

    it('handles many splits', () => {
      render(<SplitTransactionModal {...defaultProps} />);
      
      // Add 5 splits
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByText('Add Split'));
      }
      
      const categoryInputs = screen.getAllByPlaceholderText('Category');
      expect(categoryInputs).toHaveLength(5);
      
      // All should have delete buttons
      const deleteButtons = screen.getAllByTestId('delete-icon');
      expect(deleteButtons).toHaveLength(5);
    });
  });
});