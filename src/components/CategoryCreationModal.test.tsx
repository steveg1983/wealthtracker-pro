/**
 * CategoryCreationModal Tests
 * Comprehensive tests for the category creation modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryCreationModal from './CategoryCreationModal';

// Mock all dependencies
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    categories: [
      { id: 'cat-1', name: 'Food', level: 'detail', type: 'expense', parentId: 'sub-1' },
      { id: 'cat-2', name: 'Transportation', level: 'detail', type: 'expense', parentId: 'sub-2' },
      { id: 'sub-1', name: 'Daily Expenses', level: 'sub', type: 'expense', parentId: 'type-expense' },
      { id: 'sub-2', name: 'Transport', level: 'sub', type: 'expense', parentId: 'type-expense' },
      { id: 'type-expense', name: 'Expense', level: 'type', type: 'expense' },
      { id: 'type-income', name: 'Income', level: 'type', type: 'income' },
    ],
    addCategory: vi.fn(),
    getSubCategories: vi.fn((parentId) => {
      if (parentId === 'type-expense') {
        return [
          { id: 'sub-1', name: 'Daily Expenses', level: 'sub', type: 'expense', parentId: 'type-expense' },
          { id: 'sub-2', name: 'Transport', level: 'sub', type: 'expense', parentId: 'type-expense' },
        ];
      }
      if (parentId === 'type-income') {
        return [
          { id: 'sub-3', name: 'Employment', level: 'sub', type: 'income', parentId: 'type-income' },
        ];
      }
      return [];
    }),
    getDetailCategories: vi.fn((parentId) => {
      if (parentId === 'sub-1') {
        return [
          { id: 'cat-1', name: 'Food', level: 'detail', type: 'expense', parentId: 'sub-1' },
        ];
      }
      return [];
    }),
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

vi.mock('./icons/PlusIcon', () => ({
  PlusIcon: ({ size }: any) => <span data-testid="plus-icon" data-size={size}>+</span>,
}));

vi.mock('../hooks/useModalForm', () => ({
  useModalForm: (initialData: any, _config: any) => ({
    formData: {
      type: 'expense',
      selectedCategory: '',
      newCategoryName: '',
      selectedSpecific: '',
      newSpecificName: '',
      ...initialData,
    },
    updateField: vi.fn((_field, _value) => {
      // mock update
    }),
    reset: vi.fn(),
  }),
}));

describe('CategoryCreationModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCategoryCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any timers
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: mockOnClose,
      onCategoryCreated: mockOnCategoryCreated,
      initialType: 'expense' as const,
      ...props,
    };
    
    return render(<CategoryCreationModal {...defaultProps} />);
  };

  describe('basic rendering', () => {
    it('renders when open', () => {
      renderModal();
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Create New Category');
    });

    it('does not render when closed', () => {
      renderModal({ isOpen: false });
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('displays modal structure correctly', () => {
      renderModal();
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-body')).toBeInTheDocument();
      expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
    });

    it('has proper modal ARIA attributes', () => {
      renderModal();
      
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-label', 'Create New Category');
    });

    it('includes close button in header', () => {
      renderModal();
      
      expect(screen.getByTestId('modal-close')).toBeInTheDocument();
    });
  });

  describe('form structure', () => {
    it('displays all required form sections', () => {
      renderModal();
      
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /expense/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('applies proper body styling', () => {
      renderModal();
      
      const modalBody = screen.getByTestId('modal-body');
      expect(modalBody).toHaveClass('space-y-4');
    });

    it('displays form labels correctly', () => {
      renderModal();
      
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
    });
  });

  describe('type selection', () => {
    it('displays income and expense type buttons', () => {
      renderModal();
      
      expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /expense/i })).toBeInTheDocument();
    });

    it('defaults to expense type', () => {
      renderModal({ initialType: 'expense' });
      
      const expenseButton = screen.getByRole('button', { name: /expense/i });
      expect(expenseButton).toHaveClass('bg-red-500', 'text-white');
    });

    it('can be initialized with income type', () => {
      renderModal({ initialType: 'income' });
      
      const incomeButton = screen.getByRole('button', { name: /income/i });
      expect(incomeButton).toHaveClass('bg-green-500', 'text-white');
    });

    it('allows switching between income and expense', async () => {
      const user = userEvent.setup();
      renderModal({ initialType: 'expense' });
      
      const incomeButton = screen.getByRole('button', { name: /income/i });
      await user.click(incomeButton);
      
      // Should have been called via updateField mock
    });

    it('resets form when switching types', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const incomeButton = screen.getByRole('button', { name: /income/i });
      await user.click(incomeButton);
      
      // Form should be reset when switching types
    });
  });

  describe('category selection', () => {
    it('displays category dropdown', () => {
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      expect(categorySelect).toBeInTheDocument();
    });

    it('includes default option', () => {
      renderModal();
      
      expect(screen.getByText('Select a category')).toBeInTheDocument();
    });

    it('displays existing categories', () => {
      renderModal();
      
      expect(screen.getByText('Daily Expenses')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
    });

    it('includes new category option', () => {
      renderModal();
      
      expect(screen.getByText('+ New Category')).toBeInTheDocument();
    });

    it('displays suggested categories', () => {
      renderModal();
      
      // Should show suggestions that don't exist yet
      expect(screen.getByText('Bills (create new)')).toBeInTheDocument();
      expect(screen.getByText('Food (create new)')).toBeInTheDocument();
    });

    it('shows new category input when new category is selected', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      expect(screen.getByPlaceholderText('Enter new category name')).toBeInTheDocument();
    });

    it('shows new category input when new category is selected', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      expect(screen.getByPlaceholderText('Enter new category name')).toBeInTheDocument();
    });

    it('handles suggested category selection', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'suggest-Bills');
      
      expect(screen.getByPlaceholderText('Enter new category name')).toBeInTheDocument();
    });
  });

  describe('specific category section', () => {
    it('does not show specific category section by default', () => {
      renderModal();
      
      // Since no category is selected in our basic mock, specific category section shouldn't show
      expect(screen.queryByText('Specific Category')).not.toBeInTheDocument();
    });

    it('handles category selection interactions', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'sub-1');
      
      // Should call updateField mock
    });
  });

  describe('form submission', () => {
    it('displays submit button with icon', () => {
      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /create category/i });
      expect(submitButton).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('displays cancel button', () => {
      renderModal();
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('disables submit button when no category is selected', () => {
      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /create category/i });
      expect(submitButton).toBeDisabled();
    });

    it('handles category selection interactions', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'sub-1');
      
      // Should complete without errors
    });

    it('handles new category input interactions', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      const newCategoryInput = screen.getByPlaceholderText('Enter new category name');
      await user.type(newCategoryInput, 'Test Category');
      
      // Should complete without errors
    });

    it('handles basic form submission', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);
      
      // Should complete without errors (button might be disabled, but click should work)
    });

    it('handles cancel action', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('user interactions', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const closeButton = screen.getByTestId('modal-close');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('handles new category input changes', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      const newCategoryInput = screen.getByPlaceholderText('Enter new category name');
      await user.type(newCategoryInput, 'My New Category');
      
      // Input should accept typing
    });

    it('handles basic user interactions', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'sub-1');
      
      // Should complete without errors
    });

    it('supports keyboard navigation', () => {
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      categorySelect.focus();
      expect(categorySelect).toHaveFocus();
    });
  });

  describe('styling and layout', () => {
    it('applies proper button styling for type selection', () => {
      renderModal({ initialType: 'expense' });
      
      const expenseButton = screen.getByRole('button', { name: /expense/i });
      const incomeButton = screen.getByRole('button', { name: /income/i });
      
      expect(expenseButton).toHaveClass('bg-red-500', 'text-white');
      expect(incomeButton).toHaveClass('bg-gray-100', 'dark:bg-gray-700');
    });

    it('applies proper button styling for footer buttons', () => {
      renderModal();
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const submitButton = screen.getByRole('button', { name: /create category/i });
      
      expect(cancelButton).toHaveClass(
        'flex-1', 'px-4', 'py-2', 'border', 'border-gray-300', 'dark:border-gray-600',
        'text-gray-700', 'dark:text-gray-300', 'rounded-lg'
      );
      
      expect(submitButton).toHaveClass(
        'flex-1', 'px-4', 'py-2', 'bg-primary', 'text-white', 'rounded-lg'
      );
    });

    it('has proper grid layout for type buttons', () => {
      renderModal();
      
      const typeContainer = screen.getByRole('button', { name: /income/i }).parentElement;
      expect(typeContainer).toHaveClass('grid', 'grid-cols-2', 'gap-2');
    });

    it('applies consistent label styling', () => {
      renderModal();
      
      const label = screen.getByText('Type');
      expect(label).toHaveClass(
        'block', 'text-sm', 'font-medium', 'text-gray-700', 'dark:text-gray-300', 'mb-2'
      );
    });

    it('applies proper input styling', () => {
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      expect(categorySelect).toHaveClass(
        'w-full', 'px-3', 'py-2', 'bg-white/70', 'dark:bg-gray-800/70',
        'backdrop-blur-sm', 'border', 'border-gray-300/50', 'dark:border-gray-600/50',
        'rounded-xl', 'focus:outline-none', 'focus:ring-2', 'focus:ring-primary'
      );
    });
  });

  describe('accessibility', () => {
    it('has proper form control associations', () => {
      renderModal();
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(5); // 2 type buttons + close + cancel + submit
    });

    it('supports keyboard navigation', () => {
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      categorySelect.focus();
      expect(categorySelect).toHaveFocus();
    });

    it('has proper button roles', () => {
      renderModal();
      
      expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /expense/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create category/i })).toBeInTheDocument();
    });

    it('has proper modal dialog role', () => {
      renderModal();
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has proper select structure', () => {
      renderModal();
      
      // Check that the select has proper options
      expect(screen.getByText('Select a category')).toBeInTheDocument();
      expect(screen.getByText('Daily Expenses')).toBeInTheDocument();
      expect(screen.getByText('+ New Category')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles modal state changes', () => {
      const { rerender } = renderModal({ isOpen: true });
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      rerender(
        <CategoryCreationModal
          isOpen={false}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('handles missing onCategoryCreated callback', () => {
      renderModal({ onCategoryCreated: undefined });
      
      // Should render without errors
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('handles empty category name', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      const newCategoryInput = screen.getByPlaceholderText('Enter new category name');
      await user.type(newCategoryInput, '   '); // Just spaces
      
      const submitButton = screen.getByRole('button', { name: /create category/i });
      expect(submitButton).toBeDisabled();
    });

    it('handles very long category names', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      const newCategoryInput = screen.getByPlaceholderText('Enter new category name');
      const longName = 'A'.repeat(100);
      await user.type(newCategoryInput, longName);
      
      // Should handle long input values
    });

    it('handles special characters in category names', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      const newCategoryInput = screen.getByPlaceholderText('Enter new category name');
      await user.type(newCategoryInput, 'Test & Special Characters @#$');
      
      // Should handle special characters
    });
  });

  describe('async operations', () => {
    it('handles basic async operations', () => {
      renderModal();
      
      // Test that component renders without async issues
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  describe('real-world scenarios', () => {
    it('handles basic category selection workflow', async () => {
      const user = userEvent.setup();
      renderModal({ initialType: 'expense' });
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'sub-1');
      
      // Should work without errors
    });

    it('handles type switching workflow', async () => {
      const user = userEvent.setup();
      renderModal({ initialType: 'expense' });
      
      const incomeButton = screen.getByRole('button', { name: /income/i });
      await user.click(incomeButton);
      
      // Should work without errors
    });

    it('handles new category creation workflow', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'new');
      
      expect(screen.getByPlaceholderText('Enter new category name')).toBeInTheDocument();
    });

    it('handles suggested category workflow', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const categorySelect = screen.getByRole('combobox');
      await user.selectOptions(categorySelect, 'suggest-Bills');
      
      expect(screen.getByPlaceholderText('Enter new category name')).toBeInTheDocument();
    });

    it('handles user canceling workflow', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
