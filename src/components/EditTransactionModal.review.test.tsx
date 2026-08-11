/**
 * EditTransactionModal — the full editor's half of "a save is a review".
 *
 * The register's row editor is where most of a fresh import gets worked
 * through, but the full editor is the other way in (Enter on a highlighted row,
 * a click from the phone card list, a drill from a report), and the owner named
 * both: a row stops being new when "the quick-edit row's Save or Save & Next,
 * or the full editor's Save Changes / Save & Next" commits it.
 *
 * So the rule has to hold here too, and — just as importantly — it must NOT
 * hold for the way out that writes nothing: Cancel leaves the row as it found
 * it, still bold, still counted. (Escape on the register's own row editor is
 * the same rule, proved where that editor lives —
 * pages/__tests__/AccountTransactions.review.test.tsx.)
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Account, Transaction } from '../types';

const mocks = vi.hoisted(() => ({
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    categories: [
      { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
      { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
    ],
    getSubCategories: (parentId?: string) =>
      [{ id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' }]
        .filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) =>
      [{ id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' }]
        .filter(c => c.parentId === parentId),
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
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/find', search: '', hash: '', state: null, key: 'test' }),
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

vi.mock('./TagSelector', () => ({ default: () => <div data-testid="tag-selector" /> }));
vi.mock('./MarkdownEditor', () => ({ default: () => <div data-testid="markdown-editor" /> }));
vi.mock('./DocumentManager', () => ({ default: () => <div data-testid="document-manager" /> }));
vi.mock('./CategoryCreationModal', () => ({ default: () => null }));

/**
 * UUID-shaped synthetic ids, not the friendly 'acc-a' the other suites use.
 * This file drives a REAL save all the way through ValidationService, which
 * checks that ids are UUIDs — a readable id fails validation and the write
 * never happens, which would make every assertion below pass for the wrong
 * reason if it were asserting absence, and fail confusingly since it is not.
 */
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const TRANSACTION_ID = '22222222-2222-4222-8222-222222222222';

const ACCOUNT: Account = {
  id: ACCOUNT_ID,
  name: 'Synthetic Current',
  type: 'current',
  balance: 500,
  currency: 'GBP',
  lastUpdated: new Date('2026-04-01'),
  isActive: true,
};

/** A row that arrived on a statement and has not been dealt with. */
const newRow = (over: Partial<Transaction> = {}): Transaction => ({
  id: TRANSACTION_ID,
  date: new Date('2026-04-02'),
  description: 'Synthetic editor row',
  amount: -18.25,
  type: 'expense',
  category: 'det-groceries',
  accountId: ACCOUNT_ID,
  cleared: false,
  needsReview: true,
  ...over,
});

/** What the one write of this save was told to change. */
const savedUpdates = (): Record<string, unknown> => {
  const call = mocks.app.updateTransaction.mock.calls[0];
  if (!call) throw new Error('nothing was saved');
  return call[1] as unknown as Record<string, unknown>;
};

describe('EditTransactionModal — a save ends the row\'s review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [ACCOUNT];
    mocks.app.transactions = [];
  });

  it('Save Changes records that the row has been dealt with', async () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={newRow()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mocks.app.updateTransaction).toHaveBeenCalledTimes(1));
    expect(savedUpdates()).toMatchObject({ needsReview: false });
  });

  it('Save & Next records it too, on the way past', async () => {
    render(
      <EditTransactionModal
        isOpen
        onClose={vi.fn()}
        transaction={newRow()}
        onSaveAndNext={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => expect(mocks.app.updateTransaction).toHaveBeenCalledTimes(1));
    expect(savedUpdates()).toMatchObject({ needsReview: false });
  });

  it('Cancel writes nothing, so the row is still waiting', async () => {
    const onClose = vi.fn();
    render(<EditTransactionModal isOpen onClose={onClose} transaction={newRow()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Opening a transaction and shutting it again is not reviewing it. Nothing
    // was written at all, so nothing decided otherwise.
    expect(mocks.app.updateTransaction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * A row already dealt with is saved with the same flag, and that is not a
   * redundancy worth removing: the alternative is the editor deciding whether
   * to mention the field, which is a second rule about review living in a
   * component rather than in one place. `false` written over `false` costs
   * nothing and cannot be wrong.
   */
  it('says the same thing about a row that was already dealt with', async () => {
    render(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={newRow({ needsReview: false })} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mocks.app.updateTransaction).toHaveBeenCalledTimes(1));
    expect(savedUpdates()).toMatchObject({ needsReview: false });
  });
});
