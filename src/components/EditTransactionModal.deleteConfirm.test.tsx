/**
 * EditTransactionModal — what the delete confirmation admits to, and how it can
 * be answered.
 *
 * `transactions_linked_transfer_id_fkey` is ON DELETE SET NULL and
 * `delete_transaction_atomic` removes one row and reverses one balance. So
 * deleting half of a linked transfer does not remove the movement: the other
 * leg stays in the other account, still moving that account's balance, with its
 * link silently nulled. The confirmation used to say only "This action cannot
 * be undone", which is true and beside the point — the part that cannot be
 * undone happens in an account the user is not looking at.
 *
 * The editor now raises the SAME confirmation the register raises
 * (DeleteTransactionConfirm): an alertdialog, Delete focused, Escape to cancel,
 * focus trapped and handed back. A delete reached through the editor is the same
 * delete, and must not be answerable on worse terms than one reached from the
 * register.
 *
 * These tests hold the confirmation to naming that consequence, to staying quiet
 * when there is no consequence to name, and to being answerable from the
 * keyboard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Account, Transaction } from '../types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: {
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  },
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    categories: [
      { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
      { id: 'sub-bills', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
      { id: 'det-tax', name: 'Council Tax', type: 'expense', level: 'detail', parentId: 'sub-bills' },
    ],
    updateTransaction: vi.fn(async () => {}),
    // Truthful about its shape: the real deleteTransaction reports what became
    // of the other side, and the pair delete reads that to know what to say if
    // the second delete fails. A double returning undefined would let a test
    // pass over code the app cannot run.
    deleteTransaction: vi.fn(async (_id: string) => ({ survivors: [] as { transactionId: string; accountId: string; released: boolean }[] })),
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

vi.mock('../contexts/ToastContext', () => ({ useToast: () => mocks.toast }));

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

/**
 * Open the editor on `transaction` and press its Delete button to raise the
 * confirmation. Scoped by role: the editor's own Delete button and the
 * confirmation's are both on screen from here on, and they are not the same
 * button.
 */
const openDeleteConfirm = async (
  transaction: Transaction,
  onClose = vi.fn()
): Promise<{ user: ReturnType<typeof userEvent.setup>; dialog: HTMLElement }> => {
  // userEvent rather than fireEvent, because the click that opens this dialog
  // also FOCUSES the button that opened it — and where focus goes on the way
  // back out is half of what these tests are checking.
  const user = userEvent.setup();
  render(<EditTransactionModal isOpen onClose={onClose} transaction={transaction} />);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  return { user, dialog: screen.getByRole('alertdialog') };
};

const confirmButton = (): HTMLElement =>
  within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' });

describe('EditTransactionModal — delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [account('acc-a', 'Current Account'), account('acc-b', 'Savings')];
    mocks.app.transactions = [OUT_LEG, IN_LEG, EXPENSE];
  });

  it('names the account the other half is left in, and what it becomes there', async () => {
    await openDeleteConfirm(OUT_LEG);

    expect(
      screen.getByText(/Deleting it will leave the other half in Savings/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/still counted in that account's balance — it stops being a transfer there/)
    ).toBeInTheDocument();
  });

  it('warns from the incoming leg too, naming the account facing it', async () => {
    await openDeleteConfirm(IN_LEG);

    expect(
      screen.getByText(/Deleting it will leave the other half in Current Account/)
    ).toBeInTheDocument();
  });

  it('says nothing extra for an ordinary transaction, and names the row', async () => {
    const { dialog } = await openDeleteConfirm(EXPENSE);

    // The shared confirmation names the row in the question, so nobody deletes
    // blind; nothing is invented on top of that.
    expect(within(dialog).getByText(/Groceries/)).toBeInTheDocument();
    expect(within(dialog).getByText(/This cannot be undone/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/one half of a transfer/)).not.toBeInTheDocument();
  });

  /**
   * THE CHOICE. This dialog used to name the consequence of deleting a leg and
   * then offer no way to do the thing the user almost certainly meant — remove
   * the movement. Cascading unasked would have been worse; asking is right.
   */
  it('offers three answers for one half of a transfer', async () => {
    const { dialog } = await openDeleteConfirm(OUT_LEG);

    expect(within(dialog).getAllByRole('button').map(button => button.textContent))
      .toEqual(['Cancel', 'Delete this side only', 'Delete both sides']);
    // Nothing happens until one of them is pressed.
    expect(mocks.app.deleteTransaction).not.toHaveBeenCalled();
  });

  it('offers the same two answers as ever for a plain row', async () => {
    const { dialog } = await openDeleteConfirm(EXPENSE);

    expect(within(dialog).getAllByRole('button').map(button => button.textContent))
      .toEqual(['Cancel', 'Delete']);
  });

  it('deletes both rows, this side first, and closes the editor', async () => {
    const onClose = vi.fn();
    const { user, dialog } = await openDeleteConfirm(OUT_LEG, onClose);

    await user.click(within(dialog).getByRole('button', { name: 'Delete both sides' }));

    expect(mocks.app.deleteTransaction).toHaveBeenNthCalledWith(1, 'txn-out');
    expect(mocks.app.deleteTransaction).toHaveBeenNthCalledWith(2, 'txn-in');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('deletes only this row when only this row was asked for', async () => {
    const { user, dialog } = await openDeleteConfirm(OUT_LEG);

    await user.click(within(dialog).getByRole('button', { name: 'Delete this side only' }));

    expect(mocks.app.deleteTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.app.deleteTransaction).toHaveBeenCalledWith('txn-out');
  });

  /**
   * Deleting a transfer means deleting the movement, so the loop that ends in
   * a reflex Enter lands on "both sides". The dialog has already said what that
   * means, in the account it will happen in.
   */
  it('puts the focus on Delete both sides, so the keyboard loop still finishes', async () => {
    const { user, dialog } = await openDeleteConfirm(OUT_LEG);

    expect(document.activeElement)
      .toBe(within(dialog).getByRole('button', { name: 'Delete both sides' }));

    await user.keyboard('{Enter}');

    expect(mocks.app.deleteTransaction).toHaveBeenCalledTimes(2);
  });

  it('cycles the tab key across all three buttons, both ways', async () => {
    const { dialog } = await openDeleteConfirm(OUT_LEG);
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const oneSide = within(dialog).getByRole('button', { name: 'Delete this side only' });
    const bothSides = within(dialog).getByRole('button', { name: 'Delete both sides' });

    fireEvent.keyDown(bothSides, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(document.activeElement).toBe(oneSide);
    fireEvent.keyDown(oneSide, { key: 'Tab' });
    expect(document.activeElement).toBe(bothSides);

    // Backwards, which two buttons could not tell apart and three can.
    fireEvent.keyDown(bothSides, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(oneSide);
    fireEvent.keyDown(oneSide, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(bothSides);
  });

  /**
   * A pair delete is two writes, and the second one can fail. What must never
   * happen is a silent half-delete: the report names the side that survived and
   * the state it is in, which the caller can only know from what the first
   * delete reported back.
   */
  it('reports which side survived when the second delete fails', async () => {
    mocks.app.deleteTransaction.mockImplementation(async (id: string) => {
      if (id === 'txn-in') throw new Error('conflict');
      return { survivors: [{ transactionId: 'txn-in', accountId: 'acc-b', released: true }] };
    });
    const { user, dialog } = await openDeleteConfirm(OUT_LEG);

    await user.click(within(dialog).getByRole('button', { name: 'Delete both sides' }));

    expect(mocks.toast.showWarning).toHaveBeenCalledTimes(1);
    const [message, title] = mocks.toast.showWarning.mock.calls[0];
    expect(title).toBe('Only one side was deleted');
    expect(message).toContain('in Savings');
    expect(message).toMatch(/no longer a transfer/);
    expect(message).toMatch(/uncategorised deposit/);
    // showError would have run the sentence through getUserFriendlyError, which
    // replaces anything over 100 characters with "An error occurred".
    expect(mocks.toast.showError).not.toHaveBeenCalled();
  });

  it('reports a failure that deleted nothing as an ordinary error', async () => {
    const boom = new Error('offline');
    mocks.app.deleteTransaction.mockImplementation(async () => { throw boom; });
    const { user, dialog } = await openDeleteConfirm(OUT_LEG);

    await user.click(within(dialog).getByRole('button', { name: 'Delete both sides' }));

    expect(mocks.toast.showError).toHaveBeenCalledWith(boom);
    expect(mocks.toast.showWarning).not.toHaveBeenCalled();
  });

  /**
   * The adoption itself. Before it, this was a bare div: no role, no focus
   * management, no Escape — so the keyboard could not answer it and a screen
   * reader was told nothing had happened.
   */
  it('interrupts as an alertdialog, with Delete already focused', async () => {
    const onClose = vi.fn();
    const { user, dialog } = await openDeleteConfirm(EXPENSE, onClose);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement).toBe(confirmButton());

    // Focused means a bare Enter completes it — the register's loop, available
    // here too.
    await user.keyboard('{Enter}');

    expect(mocks.app.deleteTransaction).toHaveBeenCalledWith(EXPENSE.id);
    // …and the editor closes behind it, exactly as it always did.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape, leaving the editor open and the row alone', async () => {
    const onClose = vi.fn();
    await openDeleteConfirm(EXPENSE, onClose);

    fireEvent.keyDown(confirmButton(), { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mocks.app.deleteTransaction).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Focus goes back to the button that raised it, so the editor is still
    // usable from the keyboard afterwards.
    expect(document.activeElement)
      .toBe(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  });

  it('traps the tab key between its two buttons', async () => {
    const { dialog } = await openDeleteConfirm(EXPENSE);
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });

    fireEvent.keyDown(confirmButton(), { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(document.activeElement).toBe(confirmButton());
  });

  /**
   * A caller is free to keep this component mounted with isOpen=false rather
   * than unmounting it (the retired global transactions list did, which is how
   * this was found). A confirmation left standing there used to outlive the
   * editor it belonged to; now that it traps focus, that would strand the user
   * in a dialog about a form they can no longer see.
   */
  it('goes away with the editor it belongs to', () => {
    const { rerender } = render(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={EXPENSE} />
    );
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    rerender(<EditTransactionModal isOpen={false} onClose={vi.fn()} transaction={EXPENSE} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // And it does not spring back open the next time the editor is used.
    rerender(<EditTransactionModal isOpen onClose={vi.fn()} transaction={EXPENSE} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
