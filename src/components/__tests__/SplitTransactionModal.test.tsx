/**
 * SplitTransactionModal Tests
 * Tests for the SplitTransactionModal component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SplitTransactionModal from '../SplitTransactionModal';
import type { Transaction } from '../../types';

// Create mock functions outside the mock
const mockUpdateTransaction = vi.fn();
const mockAddTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();

// Mock dependencies
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    updateTransaction: mockUpdateTransaction,
    addTransaction: mockAddTransaction,
    deleteTransaction: mockDeleteTransaction
  })
}));

// Mock icons
vi.mock('../icons/XIcon', () => ({
  XIcon: () => <div data-testid="x-icon">X</div>
}));

vi.mock('../icons/PlusIcon', () => ({
  PlusIcon: () => <div data-testid="plus-icon">Plus</div>
}));

vi.mock('../icons/DeleteIcon', () => ({
  DeleteIcon: ({ className }: { className?: string }) => <div data-testid="delete-icon" className={className}>Delete</div>
}));

// Mock window.alert
global.alert = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('SplitTransactionModal', () => {
  const mockTransaction: Transaction = {
    id: 'trans-1',
    date: new Date('2024-01-15'),
    description: 'Grocery Shopping',
    amount: 100,
    category: 'Groceries',
    accountId: 'acc-1',
    type: 'expense',
    cleared: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders correctly when open', () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
      expect(screen.getByText(/Original Amount:/)).toBeInTheDocument();
      expect(screen.getByText('£100.00')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<SplitTransactionModal isOpen={false} onClose={vi.fn()} transaction={mockTransaction} />);
      
      expect(screen.queryByText('Split Transaction')).not.toBeInTheDocument();
    });

    it('does not render without transaction', () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={null as any} />);
      
      expect(screen.queryByText('Split Transaction')).not.toBeInTheDocument();
    });

    it('initializes with transaction data', () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      const categoryInput = screen.getByPlaceholderText('Category') as HTMLInputElement;
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      const descriptionInput = screen.getByPlaceholderText('Description') as HTMLInputElement;
      
      expect(categoryInput.value).toBe('Groceries');
      expect(amountInput.value).toBe('100');
      expect(descriptionInput.value).toBe('Grocery Shopping');
    });

    it('loads existing splits if available', () => {
      const transactionWithSplits = {
        ...mockTransaction,
        splits: [
          { category: 'Food', amount: 60, description: 'Food items' },
          { category: 'Household', amount: 40, description: 'Cleaning supplies' }
        ]
      };
      
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={transactionWithSplits} />);
      
      const categoryInputs = screen.getAllByPlaceholderText('Category') as HTMLInputElement[];
      expect(categoryInputs).toHaveLength(2);
      expect(categoryInputs[0].value).toBe('Food');
      expect(categoryInputs[1].value).toBe('Household');
    });
  });

  describe('split management', () => {
    it('adds a new split', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      const addButton = screen.getByText('Add Split');
      await userEvent.click(addButton);
      
      const categoryInputs = screen.getAllByPlaceholderText('Category');
      expect(categoryInputs).toHaveLength(2);
    });

    it('removes a split when multiple exist', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      // Add a split first
      await userEvent.click(screen.getByText('Add Split'));
      
      // Should have delete buttons now
      const deleteButtons = screen.getAllByTestId('delete-icon');
      expect(deleteButtons).toHaveLength(2);
      
      // Remove the first split
      await userEvent.click(deleteButtons[0].parentElement!);
      
      const categoryInputs = screen.getAllByPlaceholderText('Category');
      expect(categoryInputs).toHaveLength(1);
    });

    it('does not show delete button when only one split', () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      expect(screen.queryByTestId('delete-icon')).not.toBeInTheDocument();
    });

    it('updates split values', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      const categoryInput = screen.getByPlaceholderText('Category') as HTMLInputElement;
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      const descriptionInput = screen.getByPlaceholderText('Description') as HTMLInputElement;
      
      await userEvent.clear(categoryInput);
      await userEvent.type(categoryInput, 'Food');
      
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '50');
      
      await userEvent.clear(descriptionInput);
      await userEvent.type(descriptionInput, 'Food items');
      
      expect(categoryInput.value).toBe('Food');
      expect(amountInput.value).toBe('50');
      expect(descriptionInput.value).toBe('Food items');
    });
  });

  describe('amount calculation', () => {
    it('shows remaining amount', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      // Initially should show 0 remaining
      expect(screen.getByText('Remaining:')).toBeInTheDocument();
      expect(screen.getByText('£0.00')).toBeInTheDocument();
      
      // Change amount to 50
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '50');
      
      // Should show 50 remaining
      await waitFor(() => {
        expect(screen.getByText('£50.00')).toBeInTheDocument();
      });
    });

    it('shows negative remaining amount in red', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      // Add another split
      await userEvent.click(screen.getByText('Add Split'));
      
      // Set both splits to 60 (total 120, which is more than 100)
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      await userEvent.clear(amountInputs[0]);
      await userEvent.type(amountInputs[0], '60');
      await userEvent.clear(amountInputs[1]);
      await userEvent.type(amountInputs[1], '60');
      
      // Should show -20 remaining in red
      await waitFor(() => {
        const remainingParagraph = screen.getByText('Remaining:').closest('p');
        expect(remainingParagraph).toHaveClass('text-red-600');
      });
    });

    it('disables save button when amounts do not match', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      // Change amount to make it not match
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '50');
      
      const saveButton = screen.getByText('Save Split');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('save functionality', () => {
    it('updates transaction when single split', async () => {
      mockUpdateTransaction.mockClear();
      const onClose = vi.fn();
      render(<SplitTransactionModal isOpen={true} onClose={onClose} transaction={mockTransaction} />);
      
      // Change category
      const categoryInput = screen.getByPlaceholderText('Category');
      await userEvent.clear(categoryInput);
      await userEvent.type(categoryInput, 'Food');
      
      // Save
      await userEvent.click(screen.getByText('Save Split'));
      
      await waitFor(() => {
        expect(mockUpdateTransaction).toHaveBeenCalledWith('trans-1', expect.objectContaining({
          category: 'Food'
        }));
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('creates multiple transactions when multiple splits', async () => {
      mockDeleteTransaction.mockClear();
      mockAddTransaction.mockClear();
      
      const onClose = vi.fn();
      render(<SplitTransactionModal isOpen={true} onClose={onClose} transaction={mockTransaction} />);
      
      // Add a split
      await userEvent.click(screen.getByText('Add Split'));
      
      // Set up splits
      const categoryInputs = screen.getAllByPlaceholderText('Category');
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      
      await userEvent.clear(categoryInputs[0]);
      await userEvent.type(categoryInputs[0], 'Food');
      await userEvent.clear(amountInputs[0]);
      await userEvent.type(amountInputs[0], '60');
      
      await userEvent.clear(categoryInputs[1]);
      await userEvent.type(categoryInputs[1], 'Household');
      await userEvent.clear(amountInputs[1]);
      await userEvent.type(amountInputs[1], '40');
      
      // Save
      await userEvent.click(screen.getByText('Save Split'));
      
      await waitFor(() => {
        expect(mockDeleteTransaction).toHaveBeenCalledWith('trans-1');
        expect(mockAddTransaction).toHaveBeenCalledTimes(2);
        expect(mockAddTransaction).toHaveBeenCalledWith(expect.objectContaining({
          amount: 60,
          category: 'Food',
          description: expect.stringContaining('Split 1/2')
        }));
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('disables save button when amounts do not match', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      // Initially button should be enabled (amounts match)
      expect(screen.getByText('Save Split')).not.toBeDisabled();
      
      // Change amount to not match
      const amountInput = screen.getByPlaceholderText('Amount');
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '50');
      
      // Button should now be disabled
      await waitFor(() => {
        expect(screen.getByText('Save Split')).toBeDisabled();
      });
      
      // Button should have disabled styling
      const saveButton = screen.getByText('Save Split');
      expect(saveButton.closest('button')).toHaveClass('cursor-not-allowed');
    });
  });

  describe('user interactions', () => {
    it('handles close button', async () => {
      const onClose = vi.fn();
      render(<SplitTransactionModal isOpen={true} onClose={onClose} transaction={mockTransaction} />);
      
      await userEvent.click(screen.getByTestId('x-icon').parentElement!);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles cancel button', async () => {
      const onClose = vi.fn();
      render(<SplitTransactionModal isOpen={true} onClose={onClose} transaction={mockTransaction} />);
      
      await userEvent.click(screen.getByText('Cancel'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('initializes new split with remaining amount', async () => {
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={mockTransaction} />);
      
      // Change first split to 30
      const amountInput = screen.getByPlaceholderText('Amount') as HTMLInputElement;
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '30');
      
      // Add new split
      await userEvent.click(screen.getByText('Add Split'));
      
      // New split should have remaining amount (70)
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      expect(amountInputs[1].value).toBe('70');
    });
  });

  describe('edge cases', () => {
    it('handles zero transaction amount', () => {
      const zeroTransaction = { ...mockTransaction, amount: 0 };
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={zeroTransaction} />);
      
      // There should be two £0.00 elements - original amount and remaining
      const zeroAmounts = screen.getAllByText('£0.00');
      expect(zeroAmounts).toHaveLength(2);
    });

    it('handles very large amounts', () => {
      const largeTransaction = { ...mockTransaction, amount: 999999.99 };
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={largeTransaction} />);
      
      expect(screen.getByText('£999,999.99')).toBeInTheDocument();
    });

    it('handles decimal precision', async () => {
      const decimalTransaction = { ...mockTransaction, amount: 33.33 };
      render(<SplitTransactionModal isOpen={true} onClose={vi.fn()} transaction={decimalTransaction} />);
      
      // Add two more splits
      await userEvent.click(screen.getByText('Add Split'));
      await userEvent.click(screen.getByText('Add Split'));
      
      // Split into three equal parts
      const amountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
      await userEvent.clear(amountInputs[0]);
      await userEvent.type(amountInputs[0], '11.11');
      await userEvent.clear(amountInputs[1]);
      await userEvent.type(amountInputs[1], '11.11');
      await userEvent.clear(amountInputs[2]);
      await userEvent.type(amountInputs[2], '11.11');
      
      // Should handle rounding correctly
      expect(screen.getByText('Save Split')).toBeEnabled();
    });
  });
});
