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
 * The Quick Add row's keyboard manners — Microsoft Money's, three of them:
 *
 *   1. the Description box completes itself from the user's own payees, faint,
 *      ahead of the caret, and ONLY Right Arrow makes that text real;
 *   2. the Category box opens on the character typed at it, instead of sitting
 *      deaf until somebody finds ArrowDown;
 *   3. Enter is + Add from every field, with the two guards that stop a
 *      one-keystroke add being a one-keystroke mistake.
 *
 * THE HEADLINE, and the reason the ghost is an overlay rather than selected
 * text: an un-accepted suggestion is NEVER committed. Tab away or press Enter
 * while it is faint and only the typed characters count. That is asserted here
 * from both exits, and it holds because the input's VALUE never contains the
 * suggestion — not because each exit remembers to strip it.
 *
 * WHAT JSDOM CANNOT DO: it lays nothing out, so nothing here proves the ghost
 * sits pixel-for-pixel where the next character would be drawn, in either
 * theme. What it CAN prove is which text is in the value, which is in the
 * overlay, and what each key does to both — and that is what is asserted. The
 * alignment is a browser check and is named as one in the handover.
 *
 * Every payee, category and figure below is invented: this repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const SAVINGS: Account = {
  id: 'acc-savings', name: 'Synthetic Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-takeaway', name: 'Takeaway', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'grp-travel', name: 'Travel', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'grp-travel' },
];

/**
 * A history with something for the ranking to be wrong about: "Marrow & Vine"
 * three times against "Marchbank Cycles" once, so most-used wins over
 * most-recent; and "Marrow & Vine" filed under Groceries twice and Takeaway
 * once, so most-common wins over last-used for the category it remembers.
 */
const ROWS: Transaction[] = [
  {
    id: 'txn-0', date: new Date(Date.UTC(2026, 0, 4)), description: 'Marrow & Vine',
    amount: -14.2, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-1', date: new Date(Date.UTC(2026, 0, 9)), description: 'Marrow & Vine',
    amount: -9.4, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-2', date: new Date(Date.UTC(2026, 0, 14)), description: 'Marrow & Vine',
    amount: -6.15, type: 'expense', category: 'det-takeaway', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-3', date: new Date(Date.UTC(2026, 1, 2)), description: 'Marchbank Cycles',
    amount: -48, type: 'expense', category: 'det-fuel', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-4', date: new Date(Date.UTC(2026, 1, 8)), description: 'Thistledown Books',
    amount: -12, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
];

const addTransaction = vi.fn().mockResolvedValue({ id: 'txn-new' });

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

/** The add bar at the foot of the page — a landmark of its own. */
const addBar = (): HTMLElement => screen.getByRole('form', { name: 'Quick Add Transaction' });

const descriptionBox = (): HTMLInputElement => {
  const el = within(addBar()).getByLabelText('Description');
  if (!(el instanceof HTMLInputElement)) throw new Error('the Description field is not an input');
  return el;
};

const amountBox = (): HTMLInputElement => {
  const el = within(addBar()).getByLabelText('Amount');
  if (!(el instanceof HTMLInputElement)) throw new Error('the Amount field is not an input');
  return el;
};

const categoryBox = (): HTMLElement => within(addBar()).getByRole('combobox', { name: 'Category' });

const addButton = (): HTMLElement => within(addBar()).getByRole('button', { name: 'Add' });

/** The faint text drawn ahead of the caret, or '' when there is none. */
const ghost = (): string => addBar().querySelector('[data-payee-ghost]')?.textContent ?? '';

/**
 * Type into the Description box the way a keyboard does — a keydown that the
 * ghost logic reads, then the character itself.
 *
 * fireEvent.change alone fires no keydown at all, and the whole of the
 * dismiss-on-delete rule is decided in keydown; a test that skipped it would
 * be testing a code path no user can reach.
 */
const typeInDescription = (text: string): void => {
  const box = descriptionBox();
  for (const char of text) {
    fireEvent.keyDown(box, { key: char });
    fireEvent.change(box, { target: { value: box.value + char } });
  }
};

/** Backspace, as a keyboard delivers it: the keydown, then the shorter value. */
const backspaceDescription = (): void => {
  const box = descriptionBox();
  fireEvent.keyDown(box, { key: 'Backspace' });
  fireEvent.change(box, { target: { value: box.value.slice(0, -1) } });
};

/** Put the caret somewhere and press Right Arrow there. */
const rightArrowAt = (box: HTMLInputElement, caret: number): boolean => {
  box.setSelectionRange(caret, caret);
  return fireEvent.keyDown(box, { key: 'ArrowRight' });
};

const openRegister = async (): Promise<void> => {
  renderRegister();
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
  // A REAL focus, not a dispatched focus event: it both arms the payee index
  // (which is built on demand, so the register's first paint does not pay for a
  // pass over every transaction the user owns) and makes the box the thing Tab
  // moves AWAY from — which is the whole of the never-committed test below.
  descriptionBox().focus();
};

/** A complete draft, minus whatever the test is about. */
const fillDraft = (over: { description?: string; amount?: string } = {}): void => {
  typeInDescription(over.description ?? 'Halgrove Studio');
  fireEvent.change(amountBox(), { target: { value: over.amount ?? '24.50' } });
};

beforeEach(() => {
  localStorage.clear();
  addTransaction.mockClear();
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

describe('Quick Add — the payee completes itself', () => {
  it('offers the most-used payee that continues what has been typed', async () => {
    await openRegister();

    typeInDescription('Mar');

    // Marrow & Vine three times against Marchbank Cycles once — most used, not
    // most recent, and Marchbank is the later of the two.
    expect(ghost()).toBe('row & Vine');
    // And the value is the typed characters, nothing more.
    expect(descriptionBox()).toHaveValue('Mar');
  });

  it('narrows to the other payee as the typing goes on', async () => {
    await openRegister();

    typeInDescription('Marc');

    expect(ghost()).toBe('hbank Cycles');
    expect(descriptionBox()).toHaveValue('Marc');
  });

  it('goes when a keystroke breaks the match', async () => {
    await openRegister();

    typeInDescription('Mar');
    expect(ghost()).not.toBe('');

    typeInDescription('z');

    expect(ghost()).toBe('');
    expect(descriptionBox()).toHaveValue('Marz');
  });

  it('is dismissed by Backspace, and stays dismissed until fresh typing', async () => {
    await openRegister();

    typeInDescription('Marr');
    expect(ghost()).not.toBe('');

    backspaceDescription();

    // Gone — and the keystroke did its ordinary job on the way.
    expect(ghost()).toBe('');
    expect(descriptionBox()).toHaveValue('Mar');

    // Still gone: a suggestion that came back on the key pressed to be rid of
    // it would be the app arguing.
    backspaceDescription();
    expect(ghost()).toBe('');

    // A fresh character brings it back.
    typeInDescription('r');
    expect(ghost()).not.toBe('');
  });

  it('says nothing about an empty box', async () => {
    await openRegister();

    typeInDescription('M');
    expect(ghost()).not.toBe('');
    backspaceDescription();

    expect(descriptionBox()).toHaveValue('');
    expect(ghost()).toBe('');
  });
});

describe('Quick Add — Right Arrow is the only way to accept', () => {
  it('turns the ghost into real text, with the caret at the end', async () => {
    await openRegister();

    typeInDescription('Marr');
    const box = descriptionBox();
    expect(rightArrowAt(box, box.value.length)).toBe(false); // claimed

    await waitFor(() => expect(descriptionBox()).toHaveValue('Marrow & Vine'));
    expect(ghost()).toBe('');
    expect(descriptionBox().selectionStart).toBe('Marrow & Vine'.length);
  });

  it('still just moves the caret when the caret is not at the end', async () => {
    await openRegister();

    typeInDescription('Marr');
    const box = descriptionBox();
    // Caret parked in the middle of the typed text: Right Arrow there is a
    // caret move and nothing else.
    expect(rightArrowAt(box, 2)).toBe(true); // not claimed — the browser's

    expect(descriptionBox()).toHaveValue('Marr');
    expect(ghost()).not.toBe('');
  });

  it('leaves Right Arrow alone when there is no ghost to accept', async () => {
    await openRegister();

    typeInDescription('Marz');
    const box = descriptionBox();

    expect(rightArrowAt(box, box.value.length)).toBe(true);
    expect(descriptionBox()).toHaveValue('Marz');
  });

  it('leaves Shift+Right Arrow to the selection it is making', async () => {
    await openRegister();

    typeInDescription('Marr');
    const box = descriptionBox();
    box.setSelectionRange(box.value.length, box.value.length);

    expect(fireEvent.keyDown(box, { key: 'ArrowRight', shiftKey: true })).toBe(true);
    expect(descriptionBox()).toHaveValue('Marr');
  });

  it('offers the category it usually files that payee under', async () => {
    await openRegister();

    typeInDescription('Marr');
    const box = descriptionBox();
    rightArrowAt(box, box.value.length);

    // Groceries twice against Takeaway once — the habit, not the last accident.
    await waitFor(() => expect(categoryBox()).toHaveTextContent('Groceries'));
  });
});

describe('Quick Add — a ghost nobody accepted is never committed', () => {
  it('keeps only the typed characters when Tab moves on', async () => {
    const user = userEvent.setup();
    await openRegister();

    typeInDescription('Marr');
    expect(ghost()).not.toBe('');

    await user.tab();

    // THE RULE. The value never held the suggestion, so there was nothing for
    // the exit to commit.
    expect(descriptionBox()).toHaveValue('Marr');
    expect(ghost()).toBe('');
  });

  it('adds the typed characters, not the suggestion, when Enter finishes the row', async () => {
    await openRegister();

    // The rest of the row first — a category, so the row goes straight in with
    // no question asked — and the payee LAST, so the ghost is still faint at
    // the moment Enter is pressed. (Reaching the category picker moves the
    // cursor out of the Description box, and leaving the box drops the ghost:
    // that is the behaviour, so the test works with it rather than around it.)
    fireEvent.change(amountBox(), { target: { value: '18.00' } });
    fireEvent.keyDown(categoryBox(), { key: 'g' });
    fireEvent.click(await screen.findByText('Groceries'));

    descriptionBox().focus();
    typeInDescription('Marr');

    expect(ghost()).toBe('ow & Vine');
    fireEvent.keyDown(descriptionBox(), { key: 'Enter' });

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction.mock.calls[0][0]).toMatchObject({ description: 'Marr' });
  });
});

describe('Quick Add — the Category box answers to typing', () => {
  it('opens on a printable character, with that character already filtering', async () => {
    await openRegister();

    expect(within(addBar()).queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.keyDown(categoryBox(), { key: 'g' });

    const list = await within(addBar()).findByRole('listbox');
    // Narrowed to what "g" can mean. (The picker matches a category's GROUP
    // name as well as its own, which is why the letter chosen here is one that
    // no group answers to — otherwise "filtered" would prove nothing.)
    expect(within(list).getByText('Groceries')).toBeInTheDocument();
    expect(within(list).queryByText('Fuel')).not.toBeInTheDocument();
    expect(within(list).queryByText('Takeaway')).not.toBeInTheDocument();
    // The character that opened the list is the character in the search box —
    // nothing has to be retyped.
    expect(within(addBar()).getByPlaceholderText('Category...')).toHaveValue('g');
  });

  it('still opens on ArrowDown, with nothing filtered out', async () => {
    await openRegister();

    fireEvent.keyDown(categoryBox(), { key: 'ArrowDown' });

    const list = await within(addBar()).findByRole('listbox');
    expect(within(list).getByText('Groceries')).toBeInTheDocument();
    expect(within(list).getByText('Fuel')).toBeInTheDocument();
    expect(within(addBar()).getByPlaceholderText('Category...')).toHaveValue('');
  });

  it('takes Enter for the highlighted option and does not add the row', async () => {
    await openRegister();
    fillDraft();

    fireEvent.keyDown(categoryBox(), { key: 'g' });
    const search = await within(addBar()).findByPlaceholderText('Category...');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    // Chosen and closed…
    await waitFor(() => expect(categoryBox()).toHaveTextContent('Groceries'));
    expect(within(addBar()).queryByRole('listbox')).not.toBeInTheDocument();
    // …and emphatically not submitted.
    expect(addTransaction).not.toHaveBeenCalled();
  });
});

describe('Quick Add — Enter adds the transaction', () => {
  const chooseGroceries = async (): Promise<void> => {
    fireEvent.keyDown(categoryBox(), { key: 'g' });
    fireEvent.click(await screen.findByText('Groceries'));
  };

  it('writes the row from the Description box, with the list closed', async () => {
    await openRegister();
    fillDraft();
    await chooseGroceries();

    fireEvent.keyDown(descriptionBox(), { key: 'Enter' });

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction.mock.calls[0][0]).toMatchObject({
      description: 'Halgrove Studio',
      category: 'det-groceries',
      accountId: ACCOUNT.id,
      amount: -24.5,
    });
  });

  it('writes it from the Date box, which lets a settled date go', async () => {
    await openRegister();
    fillDraft();
    await chooseGroceries();

    // The date picker swallows Enter only while it has a draft or an open
    // calendar of its own to settle; with neither, the key is the form's.
    fireEvent.keyDown(within(addBar()).getByLabelText('Date'), { key: 'Enter' });

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
  });

  it('writes it from the Amount box too', async () => {
    await openRegister();
    fillDraft();
    await chooseGroceries();

    fireEvent.keyDown(amountBox(), { key: 'Enter' });

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
  });

  it('writes it from the closed Category box, which no longer eats the key', async () => {
    await openRegister();
    fillDraft();
    await chooseGroceries();

    fireEvent.keyDown(categoryBox(), { key: 'Enter' });

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    // And the list did not open instead.
    expect(within(addBar()).queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('adds ONCE when the key is leaned on', async () => {
    await openRegister();
    fillDraft();
    await chooseGroceries();

    const box = descriptionBox();
    fireEvent.keyDown(box, { key: 'Enter' });
    // The same press, still held: the browser repeats it, the register does not.
    fireEvent.keyDown(box, { key: 'Enter', repeat: true });
    fireEvent.keyDown(box, { key: 'Enter', repeat: true });
    // And a genuine second press inside the write's own window is latched out,
    // because the draft is still on screen until the write comes back.
    fireEvent.keyDown(box, { key: 'Enter' });

    await waitFor(() => expect(descriptionBox()).toHaveValue(''));
    expect(addTransaction).toHaveBeenCalledTimes(1);
  });

  it('empties the draft once the row is in', async () => {
    await openRegister();
    fillDraft();
    await chooseGroceries();

    fireEvent.keyDown(descriptionBox(), { key: 'Enter' });

    await waitFor(() => expect(descriptionBox()).toHaveValue(''));
    expect(amountBox()).toHaveValue('');
  });
});

describe('Quick Add — the guards, identical from the key and from the button', () => {
  it('refuses an empty amount, says so at the box, and puts the cursor there', async () => {
    await openRegister();
    typeInDescription('Halgrove Studio');

    fireEvent.keyDown(descriptionBox(), { key: 'Enter' });

    const message = await within(addBar()).findByRole('alert');
    expect(message).toHaveTextContent('Please enter an amount');
    expect(addTransaction).not.toHaveBeenCalled();
    // The box at fault, marked, tied to the message, and holding the cursor.
    expect(amountBox()).toHaveAttribute('aria-invalid', 'true');
    expect(amountBox().getAttribute('aria-describedby')).toBe(message.id);
    expect(document.activeElement).toBe(amountBox());
    // No dialog was raised for it: this is a block, not a question.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('refuses a zero amount for the same reason', async () => {
    await openRegister();
    fillDraft({ amount: '0.00' });

    fireEvent.keyDown(descriptionBox(), { key: 'Enter' });

    expect(await within(addBar()).findByRole('alert')).toHaveTextContent('Please enter an amount');
    expect(addTransaction).not.toHaveBeenCalled();
  });

  it('refuses an empty description at the description box', async () => {
    await openRegister();
    // The cursor starts somewhere else, so "the cursor moved to the fault" is
    // a claim the test can actually fail.
    amountBox().focus();
    fireEvent.change(amountBox(), { target: { value: '24.50' } });

    fireEvent.click(addButton());

    const message = await within(addBar()).findByRole('alert');
    expect(message).toHaveTextContent('Please enter a description');
    expect(descriptionBox()).toHaveAttribute('aria-invalid', 'true');
    expect(document.activeElement).toBe(descriptionBox());
    expect(addTransaction).not.toHaveBeenCalled();
  });

  it('reaches the same refusal through the + Add button', async () => {
    await openRegister();
    typeInDescription('Halgrove Studio');

    fireEvent.click(addButton());

    expect(await within(addBar()).findByRole('alert')).toHaveTextContent('Please enter an amount');
    expect(document.activeElement).toBe(amountBox());
    expect(addTransaction).not.toHaveBeenCalled();
  });

  it('asks before adding without a category, and adds when told to continue', async () => {
    await openRegister();
    fillDraft();

    fireEvent.keyDown(descriptionBox(), { key: 'Enter' });

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/add anyway\?/i);
    expect(addTransaction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction.mock.calls[0][0]).toMatchObject({
      description: 'Halgrove Studio',
      category: '',
    });
  });

  it('leaves the draft untouched when the question is cancelled', async () => {
    await openRegister();
    fillDraft();

    fireEvent.click(addButton());

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(addTransaction).not.toHaveBeenCalled();
    // Nothing lost.
    expect(descriptionBox()).toHaveValue('Halgrove Studio');
    expect(amountBox()).toHaveValue('24.50');
  });

  it('asks the same question from the + Add button as from the key', async () => {
    await openRegister();
    fillDraft();

    fireEvent.click(addButton());

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/add anyway\?/i);
    expect(addTransaction).not.toHaveBeenCalled();
  });

  it('cannot be answered by the key that asked it, held down', async () => {
    await openRegister();
    fillDraft();

    fireEvent.keyDown(descriptionBox(), { key: 'Enter' });
    const dialog = await screen.findByRole('alertdialog');

    // Continue has the focus, so the keyboard run finishes without the mouse —
    // but a key HELD from the add bar repeats, and a repeat is refused.
    fireEvent.keyDown(dialog, { key: 'Enter', repeat: true });

    expect(addTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
