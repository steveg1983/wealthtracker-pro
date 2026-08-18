/**
 * EditTransactionModal — a split LINE that is itself a transfer.
 *
 * The Microsoft Money model, and Steve's case: one £35,000 payment arrives,
 * £30,000 of it settles a loan (money moving between his own accounts) and
 * £5,000 is interest (income). That is one transaction with two lines, one of
 * which is a transfer — and until now the split-line picker offered only
 * income/expense categories, so it could not be said at all.
 *
 * The other half of the story is editing a split that ALREADY contains a leg:
 * re-filing the line NEXT TO one strands nothing and must work, while the leg
 * itself stays exactly as the transaction on its other side expects it.
 *
 * The real CategorySelector renders here — the point of these tests is what
 * the picker offers and what reaches the writer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Account, Category, Transaction, TransactionSplit } from '../types';

const CURRENT = '11111111-1111-4111-8111-111111111111';
const SAVINGS = '22222222-2222-4222-8222-222222222222';
const TXN = '33333333-3333-4333-8333-333333333333';

const categories: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'sub-bills', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-tax', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-bills' },
  { id: 'type-income', name: 'Income', type: 'income', level: 'type' },
  { id: 'sub-earnings', name: 'Earnings', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'det-interest', name: 'Interest', type: 'income', level: 'detail', parentId: 'sub-earnings' },
  // Where the MS Money importer parks a line it could not classify — the
  // filing the owner is trying to correct.
  {
    id: 'unassigned', name: 'Unassigned (MS Money import)', type: 'both', level: 'detail',
    parentId: 'sub-bills', isUnassignedBucket: true,
  },
  // Account-managed To/From categories: detail rows under the Transfer root.
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
  {
    id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: SAVINGS,
  },
  {
    id: 'tofrom-current', name: 'To/From Current Account', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: CURRENT,
  },
];

const account = (id: string, name: string): Account => ({
  id,
  name,
  type: 'current',
  balance: 1000,
  currency: 'GBP',
  lastUpdated: new Date('2026-06-01'),
  isActive: true,
});

const EXPENSE: Transaction = {
  id: TXN,
  date: new Date('2026-06-10'),
  description: 'Monthly outgoings',
  amount: -400,
  type: 'expense',
  category: 'det-tax',
  accountId: CURRENT,
  cleared: false,
};

/** The same row, already split, with its second line half of a transfer. */
const SPLIT_WITH_LEG: Transaction = { ...EXPENSE, category: '', isSplit: true };

const STORED_LINES: TransactionSplit[] = [
  { id: 'unfiled', transactionId: TXN, category: 'unassigned', amount: -300, sortOrder: 1 },
  {
    id: 'leg-line', transactionId: TXN, category: 'tofrom-savings', amount: -100, sortOrder: 2,
    transferAccountId: SAVINGS, linkedTransferId: 'counterpart',
  },
];

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    categories: [] as Category[],
    updateTransaction: vi.fn(async () => {}),
    deleteTransaction: vi.fn(),
    addCategory: vi.fn(),
    getSubCategories: (_parentId?: string): Category[] => [],
    getDetailCategories: (_parentId?: string): Category[] => [],
    getTransactionSplits: vi.fn(async (): Promise<TransactionSplit[]> => []),
    setTransactionSplits: vi.fn(async () => ({
      isSplit: true, splitCount: 2, amount: -400, counterparts: [],
    })),
    linkTransferPair: vi.fn(),
    createTransferCounterpart: vi.fn(),
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
    useLocation: () => ({ pathname: '/accounts/x', search: '', hash: '', state: null, key: 'test' }),
  };
});

vi.mock('../contexts/AppContextSupabase', () => ({ useApp: () => mocks.app }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(),
    showWarning: vi.fn(), showInfo: vi.fn(), dismissToast: vi.fn(),
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

const PICKER_PLACEHOLDER = 'Search or select category…';

const splitToggle = (): HTMLElement =>
  screen.getByRole('checkbox', { name: /split across multiple categories/i });

const renderModal = (transaction: Transaction): void => {
  render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={transaction} />);
};

/** Open the nth split-line picker (in line order) and choose a category. */
const chooseCategory = (label: string, pickerIndex: number): void => {
  fireEvent.click(screen.getAllByRole('combobox', { name: 'Category' })[pickerIndex]);
  fireEvent.click(screen.getByText(label));
};

describe('EditTransactionModal — split lines that are transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [account(CURRENT, 'Current Account'), account(SAVINGS, 'Savings')];
    mocks.app.transactions = [EXPENSE];
    mocks.app.categories = categories;
    mocks.app.getSubCategories = (parentId?: string) =>
      categories.filter(c => c.parentId === parentId);
    mocks.app.getDetailCategories = (parentId?: string) =>
      categories.filter(c => c.parentId === parentId && c.level === 'detail');
    mocks.app.getTransactionSplits.mockResolvedValue([]);
  });

  describe('creating one', () => {
    it('offers the To/From account categories on a split line, under their own heading', () => {
      renderModal(EXPENSE);
      fireEvent.click(splitToggle());

      // The second (empty) line's picker.
      fireEvent.click(screen.getAllByText(PICKER_PLACEHOLDER)[0]);

      expect(screen.getByText('Transfer to another account')).toBeInTheDocument();
      expect(screen.getByText('To/From Savings')).toBeInTheDocument();
      // Never the account this transaction is already in.
      expect(screen.queryByText('To/From Current Account')).not.toBeInTheDocument();
      // And the ordinary categories are still all there.
      expect(screen.getByText('Council Tax')).toBeInTheDocument();
      expect(screen.getByText('Interest')).toBeInTheDocument();
    });

    it('says what the line now means, before it is saved', () => {
      renderModal(EXPENSE);
      fireEvent.click(splitToggle());
      chooseCategory('To/From Savings', 1);

      expect(
        screen.getByText(/Transfer with Savings — saving creates the matching transaction there/)
      ).toBeInTheDocument();
    });

    it('asks the writer for the leg, with the account on the other side', async () => {
      renderModal(EXPENSE);
      fireEvent.click(splitToggle());

      fireEvent.change(screen.getByLabelText('Split line 1 amount'), { target: { value: '300' } });
      chooseCategory('To/From Savings', 1);
      fireEvent.change(screen.getByLabelText('Split line 2 amount'), { target: { value: '100' } });

      // The remainder reads zero — a transfer line counts toward the parent
      // total exactly like any other line.
      expect(screen.getByText('Fully allocated ✓')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(mocks.app.setTransactionSplits).toHaveBeenCalledTimes(1));
      expect(mocks.app.setTransactionSplits).toHaveBeenCalledWith(
        TXN,
        [
          { category: 'det-tax', amount: -300 },
          { category: 'tofrom-savings', amount: -100, transferAccountId: SAVINGS },
        ],
        -400
      );
    });

    it('drops the target again when the line is re-filed as an ordinary category', () => {
      renderModal(EXPENSE);
      fireEvent.click(splitToggle());
      chooseCategory('To/From Savings', 1);
      expect(screen.getByText(/Transfer with Savings/)).toBeInTheDocument();

      // The picker now shows the chosen name, so reopen it by its label.
      fireEvent.click(screen.getAllByRole('combobox', { name: 'Category' })[1]);
      fireEvent.click(screen.getByText('Interest'));

      expect(screen.queryByText(/Transfer with Savings/)).not.toBeInTheDocument();
    });
  });

  describe('editing a split that already contains one', () => {
    beforeEach(() => {
      mocks.app.transactions = [SPLIT_WITH_LEG];
      mocks.app.getTransactionSplits.mockResolvedValue(STORED_LINES);
    });

    it('shows the leg as a transfer, not as an editable category', async () => {
      renderModal(SPLIT_WITH_LEG);

      expect(await screen.findByText('Transfer — Savings')).toBeInTheDocument();
      expect(
        screen.getByText(/its other side is already recorded there, so this line can't change/)
      ).toBeInTheDocument();
      // One picker for the ordinary line; none for the leg.
      expect(screen.getAllByRole('combobox', { name: 'Category' })).toHaveLength(1);
      // Its amount is shown, not offered for editing.
      expect(screen.getByLabelText('Split line 2 amount').tagName).not.toBe('INPUT');
    });

    it('will not let the split be un-split — that deletes every line', async () => {
      renderModal(SPLIT_WITH_LEG);
      await screen.findByText('Transfer — Savings');

      expect(splitToggle()).toBeDisabled();
      expect(splitToggle()).toHaveAttribute(
        'title',
        'One of these lines is a transfer — delete that transfer first to un-split this transaction'
      );
    });

    it('is honest about a leg whose other side has been deleted', async () => {
      // transfer_account_id survives, linked_transfer_id does not (ON DELETE
      // SET NULL). The row that matches it may still be sitting in that
      // account unmatched, so saving must not invent a second one — and the
      // line must not promise that it will.
      mocks.app.getTransactionSplits.mockResolvedValue([
        STORED_LINES[0],
        { ...STORED_LINES[1], linkedTransferId: undefined },
      ]);
      renderModal(SPLIT_WITH_LEG);

      expect(
        await screen.findByText(/the matching transaction there is missing. Saving leaves this line as it is/)
      ).toBeInTheDocument();
      // It is not locked — nothing points at it any more.
      expect(screen.getAllByRole('combobox', { name: 'Category' })).toHaveLength(2);
      expect(splitToggle()).toBeEnabled();
    });

    it("files the line NEXT to the leg, and hands the leg back exactly as stored", async () => {
      // The owner's case: 78 of his splits contain a leg and 33 still have a
      // line needing a category. Categorising one strands nothing.
      renderModal(SPLIT_WITH_LEG);
      await screen.findByText('Transfer — Savings');

      chooseCategory('Council Tax', 0);
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(mocks.app.setTransactionSplits).toHaveBeenCalledTimes(1));
      expect(mocks.app.setTransactionSplits).toHaveBeenCalledWith(
        TXN,
        [
          { id: 'unfiled', category: 'det-tax', amount: -300 },
          {
            id: 'leg-line', category: 'tofrom-savings', amount: -100,
            transferAccountId: SAVINGS,
          },
        ],
        -400
      );
    });
  });
});
