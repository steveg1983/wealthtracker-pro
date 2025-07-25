import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Category, Transaction } from '../types';

// Mock child components
vi.mock('./CategoryCreationModal', () => ({
  default: ({ isOpen, onClose }: any) => 
    isOpen ? (
      <div data-testid="category-creation-modal">
        <button onClick={onClose}>Close Category Modal</button>
      </div>
    ) : null
}));

// Mock icons
vi.mock('./icons', () => ({
  XIcon: ({ size }: any) => <div data-testid="x-icon">X</div>,
  CalendarIcon: ({ size }: any) => <div data-testid="calendar-icon">Cal</div>,
  BanknoteIcon: ({ size }: any) => <div data-testid="banknote-icon">Bank</div>,
  CalculatorIcon: ({ size }: any) => <div data-testid="calculator-icon">Calc</div>,
}));

// Mock utility functions
vi.mock('../utils/currency', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}`,
  getCurrencySymbol: (currency: string) => currency === 'USD' ? '$' : currency,
}));

// Mock data
const mockAccounts: Account[] = [
  { id: 'acc1', name: 'Checking', type: 'checking', balance: 1000, openingBalance: 500, createdAt: new Date(), currency: 'USD' },
  { id: 'acc2', name: 'Savings', type: 'savings', balance: 5000, openingBalance: 4000, createdAt: new Date(), currency: 'USD' },
];

const mockTransactions: Transaction[] = [
  { 
    id: 'trans1', 
    date: new Date('2024-01-15'), 
    description: 'Income', 
    amount: 200, 
    type: 'income', 
    category: 'salary', 
    accountId: 'acc1',
    cleared: true,
    createdAt: new Date()
  },
  { 
    id: 'trans2', 
    date: new Date('2024-01-20'), 
    description: 'Expense', 
    amount: 100, 
    type: 'expense', 
    category: 'food', 
    accountId: 'acc1',
    cleared: true,
    createdAt: new Date()
  },
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
    transactions: mockTransactions,
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
import { useApp } from '../contexts/AppContext';
import AccountReconciliationModal from './AccountReconciliationModal';

describe('AccountReconciliationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    accountId: 'acc1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to default values
    (useApp as any).mockReturnValue({
      accounts: mockAccounts,
      transactions: mockTransactions,
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
      render(<AccountReconciliationModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText(/Reconcile/)).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      expect(screen.getByText('Reconcile Checking')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Statement Date')).toBeInTheDocument();
      expect(screen.getByText(/System Balance/)).toBeInTheDocument();
      expect(screen.getByText(/Statement Balance/)).toBeInTheDocument();
    });

    it('returns null if account not found', () => {
      const { container } = render(
        <AccountReconciliationModal {...defaultProps} accountId="invalid" />
      );
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Balance calculation', () => {
    it('calculates system balance correctly', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      // Opening balance (500) + Income (200) - Expense (100) = 600
      expect(screen.getByText('USD 600.00')).toBeInTheDocument();
    });

    it('calculates balance up to reconciliation date', () => {
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.value = '2024-01-17';
      
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const dateField = screen.getByDisplayValue(new Date().toISOString().split('T')[0]);
      fireEvent.change(dateField, { target: { value: '2024-01-17' } });
      
      // Should only include trans1 (before Jan 17), so 500 + 200 = 700
      expect(screen.getByText('USD 700.00')).toBeInTheDocument();
    });

    it('handles accounts without opening balance', () => {
      const accountsWithoutOpeningBalance = [
        { ...mockAccounts[0], openingBalance: undefined }
      ];
      
      (useApp as any).mockReturnValue({
        accounts: accountsWithoutOpeningBalance,
        transactions: mockTransactions,
        categories: mockCategories,
        addTransaction: vi.fn(),
        getSubCategories: () => [],
        getDetailCategories: () => [],
      });

      render(<AccountReconciliationModal {...defaultProps} />);
      
      // 0 + Income (200) - Expense (100) = 100
      expect(screen.getByText('USD 100.00')).toBeInTheDocument();
    });
  });

  describe('Form interactions', () => {
    it('updates statement date', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0]);
      fireEvent.change(dateInput, { target: { value: '2024-02-01' } });
      
      expect(dateInput).toHaveValue('2024-02-01');
    });

    it('updates statement balance', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750.50' } });
      
      expect(balanceInput).toHaveValue(750.5);
    });

    it('shows difference when statement balance entered', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      expect(screen.getByText('Difference')).toBeInTheDocument();
      expect(screen.getByText('USD 150.00')).toBeInTheDocument(); // 750 - 600 = 150
    });

    it('shows positive adjustment message', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      expect(screen.getByText(/A positive adjustment of USD 150.00 will be added/)).toBeInTheDocument();
    });

    it('shows negative adjustment message', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '450' } });
      
      expect(screen.getByText(/A negative adjustment of USD 150.00 will be added/)).toBeInTheDocument();
    });

    it('updates notes field', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      const notesTextarea = screen.getByPlaceholderText(/Add any notes about this reconciliation/);
      fireEvent.change(notesTextarea, { target: { value: 'Monthly reconciliation' } });
      
      expect(notesTextarea).toHaveValue('Monthly reconciliation');
    });

    it('opens category creation modal', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      fireEvent.click(screen.getByText('Create new'));
      
      expect(screen.getByTestId('category-creation-modal')).toBeInTheDocument();
    });
  });

  describe('Category selection', () => {
    it('shows category fields only when adjustment needed', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      // Category fields appear immediately because empty balance is treated as 0,
      // creating a -600 difference
      expect(screen.getByText('Category for Adjustment')).toBeInTheDocument();
      
      // Enter statement balance that matches system balance (no adjustment needed)
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '600' } });
      
      // Category fields should disappear when balanced
      expect(screen.queryByText('Category for Adjustment')).not.toBeInTheDocument();
      
      // Now enter different balance
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      // Category fields should reappear
      expect(screen.getByText('Category for Adjustment')).toBeInTheDocument();
    });

    it('shows income categories for positive difference', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      expect(screen.getByText('Other Income')).toBeInTheDocument();
    });

    it('shows expense categories for negative difference', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '450' } });
      
      expect(screen.getByText('Other Expense')).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('creates adjustment transaction for positive difference', async () => {
      const mockAddTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        transactions: mockTransactions,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => mockCategories.filter(cat => cat.level === 'sub' && cat.type === 'income'),
        getDetailCategories: () => mockCategories.filter(cat => cat.level === 'detail'),
      });

      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      fireEvent.click(screen.getByText('Reconcile & Adjust'));
      
      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith({
          date: expect.any(Date),
          description: 'Balance Adjustment - Account Reconciliation',
          amount: 150,
          type: 'income',
          category: 'cat-blank',
          accountId: 'acc1',
          notes: 'Reconciliation adjustment to match statement balance of USD 750.00',
          cleared: true,
          tags: ['reconciliation', 'adjustment'],
        });
      });
    });

    it('creates adjustment transaction for negative difference', async () => {
      const mockAddTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        transactions: mockTransactions,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => mockCategories.filter(cat => cat.level === 'sub' && cat.type === 'expense'),
        getDetailCategories: () => mockCategories.filter(cat => cat.level === 'detail'),
      });

      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '450' } });
      
      fireEvent.click(screen.getByText('Reconcile & Adjust'));
      
      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith({
          date: expect.any(Date),
          description: 'Balance Adjustment - Account Reconciliation',
          amount: 150,
          type: 'expense',
          category: 'cat-blank',
          accountId: 'acc1',
          notes: 'Reconciliation adjustment to match statement balance of USD 450.00',
          cleared: true,
          tags: ['reconciliation', 'adjustment'],
        });
      });
    });

    it('closes modal without creating transaction when no difference', async () => {
      const mockAddTransaction = vi.fn();
      const onClose = vi.fn();
      
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        transactions: mockTransactions,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => [],
        getDetailCategories: () => [],
      });

      render(<AccountReconciliationModal {...defaultProps} onClose={onClose} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '600' } }); // Exact match
      
      fireEvent.click(screen.getByText('Close'));
      
      await waitFor(() => {
        expect(mockAddTransaction).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('uses custom notes when provided', async () => {
      const mockAddTransaction = vi.fn();
      (useApp as any).mockReturnValue({
        accounts: mockAccounts,
        transactions: mockTransactions,
        categories: mockCategories,
        addTransaction: mockAddTransaction,
        getSubCategories: () => mockCategories.filter(cat => cat.level === 'sub'),
        getDetailCategories: () => mockCategories.filter(cat => cat.level === 'detail'),
      });

      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      const notesTextarea = screen.getByPlaceholderText(/Add any notes about this reconciliation/);
      fireEvent.change(notesTextarea, { target: { value: 'Custom reconciliation note' } });
      
      fireEvent.click(screen.getByText('Reconcile & Adjust'));
      
      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            notes: 'Custom reconciliation note',
          })
        );
      });
    });

    it('closes modal after submission', async () => {
      const onClose = vi.fn();
      render(<AccountReconciliationModal {...defaultProps} onClose={onClose} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '750' } });
      
      fireEvent.click(screen.getByText('Reconcile & Adjust'));
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Modal controls', () => {
    it('calls onClose when cancel button clicked', () => {
      const onClose = vi.fn();
      render(<AccountReconciliationModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close icon clicked', () => {
      const onClose = vi.fn();
      render(<AccountReconciliationModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon').parentElement!);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Currency display', () => {
    it('uses account currency symbol', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText(/Statement Balance \(\$/)).toBeInTheDocument();
    });

    it('formats currency correctly', () => {
      const euroAccounts = [
        { ...mockAccounts[0], currency: 'EUR' }
      ];
      
      (useApp as any).mockReturnValue({
        accounts: euroAccounts,
        transactions: mockTransactions,
        categories: mockCategories,
        addTransaction: vi.fn(),
        getSubCategories: () => [],
        getDetailCategories: () => [],
      });

      render(<AccountReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText(/Statement Balance \(EUR\)/)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles decimal precision correctly', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '600.005' } });
      
      // Difference is 0.005 which formats to 0.00 (2 decimal places)
      const differenceSection = screen.getByText('Difference').parentElement;
      expect(differenceSection).toHaveTextContent('USD 0.00');
      
      // Since abs(0.005) < 0.01, it should show green (balanced)
      const amountElement = differenceSection.querySelector('.text-xl.font-bold');
      expect(amountElement).toHaveClass('text-green-600');
      
      // And no adjustment message should show
      expect(screen.queryByText(/will be added to reconcile/)).not.toBeInTheDocument();
    });

    it('handles empty statement balance', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      // Should not show difference section when balance is empty
      expect(screen.queryByText('Difference')).not.toBeInTheDocument();
    });

    it('handles zero statement balance', () => {
      render(<AccountReconciliationModal {...defaultProps} />);
      
      const balanceInput = screen.getByPlaceholderText(/Enter balance from your bank statement/);
      fireEvent.change(balanceInput, { target: { value: '0' } });
      
      expect(screen.getByText('Difference')).toBeInTheDocument();
      
      // System balance is 600, statement is 0, so difference is -600
      const differenceSection = screen.getByText('Difference').parentElement;
      expect(differenceSection).toHaveTextContent('USD -600.00');
      
      // Should also show adjustment message
      expect(screen.getByText(/A negative adjustment of USD 600.00 will be added/)).toBeInTheDocument();
    });
  });
});