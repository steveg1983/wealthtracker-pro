/**
 * TransferSweepModal — the "Stranded transfers" tier, and the column sorting
 * over BOTH of the modal's tables.
 *
 * Covers the wiring the classifier's own tests cannot: that the section exists
 * only when there is something in it, that a review spells out the consequence
 * BEFORE anything happens, and that confirming runs the exact write sequence
 * (unlink → file the displaced row → link) through the app context.
 *
 * The sorting tests pin the two rules that are easy to lose: the default order
 * is whatever the sweep/classifier emitted (nothing moves until a heading is
 * clicked), and reordering rows never disturbs the selection.
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

/**
 * Three clean pairs that disagree on every column, so each heading has to
 * prove itself. The sweep emits them oldest-first — A (£50), B (£900),
 * C (£300) — which is neither the amount order, the description order, nor
 * the account order.
 */
const PAIR_HISTORY: Transaction[] = [
  txn({ id: 'pair-a-out', amount: -50, accountId: 'acc-current', description: 'Zulu payment', date: new Date('2026-01-10') }),
  txn({ id: 'pair-a-in', amount: 50, accountId: 'acc-joint', type: 'income', description: 'Zulu payment', date: new Date('2026-01-10') }),
  txn({ id: 'pair-b-out', amount: -900, accountId: 'acc-joint', description: 'Alpha payment', date: new Date('2026-02-20') }),
  txn({ id: 'pair-b-in', amount: 900, accountId: 'acc-credit', type: 'income', description: 'Alpha payment', date: new Date('2026-02-20') }),
  txn({ id: 'pair-c-out', amount: -300, accountId: 'acc-credit', description: 'Mike payment', date: new Date('2026-03-05') }),
  txn({ id: 'pair-c-in', amount: 300, accountId: 'acc-current', type: 'income', description: 'Mike payment', date: new Date('2026-03-05') }),
];

const SORT_CATEGORIES: Category[] = [
  ...CATEGORIES,
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail' },
];

/**
 * One finding of each of three kinds, again disagreeing on every column:
 *   £75  10 Mar  Credit card     no other side
 *   £200 01 May  Joint account   taken
 *   £1000 20 Jun Current account filed
 */
const STRANDED_SORT_HISTORY: Transaction[] = [
  ...CLAIMED_TWIN_HISTORY,
  txn({ id: 'lonely', amount: -75, accountId: 'acc-credit', date: new Date('2026-03-10'), description: 'Transfer to savings' }),
  txn({ id: 'mystery', amount: -1000, accountId: 'acc-current', date: new Date('2026-06-20'), description: 'Sweep to reserve' }),
  txn({ id: 'filed', amount: 1000, accountId: 'acc-joint', type: 'income', date: new Date('2026-06-20'), description: 'Bonus', category: 'cat-salary' }),
];

/** One table's rows in render order, each identified by its Amount cell. */
const orderOf = (rowTitle: string, amountCell: number): string[] =>
  screen.getAllByRole('row')
    .filter(r => r.getAttribute('title') === rowTitle)
    .map(r => within(r).getAllByRole('cell')[amountCell].textContent?.trim() ?? '');

const pairOrder = (): string[] => orderOf('See both sides of this pair', 4);
const strandedOrder = (): string[] => orderOf('Look at the evidence for this row', 3);

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

describe('TransferSweepModal — sorting the clean pairs', () => {
  beforeEach(() => {
    __setAppContextValue({ transactions: PAIR_HISTORY, categories: CATEGORIES });
  });

  it('opens in the order the sweep emitted, with no column claimed', () => {
    renderModal();

    expect(pairOrder()).toEqual(['£50.00', '£900.00', '£300.00']);
    // Exact names: an arrow on any heading would mean a column had been
    // applied, and something would have moved before the user asked.
    expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amount' })).toBeInTheDocument();
  });

  it('sorts Amount by magnitude, biggest first, and flips on a second click', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));
    expect(pairOrder()).toEqual(['£900.00', '£300.00', '£50.00']);

    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));
    expect(pairOrder()).toEqual(['£50.00', '£300.00', '£900.00']);
  });

  it('sorts the accounts column by the RESOLVED names, not the ids', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^From/ }));

    // Credit card →, Current account →, Joint account → : ids would have
    // given acc-credit, acc-current, acc-joint — the same order by accident,
    // so the £300 row leading is what separates the two.
    expect(pairOrder()).toEqual(['£300.00', '£50.00', '£900.00']);
  });

  it('reorders rows without disturbing the selection', () => {
    renderModal();
    fireEvent.click(screen.getByLabelText('Link £900.00 transfer'));
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));

    // Selection is keyed by the pair's two transaction ids, so the row that
    // has just moved to the top is still the one the user unticked.
    expect(pairOrder()).toEqual(['£900.00', '£300.00', '£50.00']);
    expect(screen.getByLabelText('Link £900.00 transfer')).not.toBeChecked();
    expect(screen.getByLabelText('Link £50.00 transfer')).toBeChecked();
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
  });
});

describe('TransferSweepModal — sorting the stranded list', () => {
  beforeEach(() => {
    __setAppContextValue({ transactions: STRANDED_SORT_HISTORY, categories: SORT_CATEGORIES });
  });

  it('opens oldest-first, exactly as the classifier emits them', () => {
    renderModal();

    expect(strandedOrder()).toEqual(['£75.00', '£200.00', '£1000.00']);
    expect(screen.getByRole('button', { name: 'Date ↑' })).toBeInTheDocument();
  });

  it('flips Date to newest-first on a click', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Date/ }));

    expect(strandedOrder()).toEqual(['£1000.00', '£200.00', '£75.00']);
    expect(screen.getByRole('button', { name: 'Date ↓' })).toBeInTheDocument();
  });

  it('sorts Account by the resolved account name', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Account/ }));

    // Credit card, Current account, Joint account.
    expect(strandedOrder()).toEqual(['£75.00', '£1000.00', '£200.00']);
  });

  it('sorts "What is wrong" by the badge each row shows', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^What is wrong/ }));

    // filed, no other side, taken.
    expect(strandedOrder()).toEqual(['£1000.00', '£75.00', '£200.00']);
  });

  it('sorts Amount by magnitude, biggest first', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));

    expect(strandedOrder()).toEqual(['£1000.00', '£200.00', '£75.00']);
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
