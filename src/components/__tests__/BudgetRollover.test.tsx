/**
 * BudgetRollover Tests
 * Tests for the BudgetRollover component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BudgetRollover from '../BudgetRollover';
import { formatCurrency as formatCurrencyDecimal } from '../../utils/currency-decimal';

// Mock dependencies
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    categories: [
      { id: 'cat-1', name: 'Food', type: 'expense', level: 'detail', parentId: 'sub-food' },
      { id: 'cat-2', name: 'Transport', type: 'expense', level: 'detail', parentId: 'sub-transport' },
      { id: 'cat-3', name: 'Entertainment', type: 'expense', level: 'detail', parentId: 'sub-entertainment' },
      { id: 'cat-4', name: 'Utilities', type: 'expense', level: 'detail', parentId: 'sub-utilities' }
    ],
    transactions: [
      {
        id: 'trans-1',
        date: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15), // Last month
        amount: 150,
        category: 'Food',
        type: 'expense',
        description: 'Grocery shopping',
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'trans-2',
        date: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 20), // Last month
        amount: 50,
        category: 'Transport',
        type: 'expense',
        description: 'Gas',
        accountId: 'acc-1',
        cleared: true
      }
    ],
    budgets: []
  })
}));

vi.mock('../../contexts/BudgetContext', () => ({
  useBudgets: () => ({
    budgets: [
      {
        id: 'budget-1',
        category: 'Food',
        amount: 200,
        period: 'monthly',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        description: 'Food budget'
      },
      {
        id: 'budget-2',
        category: 'Transport',
        amount: 100,
        period: 'monthly',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        description: 'Transport budget'
      },
      {
        id: 'budget-3',
        category: 'Entertainment',
        amount: 150,
        period: 'monthly',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        description: 'Entertainment budget'
      }
    ],
    updateBudget: vi.fn()
  })
}));

vi.mock('../../hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((key, defaultValue) => {
    const [value, setValue] = React.useState(defaultValue);
    return [value, setValue];
  })
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: any) => formatCurrencyDecimal(value, 'USD')
  })
}));

// Mock decimal utilities

// Mock icons
vi.mock('../icons', () => ({
  ArrowRightIcon: () => <div data-testid="arrow-right-icon">ArrowRight</div>,
  CalendarIcon: () => <div data-testid="calendar-icon">Calendar</div>,
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <div data-testid="check-circle-icon" className={className}>CheckCircle</div>
  ),
  AlertCircleIcon: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle-icon" className={className}>AlertCircle</div>
  ),
  TrendingUpIcon: ({ className }: { className?: string }) => (
    <div data-testid="trending-up-icon" className={className}>TrendingUp</div>
  ),
  TrendingDownIcon: ({ className }: { className?: string }) => (
    <div data-testid="trending-down-icon" className={className}>TrendingDown</div>
  ),
  RepeatIcon: ({ className }: { className?: string }) => (
    <div data-testid="repeat-icon" className={className}>Repeat</div>
  ),
  InfoIcon: () => <div data-testid="info-icon">Info</div>,
  SaveIcon: () => <div data-testid="save-icon">Save</div>,
  SettingsIcon: () => <div data-testid="settings-icon">Settings</div>
}));

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

describe('BudgetRollover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders the budget rollover header', () => {
      render(<BudgetRollover />);
      
      expect(screen.getByText('Budget Rollover')).toBeInTheDocument();
      expect(screen.getByText(/Carry forward unused budget from/)).toBeInTheDocument();
    });

    it('shows rollover status', () => {
      render(<BudgetRollover />);
      
      // Find the status text specifically
      expect(screen.getByText(/Rollover.*Disabled/)).toBeInTheDocument();
    });

    it('displays settings and preview buttons', () => {
      render(<BudgetRollover />);
      
      // Use getByRole for buttons to be more specific
      expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Preview Rollover/i })).toBeInTheDocument();
    });

    it('shows budget summary statistics when enabled', async () => {
      render(<BudgetRollover />);
      
      // Open settings
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      // Enable rollover - first checkbox in settings modal
      const enableCheckbox = screen.getAllByRole('checkbox')[0];
      await userEvent.click(enableCheckbox);
      
      // Close settings
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Should show stats
      await waitFor(() => {
        expect(screen.getByText('Total Rollover')).toBeInTheDocument();
        expect(screen.getByText('Eligible Budgets')).toBeInTheDocument();
        expect(screen.getByText('With Surplus')).toBeInTheDocument();
        expect(screen.getByText('With Deficit')).toBeInTheDocument();
      });
    });

    it('shows rollover details for each budget when enabled', async () => {
      render(<BudgetRollover />);
      
      // Open settings and enable
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Should show budget categories
      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument();
        expect(screen.getByText('Transport')).toBeInTheDocument();
        expect(screen.getByText('Entertainment')).toBeInTheDocument();
      });
    });
  });

  describe('settings modal', () => {
    it('opens settings modal when clicking settings button', async () => {
      render(<BudgetRollover />);
      
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      expect(screen.getByText('Rollover Settings')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')[0]).toBeInTheDocument();
    });

    it('allows enabling/disabling rollover', async () => {
      render(<BudgetRollover />);
      
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      const enableCheckbox = screen.getAllByRole('checkbox')[0];
      expect(enableCheckbox).not.toBeChecked();
      
      await userEvent.click(enableCheckbox);
      expect(enableCheckbox).toBeChecked();
    });

    it('allows selecting rollover mode', async () => {
      render(<BudgetRollover />);
      
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      const modeSelect = screen.getByRole('combobox');
      expect(modeSelect).toHaveValue('all');
      
      await userEvent.selectOptions(modeSelect, 'percentage');
      expect(modeSelect).toHaveValue('percentage');
      
      // Should show percentage input
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    });

    it('allows setting maximum rollover amount', async () => {
      render(<BudgetRollover />);
      
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      const maxAmountInput = screen.getByRole('spinbutton');
      await userEvent.type(maxAmountInput, '500');
      
      expect(maxAmountInput).toHaveValue(500);
    });

    it('allows excluding categories', async () => {
      render(<BudgetRollover />);
      
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      const foodCheckbox = screen.getByRole('checkbox', { name: 'Food' });
      await userEvent.click(foodCheckbox);
      
      expect(foodCheckbox).toBeChecked();
    });

    it('allows enabling auto-apply', async () => {
      render(<BudgetRollover />);
      
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      const autoApplyCheckbox = screen.getAllByRole('checkbox')[1];
      await userEvent.click(autoApplyCheckbox);
      
      expect(autoApplyCheckbox).toBeChecked();
    });

    it('allows carrying negative balances', async () => {
      render(<BudgetRollover />);
      
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      
      const carryNegativeCheckbox = screen.getAllByRole('checkbox')[2];
      await userEvent.click(carryNegativeCheckbox);
      
      expect(carryNegativeCheckbox).toBeChecked();
    });
  });

  describe('preview modal', () => {
    it('shows preview when clicking preview button', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover first
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Click preview
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /Preview Rollover/i });
        expect(previewButton).not.toBeDisabled();
      });
      
      await userEvent.click(screen.getByRole('button', { name: /Preview Rollover/i }));
      
      expect(screen.getByText('Rollover Preview')).toBeInTheDocument();
    });

    it('shows rollover amounts in preview', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Open preview
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Preview Rollover/i })).not.toBeDisabled();
      });
      await userEvent.click(screen.getByRole('button', { name: /Preview Rollover/i }));
      
      // Should show categories with rollover amounts
      expect(screen.getByText(/will be added to your/)).toBeInTheDocument();
    });

    it('allows applying rollover from preview', async () => {
      render(<BudgetRollover />);
      
      // Enable and preview
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Preview Rollover/i })).not.toBeDisabled();
      });
      await userEvent.click(screen.getByRole('button', { name: /Preview Rollover/i }));
      
      // Apply rollover - just verify the button exists and can be clicked
      const applyButton = screen.getByRole('button', { name: /Apply Rollover/i });
      expect(applyButton).toBeInTheDocument();
      await userEvent.click(applyButton);
      
      // The modal should close after applying
      await waitFor(() => {
        expect(screen.queryByText('Rollover Preview')).not.toBeInTheDocument();
      });
    });
  });

  describe('calculations', () => {
    it('calculates correct remaining amounts', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Food budget: $200 - $150 spent = $50 remaining
      // Transport budget: $100 - $50 spent = $50 remaining
      // Entertainment budget: $150 - $0 spent = $150 remaining
      
      await waitFor(() => {
        expect(screen.getByText('$250.00')).toBeInTheDocument(); // Total rollover
      });
    });

    it('enables preview button when rollover amount is available', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Preview button should be enabled when there are rollover amounts
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Preview Rollover/i })).not.toBeDisabled();
      });
      
      // Verify there's a positive rollover amount displayed
      expect(screen.getByText('$250.00')).toBeInTheDocument();
    });
  });

  describe('rollover history', () => {
    it('renders without history data', async () => {
      render(<BudgetRollover />);
      
      // Component should render successfully even without history
      expect(screen.getByText('Budget Rollover')).toBeInTheDocument();
      
      // History section should not be visible when no history exists
      expect(screen.queryByText('Rollover History')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles percentage mode correctly', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover with percentage mode
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      
      const modeSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(modeSelect, 'percentage');
      
      const percentageInput = screen.getByDisplayValue('100');
      await userEvent.clear(percentageInput);
      await userEvent.type(percentageInput, '50');
      
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Should calculate 50% of remaining amounts
      await waitFor(() => {
        expect(screen.getByText('$125.00')).toBeInTheDocument(); // 50% of $250
      });
    });

    it('handles excluded categories', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover and exclude Food category
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      
      const foodCheckbox = screen.getByRole('checkbox', { name: 'Food' });
      await userEvent.click(foodCheckbox);
      
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Total should exclude Food's $50
      await waitFor(() => {
        expect(screen.getByText('$200.00')).toBeInTheDocument(); // $250 - $50
      });
    });

    it('closes modals when clicking cancel', async () => {
      render(<BudgetRollover />);
      
      // Open settings
      await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
      expect(screen.getByText('Rollover Settings')).toBeInTheDocument();
      
      // Cancel
      await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.queryByText('Rollover Settings')).not.toBeInTheDocument();
    });
  });
});
