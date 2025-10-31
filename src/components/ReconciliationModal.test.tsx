import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ReconciliationModal from './ReconciliationModal';
import type { Transaction } from '../types';

// Mock icons
vi.mock('./icons', () => ({
  XIcon: () => <div data-testid="x-icon">X</div>,
  ArrowRightIcon: ({ className }: { className?: string }) => (
    <div data-testid="arrow-right-icon" className={className}>
      →
    </div>
  ),
  CheckIcon: () => <div data-testid="check-icon">✓</div>,
  AlertCircleIcon: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle-icon" className={className}>
      !
    </div>
  ),
}));

// Mock useApp hook
const mockUpdateTransaction = vi.fn();
const mockTransactions: Transaction[] = [
  {
    id: 't1',
    date: new Date('2024-01-15'),
    amount: 100,
    description: 'Salary Payment',
    type: 'income',
    category: 'salary',
    accountId: 'acc1'
  },
  {
    id: 't2',
    date: new Date('2024-01-15'),
    amount: 100,
    description: 'Transfer In',
    type: 'income',
    category: 'transfer',
    accountId: 'acc2'
  },
  {
    id: 't3',
    date: new Date('2024-01-16'),
    amount: 50,
    description: 'Grocery Shopping',
    type: 'expense',
    category: 'food',
    accountId: 'acc1'
  },
  {
    id: 't4',
    date: new Date('2024-01-16'),
    amount: 50,
    description: 'Store Purchase',
    type: 'expense',
    category: 'food',
    accountId: 'acc2'
  },
  {
    id: 't5',
    date: new Date('2024-01-17'),
    amount: 25,
    description: 'Already Reconciled',
    type: 'expense',
    category: 'misc',
    accountId: 'acc1',
    reconciledWith: 't6'
  }
];

const mockAccounts = [
  { id: 'acc1', name: 'Current Account', type: 'checking' as const, balance: 1000 },
  { id: 'acc2', name: 'Savings Account', type: 'savings' as const, balance: 2000 },
  { id: 'acc3', name: 'Credit Card', type: 'credit' as const, balance: -500 }
];

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    transactions: mockTransactions,
    accounts: mockAccounts,
    updateTransaction: mockUpdateTransaction
  })
}));

describe('ReconciliationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<ReconciliationModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Review Transfer Match')).not.toBeInTheDocument();
      expect(screen.queryByText('Manual Reconciliation')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<ReconciliationModal {...defaultProps} />);
      expect(screen.getByText('Manual Reconciliation')).toBeInTheDocument();
    });

    it('renders match review title when match provided', () => {
      const match = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 85,
        reason: 'Amount and date match',
        matchType: 'exact' as const
      };

      render(<ReconciliationModal {...defaultProps} match={match} />);
      expect(screen.getByText('Review Transfer Match')).toBeInTheDocument();
    });

    it('renders manual reconciliation title when no match', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      expect(screen.getByText('Manual Reconciliation')).toBeInTheDocument();
    });
  });

  describe('Match Review Mode', () => {
    const match = {
      outTransaction: mockTransactions[0],
      inTransaction: mockTransactions[1],
      confidence: 85,
      reason: 'Amount and date match',
      matchType: 'exact' as const
    };

    it('displays matched transactions', () => {
      render(<ReconciliationModal {...defaultProps} match={match} />);
      
      expect(screen.getByText('Salary Payment')).toBeInTheDocument();
      expect(screen.getByText('Transfer In')).toBeInTheDocument();
      expect(screen.getByText('Current Account')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
    });

    it('displays confidence score', () => {
      render(<ReconciliationModal {...defaultProps} match={match} />);
      
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText(/confidence score/)).toBeInTheDocument();
    });

    it('displays exact match message', () => {
      const exactMatch = { ...match, matchType: 'exact' as const };
      render(<ReconciliationModal {...defaultProps} match={exactMatch} />);
      
      expect(screen.getByText((content, element) => 
        content.includes('descriptions match exactly')
      )).toBeInTheDocument();
    });

    it('displays fuzzy match message', () => {
      const fuzzyMatch = { ...match, matchType: 'fuzzy' as const };
      render(<ReconciliationModal {...defaultProps} match={fuzzyMatch} />);
      
      expect(screen.getByText((content, element) => 
        content.includes('descriptions are similar')
      )).toBeInTheDocument();
    });

    it('displays amount-only match message', () => {
      const amountMatch = { ...match, matchType: 'amount-only' as const };
      render(<ReconciliationModal {...defaultProps} match={amountMatch} />);
      
      expect(screen.getByText((content, element) => 
        content.includes('Only the amounts match')
      )).toBeInTheDocument();
    });

    it('enables reconcile button with match', () => {
      render(<ReconciliationModal {...defaultProps} match={match} />);
      
      const reconcileButton = screen.getByText('Reconcile Transactions');
      expect(reconcileButton).not.toBeDisabled();
    });

    it('does not show manual selection section', () => {
      render(<ReconciliationModal {...defaultProps} match={match} />);
      
      expect(screen.queryByText('Select Matching Transaction')).not.toBeInTheDocument();
    });
  });

  describe('Manual Reconciliation Mode', () => {
    it('shows manual selection section', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByText('Select Matching Transaction')).toBeInTheDocument();
    });

    it('displays search input', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument();
    });

    it('displays account filter', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByText('All Accounts')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
      expect(screen.getByText('Credit Card')).toBeInTheDocument();
    });

    it('filters transactions by search term', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      fireEvent.change(searchInput, { target: { value: 'Store' } });
      
      expect(screen.getByText('Store Purchase')).toBeInTheDocument();
      expect(screen.queryByText('Transfer In')).not.toBeInTheDocument();
    });

    it('filters transactions by account', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      const accountFilter = screen.getByRole('combobox');
      fireEvent.change(accountFilter, { target: { value: 'acc2' } });
      
      // mockTransactions[0] is income from acc1, so we should see expense transactions from acc2
      expect(screen.getByText('Store Purchase')).toBeInTheDocument(); // expense from acc2
      expect(screen.queryByText('Grocery Shopping')).not.toBeInTheDocument(); // expense from acc1, filtered out
    });

    it('shows opposite type transactions only', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[2]} />);
      
      // Expense transaction should only show income transactions
      // mockTransactions[2] is expense, so should show income types
      expect(screen.getByText('Transfer In')).toBeInTheDocument(); // income from acc2
      expect(screen.queryByText('Store Purchase')).not.toBeInTheDocument(); // expense, should not show
    });

    it('excludes already reconciled transactions', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.queryByText('Already Reconciled')).not.toBeInTheDocument();
    });

    it('excludes the current transaction', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      // Should not show the transaction being reconciled
      const salaryItems = screen.queryAllByText('Salary Payment');
      expect(salaryItems).toHaveLength(1); // Only in the source section
    });

    it('shows no transactions message when filtered list is empty', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      expect(screen.getByText('No matching transactions found')).toBeInTheDocument();
    });
  });

  describe('Transaction Selection', () => {
    it('selects transaction when clicked', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      // mockTransactions[0] is income, should show expense transactions
      const transactionRow = screen.getByText('Store Purchase').closest('tr');
      fireEvent.click(transactionRow!);
      
      const radioButton = screen.getByRole('radio', { checked: true });
      expect(radioButton).toBeInTheDocument();
    });

    it('selects transaction when radio button clicked', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      const radioButtons = screen.getAllByRole('radio');
      fireEvent.click(radioButtons[0]);
      
      expect(radioButtons[0]).toBeChecked();
    });

    it('updates selected transaction in target section', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      const transactionRow = screen.getByText('Store Purchase').closest('tr');
      fireEvent.click(transactionRow!);
      
      // Should appear in target section
      const targetSections = screen.getAllByText('Store Purchase');
      expect(targetSections.length).toBeGreaterThan(1);
    });

    it('enables reconcile button when transaction selected', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      const reconcileButton = screen.getByText('Reconcile Transactions');
      expect(reconcileButton).toBeDisabled();
      
      const transactionRow = screen.getByText('Store Purchase').closest('tr');
      fireEvent.click(transactionRow!);
      
      expect(reconcileButton).not.toBeDisabled();
    });
  });

  describe('Transaction Details Display', () => {
    it('displays source transaction details', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByText('Salary Payment')).toBeInTheDocument();
      expect(screen.getByText('Current Account')).toBeInTheDocument();
      expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
      expect(screen.getByText('+£100.00')).toBeInTheDocument();
    });

    it('displays expense amounts with minus sign', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[2]} />);
      
      expect(screen.getByText('-£50.00')).toBeInTheDocument();
    });

    it('displays income amounts with plus sign', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByText('+£100.00')).toBeInTheDocument();
    });

    it('shows placeholder when no target selected', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByText('Select a matching transaction below')).toBeInTheDocument();
    });

    it('formats dates correctly', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
    });

    it('formats currency correctly', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      expect(screen.getByText('+£100.00')).toBeInTheDocument();
    });

    it('handles unknown account gracefully', () => {
      const transactionWithUnknownAccount = {
        ...mockTransactions[0],
        accountId: 'unknown'
      };
      
      render(<ReconciliationModal {...defaultProps} transaction={transactionWithUnknownAccount} />);
      
      expect(screen.getByText('Unknown Account')).toBeInTheDocument();
    });
  });

  describe('Notes Section', () => {
    it('renders notes textarea', () => {
      render(<ReconciliationModal {...defaultProps} />);
      
      expect(screen.getByPlaceholderText('Add any notes about this reconciliation...')).toBeInTheDocument();
    });

    it('updates notes value', () => {
      render(<ReconciliationModal {...defaultProps} />);
      
      const notesInput = screen.getByPlaceholderText('Add any notes about this reconciliation...') as HTMLTextAreaElement;
      fireEvent.change(notesInput, { target: { value: 'Test reconciliation notes' } });
      
      expect(notesInput.value).toBe('Test reconciliation notes');
    });
  });

  describe('Reconciliation Functionality', () => {
    it('reconciles matched transactions', () => {
      const match = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 85,
        reason: 'Amount and date match',
        matchType: 'exact' as const
      };

      render(<ReconciliationModal {...defaultProps} match={match} />);
      
      const notesInput = screen.getByPlaceholderText('Add any notes about this reconciliation...');
      fireEvent.change(notesInput, { target: { value: 'Transfer reconciliation' } });
      
      fireEvent.click(screen.getByText('Reconcile Transactions'));
      
      expect(mockUpdateTransaction).toHaveBeenCalledTimes(2);
      expect(mockUpdateTransaction).toHaveBeenCalledWith('t1', {
        reconciledWith: 't2',
        reconciledDate: expect.any(Date),
        reconciledNotes: 'Transfer reconciliation'
      });
      expect(mockUpdateTransaction).toHaveBeenCalledWith('t2', {
        reconciledWith: 't1',
        reconciledDate: expect.any(Date),
        reconciledNotes: 'Transfer reconciliation'
      });
    });

    it('reconciles manually selected transactions', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      // Select a transaction
      const transactionRow = screen.getByText('Store Purchase').closest('tr');
      fireEvent.click(transactionRow!);
      
      const notesInput = screen.getByPlaceholderText('Add any notes about this reconciliation...');
      fireEvent.change(notesInput, { target: { value: 'Manual reconciliation' } });
      
      fireEvent.click(screen.getByText('Reconcile Transactions'));
      
      expect(mockUpdateTransaction).toHaveBeenCalledTimes(2);
      expect(mockUpdateTransaction).toHaveBeenCalledWith('t1', {
        reconciledWith: 't4',
        reconciledDate: expect.any(Date),
        reconciledNotes: 'Manual reconciliation'
      });
      expect(mockUpdateTransaction).toHaveBeenCalledWith('t4', {
        reconciledWith: 't1',
        reconciledDate: expect.any(Date),
        reconciledNotes: 'Manual reconciliation'
      });
    });

    it('reconciles with empty notes', () => {
      const match = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 85,
        reason: 'Amount and date match',
        matchType: 'exact' as const
      };

      render(<ReconciliationModal {...defaultProps} match={match} />);
      
      fireEvent.click(screen.getByText('Reconcile Transactions'));
      
      expect(mockUpdateTransaction).toHaveBeenCalledWith('t1', expect.objectContaining({
        reconciledNotes: ''
      }));
    });

    it('calls onClose after successful reconciliation', () => {
      const onClose = vi.fn();
      const match = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 85,
        reason: 'Amount and date match',
        matchType: 'exact' as const
      };

      render(<ReconciliationModal {...defaultProps} match={match} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Reconcile Transactions'));
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('User Actions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(<ReconciliationModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button clicked', () => {
      const onClose = vi.fn();
      render(<ReconciliationModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('disables reconcile button when no selection', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      const reconcileButton = screen.getByText('Reconcile Transactions');
      expect(reconcileButton).toBeDisabled();
      expect(reconcileButton).toHaveClass('cursor-not-allowed');
    });

    it('shows proper button styling when enabled', () => {
      const match = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 85,
        reason: 'Amount and date match',
        matchType: 'exact' as const
      };

      render(<ReconciliationModal {...defaultProps} match={match} />);
      
      const reconcileButton = screen.getByText('Reconcile Transactions');
      expect(reconcileButton).not.toBeDisabled();
      expect(reconcileButton).toHaveClass('bg-primary');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty transactions array', () => {
      render(<ReconciliationModal {...defaultProps} transaction={mockTransactions[0]} />);
      
      // Filter out all matching transactions by setting an impossible search
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      fireEvent.change(searchInput, { target: { value: 'no-matches-possible-123456789' } });
      
      expect(screen.getByText('No matching transactions found')).toBeInTheDocument();
    });

    it('handles empty accounts array', () => {
      const transactionWithUnknownAccount = {
        ...mockTransactions[0],
        accountId: 'unknown-account-id'
      };
      
      render(<ReconciliationModal {...defaultProps} transaction={transactionWithUnknownAccount} />);
      
      expect(screen.getByText('Unknown Account')).toBeInTheDocument();
    });

    it('handles pre-selected transaction from match', () => {
      const match = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 85,
        reason: 'Amount and date match',
        matchType: 'exact' as const
      };

      render(<ReconciliationModal {...defaultProps} match={match} transaction={mockTransactions[0]} />);
      
      // Should pre-select the matched transaction
      expect(screen.getByText('Transfer In')).toBeInTheDocument();
      expect(screen.getByText('Salary Payment')).toBeInTheDocument();
    });

    it('handles invalid date objects', () => {
      const transactionWithInvalidDate = {
        ...mockTransactions[0],
        date: new Date('invalid')
      };
      
      render(<ReconciliationModal {...defaultProps} transaction={transactionWithInvalidDate} />);
      
      // Should not crash and show Invalid Date
      expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    });

    it('handles very long descriptions', () => {
      const longDescription = 'A'.repeat(100);
      const transactionWithLongDescription = {
        ...mockTransactions[0],
        description: longDescription
      };
      
      render(<ReconciliationModal {...defaultProps} transaction={transactionWithLongDescription} />);
      
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('handles zero amount transactions', () => {
      const zeroAmountTransaction = {
        ...mockTransactions[0],
        amount: 0
      };
      
      render(<ReconciliationModal {...defaultProps} transaction={zeroAmountTransaction} />);
      
      expect(screen.getByText('+£0.00')).toBeInTheDocument();
    });

    it('handles negative amounts correctly', () => {
      const negativeTransaction = {
        ...mockTransactions[0],
        amount: -50,
        type: 'expense' as const
      };
      
      render(<ReconciliationModal {...defaultProps} transaction={negativeTransaction} />);
      
      // Look for the negative amount text
      const amountElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('£50.00') || false;
      });
      expect(amountElements.length).toBeGreaterThan(0);
    });
  });

  describe('Match Types', () => {
    it('handles undefined match type', () => {
      const matchWithoutType = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 85,
        reason: 'Amount and date match'
      };

      render(<ReconciliationModal {...defaultProps} match={matchWithoutType} />);
      
      expect(screen.getByText('85%')).toBeInTheDocument();
      // Should not show any specific match type message
      expect(screen.queryByText((content, element) => 
        content.includes('descriptions match exactly')
      )).not.toBeInTheDocument();
      expect(screen.queryByText((content, element) => 
        content.includes('descriptions are similar')
      )).not.toBeInTheDocument();
      expect(screen.queryByText((content, element) => 
        content.includes('Only the amounts match')
      )).not.toBeInTheDocument();
    });

    it('displays confidence percentage correctly', () => {
      const highConfidenceMatch = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 95,
        reason: 'Perfect match',
        matchType: 'exact' as const
      };

      render(<ReconciliationModal {...defaultProps} match={highConfidenceMatch} />);
      
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('handles low confidence scores', () => {
      const lowConfidenceMatch = {
        outTransaction: mockTransactions[0],
        inTransaction: mockTransactions[1],
        confidence: 30,
        reason: 'Partial match',
        matchType: 'amount-only' as const
      };

      render(<ReconciliationModal {...defaultProps} match={lowConfidenceMatch} />);
      
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText((content, element) => 
        content.includes('Only the amounts match')
      )).toBeInTheDocument();
    });
  });
});
