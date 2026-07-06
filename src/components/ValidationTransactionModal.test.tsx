/**
 * ValidationTransactionModal tests
 *
 * Focus: amounts are stored SIGNED (expenses negative, income positive,
 * transfers signed by direction). The row must derive its displayed sign
 * from the stored value, not the transaction type, so incoming transfers
 * show '+' and a mis-signed positive expense visibly shows '+£X' beside
 * its sign-mismatch warning.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import ValidationTransactionModal from './ValidationTransactionModal';

const mockUseApp = vi.fn();
const mockUpdateTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => mockUseApp()
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: number) => `£${value.toFixed(2)}`
  })
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ children, isOpen, title }: { children?: React.ReactNode; isOpen: boolean; title: string }) =>
    isOpen ? (
      <div role="dialog">
        <div>{title}</div>
        {children}
      </div>
    ) : null
}));

vi.mock('./icons', () => ({
  EditIcon: () => <span data-testid="edit-icon" />,
  TrashIcon: () => <span data-testid="trash-icon" />,
  CheckIcon: () => <span data-testid="check-icon" />,
  XIcon: () => <span data-testid="x-icon" />
}));

const accounts = [
  { id: 'acc-1', name: 'Current Account', type: 'current', balance: 1000, currency: 'GBP' }
];

const categories = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Salary' }
];

const baseTransaction = {
  date: new Date('2024-03-01'),
  description: 'Test transaction',
  category: 'Groceries',
  accountId: 'acc-1'
};

type IssueType = 'invalid-categories' | 'zero-negative-amounts' | 'large-transactions' | 'other';

const setup = (
  transaction: { id: string; amount: number; type: 'income' | 'expense' | 'transfer' },
  issueType: IssueType = 'zero-negative-amounts'
): void => {
  mockUseApp.mockReturnValue({
    transactions: [{ ...baseTransaction, ...transaction }],
    accounts,
    categories,
    updateTransaction: mockUpdateTransaction,
    deleteTransaction: mockDeleteTransaction
  });

  render(
    <ValidationTransactionModal
      isOpen={true}
      onClose={vi.fn()}
      title="Fix transactions"
      transactionIds={[transaction.id]}
      issueType={issueType}
    />
  );
};

/** The sign and the formatted amount are sibling text nodes inside one span. */
const getAmountSpan = (expected: string): HTMLElement =>
  screen.getByText(
    (_content, element) =>
      element !== null && element.tagName === 'SPAN' && element.textContent === expected
  );

describe('ValidationTransactionModal signed amount display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows + for an incoming transfer (positive stored amount)', () => {
    setup({ id: 'tx-in', amount: 500, type: 'transfer' }, 'other');

    expect(getAmountSpan('+£500.00')).toBeInTheDocument();
  });

  it('shows - for an outgoing transfer (negative stored amount)', () => {
    setup({ id: 'tx-out', amount: -200, type: 'transfer' }, 'other');

    expect(getAmountSpan('-£200.00')).toBeInTheDocument();
  });

  it('shows +£X for a mis-signed positive expense beside its mismatch warning', () => {
    setup({ id: 'tx-bad', amount: 75, type: 'expense' });

    expect(getAmountSpan('+£75.00')).toBeInTheDocument();
    expect(screen.getByText(/Amount sign does not match transaction type/)).toBeInTheDocument();
  });

  it('shows - for a correctly signed expense', () => {
    setup({ id: 'tx-exp', amount: -30, type: 'expense' }, 'other');

    expect(getAmountSpan('-£30.00')).toBeInTheDocument();
  });

  it('flags a zero amount explicitly', () => {
    setup({ id: 'tx-zero', amount: 0, type: 'expense' });

    expect(getAmountSpan('+£0.00')).toBeInTheDocument();
    expect(screen.getByText(/Amount is zero/)).toBeInTheDocument();
  });
});
