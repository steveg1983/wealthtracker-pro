/**
 * EditTransactionModal — "See this transaction in <account>".
 *
 * Editing a row from the categorise page, a report drill or the dashboard
 * shows the row on its own. The surrounding rows and the running balance are
 * often what actually explains it, so the editor offers a way into the
 * register, deep-linked (?txn=<id>) so the row is selected and centred on
 * arrival. It is the same mechanic as the transfer jump, pointed at the row's
 * OWN account — and it stays out of the way when the register IS the host.
 *
 * This file drives the real useModalForm, so the date field assertion here is
 * the genuine ISO round-trip through the component's own state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Account, Transaction } from '../types';

// One stable context object, mutated between tests: the modal re-seeds its
// form from `accounts`/`categories` identity, so a fresh object per render
// would loop it forever.
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
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
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({
      pathname: '/transactions',
      search: mocks.search.value,
      hash: '',
      state: null,
      key: 'test',
    }),
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
  lastUpdated: new Date('2026-06-01'),
  isActive: true,
});

// The date from the owner's report: 6 July 2017, which a US-locale native
// input printed as 07/06/2017.
const SHOP: Transaction = {
  id: 'txn-shop',
  date: new Date('2017-07-06T00:00:00.000Z'),
  description: 'Groceries',
  amount: -42.5,
  type: 'expense',
  category: 'det-tax',
  accountId: 'acc-a',
  cleared: false,
};

const seeInAccount = (): HTMLElement | null =>
  screen.queryByRole('button', { name: /see this transaction in/i });

const renderModal = (
  transaction: Transaction | null,
  props: { onClose?: ReturnType<typeof vi.fn>; hideJumpToAccountId?: string } = {}
): { onClose: ReturnType<typeof vi.fn> } => {
  const onClose = props.onClose ?? vi.fn();
  render(
    <EditTransactionModal
      isOpen
      onClose={onClose}
      transaction={transaction}
      {...(props.hideJumpToAccountId ? { hideJumpToAccountId: props.hideJumpToAccountId } : {})}
    />
  );
  return { onClose };
};

describe('EditTransactionModal — see this transaction in its account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.value = '';
    mocks.app.accounts = [account('acc-a', 'Current Account'), account('acc-b', 'Savings')];
    mocks.app.transactions = [SHOP];
  });

  it('names the account and deep-links the row into its register', () => {
    const { onClose } = renderModal(SHOP);

    const link = seeInAccount();
    expect(link).toHaveTextContent('See this transaction in Current Account');

    fireEvent.click(link as HTMLElement);

    // The editor gets out of the way first; the register then selects,
    // centres and docks the row.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-a?txn=txn-shop');
  });

  it('preserves demo mode in the deep link', () => {
    mocks.search.value = '?demo=true';
    renderModal(SHOP);

    fireEvent.click(seeInAccount() as HTMLElement);
    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-a?txn=txn-shop&demo=true');
  });

  it('falls back to a generic label when the account is closed, and still goes', () => {
    // Closed accounts are absent from the context list, so there is no name to
    // print. The register meets a closed account with its re-open offer, so the
    // jump is still taken rather than disabled.
    mocks.app.accounts = [account('acc-b', 'Savings')];
    renderModal(SHOP);

    expect(seeInAccount()).toHaveTextContent('See this transaction in its account');

    fireEvent.click(seeInAccount() as HTMLElement);
    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-a?txn=txn-shop');
  });

  it('is absent for a new transaction — there is nothing to jump to', () => {
    renderModal(null);

    expect(seeInAccount()).toBeNull();
  });

  it("is absent when the host IS that account's register", () => {
    renderModal(SHOP, { hideJumpToAccountId: 'acc-a' });

    expect(seeInAccount()).toBeNull();
  });

  it('still offers the jump when the host register is a DIFFERENT account', () => {
    renderModal(SHOP, { hideJumpToAccountId: 'acc-b' });

    expect(seeInAccount()).toHaveTextContent('See this transaction in Current Account');
  });

  it('shows the row date in UK order, driven by the real form state', () => {
    renderModal(SHOP);

    // 6 July 2017 — the native input this replaced showed 07/06/2017.
    expect(screen.getByLabelText('Transaction date')).toHaveValue('06/07/2017');
  });
});
