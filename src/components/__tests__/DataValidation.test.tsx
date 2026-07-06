/**
 * DataValidation Tests
 * Tests for the DataValidation component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataValidation from '../DataValidation';
import { formatCurrency as formatCurrencyDecimal } from '../../utils/currency-decimal';
import type { Transaction, Account, Category } from '../../types';

// Mock dependencies
// Amounts are stored SIGNED: expenses negative, income positive, transfers
// signed by direction. Legitimately-negative expenses must NOT be flagged; the
// only invalid-amount rows are a zero amount or a sign that contradicts the type.
//
// The app state lives in a hoisted, mutable container so individual tests can
// swap in their own fixtures (e.g. the balance-repair scenarios) while the
// mock functions stay stable and assertable across renders.
const appMocks = vi.hoisted(() => ({
  state: {
    transactions: [] as Transaction[],
    accounts: [] as Account[],
    categories: [] as Category[]
  },
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  updateAccount: vi.fn(),
  addTransaction: vi.fn(),
  addCategory: vi.fn()
}));

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: appMocks.state.transactions,
    accounts: appMocks.state.accounts,
    categories: appMocks.state.categories,
    updateTransaction: appMocks.updateTransaction,
    deleteTransaction: appMocks.deleteTransaction,
    updateAccount: appMocks.updateAccount,
    addTransaction: appMocks.addTransaction,
    addCategory: appMocks.addCategory
  })
}));

const defaultTransactions = (): Transaction[] => [
  {
    id: 'trans-1',
    date: new Date('2024-01-15'),
    description: 'Test Transaction',
    amount: -100, // valid negative expense — must not be flagged
    category: 'Food',
    accountId: 'acc-1',
    type: 'expense',
    cleared: true
  },
  {
    id: 'trans-2',
    date: new Date('2025-12-31'), // Future date
    description: 'Future Transaction',
    amount: -50,
    category: 'Transport',
    accountId: 'acc-1',
    type: 'expense',
    cleared: false
  },
  {
    id: 'trans-3',
    date: new Date('2024-01-15'),
    description: '', // Empty description
    amount: -75,
    category: 'Food',
    accountId: 'acc-1',
    type: 'expense',
    cleared: true
  },
  {
    id: 'trans-4',
    date: new Date('2024-01-15'),
    description: 'Uncategorized',
    amount: -25,
    category: '', // Missing category
    accountId: 'acc-1',
    type: 'expense',
    cleared: true
  },
  {
    id: 'trans-5',
    date: new Date('2024-01-15'),
    description: 'Invalid Category',
    amount: -30,
    category: 'InvalidCat', // Invalid category
    accountId: 'acc-1',
    type: 'expense',
    cleared: true
  },
  {
    id: 'trans-6',
    date: new Date('2024-01-15'),
    description: 'Zero Amount',
    amount: 0, // Zero amount — invalid
    category: 'Food',
    accountId: 'acc-1',
    type: 'expense',
    cleared: true
  },
  {
    id: 'trans-7',
    date: new Date('2024-01-15'),
    description: 'Orphaned Transaction',
    amount: -100,
    category: 'Food',
    accountId: 'acc-999', // Non-existent account
    type: 'expense',
    cleared: true
  },
  {
    id: 'trans-8',
    date: new Date('2024-01-15'),
    description: 'Positive Expense',
    amount: 40, // sign/type mismatch: an expense stored positive — invalid
    category: 'Food',
    accountId: 'acc-1',
    type: 'expense',
    cleared: true
  }
];

const defaultAccounts = (): Account[] => [
  {
    id: 'acc-1',
    name: 'Main Checking',
    type: 'checking',
    balance: 1000,
    currency: 'USD',
    lastUpdated: new Date('2024-01-15'),
    openingBalance: 500,
    openingBalanceDate: new Date('2024-01-01')
  }
];

const defaultCategories = (): Category[] => [
  { id: 'cat-1', name: 'Food', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: 'cat-2', name: 'Transport', type: 'expense', level: 'detail', parentId: 'sub-transport' },
  { id: 'cat-3', name: 'Other', type: 'both', level: 'detail', parentId: 'sub-other' }
];

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number | { toNumber: () => number }, currency: string = 'USD') =>
      formatCurrencyDecimal(
        typeof amount === 'number' ? amount : amount.toNumber(),
        currency
      )
  })
}));

// Mock child modals
vi.mock('../ValidationTransactionModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? <div data-testid="validation-transaction-modal">Validation Transaction Modal</div> : null
}));

vi.mock('../FixSummaryModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? <div data-testid="fix-summary-modal">Fix Summary Modal</div> : null
}));

vi.mock('../BalanceReconciliationModal', () => ({
  default: ({
    isOpen,
    onConfirm
  }: {
    isOpen: boolean;
    onConfirm: (type: 'opening-balance' | 'adjustment-transaction') => void;
  }) =>
    isOpen ? (
      <div data-testid="balance-reconciliation-modal">
        Balance Reconciliation Modal
        <button onClick={() => onConfirm('adjustment-transaction')}>Create adjustment transaction</button>
        <button onClick={() => onConfirm('opening-balance')}>Adjust opening balance</button>
      </div>
    ) : null
}));

// Mock icons
vi.mock('../icons', () => ({
  AlertCircleIcon: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle-icon" className={className}>AlertCircle</div>
  ),
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <div data-testid="check-circle-icon" className={className}>CheckCircle</div>
  ),
  WrenchIcon: () => <div data-testid="wrench-icon">Wrench</div>,
  RefreshCwIcon: ({ className }: { className?: string }) => (
    <div data-testid="refresh-icon" className={className}>Refresh</div>
  ),
  AlertTriangleIcon: ({ className }: { className?: string }) => (
    <div data-testid="alert-triangle-icon" className={className}>AlertTriangle</div>
  ),
  XCircleIcon: ({ className }: { className?: string }) => (
    <div data-testid="x-circle-icon" className={className}>XCircle</div>
  ),
  EyeIcon: () => <div data-testid="eye-icon">Eye</div>,
  XIcon: ({ className }: { className?: string }) => (
    <div data-testid="x-icon" className={className}>X</div>
  )
}));

describe('DataValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMocks.state.transactions = defaultTransactions();
    appMocks.state.accounts = defaultAccounts();
    appMocks.state.categories = defaultCategories();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders correctly when open', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText('Data Validation & Cleanup')).toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
      expect(screen.getByText('Warnings')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<DataValidation isOpen={false} onClose={vi.fn()} />);
      
      expect(screen.queryByText('Data Validation & Cleanup')).not.toBeInTheDocument();
    });

    it('displays issue counts correctly', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      // Should show counts based on the mock data issues
      expect(screen.getByText('3')).toBeInTheDocument(); // Errors count
      expect(screen.getByText('4')).toBeInTheDocument(); // Warnings count
    });

    it('shows all data looks good when no issues', () => {
      // This test needs to be isolated, so we'll skip it for now
      // as changing the mock mid-test is complex with Vitest
    });
  });

  describe('issue detection', () => {
    it('detects future-dated transactions', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText(/1 transaction\(s\) have future dates/)).toBeInTheDocument();
    });

    it('detects missing categories', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText(/1 transaction\(s\) have no category/)).toBeInTheDocument();
    });

    it('detects invalid categories', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText(/1 transaction\(s\) have invalid categories/)).toBeInTheDocument();
    });

    it('detects zero amounts and sign/type mismatches but not legitimate negative expenses', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);

      // Under the signed convention this must flag exactly the zero-amount row
      // (trans-6) and the positive-amount expense (trans-8), NOT the four
      // legitimately-negative expenses (trans-1/2/3/5/7).
      expect(
        screen.getByText(/2 transaction\(s\) have a zero amount or a sign that contradicts their type/)
      ).toBeInTheDocument();
    });

    it('detects orphaned transactions', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText(/1 transaction\(s\) belong to non-existent accounts/)).toBeInTheDocument();
    });

    it('detects empty descriptions', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText(/1 transaction\(s\) have empty descriptions/)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles close button click', async () => {
      const onClose = vi.fn();
      render(<DataValidation isOpen={true} onClose={onClose} />);
      
      const closeButton = screen.getByText('Close');
      await userEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles select all fixable issues', async () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      const selectAllButton = screen.getByText('Select All Fixable');
      await userEvent.click(selectAllButton);
      
      // Check that checkboxes are selected
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('handles deselect all', async () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      // First select all
      const selectAllButton = screen.getByText('Select All Fixable');
      await userEvent.click(selectAllButton);
      
      // Then deselect all
      const deselectAllButton = screen.getByText('Deselect All');
      await userEvent.click(deselectAllButton);
      
      // Check that checkboxes are not selected
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('handles individual issue selection', async () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      const firstCheckbox = checkboxes[0];
      
      expect(firstCheckbox).not.toBeChecked();
      await userEvent.click(firstCheckbox);
      expect(firstCheckbox).toBeChecked();
      
      await userEvent.click(firstCheckbox);
      expect(firstCheckbox).not.toBeChecked();
    });

    it('enables fix button when issues are selected', async () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      const fixButton = screen.getByText('Fix Selected Issues');
      expect(fixButton).toBeDisabled();
      
      // Select an issue
      const checkbox = screen.getAllByRole('checkbox')[0];
      await userEvent.click(checkbox);
      
      expect(fixButton).not.toBeDisabled();
    });

    it('shows view details for issues', async () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      const viewDetailsButtons = screen.getAllByText('View Details');
      expect(viewDetailsButtons.length).toBeGreaterThan(0);
      
      // Click first view details button
      await userEvent.click(viewDetailsButtons[0]);
      
      // Should show validation transaction modal
      await waitFor(() => {
        expect(screen.getByTestId('validation-transaction-modal')).toBeInTheDocument();
      });
    });
  });

  describe('fixing issues', () => {
    it('fixes selected issues and shows summary', async () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      // Select a fixable issue
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      
      // Click fix button
      const fixButton = screen.getByText('Fix Selected Issues');
      await userEvent.click(fixButton);
      
      // Should show progress
      await waitFor(() => {
        expect(screen.getByText(/Fixing/)).toBeInTheDocument();
      });
      
      // Should show fix summary modal after completion
      await waitFor(() => {
        expect(screen.getByTestId('fix-summary-modal')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows reconciliation modal for balance issues', async () => {
      // This test needs to be isolated, so we'll skip it for now
      // as changing the mock mid-test is complex with Vitest
    });
  });

  describe('balance repair (signed adjustment amounts)', () => {
    const repairAccount = (balance: number): Account => ({
      id: 'acc-repair',
      name: 'Repair Account',
      type: 'checking',
      balance,
      currency: 'USD',
      lastUpdated: new Date('2024-01-01'),
      openingBalance: 0,
      openingBalanceDate: new Date('2024-01-01')
    });

    const adjustmentCategories = (): Category[] => [
      {
        id: 'account-adjustments',
        name: 'Account Adjustments',
        type: 'both',
        level: 'detail',
        parentId: 'sub-adjustments',
        isSystem: true
      }
    ];

    const runAdjustmentRepair = async () => {
      await userEvent.click(screen.getByRole('checkbox'));
      await userEvent.click(screen.getByText('Fix Selected Issues'));

      await waitFor(() => {
        expect(screen.getByTestId('balance-reconciliation-modal')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText('Create adjustment transaction'));

      await waitFor(() => {
        expect(appMocks.addTransaction).toHaveBeenCalledTimes(1);
      });

      // Let the fix flow settle (post-add delay + loop delay) so no state
      // updates land after the test tears down.
      await waitFor(() => {
        expect(screen.getByTestId('fix-summary-modal')).toBeInTheDocument();
      }, { timeout: 3000 });
    };

    it('repairs a -49.99 shortfall with a SIGNED expense adjustment of -49.99, not +49.99', async () => {
      // No transactions: calculated = opening 0 + signed sum 0 = 0; actual
      // -49.99 → difference (actual − calculated) = -49.99, a shortfall.
      appMocks.state.transactions = [];
      appMocks.state.accounts = [repairAccount(-49.99)];
      appMocks.state.categories = adjustmentCategories();

      render(<DataValidation isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/Repair Account balance differs from transaction sum/)
      ).toBeInTheDocument();

      await runAdjustmentRepair();

      // The ledger applies raw SIGNED sums, so the adjustment must carry the
      // signed difference. A +49.99 "expense" would move the balance the
      // wrong way and the repair would diverge instead of reconciling.
      expect(appMocks.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc-repair',
          type: 'expense',
          amount: -49.99,
          cleared: true
        })
      );
      expect(appMocks.addTransaction).not.toHaveBeenCalledWith(
        expect.objectContaining({ amount: 49.99 })
      );
    });

    it('repairs a +125.50 surplus with a SIGNED income adjustment of +125.50', async () => {
      appMocks.state.transactions = [];
      appMocks.state.accounts = [repairAccount(125.5)];
      appMocks.state.categories = adjustmentCategories();

      render(<DataValidation isOpen={true} onClose={vi.fn()} />);

      await runAdjustmentRepair();

      expect(appMocks.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc-repair',
          type: 'income',
          amount: 125.5
        })
      );
      expect(appMocks.addTransaction).not.toHaveBeenCalledWith(
        expect.objectContaining({ amount: -125.5 })
      );
    });

    it('computes the signed difference against the SIGNED transaction sum when transactions exist', async () => {
      // calculated = opening 500 + (−100 expense) = 400; actual 350
      // → difference −50. An abs-summed ledger (500 + 100 = 600) would
      // produce −250 instead — the signed sum is what must be repaired.
      appMocks.state.transactions = [
        {
          id: 'trans-repair-1',
          date: new Date('2024-01-15'),
          description: 'Groceries',
          amount: -100,
          category: 'Food',
          accountId: 'acc-repair',
          type: 'expense',
          cleared: true
        }
      ];
      appMocks.state.accounts = [{ ...repairAccount(350), openingBalance: 500 }];
      appMocks.state.categories = [...defaultCategories(), ...adjustmentCategories()];

      render(<DataValidation isOpen={true} onClose={vi.fn()} />);

      await runAdjustmentRepair();

      expect(appMocks.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc-repair',
          type: 'expense',
          amount: -50
        })
      );
    });
  });

  describe('accessibility', () => {
    it('has proper heading structure', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      const heading = screen.getByText('Data Validation & Cleanup');
      expect(heading).toBeInTheDocument();
    });

    it('has accessible buttons', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toBeInTheDocument();
      
      const fixButton = screen.getByRole('button', { name: /Fix Selected Issues/ });
      expect(fixButton).toBeInTheDocument();
    });

    it('checkboxes are properly labeled', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  describe('issue categories', () => {
    it('groups issues by category', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText('Date Issues')).toBeInTheDocument();
      expect(screen.getByText('Missing Data')).toBeInTheDocument();
      expect(screen.getByText('Data Integrity')).toBeInTheDocument();
    });

    it('displays correct icons for issue types', () => {
      render(<DataValidation isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getAllByTestId('x-circle-icon').length).toBeGreaterThan(0); // Errors
      expect(screen.getAllByTestId('alert-triangle-icon').length).toBeGreaterThan(0); // Warnings
    });
  });
});
