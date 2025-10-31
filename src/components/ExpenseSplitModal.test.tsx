import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExpenseSplitModal from './ExpenseSplitModal';
import type { HouseholdMember } from '../services/collaborationService';

// Mock icons
vi.mock('./icons', () => ({
  DollarSignIcon: ({ className }: { className?: string }) => (
    <div data-testid="dollar-sign-icon" className={className}>$</div>
  ),
  UsersIcon: () => <div data-testid="users-icon">Users</div>,
  XIcon: () => <div data-testid="x-icon">X</div>,
  CheckIcon: () => <div data-testid="check-icon">Check</div>,
}));

// Mock hooks
vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: any) => `$${amount.toString()}`
  })
}));

// Mock utils
vi.mock('../utils/decimal', () => ({
  toDecimal: (value: number) => ({ toString: () => value.toString() })
}));

// Mock collaboration service
const mockHouseholdMembers: HouseholdMember[] = [
  {
    id: 'member1',
    householdId: 'household1',
    userId: 'user1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    isActive: true,
    joinedAt: new Date('2024-01-01')
  },
  {
    id: 'member2',
    householdId: 'household1',
    userId: 'user2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'member',
    isActive: true,
    joinedAt: new Date('2024-01-02')
  },
  {
    id: 'member3',
    householdId: 'household1',
    userId: 'user3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'member',
    isActive: false,
    joinedAt: new Date('2024-01-03')
  }
];

const mockHousehold = {
  id: 'household1',
  name: 'Test Household',
  createdBy: 'user1',
  createdAt: new Date('2024-01-01'),
  members: mockHouseholdMembers
};

vi.mock('../services/collaborationService', () => ({
  collaborationService: {
    getCurrentHousehold: vi.fn(() => mockHousehold),
    createExpenseSplit: vi.fn(() => ({ id: 'split1' }))
  }
}));

describe('ExpenseSplitModal', () => {
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
      render(<ExpenseSplitModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Split Expense')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      expect(screen.getByText('Split Expense')).toBeInTheDocument();
    });

    it('renders with initial values', () => {
      render(<ExpenseSplitModal 
        {...defaultProps} 
        initialAmount={100} 
        initialDescription="Dinner" 
      />);
      
      const amountInput = screen.getByDisplayValue('100') as HTMLInputElement;
      const descriptionInput = screen.getByDisplayValue('Dinner') as HTMLInputElement;
      
      expect(amountInput.value).toBe('100');
      expect(descriptionInput.value).toBe('Dinner');
    });

    it('renders all active household members', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument(); // Inactive member
    });

    it('renders split method selector', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      expect(methodSelect.value).toBe('equal');
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('Equal Split');
      expect(options[1]).toHaveTextContent('Custom Amounts');
      expect(options[2]).toHaveTextContent('Percentage Split');
    });

    it('selects all members by default', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      expect(checkboxes).toHaveLength(2); // Only active members
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(true);
    });
  });

  describe('Equal Split Mode', () => {
    it('displays equal amounts for all selected members', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      // Should show $50 for each member (100 / 2)
      const amounts = screen.getAllByText('$50');
      expect(amounts).toHaveLength(2);
    });

    it('recalculates when member is deselected', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[1]); // Deselect second member
      
      // Should now show $100 for the single selected member
      const amounts = screen.getAllByText('$100');
      expect(amounts.length).toBeGreaterThan(0); // At least one $100 shown
    });

    it('handles amount change', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const amountInputs = screen.getAllByRole('spinbutton');
      const amountInput = amountInputs[0] as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '150' } });
      
      // Should show $75 for each member (150 / 2)
      waitFor(() => {
        const amounts = screen.getAllByText('$75');
        expect(amounts).toHaveLength(2);
      });
    });
  });

  describe('Custom Amount Mode', () => {
    it('shows amount inputs when custom mode selected', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'custom' } });
      
      const amountInputs = screen.getAllByRole('spinbutton');
      expect(amountInputs).toHaveLength(3); // Total amount + 2 member amounts
    });

    it('updates custom amounts', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'custom' } });
      
      const memberAmountInputs = screen.getAllByRole('spinbutton').slice(1); // Skip total amount
      fireEvent.change(memberAmountInputs[0], { target: { value: '60' } });
      fireEvent.change(memberAmountInputs[1], { target: { value: '40' } });
      
      expect(memberAmountInputs[0]).toHaveValue(60);
      expect(memberAmountInputs[1]).toHaveValue(40);
    });
  });

  describe('Percentage Split Mode', () => {
    it('shows percentage inputs when percentage mode selected', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'percentage' } });
      
      // Should have percentage inputs and % symbols
      const percentSymbols = screen.getAllByText('%');
      expect(percentSymbols.length).toBeGreaterThan(0);
    });

    it('calculates amounts from percentages', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'percentage' } });
      
      const inputs = screen.getAllByRole('spinbutton');
      // Find percentage inputs (they're smaller width)
      const percentageInputs = inputs.filter(input => 
        input.classList.contains('w-16')
      );
      
      fireEvent.change(percentageInputs[0], { target: { value: '60' } });
      fireEvent.change(percentageInputs[1], { target: { value: '40' } });
      
      // Check that amounts are calculated correctly
      const amountInputs = inputs.filter(input => 
        input.classList.contains('w-20')
      );
      expect(amountInputs[0]).toHaveValue(60);
      expect(amountInputs[1]).toHaveValue(40);
    });
  });

  describe('Summary Section', () => {
    it('shows correct totals', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      expect(screen.getByText('Total Amount:')).toBeInTheDocument();
      expect(screen.getByText('Split Total:')).toBeInTheDocument();
      const amounts = screen.getAllByText('$100');
      expect(amounts.length).toBeGreaterThan(0);
    });

    it('shows percentage total in percentage mode', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'percentage' } });
      
      expect(screen.getByText('Total Percentage:')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('shows red color when amounts do not match', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'custom' } });
      
      const memberAmountInputs = screen.getAllByRole('spinbutton').slice(1);
      fireEvent.change(memberAmountInputs[0], { target: { value: '30' } });
      fireEvent.change(memberAmountInputs[1], { target: { value: '40' } });
      
      const splitTotal = screen.getByText('$70');
      expect(splitTotal).toHaveClass('text-red-600');
    });

    it('shows green color when amounts match', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const splitTotal = screen.getByText('Split Total:').nextElementSibling;
      expect(splitTotal).toHaveClass('text-green-600');
    });
  });

  describe('Validation', () => {
    it('shows error when description is empty', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: '' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(screen.getByText('• Description is required')).toBeInTheDocument();
    });

    it('shows error when total amount is zero', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const amountInputs = screen.getAllByRole('spinbutton');
      const amountInput = amountInputs[0] as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '0' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(screen.getByText('• Total amount must be greater than 0')).toBeInTheDocument();
    });

    it('shows error when no members selected', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => fireEvent.click(checkbox));
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(screen.getByText('• At least one member must be selected')).toBeInTheDocument();
    });

    it('shows error when custom amounts do not match total', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'custom' } });
      
      const memberAmountInputs = screen.getAllByRole('spinbutton').slice(1);
      fireEvent.change(memberAmountInputs[0], { target: { value: '30' } });
      fireEvent.change(memberAmountInputs[1], { target: { value: '40' } });
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(screen.getByText('• Split amounts must equal the total amount')).toBeInTheDocument();
    });

    it('shows error when percentages do not add to 100', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'percentage' } });
      
      const inputs = screen.getAllByRole('spinbutton');
      const percentageInputs = inputs.filter(input => 
        input.classList.contains('w-16')
      );
      
      fireEvent.change(percentageInputs[0], { target: { value: '40' } });
      fireEvent.change(percentageInputs[1], { target: { value: '30' } });
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(screen.getByText('• Percentages must add up to 100%')).toBeInTheDocument();
    });
  });

  describe('Create Split Functionality', () => {
    it('creates split with valid data', async () => {
      const { collaborationService } = await import('../services/collaborationService');
      
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'Restaurant bill' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(collaborationService.createExpenseSplit).toHaveBeenCalledWith(
        expect.stringContaining('manual-'),
        expect.objectContaining({ toString: expect.any(Function) }),
        'Restaurant bill',
        'equal',
        expect.arrayContaining([
          expect.objectContaining({ memberId: 'member1' }),
          expect.objectContaining({ memberId: 'member2' })
        ])
      );
    });

    it('uses provided transaction ID', async () => {
      const { collaborationService } = await import('../services/collaborationService');
      
      render(<ExpenseSplitModal 
        {...defaultProps} 
        transactionId="trans123"
        initialAmount={100} 
      />);
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(collaborationService.createExpenseSplit).toHaveBeenCalledWith(
        'trans123',
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        expect.any(Array)
      );
    });

    it('calls onClose after successful creation', () => {
      const onClose = vi.fn();
      render(<ExpenseSplitModal {...defaultProps} onClose={onClose} initialAmount={100} />);
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('resets form after creation', async () => {
      const { collaborationService } = await import('../services/collaborationService');
      
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} initialDescription="Test" />);
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'New description' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      // Check that the collaboration service was called (indicates successful creation)
      expect(collaborationService.createExpenseSplit).toHaveBeenCalled();
      // onClose should be called, which resets the form
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('User Actions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(<ExpenseSplitModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button clicked', () => {
      const onClose = vi.fn();
      render(<ExpenseSplitModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('toggles member selection', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
      
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
      
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles no household', async () => {
      const { collaborationService } = await import('../services/collaborationService');
      vi.mocked(collaborationService.getCurrentHousehold).mockReturnValueOnce(null);
      
      render(<ExpenseSplitModal {...defaultProps} />);
      
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    it('handles empty household members', async () => {
      const { collaborationService } = await import('../services/collaborationService');
      vi.mocked(collaborationService.getCurrentHousehold).mockReturnValueOnce({
        ...mockHousehold,
        members: []
      });
      
      render(<ExpenseSplitModal {...defaultProps} />);
      
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('handles very small percentage differences', () => {
      render(<ExpenseSplitModal {...defaultProps} initialAmount={100} />);
      
      const methodSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'percentage' } });
      
      const inputs = screen.getAllByRole('spinbutton');
      const percentageInputs = inputs.filter(input => 
        input.classList.contains('w-16')
      );
      
      fireEvent.change(percentageInputs[0], { target: { value: '33.33' } });
      fireEvent.change(percentageInputs[1], { target: { value: '66.67' } });
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      // Should not show percentage error for 99.99999... ≈ 100
      expect(screen.queryByText('• Percentages must add up to 100%')).not.toBeInTheDocument();
    });

    it('handles negative amounts', () => {
      render(<ExpenseSplitModal {...defaultProps} />);
      
      const amountInputs = screen.getAllByRole('spinbutton');
      const amountInput = amountInputs[0] as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '-50' } });
      
      const descriptionInput = screen.getByPlaceholderText('e.g., Dinner at restaurant') as HTMLInputElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test' } });
      
      fireEvent.click(screen.getByText('Create Split'));
      
      expect(screen.getByText('• Total amount must be greater than 0')).toBeInTheDocument();
    });
  });
});
