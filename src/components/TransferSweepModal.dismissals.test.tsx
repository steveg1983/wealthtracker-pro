/**
 * TransferSweepModal — refusals that stick.
 *
 * The owner's complaint, in one sentence: "after you leave the list totally and
 * come back later, the same list that you said you wanted to leave come back up
 * again and again." These tests pin the fix on all three of the sweep's tiers —
 * clean pairs, split-line matches and stranded findings — plus the two things
 * that keep it from being a one-way door: answering No changes nothing, and
 * every Yes can be undone from the list at the foot of the modal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransferSweepModal from './TransferSweepModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Category, SuggestionDismissal, Transaction, TransactionSplit } from '../types';

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
    formatCurrency: (amount: number) =>
      Number(amount) < 0
        ? `(£${Math.abs(Number(amount)).toFixed(2)})`
        : `£${Number(amount).toFixed(2)}`,
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
    'acc-loan': 'Friend loan',
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

/** One clean pair: equal, opposite, uncategorised, two accounts, same day. */
const CLEAN_PAIR: Transaction[] = [
  txn({ id: 'pair-out', amount: -50, description: 'Zulu payment' }),
  txn({ id: 'pair-in', amount: 50, accountId: 'acc-joint', type: 'income', description: 'Zulu payment' }),
];

/** The real stranded case: a leg linked to the wrong row, its true twin free. */
const CLAIMED_TWIN: Transaction[] = [
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

/** One LINE of a split, and the row over there that is its other side. */
const SPLIT_PARENT = txn({
  id: 'repayment', amount: 35000, type: 'income', description: 'Repaid in full', isSplit: true,
});
const SPLIT_OTHER_SIDE = txn({ id: 'loan-row', accountId: 'acc-loan', amount: -30000, description: 'Repaid in full' });
const SPLIT_LINES: TransactionSplit[] = [
  { id: 'leg', transactionId: 'repayment', category: 'tofrom-loan', amount: 30000, sortOrder: 1, transferAccountId: 'acc-loan' },
  { id: 'interest', transactionId: 'repayment', category: 'cat-interest', amount: 5000, sortOrder: 2 },
];

const dismissal = (
  kind: SuggestionDismissal['kind'], subjectKey: string, subjectIds: string[]
): SuggestionDismissal => ({
  id: `d-${subjectKey}`, kind, subjectKey, subjectIds, dismissedAt: new Date('2026-06-01'),
});

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

describe('TransferSweepModal — a dismissed suggestion never comes back', () => {
  it('drops a clean pair the user asked never to see again', () => {
    __setAppContextValue({
      transactions: CLEAN_PAIR,
      categories: CATEGORIES,
      suggestionDismissals: [dismissal('transfer-pair', 'pair-in|pair-out', ['pair-out', 'pair-in'])],
    });
    renderModal();

    expect(screen.queryByTitle('See both sides of this pair')).not.toBeInTheDocument();
    expect(screen.getByText(/No unlinked transfer pairs found/)).toBeInTheDocument();
  });

  it('drops a split-line match the user asked never to see again', () => {
    __setAppContextValue({
      transactions: [SPLIT_PARENT, SPLIT_OTHER_SIDE],
      transactionSplits: SPLIT_LINES,
      categories: CATEGORIES,
      suggestionDismissals: [dismissal('transfer-leg', 'split:leg|txn:loan-row', ['repayment', 'loan-row'])],
    });
    renderModal();

    expect(screen.queryByTitle('See this split line and its match')).not.toBeInTheDocument();
  });

  it('drops a stranded finding the user asked never to see again', () => {
    __setAppContextValue({
      transactions: CLAIMED_TWIN,
      categories: CATEGORIES,
      suggestionDismissals: [dismissal(
        'stranded',
        'claimed|counterpart|stranded|wrong-partner',
        ['stranded', 'counterpart', 'wrong-partner']
      )],
    });
    renderModal();

    expect(screen.queryByText('Stranded transfers')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Look at the evidence for this row')).not.toBeInTheDocument();
  });

  it('holds every list back until the dismissals have been read', () => {
    __setAppContextValue({
      transactions: CLEAN_PAIR, categories: CATEGORIES,
      suggestionDismissalsStatus: 'loading',
    });
    renderModal();

    expect(screen.queryByTitle('See both sides of this pair')).not.toBeInTheDocument();
    // Not the "nothing found" message either — that would be a lie.
    expect(screen.queryByText(/No unlinked transfer pairs found/)).not.toBeInTheDocument();
    expect(screen.getByText('Checking which of these you have already dealt with…')).toBeInTheDocument();
  });
});

describe('TransferSweepModal — refusing a clean pair', () => {
  beforeEach(() => {
    __setAppContextValue({ transactions: CLEAN_PAIR, categories: CATEGORIES });
  });

  it('refusing IS the judgment: one press, remembered, against a key that does not depend on leg order', async () => {
    // No follow-up question (owner, 29 Aug) — safe as one step because the
    // refusal is restorable from "Dismissed suggestions".
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ dismissSuggestion });
    renderModal();
    fireEvent.click(screen.getByTitle('See both sides of this pair'));
    fireEvent.click(screen.getByRole('button', { name: 'Not a pair — leave it' }));

    await waitFor(() => expect(dismissSuggestion).toHaveBeenCalledTimes(1));
    expect(dismissSuggestion).toHaveBeenCalledWith(
      'transfer-pair', 'pair-in|pair-out', ['pair-out', 'pair-in']
    );
    // The pair stays listed, unticked — refusing the pairing is not hiding
    // the rows, and the refusal takes hold on the next scan.
    await waitFor(() => expect(screen.getByText('0 of 1 selected')).toBeInTheDocument());
    expect(screen.getByTitle('See both sides of this pair')).toBeInTheDocument();
  });
});

describe('TransferSweepModal — refusing a stranded finding', () => {
  beforeEach(() => {
    __setAppContextValue({ transactions: CLAIMED_TWIN, categories: CATEGORIES });
  });

  it('refusing drops it and records the finding AND every row that makes its case', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ dismissSuggestion });
    renderModal();
    fireEvent.click(screen.getByTitle('Look at the evidence for this row'));
    fireEvent.click(screen.getByRole('button', { name: 'Leave the existing pair alone' }));

    await waitFor(() =>
      expect(screen.queryByTitle('Look at the evidence for this row')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(dismissSuggestion).toHaveBeenCalledTimes(1));
    expect(dismissSuggestion).toHaveBeenCalledWith(
      'stranded',
      // The finding kind leads: refusing this offer must not suppress a
      // different offer about the same rows later.
      'claimed|counterpart|stranded|wrong-partner',
      ['stranded', 'counterpart', 'wrong-partner']
    );
  });
});

describe('TransferSweepModal — undoing a dismissal', () => {
  it('lists what was dismissed, describes it, and restores it on request', async () => {
    const restoreSuggestion = vi.fn(async () => {});
    __setAppContextValue({
      transactions: CLEAN_PAIR,
      categories: CATEGORIES,
      restoreSuggestion,
      suggestionDismissals: [dismissal('transfer-pair', 'pair-in|pair-out', ['pair-out', 'pair-in'])],
    });
    renderModal();

    expect(screen.getByText('Dismissed suggestions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    // Described from the rows it named, so it is recognisable.
    expect(screen.getByText('Zulu payment')).toBeInTheDocument();
    expect(screen.getByText(/£50.00, Current account/)).toBeInTheDocument();
    expect(screen.getByText('Not a transfer pair')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(restoreSuggestion).toHaveBeenCalledWith('transfer-pair', 'pair-in|pair-out')
    );
  });

  it('shows no dismissed section at all when nothing has been dismissed', () => {
    __setAppContextValue({ transactions: CLEAN_PAIR, categories: CATEGORIES });
    renderModal();

    expect(screen.queryByText('Dismissed suggestions')).not.toBeInTheDocument();
  });
});
