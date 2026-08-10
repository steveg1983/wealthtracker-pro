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
import { QUICK_EDIT_ROW_HEIGHT, QUICK_EDIT_STRIP_HEIGHT } from '../../components/QuickEditRow';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * The row IS the editor.
 *
 * The owner's first ask put a box in the register, under the row it was about:
 * "when you click on a transaction, that kind of box appears sort of in the
 * transaction list, directly below the transaction line itself… if I enter a
 * category and then press 'enter' it could save automatically… I could also
 * press 'escape' to hide that quick edit box and just see the transaction
 * list."
 *
 * That box repeated Date, Description and Category as a second set of fields
 * one line below the first, so every value appeared twice on screen at two
 * different widths. His next ask closed the gap: highlight a row and the row
 * ITSELF becomes the form — the Date cell a date picker, the Description cell a
 * text box, the Category cell a combobox, each still under its own column
 * header — with only a slim strip beneath carrying the buttons and the hint.
 *
 * And the rhythm he asked for once he had used it: "if I am trying to do a list
 * of categories, you almost want to do save & next and then the next line
 * defaults into the category box again, so you can just start typing the search
 * again… Maybe the same if you are in description."
 *
 * So seven things have to hold, and each has a test here:
 *   1. the fields are cells of the CLICKED ROW, under the columns they belong
 *      to, and the strip below holds buttons and hint and nothing else;
 *   2. a row that is not being edited is drawn exactly as it was;
 *   3. Enter ACCEPTS what was typed and hands over Save & Next; the next Enter
 *      saves and moves on. Two keystrokes, the same two every row;
 *   4. the editor that opens on the next row puts the cursor back in the field
 *      the run is working down — category, description or date;
 *   5. Enter belongs to whatever already wants it: an open category list
 *      chooses with it, a button is pressed by it, and neither also saves;
 *   6. every way the editor closes — Save, Escape, the × — hands the keyboard
 *      back to the list with the row still highlighted, so the arrow keys
 *      carry on rather than scrolling;
 *   7. selecting text in a field is selecting text, even when the mouse comes
 *      up outside the field — the row does not read it as the second click
 *      that opens the full editor.
 *
 * WHAT JSDOM CANNOT DO: no layout. That the columns line up under their headers
 * at real widths, that a 100px Date column holds a dd/mm/yyyy picker, that the
 * taller editing row does not jar, and that the calendar and category list
 * escape the table rather than being clipped by it, are browser checks — named
 * as such in the handover. The geometry of the virtualised path is held to
 * account separately, in VirtualizedTable.rowDetail.test.tsx.
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

// Named by its own visible heading (aria-labelledby), so this string is the one
// on the screen as well as the one a screen reader hears.
const addBar = (): HTMLElement => screen.getByRole('form', { name: 'Quick Add Transaction' });

/** The strip under the row being edited — the buttons and the hint. */
const strip = (): HTMLElement => {
  const el = document.querySelector('[data-quick-edit="actions"]');
  if (!(el instanceof HTMLElement)) throw new Error('no row is being edited');
  return el;
};

/** The row that has BECOME the editor: the one whose cells hold the fields. */
const editorRow = (): HTMLElement => {
  const field = document.querySelector('[data-quick-edit="description"]');
  const row = field?.closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error('no row is being edited');
  return row;
};

const isEditing = (): boolean => document.querySelector('[data-quick-edit="actions"]') !== null;

// The three fields are named rather than labelled — the column header is the
// label — so they are found by the name a screen reader would read out. Which
// is also what keeps them apart from the add bar's own Date and Description at
// the foot of the page.
const descriptionField = (): HTMLInputElement => {
  const el = screen.getByLabelText('Transaction description');
  if (!(el instanceof HTMLInputElement)) throw new Error('the description is not an input');
  return el;
};

const dateField = (): HTMLElement => screen.getByLabelText('Transaction date');

const categorySearch = (): HTMLElement =>
  screen.getByPlaceholderText('Search or select category…');

/** The run button — the one a field's Enter hands the cursor to. */
const saveAndNext = (): HTMLElement => within(strip()).getByRole('button', { name: 'Save & Next' });

/** The button that ENDS a run: saves, stops editing, keyboard back to the list. */
const saveButton = (): HTMLElement => within(strip()).getByRole('button', { name: 'Save' });

const calendarIsShowing = (): boolean => document.querySelector('[data-datepicker-panel]') !== null;

/** Which row the register says is active — its DOM id, whatever it holds. */
const activeRowId = (): string | null => grid().getAttribute('aria-activedescendant');

/**
 * What the register's active row holds: its text, AND whatever has been typed
 * into the boxes it has become.
 *
 * Both halves are needed now. A row being edited has no description TEXT — the
 * cell is an input, and an input's value is not text content — so a helper that
 * read only textContent could answer "which row is the highlight on?" for every
 * row in the register except the one being worked on.
 */
const activeRowText = (): string => {
  const id = activeRowId();
  const row = id ? document.getElementById(id) : null;
  if (!row) return '';
  const typed = Array.from(row.querySelectorAll('input')).map(input => input.value).join(' ');
  return `${row.textContent ?? ''} ${typed}`;
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
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — the row itself becomes the editor', () => {
  it('puts each field in the cell it edits, under the column it belongs to', async () => {
    await openRegister();

    clickRow('Sandpiper Foods');

    // The row that was clicked is the row that is now the form: the fields are
    // its own cells, not a second set of them somewhere else.
    const row = editorRow();
    expect(grid().contains(row)).toBe(true);
    expect(descriptionField()).toHaveValue('Sandpiper Foods');
    expect(row.contains(descriptionField())).toBe(true);
    expect(row.contains(dateField())).toBe(true);
    expect(row.contains(within(row).getByRole('combobox', { name: 'Category' }))).toBe(true);

    // …and each in the RIGHT cell. The register draws its columns in one order
    // and the header in the same one, so a field is under its own header if and
    // only if its cell has the same index as its column header. That is the
    // whole of the alignment contract that can be checked without layout: what
    // it LOOKS like at real widths is a browser check.
    // The sorted column's header carries an arrow as well as its name.
    const headers = within(grid())
      .getAllByRole('columnheader')
      .map(h => (h.textContent ?? '').replace(/[↑↓]/g, '').trim());
    const cells = within(row).getAllByRole('gridcell');
    const cellIndexOf = (el: HTMLElement): number =>
      cells.indexOf(el.closest('[role="gridcell"]') as HTMLElement);
    expect(cellIndexOf(dateField())).toBe(headers.indexOf('Date'));
    expect(cellIndexOf(descriptionField())).toBe(headers.indexOf('Description'));
    expect(cellIndexOf(within(row).getByRole('combobox', { name: 'Category' })))
      .toBe(headers.indexOf('Category'));
  });

  it('leaves the money alone: Payment, Deposit and Balance still read as figures', async () => {
    await openRegister();

    clickRow('Sandpiper Foods');

    // One editor per thing. Amounts belong to the full editor, and a register
    // you can retype a balance into is a register nobody can trust — so the
    // cells that carry money hold no input at all.
    const row = editorRow();
    expect(within(row).getByText('£31.15')).toBeInTheDocument();
    expect(within(row).getByTestId('register-balance')).toBeInTheDocument();
    expect(within(row).getAllByRole('textbox')).toHaveLength(2); // date + description
  });

  it('keeps the strip to buttons and a hint — no field appears twice', async () => {
    await openRegister();

    clickRow('Sandpiper Foods');

    // The whole point of the change: there is no second Date, no second
    // Description, no second Category anywhere below the row. What is left is
    // the small print and the things you can do.
    const actions = strip();
    expect(within(actions).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(actions).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(actions).getAllByRole('button').map(b => b.textContent))
      .toEqual(['Save & Next', 'Save', '']);
    expect(
      within(actions).getByText('Enter accepts · Enter again saves & moves on · Esc closes')
    ).toBeInTheDocument();

    // And it is a row of the grid in its own right, on the line below the one
    // being edited — the rows under it are what move down.
    const rows = within(grid()).getAllByRole('row');
    const stripRow = actions.closest('[role="row"]');
    expect(rows.indexOf(stripRow as HTMLElement)).toBe(rows.indexOf(editorRow()) + 1);
  });

  it('draws every other row exactly as it drew it before', async () => {
    await openRegister();

    // Byte for byte: opening an editor on one row must not so much as re-space
    // a neighbour. Anything that changes here changes it for eleven thousand
    // rows at once.
    const before = within(grid()).getByText('Thistledown Books').closest('[role="row"]')?.outerHTML;

    clickRow('Sandpiper Foods');

    const after = within(grid()).getByText('Thistledown Books').closest('[role="row"]')?.outerHTML;
    expect(after).toBe(before);
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

  it('counts the strip as the row of the grid that it is', async () => {
    await openRegister();
    // Header + the Opening Balance line + the transactions.
    expect(grid()).toHaveAttribute('aria-rowcount', String(ROWS.length + 2));

    clickRow('Sandpiper Foods');

    expect(grid()).toHaveAttribute('aria-rowcount', String(ROWS.length + 3));
  });

  it('opens the full editor from a click OUTSIDE the fields, and never from one in them', async () => {
    await openRegister();

    clickRow('Sandpiper Foods');
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();

    // Escape stops editing but keeps the row…
    fireEvent.keyDown(descriptionField(), { key: 'Escape' });
    expect(isEditing()).toBe(false);

    // …so the next click is asking to edit it again, not for the full editor.
    clickRow('Sandpiper Foods');
    expect(isEditing()).toBe(true);
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();

    // Clicking INTO a field is typing, not asking for anything else. This is
    // new, and it is the one thing the row-as-editor had to get right: the
    // fields now sit inside the very row whose click opens the modal.
    fireEvent.click(descriptionField());
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();
    expect(isEditing()).toBe(true);

    // A click on the row that is NOT in a field still means "everything else
    // about this row" — the amounts, the splits, the tags.
    fireEvent.click(within(editorRow()).getByTestId('register-balance'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit Transaction')).toBeInTheDocument();
  });
});

/**
 * Selecting text in the row's own box, when the mouse comes up outside it.
 *
 * The owner's report, made while cleaning up imported descriptions: he drags to
 * select the text in the description box, lets go slightly outside the box, and
 * the Edit Transaction window opens over what he was about to retype. He was
 * only selecting text. It bites constantly, because letting go a few pixels low
 * or right of a 36px-tall box is the normal way to select a whole line.
 *
 * WHY IT HAPPENS, and why the row editor's existing guard cannot see it: a
 * browser dispatches `click` on the nearest COMMON ANCESTOR of where the button
 * went down and where it came up. Down in the description box and up on the
 * row makes that ancestor THE ROW — so the click arrives with the row as its
 * target, and the cells' own stopPropagation (which can only speak for clicks
 * that TARGET them) never hears it. The register then reads a click on a row
 * that is already the editor as "give me the full editor".
 *
 * The gesture is told apart by where it BEGAN — see useRowClickGesture, which
 * also explains why `window.getSelection()` cannot answer this: text selected
 * inside an <input> lives in the control, not the document, and Chrome and
 * Safari report the document selection as collapsed throughout.
 *
 * WHAT JSDOM CANNOT DO: it has no pointer, so it neither synthesises the
 * ancestor click nor moves the caret. Both are done here by hand — the click is
 * dispatched on the row exactly as a browser would dispatch it, and the
 * selection the drag would have made is set on the input — and what is being
 * proved is what the register does with them. That a real drag in a real
 * browser produces this sequence is the browser check named in the handover.
 */
describe('Account register — a drag that selects text is not a click', () => {
  /** Where the press landed, where the button came up, and what the browser makes of it. */
  const dragFromTo = (from: Element, to: Element, ancestorClicked: Element): void => {
    fireEvent.mouseDown(from);
    fireEvent.mouseUp(to);
    fireEvent.click(ancestorClicked);
  };

  /** The cell a field sits in — the sliver of table the editor's shell covers. */
  const cellOf = (field: Element): Element => {
    const cell = field.closest('[role="gridcell"]');
    if (!cell) throw new Error('the field is not in a cell of the grid');
    return cell;
  };

  it('leaves the full editor shut when the drag began in the description box', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    const input = descriptionField();
    const row = editorRow();
    // The press focuses the box and the drag selects a word — both of which a
    // browser does for itself, and jsdom does not.
    input.focus();
    fireEvent.mouseDown(input);
    input.setSelectionRange(0, 9);
    fireEvent.mouseUp(row);
    fireEvent.click(row);

    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // …and the selection SURVIVES. Nothing may re-render or take the focus on
    // the way past: either would collapse what he was in the middle of
    // selecting, which is the same loss by a quieter route.
    expect(isEditing()).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(9);
    expect(activeRowText()).toContain('Sandpiper Foods');
  });

  it('leaves it shut for the category picker too, box or the sliver of cell around it', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    const row = editorRow();
    const category = within(row).getByRole('combobox', { name: 'Category' });

    // Ours is a DIV wearing role="combobox" with the search box inside it, so
    // "began in a control" has to be answered by role as well as by tag.
    dragFromTo(category, row, row);
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();

    // And the cell AROUND a field counts as the field: the editor's cell shell
    // covers the whole cell on purpose, so that aiming at the box and missing
    // it by three pixels types rather than opening the modal. A drag from those
    // three pixels is owed the same answer.
    dragFromTo(cellOf(descriptionField()), row, row);
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();
    expect(isEditing()).toBe(true);
  });

  it('still opens the full editor for a genuine second click, wherever it lands on the row', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    const row = editorRow();
    const balance = within(row).getByTestId('register-balance');

    // Down and up on parts of the row that are NOT fields — so the browser's
    // ancestor is once again the row, and the click looks IDENTICAL to the one
    // the drag produced. Only where it began differs, which is the whole of the
    // distinction being drawn.
    dragFromTo(balance, row, row);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit Transaction')).toBeInTheDocument();
  });

  it('still turns a row that was not being edited into the editor', async () => {
    await openRegister();

    // The first click on a row is never the full editor, and the guard must not
    // make it nothing at all: press and release on the row, as a mouse does.
    const target = within(grid()).getByText('Cobblestone Cafe');
    dragFromTo(target, target, target);

    expect(isEditing()).toBe(true);
    expect(activeRowText()).toContain('Cobblestone Cafe');
    expect(descriptionField()).toHaveValue('Cobblestone Cafe');
    expect(screen.queryByText('Edit Transaction')).not.toBeInTheDocument();
  });
});

describe('Account register — Enter accepts, and the Enter after it moves you on', () => {
  it('offers Save & Next first, ahead of the way to stop', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    // Left to right, the run button leads: it is the one the cursor lands on
    // and the one pressed a hundred times filing a statement. Save is the way
    // to stop, not the way to carry on.
    const buttons = within(strip()).getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual(['Save & Next', 'Save', '']);
  });

  it('is half the height it was, and the arithmetic is declared rather than guessed', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    // The three fields are 36px, which is what a register row's own 8px of
    // vertical cell padding leaves in the 52px the row grows to; the strip is
    // 36. So being edited costs a row 8px of extra line and 36 of strip — 44,
    // where the card this replaced was 88 on its own.
    //
    // WHAT JSDOM CANNOT DO: prove any of it LOOKS right — it performs no
    // layout, so the declared heights are the contract and the eye is a browser
    // check. The heights themselves are proved to be honoured by the
    // virtualised list in VirtualizedTable.rowDetail.test.tsx.
    expect(QUICK_EDIT_ROW_HEIGHT + QUICK_EDIT_STRIP_HEIGHT).toBe(88);
    expect(descriptionField().className).toContain('h-[36px]');
    expect(dateField().className).toContain('h-[36px]');
    expect(saveAndNext().className).toContain('h-[28px]');
    expect(saveButton().className).toContain('h-[28px]');

    // And the register HANDS both numbers to the table, which is the half that
    // can go wrong silently: the list positions rows by adding heights up, so a
    // row that grew without saying so is a row the strip is painted over by,
    // and every row below it sits 8px too high.
    expect(editorRow().style.height).toBe(`${QUICK_EDIT_ROW_HEIGHT}px`);
    const stripRow = strip().closest('[role="row"]');
    expect((stripRow as HTMLElement).style.height).toBe(`${QUICK_EDIT_STRIP_HEIGHT}px`);
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
    fireEvent.click(within(editorRow()).getByRole('combobox', { name: 'Category' }));
    fireEvent.change(categorySearch(), { target: { value: 'Takeaway' } });
    fireEvent.keyDown(categorySearch(), { key: 'ArrowDown' });

    // The first Enter belongs to the open list: it chooses, and saves nothing.
    fireEvent.keyDown(categorySearch(), { key: 'Enter' });
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(within(editorRow()).getByRole('combobox', { name: 'Category' })).toHaveTextContent('Takeaway');

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
      fireEvent.click(within(editorRow()).getByRole('combobox', { name: 'Category' }));
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
    // Held by id, not by name: the row's name is the very thing being emptied,
    // so "is the highlight still on it" has to be asked of the row itself.
    const editing = activeRowId();

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
    expect(isEditing()).toBe(true);
    expect(activeRowId()).toBe(editing);
    expect(descriptionField()).toHaveValue('   ');
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
    expect(isEditing()).toBe(true);
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
    expect(within(strip()).queryByRole('button', { name: 'Save & Next' })).not.toBeInTheDocument();
    expect(
      within(strip()).getByText('Enter accepts · Enter again saves · Esc closes')
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
      expect(isEditing()).toBe(false);
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

    const save = within(strip()).getByRole('button', { name: 'Save' });
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
    expect(isEditing()).toBe(false);
    expect(document.activeElement).toBe(grid());
  });
});

describe('Account register — the pickers inside a cell inside a list', () => {
  it('draws the calendar outside the table, and picking a date does not lose the row', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');

    fireEvent.focus(dateField());

    const calendar = document.querySelector('[data-datepicker-panel]');
    if (!(calendar instanceof HTMLElement)) throw new Error('the calendar did not open');
    // Outside the register entirely: an in-flow calendar would be cut off by
    // the table, which clips what overflows it — and now that the field is a
    // CELL of the table, it is clipped by the cell as well.
    expect(grid().contains(calendar)).toBe(false);

    // The click that matters. The register deselects on a mousedown outside
    // the table — and this one IS outside the table — so without the
    // calendar being recognised, the editor would unmount underneath the
    // finger and the date would never be set.
    fireEvent.mouseDown(within(calendar).getByRole('button', { name: '15' }));
    fireEvent.click(within(calendar).getByRole('button', { name: '15' }));

    expect(screen.getByLabelText('Transaction date')).toHaveValue('15/01/2026');
    expect(activeRowText()).toContain('Sandpiper Foods');
  });
});

describe('Account register — Escape peels the box off first', () => {
  it('closes the box, keeps the row, and only then lets go of the row', async () => {
    await openRegister();
    clickRow('Sandpiper Foods');
    expect(isEditing()).toBe(true);

    // One: the box goes, the highlight stays — "just see the transaction list".
    fireEvent.keyDown(descriptionField(), { key: 'Escape' });
    expect(isEditing()).toBe(false);
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
    const combobox = within(editorRow()).getByRole('combobox', { name: 'Category' });
    combobox.focus();
    fireEvent.keyDown(combobox, { key: 'Delete' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
