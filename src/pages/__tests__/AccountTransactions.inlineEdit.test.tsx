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
 * row it is about, worked entirely from the keyboard and shut with Escape.
 *
 * The owner's words: "when you click on a transaction, that kind of box appears
 * sort of in the transaction list, directly below the transaction line itself…
 * if I enter a category and then press 'enter' it could save automatically… I
 * could also press 'escape' to hide that quick edit box and just see the
 * transaction list."
 *
 * And the rhythm he asked for once he had used it: "if I am trying to do a list
 * of categories, you almost want to do save & next and then the next line
 * defaults into the category box again, so you can just start typing the search
 * again… Maybe the same if you are in description."
 *
 * So five things have to hold, and each has a test here:
 *   1. the box opens BELOW the clicked row, inside the list, not at the foot
 *      of the page;
 *   2. Enter ACCEPTS what was typed and hands over Save & Next; the next Enter
 *      saves and moves on. Two keystrokes, the same two every row;
 *   3. the box that opens on the next row puts the cursor back in the field
 *      the run is working down — category, description or date;
 *   4. Enter belongs to whatever already wants it: an open category list
 *      chooses with it, a button is pressed by it, and neither also saves;
 *   5. every way the box closes — Save, Escape, the × — hands the keyboard
 *      back to the list with the row still highlighted, so the arrow keys
 *      carry on rather than scrolling.
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

const descriptionField = (): HTMLInputElement => {
  const el = within(quickEditBox()).getByLabelText('Description');
  if (!(el instanceof HTMLInputElement)) throw new Error('the description is not an input');
  return el;
};

const dateField = (): HTMLElement => within(quickEditBox()).getByLabelText('Transaction date');

const categorySearch = (): HTMLElement =>
  within(quickEditBox()).getByPlaceholderText('Search or select category…');

/** The run button — the one a field's Enter hands the cursor to. */
const saveAndNext = (): HTMLElement => within(quickEditBox()).getByRole('button', { name: 'Save & Next' });

/** The button that ENDS a run: saves, closes, keyboard back to the list. */
const saveButton = (): HTMLElement => within(quickEditBox()).getByRole('button', { name: 'Save' });

const calendarIsShowing = (): boolean => document.querySelector('[data-datepicker-panel]') !== null;

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

describe('Account register — Enter accepts, and the Enter after it moves you on', () => {
  it('offers Save & Next first, and says so under the buttons', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    // Left to right, the run button leads: it is the one the cursor lands on
    // and the one pressed a hundred times filing a statement. Save is the way
    // to stop, not the way to carry on.
    const buttons = within(quickEditBox()).getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual(['Save & Next', 'Save', '']);

    expect(
      within(quickEditBox()).getByText('Enter accepts · Enter again saves & moves on · Esc closes')
    ).toBeInTheDocument();
  });

  it('reads as one row: the small print on the label line, the buttons on the input line', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    // The owner: "Move the Save & Next and Save buttons below the text and the
    // text above. Those buttons should be the same level as date / description
    // and category."
    const hint = within(quickEditBox()).getByText('Enter accepts · Enter again saves & moves on · Esc closes');

    // The hint comes FIRST in its column, which is what puts the buttons on the
    // inputs' line: the column is bottom-aligned with the fields beside it, so
    // whichever of the two is last is the one that lands on that line.
    expect(hint.compareDocumentPosition(saveAndNext()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(saveAndNext().parentElement?.previousElementSibling).toBe(hint);

    // …and they are the same height as the fields they line up with.
    //
    // WHAT JSDOM CANNOT DO: prove they LOOK level — it performs no layout, so
    // the declared height is the contract and the eye is a browser check.
    expect(descriptionField().className).toContain('h-[42px]');
    expect(saveAndNext().className).toContain('h-[42px]');
    expect(saveButton().className).toContain('h-[42px]');
  });

  it('accepts the typed description on the first Enter, and saves on the next', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    descriptionField().focus();
    fireEvent.change(descriptionField(), { target: { value: 'Sandpiper Foods Ltd' } });
    fireEvent.keyDown(descriptionField(), { key: 'Enter' });

    // Nothing is written yet — the first Enter is "yes, that's what I meant" —
    // and the cursor is on the button that will write it.
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(saveAndNext());

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-1', expect.objectContaining({
      description: 'Sandpiper Foods Ltd',
      category: 'det-groceries',
      categoryConfirmed: true,
    }));
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();
  });

  it('lands on the next row in the SAME field, with the old text selected', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    descriptionField().focus();
    fireEvent.change(descriptionField(), { target: { value: 'Sandpiper Foods Ltd' } });
    fireEvent.keyDown(descriptionField(), { key: 'Enter' });
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    });
    expect(activeRowText()).toContain('Cobblestone Cafe');

    // The whole point of the run: the cursor is already where the work is, and
    // the old text is selected so typing REPLACES it — which is what tidying a
    // column of bank descriptions actually is.
    const next = descriptionField();
    expect(document.activeElement).toBe(next);
    expect(next.selectionStart).toBe(0);
    expect(next.selectionEnd).toBe('Cobblestone Cafe'.length);
  });

  it('picks the category on the first Enter and lands back in the category on the next row', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    // Open the category list and type, exactly as the owner described. Typed
    // with fireEvent rather than user.type: the picker's trigger toggles the
    // list on any click inside it, so a synthetic click aimed at the search
    // box would shut the very list it opened.
    fireEvent.click(within(quickEditBox()).getByRole('combobox', { name: 'Category' }));
    fireEvent.change(categorySearch(), { target: { value: 'Takeaway' } });
    fireEvent.keyDown(categorySearch(), { key: 'ArrowDown' });

    // The first Enter belongs to the open list: it chooses, and saves nothing.
    fireEvent.keyDown(categorySearch(), { key: 'Enter' });
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(within(quickEditBox()).getByRole('combobox', { name: 'Category' })).toHaveTextContent('Takeaway');

    // The cursor is on Save & Next, where the next Enter presses it.
    expect(document.activeElement).toBe(saveAndNext());
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-1', expect.objectContaining({
      category: 'det-takeaway',
      categoryConfirmed: true,
    }));

    // "…and then the next line defaults into the category box again, so you can
    // just start typing the search again": open, empty, and holding the cursor.
    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(categorySearch());
    });
    expect(categorySearch()).toHaveValue('');
  });

  it('keeps the run going row after row, not just for the first hop', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Aldwych Bakery');

    // The box is REBUILT on each row it moves to — it is drawn inside the row
    // it belongs to, so a new row means a new box — and the field being worked
    // down has to survive that. One hop could pass on a remembered field that
    // is thrown away on the next; three rows in a row cannot.
    const runOneRow = async (): Promise<void> => {
      fireEvent.click(within(quickEditBox()).getByRole('combobox', { name: 'Category' }));
      fireEvent.change(categorySearch(), { target: { value: 'Takeaway' } });
      fireEvent.keyDown(categorySearch(), { key: 'ArrowDown' });
      fireEvent.keyDown(categorySearch(), { key: 'Enter' });
      expect(document.activeElement).toBe(saveAndNext());
      await user.keyboard('{Enter}');
    };

    await runOneRow();
    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Sandpiper Foods');
    });
    // Landed in the category, so this row's edit starts where the last one did:
    // the search is already open and holding the cursor.
    await waitFor(() => {
      expect(document.activeElement).toBe(categorySearch());
    });

    fireEvent.change(categorySearch(), { target: { value: 'Takeaway' } });
    fireEvent.keyDown(categorySearch(), { key: 'ArrowDown' });
    fireEvent.keyDown(categorySearch(), { key: 'Enter' });
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(categorySearch());
    });
    expect(updateTransaction).toHaveBeenCalledTimes(2);
    expect(updateTransaction.mock.calls.map(call => call[0])).toEqual(['txn-0', 'txn-1']);
  });

  it('settles a date on the first Enter, and lands on the next date without the calendar', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    // Focusing the date field opens its calendar, and its own Enter settles it
    // — that IS the accept, so the cursor moves on to the run button from
    // there just as it does from the description.
    fireEvent.focus(dateField());
    expect(calendarIsShowing()).toBe(true);
    fireEvent.keyDown(dateField(), { key: 'Enter' });
    expect(document.activeElement).toBe(saveAndNext());

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(dateField());
    });
    // Shut. A calendar unfurling over the next three transactions on every row
    // of a run would hide the very list being worked down. (F2 still opens it:
    // that is someone asking to edit this row, not a run passing through.)
    expect(calendarIsShowing()).toBe(false);
  });

  it('starts a run in the date field when no field was touched at all', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    // Opened and moved straight on: nothing to be sticky about, so the cursor
    // goes where F2 puts it — the first field.
    fireEvent.click(saveAndNext());

    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(dateField());
    });
    expect(calendarIsShowing()).toBe(false);
  });

  it('puts the working word on the button that was actually pressed', async () => {
    // Held open on purpose, so the in-flight moment can be looked at.
    const pending: { release: (() => void) | null } = { release: null };
    updateTransaction.mockImplementationOnce(
      () => new Promise<void>(resolve => { pending.release = (): void => resolve(); })
    );
    await openRegister();
    clickRow('Sandpiper Foods');

    // Held by reference, because its NAME is the thing under test: it stops
    // being "Save & Next" for as long as the write takes.
    const runButton = saveAndNext();
    fireEvent.click(runButton);

    // Both are disabled while a write is in flight, but only the one the user
    // pressed says what it is doing — the other must not claim the work.
    await waitFor(() => {
      expect(runButton).toHaveTextContent('Saving…');
    });
    expect(saveButton()).toHaveTextContent('Save');

    pending.release?.();
    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    });
  });

  it('writes the transaction ONCE when Enter presses a button', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    saveAndNext().focus();
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
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    descriptionField().focus();
    fireEvent.change(descriptionField(), { target: { value: '   ' } });
    fireEvent.keyDown(descriptionField(), { key: 'Enter' });
    await user.keyboard('{Enter}');

    // The same complaint the button makes, because it IS the button being
    // pressed. (The wording is the app's shared error map's, which generalises
    // "Description is required" to the field-agnostic line.)
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(updateTransaction).not.toHaveBeenCalled();
    // And nothing moved on: the row, and the typing, are still there to fix.
    expect(boxIsShowing()).toBe(true);
    expect(activeRowText()).toContain('Sandpiper Foods');
  });

  it('gives the keyboard back to the run button when the save itself fails', async () => {
    const user = userEvent.setup();
    updateTransaction.mockImplementationOnce(async () => {
      // WHAT JSDOM DOES NOT DO: a real browser blurs a button the moment it is
      // disabled, and every button here disables itself while its write is in
      // flight. jsdom leaves the focus where it was, so without this the test
      // would prove nothing at all. Done here because here is where the real
      // thing happens — inside the write, as the button greys out.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement) focused.blur();
      throw new Error('The connection dropped.');
    });
    await openRegister();
    clickRow('Sandpiper Foods');

    descriptionField().focus();
    fireEvent.change(descriptionField(), { target: { value: 'Sandpiper Foods Ltd' } });
    fireEvent.keyDown(descriptionField(), { key: 'Enter' });
    await user.keyboard('{Enter}');

    // Without putting it back, a failed save ends with the message on screen
    // and the keyboard on nothing at all.
    await waitFor(() => {
      expect(document.activeElement).toBe(saveAndNext());
    });
    // Still open, still holding what was typed, so pressing Enter again retries
    // exactly the same edit.
    expect(boxIsShowing()).toBe(true);
    expect(descriptionField()).toHaveValue('Sandpiper Foods Ltd');
    expect(activeRowText()).toContain('Sandpiper Foods');
  });
});

describe('Account register — the last row of the register ends the run', () => {
  it('offers no Save & Next, and its Save hands the keyboard back', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Thistledown Books');

    // Nothing below it, so nothing pretends there is: no wrap to the top, and
    // no button that would do nothing.
    expect(within(quickEditBox()).queryByRole('button', { name: 'Save & Next' })).not.toBeInTheDocument();
    expect(
      within(quickEditBox()).getByText('Enter accepts · Enter again saves · Esc closes')
    ).toBeInTheDocument();

    descriptionField().focus();
    fireEvent.keyDown(descriptionField(), { key: 'Enter' });
    // The same two keystrokes; the run button is simply Save here.
    expect(document.activeElement).toBe(saveButton());
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(boxIsShowing()).toBe(false);
    });
    expect(document.activeElement).toBe(grid());
    expect(activeRowText()).toContain('Thistledown Books');
    // …and the arrows work from the row that was saved.
    expect(fireEvent.keyDown(grid(), { key: 'ArrowUp' })).toBe(false);
    expect(activeRowText()).toContain('Cobblestone Cafe');
  });
});

describe('Account register — the box hands the keyboard back when it closes', () => {
  it('lets the arrow keys carry on the moment a save closes the box', async () => {
    const user = userEvent.setup();
    await openRegister();
    clickRow('Sandpiper Foods');

    const save = within(quickEditBox()).getByRole('button', { name: 'Save' });
    save.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });

    // The owner's report: "press Enter to save, then the down arrow scrolls the
    // transactions list instead of moving to the next transaction."
    //
    // Fired wherever the keyboard actually is, because that is all the user
    // does — press Down. If the box left the focus on a button of its own (or
    // on nothing at all), the register never sees the key, nothing is
    // prevented, and the browser scrolls the list instead.
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
    expect(fireEvent.keyDown(focused, { key: 'ArrowDown' })).toBe(false);
    expect(activeRowText()).toContain('Cobblestone Cafe');

    // …because the box shut and put the keyboard back on the list.
    expect(boxIsShowing()).toBe(false);
    expect(document.activeElement).toBe(grid());
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
