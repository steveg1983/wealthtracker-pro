import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * The register's Add button — the way into the FULL editor from an account.
 *
 * ── WHAT THIS IS ABOUT ─────────────────────────────────────────────────────
 * The dock at the foot of the register is six fields wide on purpose (date,
 * type, payee, category, amount, Add). Everything else a transaction can carry
 * — notes above all — had no way in from this page at all: the only route was
 * to leave for the Transactions page, add it there, and name the account you
 * were already looking at. The toolbar's Add is that route, closed: the SAME
 * editor the Transactions page opens, opened on THIS account.
 *
 * So the four things asserted here are the four things that make it that:
 *   1. it sits in the rightmost seat of the toolbar, with Expand table beside
 *      it — the seat every other page in the app gives its primary action;
 *   2. it opens the app's one full add editor, already pointed at this account
 *      (the prefill: drop it and tests 2 and 3 both go red);
 *   3. what it saves is in the register a moment later, without a reload;
 *   4. what it saves is NOT marked as needing review — that flag belongs to the
 *      import path alone, and a person typing IS the review.
 *
 * Plus the negative that keeps the two entry points honest: the Quick Add bar
 * is untouched, and the two Adds never collide.
 *
 * Every account, payee and figure below is invented — this repo is public. The
 * account ids are real UUIDs because the editor validates them as such
 * (ValidationService's transaction schema), which the dock does not.
 */

const ACCOUNT: Account = {
  id: '3f5a1c22-9b6e-4d18-8b7a-1c2d3e4f5a6b',
  name: 'Synthetic Register',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-01-01'),
  openingBalance: 100,
  isActive: true,
};

const SAVINGS: Account = {
  id: '7d4e6b10-2a3c-4f59-9e8d-0b1a2c3d4e5f',
  name: 'Synthetic Savings',
  type: 'savings',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-01-01'),
  openingBalance: 0,
  isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-home', name: 'Home', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'grp-home' },
];

const ROWS: Transaction[] = [
  {
    id: 'txn-0',
    date: new Date(Date.UTC(2026, 0, 6)),
    description: 'Ashcombe Tilery',
    amount: -31.4,
    type: 'expense',
    category: 'det-repairs',
    accountId: ACCOUNT.id,
    cleared: false,
  },
  {
    id: 'txn-1',
    date: new Date(Date.UTC(2026, 0, 19)),
    description: 'Winterbourne Glass',
    amount: -18,
    type: 'expense',
    category: 'det-repairs',
    accountId: ACCOUNT.id,
    cleared: false,
  },
];

/** The description the tests add. Nothing in ROWS answers to it. */
const NEW_PAYEE = 'Fernbrook Pottery';

/**
 * The context's write, recorded.
 *
 * Untyped `vi.fn()` on purpose — that is what the mock context's slots accept
 * (see src/test/mocks/AppContextSupabase.ts, where they are plain `noop`s) —
 * with the IMPLEMENTATION typed below, so what the editor hands over is checked
 * against the real draft shape rather than waved through.
 */
const addTransaction = vi.fn();

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/**
 * The desktop register. Scoped deliberately: jsdom applies no media queries, so
 * the phone card list is in the document too, and this file is about the table.
 */
const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

/** The add bar at the foot of the page — a landmark of its own. */
const quickAddBar = (): HTMLElement => screen.getByRole('form', { name: 'Quick Add Transaction' });

/**
 * The toolbar's Add.
 *
 * A regex, not the exact string: the button carries both labels at once in the
 * DOM ("Add" for phones, "Add transaction" from sm up) exactly as Search &
 * filters and Expand table do, and only CSS — which jsdom does not apply —
 * hides one of them.
 */
const addButton = (): HTMLElement => screen.getByRole('button', { name: /Add transaction/ });
const expandButton = (): HTMLElement => screen.getByRole('button', { name: /Expand table/ });

const openRegister = async (): Promise<void> => {
  renderRegister();
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
};

/** Click Add and wait for the (lazily loaded) editor to arrive. */
const openAddEditor = async (): Promise<HTMLElement> => {
  fireEvent.click(addButton());
  return await screen.findByRole('dialog', { name: 'Add Transaction' });
};

/** Fill the editor in far enough to save, and press its Add Transaction. */
const saveDraft = (dialog: HTMLElement, description: string = NEW_PAYEE): void => {
  fireEvent.change(within(dialog).getByLabelText('Transaction description'), {
    target: { value: description },
  });
  fireEvent.change(within(dialog).getByLabelText('Transaction amount'), {
    target: { value: '24.50' },
  });
  fireEvent.change(within(dialog).getByLabelText('Select transaction category'), {
    target: { value: 'grp-home' },
  });
  fireEvent.change(within(dialog).getByLabelText('Select transaction sub-category'), {
    target: { value: 'det-repairs' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Transaction' }));
};

beforeEach(() => {
  localStorage.clear();
  addTransaction.mockReset();
  // The context's own behaviour, in miniature: the saved row joins the shared
  // transactions state. The register is a filter over that state, so this is
  // the whole of "the new row appears" — nothing on the page re-fetches.
  addTransaction.mockImplementation(async (draft: Omit<Transaction, 'id'>): Promise<void> => {
    __setAppContextValue({ transactions: [...ROWS, { ...draft, id: 'txn-added' }] });
  });
  __setAppContextValue({
    accounts: [ACCOUNT, SAVINGS],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    addTransaction,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — the toolbar has an Add', () => {
  it('puts it in the rightmost seat, with Expand table beside it', async () => {
    await openRegister();

    // Beside it, and to its LEFT: Expand table is the element immediately
    // before Add, in the same cluster.
    expect(addButton().previousElementSibling).toBe(expandButton());

    // Nothing to the right of it: Add ends its cluster, and that cluster ends
    // the toolbar row.
    const cluster = addButton().parentElement;
    if (!(cluster instanceof HTMLElement)) throw new Error('the Add button has no toolbar cluster');
    expect(cluster.lastElementChild).toBe(addButton());
    const row = cluster.parentElement;
    if (!(row instanceof HTMLElement)) throw new Error('the toolbar cluster has no row');
    expect(row.lastElementChild).toBe(cluster);

    // …and the row in question really is the register's toolbar — the one that
    // carries Search & filters — rather than some wrapper that happens to end
    // where Add does.
    expect(within(row).getByRole('button', { name: /Search & filters/ })).toBeInTheDocument();
  });

  it('is reachable from the keyboard, as the last stop in the toolbar', async () => {
    await openRegister();

    // No tabindex games: it is a plain button in document order, so Tab reaches
    // it after the controls it sits beside.
    expect(addButton().tagName).toBe('BUTTON');
    expect(addButton().getAttribute('tabindex')).toBeNull();
    expect(addButton().hasAttribute('disabled')).toBe(false);
  });
});

describe('Account register — Add opens the full editor on this account', () => {
  it('opens the app-wide add editor with this account already chosen', async () => {
    await openRegister();
    const dialog = await openAddEditor();

    // THE PREFILL. The picker is a combobox, so what it shows is its text, and
    // the label is the app's own "<name> (<type>)".
    const picker = within(dialog).getByRole('combobox', { name: 'Select account for transaction' });
    expect(picker).toHaveTextContent('Synthetic Register');

    // And it is the FULL editor, not a second quick bar: notes, the two-level
    // category tree and a way to create a category are all here.
    expect(within(dialog).getByText('Notes (Optional)')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Select transaction category')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Create new category/ })).toBeInTheDocument();
  });

  it('saves what it is given into this account', async () => {
    await openRegister();
    saveDraft(await openAddEditor());

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: ACCOUNT.id,
        description: NEW_PAYEE,
        // Signed by the type toggle, which opens on Expense.
        amount: -24.5,
        type: 'expense',
        category: 'det-repairs',
      })
    );
  });

  it('shows the saved row in the register straight away', async () => {
    await openRegister();
    expect(within(grid()).queryByText(NEW_PAYEE)).toBeNull();

    saveDraft(await openAddEditor());

    await waitFor(() => expect(within(grid()).getByText(NEW_PAYEE)).toBeInTheDocument());
    // The register is itself again: the editor closed behind the save.
    expect(screen.queryByRole('dialog', { name: 'Add Transaction' })).toBeNull();
  });

  it('does not mark the row as needing review — typing it IS the review', async () => {
    await openRegister();
    saveDraft(await openAddEditor());

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    const draft: unknown = addTransaction.mock.calls[0]?.[0];
    // Not "needsReview: false" — absent. Only the import paths set the flag at
    // all (see dataPort.bulkImportTransactions), and every other value means
    // reviewed.
    expect(draft).not.toHaveProperty('needsReview');

    // Said the way the user sees it: no To Review counter appears in the
    // toolbar, because nothing on this register is awaiting review.
    await waitFor(() => expect(within(grid()).getByText(NEW_PAYEE)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /To Review/ })).toBeNull();
  });
});

describe('Account register — the Quick Add bar is untouched', () => {
  it('keeps its own fields and its own Add', async () => {
    await openRegister();

    const bar = quickAddBar();
    expect(within(bar).getByLabelText('Description')).toBeInTheDocument();
    expect(within(bar).getByLabelText('Amount')).toBeInTheDocument();

    // The two Adds are different buttons, and neither is inside the other's
    // furniture: the dock's is in the dock, the toolbar's is not.
    const dockAdd = within(bar).getByRole('button', { name: 'Add' });
    expect(dockAdd).not.toBe(addButton());
    expect(bar.contains(addButton())).toBe(false);

    // And they cannot be confused by name either: "Add" exactly still finds
    // one button in the whole page, the dock's.
    expect(screen.getByRole('button', { name: 'Add' })).toBe(dockAdd);
  });

  it('is still there behind the editor, and still there after it closes', async () => {
    await openRegister();
    const dialog = await openAddEditor();
    expect(quickAddBar()).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add Transaction' })).toBeNull());
    expect(within(quickAddBar()).getByRole('button', { name: 'Add' })).toBeInTheDocument();
    // Nothing was written by opening and closing the full editor.
    expect(addTransaction).not.toHaveBeenCalled();
  });
});
