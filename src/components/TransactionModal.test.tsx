import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Transaction, Account } from '../types';

// Mock the child components
vi.mock('./TagSelector', () => ({
  default: ({ selectedTags, onTagsChange, placeholder }: any) => (
    <div data-testid="tag-selector">
      <input
        type="text"
        placeholder={placeholder}
        onChange={(e) => onTagsChange([e.target.value])}
        value={selectedTags.join(', ')}
      />
    </div>
  ),
}));

vi.mock('./CategorySelector', () => ({
  default: ({ selectedCategory, onCategoryChange, transactionType, placeholder }: any) => (
    <select
      data-testid="category-selector"
      value={selectedCategory}
      onChange={(e) => onCategoryChange(e.target.value)}
      data-transaction-type={transactionType}
    >
      <option value="">{placeholder}</option>
      <option value="food">Food</option>
      <option value="transport">Transport</option>
      <option value="salary">Salary</option>
    </select>
  ),
}));

// Mock data
const mockAccounts: Account[] = [
  { id: 'acc1', name: 'Checking', type: 'checking', balance: 1000, createdAt: new Date(), currency: 'USD' },
  { id: 'acc2', name: 'Savings', type: 'savings', balance: 5000, createdAt: new Date(), currency: 'USD' },
];

const mockTransaction: Transaction = {
  id: 'trans1',
  date: new Date('2024-01-15'),
  description: 'Grocery Shopping',
  amount: 125.50,
  type: 'expense',
  category: 'food',
  accountId: 'acc1',
  notes: 'Weekly groceries',
  tags: ['groceries', 'essentials'],
  cleared: true,
  createdAt: new Date(),
};

// Mock useApp hook
vi.mock('../contexts/AppContext', () => ({
  useApp: vi.fn(() => ({
    accounts: mockAccounts,
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
  })),
}));

// Import after mocking
import { useApp } from '../contexts/AppContext';
import TransactionModal from './TransactionModal';

describe('TransactionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<TransactionModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add Transaction')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<TransactionModal {...defaultProps} />);
      expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();
    });

    it('renders with edit mode when transaction provided', () => {
      render(<TransactionModal {...defaultProps} transaction={mockTransaction} />);
      expect(screen.getByText('Edit Transaction')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<TransactionModal {...defaultProps} />);

      expect(screen.getByLabelText('Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Account')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes (Optional)')).toBeInTheDocument();
      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByLabelText('Transaction cleared/reconciled')).toBeInTheDocument();
    });
  });

  describe('Form initialization', () => {
    it('initializes with default values for new transaction', () => {
      render(<TransactionModal {...defaultProps} />);

      const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
      const typeSelect = screen.getByLabelText('Type') as HTMLSelectElement;
      const clearedCheckbox = screen.getByLabelText('Transaction cleared/reconciled') as HTMLInputElement;

      expect(dateInput.value).toBe(new Date().toISOString().split('T')[0]);
      expect(typeSelect.value).toBe('expense');
      expect(clearedCheckbox.checked).toBe(false);
    });

    it('initializes with transaction values when editing', () => {
      render(<TransactionModal {...defaultProps} transaction={mockTransaction} />);

      const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
      const descriptionInput = screen.getByLabelText('Description') as HTMLInputElement;
      const amountInput = screen.getByLabelText('Amount') as HTMLInputElement;
      const typeSelect = screen.getByLabelText('Type') as HTMLSelectElement;
      const accountSelect = screen.getByLabelText('Account') as HTMLSelectElement;
      const notesTextarea = screen.getByLabelText('Notes (Optional)') as HTMLTextAreaElement;
      const clearedCheckbox = screen.getByLabelText('Transaction cleared/reconciled') as HTMLInputElement;

      expect(dateInput.value).toBe('2024-01-15');
      expect(descriptionInput.value).toBe('Grocery Shopping');
      expect(amountInput.value).toBe('125.5');
      expect(typeSelect.value).toBe('expense');
      expect(accountSelect.value).toBe('acc1');
      expect(notesTextarea.value).toBe('Weekly groceries');
      expect(clearedCheckbox.checked).toBe(true);
    });
  });

  describe('Form interactions', () => {
    it('updates form fields correctly', () => {
      render(<TransactionModal {...defaultProps} />);

      const dateInput = screen.getByLabelText('Date');
      const descriptionInput = screen.getByLabelText('Description');
      const amountInput = screen.getByLabelText('Amount');
      const typeSelect = screen.getByLabelText('Type');

      fireEvent.change(dateInput, { target: { value: '2024-02-01' } });
      fireEvent.change(descriptionInput, { target: { value: 'Coffee' } });
      fireEvent.change(amountInput, { target: { value: '15.99' } });
      fireEvent.change(typeSelect, { target: { value: 'income' } });

      expect(dateInput).toHaveValue('2024-02-01');
      expect(descriptionInput).toHaveValue('Coffee');
      expect(amountInput).toHaveValue(15.99);
      expect(typeSelect).toHaveValue('income');
    });

    it('passes transaction type to category selector', () => {
      render(<TransactionModal {...defaultProps} />);

      const categorySelector = screen.getByTestId('category-selector');
      expect(categorySelector).toHaveAttribute('data-transaction-type', 'expense');

      const typeSelect = screen.getByLabelText('Type');
      fireEvent.change(typeSelect, { target: { value: 'income' } });

      expect(categorySelector).toHaveAttribute('data-transaction-type', 'income');
    });
  });

  describe('Form submission', () => {
    it('calls addTransaction for new transaction', async () => {
      const mockAddTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        addTransaction: mockAddTransaction,
        updateTransaction: vi.fn(),
      });

      render(<TransactionModal {...defaultProps} />);

      // Fill form
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2024-02-01' } });
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Test Transaction' } });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50.00' } });
      fireEvent.change(screen.getByTestId('category-selector'), { target: { value: 'food' } });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith({
          date: new Date('2024-02-01'),
          description: 'Test Transaction',
          amount: 50,
          type: 'expense',
          category: 'food',
          accountId: 'acc1',
          notes: '',
          tags: [],
          cleared: false,
        });
      });
    });

    it('calls updateTransaction for existing transaction', async () => {
      const mockUpdateTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        addTransaction: vi.fn(),
        updateTransaction: mockUpdateTransaction,
      });

      render(<TransactionModal {...defaultProps} transaction={mockTransaction} />);

      // Update description
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Updated Shopping' } });

      // Submit form
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockUpdateTransaction).toHaveBeenCalledWith('trans1', expect.objectContaining({
          description: 'Updated Shopping',
        }));
      });
    });

    it('closes modal after submission', async () => {
      const onClose = vi.fn();
      render(<TransactionModal {...defaultProps} onClose={onClose} />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Modal controls', () => {
    it('calls onClose when cancel button clicked', () => {
      const onClose = vi.fn();
      render(<TransactionModal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close icon clicked', () => {
      const onClose = vi.fn();
      render(<TransactionModal {...defaultProps} onClose={onClose} />);

      // Find the close button by its class (the X button)
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(button => 
        button.classList.contains('text-gray-500') && 
        button.classList.contains('hover:text-gray-700')
      );
      fireEvent.click(closeButton!);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Account handling', () => {
    it('renders all available accounts', () => {
      render(<TransactionModal {...defaultProps} />);

      expect(screen.getByText('Checking')).toBeInTheDocument();
      expect(screen.getByText('Savings')).toBeInTheDocument();
    });

    it('handles empty accounts array', () => {
      (useApp as any).mockReturnValue({
        accounts: [],
        addTransaction: vi.fn(),
        updateTransaction: vi.fn(),
      });

      render(<TransactionModal {...defaultProps} />);

      const accountSelect = screen.getByLabelText('Account') as HTMLSelectElement;
      expect(accountSelect.value).toBe('');
      expect(accountSelect.options.length).toBe(0);
    });
  });

  describe('Type options', () => {
    it('renders all transaction type options', () => {
      render(<TransactionModal {...defaultProps} />);

      const typeSelect = screen.getByLabelText('Type');
      expect(typeSelect).toContainHTML('<option value="expense">Expense</option>');
      expect(typeSelect).toContainHTML('<option value="income">Income</option>');
      expect(typeSelect).toContainHTML('<option value="transfer">Transfer</option>');
    });
  });
});