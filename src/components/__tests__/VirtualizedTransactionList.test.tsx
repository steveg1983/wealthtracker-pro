/**
 * VirtualizedTransactionList Tests
 * Tests for the VirtualizedTransactionList component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VirtualizedTransactionList } from '../VirtualizedTransactionList';

// Mock dependencies
vi.mock('react-window', () => ({
  FixedSizeList: vi.fn(({ children: RowComponent, itemCount, itemData }: { children: React.ComponentType<any>; itemCount: number; itemData: any[] }) => {
    // Render a simplified version for testing
    return (
      <div data-testid="virtualized-list">
        {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => {
          // Call the component with props
          return React.createElement(RowComponent, {
            key: index,
            index,
            style: {},
            data: itemData
          });
        })}
      </div>
    );
  })
}));

vi.mock('react-window-infinite-loader', () => ({
  default: vi.fn(({ children }) => {
    return children({ 
      onItemsRendered: vi.fn(), 
      ref: { current: null } 
    });
  })
}));

vi.mock('react-virtualized-auto-sizer', () => ({
  default: vi.fn(({ children }) => children({ height: 600, width: 800 }))
}));

vi.mock('../icons', () => ({
  EditIcon: () => <div data-testid="edit-icon">Edit</div>,
  DeleteIcon: () => <div data-testid="delete-icon">Delete</div>,
  CheckIcon: ({ className }: { className?: string }) => (
    <div data-testid="check-icon" className={className}>Check</div>
  ),
  XIcon: ({ className }: { className?: string }) => (
    <div data-testid="x-icon" className={className}>X</div>
  )
}));

vi.mock('../../hooks/useFormattedValues', () => ({
  useFormattedDate: (date: Date) => {
    return new Date(date).toLocaleDateString();
  }
}));

// Mock window.confirm
global.confirm = vi.fn(() => true);

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

describe('VirtualizedTransactionList', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'trans-1',
      date: new Date('2024-01-15'),
      description: 'Coffee Shop',
      amount: -5.99,
      category: 'Food',
      accountId: 'acc-1',
      type: 'expense',
      cleared: true,
      pending: false
    },
    {
      id: 'trans-2',
      date: new Date('2024-01-16'),
      description: 'Salary Deposit',
      amount: 2500,
      category: 'Income',
      accountId: 'acc-1',
      type: 'income',
      cleared: false,
      pending: true
    },
    {
      id: 'trans-3',
      date: new Date('2024-01-17'),
      description: 'Grocery Store',
      amount: -85.50,
      category: 'Groceries',
      accountId: 'acc-2',
      type: 'expense',
      cleared: true,
      pending: false
    }
  ];

  const mockFormatCurrency = vi.fn((value: number) => {
    const prefix = value < 0 ? '-$' : '$';
    return `${prefix}${Math.abs(value).toFixed(2)}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFormatCurrency.mockImplementation((value: number) => {
      const prefix = value < 0 ? '-$' : '$';
      return `${prefix}${Math.abs(value).toFixed(2)}`;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders transactions correctly', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
      expect(screen.getByText('Salary Deposit')).toBeInTheDocument();
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
    });

    it('renders with proper ARIA attributes', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('aria-label', 'Transactions list');
      expect(grid).toHaveAttribute('aria-rowcount', '3');
    });

    it('renders transaction details correctly', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      // Check formatted amounts
      expect(screen.getByText('-$5.99')).toBeInTheDocument();
      expect(screen.getByText('+$2500.00')).toBeInTheDocument();
      expect(screen.getByText('-$85.50')).toBeInTheDocument();
      
      // Check categories
      expect(screen.getByText(/Food/)).toBeInTheDocument();
      expect(screen.getByText(/Income/)).toBeInTheDocument();
      expect(screen.getByText(/Groceries/)).toBeInTheDocument();
    });

    it('shows pending badge for pending transactions', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('shows reconcile status icons', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      const checkIcons = screen.getAllByTestId('check-icon');
      const xIcons = screen.getAllByTestId('x-icon');
      
      // Should have cleared transactions with check icons
      expect(checkIcons.some(icon => icon.classList.contains('text-green-600'))).toBe(true);
      // Should have uncleared transactions with x icons
      expect(xIcons.some(icon => icon.classList.contains('text-gray-400'))).toBe(true);
    });

    it('renders bulk selection checkboxes when enabled', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          showBulkActions={true}
          selectedTransactions={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(mockTransactions.length);
    });
  });

  describe('user interactions', () => {
    it('handles transaction click', async () => {
      const onTransactionClick = vi.fn();
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionClick={onTransactionClick}
        />
      );
      
      const firstRow = screen.getByText('Coffee Shop').closest('[role="row"]');
      if (firstRow) {
        await userEvent.click(firstRow);
      }
      
      expect(onTransactionClick).toHaveBeenCalledWith(mockTransactions[0]);
    });

    it('handles edit button click', async () => {
      const onTransactionEdit = vi.fn();
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionEdit={onTransactionEdit}
        />
      );
      
      const editButtons = screen.getAllByTitle('Edit transaction');
      await userEvent.click(editButtons[0]);
      
      expect(onTransactionEdit).toHaveBeenCalledWith(mockTransactions[0]);
    });

    it('handles delete button click with confirmation', async () => {
      const onTransactionDelete = vi.fn();
      global.confirm = vi.fn(() => true);
      
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionDelete={onTransactionDelete}
        />
      );
      
      const deleteButtons = screen.getAllByTitle('Delete transaction');
      await userEvent.click(deleteButtons[0]);
      
      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this transaction?');
      expect(onTransactionDelete).toHaveBeenCalledWith('trans-1');
    });

    it('cancels delete when user declines confirmation', async () => {
      const onTransactionDelete = vi.fn();
      global.confirm = vi.fn(() => false);
      
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionDelete={onTransactionDelete}
        />
      );
      
      const deleteButtons = screen.getAllByTitle('Delete transaction');
      await userEvent.click(deleteButtons[0]);
      
      expect(global.confirm).toHaveBeenCalled();
      expect(onTransactionDelete).not.toHaveBeenCalled();
    });

    it('handles bulk selection', async () => {
      const onSelectionChange = vi.fn();
      const selectedTransactions = new Set<string>();
      
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          showBulkActions={true}
          selectedTransactions={selectedTransactions}
          onSelectionChange={onSelectionChange}
        />
      );
      
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      
      expect(onSelectionChange).toHaveBeenCalledWith(expect.any(Set));
      const calledSet = onSelectionChange.mock.calls[0][0];
      expect(calledSet.has('trans-1')).toBe(true);
    });

    it('handles keyboard navigation', async () => {
      const onTransactionClick = vi.fn();
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionClick={onTransactionClick}
        />
      );
      
      const firstRow = screen.getByText('Coffee Shop').closest('[role="row"]');
      if (firstRow) {
        firstRow.focus();
        await userEvent.keyboard('{Enter}');
      }
      
      expect(onTransactionClick).toHaveBeenCalledWith(mockTransactions[0]);
    });
  });

  describe('virtualization', () => {
    it('handles large datasets efficiently', () => {
      const largeTransactions = Array.from({ length: 1000 }, (_, i) => ({
        id: `trans-${i}`,
        date: new Date(),
        description: `Transaction ${i}`,
        amount: i % 2 === 0 ? -50 : 100,
        category: 'Test',
        accountId: 'acc-1',
        type: 'expense' as const,
        cleared: false,
        pending: false
      }));
      
      render(
        <VirtualizedTransactionList 
          transactions={largeTransactions}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      // Should use virtualized list
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
      
      // Should only render a subset of items
      const renderedItems = screen.getAllByRole('row');
      expect(renderedItems.length).toBeLessThan(largeTransactions.length);
    });

    it('handles infinite scrolling', async () => {
      const onLoadMore = vi.fn();
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onLoadMore={onLoadMore}
          hasMore={true}
        />
      );
      
      // The InfiniteLoader should be set up
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('does not load more when already loading', () => {
      const onLoadMore = vi.fn();
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onLoadMore={onLoadMore}
          hasMore={true}
          isLoading={true}
        />
      );
      
      // onLoadMore should not be called when isLoading is true
      expect(onLoadMore).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels for rows', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      const rows = screen.getAllByRole('row');
      expect(rows[0]).toHaveAttribute('aria-label', expect.stringContaining('Coffee Shop'));
      expect(rows[0]).toHaveAttribute('aria-label', expect.stringContaining('-$5.99'));
    });

    it('has proper ARIA labels for interactive elements', () => {
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionEdit={vi.fn()}
          onTransactionDelete={vi.fn()}
          showBulkActions={true}
          selectedTransactions={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      
      // Check edit button labels
      const editButtons = screen.getAllByTitle('Edit transaction');
      expect(editButtons[0]).toHaveAttribute('aria-label', 'Edit transaction Coffee Shop');
      
      // Check delete button labels
      const deleteButtons = screen.getAllByTitle('Delete transaction');
      expect(deleteButtons[0]).toHaveAttribute('aria-label', 'Delete transaction Coffee Shop');
      
      // Check checkbox labels
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toHaveAttribute('aria-label', 'Select transaction Coffee Shop');
    });

    it('allows keyboard navigation with Space key', async () => {
      const onTransactionClick = vi.fn();
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionClick={onTransactionClick}
        />
      );
      
      const firstRow = screen.getByText('Coffee Shop').closest('[role="row"]');
      if (firstRow) {
        firstRow.focus();
        await userEvent.keyboard(' ');
      }
      
      expect(onTransactionClick).toHaveBeenCalledWith(mockTransactions[0]);
    });
  });

  describe('edge cases', () => {
    it('handles empty transaction list', () => {
      render(
        <VirtualizedTransactionList 
          transactions={[]}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('aria-rowcount', '0');
    });

    it('handles transactions without optional fields', () => {
      const minimalTransaction: Transaction = {
        id: 'trans-minimal',
        date: new Date(),
        description: 'Minimal Transaction',
        amount: 10,
        category: 'Other',
        accountId: '',
        type: 'expense',
        cleared: false
      };
      
      render(
        <VirtualizedTransactionList 
          transactions={[minimalTransaction]}
          formatCurrency={mockFormatCurrency}
        />
      );
      
      expect(screen.getByText('Minimal Transaction')).toBeInTheDocument();
    });

    it('stops event propagation on checkbox click', async () => {
      const onTransactionClick = vi.fn();
      const onSelectionChange = vi.fn();
      
      render(
        <VirtualizedTransactionList 
          transactions={mockTransactions}
          formatCurrency={mockFormatCurrency}
          onTransactionClick={onTransactionClick}
          showBulkActions={true}
          selectedTransactions={new Set()}
          onSelectionChange={onSelectionChange}
        />
      );
      
      const checkbox = screen.getAllByRole('checkbox')[0];
      await userEvent.click(checkbox);
      
      // Should update selection but not trigger row click
      expect(onSelectionChange).toHaveBeenCalled();
      expect(onTransactionClick).not.toHaveBeenCalled();
    });
  });
});
