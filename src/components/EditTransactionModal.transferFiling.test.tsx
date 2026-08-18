/**
 * EditTransactionModal — the cure for a row whose transfer category has no
 * other side, and the refusal for the one shape it cannot cure.
 *
 * This is where the Data Health line's remedy lands. A row typed income or
 * expense but filed under "To/From <account>" is treated as a transfer by every
 * report (`classifyFlow` reads the category), so it counts as neither income
 * nor spending, never appears in the uncategorised review band, and still moves
 * the balance — with nothing on the other side to answer for it.
 *
 * Opening it here and saving hands over to the Microsoft Money question the app
 * already asks: is the other side one of these existing rows, or should it be
 * created? Answering writes the pair properly, LINKED, through
 * createTransferCounterpart — never as a second free-standing insert.
 *
 * The exception is a transfer filing that names no account (the legacy
 * transfer-in/transfer-out sentinels). Nothing can be created from it, because
 * the missing fact — which account the money went to — is one only the user
 * has. So the save refuses and says where to supply it.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import type { Account, Category, Transaction } from '../types';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const THRIFT_ID = '33333333-3333-4333-8333-333333333333';
const TRANSACTION_ID = '22222222-2222-4222-8222-222222222222';

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-greengrocer', name: 'Greengrocer', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
  {
    id: 'tofrom-thrift', name: 'To/From Synthetic Thrift', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: THRIFT_ID,
  },
  // Names "transfer" and never names to WHERE.
  { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer' },
];

const mocks = vi.hoisted(() => ({
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    categories: [] as Category[],
    getSubCategories: (_parentId?: string) => [] as Category[],
    getDetailCategories: (_parentId?: string) => [] as Category[],
    updateTransaction: vi.fn(async () => {}),
    deleteTransaction: vi.fn(async () => {}),
    getTransactionSplits: vi.fn(async () => []),
    setTransactionSplits: vi.fn(async () => ({ isSplit: false, splitCount: 0, amount: 0 })),
    linkTransferPair: vi.fn(async () => ({ a: {}, b: {} })),
    createTransferCounterpart: vi.fn(async () => ({ source: {}, counterpart: {} })),
    repointTransfer: vi.fn(async () => ({})),
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
  useTransactionNotifications: () => ({ addTransaction: vi.fn(async () => ({ id: 'created' })) }),
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
  id: ACCOUNT_ID, name: 'Synthetic Current', type: 'current', balance: 500,
  currency: 'GBP', lastUpdated: new Date('2026-04-01'), isActive: true,
};

const THRIFT: Account = {
  id: THRIFT_ID, name: 'Synthetic Thrift', type: 'savings', balance: 900,
  currency: 'GBP', lastUpdated: new Date('2026-04-01'), isActive: true,
};

/** Report 2's row: typed expense, filed as a transfer, alone in the world. */
const strandedRow = (over: Partial<Transaction> = {}): Transaction => ({
  id: TRANSACTION_ID,
  date: new Date('2026-04-02'),
  description: 'Standing order',
  amount: -150,
  type: 'expense',
  category: 'tofrom-thrift',
  accountId: ACCOUNT_ID,
  cleared: false,
  ...over,
});

/**
 * The match-or-create dialog formats money, so it needs the preferences the
 * app supplies — rendering the editor without them throws from a component
 * that has nothing to do with transfers.
 */
const open = (transaction: Transaction): void => {
  render(
    <PreferencesProvider>
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={transaction} />
    </PreferencesProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.app.accounts = [ACCOUNT, THRIFT];
  mocks.app.transactions = [];
  mocks.app.categories = CATEGORIES;
  mocks.app.getSubCategories = (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId);
  mocks.app.getDetailCategories = (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId);
});

describe('a stranded transfer filing, opened in the full editor', () => {
  it('offers to make the other side when it is saved', async () => {
    open(strandedRow());

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    // The field edits commit first (the row has been dealt with even if the
    // question after it is cancelled), then the Money question is asked.
    await waitFor(() => expect(mocks.app.updateTransaction).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: 'Make this a transfer' })).toBeInTheDocument();
  });

  it('writes the pair through the one operation that LINKS it', async () => {
    open(strandedRow());

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create the other side' }));

    // The target comes from the CATEGORY — that is the whole of what the
    // category was trying to say, and the row never has to be re-typed.
    await waitFor(() =>
      expect(mocks.app.createTransferCounterpart).toHaveBeenCalledWith(TRANSACTION_ID, THRIFT_ID)
    );
  });

  it('refuses a transfer filing that names no account, and says where to supply one', async () => {
    open(strandedRow({ category: 'transfer-out' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText(/doesn’t name an account/)).toBeInTheDocument();
    // And nothing was written: saving it as-is would leave the row exactly as
    // invisible as it already is.
    expect(mocks.app.updateTransaction).not.toHaveBeenCalled();
    expect(mocks.app.createTransferCounterpart).not.toHaveBeenCalled();
  });

  it('leaves a row that is ALREADY linked alone — it has its other side', async () => {
    open(strandedRow({ linkedTransferId: '44444444-4444-4444-8444-444444444444' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mocks.app.updateTransaction).toHaveBeenCalledTimes(1));
    expect(mocks.app.createTransferCounterpart).not.toHaveBeenCalled();
  });
});
