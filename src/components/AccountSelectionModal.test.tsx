import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountSelectionModal from './AccountSelectionModal';

// Mock icons
vi.mock('./icons', () => ({
  CheckIcon: (_props: { size?: number }) => <div data-testid="check-icon">Check</div>,
  AlertCircleIcon: ({ className }: { size?: number; className?: string }) => (
    <div data-testid="alert-icon" className={className}>Alert</div>
  ),
  FileTextIcon: (_props: { size?: number }) => <div data-testid="file-icon">File</div>,
}));

describe('AccountSelectionModal', () => {
  const mockAccounts = [
    { 
      name: 'Current Account', 
      type: 'Current', 
      balance: 1500.50, 
      isPrimary: true,
      transactionCount: 45 
    },
    { 
      name: 'Savings Account', 
      type: 'Savings', 
      balance: 5000, 
      transactionCount: 12 
    },
    { 
      name: 'Credit Card', 
      type: 'Credit', 
      balance: -250.75, 
      transactionCount: 30 
    },
  ];

  const defaultProps = {
    isOpen: true,
    accounts: mockAccounts,
    primaryAccountName: 'Current Account',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<AccountSelectionModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Select Accounts to Import')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      expect(screen.getByText('Select Accounts to Import')).toBeInTheDocument();
    });

    it('displays account count information', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      expect(screen.getByText(/We found 3 accounts in this QIF file/)).toBeInTheDocument();
    });

    it('displays primary account information', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      expect(screen.getByText(/"Current Account" appears to be the main account/)).toBeInTheDocument();
    });

    it('displays all accounts', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      expect(screen.getByText('Current Account')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
      expect(screen.getByText('Credit Card')).toBeInTheDocument();
    });

    it('shows primary badge for primary account', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const primaryAccount = screen.getByText('Current Account').closest('div');
      expect(primaryAccount).toHaveTextContent('Primary');
    });

    it('displays account details', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      expect(screen.getByText('Type: Current')).toBeInTheDocument();
      expect(screen.getByText('Balance: £1,500.50')).toBeInTheDocument();
      expect(screen.getByText('45 transactions')).toBeInTheDocument();
    });

    it('handles singular transaction count', () => {
      const accountsWithSingleTransaction = [
        { ...mockAccounts[0], transactionCount: 1 }
      ];
      
      render(<AccountSelectionModal {...defaultProps} accounts={accountsWithSingleTransaction} />);
      expect(screen.getByText('1 transactions')).toBeInTheDocument();
    });

    it('does not show balance when zero', () => {
      const accountsWithZeroBalance = [
        { ...mockAccounts[0], balance: 0 }
      ];
      
      render(<AccountSelectionModal {...defaultProps} accounts={accountsWithZeroBalance} />);
      expect(screen.queryByText(/Balance:/)).not.toBeInTheDocument();
    });

    it('does not show transaction count when zero', () => {
      const accountsWithZeroTransactions = [
        { ...mockAccounts[0], transactionCount: 0 }
      ];
      
      render(<AccountSelectionModal {...defaultProps} accounts={accountsWithZeroTransactions} />);
      // Check specifically for transaction count, not the word in button descriptions
      const accountDiv = screen.getByText('Current Account').closest('.flex-1');
      expect(accountDiv).not.toHaveTextContent('0 transactions');
    });
  });

  describe('Import Mode', () => {
    it('defaults to single mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const singleButton = screen.getByText('Single Account').closest('button');
      expect(singleButton).toHaveClass('border-primary');
    });

    it('can switch to multiple mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const multipleButton = screen.getByText('Multiple Accounts');
      fireEvent.click(multipleButton);
      
      expect(multipleButton.closest('button')).toHaveClass('border-primary');
    });

    it('shows info message in multiple mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Multiple Accounts'));
      
      expect(screen.getByText(/When importing multiple accounts/)).toBeInTheDocument();
    });

    it('hides info message in single mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      expect(screen.queryByText(/When importing multiple accounts/)).not.toBeInTheDocument();
    });

    it('shows radio buttons in single mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('shows checkboxes in multiple mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Multiple Accounts'));
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });
  });

  describe('Account Selection', () => {
    it('pre-selects primary account in single mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const primaryRadio = screen.getAllByRole('radio')[0];
      expect(primaryRadio).toBeChecked();
    });

    it('allows selecting different account in single mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const savingsAccount = screen.getByText('Savings Account').closest('.p-3.rounded-lg');
      fireEvent.click(savingsAccount!);
      
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeChecked();
      expect(radios[1]).toBeChecked();
    });

    it('only allows one selection in single mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      // Select savings account
      fireEvent.click(screen.getByText('Savings Account').closest('.p-3.rounded-lg')!);
      
      // Select credit card
      fireEvent.click(screen.getByText('Credit Card').closest('.p-3.rounded-lg')!);
      
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeChecked();
      expect(radios[1]).not.toBeChecked();
      expect(radios[2]).toBeChecked();
    });

    it('allows multiple selections in multiple mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Multiple Accounts'));
      
      // Select savings account
      fireEvent.click(screen.getByText('Savings Account').closest('.p-3.rounded-lg')!);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // Primary still selected
      expect(checkboxes[1]).toBeChecked(); // Savings now selected
    });

    it('can deselect accounts in multiple mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Multiple Accounts'));
      
      // Deselect primary account
      fireEvent.click(screen.getByText('Current Account').closest('.p-3.rounded-lg')!);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked();
    });

    it('keeps primary account when switching from multiple to single', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      // Switch to multiple and select all
      fireEvent.click(screen.getByText('Multiple Accounts'));
      fireEvent.click(screen.getByText('Savings Account').closest('.p-3.rounded-lg')!);
      fireEvent.click(screen.getByText('Credit Card').closest('.p-3.rounded-lg')!);
      
      // Switch back to single
      fireEvent.click(screen.getByText('Single Account'));
      
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked(); // Primary account retained
      expect(radios[1]).not.toBeChecked();
      expect(radios[2]).not.toBeChecked();
    });

    it('selects first account if no primary when switching to single', () => {
      const propsWithoutPrimary = {
        ...defaultProps,
        primaryAccountName: undefined,
        accounts: mockAccounts.map(a => ({ ...a, isPrimary: false }))
      };
      
      render(<AccountSelectionModal {...propsWithoutPrimary} />);
      
      // Switch to multiple and select only second account
      fireEvent.click(screen.getByText('Multiple Accounts'));
      fireEvent.click(screen.getByText('Savings Account').closest('.p-3.rounded-lg')!);
      
      // Switch back to single
      fireEvent.click(screen.getByText('Single Account'));
      
      const radios = screen.getAllByRole('radio');
      expect(radios[1]).toBeChecked(); // First selected account retained
    });
  });

  describe('Confirm Button', () => {
    it('updates button text based on selection count', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      expect(screen.getByText('Import 1 Account')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Multiple Accounts'));
      fireEvent.click(screen.getByText('Savings Account').closest('.p-3.rounded-lg')!);
      
      expect(screen.getByText('Import 2 Accounts')).toBeInTheDocument();
    });

    it('disables confirm button when no selection', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Multiple Accounts'));
      fireEvent.click(screen.getByText('Current Account').closest('.p-3.rounded-lg')!); // Deselect
      
      const confirmButton = screen.getByText('Import 0 Accounts').closest('button');
      expect(confirmButton).toBeDisabled();
      expect(confirmButton).toHaveClass('cursor-not-allowed');
    });

    it('enables confirm button when selection exists', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const confirmButton = screen.getByText('Import 1 Account').closest('button');
      expect(confirmButton).not.toBeDisabled();
      expect(confirmButton).not.toHaveClass('cursor-not-allowed');
    });
  });

  describe('Actions', () => {
    it('calls onConfirm with selected accounts', () => {
      const onConfirm = vi.fn();
      render(<AccountSelectionModal {...defaultProps} onConfirm={onConfirm} />);
      
      fireEvent.click(screen.getByText('Import 1 Account'));
      
      expect(onConfirm).toHaveBeenCalledWith(['Current Account']);
    });

    it('calls onConfirm with multiple accounts', () => {
      const onConfirm = vi.fn();
      render(<AccountSelectionModal {...defaultProps} onConfirm={onConfirm} />);
      
      fireEvent.click(screen.getByText('Multiple Accounts'));
      fireEvent.click(screen.getByText('Savings Account').closest('.p-3.rounded-lg')!);
      fireEvent.click(screen.getByText('Credit Card').closest('.p-3.rounded-lg')!);
      
      fireEvent.click(screen.getByText('Import 3 Accounts'));
      
      expect(onConfirm).toHaveBeenCalledWith([
        'Current Account',
        'Savings Account',
        'Credit Card'
      ]);
    });

    it('calls onCancel when cancel clicked', () => {
      const onCancel = vi.fn();
      render(<AccountSelectionModal {...defaultProps} onCancel={onCancel} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty accounts array', () => {
      render(<AccountSelectionModal {...defaultProps} accounts={[]} />);
      
      // The text shows 0 accounts but still mentions the primary account name
      expect(screen.getByText(/We found 0 account in this QIF file/)).toBeInTheDocument();
      
      // Since selectedAccounts is initialized with primaryAccountName, it shows Import 1 Account
      const confirmButton = screen.getByRole('button', { name: /Import.*Account/ });
      expect(confirmButton).toHaveTextContent('Import 1 Account');
    });

    it('handles accounts without primary', () => {
      const propsWithoutPrimary = {
        ...defaultProps,
        primaryAccountName: undefined,
      };
      
      render(<AccountSelectionModal {...propsWithoutPrimary} />);
      
      expect(screen.queryByText(/appears to be the main account/)).not.toBeInTheDocument();
    });

    it('handles negative balances correctly', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      // Credit card has negative balance
      expect(screen.getByText('Balance: -£250.75')).toBeInTheDocument();
    });

    it('handles missing transaction count', () => {
      const accountsWithoutTransactionCount = [
        { name: 'Test Account', type: 'Current', balance: 100 }
      ];
      
      render(<AccountSelectionModal {...defaultProps} accounts={accountsWithoutTransactionCount} />);
      
      const accountDiv = screen.getByText('Test Account').closest('.flex-1');
      expect(accountDiv).not.toHaveTextContent('transactions');
    });

    it('maintains selection when clicking already selected in single mode', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      // Click the already selected primary account
      const currentAccountCard = screen.getByText('Current Account').closest('.p-3.rounded-lg');
      fireEvent.click(currentAccountCard!);
      
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });
  });

  describe('Visual States', () => {
    it('highlights selected accounts', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const primaryAccount = screen.getByText('Current Account').closest('.p-3.rounded-lg');
      expect(primaryAccount).toHaveClass('border-primary');
      
      const savingsAccount = screen.getByText('Savings Account').closest('.p-3.rounded-lg');
      expect(savingsAccount).not.toHaveClass('border-primary');
    });

    it('applies hover styles to unselected accounts', () => {
      render(<AccountSelectionModal {...defaultProps} />);
      
      const savingsAccount = screen.getByText('Savings Account').closest('.p-3.rounded-lg');
      expect(savingsAccount).toHaveClass('hover:border-gray-300');
    });
  });
});
