import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BalanceReconciliationModal from './BalanceReconciliationModal';
import type { ReconciliationOption } from './BalanceReconciliationModal';

// Mock Modal component
vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close modal">Close</button>
        {children}
      </div>
    ) : null,
}));

// Mock icons
vi.mock('./icons', () => ({
  AlertCircleIcon: ({ size, className }: any) => <div data-testid="alert-icon" className={className}>Alert</div>,
  ArrowRightIcon: ({ size, className }: any) => <div data-testid="arrow-icon" className={className}>→</div>,
  CalendarIcon: ({ size, className }: any) => <div data-testid="calendar-icon" className={className}>Calendar</div>,
  PlusCircleIcon: ({ size, className }: any) => <div data-testid="plus-icon" className={className}>Plus</div>,
  BanknoteIcon: ({ size, className }: any) => <div data-testid="banknote-icon" className={className}>Banknote</div>,
}));

// Mock useCurrencyDecimal hook
vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
    parseCurrencyInput: (value: string) => parseFloat(value.replace(/[^0-9.-]/g, '')),
  })
}));

describe('BalanceReconciliationModal', () => {
  const mockOption: ReconciliationOption = {
    type: 'opening-balance',
    accountId: 'acc1',
    accountName: 'Checking Account',
    currentBalance: 1500,
    calculatedBalance: 1000,
    difference: 500
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    option: mockOption,
    onConfirm: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('renders nothing when option is null', () => {
      render(<BalanceReconciliationModal {...defaultProps} option={null} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when open with option', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Balance Reconciliation Options')).toBeInTheDocument();
    });

    it('displays balance mismatch summary', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Balance Mismatch Detected')).toBeInTheDocument();
      expect(screen.getByText(/Checking Account shows a balance of \$1500.00/)).toBeInTheDocument();
      expect(screen.getByText(/but your transactions sum to \$1000.00/)).toBeInTheDocument();
      expect(screen.getByText(/The difference is \$500.00/)).toBeInTheDocument();
    });

    it('displays both reconciliation options', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Adjust Opening Balance')).toBeInTheDocument();
      expect(screen.getByText('Create Adjustment Transaction')).toBeInTheDocument();
    });

    it('shows opening balance option details', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText(/Use this if the account had a balance before your first imported transaction/)).toBeInTheDocument();
      expect(screen.getByText('Opening Balance')).toBeInTheDocument();
      // There are multiple $500.00 values, check the one in opening balance section
      const openingBalanceSection = screen.getByText('Adjust Opening Balance').closest('.flex-1');
      expect(openingBalanceSection).toHaveTextContent('$500.00');
    });

    it('shows adjustment transaction option details', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText(/Use this if there's a missing transaction or an error in your records/)).toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Account Adjustments')).toBeInTheDocument();
    });
  });

  describe('Negative Difference', () => {
    it('shows expense transaction for negative difference', () => {
      const negativeOption = {
        ...mockOption,
        currentBalance: 1000,
        calculatedBalance: 1500,
        difference: -500
      };
      
      render(<BalanceReconciliationModal {...defaultProps} option={negativeOption} />);
      
      expect(screen.getByText('Expense')).toBeInTheDocument();
      // Multiple $500.00 values exist, verify it's in the adjustment transaction section
      const adjustmentSection = screen.getByText('Create Adjustment Transaction').closest('.flex-1');
      expect(adjustmentSection).toHaveTextContent('$500.00');
    });

    it('shows income transaction for positive difference', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Income')).toBeInTheDocument();
      // Multiple $500.00 values exist, verify it's in the adjustment transaction section
      const adjustmentSection = screen.getByText('Create Adjustment Transaction').closest('.flex-1');
      expect(adjustmentSection).toHaveTextContent('$500.00');
    });
  });

  describe('Option Selection', () => {
    it('no option is selected initially', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const radioButtons = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radioButtons[0].checked).toBe(false);
      expect(radioButtons[1].checked).toBe(false);
    });

    it('selects opening balance option', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const openingBalanceRadio = screen.getAllByRole('radio')[0]; // First radio is opening balance
      fireEvent.click(openingBalanceRadio);
      
      expect(openingBalanceRadio).toBeChecked();
    });

    it('selects adjustment transaction option', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const adjustmentRadio = screen.getAllByRole('radio')[1]; // Second radio is adjustment transaction
      fireEvent.click(adjustmentRadio);
      
      expect(adjustmentRadio).toBeChecked();
    });

    it('can switch between options', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const radioButtons = screen.getAllByRole('radio');
      const openingBalanceRadio = radioButtons[0];
      const adjustmentRadio = radioButtons[1];
      
      // Select first option
      fireEvent.click(openingBalanceRadio);
      expect(openingBalanceRadio).toBeChecked();
      expect(adjustmentRadio).not.toBeChecked();
      
      // Switch to second option
      fireEvent.click(adjustmentRadio);
      expect(openingBalanceRadio).not.toBeChecked();
      expect(adjustmentRadio).toBeChecked();
    });

    it('highlights selected option with blue background', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      // Find the parent container that has the border classes
      const openingBalanceRadio = screen.getAllByRole('radio')[0];
      const openingBalanceOption = openingBalanceRadio.closest('.border-2');
      
      // Check initial state
      expect(openingBalanceOption).toHaveClass('border-gray-200');
      
      // Select option
      fireEvent.click(openingBalanceRadio);
      
      // Check selected state
      expect(openingBalanceOption).toHaveClass('border-blue-500', 'bg-blue-50');
    });
  });

  describe('Button Actions', () => {
    it('apply button is disabled when no option selected', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const applyButton = screen.getByText('Apply Selected Fix');
      expect(applyButton).toBeDisabled();
    });

    it('apply button is enabled when option is selected', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const openingBalanceRadio = screen.getAllByRole('radio')[0];
      fireEvent.click(openingBalanceRadio);
      
      const applyButton = screen.getByText('Apply Selected Fix');
      expect(applyButton).not.toBeDisabled();
    });

    it('calls onConfirm with opening-balance when applied', () => {
      const onConfirm = vi.fn();
      render(<BalanceReconciliationModal {...defaultProps} onConfirm={onConfirm} />);
      
      const openingBalanceRadio = screen.getAllByRole('radio')[0];
      fireEvent.click(openingBalanceRadio);
      
      const applyButton = screen.getByText('Apply Selected Fix');
      fireEvent.click(applyButton);
      
      expect(onConfirm).toHaveBeenCalledWith('opening-balance');
    });

    it('calls onConfirm with adjustment-transaction when applied', () => {
      const onConfirm = vi.fn();
      render(<BalanceReconciliationModal {...defaultProps} onConfirm={onConfirm} />);
      
      const adjustmentRadio = screen.getAllByRole('radio')[1];
      fireEvent.click(adjustmentRadio);
      
      const applyButton = screen.getByText('Apply Selected Fix');
      fireEvent.click(applyButton);
      
      expect(onConfirm).toHaveBeenCalledWith('adjustment-transaction');
    });

    it('does not call onConfirm when no option selected', () => {
      const onConfirm = vi.fn();
      render(<BalanceReconciliationModal {...defaultProps} onConfirm={onConfirm} />);
      
      const applyButton = screen.getByText('Apply Selected Fix');
      fireEvent.click(applyButton);
      
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('calls onClose when cancel clicked', () => {
      const onClose = vi.fn();
      render(<BalanceReconciliationModal {...defaultProps} onClose={onClose} />);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<BalanceReconciliationModal {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Visual Elements', () => {
    it('displays alert icon in warning section', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    });

    it('displays correct icons for each option', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByTestId('banknote-icon')).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('displays transaction details icons', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-icon')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero difference correctly', () => {
      const zeroOption = {
        ...mockOption,
        currentBalance: 1000,
        calculatedBalance: 1000,
        difference: 0
      };
      
      render(<BalanceReconciliationModal {...defaultProps} option={zeroOption} />);
      
      // Check that the difference text shows $0.00
      expect(screen.getByText(/The difference is \$0.00/)).toBeInTheDocument();
    });

    it('handles very large differences', () => {
      const largeOption = {
        ...mockOption,
        currentBalance: 1000000,
        calculatedBalance: 0,
        difference: 1000000
      };
      
      render(<BalanceReconciliationModal {...defaultProps} option={largeOption} />);
      
      // Check that the large difference is displayed correctly
      expect(screen.getByText(/The difference is \$1000000.00/)).toBeInTheDocument();
    });

    it('handles long account names', () => {
      const longNameOption = {
        ...mockOption,
        accountName: 'Very Long Account Name That Might Cause Layout Issues'
      };
      
      render(<BalanceReconciliationModal {...defaultProps} option={longNameOption} />);
      
      expect(screen.getByText(/Very Long Account Name That Might Cause Layout Issues/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Balance Reconciliation Options');
    });

    it('radio buttons have proper grouping', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const radioButtons = screen.getAllByRole('radio');
      radioButtons.forEach(radio => {
        expect(radio).toHaveAttribute('name', 'reconciliation');
      });
    });

    it('labels are clickable to select options', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      // Click on the label text
      const labelText = screen.getByText('Adjust Opening Balance');
      fireEvent.click(labelText);
      
      // Radio should be selected
      const openingBalanceRadio = screen.getAllByRole('radio')[0];
      expect(openingBalanceRadio).toBeChecked();
    });
  });
});