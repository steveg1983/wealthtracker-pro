/**
 * EditTransactionModal — "jump to the other side" for linked transfers.
 *
 * A linked transfer is one movement recorded twice. Editing either half must
 * offer a one-click hop to the other, deep-linked into that account's register
 * (?txn=<id>, which selects, centres and docks the row). The modal is shared by
 * the register, reconciliation and every report drill, so the button must work
 * without assuming a host page — and must stay away from rows that have no
 * other side.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Account, Transaction } from '../types';

// One stable context object, mutated between tests. The modal re-seeds its
// form from `accounts`/`categories` identity, so a `useApp()` that returned a
// fresh object per render would loop it forever.
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  // Mutable so a test can put the app in demo mode without a real router.
  search: { value: '' },
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
    // The recurring-verdict door (the modal's "This is a recurring payment"
    // tick). Present in every mock of this context because the component reads
    // it on every render: an omitted field is a mock claiming a context shape
    // the app does not have.
    suggestionDismissals: [],
    suggestionDismissalsStatus: 'ready',
    dismissSuggestion: vi.fn(async () => {}),
    restoreSuggestion: vi.fn(async () => {}),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({
      pathname: '/accounts/acc-a',
      search: mocks.search.value,
      hash: '',
      state: null,
      key: 'test',
    }),
  };
});

const account = (id: string, name: string): Account => ({
  id,
  name,
  type: 'current',
  balance: 1000,
  currency: 'GBP',
  lastUpdated: new Date('2026-06-01'),
  isActive: true,
});

const OUT_LEG: Transaction = {
  id: 'txn-out',
  date: new Date('2026-06-10'),
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
  date: new Date('2026-06-10'),
  description: 'Transfer from current',
  amount: 500,
  type: 'transfer',
  category: 'tofrom-a',
  accountId: 'acc-b',
  transferAccountId: 'acc-a',
  linkedTransferId: 'txn-out',
  cleared: false,
};

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => mocks.app,
}));

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

const jumpButton = (): HTMLElement =>
  screen.getByRole('button', { name: /jump to the other side/i });

const queryJumpButton = (): HTMLElement | null =>
  screen.queryByRole('button', { name: /jump to the other side/i });

const renderModal = (transaction: Transaction | null, onClose = vi.fn()): { onClose: ReturnType<typeof vi.fn> } => {
  render(<EditTransactionModal isOpen onClose={onClose} transaction={transaction} />);
  return { onClose };
};

describe('EditTransactionModal — jump to the other side', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.value = '';
    mocks.app.accounts = [account('acc-a', 'Current Account'), account('acc-b', 'Savings')];
    mocks.app.transactions = [OUT_LEG, IN_LEG];
  });

  it('offers the jump from the outgoing leg and deep-links to the other register', () => {
    const { onClose } = renderModal(OUT_LEG);

    const button = jumpButton();
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Jump to the other side in Savings →');
    expect(button).toBeEnabled();

    fireEvent.click(button);

    // The modal gets out of the way first, then the register takes over.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-b?txn=txn-in');
  });

  it('offers the same jump from the incoming leg, pointing back', () => {
    renderModal(IN_LEG);

    expect(jumpButton()).toHaveTextContent('Jump to the other side in Current Account →');
    fireEvent.click(jumpButton());

    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-a?txn=txn-out');
  });

  it('falls back to transferAccountId when the linked row is not loaded', () => {
    // Imported history routinely carries the link without the counterpart in
    // the current working set; the denormalised account is then all there is.
    mocks.app.transactions = [OUT_LEG];
    renderModal(OUT_LEG);

    fireEvent.click(jumpButton());
    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-b?txn=txn-in');
  });

  it('preserves demo mode in the deep link', () => {
    mocks.search.value = '?demo=true';
    renderModal(OUT_LEG);

    fireEvent.click(jumpButton());
    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-b?txn=txn-in&demo=true');
  });

  it('still takes the jump when the other account is closed, saying what to expect', () => {
    // Closed accounts are absent from the context's account list — so the name
    // cannot be printed, and the label stays generic. The jump is offered all
    // the same: the register owns the closed-account offer ("Re-open and
    // view"), so the way through arrives where the user asked for it rather
    // than being described as homework on another page.
    mocks.app.accounts = [account('acc-a', 'Current Account')];
    renderModal(OUT_LEG);

    const button = jumpButton();
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Jump to the other side →');
    expect(button).toHaveAttribute(
      'title',
      'That account is closed — the register will offer to re-open it'
    );
    expect(
      screen.getByText(/that account is closed — the register will offer to re-open it/i)
    ).toBeInTheDocument();

    fireEvent.click(button);
    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-b?txn=txn-in');
  });

  it('does not offer the jump for a transfer with no linked side', () => {
    const unlinked: Transaction = {
      ...OUT_LEG,
      id: 'txn-lonely',
      linkedTransferId: undefined,
    };
    mocks.app.transactions = [unlinked];
    renderModal(unlinked);

    expect(queryJumpButton()).toBeNull();
  });

  it('does not offer the jump for an ordinary expense', () => {
    const expense: Transaction = {
      id: 'txn-shop',
      date: new Date('2026-06-10'),
      description: 'Groceries',
      amount: -42.5,
      type: 'expense',
      category: 'det-tax',
      accountId: 'acc-a',
      cleared: false,
    };
    mocks.app.transactions = [expense];
    renderModal(expense);

    expect(queryJumpButton()).toBeNull();
  });

  it('does not offer the jump for a new transaction', () => {
    renderModal(null);

    expect(queryJumpButton()).toBeNull();
  });

  it('offers every OTHER account as a transfer target, banded and searchable', () => {
    // The target rides in the category field as 'transfer:<id>' until save
    // resolves it — the shared picker must not change that, nor start
    // printing types or balances beside the name.
    mocks.app.accounts = [
      account('acc-a', 'Current Account'),
      { ...account('acc-b', 'Savings'), type: 'savings' },
      { ...account('acc-c', 'Barclaycard'), type: 'credit' },
      { ...account('acc-d', 'Closed Card'), type: 'credit', isActive: false },
    ];
    renderModal(OUT_LEG);

    // An existing transfer opens showing the target it already has.
    const target = screen.getByRole('combobox', { name: 'Transfer destination account' });
    expect(target).toHaveTextContent('Savings');

    fireEvent.click(target);
    const list = screen.getByRole('listbox', { name: 'Transfer destination account' });
    expect(
      Array.from(list.children)
        .filter(child => child.getAttribute('role') === 'group')
        .map(child => child.getAttribute('aria-label'))
    ).toEqual(['Savings Accounts', 'Credit Cards']);
    // This account and the closed one are both absent; the rest are named plainly.
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Savings', 'Barclaycard']);
    // Selected by the 'transfer:' sentinel, not the bare account id.
    expect(screen.getByRole('option', { name: 'Savings' })).toHaveAttribute('aria-selected', 'true');

    // Type to filter, then pick — the whole point of the change.
    fireEvent.change(screen.getByPlaceholderText('Search or select account to transfer to…'), {
      target: { value: 'barclay' },
    });
    fireEvent.click(screen.getByText('Barclaycard'));
    expect(screen.getByRole('combobox', { name: 'Transfer destination account' }))
      .toHaveTextContent('Barclaycard');
  });
});
