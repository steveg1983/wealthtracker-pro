/**
 * TransferSweepModal — the "Stranded transfers" tier.
 *
 * Covers the wiring the classifier's own tests cannot: that the section exists
 * only when there is something in it, that a review spells out the consequence
 * BEFORE anything happens, and that confirming runs the exact write sequence
 * (unlink → file the displaced row → link) through the app context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransferSweepModal from './TransferSweepModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Category, Transaction } from '../types';

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(),
    convertAndFormat: vi.fn(),
    convertAndSum: vi.fn(),
  }),
}));

vi.mock('../hooks/useAccountNames', () => ({
  useAccountNames: () => (id: string) => ({
    'acc-current': 'Current account',
    'acc-joint': 'Joint account',
    'acc-credit': 'Credit card',
  }[id] ?? id),
}));

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -200,
  description: 'Transfer (Online)',
  category: '',
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

const CATEGORIES: Category[] = [
  {
    id: 'revaluation-adjustment', name: 'Account Adjustment', type: 'both', level: 'detail',
    parentId: 'type-revaluation', isRevaluationCategory: true,
  },
];

/** The real case: a −£200 leg linked to a refund 4 days away, its true twin stranded. */
const CLAIMED_TWIN_HISTORY: Transaction[] = [
  txn({ id: 'stranded', amount: 200, accountId: 'acc-joint', type: 'income', description: 'Transfer from 5755' }),
  txn({
    id: 'counterpart', amount: -200, accountId: 'acc-current', type: 'transfer',
    category: 'transfer-cat', transferAccountId: 'acc-credit', linkedTransferId: 'wrong-partner',
  }),
  txn({
    id: 'wrong-partner', amount: 200, accountId: 'acc-credit', type: 'transfer',
    date: new Date('2026-05-05'), description: 'Europcar refund',
    category: 'transfer-cat', transferAccountId: 'acc-current', linkedTransferId: 'counterpart',
  }),
];

const renderModal = (): void => {
  render(
    <MemoryRouter>
      <TransferSweepModal isOpen onClose={vi.fn()} />
    </MemoryRouter>
  );
};

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('TransferSweepModal — stranded transfers section', () => {
  it('does not render the section when there is nothing stranded', () => {
    __setAppContextValue({
      transactions: [
        txn({ id: 'out', amount: -500 }),
        txn({ id: 'in', amount: 500, accountId: 'acc-joint', type: 'income' }),
      ],
      categories: CATEGORIES,
    });
    renderModal();

    expect(screen.queryByText('Stranded transfers')).not.toBeInTheDocument();
  });

  it('lists a finding with its evidence in one line', () => {
    __setAppContextValue({ transactions: CLAIMED_TWIN_HISTORY, categories: CATEGORIES });
    renderModal();

    expect(screen.getByText('Stranded transfers')).toBeInTheDocument();
    expect(screen.getByText('Transfer from 5755')).toBeInTheDocument();
    expect(screen.getByText(/is linked to a row 4 days away/)).toBeInTheDocument();
  });
});

describe('TransferSweepModal — reviewing a claimed twin', () => {
  beforeEach(() => {
    __setAppContextValue({ transactions: CLAIMED_TWIN_HISTORY, categories: CATEGORIES });
  });

  const openReview = (): void => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  };

  it('shows all three rows and names the consequence before anything happens', () => {
    openReview();

    // The stacked review is the second dialog (the shared Modal labels every
    // instance by the same heading id, so it cannot be selected by name).
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(2);
    const dialog = dialogs[1];
    expect(within(dialog).getByRole('heading', { name: 'Its other side is taken' })).toBeInTheDocument();
    expect(within(dialog).getByText('This row')).toBeInTheDocument();
    expect(within(dialog).getByText('Its other side')).toBeInTheDocument();
    expect(within(dialog).getByText('Linked to it today')).toBeInTheDocument();
    expect(within(dialog).getByText('Europcar refund')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Its current partner will be unlinked and filed as Account Adjustment, so nothing is left stranded.'
      )
    ).toBeInTheDocument();
  });

  it('writes nothing until the user confirms, then makes ONE atomic repair call', async () => {
    const calls: string[] = [];
    __setAppContextValue({
      updateTransaction: async (id: string, updates: Partial<Transaction>) => {
        calls.push(`update:${id}:${updates.category ?? ''}`);
      },
      linkTransferPair: async (idA: string, idB: string) => {
        calls.push(`link:${idA},${idB}`);
        return { a: CLAIMED_TWIN_HISTORY[1], b: CLAIMED_TWIN_HISTORY[0] };
      },
      repairClaimedTransfer: async (
        strandedId: string, counterpartId: string, partnerId: string, categoryId: string
      ) => {
        calls.push(`repair:${strandedId},${counterpartId},${partnerId}:${categoryId}`);
      },
    });
    openReview();
    expect(calls).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Re-pair, and file the odd one out' }));

    // One call, not three: the unlink, the filing and the re-link happen
    // inside one database transaction, so the UI cannot observe a half-repair.
    await waitFor(() => expect(calls).toEqual([
      'repair:stranded,counterpart,wrong-partner:revaluation-adjustment',
    ]));
  });

  it('drops the finding from the list when the user refuses', () => {
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the existing pair alone' }));

    expect(screen.queryByText('Stranded transfers')).not.toBeInTheDocument();
  });
});

describe('TransferSweepModal — without an Account Adjustment category', () => {
  it('disables the fix and says why, rather than inventing the category', () => {
    __setAppContextValue({ transactions: CLAIMED_TWIN_HISTORY, categories: [] });
    renderModal();

    expect(screen.getByText(/Add one under Revaluation in Categories/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('button', { name: 'Re-pair, and file the odd one out' })).toBeDisabled();
  });
});
