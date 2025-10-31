import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { TransactionCard } from '../TransactionCard';
import { createMockTransaction, createMockAccount } from '../../test/factories';
import { formatCurrency } from '../../utils/currency';

describe('TransactionCard', () => {
  const mockOnClick = vi.fn();

  const defaultProps = {
    transaction: createMockTransaction(),
    account: createMockAccount(),
    categoryDisplay: '🛒 groceries',
    formatCurrency: formatCurrency,
    onClick: mockOnClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders transaction details correctly', () => {
    const transaction = createMockTransaction({
      description: 'Coffee Shop',
      amount: 4.50,
      category: 'dining',
      type: 'expense',
      date: new Date('2024-01-20'),
    });

    const props = {
      ...defaultProps,
      transaction,
      categoryDisplay: '🍽️ dining',
    };

    render(<TransactionCard {...props} />);

    expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
    expect(screen.getByText('-£4.50')).toBeInTheDocument();
    expect(screen.getByText('🍽️ dining')).toBeInTheDocument();
    expect(screen.getByText('1/20/2024')).toBeInTheDocument();
  });

  it('displays income transactions correctly', () => {
    const transaction = createMockTransaction({
      type: 'income',
      amount: 3000,
      description: 'Monthly Salary',
    });

    render(<TransactionCard {...defaultProps} transaction={transaction} />);

    const amountElement = screen.getByText('+£3,000.00');
    expect(amountElement).toBeInTheDocument();
    expect(amountElement).toHaveClass('text-green-600');
  });

  it('displays expense transactions correctly', () => {
    const transaction = createMockTransaction({
      type: 'expense',
      amount: 150,
      description: 'Electricity Bill',
    });

    render(<TransactionCard {...defaultProps} transaction={transaction} />);

    const amountElement = screen.getByText('-£150.00');
    expect(amountElement).toBeInTheDocument();
    expect(amountElement).toHaveClass('text-red-600');
  });

  it('displays transfer transactions correctly', () => {
    const transaction = createMockTransaction({
      type: 'transfer',
      amount: 500,
      description: 'Transfer to Savings',
    });

    render(<TransactionCard {...defaultProps} transaction={transaction} />);

    // Transfer with positive amount shows as income (green)
    const amountElement = screen.getByText('+£500.00');
    expect(amountElement).toBeInTheDocument();
    expect(amountElement).toHaveClass('text-green-600');
  });

  it('shows cleared indicator when transaction is cleared', () => {
    const transaction = createMockTransaction({
      cleared: true,
    });

    render(<TransactionCard {...defaultProps} transaction={transaction} />);

    const clearedIndicator = screen.getByText('R');
    expect(clearedIndicator).toBeInTheDocument();
  });

  it('shows not cleared indicator when transaction is not cleared', () => {
    const transaction = createMockTransaction({
      cleared: false,
    });

    render(<TransactionCard {...defaultProps} transaction={transaction} />);

    const notClearedIndicator = screen.getByText('N');
    expect(notClearedIndicator).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    render(<TransactionCard {...defaultProps} />);

    const card = screen.getByText(defaultProps.transaction.description).closest('div')?.parentElement;
    if (card) fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('displays category correctly', () => {
    const props = {
      ...defaultProps,
      categoryDisplay: '🏠 housing',
    };

    render(<TransactionCard {...props} />);

    expect(screen.getByText('🏠 housing')).toBeInTheDocument();
  });

  it('formats large amounts correctly', () => {
    const transaction = createMockTransaction({
      amount: 1234567.89,
      type: 'income',
    });

    render(<TransactionCard {...defaultProps} transaction={transaction} />);

    expect(screen.getByText('+£1,234,567.89')).toBeInTheDocument();
  });

  it('handles different currencies', () => {
    const currencies = [
      { currency: 'USD', symbol: '$' },
      { currency: 'EUR', symbol: '€' },
      { currency: 'GBP', symbol: '£' },
    ];

    currencies.forEach(({ currency, symbol }) => {
      const transaction = createMockTransaction({
        amount: 100,
        type: 'expense',
      });

      const account = createMockAccount({
        currency: currency as 'USD' | 'EUR' | 'GBP',
      });

      const { unmount } = render(<TransactionCard {...defaultProps} transaction={transaction} account={account} />);
      
      expect(screen.getByText(`-${symbol}100.00`)).toBeInTheDocument();
      
      unmount();
    });
  });

  it('displays long descriptions', () => {
    const longDescription = 'This is a very long description that should be displayed in full';
    const transaction = createMockTransaction({
      description: longDescription,
    });

    render(<TransactionCard {...defaultProps} transaction={transaction} />);

    expect(screen.getByText(longDescription)).toBeInTheDocument();
  });

  it('applies correct shadow and hover effects', () => {
    render(<TransactionCard {...defaultProps} />);

    // Find the main card container (has multiple classes including shadow-lg)
    const card = screen.getByText(defaultProps.transaction.description).closest('.shadow-lg');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('shadow-lg');
    expect(card).toHaveClass('hover:shadow-xl');
  });

  it('displays account name', () => {
    const account = createMockAccount({
      name: 'Main Checking Account',
    });

    render(<TransactionCard {...defaultProps} account={account} />);

    expect(screen.getByText('Main Checking Account')).toBeInTheDocument();
  });

  it('handles missing account gracefully', () => {
    render(<TransactionCard {...defaultProps} account={undefined} />);

    // Should render without errors and show 'Unknown' for account
    expect(screen.getByText(defaultProps.transaction.description)).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
