/**
 * TransferSweepModal — LINE matches, and the split lines with no other side.
 *
 * The owner's case end to end through the UI: £35,000 arrives, £30,000 of it
 * settles a loan (a transfer LINE inside the split), and the £30,000 already
 * sitting in the loan account is offered as that line's other side. Nothing
 * about the two ROWS matches — so what these tests pin is that the offer shows
 * the evidence that makes it judgeable (the line's own amount against the
 * parent's total, the account it names, the row over there) and that accepting
 * it calls the LINE write, never the whole-transaction one.
 *
 * The last block covers the deliberate absence: a line whose other side cannot
 * be found is explained and left alone. There is no fix button, on purpose.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransferSweepModal from './TransferSweepModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Category, Transaction, TransactionSplit } from '../types';

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
    'acc-loan': 'Friend loan',
  }[id] ?? id),
}));

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
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
  { id: 'cat-dental', name: 'Dental', type: 'expense', level: 'detail' },
];

const PARENT: Transaction = txn({
  id: 'repayment', accountId: 'acc-current', amount: 35000, type: 'income',
  description: 'Repaid in full', isSplit: true,
});

const LOAN_ROW: Transaction = txn({
  id: 'loan-row', accountId: 'acc-loan', amount: -30000, description: 'Repaid in full',
});

const SPLITS: TransactionSplit[] = [
  { id: 'leg', transactionId: 'repayment', category: 'tofrom-loan', amount: 30000, sortOrder: 1, transferAccountId: 'acc-loan' },
  { id: 'interest', transactionId: 'repayment', category: 'cat-interest', amount: 5000, sortOrder: 2 },
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

describe('TransferSweepModal — a split line matched to its other side', () => {
  beforeEach(() => {
    __setAppContextValue({
      transactions: [PARENT, LOAN_ROW],
      transactionSplits: SPLITS,
      categories: CATEGORIES,
    });
  });

  it('lists the line beside the clean pairs, marked for what it is', () => {
    renderModal();

    const row = screen.getByTitle('See this split line and its match');
    expect(within(row).getByText('split line')).toBeInTheDocument();
    // The evidence that makes it judgeable: the LINE's amount, and the
    // parent's total beside it — the two differing is the whole point.
    expect(within(row).getByText('Repaid in full')).toBeInTheDocument();
    expect(within(row).getByText('£30000.00 of the £35000.00 in this split')).toBeInTheDocument();
    // From → To reads by the LINE's sign: money left the loan account.
    expect(within(row).getByText('Friend loan')).toBeInTheDocument();
    expect(within(row).getByText('Current account')).toBeInTheDocument();
    // Ticked by default, exactly like an unambiguous pair.
    expect(screen.getByLabelText('Link £30000.00 split line transfer')).toBeChecked();
    expect(screen.getByText('1 of 1 selected')).toBeInTheDocument();
  });

  it('shows both sides, and the line\'s own account, when the row is opened', () => {
    renderModal();
    fireEvent.click(screen.getByTitle('See this split line and its match'));

    const dialog = screen.getAllByRole('dialog')[1];
    expect(within(dialog).getByRole('heading', { name: 'Check this split line' })).toBeInTheDocument();
    expect(within(dialog).getByText('One line of a split')).toBeInTheDocument();
    expect(within(dialog).getByText('Its other side')).toBeInTheDocument();
    expect(within(dialog).getByText(/moving to Friend loan/)).toBeInTheDocument();
    expect(within(dialog).getByText(/The rest of the split is untouched/)).toBeInTheDocument();
  });

  it('applies through linkSplitLineTransfer, with the LINE id — never the parent\'s', async () => {
    const calls: string[] = [];
    __setAppContextValue({
      linkTransferPair: async (idA: string, idB: string) => {
        calls.push(`pair:${idA},${idB}`);
        return { a: PARENT, b: LOAN_ROW };
      },
      linkSplitLineTransfer: async (splitId: string, transactionId: string) => {
        calls.push(`line:${splitId},${transactionId}`);
        return { split: SPLITS[0], transaction: LOAN_ROW };
      },
    });
    renderModal();
    expect(calls).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Link 1 pair' }));

    await waitFor(() => expect(calls).toEqual(['line:leg,loan-row']));
  });

  it('does not apply a line the user unticked', async () => {
    const calls: string[] = [];
    __setAppContextValue({
      linkSplitLineTransfer: async (splitId: string, transactionId: string) => {
        calls.push(`line:${splitId},${transactionId}`);
        return { split: SPLITS[0], transaction: LOAN_ROW };
      },
    });
    renderModal();

    fireEvent.click(screen.getByLabelText('Link £30000.00 split line transfer'));
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Link/ })).toBeDisabled();
    expect(calls).toEqual([]);
  });

  it('sorts alongside the pairs, in one table', () => {
    const pairOut = txn({ id: 'pair-out', accountId: 'acc-current', amount: -50, date: new Date('2026-01-10') });
    const pairIn = txn({ id: 'pair-in', accountId: 'acc-loan', amount: 50, type: 'income', date: new Date('2026-01-10') });
    __setAppContextValue({
      transactions: [PARENT, LOAN_ROW, pairOut, pairIn],
      transactionSplits: SPLITS,
      categories: CATEGORIES,
    });
    renderModal();

    /** The match table in render order: 'pair' or 'line' per row. */
    const kinds = (): string[] =>
      screen.getAllByRole('row')
        .map(r => r.getAttribute('title'))
        .filter((t): t is string => Boolean(t?.startsWith('See ')))
        .map(t => (t === 'See both sides of this pair' ? 'pair' : 'line'));

    // Pairs first, then the line matches — the order the sweep found them in.
    expect(kinds()).toEqual(['pair', 'line']);
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();

    // Amount sorts by magnitude, biggest first — across both kinds.
    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));
    expect(kinds()).toEqual(['line', 'pair']);

    // And the selection followed the rows that moved.
    expect(screen.getByLabelText('Link £30000.00 split line transfer')).toBeChecked();
    expect(screen.getByLabelText('Link £50.00 transfer')).toBeChecked();
  });
});

describe('TransferSweepModal — a split line with no other side', () => {
  it('explains the problem and offers no fix at all', () => {
    __setAppContextValue({
      transactions: [PARENT],
      transactionSplits: SPLITS,
      categories: CATEGORIES,
    });
    renderModal();

    expect(screen.getByText('Split lines with no other side')).toBeInTheDocument();
    expect(screen.getByText(/Nothing in Friend loan within a few days is the other side of this line/))
      .toBeInTheDocument();
    expect(screen.getByText(/Nothing here is changed for you/)).toBeInTheDocument();
    // The evidence: the line's amount, and the parent's total under it.
    expect(screen.getByText('of £35000.00')).toBeInTheDocument();
    // Read-only: the only button on the row opens the transaction.
    expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('names the category when the matching row is filed under one', () => {
    __setAppContextValue({
      transactions: [PARENT, { ...LOAN_ROW, category: 'cat-dental' }],
      transactionSplits: SPLITS,
      categories: CATEGORIES,
    });
    renderModal();

    expect(screen.getByText(/is filed under “Dental”/)).toBeInTheDocument();
    expect(screen.queryByTitle('See this split line and its match')).not.toBeInTheDocument();
  });
});
