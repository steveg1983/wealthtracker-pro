import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionRow } from '../TransactionRow';
import { createMockTransaction, createMockAccount } from '../../test/factories';
import { formatCurrency } from '../../utils/currency';

// Helper to render TransactionRow within a table
const renderInTable = (ui: React.ReactElement) => {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>
  );
};

describe('TransactionRow', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    transaction: createMockTransaction(),
    account: createMockAccount(),
    categoryPath: '🛒 groceries',
    compactView: false,
    formatCurrency: formatCurrency,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
    columnOrder: ['date', 'reconciled', 'description', 'category', 'amount', 'actions'],
    columnWidths: {
      date: 180,
      reconciled: 80,
      description: 300,
      category: 200,
      amount: 150,
      actions: 100
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders transaction details correctly', () => {
    const transaction = createMockTransaction({
      description: 'Grocery Shopping',
      amount: 75.50,
      category: 'groceries',
      type: 'expense',
      date: new Date('2024-01-15'),
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
    expect(screen.getByText('-£75.50')).toBeInTheDocument();
    expect(screen.getByText('🛒 groceries')).toBeInTheDocument();
    // Date format: '15 Jan 2024'
    const dateText = new Date('2024-01-15').toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    expect(screen.getByText(dateText)).toBeInTheDocument();
  });

  it('displays income transactions with positive amount and green color', () => {
    const transaction = createMockTransaction({
      type: 'income',
      amount: 2000,
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    const amountElement = screen.getByText('+£2,000.00');
    expect(amountElement).toBeInTheDocument();
    expect(amountElement).toHaveClass('text-green-600');
  });

  it('displays expense transactions with negative amount and red color', () => {
    const transaction = createMockTransaction({
      type: 'expense',
      amount: 500,
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    const amountElement = screen.getByText('-£500.00');
    expect(amountElement).toBeInTheDocument();
    expect(amountElement).toHaveClass('text-red-600');
  });

  it('displays transfer transactions with green color for positive amounts', () => {
    const transaction = createMockTransaction({
      type: 'transfer',
      amount: 1000,
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    // Transfer with positive amount shows as income (green with + sign)
    const amountElement = screen.getByText('+£1,000.00');
    expect(amountElement).toBeInTheDocument();
    expect(amountElement).toHaveClass('text-green-600');
  });

  it('shows cleared indicator when transaction is cleared', () => {
    const transaction = createMockTransaction({
      cleared: true,
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    // Look for the CheckIcon in the reconciled column
    const checkIcon = screen.getByTestId('check-icon');
    expect(checkIcon).toBeInTheDocument();
  });

  it('does not show cleared indicator when transaction is not cleared', () => {
    const transaction = createMockTransaction({
      cleared: false,
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    renderInTable(<TransactionRow {...defaultProps} />);

    const editButton = screen.getByTestId('edit-button');
    fireEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(defaultProps.transaction);
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when delete button is clicked', () => {
    renderInTable(<TransactionRow {...defaultProps} />);

    const deleteButton = screen.getByTestId('delete-button');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(defaultProps.transaction.id);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('displays tags when present', () => {
    const transaction = createMockTransaction({
      tags: ['vacation', 'travel'],
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    // Tags are shown in the description cell
    expect(screen.getByText('vacation')).toBeInTheDocument();
    expect(screen.getByText('travel')).toBeInTheDocument();
  });

  it('does not display tags section when no tags', () => {
    const transaction = createMockTransaction({
      tags: undefined,
    });

    renderInTable(<TransactionRow {...defaultProps} transaction={transaction} />);

    expect(screen.queryByText('vacation')).not.toBeInTheDocument();
  });

  it('formats different currencies correctly', () => {
    const accounts = [
      { account: createMockAccount({ currency: 'USD' }), expectedFormat: '$100.00' },
      { account: createMockAccount({ currency: 'EUR' }), expectedFormat: '€100.00' },
      { account: createMockAccount({ currency: 'GBP' }), expectedFormat: '£100.00' },
    ];

    const transaction = createMockTransaction({ amount: 100, type: 'expense' });

    accounts.forEach(({ account, expectedFormat }) => {
      const { unmount } = renderInTable(<TransactionRow {...defaultProps} transaction={transaction} account={account} />);
      
      expect(screen.getByText(`-${expectedFormat}`)).toBeInTheDocument();
      
      unmount();
    });
  });

  it('renders without crashing with minimal props', () => {
    const minimalTransaction = createMockTransaction({
      id: '1',
      description: 'Test',
      amount: 0,
      date: new Date(),
    });

    renderInTable(
      <TransactionRow
        {...defaultProps}
        transaction={minimalTransaction}
      />
    );

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles compact view', () => {
    renderInTable(<TransactionRow {...defaultProps} compactView={true} />);

    // In compact view, text should be smaller
    const dateText = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',  
      year: 'numeric'
    });
    const dateElement = screen.getByText(dateText);
    expect(dateElement).toHaveClass('text-sm');
  });
});
