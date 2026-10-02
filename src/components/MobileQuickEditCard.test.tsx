import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickEditRowProvider } from './QuickEditRow';
import MobileQuickEditCard from './MobileQuickEditCard';
import type { Transaction } from '../types';

const mocks = vi.hoisted(() => ({
  updateTransaction: vi.fn(async () => {}),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const source: Transaction = {
  id: 'src',
  date: new Date('2026-09-21'),
  description: 'Two Way Sweep to account 00001234',
  amount: -28500,
  type: 'expense',
  accountId: 'acc-a',
  category: 'det-adjust',
  categoryConfirmed: false,
  cleared: false,
} as Transaction;

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: [source],
    accounts: [
      { id: 'acc-a', name: 'Coutts (General) - Current', type: 'checking', balance: 0, currency: 'GBP' },
      { id: 'acc-b', name: 'Coutts (Private)', type: 'checking', balance: 0, currency: 'GBP' },
    ],
    categories: [
      { id: 'type-reval', name: 'Revaluation', type: 'expense', level: 'type' },
      { id: 'sub-reval', name: 'Revaluation', type: 'expense', level: 'sub', parentId: 'type-reval' },
      { id: 'det-adjust', name: 'Account Adjustment', type: 'expense', level: 'detail', parentId: 'sub-reval' },
    ],
    getSubCategories: (parentId?: string) =>
      [{ id: 'sub-reval', name: 'Revaluation', type: 'expense', level: 'sub', parentId: 'type-reval' }].filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) =>
      [{ id: 'det-adjust', name: 'Account Adjustment', type: 'expense', level: 'detail', parentId: 'sub-reval' }].filter(c => c.parentId === parentId),
    updateTransaction: mocks.updateTransaction,
    linkTransferPair: vi.fn(async () => ({ a: {}, b: {} })),
    createTransferCounterpart: vi.fn(async () => ({ source: {}, counterpart: {} })),
    applyCategoryToUncategorized: vi.fn(async () => 0),
    confirmTransactionCategories: vi.fn(async () => 0),
    addTransaction: vi.fn(async () => {}),
    deleteTransaction: vi.fn(async () => {}),
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(), showSuccess: mocks.showSuccess, showError: mocks.showError,
    showWarning: vi.fn(), showInfo: vi.fn(), dismissToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) => (Number(n) < 0 ? `(£${Math.abs(Number(n)).toFixed(2)})` : `£${Number(n).toFixed(2)}`),
  }),
}));

describe('the phone card editor — the register editor, stacked', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers every field the provider offers, under a caption, with the amount read off the row', () => {
    render(
      <QuickEditRowProvider transaction={source} onDismiss={vi.fn()}>
        <MobileQuickEditCard transaction={source} onFullEditor={vi.fn()} />
      </QuickEditRowProvider>
    );

    expect(screen.getByLabelText('Transaction date')).toBeInTheDocument();
    expect(screen.getByLabelText('Transaction description')).toHaveValue('Two Way Sweep to account 00001234');
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByLabelText('Transaction notes')).toBeInTheDocument();
    expect(screen.getByText('(£28500.00)')).toBeInTheDocument();
    // The keyboard rhythm is the desktop's; a phone has no Enter to explain.
    expect(screen.queryByText(/Enter accepts/)).not.toBeInTheDocument();
    // The suggestion is shown as one, with the one-tap agreement beside it.
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('saves from the card exactly as the row saves', async () => {
    render(
      <QuickEditRowProvider transaction={source} onDismiss={vi.fn()}>
        <MobileQuickEditCard transaction={source} onFullEditor={vi.fn()} />
      </QuickEditRowProvider>
    );
    fireEvent.change(screen.getByLabelText('Transaction description'), { target: { value: 'Sweep to Private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.updateTransaction).toHaveBeenCalledTimes(1));
    expect(mocks.updateTransaction.mock.calls[0][1]).toMatchObject({ description: 'Sweep to Private', needsReview: false });
  });

  it('hands over to the full editor on request', () => {
    const onFullEditor = vi.fn();
    render(
      <QuickEditRowProvider transaction={source} onDismiss={vi.fn()}>
        <MobileQuickEditCard transaction={source} onFullEditor={onFullEditor} />
      </QuickEditRowProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Full editor' }));
    expect(onFullEditor).toHaveBeenCalledWith(source);
  });
});
