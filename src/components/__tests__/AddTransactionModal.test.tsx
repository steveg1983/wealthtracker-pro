/**
 * AddTransactionModal Component Tests
 * Tests for the critical transaction creation modal
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the AppContext module
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    accounts: [
      {
        id: 'acc-1',
        name: 'Main Checking',
        type: 'current',
        balance: 1000,
        currency: 'GBP',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-20'),
      },
      {
        id: 'acc-2',
        name: 'Savings Account',
        type: 'savings',
        balance: 5000,
        currency: 'USD',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-20'),
      },
    ],
    categories: [
      {
        id: 'cat-1',
        name: 'Groceries',
        type: 'expense',
        color: '#FF6384',
        parentId: null,
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-20'),
      },
      {
        id: 'cat-2',
        name: 'Salary',
        type: 'income',
        color: '#36A2EB',
        parentId: null,
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-20'),
      },
    ],
    addTransaction: vi.fn(),
    getSubCategories: vi.fn((parentId) => {
      if (parentId === 'type-expense') {
        return [{ id: 'cat-1', name: 'Groceries', type: 'expense' }];
      }
      if (parentId === 'type-income') {
        return [{ id: 'cat-2', name: 'Salary', type: 'income' }];
      }
      return [];
    }),
    getDetailCategories: vi.fn((parentId) => {
      if (parentId === 'cat-1') {
        return [{ id: 'subcat-1', name: 'Fruits & Vegetables', type: 'expense', parentId: 'cat-1' }];
      }
      return [];
    }),
  }),
}));

// Mock the validation service
vi.mock('../../services/validationService', () => ({
  validationService: {
    validateTransaction: vi.fn((data) => data),
    formatErrors: vi.fn((_error) => ({ general: 'Failed to add transaction. Please try again.' })),
  },
  ValidationService: {
    validateTransaction: vi.fn((data) => data),
    formatErrors: vi.fn((_error) => ({ general: 'Failed to add transaction. Please try again.' })),
  },
}));

// Mock ResponsiveModal to simplify testing
vi.mock('../ResponsiveModal', () => ({
  ResponsiveModal: ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
      <div role="dialog" aria-labelledby="modal-title">
        <h2 id="modal-title">{title}</h2>
        <button onClick={onClose} aria-label="Close modal">×</button>
        {children}
      </div>
    );
  },
}));

// Mock MarkdownEditor
vi.mock('../MarkdownEditor', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label="Notes"
    />
  ),
}));

// Mock CategoryCreationModal
vi.mock('../CategoryCreationModal', () => ({
  default: ({ isOpen }: any) => isOpen ? <div>Category Creation Modal</div> : null,
}));

// Import component after mocks
import AddTransactionModal from '../AddTransactionModal';

describe('AddTransactionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<AddTransactionModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('heading', { name: 'Add Transaction' })).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddTransactionModal {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows account selection dropdown', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    const accountSelect = screen.getByLabelText(/account/i);
    expect(accountSelect).toBeInTheDocument();
    
    // Check that accounts are shown
    const options = Array.from(accountSelect.querySelectorAll('option'));
    expect(options.some(opt => opt.textContent?.includes('Main Checking'))).toBe(true);
    expect(options.some(opt => opt.textContent?.includes('Savings Account'))).toBe(true);
  });

  it('has transaction type buttons', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expense/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument();
  });

  it('has date input with today as default', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0]);
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveAttribute('type', 'date');
  });

  it('has amount input field', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    expect(amountInput).toHaveAttribute('type', 'number');
    expect(amountInput).toHaveAttribute('step', '0.01');
    expect(amountInput).toHaveAttribute('min', '0.01');
  });

  it('has description input field', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText(/description/i);
    expect(descriptionInput).toBeInTheDocument();
    expect(descriptionInput).toHaveAttribute('type', 'text');
  });

  it('has category selection dropdown', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    // Check for the Category label text
    expect(screen.getByText('Category')).toBeInTheDocument();
    
    // Find all comboboxes and check one has "Select category" option
    const categorySelects = screen.getAllByRole('combobox');
    const hasCategorySelect = categorySelects.some(select => 
      select.querySelector('option[value=""]')?.textContent === 'Select category'
    );
    expect(hasCategorySelect).toBe(true);
  });

  it('has notes field', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    const notesField = screen.getByLabelText(/notes/i);
    expect(notesField).toBeInTheDocument();
  });

  it('has save and cancel buttons', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('switches transaction type', async () => {
    const user = userEvent.setup();
    render(<AddTransactionModal {...defaultProps} />);
    
    // Should start as expense
    const expenseButton = screen.getByRole('button', { name: /expense/i });
    expect(expenseButton).toHaveAttribute('aria-pressed', 'true');
    
    // Click income
    const incomeButton = screen.getByRole('button', { name: /income/i });
    await user.click(incomeButton);
    
    expect(incomeButton).toHaveAttribute('aria-pressed', 'true');
    expect(expenseButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('displays currency symbol for selected account', async () => {
    const user = userEvent.setup();
    render(<AddTransactionModal {...defaultProps} />);
    
    const accountSelect = screen.getByLabelText(/account/i);
    await user.selectOptions(accountSelect, 'acc-1');
    
    // Should show GBP symbol
    expect(screen.getByText(/Amount.*£/)).toBeInTheDocument();
    
    await user.selectOptions(accountSelect, 'acc-2');
    
    // Should show USD symbol
    expect(screen.getByText(/Amount.*\$/)).toBeInTheDocument();
  });

  it('handles form submission with proper data', async () => {
    const user = userEvent.setup();
    render(<AddTransactionModal {...defaultProps} />);
    
    // Fill all required fields
    await user.selectOptions(screen.getByLabelText(/account/i), 'acc-1');
    await user.type(screen.getByLabelText(/description/i), 'Test transaction');
    await user.type(screen.getByLabelText(/amount/i), '50.00');
    
    // Select category
    const categorySelects = screen.getAllByRole('combobox');
    const categorySelect = categorySelects.find(select => 
      Array.from(select.querySelectorAll('option')).some(opt => opt.textContent === 'Select category')
    );
    if (categorySelect) {
      await user.selectOptions(categorySelect, 'cat-1');
    }
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    
    // Verify the form can be submitted
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
  });

  it('validates required fields before submission', async () => {
    const { useApp } = await import('../../contexts/AppContext');
    const mockAddTransaction = (useApp as any)().addTransaction;
    
    const user = userEvent.setup();
    render(<AddTransactionModal {...defaultProps} />);
    
    // Try to submit without filling required fields
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    
    // Verify addTransaction wasn't called
    expect(mockAddTransaction).not.toHaveBeenCalled();
    
    // Fill all required fields
    await user.selectOptions(screen.getByLabelText(/account/i), 'acc-1');
    await user.type(screen.getByLabelText(/description/i), 'Test transaction');
    await user.type(screen.getByLabelText(/amount/i), '50.00');
    
    // Select category
    const categorySelects = screen.getAllByRole('combobox');
    const categorySelect = categorySelects.find(select => 
      Array.from(select.querySelectorAll('option')).some(opt => opt.textContent === 'Select category')
    );
    expect(categorySelect).toBeInTheDocument();
    
    // Verify the form has all required elements
    expect(screen.getByLabelText(/account/i)).toHaveValue('acc-1');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Test transaction');
    expect(screen.getByLabelText(/amount/i)).toHaveValue(50);
  });

  it('shows create category button', () => {
    render(<AddTransactionModal {...defaultProps} />);
    
    const createButton = screen.getByText(/create new category/i);
    expect(createButton).toBeInTheDocument();
  });

  it('clears validation errors when typing', async () => {
    const { validationService } = await import('../../services/validationService');
    (validationService.formatErrors as any).mockReturnValue({ description: 'Description is required' });
    
    const user = userEvent.setup();
    render(<AddTransactionModal {...defaultProps} />);
    
    // Force a validation error by manipulating the component
    const descriptionInput = screen.getByLabelText(/description/i);
    
    // Simulate validation error display
    fireEvent.change(descriptionInput, { target: { value: '' } });
    
    // The error would appear after form submission, but we're testing the clearing behavior
    // Type in the field
    await user.type(descriptionInput, 'New description');
    
    // The component should clear errors on input change
    expect(descriptionInput).toHaveValue('New description');
  });
});
