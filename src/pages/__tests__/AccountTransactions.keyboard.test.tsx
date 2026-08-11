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
 * The account register as a keyboard instrument: where it opens, which keys it
 * takes, and which it must never take.
 *
 * WHAT JSDOM CANNOT DO: it performs no layout. Every element is 0×0, every
 * rect is at the origin, and nothing overflows, so a scroll container here has
 * no true maximum to clamp against. What jsdom DOES do is store an assigned
 * scrollTop, so the scroll tests stub the two layout figures the register's
 * arithmetic reads (scrollHeight and clientHeight) and then assert the position
 * the register asked for. That the resulting position looks right on screen —
 * no flash of the top before the foot, the highlighted row genuinely inside the
 * viewport, react-window's own scrolling on an account with thousands of rows —
 * is a browser check, and is stated as such in the handover rather than
 * pretended at here.
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
];

/**
 * Forty rows, one a month, oldest first. Long enough that a page step (fourteen
 * rows in this environment — see the PageDown test) can be told apart from a
 * clamp at the end of the list, and short enough to stay on the register's
 * non-virtualised path, which is the only one jsdom can render at all.
 */
const ROWS: Transaction[] = Array.from({ length: 40 }, (_, i) => ({
  id: `txn-${String(i).padStart(2, '0')}`,
  date: new Date(Date.UTC(2024, i, 10)),
  description: `Synthetic row ${String(i).padStart(2, '0')}`,
  amount: -(i + 1),
  type: 'expense' as const,
  category: 'det-groceries',
  accountId: ACCOUNT.id,
  cleared: false,
}));

const OLDEST = ROWS[0];
const NEWEST = ROWS[ROWS.length - 1];

/**
 * The double reports what became of the other side, as the real one does: the
 * pair delete reads that to know what to say when the second delete fails, and
 * a double returning undefined would let these tests pass over code the app
 * cannot run.
 */
const deleteTransaction = vi.fn(async (_id: string) => ({
  survivors: [] as { transactionId: string; accountId: string; released: boolean }[],
}));

const renderRegister = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
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

/** The register itself — the focusable grid, not the phone card list. */
const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

/**
 * The add bar at the foot of the page.
 *
 * Named rather than reached by label text: the quick-edit box now sits INSIDE
 * the register with its own Date and Description, so "the description box"
 * needs saying which one — exactly the question a screen reader user has, and
 * the reason the add bar is a landmark of its own.
 */
const addBar = (): HTMLElement => screen.getByRole('form', { name: 'Quick Add Transaction' });

/** The element that scrolls on the non-virtualised path. */
const listViewport = (): HTMLElement => {
  const el = grid().querySelector('[data-virtualized-list]');
  if (!(el instanceof HTMLElement)) throw new Error('the register rendered no scroll container');
  return el;
};

/**
 * What the register's active row holds: its text, AND whatever has been typed
 * into the boxes it has become.
 *
 * Both halves are needed. The row being edited has no description TEXT — that
 * cell is an input now, and an input's value is not text content — so a helper
 * that read only textContent could answer "which row is the highlight on?" for
 * every row in the register except the one being worked on.
 */
const activeRowText = (): string => {
  const id = grid().getAttribute('aria-activedescendant');
  const row = id ? document.getElementById(id) : null;
  if (!row) return '';
  const typed = Array.from(row.querySelectorAll('input')).map(input => input.value).join(' ');
  return `${row.textContent ?? ''} ${typed}`;
};

/** …and where that row sits in the list, or -1 for none. */
const activeRowIndex = (): number => {
  const text = activeRowText();
  return ROWS.findIndex(row => text.includes(row.description));
};

const openRegister = async (path = `/accounts/${ACCOUNT.id}`): Promise<void> => {
  renderRegister(path);
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
};

// jsdom lays nothing out, so the register's scroll arithmetic would work on
// zeroes alone. These two figures stand in for a list that is taller than its
// viewport; every scroll assertion below is the register's own arithmetic run
// against them.
const STUB_SCROLL_HEIGHT = 1000;
const STUB_CLIENT_HEIGHT = 400;

const stubLayout = (): void => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true, get: () => STUB_SCROLL_HEIGHT,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true, get: () => STUB_CLIENT_HEIGHT,
  });
};

const restoreLayout = (): void => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollHeight;
  delete (HTMLElement.prototype as Partial<HTMLElement>).clientHeight;
};

beforeEach(() => {
  localStorage.clear();
  deleteTransaction.mockClear();
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    deleteTransaction,
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
  stubLayout();
});

afterEach(() => {
  restoreLayout();
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — opening on the newest transaction', () => {
  it('leaves the order alone: oldest at the top, newest at the bottom', async () => {
    await openRegister();

    const rows = within(grid()).getAllByRole('row');
    // [0] is the column headers, [1] the Opening Balance lead line, then the
    // transactions in the order the register has always drawn them.
    expect(rows[1]).toHaveTextContent('Opening Balance');
    expect(rows[2]).toHaveTextContent(OLDEST.description);
    expect(rows[rows.length - 1]).toHaveTextContent(NEWEST.description);
  });

  it('opens at the foot of the list rather than the top', async () => {
    await openRegister();

    // Asked for the end of the list; in a browser the DOM clamps that to
    // scrollHeight - clientHeight, which is the foot.
    await waitFor(() => {
      expect(listViewport().scrollTop).toBe(STUB_SCROLL_HEIGHT);
    });
  });

  it('gives way to a deep link, which centres its own row instead', async () => {
    const target = ROWS[4];
    await openRegister(`/accounts/${ACCOUNT.id}?txn=${target.id}`);

    // The deep-linked row arrives selected, with its quick-edit box open…
    await waitFor(() => {
      expect(screen.getByLabelText('Transaction description')).toHaveValue(target.description);
    });
    // …and the register never asked for the foot, so the centring stands.
    expect(listViewport().scrollTop).not.toBe(STUB_SCROLL_HEIGHT);
  });

  it('does not drag the user back to the foot afterwards', async () => {
    await openRegister();
    await waitFor(() => {
      expect(listViewport().scrollTop).toBe(STUB_SCROLL_HEIGHT);
    });
    // Past the retries that cover AutoSizer's zero-height first pass.
    await new Promise(resolve => setTimeout(resolve, 350));

    // The user scrolls back through their history, then does something that
    // re-renders the register.
    listViewport().scrollTop = 0;
    fireEvent.click(screen.getByRole('button', { name: /Expand table/ }));

    expect(listViewport().scrollTop).toBe(0);
  });
});

describe('Account register — the highlighted row under the arrow keys', () => {
  it('is handed the keyboard by the click that highlights a row', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText(ROWS[3].description));

    // The owner's flow: click a line, then arrow. No second click to "focus
    // the table" — the register has it already.
    expect(document.activeElement).toBe(grid());
    expect(activeRowIndex()).toBe(3);
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    expect(activeRowIndex()).toBe(4);
  });

  it('takes the highlight into the list, then walks it a row at a time', async () => {
    await openRegister();

    // Nothing highlighted yet: down enters at the top of the list.
    expect(fireEvent.keyDown(grid(), { key: 'ArrowDown' })).toBe(false);
    expect(activeRowText()).toContain(OLDEST.description);

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    expect(activeRowText()).toContain(ROWS[1].description);

    fireEvent.keyDown(grid(), { key: 'ArrowUp' });
    expect(activeRowText()).toContain(OLDEST.description);
  });

  it('takes the open quick-edit box with it, row by row', async () => {
    await openRegister();

    // Click first, because that is what opens the box; the arrows then move
    // the box down the register with the highlight, which is what makes a
    // categorising run continuous.
    fireEvent.click(within(grid()).getByText(ROWS[0].description));
    await waitFor(() => {
      expect(screen.getByLabelText('Transaction description')).toHaveValue(ROWS[0].description);
    });

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    await waitFor(() => {
      expect(screen.getByLabelText('Transaction description')).toHaveValue(ROWS[1].description);
    });
  });

  it('leaves the box shut while the arrows are just browsing', async () => {
    await openRegister();

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    // Nothing opened the box, so the register is a list of transactions and
    // nothing else — the state someone reading their history wants.
    expect(document.querySelector('[data-quick-edit="actions"]')).toBeNull();
    expect(activeRowText()).toContain(ROWS[1].description);
  });

  it('stops at both ends instead of wrapping', async () => {
    await openRegister();

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    // Up from the first transaction stays put: the lead "Opening Balance" line
    // is a summary, not a row anyone can edit, and there is nothing above it.
    expect(fireEvent.keyDown(grid(), { key: 'ArrowUp' })).toBe(false);
    expect(activeRowText()).toContain(OLDEST.description);
    expect(activeRowText()).not.toContain('Opening Balance');

    fireEvent.keyDown(grid(), { key: 'End' }); // straight to the last row…
    // …and arrowing on from there stays put rather than wrapping to the top.
    for (let i = 0; i < ROWS.length + 3; i += 1) {
      fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    }
    expect(activeRowText()).toContain(NEWEST.description);
  });

  it('moves by a viewport with the page keys, and by the same page each time', async () => {
    await openRegister();

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    expect(activeRowIndex()).toBe(0);

    // A page here works out at fourteen rows: 768px of jsdom viewport, less the
    // 224px reserved for the bottom dock, is 544px of table; at 36px a compact
    // row that is fifteen rows, less one line kept for context. The assertions
    // are on the SHAPE rather than that arithmetic — many rows, the same number
    // every time, and exactly reversible — because the constants belong to the
    // layout and the behaviour does not.
    expect(fireEvent.keyDown(grid(), { key: 'PageDown' })).toBe(false);
    const page = activeRowIndex();
    expect(page).toBeGreaterThan(5);
    expect(page).toBeLessThan(ROWS.length - 1);

    fireEvent.keyDown(grid(), { key: 'PageDown' });
    expect(activeRowIndex()).toBe(page * 2);

    expect(fireEvent.keyDown(grid(), { key: 'PageUp' })).toBe(false);
    expect(activeRowIndex()).toBe(page);

    // And the far end still stops rather than running off.
    fireEvent.keyDown(grid(), { key: 'PageDown' });
    fireEvent.keyDown(grid(), { key: 'PageDown' });
    fireEvent.keyDown(grid(), { key: 'PageDown' });
    expect(activeRowIndex()).toBe(ROWS.length - 1);
  });

  it('leaves the keys alone when there is nothing to walk', async () => {
    __setAppContextValue({ transactions: [] });
    await openRegister();

    // An empty register scrolls the page like any other page.
    expect(fireEvent.keyDown(grid(), { key: 'ArrowDown' })).toBe(true);
    expect(grid().getAttribute('aria-activedescendant')).toBeNull();
  });

  it('never takes a key from the fields around it', async () => {
    await openRegister();
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    const highlighted = activeRowText();

    // The add bar's own description box — the field the user is most likely to
    // be typing in WHILE a row is highlighted, and one the register must not
    // reach into: an arrow key there moves the caret, not the highlight.
    const addDescription = within(addBar()).getByLabelText('Description');
    expect(fireEvent.keyDown(addDescription, { key: 'ArrowDown' })).toBe(true);
    // Enter here IS claimed — but by the ADD BAR, which now reads it as
    // "+ Add" from any of its fields (the Money register). The point of this
    // test is that the REGISTER did not take it: the highlight has not moved
    // and no row editor opened, both asserted below.
    expect(fireEvent.keyDown(addDescription, { key: 'Enter' })).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Search & filters/ }));
    const search = screen.getByPlaceholderText(/Search by description/);
    expect(fireEvent.keyDown(search, { key: 'PageDown' })).toBe(true);

    expect(activeRowText()).toBe(highlighted);
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();
  });
});

describe('Account register — Enter opens the highlighted row', () => {
  it('opens the edit modal for the highlighted transaction', async () => {
    await openRegister();

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    expect(fireEvent.keyDown(grid(), { key: 'Enter' })).toBe(false);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit Transaction')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue(ROWS[1].description)).toBeInTheDocument();
  });

  it('does nothing when no row is highlighted', async () => {
    await openRegister();

    expect(fireEvent.keyDown(grid(), { key: 'Enter' })).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Account register — Delete, then Enter', () => {
  const confirmDialog = (): HTMLElement => screen.getByRole('alertdialog');
  const deleteButton = (): HTMLElement => within(confirmDialog()).getByRole('button', { name: 'Delete' });

  /** Highlight the second row, as a user would, and ask to delete it. */
  const armDelete = async (key: 'Delete' | 'Backspace' = 'Delete'): Promise<void> => {
    await openRegister();
    fireEvent.click(within(grid()).getByText(ROWS[1].description));
    expect(activeRowIndex()).toBe(1);
    expect(fireEvent.keyDown(grid(), { key })).toBe(false);
  };

  it('opens the confirmation for the highlighted row', async () => {
    await armDelete();

    expect(within(confirmDialog()).getByText(/Synthetic row 01/)).toBeInTheDocument();
    // An alert, not a passing remark: this interrupts to ask about something
    // destructive.
    expect(confirmDialog()).toHaveAttribute('aria-modal', 'true');
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('answers to Backspace too, where a Mac keyboard prints Delete', async () => {
    await armDelete('Backspace');
    expect(within(confirmDialog()).getByText(/Synthetic row 01/)).toBeInTheDocument();
  });

  it('does nothing at all with no row highlighted', async () => {
    await openRegister();

    // Not claimed either — an unhighlighted register leaves Backspace to the
    // browser, where it may still mean "go back".
    expect(fireEvent.keyDown(grid(), { key: 'Delete' })).toBe(true);
    expect(fireEvent.keyDown(grid(), { key: 'Backspace' })).toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lands the focus on Delete, so a bare Enter confirms', async () => {
    const user = userEvent.setup();
    await armDelete();

    expect(document.activeElement).toBe(deleteButton());

    await user.keyboard('{Enter}');

    expect(deleteTransaction).toHaveBeenCalledTimes(1);
    expect(deleteTransaction).toHaveBeenCalledWith(ROWS[1].id);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cannot be confirmed by the key that opened it, held down', async () => {
    await armDelete();

    // Autorepeat keeps arriving at whatever now has focus — the Delete button,
    // which ignores the Delete key. Only an Enter (or Space) delivered to the
    // focused button confirms, and that has to be a fresh press.
    fireEvent.keyDown(deleteButton(), { key: 'Delete', repeat: true });
    fireEvent.keyDown(deleteButton(), { key: 'Delete', repeat: true });

    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
  });

  it('cancels on Escape, and hands the register back its keys', async () => {
    await armDelete();
    const highlighted = activeRowText();

    fireEvent.keyDown(deleteButton(), { key: 'Escape' });

    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // Focus is back on the register, still on the same row, so the next arrow
    // key carries on where it left off.
    expect(document.activeElement).toBe(grid());
    expect(activeRowText()).toBe(highlighted);
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    expect(activeRowIndex()).toBe(2);
  });

  it('traps the tab key between its two buttons', async () => {
    await armDelete();
    const cancel = within(confirmDialog()).getByRole('button', { name: 'Cancel' });

    fireEvent.keyDown(deleteButton(), { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(document.activeElement).toBe(deleteButton());
  });

  it('leaves the highlight on the row that takes the deleted one\'s place', async () => {
    await armDelete();

    fireEvent.click(deleteButton());

    expect(deleteTransaction).toHaveBeenCalledWith(ROWS[1].id);
    // Not stranded on a row that no longer exists, and not thrown back to the
    // top of the list: the next row down, ready for the next Delete.
    expect(activeRowIndex()).toBe(2);
    expect(document.activeElement).toBe(grid());
  });
});

/**
 * The one thing this dialog must never be quieter about than the full editor.
 *
 * transactions_linked_transfer_id_fkey is ON DELETE SET NULL and
 * delete_transaction_atomic removes ONE row and reverses ONE balance, so
 * deleting half a transfer leaves the other half in the other account, still
 * counted there, its link silently nulled. A delete reached in two keystrokes
 * must not tell the user less than one reached through the editor.
 */
describe('Account register — what the delete confirmation admits to', () => {
  const OTHER_ACCOUNT: Account = {
    id: 'acc-other', name: 'Synthetic Savings', type: 'savings', balance: 0,
    currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
  };

  const TRANSFER_OUT: Transaction = {
    id: 'txn-transfer-out', date: new Date('2024-06-01'), description: 'Synthetic transfer out',
    amount: -250, type: 'transfer', category: 'transfer-out', accountId: ACCOUNT.id,
    cleared: false, linkedTransferId: 'txn-transfer-in', transferAccountId: OTHER_ACCOUNT.id,
  };

  const TRANSFER_IN: Transaction = {
    id: 'txn-transfer-in', date: new Date('2024-06-01'), description: 'Synthetic transfer in',
    amount: 250, type: 'transfer', category: 'transfer-in', accountId: OTHER_ACCOUNT.id,
    cleared: false, linkedTransferId: 'txn-transfer-out', transferAccountId: ACCOUNT.id,
  };

  const ORDINARY: Transaction = {
    id: 'txn-ordinary', date: new Date('2024-06-02'), description: 'Synthetic ordinary row',
    amount: -9.99, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  };

  const openConfirmFor = async (description: string): Promise<HTMLElement> => {
    await openRegister();
    // Two clicks would open the editor; one selects, and the keyboard asks.
    fireEvent.click(within(grid()).getByText(description));
    fireEvent.keyDown(grid(), { key: 'Delete' });
    return screen.getByRole('alertdialog');
  };

  beforeEach(() => {
    __setAppContextValue({
      accounts: [ACCOUNT, OTHER_ACCOUNT],
      transactions: [TRANSFER_OUT, TRANSFER_IN, ORDINARY],
    });
  });

  it('names the account left holding the other half of a transfer', async () => {
    const dialog = await openConfirmFor('Synthetic transfer out');

    expect(within(dialog).getByText(/one half of a transfer/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Synthetic Savings/)).toBeInTheDocument();
    expect(within(dialog).getByText(/still counted in that account's balance/i)).toBeInTheDocument();
    // …and what it becomes there, which is the half the old warning left out.
    expect(within(dialog).getByText(/stops being a transfer there/)).toBeInTheDocument();
  });

  it('says nothing extra about an ordinary row', async () => {
    const dialog = await openConfirmFor('Synthetic ordinary row');

    expect(within(dialog).getByText(/Synthetic ordinary row/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/one half of a transfer/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Synthetic Savings/)).not.toBeInTheDocument();
  });

  /**
   * THE CHOICE, in the register. The warning has been here since the transfers
   * batch; what was missing was any way to act on it. Deleting a transfer means
   * deleting the movement, so that is the primary answer and it holds the focus
   * — which keeps the register's arrow / Delete / Enter loop intact.
   */
  it('offers three answers for a transfer leg, primary first under the cursor', async () => {
    const dialog = await openConfirmFor('Synthetic transfer out');

    expect(within(dialog).getAllByRole('button').map(b => b.textContent))
      .toEqual(['Cancel', 'Delete this side only', 'Delete both sides']);
    expect(document.activeElement)
      .toBe(within(dialog).getByRole('button', { name: 'Delete both sides' }));
  });

  it('still offers exactly two for a plain row', async () => {
    const dialog = await openConfirmFor('Synthetic ordinary row');

    expect(within(dialog).getAllByRole('button').map(b => b.textContent))
      .toEqual(['Cancel', 'Delete']);
  });

  it('removes both rows when both sides are asked for, this side first', async () => {
    const dialog = await openConfirmFor('Synthetic transfer out');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete both sides' }));

    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledTimes(2));
    expect(deleteTransaction).toHaveBeenNthCalledWith(1, 'txn-transfer-out');
    expect(deleteTransaction).toHaveBeenNthCalledWith(2, 'txn-transfer-in');
  });

  it('removes only this row when only this side is asked for', async () => {
    const dialog = await openConfirmFor('Synthetic transfer out');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete this side only' }));

    expect(deleteTransaction).toHaveBeenCalledTimes(1);
    expect(deleteTransaction).toHaveBeenCalledWith('txn-transfer-out');
  });

  /**
   * A half-done pair delete has to say which half. The register shows it as a
   * warning rather than an error for a mechanical reason as well as a tonal
   * one: getUserFriendlyError swaps any message over 100 characters for "An
   * error occurred", and the sentence naming the surviving row IS the report.
   */
  it('says which side survived, and what it now is, when the second delete fails', async () => {
    deleteTransaction.mockImplementation(async (id: string) => {
      if (id === 'txn-transfer-in') throw new Error('conflict');
      return { survivors: [{ transactionId: 'txn-transfer-in', accountId: 'acc-other', released: true }] };
    });
    const dialog = await openConfirmFor('Synthetic transfer out');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete both sides' }));

    const report = await screen.findByText(/was not\./);
    expect(report).toHaveTextContent('Synthetic transfer out');
    expect(report).toHaveTextContent('in Synthetic Savings');
    expect(report).toHaveTextContent(/no longer a transfer/);
    expect(report).toHaveTextContent(/uncategorised deposit/);
  });
});

describe('Account register — what a screen reader is told', () => {
  it('is one focusable grid that names its active row', async () => {
    await openRegister();

    expect(grid()).toHaveAttribute('tabindex', '0');
    // The header row counts, so the first transaction is row 2 — the numbering
    // the user sees.
    expect(grid()).toHaveAttribute('aria-rowcount', String(ROWS.length + 2));

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    const activeId = grid().getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const active = document.getElementById(activeId ?? '');
    expect(active).not.toBeNull();
    expect(active).toHaveAttribute('role', 'row');
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active).toHaveTextContent(OLDEST.description);
  });

  it('says which way the register is sorted', async () => {
    await openRegister();

    const dateHeader = within(grid()).getAllByRole('columnheader')[0];
    expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
  });
});
