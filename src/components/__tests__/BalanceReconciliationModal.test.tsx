/**
 * BalanceReconciliationModal Tests
 * Tests for the BalanceReconciliationModal component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BalanceReconciliationModal from '../BalanceReconciliationModal';
import type { ReconciliationOption } from '../BalanceReconciliationModal';

// Mock icons to avoid import issues
vi.mock('../icons', () => ({
  AlertCircleIcon: ({ className }: { className?: string }) => <div data-testid="alert-icon" className={className}>Alert</div>,
  ArrowRightIcon: ({ className }: { className?: string }) => <div data-testid="arrow-icon" className={className}>Arrow</div>,
  CalendarIcon: ({ className }: { className?: string }) => <div data-testid="calendar-icon" className={className}>Calendar</div>,
  PlusCircleIcon: ({ className }: { className?: string }) => <div data-testid="plus-icon" className={className}>Plus</div>,
  BanknoteIcon: ({ className }: { className?: string }) => <div data-testid="banknote-icon" className={className}>Banknote</div>,
}));

// Mock Modal component
vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
      <div role="dialog" aria-labelledby="modal-title">
        <h2 id="modal-title">{title}</h2>
        <button onClick={onClose} aria-label="Close modal">×</button>
        {children}
      </div>
    );
  },
}));

// Mock currency hook
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: number) => `£${value.toFixed(2)}`,
  }),
}));

describe('BalanceReconciliationModal', () => {
  const mockOption: ReconciliationOption = {
    type: 'opening-balance',
    accountId: 'acc-1',
    accountName: 'Main Checking',
    currentBalance: 1500,
    calculatedBalance: 1000,
    difference: 500,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    option: mockOption,
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to avoid test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('rendering', () => {
    it('renders correctly with reconciliation options', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Balance Reconciliation Options')).toBeInTheDocument();
      expect(screen.getByText(/Balance Mismatch Detected/)).toBeInTheDocument();
      expect(screen.getByText(/Main Checking shows a balance of £1500.00/)).toBeInTheDocument();
      expect(screen.getByText(/but your transactions sum to £1000.00/)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<BalanceReconciliationModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Balance Reconciliation Options')).not.toBeInTheDocument();
    });

    it('does not render when option is null', () => {
      render(<BalanceReconciliationModal {...defaultProps} option={null} />);
      
      expect(screen.queryByText('Balance Reconciliation Options')).not.toBeInTheDocument();
    });

    it('shows opening balance option', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Adjust Opening Balance')).toBeInTheDocument();
      expect(screen.getByText(/Use this if the account had a balance before your first imported transaction/)).toBeInTheDocument();
      
      // Check the specific £500.00 in the opening balance section
      const openingBalanceSection = screen.getByText('Opening Balance').closest('div');
      expect(openingBalanceSection).toHaveTextContent('£500.00');
    });

    it('shows adjustment transaction option', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Create Adjustment Transaction')).toBeInTheDocument();
      expect(screen.getByText(/Use this if there's a missing transaction/)).toBeInTheDocument();
      expect(screen.getByText('Income')).toBeInTheDocument(); // Positive difference
      expect(screen.getByText('Account Adjustments')).toBeInTheDocument();
    });

    it('shows expense type for negative difference', () => {
      const negativeOption: ReconciliationOption = {
        ...mockOption,
        currentBalance: 500,
        calculatedBalance: 1000,
        difference: -500,
      };
      
      render(<BalanceReconciliationModal {...defaultProps} option={negativeOption} />);
      
      expect(screen.getByText('Expense')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('selects opening balance option', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const openingBalanceRadio = screen.getByRole('radio', { name: /opening balance/i });
      await user.click(openingBalanceRadio);
      
      expect(openingBalanceRadio).toBeChecked();
    });

    it('selects adjustment transaction option', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const adjustmentRadio = screen.getByRole('radio', { name: /adjustment transaction/i });
      await user.click(adjustmentRadio);
      
      expect(adjustmentRadio).toBeChecked();
    });

    it('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      await user.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('apply button is disabled by default', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const applyButton = screen.getByText('Apply Selected Fix');
      expect(applyButton).toBeDisabled();
    });

    it('enables apply button when option is selected', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const applyButton = screen.getByText('Apply Selected Fix');
      expect(applyButton).toBeDisabled();
      
      const openingBalanceRadio = screen.getByRole('radio', { name: /opening balance/i });
      await user.click(openingBalanceRadio);
      
      expect(applyButton).toBeEnabled();
    });

    it('calls onConfirm with selected option', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      // Select opening balance option
      const openingBalanceRadio = screen.getByRole('radio', { name: /opening balance/i });
      await user.click(openingBalanceRadio);
      
      // Click apply
      const applyButton = screen.getByText('Apply Selected Fix');
      await user.click(applyButton);
      
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('opening-balance');
    });

    it('calls onConfirm with adjustment transaction', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      // Select adjustment transaction option
      const adjustmentRadio = screen.getByRole('radio', { name: /adjustment transaction/i });
      await user.click(adjustmentRadio);
      
      // Click apply
      const applyButton = screen.getByText('Apply Selected Fix');
      await user.click(applyButton);
      
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('adjustment-transaction');
    });

    it('switches between options', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const openingBalanceRadio = screen.getByRole('radio', { name: /opening balance/i });
      const adjustmentRadio = screen.getByRole('radio', { name: /adjustment transaction/i });
      
      // Select opening balance first
      await user.click(openingBalanceRadio);
      expect(openingBalanceRadio).toBeChecked();
      expect(adjustmentRadio).not.toBeChecked();
      
      // Switch to adjustment transaction
      await user.click(adjustmentRadio);
      expect(openingBalanceRadio).not.toBeChecked();
      expect(adjustmentRadio).toBeChecked();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('has accessible radio buttons', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      
      radios.forEach(radio => {
        expect(radio).toHaveAttribute('name', 'reconciliation');
      });
    });

    it('shows proper visual feedback for selected option', async () => {
      const user = userEvent.setup();
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      // Find the label container by looking for the radio button's parent
      const openingBalanceRadio = screen.getByRole('radio', { name: /opening balance/i });
      const labelContainer = openingBalanceRadio.closest('label')?.querySelector('div');
      
      // Initially should have default border
      expect(labelContainer).toHaveClass('border-gray-200');
      
      // After selection should have blue border
      await user.click(openingBalanceRadio);
      
      await waitFor(() => {
        const updatedContainer = openingBalanceRadio.closest('label')?.querySelector('div');
        expect(updatedContainer).toHaveClass('border-blue-500');
      });
    });
  });

  describe('formatting', () => {
    it('formats currency values correctly', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      // Check all currency values are formatted
      expect(screen.getByText(/£1500.00/)).toBeInTheDocument(); // Current balance
      expect(screen.getByText(/£1000.00/)).toBeInTheDocument(); // Calculated balance
      
      // There are multiple £500.00 on the page, check they exist
      const fiveHundredElements = screen.getAllByText('£500.00');
      expect(fiveHundredElements.length).toBeGreaterThan(0);
    });

    it('shows today for adjustment transaction date', () => {
      render(<BalanceReconciliationModal {...defaultProps} />);
      
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });
});
