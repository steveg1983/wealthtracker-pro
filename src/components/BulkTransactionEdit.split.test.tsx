/**
 * BulkTransactionEdit — split-transaction regression tests.
 *
 * A split parent's category is locked by the DB guard; bulk category changes
 * must SKIP it (and say so) instead of aborting the whole batch on the
 * server-side rejection. Separate from the legacy suite because these tests
 * need a stable updateTransaction mock to assert calls against.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkTransactionEdit from './BulkTransactionEdit';

const mocks = vi.hoisted(() => ({
  updateTransaction: vi.fn(async () => {}),
  showWarning: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: [
      {
        id: 'plain-1',
        date: new Date('2026-06-01'),
        description: 'COSTA COFFEE',
        amount: -4.5,
        category: 'cat-food',
        accountId: 'acc-1',
        type: 'expense',
        cleared: false,
      },
      {
        id: 'split-1',
        date: new Date('2026-06-02'),
        description: 'TESCO SUPERSTORE',
        amount: -100,
        category: '',
        accountId: 'acc-1',
        type: 'expense',
        cleared: false,
        isSplit: true,
      },
    ],
    accounts: [
      { id: 'acc-1', name: 'Main Checking', type: 'checking', balance: 1000, currency: 'GBP' },
    ],
    categories: [
      { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail', parentId: 'sub-food' },
      { id: 'cat-other', name: 'Other', type: 'both', level: 'detail', parentId: 'sub-other' },
    ],
    updateTransaction: mocks.updateTransaction,
  }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(Number(amount)).toFixed(2)}`,
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: mocks.showError,
    showWarning: mocks.showWarning,
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

describe('BulkTransactionEdit — split parents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips the category on split parents and warns, instead of aborting the batch', async () => {
    render(<BulkTransactionEdit isOpen={true} onClose={vi.fn()} />);

    // Select both rows (plain + split parent)
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);

    // Choose a bulk category change
    const categorySection = screen.getByText(/Category/).parentElement;
    const categorySelect = categorySection?.querySelector('select');
    expect(categorySelect).toBeTruthy();
    await userEvent.selectOptions(categorySelect!, 'Other');

    await userEvent.click(screen.getByText('Apply Changes'));

    await waitFor(() => {
      // The plain transaction gets the category…
      expect(mocks.updateTransaction).toHaveBeenCalledWith(
        'plain-1',
        expect.objectContaining({ category: expect.any(String) })
      );
    });
    // …the split parent is never written with a category (in this batch its
    // ONLY change was the category, so it gets no write at all)
    expect(mocks.updateTransaction).not.toHaveBeenCalledWith(
      'split-1',
      expect.objectContaining({ category: expect.anything() })
    );
    expect(mocks.updateTransaction).toHaveBeenCalledTimes(1);
    // …and the user is told what was skipped and why
    expect(mocks.showWarning).toHaveBeenCalledWith(expect.stringMatching(/1 split transaction/));
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('still applies non-category changes to split parents', async () => {
    render(<BulkTransactionEdit isOpen={true} onClose={vi.fn()} />);

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);

    // Cleared status is legal on split parents (the guard only locks
    // amount/category/type)
    const clearedSection = screen.getByText(/Cleared Status/).parentElement;
    const clearedSelect = clearedSection?.querySelector('select');
    expect(clearedSelect).toBeTruthy();
    await userEvent.selectOptions(clearedSelect!, 'true');

    await userEvent.click(screen.getByText('Apply Changes'));

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledTimes(2);
    });
    expect(mocks.updateTransaction).toHaveBeenCalledWith('split-1', { cleared: true });
    expect(mocks.showWarning).not.toHaveBeenCalled();
  });
});
