/**
 * BudgetRollover Tests
 * Tests for the BudgetRollover component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BudgetRollover from '../BudgetRollover';
import { formatCurrency as formatCurrencyDecimal } from '../../utils/currency-decimal';
import { toDecimal } from '../../utils/decimal';

const mockUpdateBudget = vi.fn(() => Promise.resolve());

// Budgets come from the real app context now — BudgetContext (a plaintext
// localStorage mirror that left this tab permanently empty) has been deleted.
const mockBudgets = [
  {
    id: 'budget-1',
    categoryId: 'cat-1',
    amount: 200,
    period: 'monthly' as const,
    isActive: true,
    spent: 0,
    createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
    updatedAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  },
  {
    id: 'budget-2',
    categoryId: 'cat-2',
    amount: 100,
    period: 'monthly' as const,
    isActive: true,
    spent: 0,
    createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
    updatedAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  },
  {
    id: 'budget-3',
    categoryId: 'cat-3',
    amount: 150,
    period: 'monthly' as const,
    isActive: true,
    spent: 0,
    createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
    updatedAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  }
];

// Mock dependencies
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    budgets: mockBudgets,
    updateBudget: mockUpdateBudget,
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
        amount: toDecimal(-150), // Expenses are stored signed (negative)
        category: 'cat-1',
        type: 'expense',
        description: 'Grocery shopping',
        accountId: 'acc-1',
        cleared: true
      },
      {
        id: 'trans-2',
        date: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 20), // Last month
        amount: toDecimal(-50), // Expenses are stored signed (negative)
        category: 'cat-2',
        type: 'expense',
        description: 'Gas',
        accountId: 'acc-1',
        cleared: true
      }
    ]
  })
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
}));

// Seeded per test so persisted-payload cases (including the legacy shape that
// used to crash this tab) can be reproduced.
const mockStorageSeed: Record<string, unknown> = {};

vi.mock('../../hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((key: string, defaultValue: unknown) => {
    const seeded = Object.prototype.hasOwnProperty.call(mockStorageSeed, key);
    const [value, setValue] = React.useState(seeded ? mockStorageSeed[key] : defaultValue);
    return [value, setValue];
  })
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: any) => formatCurrencyDecimal(value, 'USD')
  })
}));

const openSettingsModal = async () => {
  const [settingsButton] = screen.getAllByRole('button', { name: /Settings/i });
  await userEvent.click(settingsButton);
  const heading = await screen.findByText('Rollover Settings');
  return heading.closest('div') as HTMLElement;
};

const toggleEnableRollover = async (modal: HTMLElement) => {
  const [enableCheckbox] = within(modal).getAllByRole('checkbox');
  await userEvent.click(enableCheckbox);
  return enableCheckbox;
};

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

const periodsFor = (offsetFromCurrentMonth: number) => {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth() + offsetFromCurrentMonth, 1);
  const from = new Date(to.getFullYear(), to.getMonth() - 1, 1);
  return {
    fromPeriod: { month: from.getMonth(), year: from.getFullYear() },
    toPeriod: { month: to.getMonth(), year: to.getFullYear() }
  };
};

describe('BudgetRollover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorageSeed).forEach(key => delete mockStorageSeed[key]);
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

      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
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
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
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
      
      const modal = await openSettingsModal();
      
      expect(screen.getByText('Rollover Settings')).toBeInTheDocument();
      expect(within(modal).getAllByRole('checkbox')[0]).toBeInTheDocument();
    });

    it('allows enabling/disabling rollover', async () => {
      render(<BudgetRollover />);
      
      const modal = await openSettingsModal();
      
      const enableCheckbox = within(modal).getAllByRole('checkbox')[0];
      expect(enableCheckbox).not.toBeChecked();
      
      await userEvent.click(enableCheckbox);
      expect(enableCheckbox).toBeChecked();
    });

    it('allows selecting rollover mode', async () => {
      render(<BudgetRollover />);
      
      const modal = await openSettingsModal();
      
      const modeSelect = within(modal).getByRole('combobox');
      expect(modeSelect).toHaveValue('all');
      
      await userEvent.selectOptions(modeSelect, 'percentage');
      expect(modeSelect).toHaveValue('percentage');
      
      // Should show percentage input
      expect(within(modal).getByDisplayValue('100')).toBeInTheDocument();
    });

    it('allows setting maximum rollover amount', async () => {
      render(<BudgetRollover />);
      
      const modal = await openSettingsModal();
      
      const maxAmountInput = within(modal).getByLabelText('Maximum Rollover Amount (Optional)');
      await userEvent.type(maxAmountInput, '500');

      expect(maxAmountInput).toHaveValue('500');

      // Money fields group their thousands once the caret leaves.
      await userEvent.clear(maxAmountInput);
      await userEvent.type(maxAmountInput, '1000000');
      await userEvent.tab();

      expect(maxAmountInput).toHaveValue('1,000,000.00');
    });

    it('allows excluding categories', async () => {
      render(<BudgetRollover />);
      
      const modal = await openSettingsModal();
      
      const foodCheckbox = within(modal).getByRole('checkbox', { name: 'Food' });
      await userEvent.click(foodCheckbox);
      
      expect(foodCheckbox).toBeChecked();
    });

    it('allows enabling auto-apply', async () => {
      render(<BudgetRollover />);
      
      const modal = await openSettingsModal();
      
      const autoApplyCheckbox = within(modal).getAllByRole('checkbox')[1];
      await userEvent.click(autoApplyCheckbox);
      
      expect(autoApplyCheckbox).toBeChecked();
    });

    it('allows carrying negative balances', async () => {
      render(<BudgetRollover />);
      
      const modal = await openSettingsModal();
      
      const carryNegativeCheckbox = within(modal).getAllByRole('checkbox')[2];
      await userEvent.click(carryNegativeCheckbox);
      
      expect(carryNegativeCheckbox).toBeChecked();
    });
  });

  describe('preview modal', () => {
    it('shows preview when clicking preview button', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover first
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
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
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
      
      // Open preview
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Preview Rollover/i })).not.toBeDisabled();
      });
      await userEvent.click(screen.getByRole('button', { name: /Preview Rollover/i }));
      
      // Should show categories with rollover amounts
      expect(screen.getByText(/will be carried into your/)).toBeInTheDocument();
    });

    it('allows applying rollover from preview', async () => {
      render(<BudgetRollover />);
      
      // Enable and preview
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
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

    it('carries the surplus in rolloverAmount and never mutates the planned amount', async () => {
      render(<BudgetRollover />);

      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Preview Rollover/i })).not.toBeDisabled();
      });
      await userEvent.click(screen.getByRole('button', { name: /Preview Rollover/i }));
      await userEvent.click(screen.getByRole('button', { name: /Apply Rollover/i }));

      await waitFor(() => {
        expect(mockUpdateBudget).toHaveBeenCalledWith('budget-1', { rollover: true, rolloverAmount: 50 });
      });
      expect(mockUpdateBudget).toHaveBeenCalledWith('budget-2', { rollover: true, rolloverAmount: 50 });
      expect(mockUpdateBudget).toHaveBeenCalledWith('budget-3', { rollover: true, rolloverAmount: 150 });

      // The plan the user typed is never touched by automation.
      mockUpdateBudget.mock.calls.forEach(([, updates]) => {
        expect(updates).not.toHaveProperty('amount');
      });
    });

    it('refuses to apply the same period twice', async () => {
      mockStorageSeed['rollover-history'] = [
        {
          id: 'history-1',
          ...periodsFor(0),
          rollovers: [],
          totalRolledOver: 250,
          appliedAt: new Date().toISOString()
        }
      ];

      render(<BudgetRollover />);

      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
      await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

      await waitFor(() => {
        expect(screen.getByText(/has already been rolled into/)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Preview Rollover/i })).toBeDisabled();
      expect(mockUpdateBudget).not.toHaveBeenCalled();
    });
  });

  describe('calculations', () => {
    it('calculates correct remaining amounts', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
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
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
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

    it('renders persisted history after a JSON round trip', () => {
      const entry = {
        id: 'history-1',
        ...periodsFor(-1),
        rollovers: [
          {
            budgetId: 'budget-1',
            categoryId: 'cat-1',
            categoryName: 'Food',
            originalBudget: 200,
            spent: 150,
            remaining: 50,
            rolledOver: 50
          }
        ],
        totalRolledOver: 50,
        appliedAt: new Date(2026, 6, 2).toISOString()
      };
      // Exactly what comes back out of localStorage.
      mockStorageSeed['rollover-history'] = JSON.parse(JSON.stringify([entry]));

      render(<BudgetRollover />);

      expect(screen.getByText('Rollover History')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText(/1 categories/)).toBeInTheDocument();
    });

    it('recovers legacy entries that stored Decimal instances instead of crashing', () => {
      // The pre-fix build persisted Decimals and Dates straight through
      // JSON.stringify. decimal.js serialises to a STRING, so
      // `entry.totalRolledOver.greaterThan(0)` threw and this tab crashed on
      // every subsequent load. The figures survived, only their type was lost.
      const legacyEntry = {
        id: 'legacy-1',
        ...periodsFor(-1),
        rollovers: [
          {
            budgetId: 'budget-1',
            categoryId: 'cat-1',
            categoryName: 'Food',
            originalBudget: toDecimal(200),
            spent: toDecimal(150),
            remaining: toDecimal(50),
            rolledOver: toDecimal(50)
          }
        ],
        totalRolledOver: toDecimal(50),
        appliedAt: new Date(2026, 6, 2)
      };
      const persisted = JSON.parse(JSON.stringify([legacyEntry]));
      expect(typeof persisted[0].totalRolledOver).toBe('string');
      mockStorageSeed['rollover-history'] = persisted;

      expect(() => render(<BudgetRollover />)).not.toThrow();

      expect(screen.getByText('Rollover History')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('discards entries that cannot be read back into trustworthy figures', () => {
      mockStorageSeed['rollover-history'] = [
        { id: 'corrupt-1', ...periodsFor(-1), rollovers: [], totalRolledOver: {}, appliedAt: 'not-a-date' },
        'nonsense'
      ];

      expect(() => render(<BudgetRollover />)).not.toThrow();

      expect(screen.getByText('Budget Rollover')).toBeInTheDocument();
      expect(screen.queryByText('Rollover History')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles percentage mode correctly', async () => {
      render(<BudgetRollover />);
      
      // Enable rollover with percentage mode
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
      
      const modeSelect = within(modal).getByRole('combobox');
      await userEvent.selectOptions(modeSelect, 'percentage');
      
      const percentageInput = within(modal).getByDisplayValue('100');
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
      const modal = await openSettingsModal();
      await toggleEnableRollover(modal);
      
      const foodCheckbox = within(modal).getByRole('checkbox', { name: 'Food' });
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
      await openSettingsModal();
      expect(screen.getByText('Rollover Settings')).toBeInTheDocument();
      
      // Cancel
      await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.queryByText('Rollover Settings')).not.toBeInTheDocument();
    });
  });
});
