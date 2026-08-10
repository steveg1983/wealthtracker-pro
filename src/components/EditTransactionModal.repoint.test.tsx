/**
 * EditTransactionModal — RE-POINTING a linked transfer, and the Linked transfer
 * flag beside it.
 *
 * The pain this replaces: the Transfer To dropdown let you pick a different
 * account and the save then refused ("This transfer is linked to its opposite
 * transaction. To move it, delete the transfer and recreate it"), while the
 * jump line underneath went on naming the old account — three parts of one
 * field disagreeing with each other, and an exit that destroyed a row.
 *
 * What must be true now: the dropdown works, the counterpart goes with it, the
 * jump line always names where the other half ACTUALLY is, and a counterpart
 * that might be a real bank row stops and asks first.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Account, Transaction } from '../types';

/**
 * UUIDs, not slugs: ValidationService checks the shape of every id before a
 * save leaves the editor, so a readable fixture id would fail validation and
 * the save under test would never run.
 */
const ids = vi.hoisted(() => ({
  ACC_A: '11111111-1111-4111-8111-111111111111',
  ACC_B: '22222222-2222-4222-8222-222222222222',
  ACC_C: '33333333-3333-4333-8333-333333333333',
  TXN_OUT: '44444444-4444-4444-8444-444444444444',
  TXN_IN: '55555555-5555-4555-8555-555555555555',
  TXN_PLAIN: '66666666-6666-4666-8666-666666666666',
}));
const { ACC_A, ACC_B, ACC_C, TXN_OUT, TXN_IN, TXN_PLAIN } = ids;

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    categories: [
      { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
      { id: 'sub-bills', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'tofrom-a', name: 'To/From Current Account', type: 'both', level: 'detail', isTransferCategory: true, accountId: ids.ACC_A },
      { id: 'tofrom-b', name: 'To/From Savings', type: 'both', level: 'detail', isTransferCategory: true, accountId: ids.ACC_B },
      { id: 'tofrom-c', name: 'To/From ISA', type: 'both', level: 'detail', isTransferCategory: true, accountId: ids.ACC_C },
    ],
    updateTransaction: vi.fn(async () => {}),
    deleteTransaction: vi.fn(),
    getTransactionSplits: vi.fn(async () => []),
    setTransactionSplits: vi.fn(async () => ({ isSplit: false, splitCount: 0, amount: 0 })),
    linkTransferPair: vi.fn(async () => ({ a: {}, b: {} })),
    createTransferCounterpart: vi.fn(async () => ({ source: {}, counterpart: {} })),
    repointTransfer: vi.fn(async () => ({ source: {}, counterpart: {}, displaced: { kind: 'moved', fromAccountId: ids.ACC_B } })),
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
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
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
vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({ formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}` }),
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
  id, name, type: 'current', balance: 1000, currency: 'GBP',
  lastUpdated: new Date('2026-06-01'), isActive: true,
});

const born = new Date('2026-06-10T09:00:00.000Z');

/** The edited row, in acc-a, facing acc-b. */
const OUT_LEG: Transaction = {
  id: TXN_OUT,
  date: new Date('2026-06-10'),
  description: 'Transfer to savings',
  amount: -500,
  type: 'transfer',
  category: 'tofrom-b',
  accountId: ACC_A,
  transferAccountId: ACC_B,
  linkedTransferId: TXN_IN,
  cleared: false,
};

/** Its other half — created by the app and never touched since. */
const SCAFFOLD_LEG: Transaction = {
  id: TXN_IN,
  date: new Date('2026-06-10'),
  description: 'Transfer to savings',
  amount: 500,
  type: 'transfer',
  category: 'tofrom-a',
  accountId: ACC_B,
  transferAccountId: ACC_A,
  linkedTransferId: TXN_OUT,
  cleared: false,
  createdAt: born,
  updatedAt: born,
};

/** The reserved case: the same row, reconciled against a real statement. */
const REAL_LEG: Transaction = { ...SCAFFOLD_LEG, cleared: true };

/**
 * Choose a new destination in the Transfer To picker. It is the shared
 * AccountSelector, so the option is a real listbox row — clicking the trigger
 * opens it and the option carries the account's name.
 */
function chooseTransferTarget(name: string): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'Transfer destination account' }));
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
}

const save = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
};

describe('EditTransactionModal — re-pointing a linked transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [
      account(ACC_A, 'Current Account'),
      account(ACC_B, 'Savings'),
      account(ACC_C, 'ISA'),
    ];
    mocks.app.transactions = [OUT_LEG, SCAFFOLD_LEG];
  });

  it('moves the pair without ceremony when the counterpart is provably the app’s own', async () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);

    chooseTransferTarget('ISA');
    save();

    await waitFor(() => {
      expect(mocks.app.repointTransfer).toHaveBeenCalledWith(TXN_OUT, ACC_C, 'move');
    });
    // No question was asked.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('no longer refuses the save it offered in the dropdown', async () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);

    chooseTransferTarget('ISA');
    save();

    await waitFor(() => {
      expect(mocks.app.repointTransfer).toHaveBeenCalled();
    });
    expect(
      screen.queryByText(/delete the transfer and recreate it/i)
    ).not.toBeInTheDocument();
  });

  it('keeps the transfer facts out of the ordinary update — the re-point owns them', async () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);

    chooseTransferTarget('ISA');
    save();

    await waitFor(() => {
      expect(mocks.app.updateTransaction).toHaveBeenCalled();
    });
    const updates = mocks.app.updateTransaction.mock.calls[0][1] as Record<string, unknown>;
    // Sending these here would half-apply the move: this row facing the new
    // account while its other half still sat in the old one.
    expect(updates).not.toHaveProperty('category');
    expect(updates).not.toHaveProperty('transferAccountId');
    // The field edits still go, and the save still ends the row's review.
    expect(updates).toMatchObject({ description: 'Transfer to savings', needsReview: false });
  });

  it('does not re-point when the target has not changed', async () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);
    save();

    await waitFor(() => {
      expect(mocks.app.updateTransaction).toHaveBeenCalled();
    });
    expect(mocks.app.repointTransfer).not.toHaveBeenCalled();
  });

  describe('the reserved case — a counterpart that might be real', () => {
    beforeEach(() => {
      mocks.app.transactions = [OUT_LEG, REAL_LEG];
    });

    it('stops and offers the choice instead of moving it', async () => {
      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);

      chooseTransferTarget('ISA');
      save();

      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent(/What should happen to the other side\?/);
      // …and says WHY it is asking, in the account it matters in.
      expect(dialog).toHaveTextContent(/reconciled/);
      expect(dialog).toHaveTextContent(/in Savings/);
      expect(mocks.app.repointTransfer).not.toHaveBeenCalled();
    });

    it('offers keeping it as a plain uncategorised row', async () => {
      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);
      chooseTransferTarget('ISA');
      save();

      fireEvent.click(await screen.findByRole('button', { name: /Leave it where it is/ }));
      await waitFor(() => {
        expect(mocks.app.repointTransfer).toHaveBeenCalledWith(TXN_OUT, ACC_C, 'release');
      });
    });

    it('offers deleting it', async () => {
      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);
      chooseTransferTarget('ISA');
      save();

      fireEvent.click(await screen.findByRole('button', { name: /Delete it/ }));
      await waitFor(() => {
        expect(mocks.app.repointTransfer).toHaveBeenCalledWith(TXN_OUT, ACC_C, 'delete');
      });
    });

    it('cancelling writes nothing further and leaves the editor open', async () => {
      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);
      chooseTransferTarget('ISA');
      save();

      // Scoped: the editor behind it has a Cancel of its own, and the one
      // under test is the dialog's.
      const dialog = await screen.findByRole('alertdialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
      expect(mocks.app.repointTransfer).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Edit Transaction' })).toBeInTheDocument();
    });

    it('asks when the counterpart is not loaded at all', async () => {
      // It sits in a closed account. Nothing can be proved about a row that is
      // not here, and the safe direction is to ask.
      mocks.app.transactions = [OUT_LEG];
      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);
      chooseTransferTarget('ISA');
      save();

      expect(await screen.findByRole('alertdialog')).toHaveTextContent(/closed/);
    });
  });

  describe('the field stops disagreeing with itself', () => {
    it('says what saving will do while the pick and the saved target differ', () => {
      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);

      expect(screen.queryByText(/Saving moves this transfer/)).not.toBeInTheDocument();
      chooseTransferTarget('ISA');
      expect(screen.getByText(/Saving moves this transfer to ISA/)).toBeInTheDocument();
    });

    it('names the account the other half is in NOW, not the one just picked', () => {
      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);

      chooseTransferTarget('ISA');
      // The jump goes somewhere; it has to be true of the row it will open.
      expect(
        screen.getByRole('button', { name: /jump to the other side/i })
      ).toHaveTextContent('Jump to the other side in Savings →');
    });

    it('names the NEW account once the counterpart has actually moved', () => {
      // What the register's state looks like after a successful re-point.
      const movedCounterpart = { ...SCAFFOLD_LEG, accountId: ACC_C, category: 'tofrom-a' };
      const movedSource = { ...OUT_LEG, transferAccountId: ACC_C, category: 'tofrom-c' };
      mocks.app.transactions = [movedSource, movedCounterpart];

      render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={movedSource} />);
      expect(
        screen.getByRole('button', { name: /jump to the other side/i })
      ).toHaveTextContent('Jump to the other side in ISA →');
    });
  });
});

describe('EditTransactionModal — the Linked transfer flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [
      account(ACC_A, 'Current Account'),
      account(ACC_B, 'Savings'),
      account(ACC_C, 'ISA'),
    ];
    mocks.app.transactions = [OUT_LEG, SCAFFOLD_LEG];
  });

  it('shows, ticked, beside the mark — and names where the other side is', () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={OUT_LEG} />);

    const flag = screen.getByRole('checkbox', {
      name: /Linked transfer — the other side is in Savings/,
    });
    expect(flag).toBeChecked();
    // Same family as the statement line: a statement of fact, not a control.
    expect(flag).toBeDisabled();
  });

  it('shows unticked on a transfer whose other side is missing', () => {
    // An UNMATCHED leg — exactly what a deleted counterpart leaves behind.
    const stranded = { ...OUT_LEG, linkedTransferId: undefined };
    mocks.app.transactions = [stranded];
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={stranded} />);

    expect(
      screen.getByRole('checkbox', { name: /Linked transfer — no other side recorded/ })
    ).not.toBeChecked();
  });

  it('is absent entirely on an ordinary transaction', () => {
    const ordinary: Transaction = {
      id: TXN_PLAIN, date: new Date('2026-06-10'), description: 'Council tax',
      amount: -120, type: 'expense', category: 'det-tax', accountId: ACC_A, cleared: false,
    };
    mocks.app.transactions = [ordinary];
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={ordinary} />);

    expect(screen.queryByRole('checkbox', { name: /Linked transfer/ })).not.toBeInTheDocument();
  });
});
