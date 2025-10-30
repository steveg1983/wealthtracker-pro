import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Category } from '../types';

// Mock child components
vi.mock('./CategoryCreationModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? (
      <div data-testid="category-creation-modal">
        <button onClick={onClose}>Close Category Modal</button>
      </div>
    ) : null
}));

// Mock icons
vi.mock('./icons', () => ({
  XIcon: (_props: { size?: number }) => <div data-testid="x-icon">X</div>,
  CalendarIcon: (_props: { size?: number }) => <div data-testid="calendar-icon">Cal</div>,
  TagIcon: (_props: { size?: number }) => <div data-testid="tag-icon">Tag</div>,
}));

// Mock utility functions
vi.mock('../utils/currency', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}`,
}));

// Mock data
const mockAccounts: Account[] = [
  { id: 'acc1', name: 'Checking', type: 'checking', balance: 1000, createdAt: new Date(), currency: 'USD' },
  { id: 'acc2', name: 'Savings', type: 'savings', balance: 5000, createdAt: new Date(), currency: 'USD' },
];

const mockCategories: Category[] = [
  { id: 'cat-blank', name: 'Blank', type: 'expense', level: 'detail', isDefault: true },
  { id: 'sub-other-expense', name: 'Other Expense', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'sub-other-income', name: 'Other Income', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'cat-misc', name: 'Miscellaneous', type: 'expense', level: 'detail', parentId: 'sub-other-expense' },
];

// Mock useApp hook
vi.mock('../contexts/AppContext', () => ({
  useApp: vi.fn(() => ({
    accounts: mockAccounts,
    categories: mockCategories,
    addTransaction: vi.fn(),
    getSubCategories: (typeId: string) => {
      const type = typeId.replace('type-', '');
      return mockCategories.filter(cat => cat.level === 'sub' && cat.type === type);
    },
    getDetailCategories: (subId: string) => {
      return mockCategories.filter(cat => cat.level === 'detail' && cat.parentId === subId);
    },
  })),
}));

// Import after mocking
import { useApp } from '../contexts/AppContextSupabase';
import BalanceAdjustmentModal from './BalanceAdjustmentModal';

describe('BalanceAdjustmentModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    accountId: 'acc1',
    currentBalance: 1000,
    newBalance: '1500',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to default values
    (useApp as any).mockReturnValue({
      accounts: mockAccounts,
      categories: mockCategories,
      addTransaction: vi.fn(),
      getSubCategories: (typeId: string) => {
        const type = typeId.replace('type-', '');
        return mockCategories.filter(cat => cat.level === 'sub' && cat.type === type);
      },
      getDetailCategories: (subId: string) => {
        return mockCategories.filter(cat => cat.level === 'detail' && cat.parentId === subId);
      },
    });
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<BalanceAdjustmentModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Balance Adjustment Required')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      expect(screen.getByText('Balance Adjustment Required')).toBeInTheDocument();
    });

    it('displays balance information correctly', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      expect(screen.getByText('Current Balance')).toBeInTheDocument();
      expect(screen.getByText('USD 1000.00')).toBeInTheDocument();
      expect(screen.getByText('New Balance')).toBeInTheDocument();
      expect(screen.getByText('USD 1500.00')).toBeInTheDocument();
      expect(screen.getByText('Adjustment Amount')).toBeInTheDocument();
      expect(screen.getByText('+USD 500.00')).toBeInTheDocument();
    });

    it('shows positive adjustment with green color', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      const adjustmentAmount = screen.getByText('+USD 500.00');
      expect(adjustmentAmount).toHaveClass('text-green-600');
    });

    it('shows negative adjustment with red color', () => {
      render(<BalanceAdjustmentModal {...defaultProps} newBalance="500" />);
      
      const adjustmentAmount = screen.getByText('-USD 500.00');
      expect(adjustmentAmount).toHaveClass('text-red-600');
    });

    it('renders all form fields', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });
  });

  describe('Form initialization', () => {
    it('initializes with default values', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/description/i) as HTMLInputElement;
      const categorySelect = document.getElementById('adjustment-category') as HTMLSelectElement;
      const subCategorySelect = document.getElementById('adjustment-subcategory') as HTMLSelectElement;
      
      expect(dateInput.value).toBe(new Date().toISOString().split('T')[0]);
      expect(descriptionInput.value).toBe('Balance Adjustment');
      // For positive adjustment (income), sub-other-expense isn't available, so select is empty
      expect(categorySelect.value).toBe('');
      // Default detail category is 'cat-blank' 
      expect(subCategorySelect.value).toBe('cat-blank');
    });

    it('shows income categories for positive adjustments', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      expect(screen.getByText('Other Income')).toBeInTheDocument();
    });

    it('shows expense categories for negative adjustments', () => {
      render(<BalanceAdjustmentModal {...defaultProps} newBalance="500" />);
      
      expect(screen.getByText('Other Expense')).toBeInTheDocument();
    });
  });

  describe('Form interactions', () => {
    it('updates date field', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      const dateInput = screen.getByLabelText(/date/i);
      fireEvent.change(dateInput, { target: { value: '2024-02-01' } });
      
      expect(dateInput).toHaveValue('2024-02-01');
    });

    it('updates description field', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      const descriptionInput = screen.getByLabelText(/description/i);
      fireEvent.change(descriptionInput, { target: { value: 'Account reconciliation' } });
      
      expect(descriptionInput).toHaveValue('Account reconciliation');
    });

    it('updates notes field', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      const notesTextarea = screen.getByLabelText(/notes/i);
      fireEvent.change(notesTextarea, { target: { value: 'Monthly adjustment' } });
      
      expect(notesTextarea).toHaveValue('Monthly adjustment');
    });

    it('shows create new category button', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      expect(screen.getByText('Create new')).toBeInTheDocument();
    });

    it('opens category creation modal when create new clicked', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Create new'));
      
      expect(screen.getByTestId('category-creation-modal')).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('creates adjustment transaction for positive difference', async () => {
      const mockAddTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => mockCategories.filter(cat => cat.level === 'sub' && cat.type === 'income'),
        getDetailCategories: () => mockCategories.filter(cat => cat.level === 'detail'),
      });

      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Create Adjustment'));
      
      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith({
          date: expect.any(Date),
          description: 'Balance Adjustment',
          amount: 500,
          type: 'income',
          category: 'cat-blank',
          accountId: 'acc1',
          notes: 'Manual balance adjustment from USD 1000.00 to USD 1500.00',
          cleared: true,
          tags: ['balance-adjustment'],
        });
      });
    });

    it('creates adjustment transaction for negative difference', async () => {
      const mockAddTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => mockCategories.filter(cat => cat.level === 'sub' && cat.type === 'expense'),
        getDetailCategories: () => mockCategories.filter(cat => cat.level === 'detail'),
      });

      render(<BalanceAdjustmentModal {...defaultProps} newBalance="500" />);
      
      fireEvent.click(screen.getByText('Create Adjustment'));
      
      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith({
          date: expect.any(Date),
          description: 'Balance Adjustment',
          amount: 500,
          type: 'expense',
          category: 'cat-blank',
          accountId: 'acc1',
          notes: 'Manual balance adjustment from USD 1000.00 to USD 500.00',
          cleared: true,
          tags: ['balance-adjustment'],
        });
      });
    });

    it('closes modal after submission', async () => {
      const onClose = vi.fn();
      render(<BalanceAdjustmentModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Create Adjustment'));
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('closes modal without creating transaction when difference is zero', async () => {
      const mockAddTransaction = vi.fn();
      const onClose = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => [],
        getDetailCategories: () => [],
      });

      render(<BalanceAdjustmentModal {...defaultProps} newBalance="1000" onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Create Adjustment'));
      
      await waitFor(() => {
        expect(mockAddTransaction).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('uses custom notes when provided', async () => {
      const mockAddTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => mockCategories.filter(cat => cat.level === 'sub'),
        getDetailCategories: () => mockCategories.filter(cat => cat.level === 'detail'),
      });

      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      const notesTextarea = screen.getByLabelText(/notes/i);
      fireEvent.change(notesTextarea, { target: { value: 'Custom note' } });
      
      fireEvent.click(screen.getByText('Create Adjustment'));
      
      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            notes: 'Custom note',
          })
        );
      });
    });
  });

  describe('Modal controls', () => {
    it('calls onClose when cancel button clicked', () => {
      const onClose = vi.fn();
      render(<BalanceAdjustmentModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close icon clicked', () => {
      const onClose = vi.fn();
      render(<BalanceAdjustmentModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon').parentElement!);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Account handling', () => {
    it('returns null if account not found', () => {
      const { container } = render(
        <BalanceAdjustmentModal {...defaultProps} accountId="invalid" />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('uses correct currency from account', () => {
      const customAccounts = [
        { id: 'acc1', name: 'Euro Account', type: 'checking' as const, balance: 1000, createdAt: new Date(), currency: 'EUR' },
      ];
      
      (useApp as any).mockReturnValue({
        accounts: customAccounts,
        categories: mockCategories,
        addTransaction: vi.fn(),
        getSubCategories: () => [],
        getDetailCategories: () => [],
      });

      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      expect(screen.getByText('EUR 1000.00')).toBeInTheDocument();
      expect(screen.getByText('EUR 1500.00')).toBeInTheDocument();
    });
  });

  describe('Information display', () => {
    it('shows explanation message', () => {
      render(<BalanceAdjustmentModal {...defaultProps} />);
      
      expect(screen.getByText(/Changing the balance requires creating a transaction/)).toBeInTheDocument();
    });

    it('handles decimal values correctly', () => {
      render(<BalanceAdjustmentModal {...defaultProps} newBalance="1234.56" />);
      
      // Check that the values are displayed (currency from account is USD)
      expect(screen.getByText('USD 1234.56')).toBeInTheDocument();
      expect(screen.getByText('+USD 234.56')).toBeInTheDocument();
    });

    it('handles invalid newBalance gracefully', () => {
      render(<BalanceAdjustmentModal {...defaultProps} newBalance="invalid" />);
      
      // Check that the values are displayed with 0 for invalid input
      expect(screen.getByText('USD 0.00')).toBeInTheDocument();
      expect(screen.getByText('-USD 1000.00')).toBeInTheDocument();
    });
  });
});
