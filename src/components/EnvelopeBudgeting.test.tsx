/**
 * EnvelopeBudgeting Tests
 * Tests for the envelope budgeting component
 * 
 * Note: This component manages envelope-style budgets with fund transfers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnvelopeBudgeting from './EnvelopeBudgeting';
import type { Category, DecimalTransaction } from '../types';

// Mock icons
vi.mock('./icons', () => ({
  PlusIcon: ({ size }: { size?: number }) => <div data-testid="plus-icon" data-size={size} />,
  MinusIcon: ({ size }: { size?: number }) => <div data-testid="minus-icon" data-size={size} />,
  ArrowRightIcon: ({ size }: { size?: number }) => <div data-testid="arrow-right-icon" data-size={size} />,
  AlertCircleIcon: ({ size }: { size?: number }) => <div data-testid="alert-circle-icon" data-size={size} />,
  CheckCircleIcon: ({ size }: { size?: number }) => <div data-testid="check-circle-icon" data-size={size} />,
  PiggyBankIcon: ({ size }: { size?: number }) => <div data-testid="piggy-bank-icon" data-size={size} />,
  EditIcon: ({ size }: { size?: number }) => <div data-testid="edit-icon" data-size={size} />,
  DeleteIcon: ({ size }: { size?: number }) => <div data-testid="delete-icon" data-size={size} />,
  DollarSignIcon: ({ size }: { size?: number }) => <div data-testid="dollar-sign-icon" data-size={size} />,
}));

// Mock decimal utility
const createMockDecimal = (value: number) => ({
  plus: (other: any) => createMockDecimal(value + (typeof other === 'number' ? other : other.toNumber())),
  minus: (other: any) => createMockDecimal(value - (typeof other === 'number' ? other : other.toNumber())),
  times: (other: number) => createMockDecimal(value * other),
  dividedBy: (other: any) => createMockDecimal(value / (typeof other === 'number' ? other : other.toNumber())),
  greaterThan: (other: number) => value > other,
  greaterThanOrEqualTo: (other: number) => value >= other,
  lessThan: (other: number) => value < other,
  toNumber: () => value,
  toFixed: (decimals: number) => value.toFixed(decimals)
});

vi.mock('../utils/decimal', () => ({
  toDecimal: (value: number) => createMockDecimal(value)
}));

// Mock categories
const mockCategories: Category[] = [
  { id: 'cat1', name: 'Groceries', type: 'expense', color: '#FF6B6B' },
  { id: 'cat2', name: 'Entertainment', type: 'expense', color: '#4ECDC4' },
  { id: 'cat3', name: 'Utilities', type: 'expense', color: '#45B7D1' },
];

// Mock transactions
const mockTransactions: DecimalTransaction[] = [
  {
    id: 't1',
    accountId: 'acc1',
    amount: createMockDecimal(150),
    type: 'expense',
    date: new Date(),
    description: 'Grocery shopping',
    category: 'cat1'
  },
  {
    id: 't2',
    accountId: 'acc1',
    amount: createMockDecimal(50),
    type: 'expense',
    date: new Date(),
    description: 'Movie tickets',
    category: 'cat2'
  }
];

// Mock budgets
const mockBudgets = [
  {
    id: 'b1',
    category: 'cat1',
    amount: 500,
    period: 'monthly' as const,
    isActive: true
  },
  {
    id: 'b2',
    category: 'cat2',
    amount: 200,
    period: 'monthly' as const,
    isActive: true
  },
  {
    id: 'b3',
    category: 'cat3',
    amount: 300,
    period: 'monthly' as const,
    isActive: true
  }
];

// Mock hooks
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    categories: mockCategories,
    getDecimalTransactions: () => mockTransactions
  })
}));

vi.mock('../contexts/BudgetContext', () => ({
  useBudgets: () => ({
    budgets: mockBudgets,
    addBudget: vi.fn(),
    updateBudget: vi.fn()
  })
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: any) => {
      const num = typeof value === 'number' ? value : value.toNumber();
      return `$${num.toFixed(2)}`;
    }
  })
}));

describe('EnvelopeBudgeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the component header', () => {
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByText('Envelope Budgeting')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add envelope/i })).toBeInTheDocument();
    });

    it('displays summary cards', () => {
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByText('Total Budgeted')).toBeInTheDocument();
      expect(screen.getByText('Total Spent')).toBeInTheDocument();
      expect(screen.getByText('Remaining')).toBeInTheDocument();
      expect(screen.getByText('Overbudget')).toBeInTheDocument();
    });

    it('shows icons in summary cards', () => {
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByTestId('piggy-bank-icon')).toBeInTheDocument();
      expect(screen.getByTestId('dollar-sign-icon')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });
  });

  describe('envelope display', () => {
    it('creates envelopes from budgets', () => {
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
    });

    it('displays budgeted amounts', () => {
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByText('$500.00')).toBeInTheDocument();
      expect(screen.getByText('$200.00')).toBeInTheDocument();
      expect(screen.getByText('$300.00')).toBeInTheDocument();
    });

    it('shows priority badges', () => {
      render(<EnvelopeBudgeting />);
      
      const priorities = screen.getAllByText('medium');
      expect(priorities.length).toBe(3);
    });

    it('displays progress bars', () => {
      render(<EnvelopeBudgeting />);
      
      // Check for percentage displays
      expect(screen.getByText('30.0%')).toBeInTheDocument(); // Groceries: 150/500
      expect(screen.getByText('25.0%')).toBeInTheDocument(); // Entertainment: 50/200
    });
  });

  describe('calculations', () => {
    it('calculates total budgeted correctly', () => {
      render(<EnvelopeBudgeting />);
      
      // 500 + 200 + 300 = 1000
      expect(screen.getByText('$1000.00')).toBeInTheDocument();
    });

    it('calculates total spent correctly', () => {
      render(<EnvelopeBudgeting />);
      
      // 150 + 50 = 200
      expect(screen.getByText('$200.00')).toBeInTheDocument();
    });

    it('calculates remaining correctly', () => {
      render(<EnvelopeBudgeting />);
      
      // 1000 - 200 = 800
      expect(screen.getByText('$800.00')).toBeInTheDocument();
    });

    it('counts overbudget envelopes', () => {
      render(<EnvelopeBudgeting />);
      
      // None are overbudget in our test data
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('envelope selection', () => {
    it('selects envelope on click', async () => {
      render(<EnvelopeBudgeting />);
      
      const groceriesEnvelope = screen.getByText('Groceries').closest('[class*="cursor-pointer"]');
      fireEvent.click(groceriesEnvelope!);
      
      await waitFor(() => {
        expect(groceriesEnvelope).toHaveClass('ring-2');
      });
    });
  });

  describe('add envelope modal', () => {
    it('opens add envelope modal', async () => {
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Add New Envelope')).toBeInTheDocument();
      });
    });

    it('displays form fields', async () => {
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/envelope name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/budgeted amount/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/color/i)).toBeInTheDocument();
      });
    });

    it('shows category checkboxes', async () => {
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Categories')).toBeInTheDocument();
        mockCategories.forEach(category => {
          expect(screen.getByLabelText(category.name)).toBeInTheDocument();
        });
      });
    });

    it('creates new envelope', async () => {
      const { addBudget } = await import('../contexts/BudgetContext');
      const mockAddBudget = vi.mocked(addBudget);
      
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/envelope name/i);
        fireEvent.change(nameInput, { target: { value: 'New Envelope' } });
        
        const amountInput = screen.getByLabelText(/budgeted amount/i);
        fireEvent.change(amountInput, { target: { value: '100' } });
        
        const groceriesCheckbox = screen.getByLabelText('Groceries');
        fireEvent.click(groceriesCheckbox);
        
        const submitButton = screen.getByRole('button', { name: /add envelope/i });
        fireEvent.click(submitButton);
      });
      
      expect(mockAddBudget).toHaveBeenCalled();
    });
  });

  describe('transfer modal', () => {
    it('opens transfer modal', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText('Transfer Funds')).toBeInTheDocument();
      });
    });

    it('displays transfer form fields', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/from envelope/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/to envelope/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      });
    });

    it('populates envelope options', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        const fromSelect = screen.getByLabelText(/from envelope/i);
        expect(fromSelect).toContainHTML('Groceries');
        expect(fromSelect).toContainHTML('Entertainment');
        expect(fromSelect).toContainHTML('Utilities');
      });
    });

    it('filters to envelope based on from selection', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        const fromSelect = screen.getByLabelText(/from envelope/i);
        fireEvent.change(fromSelect, { target: { value: 'b1' } });
        
        const toSelect = screen.getByLabelText(/to envelope/i);
        expect(toSelect).not.toContainHTML('Groceries');
        expect(toSelect).toContainHTML('Entertainment');
      });
    });

    it('executes transfer', async () => {
      const { updateBudget } = await import('../contexts/BudgetContext');
      const mockUpdateBudget = vi.mocked(updateBudget);
      
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        const fromSelect = screen.getByLabelText(/from envelope/i);
        fireEvent.change(fromSelect, { target: { value: 'b1' } });
        
        const toSelect = screen.getByLabelText(/to envelope/i);
        fireEvent.change(toSelect, { target: { value: 'b2' } });
        
        const amountInput = screen.getByLabelText(/amount/i);
        fireEvent.change(amountInput, { target: { value: '50' } });
        
        const submitButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Transfer');
        fireEvent.click(submitButton!);
      });
      
      expect(mockUpdateBudget).toHaveBeenCalledTimes(2);
    });
  });

  describe('visual indicators', () => {
    it('uses green for positive remaining', () => {
      render(<EnvelopeBudgeting />);
      
      const remainingCard = screen.getByText('Remaining').closest('div');
      expect(remainingCard).toHaveClass('bg-green-50');
    });

    it('shows spent percentage', () => {
      render(<EnvelopeBudgeting />);
      
      const spentLabels = screen.getAllByText('Spent');
      expect(spentLabels.length).toBeGreaterThan(0);
    });

    it('displays color indicators for envelopes', () => {
      render(<EnvelopeBudgeting />);
      
      const colorIndicators = screen.getAllByText('Groceries')[0].parentElement?.querySelector('[style*="backgroundColor"]');
      expect(colorIndicators).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible form controls in add modal', async () => {
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/envelope name/i)).toHaveAttribute('type', 'text');
        expect(screen.getByLabelText(/budgeted amount/i)).toHaveAttribute('type', 'number');
        expect(screen.getByLabelText(/priority/i).tagName).toBe('SELECT');
      });
    });

    it('has proper labels for all form inputs', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/from envelope/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/to envelope/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      });
    });
  });

  describe('empty states', () => {
    it('handles no budgets gracefully', () => {
      vi.mocked(vi.fn()).mockImplementation(() => ({
        useBudgets: () => ({
          budgets: [],
          addBudget: vi.fn(),
          updateBudget: vi.fn()
        })
      }));
      
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });
});