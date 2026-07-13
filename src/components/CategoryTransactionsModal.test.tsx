/**
 * CategoryTransactionsModal Tests
 * List rendering + the click-through into the transaction editor.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryTransactionsModal from './CategoryTransactionsModal';
import type { Transaction } from '../types';

// The editor's own behaviour is covered by EditTransactionModal.test.tsx;
// here we only verify the wiring: which transaction it receives and that
// closing it returns to the list.
vi.mock('./EditTransactionModal', () => ({
  default: ({ isOpen, transaction, onClose }: {
    isOpen: boolean;
    transaction: Transaction | null;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="edit-transaction-modal">
        <span>Editing: {transaction?.description}</span>
        <button onClick={onClose}>close-editor</button>
      </div>
    ) : null,
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}`,
  }),
}));

const txn = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  date: new Date('2026-06-17'),
  description: 'x',
  amount: -45,
  type: 'expense',
  accountId: 'acc-1',
  category: 'cat-other',
  cleared: false,
  ...over,
}) as Transaction;

const transactions = [
  txn({ id: 't1', description: 'A S CAR VALET SER', amount: -45 }),
  txn({ id: 't2', description: 'TFL CONGESTN CHRGE', amount: -12.5, date: new Date('2026-06-25') }),
  txn({ id: 't3', description: 'SOME OTHER CATEGORY ROW', category: 'cat-elsewhere' }),
];

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions,
    accounts: [{ id: 'acc-1', name: 'HSBC Premier - Current Account' }],
  }),
}));

function renderModal() {
  return render(
    <CategoryTransactionsModal
      isOpen
      onClose={vi.fn()}
      categoryId="cat-other"
      categoryName="Other Costs"
    />
  );
}

describe('CategoryTransactionsModal', () => {
  it('lists only the transactions in the category, as buttons', () => {
    renderModal();
    expect(screen.getByText('A S CAR VALET SER')).toBeInTheDocument();
    expect(screen.getByText('TFL CONGESTN CHRGE')).toBeInTheDocument();
    expect(screen.queryByText('SOME OTHER CATEGORY ROW')).not.toBeInTheDocument();
    // Rows are real buttons so keyboard users can open the editor
    expect(
      screen.getByRole('button', { name: /A S CAR VALET SER/ })
    ).toBeInTheDocument();
  });

  it('opens the transaction editor for the clicked row', () => {
    renderModal();
    expect(screen.queryByTestId('edit-transaction-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /TFL CONGESTN CHRGE/ }));

    expect(screen.getByTestId('edit-transaction-modal')).toBeInTheDocument();
    expect(screen.getByText('Editing: TFL CONGESTN CHRGE')).toBeInTheDocument();
  });

  it('returns to the list when the editor closes', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /A S CAR VALET SER/ }));
    expect(screen.getByTestId('edit-transaction-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-editor'));

    expect(screen.queryByTestId('edit-transaction-modal')).not.toBeInTheDocument();
    // List is still there behind it
    expect(screen.getByText('A S CAR VALET SER')).toBeInTheDocument();
  });
});
