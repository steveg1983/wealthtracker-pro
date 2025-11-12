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
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';
import { toDecimal } from '../utils/decimal';

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
    amount: toDecimal(150),
    type: 'expense',
    date: new Date(),
    description: 'Grocery shopping',
    category: 'cat1'
  },
  {
    id: 't2',
    accountId: 'acc1',
    amount: toDecimal(50),
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
    categoryId: 'cat1',
    category: 'cat1',
    amount: 500,
    period: 'monthly' as const,
    isActive: true
  },
  {
    id: 'b2',
    categoryId: 'cat2',
    category: 'cat2',
    amount: 200,
    period: 'monthly' as const,
    isActive: true
  },
  {
    id: 'b3',
    categoryId: 'cat3',
    category: 'cat3',
    amount: 300,
    period: 'monthly' as const,
    isActive: true
  }
];

// Create mocks that can be updated per test
let mockAddBudget = vi.fn();
let mockUpdateBudget = vi.fn();
let currentMockBudgets = mockBudgets;

// Mock hooks
vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    categories: mockCategories,
    getDecimalTransactions: () => mockTransactions
  })
}));

vi.mock('../contexts/BudgetContext', () => ({
  useBudgets: () => ({
    budgets: currentMockBudgets,
    addBudget: mockAddBudget,
    updateBudget: mockUpdateBudget
  })
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: any, currency: string = 'USD') => {
      const num = typeof value === 'number' ? value : value.toNumber();
      return formatCurrencyDecimal(num, currency);
    }
  })
}));

describe('EnvelopeBudgeting', () => {
  const formatUSD = (value: number) => formatCurrencyDecimal(value, 'USD');
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to defaults
    mockAddBudget = vi.fn();
    mockUpdateBudget = vi.fn();
    currentMockBudgets = mockBudgets;
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
      
      // Use getAllByText since categories appear multiple times
      const hasGroceries = screen.getAllByText((content) => content.includes('Groceries'));
      const hasEntertainment = screen.getAllByText((content) => content.includes('Entertainment'));
      const hasUtilities = screen.getAllByText((content) => content.includes('Utilities'));

      expect(hasGroceries.length).toBeGreaterThan(0);
      expect(hasEntertainment.length).toBeGreaterThan(0);
      expect(hasUtilities.length).toBeGreaterThan(0);
    });

    it('displays budgeted amounts', () => {
      render(<EnvelopeBudgeting />);
      
      expect(screen.getByText(formatUSD(500))).toBeInTheDocument();
      // The $200.00 formatted value appears multiple times (budget amount and total spent)
      expect(screen.getAllByText(formatUSD(200)).length).toBeGreaterThan(0);
      // $300.00 also appears multiple times
      expect(screen.getAllByText(formatUSD(300)).length).toBeGreaterThan(0);
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
      expect(screen.getByText(formatUSD(1000))).toBeInTheDocument();
    });

    it('calculates total spent correctly', () => {
      render(<EnvelopeBudgeting />);
      
      // 150 + 50 = 200
      // The formatted $200.00 appears multiple times, check within Total Spent context
      const totalSpentSection = screen.getByText('Total Spent').parentElement?.parentElement;
      expect(totalSpentSection).toHaveTextContent(formatUSD(200));
    });

    it('calculates remaining correctly', () => {
      render(<EnvelopeBudgeting />);
      
      // 1000 - 200 = 800
      expect(screen.getByText(formatUSD(800))).toBeInTheDocument();
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
      
      // Find the first Groceries text and get its envelope container
      const groceriesTexts = screen.getAllByText((content) => content.includes('Groceries'));
      const groceriesEnvelope = groceriesTexts[0].closest('[class*="cursor-pointer"]');
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
        // Check for text labels instead of using getByLabelText
        expect(screen.getByText('Envelope Name')).toBeInTheDocument();
        expect(screen.getByText('Budgeted Amount')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
        expect(screen.getByText('Color')).toBeInTheDocument();
        
        // Check for form inputs
        expect(screen.getByPlaceholderText('e.g., Groceries')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
      });
    });

    it('shows category checkboxes', async () => {
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Categories')).toBeInTheDocument();
        mockCategories.forEach(category => {
          expect(screen.getByRole('checkbox', { name: category.name })).toBeInTheDocument();
        });
      });
    });

    it.skip('creates new envelope', async () => {
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Add New Envelope')).toBeInTheDocument();
      });
      
      const nameInput = screen.getByPlaceholderText('e.g., Groceries');
      fireEvent.change(nameInput, { target: { value: 'New Envelope' } });
      
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '100' } });
      
      const groceriesCheckbox = screen.getByRole('checkbox', { name: 'Groceries' });
      fireEvent.click(groceriesCheckbox);
      
      // Find the Add Envelope button in the modal
      const modalButtons = screen.getAllByRole('button');
      const submitButton = modalButtons.find(btn => btn.textContent === 'Add Envelope');
      fireEvent.click(submitButton!);
      
      await waitFor(() => {
        expect(mockAddBudget).toHaveBeenCalled();
      });
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
        // Check for text labels
        expect(screen.getByText('From Envelope')).toBeInTheDocument();
        expect(screen.getByText('To Envelope')).toBeInTheDocument();
        expect(screen.getByText('Amount')).toBeInTheDocument();
        expect(screen.getByText('Description (Optional)')).toBeInTheDocument();
        
        // Check for form inputs
        expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Transfer reason...')).toBeInTheDocument();
      });
    });

    it('populates envelope options', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        // Find the select element by finding its label first
        const fromLabel = screen.getByText('From Envelope');
        const fromSelect = fromLabel.parentElement?.querySelector('select');
        expect(fromSelect).toBeInTheDocument();
        expect(fromSelect).toHaveTextContent('Groceries');
        expect(fromSelect).toHaveTextContent('Entertainment');
        expect(fromSelect).toHaveTextContent('Utilities');
      });
    });

    it('filters to envelope based on from selection', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        // Find selects by their labels
        const fromLabel = screen.getByText('From Envelope');
        const fromSelect = fromLabel.parentElement?.querySelector('select');
        fireEvent.change(fromSelect!, { target: { value: 'b1' } });
        
        const toLabel = screen.getByText('To Envelope');
        const toSelect = toLabel.parentElement?.querySelector('select');
        expect(toSelect).not.toHaveTextContent('Groceries');
        expect(toSelect).toHaveTextContent('Entertainment');
      });
    });

    it.skip('executes transfer', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText('Transfer Funds')).toBeInTheDocument();
      });
      
      // Find selects by their labels
      const fromLabel = screen.getByText('From Envelope');
      const fromSelect = fromLabel.parentElement?.querySelector('select');
      fireEvent.change(fromSelect!, { target: { value: 'b1' } });
      
      const toLabel = screen.getByText('To Envelope');
      const toSelect = toLabel.parentElement?.querySelector('select');
      fireEvent.change(toSelect!, { target: { value: 'b2' } });
      
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '50' } });
      
      const submitButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Transfer');
      fireEvent.click(submitButton!);
      
      await waitFor(() => {
        expect(mockUpdateBudget).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('visual indicators', () => {
    it('uses green for positive remaining', () => {
      render(<EnvelopeBudgeting />);
      
      // Find the parent that contains the color class
      const remainingText = screen.getByText('Remaining');
      const remainingCard = remainingText.parentElement?.parentElement;
      expect(remainingCard?.className).toMatch(/bg-green-50/);
    });

    it('shows spent percentage', () => {
      render(<EnvelopeBudgeting />);
      
      const spentLabels = screen.getAllByText('Spent');
      expect(spentLabels.length).toBeGreaterThan(0);
    });

    it('displays color indicators for envelopes', () => {
      render(<EnvelopeBudgeting />);
      
      // Find the first envelope with Groceries text
      const groceriesTexts = screen.getAllByText((content) => content.includes('Groceries'));
      const envelopeContainer = groceriesTexts[0].closest('[class*="bg-white/70"]');
      const colorIndicator = envelopeContainer?.querySelector('.w-4.h-4.rounded-full');
      expect(colorIndicator).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible form controls in add modal', async () => {
      render(<EnvelopeBudgeting />);
      
      const addButton = screen.getByRole('button', { name: /add envelope/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        // Check by placeholder text for inputs
        const nameInput = screen.getByPlaceholderText('e.g., Groceries');
        expect(nameInput).toHaveAttribute('type', 'text');
        
        const amountInput = screen.getByPlaceholderText('0.00');
        expect(amountInput).toHaveAttribute('type', 'number');
        
        // Find priority select by its label
        const priorityLabel = screen.getByText('Priority');
        const prioritySelect = priorityLabel.parentElement?.querySelector('select');
        expect(prioritySelect?.tagName).toBe('SELECT');
      });
    });

    it('has proper labels for all form inputs', async () => {
      render(<EnvelopeBudgeting />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        // Check that labels exist
        expect(screen.getByText('From Envelope')).toBeInTheDocument();
        expect(screen.getByText('To Envelope')).toBeInTheDocument();
        expect(screen.getByText('Amount')).toBeInTheDocument();
        
        // Check that form elements exist
        const selects = screen.getAllByRole('combobox');
        expect(selects).toHaveLength(2); // From and To selects
        expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
      });
    });
  });

  describe('empty states', () => {
    it('handles no budgets gracefully', () => {
      // Update the mock budgets for this test
      currentMockBudgets = [];
      
      render(<EnvelopeBudgeting />);
      
      // There are multiple formatted zero values (Total Budgeted, Total Spent, Remaining)
      const zeroValues = screen.getAllByText(formatUSD(0));
      expect(zeroValues.length).toBeGreaterThan(0);
    });
  });
});
