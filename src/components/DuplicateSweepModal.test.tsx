/**
 * DuplicateSweepModal — the delete tool, through the UI.
 *
 * What these pin is everything that makes a DELETE safe to hand to a user:
 * nothing is pre-selected, the consequence is on screen before the button
 * works, a row that is holding a transfer or a split together cannot be chosen
 * at all, and a refusal can be made to stick.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import DuplicateSweepModal from './DuplicateSweepModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import { duplicateDismissalKey } from '../utils/suggestionDismissals';
import type { Category, SuggestionDismissal, Transaction } from '../types';

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
  }[id] ?? id),
}));

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -49.99,
  description: 'TESCO STORES 3421',
  category: 'cat-food',
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', type: 'expense', level: 'detail' },
];

/** The commonest real case: a bank feed and an import of the same payment. */
const FEED = txn({ id: 'feed', cleared: true });
const IMPORTED = txn({ id: 'import', isImported: true });

const renderModal = (): void => {
  render(<DuplicateSweepModal isOpen onClose={vi.fn()} />);
};

const openReview = (): void => {
  fireEvent.click(screen.getByTitle('Look at both copies of this'));
};

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('DuplicateSweepModal — finding the same payment twice', () => {
  beforeEach(() => {
    __setAppContextValue({ transactions: [FEED, IMPORTED], categories: CATEGORIES });
  });

  it('lists the pair with the evidence that makes it judgeable', () => {
    renderModal();

    const row = screen.getByTitle('Look at both copies of this');
    expect(within(row).getByText('TESCO STORES 3421')).toBeInTheDocument();
    expect(within(row).getByText('Current account')).toBeInTheDocument();
    expect(within(row).getByText('£49.99')).toBeInTheDocument();
    expect(within(row).getByText('100% alike')).toBeInTheDocument();
  });

  it('pre-selects nothing, and will not delete until a copy is chosen', () => {
    renderModal();
    openReview();

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: 'Delete the copy I chose' })).toBeDisabled();
    expect(screen.getByText(/Pick one and this will say exactly what deleting it does/)).toBeInTheDocument();
  });

  it('says what deleting the chosen copy does BEFORE the button works', () => {
    renderModal();
    openReview();

    fireEvent.click(screen.getAllByRole('radio')[0]);

    // The consequence, in the house voice: the balance moving is the point.
    expect(screen.getByText(/deleted for good/)).toBeInTheDocument();
    expect(screen.getByText(/Current account’s balance goes up by £49.99/)).toBeInTheDocument();
    expect(screen.getByText(/The other copy stays exactly as it is/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete the copy I chose' })).toBeEnabled();
  });

  it('deletes only the copy that was chosen', async () => {
    const deleteTransaction = vi.fn(async () => {});
    __setAppContextValue({ deleteTransaction });
    renderModal();
    openReview();

    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete the copy I chose' }));

    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledTimes(1));
    expect(deleteTransaction).toHaveBeenCalledWith('import');
  });
});

describe('DuplicateSweepModal — rows that must not be deleted', () => {
  it('refuses half of a linked transfer, and says which account would be stranded', () => {
    __setAppContextValue({
      transactions: [
        txn({ id: 'leg', type: 'transfer', linkedTransferId: 'far-side', transferAccountId: 'acc-joint' }),
        IMPORTED,
      ],
      categories: CATEGORIES,
    });
    renderModal();
    openReview();

    expect(screen.getByText(/one half of a linked transfer with Joint account/)).toBeInTheDocument();
    // The blocked copy cannot be chosen; the other one still can.
    const [blocked, free] = screen.getAllByRole('radio');
    expect(blocked).toBeDisabled();
    expect(free).toBeEnabled();
  });

  it('refuses the counterpart of a split line', () => {
    __setAppContextValue({
      transactions: [
        txn({ id: 'line-side', type: 'transfer', linkedTransferId: 'parent', linkedTransferSplitId: 'line-1' }),
        IMPORTED,
      ],
      categories: CATEGORIES,
    });
    renderModal();
    openReview();

    expect(screen.getByText(/the other side of one LINE inside a split transaction/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')[0]).toBeDisabled();
  });

  it('refuses a split parent', () => {
    __setAppContextValue({
      transactions: [txn({ id: 'parent', isSplit: true }), IMPORTED],
      categories: CATEGORIES,
    });
    renderModal();
    openReview();

    expect(screen.getByText(/split into lines/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')[0]).toBeDisabled();
  });

  it('offers no delete at all when both copies are holding something together', () => {
    __setAppContextValue({
      transactions: [
        txn({ id: 'leg-a', type: 'transfer', linkedTransferId: 'far-a', transferAccountId: 'acc-joint' }),
        txn({ id: 'leg-b', type: 'transfer', linkedTransferId: 'far-b', transferAccountId: 'acc-joint' }),
      ],
      categories: CATEGORIES,
    });
    renderModal();
    openReview();

    expect(screen.getByText(/Neither of these can be deleted from here/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete the copy I chose' })).toBeDisabled();
  });
});

describe('DuplicateSweepModal — refusing a suggestion', () => {
  beforeEach(() => {
    __setAppContextValue({ transactions: [FEED, IMPORTED], categories: CATEGORIES });
  });

  it('asks whether to leave it out in future, saying what each answer does', () => {
    renderModal();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Not a duplicate — leave both' }));

    expect(screen.getByText(/Do you want these two rows eliminated from this report in future\?/)).toBeInTheDocument();
    expect(screen.getByText(/no sweep will offer it again/)).toBeInTheDocument();
    expect(screen.getByText(/they drop off the list for now/)).toBeInTheDocument();
  });

  it('answering No keeps today\'s behaviour: gone for this sitting, nothing written', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ dismissSuggestion });
    renderModal();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Not a duplicate — leave both' }));
    fireEvent.click(screen.getByRole('button', { name: 'No — just this once' }));

    await waitFor(() =>
      expect(screen.queryByTitle('Look at both copies of this')).not.toBeInTheDocument()
    );
    expect(dismissSuggestion).not.toHaveBeenCalled();
    expect(screen.getByText(/Nothing looks like the same payment twice/)).toBeInTheDocument();
  });

  it('answering Yes records the refusal against a canonical key', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ dismissSuggestion });
    renderModal();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Not a duplicate — leave both' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes — never offer it again' }));

    await waitFor(() => expect(dismissSuggestion).toHaveBeenCalledTimes(1));
    expect(dismissSuggestion).toHaveBeenCalledWith(
      'duplicate',
      // Sorted, so the same two rows produce this key whichever way round a
      // later scan reaches them.
      'feed|import',
      ['feed', 'import']
    );
  });
});

describe('DuplicateSweepModal — dismissals that stick', () => {
  const dismissal: SuggestionDismissal = {
    id: 'd1',
    kind: 'duplicate',
    subjectKey: duplicateDismissalKey(FEED, IMPORTED),
    subjectIds: ['feed', 'import'],
    dismissedAt: new Date('2026-06-01'),
  };

  it('never offers a pair the user has dismissed', () => {
    __setAppContextValue({
      transactions: [FEED, IMPORTED], categories: CATEGORIES,
      suggestionDismissals: [dismissal],
    });
    renderModal();

    expect(screen.queryByTitle('Look at both copies of this')).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing looks like the same payment twice/)).toBeInTheDocument();
  });

  it('offers it again the moment the same rows come back the other way round', () => {
    // The scan order flipped (the import is seeded first this time). The
    // dismissal must still match — this is the whole point of the sorted key.
    __setAppContextValue({
      transactions: [IMPORTED, FEED], categories: CATEGORIES,
      suggestionDismissals: [dismissal],
    });
    renderModal();

    expect(screen.queryByTitle('Look at both copies of this')).not.toBeInTheDocument();
  });

  it('lists what was dismissed and puts it back on request', async () => {
    const restoreSuggestion = vi.fn(async () => {});
    __setAppContextValue({
      transactions: [FEED, IMPORTED], categories: CATEGORIES,
      suggestionDismissals: [dismissal], restoreSuggestion,
    });
    renderModal();

    expect(screen.getByText('Dismissed suggestions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByText('Not a duplicate')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restoreSuggestion).toHaveBeenCalledWith('duplicate', 'feed|import'));
  });

  it('says so plainly when the rows a dismissal named have since been deleted', () => {
    __setAppContextValue({
      transactions: [], categories: CATEGORIES, suggestionDismissals: [dismissal],
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByText('The transactions this was about are no longer in your register.'))
      .toBeInTheDocument();
  });

  it('holds the list back until the dismissals have been read', () => {
    __setAppContextValue({
      transactions: [FEED, IMPORTED], categories: CATEGORIES,
      suggestionDismissalsStatus: 'loading',
    });
    renderModal();

    // Never show a suggestion and then snatch it away — that IS the complaint.
    expect(screen.queryByTitle('Look at both copies of this')).not.toBeInTheDocument();
    expect(screen.getByText('Checking which of these you have already dealt with…')).toBeInTheDocument();
  });

  it('shows everything, and says the filter did not run, when it could not be read', () => {
    __setAppContextValue({
      transactions: [FEED, IMPORTED], categories: CATEGORIES,
      suggestionDismissalsStatus: 'error',
    });
    renderModal();

    expect(screen.getByTitle('Look at both copies of this')).toBeInTheDocument();
    expect(screen.getByText(/could not be read, so this list may include some of them/)).toBeInTheDocument();
  });
});
