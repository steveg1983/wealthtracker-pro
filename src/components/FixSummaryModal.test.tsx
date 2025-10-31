/**
 * FixSummaryModal Tests
 * Comprehensive tests for the fix summary modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FixSummaryModal, { type ChangeRecord } from './FixSummaryModal';

// Mock dependencies
vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children, title, onClose }: any) => (
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    ) : null
  ),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => {
      // Handle specific test cases
      if (amount === 1234.56) return '$1,235';
      if (amount === 5678.90) return '$5,679';
      if (amount === 1250.50) return '$1,251';
      return `$${Math.round(amount).toLocaleString()}`;
    },
  }),
}));

// Mock icons
vi.mock('./icons', () => ({
  CheckCircleIcon: ({ className, size }: any) => (
    <div data-testid="check-circle-icon" className={className} data-size={size}>✓</div>
  ),
  ArrowRightIcon: ({ size, className }: any) => (
    <div data-testid="arrow-right-icon" className={className} data-size={size}>→</div>
  ),
  UndoIcon: ({ size }: any) => (
    <div data-testid="undo-icon" data-size={size}>↶</div>
  ),
  CalendarIcon: ({ size, className }: any) => (
    <div data-testid="calendar-icon" className={className} data-size={size}>📅</div>
  ),
  TagIcon: ({ size, className }: any) => (
    <div data-testid="tag-icon" className={className} data-size={size}>🏷️</div>
  ),
  DollarSignIcon: ({ size, className }: any) => (
    <div data-testid="dollar-sign-icon" className={className} data-size={size}>💲</div>
  ),
  FileTextIcon: ({ size, className }: any) => (
    <div data-testid="file-text-icon" className={className} data-size={size}>📄</div>
  ),
  AlertTriangleIcon: ({ className, size }: any) => (
    <div data-testid="alert-triangle-icon" className={className} data-size={size}>⚠️</div>
  ),
  AlertCircleIcon: ({ size }: any) => (
    <div data-testid="alert-circle-icon" data-size={size}>ℹ️</div>
  ),
}));

describe('FixSummaryModal', () => {
  const mockOnClose = vi.fn();
  const mockOnUndo = vi.fn();
  const mockOnUndoAll = vi.fn();

  const createMockChange = (overrides: Partial<ChangeRecord> = {}): ChangeRecord => ({
    id: 'change-1',
    type: 'transaction',
    itemId: 'item-1',
    field: 'amount',
    oldValue: 100,
    newValue: 150,
    description: 'Fixed incorrect amount',
    issueType: 'amount_error',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true, changes: ChangeRecord[] = [createMockChange()]) => {
    return render(
      <FixSummaryModal
        isOpen={isOpen}
        onClose={mockOnClose}
        changes={changes}
        onUndo={mockOnUndo}
        onUndoAll={mockOnUndoAll}
      />
    );
  };

  describe('rendering', () => {
    it('renders when open', () => {
      renderModal(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Fix Summary - What We Changed');
    });

    it('does not render when closed', () => {
      renderModal(false);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('displays summary header with success message', () => {
      const changes = [createMockChange(), createMockChange({ id: 'change-2' })];
      renderModal(true, changes);
      
      expect(screen.getByText('Successfully Applied 2 Fixes')).toBeInTheDocument();
      expect(screen.getByText(/Review the changes below/)).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('handles singular vs plural fix count correctly', () => {
      renderModal(true, [createMockChange()]);
      expect(screen.getByText('Successfully Applied 1 Fix')).toBeInTheDocument();
      
      render(
        <FixSummaryModal
          isOpen={true}
          onClose={mockOnClose}
          changes={[createMockChange(), createMockChange({ id: 'change-2' })]}
          onUndo={mockOnUndo}
          onUndoAll={mockOnUndoAll}
        />
      );
      expect(screen.getByText('Successfully Applied 2 Fixes')).toBeInTheDocument();
    });

    it('shows undo all button when changes exist', () => {
      renderModal(true, [createMockChange()]);
      
      const undoAllButton = screen.getByRole('button', { name: /undo all changes/i });
      expect(undoAllButton).toBeInTheDocument();
      expect(screen.getAllByTestId('undo-icon')).toHaveLength(2); // One for undo all, one for individual change
    });

    it('does not show undo all button when no changes', () => {
      renderModal(true, []);
      
      expect(screen.queryByRole('button', { name: /undo all changes/i })).not.toBeInTheDocument();
    });

    it('displays close button', () => {
      renderModal();
      
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });

  describe('changes display', () => {
    it('displays individual change records', () => {
      const change = createMockChange({
        description: 'Fixed transaction amount',
        field: 'amount',
        oldValue: 100,
        newValue: 150,
      });
      renderModal(true, [change]);
      
      expect(screen.getByText('Fixed transaction amount')).toBeInTheDocument();
      expect(screen.getByText('$100')).toBeInTheDocument();
      expect(screen.getByText('$150')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-right-icon')).toBeInTheDocument();
    });

    it('groups changes by issue type', () => {
      const changes = [
        createMockChange({ id: 'c1', issueType: 'amount_error' }),
        createMockChange({ id: 'c2', issueType: 'amount_error' }),
        createMockChange({ id: 'c3', issueType: 'date_error' }),
      ];
      renderModal(true, changes);
      
      expect(screen.getByText('amount_error')).toBeInTheDocument();
      expect(screen.getByText('date_error')).toBeInTheDocument();
      expect(screen.getByText('(2 changes)')).toBeInTheDocument();
      expect(screen.getByText('(1 changes)')).toBeInTheDocument();
    });

    it('displays field icons correctly', () => {
      const changes = [
        createMockChange({ id: 'c1', field: 'date' }),
        createMockChange({ id: 'c2', field: 'category' }),
        createMockChange({ id: 'c3', field: 'amount' }),
        createMockChange({ id: 'c4', field: 'description' }),
      ];
      renderModal(true, changes);
      
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument();
      expect(screen.getByTestId('dollar-sign-icon')).toBeInTheDocument();
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
    });

    it('displays field labels correctly', () => {
      const changes = [
        createMockChange({ id: 'c1', field: 'date' }),
        createMockChange({ id: 'c2', field: 'category' }),
        createMockChange({ id: 'c3', field: 'balance' }),
        createMockChange({ id: 'c4', field: 'description' }),
        createMockChange({ id: 'c5', field: 'deleted' }),
      ];
      renderModal(true, changes);
      
      expect(screen.getByText('Transaction Date:')).toBeInTheDocument();
      expect(screen.getByText('Category:')).toBeInTheDocument();
      expect(screen.getByText('Account Balance:')).toBeInTheDocument();
      expect(screen.getByText('Description:')).toBeInTheDocument();
      expect(screen.getByText('Status:')).toBeInTheDocument();
    });

    it('shows account balance update message', () => {
      const change = createMockChange({
        type: 'account',
        field: 'balance',
        description: 'Updated account balance',
      });
      renderModal(true, [change]);
      
      expect(screen.getByText(/The account balance has been updated to match/)).toBeInTheDocument();
    });

    it('shows individual undo buttons for each change', () => {
      const changes = [
        createMockChange({ id: 'c1' }),
        createMockChange({ id: 'c2' }),
      ];
      renderModal(true, changes);
      
      const undoButtons = screen.getAllByRole('button', { name: /undo$/i });
      expect(undoButtons).toHaveLength(2);
    });
  });

  describe('value formatting', () => {
    it('formats currency values correctly', () => {
      const change = createMockChange({
        field: 'amount',
        oldValue: 1234.56,
        newValue: 5678.90,
      });
      renderModal(true, [change]);
      
      expect(screen.getByText('$1,235')).toBeInTheDocument();
      expect(screen.getByText('$5,679')).toBeInTheDocument();
    });

    it('formats date values correctly', () => {
      const oldDate = new Date('2023-01-15');
      const newDate = new Date('2023-02-20');
      const change = createMockChange({
        field: 'date',
        oldValue: oldDate,
        newValue: newDate,
      });
      renderModal(true, [change]);
      
      expect(screen.getByText(oldDate.toLocaleDateString())).toBeInTheDocument();
      expect(screen.getByText(newDate.toLocaleDateString())).toBeInTheDocument();
    });

    it('formats empty values correctly', () => {
      const changes = [
        createMockChange({ id: 'c1', oldValue: null }),
        createMockChange({ id: 'c2', oldValue: undefined }),
        createMockChange({ id: 'c3', oldValue: '' }),
      ];
      renderModal(true, changes);
      
      const emptyTexts = screen.getAllByText('(empty)');
      expect(emptyTexts).toHaveLength(3);
    });

    it('formats string values correctly', () => {
      const change = createMockChange({
        field: 'description',
        oldValue: 'Old description',
        newValue: 'New description',
      });
      renderModal(true, [change]);
      
      expect(screen.getByText('Old description')).toBeInTheDocument();
      expect(screen.getByText('New description')).toBeInTheDocument();
    });
  });

  describe('issue type colors', () => {
    it('applies error color for error issues', () => {
      const change = createMockChange({ issueType: 'critical_error' });
      renderModal(true, [change]);
      
      const issueTag = screen.getByText('critical_error');
      expect(issueTag).toHaveClass('text-red-600', 'bg-red-50');
    });

    it('applies warning color for warning issues', () => {
      const change = createMockChange({ issueType: 'data_warning' });
      renderModal(true, [change]);
      
      const issueTag = screen.getByText('data_warning');
      expect(issueTag).toHaveClass('text-yellow-600', 'bg-yellow-50');
    });

    it('applies default color for other issues', () => {
      const change = createMockChange({ issueType: 'minor_fix' });
      renderModal(true, [change]);
      
      const issueTag = screen.getByText('minor_fix');
      expect(issueTag).toHaveClass('text-blue-600', 'bg-blue-50');
    });
  });

  describe('empty state', () => {
    it('displays empty state when no changes', () => {
      renderModal(true, []);
      
      expect(screen.getByText('No changes to display')).toBeInTheDocument();
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });

    it('does not display changes list when empty', () => {
      renderModal(true, []);
      
      expect(screen.queryByText('Fixed incorrect amount')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when modal close button clicked', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const modalCloseButton = screen.getByTestId('modal-close');
      await user.click(modalCloseButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onUndoAll when undo all button clicked', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const undoAllButton = screen.getByRole('button', { name: /undo all changes/i });
      await user.click(undoAllButton);
      
      expect(mockOnUndoAll).toHaveBeenCalledTimes(1);
    });

    it('calls onUndo with correct change ID when individual undo clicked', async () => {
      const user = userEvent.setup();
      const changes = [
        createMockChange({ id: 'change-1' }),
        createMockChange({ id: 'change-2' }),
      ];
      renderModal(true, changes);
      
      const undoButtons = screen.getAllByRole('button', { name: /undo$/i });
      await user.click(undoButtons[0]);
      
      expect(mockOnUndo).toHaveBeenCalledTimes(1);
      expect(mockOnUndo).toHaveBeenCalledWith('change-1');
    });

    it('handles multiple undo clicks gracefully', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const undoButtons = screen.getAllByRole('button', { name: /undo$/i });
      await user.click(undoButtons[0]);
      await user.click(undoButtons[0]);
      
      expect(mockOnUndo).toHaveBeenCalledTimes(2);
    });
  });

  describe('styling and layout', () => {
    it('has proper modal structure', () => {
      renderModal();
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has proper success header styling', () => {
      renderModal();
      
      const successHeader = screen.getByText('Successfully Applied 1 Fix').closest('.bg-green-50');
      expect(successHeader).toHaveClass('bg-green-50', 'border', 'border-green-200', 'rounded-lg');
    });

    it('has proper change record styling', () => {
      renderModal();
      
      const changeRecord = screen.getByText('Fixed incorrect amount').closest('.bg-gray-50');
      expect(changeRecord).toHaveClass('bg-gray-50', 'rounded-lg', 'border');
    });

    it('has proper button styling', () => {
      renderModal();
      
      const undoAllButton = screen.getByRole('button', { name: /undo all changes/i });
      const closeButton = screen.getByRole('button', { name: /close/i });
      
      expect(undoAllButton).toHaveClass('bg-red-600', 'text-white', 'rounded-lg');
      expect(closeButton).toHaveClass('text-gray-700', 'rounded-lg');
    });

    it('has scrollable changes container', () => {
      renderModal();
      
      const changesContainer = screen.getByText('Fixed incorrect amount').closest('.max-h-96');
      expect(changesContainer).toHaveClass('max-h-96', 'overflow-y-auto');
    });
  });

  describe('accessibility', () => {
    it('has proper dialog role', () => {
      renderModal();
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has proper button roles and labels', () => {
      renderModal();
      
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo all changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo$/i })).toBeInTheDocument();
    });

    it('has proper undo button titles', () => {
      renderModal();
      
      const undoButton = screen.getByRole('button', { name: /undo$/i });
      expect(undoButton).toHaveAttribute('title', 'Undo this change');
    });

    it('supports keyboard navigation', () => {
      renderModal();
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      const undoAllButton = screen.getByRole('button', { name: /undo all changes/i });
      const undoButton = screen.getByRole('button', { name: /undo$/i });
      
      closeButton.focus();
      expect(closeButton).toHaveFocus();
      
      undoAllButton.focus();
      expect(undoAllButton).toHaveFocus();
      
      undoButton.focus();
      expect(undoButton).toHaveFocus();
    });
  });

  describe('footer notifications', () => {
    it('shows navigation notice when new transactions created', () => {
      const change = createMockChange({ field: 'created' });
      renderModal(true, [change]);
      
      expect(screen.getByText(/New transactions may not appear until you navigate/)).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    it('does not show navigation notice when no new transactions', () => {
      renderModal();
      
      expect(screen.queryByText(/New transactions may not appear/)).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles unknown field types gracefully', () => {
      const change = createMockChange({ field: 'unknown_field' });
      renderModal(true, [change]);
      
      expect(screen.getByText('unknown_field:')).toBeInTheDocument();
      // Should not have any field icon for unknown fields
      expect(screen.queryByTestId('calendar-icon')).not.toBeInTheDocument();
    });

    it('handles large number of changes', () => {
      const changes = Array.from({ length: 50 }, (_, i) => 
        createMockChange({ id: `change-${i}`, description: `Fix ${i}` })
      );
      renderModal(true, changes);
      
      expect(screen.getByText('Successfully Applied 50 Fixes')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /undo$/i })).toHaveLength(50);
    });

    it('handles very long descriptions', () => {
      const longDescription = 'A'.repeat(200);
      const change = createMockChange({ description: longDescription });
      renderModal(true, [change]);
      
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('handles complex value types', () => {
      const change = createMockChange({
        field: 'metadata',
        oldValue: { complex: 'object' },
        newValue: { updated: 'data' },
      });
      renderModal(true, [change]);
      
      const objectTexts = screen.getAllByText('[object Object]');
      expect(objectTexts).toHaveLength(2); // One for old value, one for new value
    });

    it('handles modal state changes during interaction', () => {
      const { rerender } = renderModal(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      rerender(
        <FixSummaryModal
          isOpen={false}
          onClose={mockOnClose}
          changes={[createMockChange()]}
          onUndo={mockOnUndo}
          onUndoAll={mockOnUndoAll}
        />
      );
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('real-world scenarios', () => {
    it('displays transaction amount correction scenario', () => {
      const change = createMockChange({
        id: 'amt-fix-1',
        type: 'transaction',
        field: 'amount',
        oldValue: 99.99,
        newValue: 149.99,
        description: 'Corrected transaction amount based on receipt',
        issueType: 'amount_mismatch',
      });
      renderModal(true, [change]);
      
      expect(screen.getByText('Corrected transaction amount based on receipt')).toBeInTheDocument();
      expect(screen.getByText('$100')).toBeInTheDocument();
      expect(screen.getByText('$150')).toBeInTheDocument();
      expect(screen.getByText('amount_mismatch')).toBeInTheDocument();
    });

    it('displays account balance reconciliation scenario', () => {
      const change = createMockChange({
        id: 'bal-fix-1',
        type: 'account',
        field: 'balance',
        oldValue: 1000,
        newValue: 1250.50,
        description: 'Account balance reconciled with transaction history',
        issueType: 'balance_mismatch',
      });
      renderModal(true, [change]);
      
      expect(screen.getByText('Account balance reconciled with transaction history')).toBeInTheDocument();
      expect(screen.getByText('$1,000')).toBeInTheDocument();
      expect(screen.getByText('$1,251')).toBeInTheDocument();
      expect(screen.getByText(/The account balance has been updated to match/)).toBeInTheDocument();
    });

    it('displays mixed fix types scenario', () => {
      const changes = [
        createMockChange({
          id: 'fix-1',
          field: 'amount',
          issueType: 'amount_error',
          description: 'Fixed incorrect amount',
        }),
        createMockChange({
          id: 'fix-2',
          field: 'date',
          issueType: 'date_warning',
          description: 'Adjusted transaction date',
          oldValue: new Date('2023-01-01'),
          newValue: new Date('2023-01-15'),
        }),
        createMockChange({
          id: 'fix-3',
          field: 'category',
          issueType: 'category_missing',
          description: 'Added missing category',
          oldValue: '',
          newValue: 'Groceries',
        }),
      ];
      renderModal(true, changes);
      
      expect(screen.getByText('Successfully Applied 3 Fixes')).toBeInTheDocument();
      expect(screen.getByText('amount_error')).toBeInTheDocument();
      expect(screen.getByText('date_warning')).toBeInTheDocument();
      expect(screen.getByText('category_missing')).toBeInTheDocument();
    });

    it('handles user undoing individual fixes', async () => {
      const user = userEvent.setup();
      const changes = [
        createMockChange({ id: 'fix-1', description: 'Fix 1' }),
        createMockChange({ id: 'fix-2', description: 'Fix 2' }),
      ];
      renderModal(true, changes);
      
      // Undo the first fix
      const undoButtons = screen.getAllByRole('button', { name: /undo$/i });
      await user.click(undoButtons[0]);
      
      expect(mockOnUndo).toHaveBeenCalledWith('fix-1');
    });

    it('handles user undoing all fixes', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const undoAllButton = screen.getByRole('button', { name: /undo all changes/i });
      await user.click(undoAllButton);
      
      expect(mockOnUndoAll).toHaveBeenCalledTimes(1);
    });
  });
});
