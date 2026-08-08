import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * The quick-edit box where Microsoft Money puts it: in the register, under the
 * row it is about, with Enter to save and Escape to be rid of it.
 *
 * The owner's words: "when you click on a transaction, that kind of box appears
 * sort of in the transaction list, directly below the transaction line itself…
 * if I enter a category and then press 'enter' it could save automatically… I
 * could also press 'escape' to hide that quick edit box and just see the
 * transaction list."
 *
 * So four things have to hold, and each has a test here:
 *   1. the box opens BELOW the clicked row, inside the list, not at the foot
 *      of the page;
 *   2. Enter saves — from the description, and from a category just chosen;
 *   3. Enter belongs to whatever already wants it: an open category list
 *      chooses with it, a button is pressed by it, and neither also saves;
 *   4. Escape closes the box and leaves the row highlighted; the next Escape
 *      lets go of the row.
 *
 * WHAT JSDOM CANNOT DO: no layout. That the rows below visibly move down, that
 * nothing jumps when the box opens, and that the box's calendar and category
 * list escape the table rather than being clipped by it, are browser checks —
 * named as such in the handover. The geometry of the virtualised path is held
 * to account separately, in VirtualizedTable.rowDetail.test.tsx.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-takeaway', name: 'Takeaway', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const ROWS: Transaction[] = [
  {
    id: 'txn-0', date: new Date(Date.UTC(2026, 0, 4)), description: 'Aldwych Bakery',
    amount: -4.2, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-1', date: new Date(Date.UTC(2026, 0, 6)), description: 'Sandpiper Foods',
    amount: -31.15, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-2', date: new Date(Date.UTC(2026, 0, 9)), description: 'Cobblestone Cafe',
    amount: -6.8, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-3', date: new Date(Date.UTC(2026, 0, 12)), description: 'Thistledown Books',
    amount: -12, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
];

const updateTransaction = vi.fn(async () => {});
const applyCategoryToUncategorized = vi.fn(async () => 0);

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts" element={<div>Accounts page</div>} />
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

const addBar = (): HTMLElement => screen.getByRole('form', { name: 'Add a transaction' });

const quickEditBox = (): HTMLElement => {
  const el = document.querySelector('[data-quick-edit-panel]');
  if (!(el instanceof HTMLElement)) throw new Error('no quick-edit box is showing');
  return el;
};

const boxIsShowing = (): boolean => document.querySelector('[data-quick-edit-panel]') !== null;

const descriptionField = (): HTMLElement => within(quickEditBox()).getByLabelText('Description');

/** The transaction the register says is active, by its description. */
const activeRowText = (): string => {
  const id = grid().getAttribute('aria-activedescendant');
  if (!id) return '';
  return document.getElementById(id)?.textContent ?? '';
};

const openRegister = async (): Promise<void> => {
  renderRegister();
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
};

/** Click a row the way a user would. */
const clickRow = (description: string): void => {
  fireEvent.click(within(grid()).getByText(description));
};

beforeEach(() => {
  localStorage.clear();
  updateTransaction.mockClear();
  applyCategoryToUncategorized.mockClear();
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    updateTransaction,
    applyCategoryToUncategorized,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
  vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.getClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — the quick-edit box opens under the row', () => {
  it('is in the list itself, on the line below the transaction clicked', async () => {
    await openRegister();

    clickRow('Sandpiper Foods');

    // Inside the register, not underneath the whole page — the difference the
    // owner asked for, and the reason the eye never leaves the line.
    expect(grid().contains(quickEditBox())).toBe(true);

    // And on the very next line: the rows below it are what move down.
    const rows = within(grid()).getAllByRole('row');
    const clicked = within(grid()).getByText('Sandpiper Foods').closest('[role="row"]');
    const box = quickEditBox().closest('[role="row"]');
    expect(rows.indexOf(box as HTMLElement)).toBe(rows.indexOf(clicked as HTMLElement) + 1);
    expect(descriptionField()).toHaveValue('Sandpiper Foods');
  });

  it('leaves the add bar exactly where it was', async () => {
    await openRegister();

    clickRow('Sandpiper Foods');

    // Editing a row no longer costs you the way to add one. Both are on
    // screen, and each says which it is.
    expect(addBar()).toBeInTheDocument();
    expect(within(addBar()).getByLabelText('Description')).toHaveValue('');
    expect(grid().contains(addBar())).toBe(false);
  });

  it('counts the box as the row of the grid that it is', async () => {
    await openRegister();
    // Header + the Opening Balance line + the transactions.
    expect(grid()).toHaveAttribute('aria-rowcount', String(ROWS.length + 2));

    clickRow('Sandpiper Foods');

    expect(grid()).toHaveAttribute('aria-rowcount', String(ROWS.length + 3));
  });

  it('opens the full editor only on a SECOND click, and re-opens a closed box on the first', async () => {
    await openRegister();

    clickRow('Sandpiper Foods');
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();

    // Escape puts the box away but keeps the row…
    fireEvent.keyDown(descriptionField(), { key: 'Escape' });
    expect(boxIsShowing()).toBe(false);

    // …so the next click is asking for the box back, not for the full editor.
    clickRow('Sandpiper Foods');
    expect(boxIsShowing()).toBe(true);
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();

    // With the box open, a second click means "everything else about this row".
    clickRow('Sandpiper Foods');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit Transaction')).toBeInTheDocument();
  });
});

describe('Account register — Enter in the quick-edit box saves', () => {
  it('saves the edited description without a button being pressed', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    fireEvent.change(descriptionField(), { target: { value: 'Sandpiper Foods Ltd' } });
    fireEvent.keyDown(descriptionField(), { key: 'Enter' });

    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-1', expect.objectContaining({
      description: 'Sandpiper Foods Ltd',
      category: 'det-groceries',
      categoryConfirmed: true,
    }));
    // Saving is not leaving: the row stays put, the box stays open on it, and
    // the full editor was never in the way.
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();
    expect(boxIsShowing()).toBe(true);
  });

  it('picks the category on the first Enter and saves on the next', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    // Open the category list and type, exactly as the owner described. Typed
    // with fireEvent rather than user.type: the picker's trigger toggles the
    // list on any click inside it, so a synthetic click aimed at the search
    // box would shut the very list it opened.
    fireEvent.click(within(quickEditBox()).getByRole('combobox', { name: 'Category' }));
    const search = within(quickEditBox()).getByPlaceholderText('Search or select category…');
    fireEvent.change(search, { target: { value: 'Takeaway' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });

    // The first Enter belongs to the open list: it chooses, and saves nothing.
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(within(quickEditBox()).getByRole('combobox', { name: 'Category' })).toHaveTextContent('Takeaway');

    // The cursor is on Save, where the next Enter presses it — "enter a
    // category and then press enter" ends with the row saved.
    expect(document.activeElement).toBe(within(quickEditBox()).getByRole('button', { name: 'Save' }));
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-1', expect.objectContaining({
      category: 'det-takeaway',
      categoryConfirmed: true,
    }));
  });

  it('writes the transaction ONCE when Enter presses a button', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    const saveAndNext = within(quickEditBox()).getByRole('button', { name: 'Save & Next' });
    saveAndNext.focus();
    await user.keyboard('{Enter}');

    // The button's own Enter is the press. The box must not ALSO save on the
    // way past, or one keystroke would write the same row twice — once moving
    // on, once not.
    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    // …and it was the Save & Next that ran: the box has walked on to the next
    // transaction, still open, ready for the next one.
    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    });
    expect(activeRowText()).toContain('Cobblestone Cafe');
  });

  it('says what is wrong instead of saving an empty description', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    fireEvent.change(descriptionField(), { target: { value: '   ' } });
    fireEvent.keyDown(descriptionField(), { key: 'Enter' });

    // The same complaint the Save button makes — Enter is that button, not a
    // quieter way past it. (The wording is the app's shared error map's, which
    // generalises "Description is required" to the field-agnostic line.)
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(updateTransaction).not.toHaveBeenCalled();
  });
});

describe('Account register — the pickers inside a box inside a list', () => {
  it('draws the calendar outside the table, and picking a date does not lose the row', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    const dateField = within(quickEditBox()).getByLabelText('Transaction date');
    fireEvent.focus(dateField);

    const calendar = document.querySelector('[data-datepicker-panel]');
    if (!(calendar instanceof HTMLElement)) throw new Error('the calendar did not open');
    // Outside the register entirely: an in-flow calendar would be cut off by
    // the table, which clips what overflows it.
    expect(grid().contains(calendar)).toBe(false);

    // The click that matters. The register deselects on a mousedown outside
    // the table — and this one IS outside the table — so without the
    // calendar being recognised, the box would unmount underneath the finger
    // and the date would never be set.
    fireEvent.mouseDown(within(calendar).getByRole('button', { name: '15' }));
    fireEvent.click(within(calendar).getByRole('button', { name: '15' }));

    expect(within(quickEditBox()).getByLabelText('Transaction date')).toHaveValue('15/01/2026');
    expect(activeRowText()).toContain('Sandpiper Foods');
  });
});

describe('Account register — Escape peels the box off first', () => {
  it('closes the box, keeps the row, and only then lets go of the row', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');
    expect(boxIsShowing()).toBe(true);

    // One: the box goes, the highlight stays — "just see the transaction list".
    fireEvent.keyDown(descriptionField(), { key: 'Escape' });
    expect(boxIsShowing()).toBe(false);
    expect(activeRowText()).toContain('Sandpiper Foods');
    // …and the keyboard is back on the list, so the arrows carry straight on.
    expect(document.activeElement).toBe(grid());
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    expect(activeRowText()).toContain('Cobblestone Cafe');

    // Two: the existing layer underneath — the highlight itself.
    fireEvent.keyDown(grid(), { key: 'Escape' });
    expect(grid().getAttribute('aria-activedescendant')).toBeNull();
  });

  it('drops what was typed and not saved, rather than keeping a phantom edit', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    fireEvent.change(descriptionField(), { target: { value: 'Typed but never saved' } });
    fireEvent.keyDown(descriptionField(), { key: 'Escape' });
    clickRow('Sandpiper Foods');

    expect(updateTransaction).not.toHaveBeenCalled();
    expect(descriptionField()).toHaveValue('Sandpiper Foods');
  });

  it('leaves the register alone when the box is the one taking the key', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    // Keys aimed at the box's own controls are the box's: Delete on its
    // category picker clears the category, and must not offer to delete the
    // transaction; Space on a button presses it rather than reconciling.
    const combobox = within(quickEditBox()).getByRole('combobox', { name: 'Category' });
    combobox.focus();
    fireEvent.keyDown(combobox, { key: 'Delete' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
