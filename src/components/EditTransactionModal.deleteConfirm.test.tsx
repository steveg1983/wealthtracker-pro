/**
 * EditTransactionModal — what the delete confirmation admits to.
 *
 * `transactions_linked_transfer_id_fkey` is ON DELETE SET NULL and
 * `delete_transaction_atomic` removes one row and reverses one balance. So
 * deleting half of a linked transfer does not remove the movement: the other
 * leg stays in the other account, still moving that account's balance, with its
 * link silently nulled. The confirmation used to say only "This action cannot
 * be undone", which is true and beside the point — the part that cannot be
 * undone happens in an account the user is not looking at.
 *
 * These tests hold the confirmation to naming that consequence, and to staying
 * quiet when there is no consequence to name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Account, Transaction } from '../types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    categories: [
      { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
      { id: 'sub-bills', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'det-tax', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-bills' },
    ],
    updateTransaction: vi.fn(async () => {}),
    deleteTransaction: vi.fn(),
    getTransactionSplits: vi.fn(async () => []),
    setTransactionSplits: vi.fn(async () => ({ isSplit: false, splitCount: 0, amount: 0 })),
    linkTransferPair: vi.fn(async () => ({ a: {}, b: {} })),
    createTransferCounterpart: vi.fn(async () => ({ source: {}, counterpart: {} })),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ pathname: '/accounts/acc-a', search: '', hash: '', state: null, key: 'test' }),
  };
});

vi.mock('../contexts/AppContextSupabase', () => ({ useApp: () => mocks.app }));

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

vi.mock('../hooks/useTransactionNotifications', () => ({
  useTransactionNotifications: () => ({ addTransaction: vi.fn(async () => {}) }),
}));

vi.mock('../hooks/usePayeeMemory', () => ({
  usePayeeMemory: () => ({ propagateCategory: vi.fn(async () => {}) }),
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children, title }: { isOpen: boolean; children: ReactNode; title: string }) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./CategorySelector', () => ({ default: () => <div data-testid="category-selector" /> }));
vi.mock('./TagSelector', () => ({ default: () => <div data-testid="tag-selector" /> }));
vi.mock('./MarkdownEditor', () => ({ default: () => <div data-testid="markdown-editor" /> }));
vi.mock('./DocumentManager', () => ({ default: () => <div data-testid="document-manager" /> }));
vi.mock('./CategoryCreationModal', () => ({ default: () => null }));

const account = (id: string, name: string): Account => ({
  id,
  name,
  type: 'current',
  balance: 1000,
  currency: 'GBP',
  lastUpdated: new Date('2027-02-01'),
  isActive: true,
});

const OUT_LEG: Transaction = {
  id: 'txn-out',
  date: new Date('2027-02-10'),
  description: 'Transfer to savings',
  amount: -500,
  type: 'transfer',
  category: 'tofrom-b',
  accountId: 'acc-a',
  transferAccountId: 'acc-b',
  linkedTransferId: 'txn-in',
  cleared: false,
};

const IN_LEG: Transaction = {
  id: 'txn-in',
  date: new Date('2027-02-10'),
  description: 'Transfer from current',
  amount: 500,
  type: 'transfer',
  category: 'tofrom-a',
  accountId: 'acc-b',
  transferAccountId: 'acc-a',
  linkedTransferId: 'txn-out',
  cleared: false,
};

const EXPENSE: Transaction = {
  id: 'txn-shop',
  date: new Date('2027-02-10'),
  description: 'Groceries',
  amount: -42.5,
  type: 'expense',
  category: 'det-tax',
  accountId: 'acc-a',
  cleared: false,
};

/** Open the editor on `transaction` and press Delete to raise the confirmation. */
const openDeleteConfirm = (transaction: Transaction): void => {
  render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={transaction} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByText('Delete Transaction?')).toBeInTheDocument();
};

describe('EditTransactionModal — delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [account('acc-a', 'Current Account'), account('acc-b', 'Savings')];
    mocks.app.transactions = [OUT_LEG, IN_LEG, EXPENSE];
  });

  it('names the account the other half is left in, and what happens to it', () => {
    openDeleteConfirm(OUT_LEG);

    expect(
      screen.getByText(/Deleting it will leave the other half in Savings/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/still counted in that account's balance but no longer linked to anything/)
    ).toBeInTheDocument();
  });

  it('warns from the incoming leg too, naming the account facing it', () => {
    openDeleteConfirm(IN_LEG);

    expect(
      screen.getByText(/Deleting it will leave the other half in Current Account/)
    ).toBeInTheDocument();
  });

  it('says nothing extra for an ordinary transaction', () => {
    openDeleteConfirm(EXPENSE);

    // The generic line still stands; nothing is invented on top of it.
    expect(
      screen.getByText('Are you sure you want to delete this transaction? This action cannot be undone.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/one half of a transfer/)).not.toBeInTheDocument();
  });

  it('does not offer to delete the other side for the user', () => {
    // Cascading into another account unasked is worse than stranding a row, so
    // this is consent and nothing more: it names the consequence and offers the
    // same two choices it always did.
    openDeleteConfirm(OUT_LEG);

    const panel = screen.getByText('Delete Transaction?').closest('div');
    if (!panel) throw new Error('the confirmation panel is not on screen');
    expect(within(panel).getAllByRole('button').map(button => button.textContent))
      .toEqual(['Cancel', 'Delete']);
    expect(mocks.app.deleteTransaction).not.toHaveBeenCalled();
  });
});
