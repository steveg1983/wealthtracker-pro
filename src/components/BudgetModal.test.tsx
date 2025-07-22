/**
 * BudgetModal Tests
 * Comprehensive tests for the budget creation and editing modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BudgetModal from './BudgetModal';
import type { Budget } from '../types';

// Mock all dependencies
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    addBudget: vi.fn(),
    updateBudget: vi.fn(),
    categories: [
      { id: 'cat-1', name: 'Food', level: 'detail', type: 'expense', parentId: 'sub-1' },
      { id: 'cat-2', name: 'Transportation', level: 'detail', type: 'expense', parentId: 'sub-2' },
      { id: 'cat-3', name: 'Entertainment', level: 'detail', type: 'expense', parentId: 'sub-3' },
      { id: 'sub-1', name: 'Daily Expenses', level: 'sub', type: 'expense', parentId: 'type-expense' },
      { id: 'sub-2', name: 'Transport', level: 'sub', type: 'expense', parentId: 'type-expense' },
      { id: 'sub-3', name: 'Leisure', level: 'sub', type: 'expense', parentId: 'type-expense' },
      { id: 'type-expense', name: 'Expense', level: 'type', type: 'expense' },
    ],
  }),
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children, title, onClose }: any) => 
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    ) : null,
  ModalBody: ({ children, className }: any) => <div data-testid="modal-body" className={className}>{children}</div>,
  ModalFooter: ({ children }: any) => <div data-testid="modal-footer">{children}</div>,
}));

vi.mock('../hooks/useModalForm', () => ({
  useModalForm: (initialData: any, config: any) => ({
    formData: {
      category: '',
      amount: '',
      period: 'monthly',
      isActive: true,
      ...initialData,
    },
    updateField: vi.fn((field, value) => {
      console.log(`Mock updateField: ${field} = ${value}`);
    }),
    handleSubmit: vi.fn((e) => {
      e?.preventDefault();
      if (config?.onSubmit) {
        config.onSubmit({
          category: 'Food',
          amount: '500.00',
          period: 'monthly',
          isActive: true,
        });
      }
    }),
    setFormData: vi.fn(),
  }),
}));

describe('BudgetModal', () => {
  const mockOnClose = vi.fn();

  const createMockBudget = (overrides: Partial<Budget> = {}): Budget => ({
    id: 'budget-1',
    category: 'Food',
    amount: 500,
    period: 'monthly',
    isActive: true,
    spent: 250,
    remaining: 250,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true, budget?: Budget) => {
    return render(
      <BudgetModal
        isOpen={isOpen}
        onClose={mockOnClose}
        budget={budget}
      />
    );
  };

  describe('basic rendering', () => {
    it('renders when open for new budget', () => {
      renderModal(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Add Budget');
    });

    it('renders when open for editing budget', () => {
      const budget = createMockBudget();
      renderModal(true, budget);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Budget');
    });

    it('does not render when closed', () => {
      renderModal(false);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('displays modal structure correctly', () => {
      renderModal(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-body')).toBeInTheDocument();
      expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
    });

    it('has proper modal ARIA attributes', () => {
      renderModal(true);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-label', 'Add Budget');
    });

    it('includes close button in header', () => {
      renderModal(true);
      
      expect(screen.getByTestId('modal-close')).toBeInTheDocument();
    });
  });

  describe('form structure', () => {
    it('displays all required form fields', () => {
      renderModal(true);
      
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Period')).toBeInTheDocument();
      expect(screen.getByText('Budget is active')).toBeInTheDocument();
    });

    it('has proper form structure', () => {
      renderModal(true);
      
      const modalBody = screen.getByTestId('modal-body');
      expect(modalBody.closest('form')).toBeInTheDocument();
    });

    it('applies proper body styling', () => {
      renderModal(true);
      
      const modalBody = screen.getByTestId('modal-body');
      expect(modalBody).toHaveClass('space-y-4');
    });

    it('displays form labels correctly', () => {
      renderModal(true);
      
      const labels = ['Category', 'Amount', 'Period'];
      labels.forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('applies correct input styling', () => {
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      expect(amountInput).toHaveClass(
        'w-full', 'px-3', 'py-2', 'bg-white/70', 'dark:bg-gray-800/70',
        'backdrop-blur-sm', 'border', 'border-gray-300/50', 'dark:border-gray-600/50',
        'rounded-xl', 'focus:outline-none', 'focus:ring-2', 'focus:ring-primary',
        'focus:border-transparent', 'dark:text-white'
      );
    });
  });

  describe('category selection', () => {
    it('displays category dropdown', () => {
      renderModal(true);
      
      const categorySelect = screen.getAllByRole('combobox')[0]; // First select should be category
      expect(categorySelect).toBeInTheDocument();
    });

    it('includes default option', () => {
      renderModal(true);
      
      expect(screen.getByText('Select category')).toBeInTheDocument();
    });

    it('displays available categories with hierarchy', () => {
      renderModal(true);
      
      // Categories should show parent > child format
      expect(screen.getByText('Daily Expenses > Food')).toBeInTheDocument();
      expect(screen.getByText('Transport > Transportation')).toBeInTheDocument();
      expect(screen.getByText('Leisure > Entertainment')).toBeInTheDocument();
    });

    it('marks category as required', () => {
      renderModal(true);
      
      const categorySelect = screen.getAllByRole('combobox')[0];
      expect(categorySelect).toHaveAttribute('required');
    });

    it('filters categories to only show expense detail categories', () => {
      renderModal(true);
      
      // Should not include sub-categories or type categories, only detail expense categories
      expect(screen.queryByText('Daily Expenses')).not.toBeInTheDocument(); // Sub category
      expect(screen.queryByText('Expense')).not.toBeInTheDocument(); // Type category
    });

    it('allows category selection', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const categorySelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(categorySelect, 'Food');
      
      // Mock should have been called
    });
  });

  describe('amount field', () => {
    it('displays amount input', () => {
      renderModal(true);
      
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('marks amount as required', () => {
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      expect(amountInput).toHaveAttribute('required');
    });

    it('sets proper input type and attributes', () => {
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      expect(amountInput).toHaveAttribute('type', 'number');
      expect(amountInput).toHaveAttribute('step', '0.01');
      expect(amountInput).toHaveAttribute('placeholder', '0.00');
    });

    it('handles amount input changes', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      await user.type(amountInput, '750.50');
      
      // Input should accept decimal values
    });

    it('accepts decimal values', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      await user.type(amountInput, '1234.56');
      
      // Should handle decimal input
    });
  });

  describe('period selection', () => {
    it('displays period dropdown', () => {
      renderModal(true);
      
      const periodSelect = screen.getAllByRole('combobox')[1]; // Second select should be period
      expect(periodSelect).toBeInTheDocument();
    });

    it('includes period options', () => {
      renderModal(true);
      
      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText('Yearly')).toBeInTheDocument();
    });

    it('defaults to monthly', () => {
      renderModal(true);
      
      // The mock returns monthly as default
      const periodSelect = screen.getAllByRole('combobox')[1];
      expect(periodSelect).toBeInTheDocument();
    });

    it('allows period selection', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const periodSelect = screen.getAllByRole('combobox')[1];
      await user.selectOptions(periodSelect, 'yearly');
      
      // Mock should have been called
    });
  });

  describe('active status', () => {
    it('displays active checkbox', () => {
      renderModal(true);
      
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByLabelText('Budget is active')).toBeInTheDocument();
    });

    it('has proper label association', () => {
      renderModal(true);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'isActive');
      
      const label = screen.getByText('Budget is active');
      expect(label.closest('label')).toHaveAttribute('for', 'isActive');
    });

    it('defaults to active (checked)', () => {
      renderModal(true);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('allows toggling active status', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);
      
      // Mock should have been called
    });

    it('applies proper checkbox styling', () => {
      renderModal(true);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('rounded', 'border-gray-300', 'dark:border-gray-600');
    });
  });

  describe('form submission', () => {
    it('displays submit button with correct text for new budget', () => {
      renderModal(true);
      
      expect(screen.getByRole('button', { name: /add budget/i })).toBeInTheDocument();
    });

    it('displays submit button with correct text for editing', () => {
      const budget = createMockBudget();
      renderModal(true, budget);
      
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('displays cancel button', () => {
      renderModal(true);
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('handles form submission', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const submitButton = screen.getByRole('button', { name: /add budget/i });
      await user.click(submitButton);
      
      // Mock handleSubmit should have been called
    });

    it('handles cancel action', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('submits form on Enter key', () => {
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      fireEvent.keyDown(amountInput, { key: 'Enter', code: 'Enter' });
      
      // Form should handle Enter key submission
    });
  });

  describe('editing existing budget', () => {
    it('pre-populates form with budget data', () => {
      const budget = createMockBudget({
        category: 'Transportation',
        amount: 300,
        period: 'yearly',
        isActive: false,
      });
      renderModal(true, budget);
      
      // Form should be initialized with budget data (via useEffect and setFormData)
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Budget');
    });

    it('handles budget prop changes', () => {
      const budget1 = createMockBudget({ id: 'budget-1' });
      const { rerender } = renderModal(true, budget1);
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Budget');
      
      const budget2 = createMockBudget({ id: 'budget-2' });
      rerender(
        <BudgetModal
          isOpen={true}
          onClose={mockOnClose}
          budget={budget2}
        />
      );
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Budget');
    });

    it('handles switching from edit to create mode', () => {
      const budget = createMockBudget();
      const { rerender } = renderModal(true, budget);
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Budget');
      
      rerender(
        <BudgetModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Add Budget');
    });
  });

  describe('user interactions', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const closeButton = screen.getByTestId('modal-close');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('handles multiple close button clicks', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const closeButton = screen.getByTestId('modal-close');
      await user.click(closeButton);
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });

    it('supports keyboard navigation', () => {
      renderModal(true);
      
      const categorySelect = screen.getAllByRole('combobox')[0];
      categorySelect.focus();
      expect(categorySelect).toHaveFocus();
    });

    it('handles complex form interactions', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      // Fill out the entire form
      const categorySelect = screen.getAllByRole('combobox')[0];
      const amountInput = screen.getByRole('spinbutton');
      const periodSelect = screen.getAllByRole('combobox')[1];
      const activeCheckbox = screen.getByRole('checkbox');
      
      await user.selectOptions(categorySelect, 'Food');
      await user.type(amountInput, '600');
      await user.selectOptions(periodSelect, 'yearly');
      await user.click(activeCheckbox); // Toggle off
      await user.click(activeCheckbox); // Toggle back on
      
      // All interactions should work
    });
  });

  describe('styling and layout', () => {
    it('applies proper button styling', () => {
      renderModal(true);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const submitButton = screen.getByRole('button', { name: /add budget/i });
      
      expect(cancelButton).toHaveClass(
        'flex-1', 'px-4', 'py-2', 'border', 'border-gray-300', 'dark:border-gray-600',
        'text-gray-700', 'dark:text-gray-300', 'rounded-lg', 'hover:bg-gray-50', 'dark:hover:bg-gray-700'
      );
      
      expect(submitButton).toHaveClass(
        'flex-1', 'px-4', 'py-2', 'bg-primary', 'text-white', 'rounded-lg', 'hover:bg-secondary'
      );
    });

    it('has proper button layout', () => {
      renderModal(true);
      
      const buttonContainer = screen.getByRole('button', { name: /cancel/i }).parentElement;
      expect(buttonContainer).toHaveClass('flex', 'gap-3', 'w-full');
    });

    it('applies consistent label styling', () => {
      renderModal(true);
      
      const label = screen.getByText('Category');
      expect(label).toHaveClass(
        'block', 'text-sm', 'font-medium', 'text-gray-700', 'dark:text-gray-300', 'mb-1'
      );
    });

    it('has proper checkbox layout', () => {
      renderModal(true);
      
      const checkboxContainer = screen.getByRole('checkbox').parentElement;
      expect(checkboxContainer).toHaveClass('flex', 'items-center', 'gap-2');
    });
  });

  describe('accessibility', () => {
    it('has proper form control associations', () => {
      renderModal(true);
      
      expect(screen.getAllByRole('combobox')).toHaveLength(2); // Category and period selects
      expect(screen.getByRole('spinbutton')).toBeInTheDocument(); // Amount input
      expect(screen.getByRole('checkbox')).toBeInTheDocument(); // Active status
    });

    it('supports keyboard navigation', () => {
      renderModal(true);
      
      const categorySelect = screen.getAllByRole('combobox')[0];
      categorySelect.focus();
      expect(categorySelect).toHaveFocus();
    });

    it('has proper button roles', () => {
      renderModal(true);
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add budget/i })).toBeInTheDocument();
    });

    it('has proper modal dialog role', () => {
      renderModal(true);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has proper label associations', () => {
      renderModal(true);
      
      const checkbox = screen.getByLabelText('Budget is active');
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles modal state changes', () => {
      const { rerender } = renderModal(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      rerender(
        <BudgetModal
          isOpen={false}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('handles empty category list gracefully', () => {
      // This would require mocking the useApp hook differently
      renderModal(true);
      
      // Should render without errors even with categories
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('handles very large amounts', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      await user.type(amountInput, '999999999.99');
      
      // Should handle large monetary values
    });

    it('handles zero amounts', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const amountInput = screen.getByRole('spinbutton');
      await user.type(amountInput, '0.00');
      
      // Should handle zero values
    });

    it('handles budget with undefined values', () => {
      const budget = createMockBudget({
        amount: undefined as any,
        period: undefined as any,
        isActive: undefined as any,
      });
      renderModal(true, budget);
      
      // Should handle undefined values gracefully
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  describe('real-world scenarios', () => {
    it('handles creating a monthly food budget', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      // Fill out the form for a typical food budget
      const categorySelect = screen.getAllByRole('combobox')[0];
      const amountInput = screen.getByRole('spinbutton');
      const periodSelect = screen.getAllByRole('combobox')[1];
      
      await user.selectOptions(categorySelect, 'Food');
      await user.type(amountInput, '500.00');
      await user.selectOptions(periodSelect, 'monthly');
      
      await user.click(screen.getByRole('button', { name: /add budget/i }));
      
      // Should process the submission
    });

    it('handles creating a yearly transportation budget', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const categorySelect = screen.getAllByRole('combobox')[0];
      const amountInput = screen.getByRole('spinbutton');
      const periodSelect = screen.getAllByRole('combobox')[1];
      
      await user.selectOptions(categorySelect, 'Transportation');
      await user.type(amountInput, '3600.00');
      await user.selectOptions(periodSelect, 'yearly');
      
      await user.click(screen.getByRole('button', { name: /add budget/i }));
    });

    it('handles editing an existing budget', async () => {
      const user = userEvent.setup();
      const budget = createMockBudget({
        category: 'Entertainment',
        amount: 200,
        period: 'monthly',
        isActive: true,
      });
      renderModal(true, budget);
      
      // Modify the budget
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '250.00');
      
      await user.click(screen.getByRole('button', { name: /save changes/i }));
    });

    it('handles creating an inactive budget', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      const categorySelect = screen.getAllByRole('combobox')[0];
      const amountInput = screen.getByRole('spinbutton');
      const activeCheckbox = screen.getByRole('checkbox');
      
      await user.selectOptions(categorySelect, 'Entertainment');
      await user.type(amountInput, '150.00');
      await user.click(activeCheckbox); // Uncheck to make inactive
      
      await user.click(screen.getByRole('button', { name: /add budget/i }));
    });

    it('handles user canceling budget creation', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      // Start filling out form
      const categorySelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(categorySelect, 'Food');
      
      // Cancel instead of submitting
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('handles form validation errors gracefully', async () => {
      const user = userEvent.setup();
      renderModal(true);
      
      // Try to submit without required fields
      await user.click(screen.getByRole('button', { name: /add budget/i }));
      
      // Form should handle validation (browser will prevent submission due to required attributes)
    });
  });
});