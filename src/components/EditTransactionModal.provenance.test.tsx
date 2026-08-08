/**
 * EditTransactionModal — symmetry with the register about who chose the
 * category.
 *
 * A row that reads "Suggested" in the register and reads like the user's own
 * choice in the editor is worse than no marker at all: the user would have to
 * work out which screen is lying. So the editor shows the same badge over its
 * category picker.
 *
 * DISPLAY ONLY, deliberately. There is no Confirm button here because saving IS
 * the confirmation — the update path records a category the user looked at and
 * let stand, or changed, as one they vouch for. A second confirm mechanism
 * would only give them two ways to say the same thing.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      { id: 'det-dining', name: 'Dining out', type: 'expense', level: 'detail', parentId: 'sub-food' },
    ],
    // The real CategorySelector is left unmocked — the badge sits beside it and
    // its behaviour (the picker still working, the badge coming off when the
    // user picks something else) is the point — so the context has to answer
    // the questions it asks.
    getSubCategories: (parentId?: string) =>
      [{ id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' }]
        .filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) =>
      [
        { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
        { id: 'det-dining', name: 'Dining out', type: 'expense', level: 'detail', parentId: 'sub-food' },
      ].filter(c => c.parentId === parentId),
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
    useLocation: () => ({ pathname: '/transactions', search: '', hash: '', state: null, key: 'test' }),
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

const ACCOUNT: Account = {
  id: 'acc-a',
  name: 'Synthetic Current',
  type: 'current',
  balance: 500,
  currency: 'GBP',
  lastUpdated: new Date('2026-04-01'),
  isActive: true,
};

const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-editor',
  date: new Date('2026-04-02'),
  description: 'Synthetic editor row',
  amount: -18.25,
  type: 'expense',
  category: 'det-groceries',
  accountId: 'acc-a',
  cleared: false,
  ...over,
});

describe('EditTransactionModal — a category the app guessed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [ACCOUNT];
    mocks.app.transactions = [];
  });

  it('shows the same badge the register shows, in words', () => {
    render(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={row({ categoryConfirmed: false })} />
    );

    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getByText(/category — not confirmed yet/)).toBeInTheDocument();
  });

  it('invents no second way to confirm — saving is the answer', () => {
    render(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={row({ categoryConfirmed: false })} />
    );

    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('says nothing about a category the user stands behind', () => {
    render(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={row({ categoryConfirmed: true })} />
    );

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('treats a row with no provenance flag as the user\'s own', () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('never marks a transfer, whose category follows the account it points at', () => {
    render(
      <EditTransactionModal
        isOpen
        onClose={vi.fn()}
        transaction={row({ type: 'transfer', categoryConfirmed: false, transferAccountId: 'acc-b' })}
      />
    );

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  /**
   * Provenance is a fact about what is SAVED, and the badge is read from the
   * stored row — but the moment the user picks something else it is their
   * choice, and it must stop looking like a guess as they make it rather than
   * after a save and a round trip.
   */
  it('drops the badge the moment the user picks a different category', () => {
    render(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={row({ categoryConfirmed: false })} />
    );
    expect(screen.getByText('Suggested')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByText('Dining out'));

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('says nothing on a NEW transaction, which has no stored row to have guessed at', () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={null} />);

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
  });
});
