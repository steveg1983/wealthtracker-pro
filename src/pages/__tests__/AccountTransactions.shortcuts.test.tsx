import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * The rest of the register's keyboard: the search that letters do, the tick
 * that Space puts in the R column, the run of rows Shift stretches over, the
 * jump to the far half of a transfer, and the list that says so.
 *
 * WHAT JSDOM CANNOT DO, stated rather than pretended at: it performs no
 * layout, so nothing here proves that a row scrolled into view looks right, or
 * that a focus ring is visible, or that ⌘ prints where Ctrl should not. What
 * it CAN prove is the chain that matters — key in, state changed, the app's
 * own write called with the right arguments — and that is what every test
 * below asserts. The browser checks are named in the handover.
 *
 * Every name, date and figure is invented: this repo is public.
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
];

/**
 * Eight rows, oldest first, with payees chosen so type-ahead has something to
 * be wrong about: two beginning with S, one with a leading space, and one
 * whose first letters are a prefix of another's.
 */
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
    amount: -6.8, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: true,
  },
  {
    id: 'txn-3', date: new Date(Date.UTC(2026, 0, 12)), description: 'Sandpiper Fuel',
    amount: -52, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-4', date: new Date(Date.UTC(2026, 0, 15)), description: 'Marigold Insurance',
    amount: -18.99, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
  {
    // Half of a linked transfer — the other half lives in Synthetic Savings.
    id: 'txn-5', date: new Date(Date.UTC(2026, 0, 18)), description: 'Moved to savings',
    amount: -250, type: 'transfer', category: 'transfer-out', accountId: ACCOUNT.id,
    cleared: false, linkedTransferId: 'txn-far-side', transferAccountId: SAVINGS.id,
  },
  {
    id: 'txn-6', date: new Date(Date.UTC(2026, 0, 21)), description: 'Weekly shop',
    amount: -76.4, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id,
    cleared: false, isSplit: true,
  },
  {
    id: 'txn-7', date: new Date(Date.UTC(2026, 0, 24)), description: 'Thistledown Books',
    amount: -12, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
];

/** The far half of txn-5, sitting in the other account. */
const FAR_SIDE: Transaction = {
  id: 'txn-far-side', date: new Date(Date.UTC(2026, 0, 18)), description: 'Moved to savings',
  amount: 250, type: 'transfer', category: 'transfer-in', accountId: SAVINGS.id,
  cleared: false, linkedTransferId: 'txn-5', transferAccountId: ACCOUNT.id,
};

const deleteTransaction = vi.fn().mockResolvedValue(undefined);
const setTransactionsCleared = vi.fn().mockResolvedValue(undefined);
const setTransactionArchived = vi.fn().mockResolvedValue(undefined);

/**
 * Every address the router has been at, so a jump can be checked rather than
 * assumed. EVERY one, not just the last: a register consumes its own ?txn=
 * deep link with a replace the moment it arrives, so by the time the dust
 * settles the interesting address is already gone from the bar.
 */
let visitedPaths: string[] = [];
function PathProbe(): null {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;
  if (visitedPaths[visitedPaths.length - 1] !== path) visitedPaths.push(path);
  return null;
}

const renderRegister = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <PathProbe />
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

/**
 * The add bar at the foot of the page — a landmark of its own, because the
 * quick-edit box up in the register has a Date and a Description too, and
 * "the description box" has to say which.
 */
const addBar = (): HTMLElement => screen.getByRole('form', { name: 'Quick Add Transaction' });

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

/** …and where that row sits, or -1 for none. */
const activeRowIndex = (): number => {
  const text = activeRowText();
  return ROWS.findIndex(row => text.includes(row.description));
};

/**
 * The dock's bulk-action bar. Queried by its own attribute rather than by its
 * text, because the same count is deliberately said twice — once on screen,
 * once in the page's live region — and a bare text query cannot tell which of
 * the two it found.
 */
const selectionBar = (): HTMLElement => {
  const el = document.querySelector('[data-register-selection-bar]');
  if (!(el instanceof HTMLElement)) throw new Error('no bulk-action bar is showing');
  return el;
};

/**
 * The descriptions of every row the register marks as selected.
 *
 * Read from the row's text AND from anything typed into it: when a run
 * collapses back to a single row that row becomes the editor again, and its
 * payee is then the value of an input rather than text on the page.
 */
const rowReads = (row: HTMLElement): string => {
  const typed = Array.from(row.querySelectorAll('input')).map(input => input.value).join(' ');
  return `${row.textContent ?? ''} ${typed}`;
};

const selectedDescriptions = (): string[] =>
  within(grid())
    .getAllByRole('row')
    .filter(row => row.getAttribute('aria-selected') === 'true')
    .map(row => ROWS.find(r => rowReads(row).includes(r.description))?.description ?? '?');

const openRegister = async (path = `/accounts/${ACCOUNT.id}`): Promise<void> => {
  renderRegister(path);
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
};

/** Highlight a row the way a user would, and hand the keyboard to the grid. */
const highlight = (description: string): void => {
  fireEvent.click(within(grid()).getByText(description));
};

beforeEach(() => {
  localStorage.clear();
  deleteTransaction.mockClear();
  setTransactionsCleared.mockClear();
  setTransactionArchived.mockClear();
  visitedPaths = [];
  __setAppContextValue({
    accounts: [ACCOUNT, SAVINGS],
    transactions: [...ROWS, FAR_SIDE],
    categories: CATEGORIES,
    isLoading: false,
    deleteTransaction,
    setTransactionsCleared,
    setTransactionArchived,
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — Home and End', () => {
  it('goes to the first and the last transaction', async () => {
    await openRegister();

    expect(fireEvent.keyDown(grid(), { key: 'End' })).toBe(false);
    expect(activeRowIndex()).toBe(ROWS.length - 1);

    expect(fireEvent.keyDown(grid(), { key: 'Home' })).toBe(false);
    expect(activeRowIndex()).toBe(0);
  });
});

describe('Account register — typing a payee jumps to it', () => {
  it('lands on the next row whose description starts with the letters', async () => {
    await openRegister();

    fireEvent.keyDown(grid(), { key: 'm' });

    expect(activeRowText()).toContain('Marigold Insurance');
  });

  it('narrows as more letters arrive rather than skipping ahead', async () => {
    await openRegister();

    fireEvent.keyDown(grid(), { key: 's' });
    expect(activeRowText()).toContain('Sandpiper Foods');

    // "sandpiper f", still the same row — adding letters must not walk on to
    // the second Sandpiper.
    'andpiper f'.split('').forEach(key => fireEvent.keyDown(grid(), { key }));
    expect(activeRowText()).toContain('Sandpiper Foods');

    fireEvent.keyDown(grid(), { key: 'u' }); // …"sandpiper fu"
    expect(activeRowText()).toContain('Sandpiper Fuel');
  });

  it('walks through every payee sharing a letter when that letter is repeated', async () => {
    await openRegister();

    fireEvent.keyDown(grid(), { key: 's' });
    expect(activeRowText()).toContain('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: 's' });
    expect(activeRowText()).toContain('Sandpiper Fuel');
  });

  it('stays put on a typo instead of jumping somewhere arbitrary', async () => {
    await openRegister();
    highlight('Cobblestone Cafe');
    const before = activeRowText();

    // Claimed all the same: the app carries a window-level 'g'-then-key
    // navigation sequence, and a stray letter falling through to it would take
    // the user off the register mid-search.
    expect(fireEvent.keyDown(grid(), { key: 'q' })).toBe(false);
    expect(activeRowText()).toBe(before);
  });

  /**
   * The collision that makes stopPropagation non-negotiable.
   *
   * The app carries a window-level listener (useKeyboardShortcuts, mounted by
   * Layout) on which a bare `g` starts a two-key "go to…" sequence and `?`
   * opens the app-wide shortcut list. Left to bubble, typing "gr" to find a
   * payee would navigate to Reports mid-word. This stands in for that listener
   * and checks nothing reaches it.
   */
  it('lets no claimed key reach the app-wide shortcut listener above it', async () => {
    await openRegister();
    const reachedWindow: string[] = [];
    const spy = (e: KeyboardEvent): void => { reachedWindow.push(e.key); };
    window.addEventListener('keydown', spy);
    try {
      highlight('Cobblestone Cafe');
      // A letter that matches, one that does not, an arrow — and last, the
      // app-wide help key, which opens a dialog that then owns the keyboard.
      fireEvent.keyDown(grid(), { key: 'g' });
      fireEvent.keyDown(grid(), { key: 'q' });
      fireEvent.keyDown(grid(), { key: 'ArrowDown' });
      fireEvent.keyDown(grid(), { key: '?' });
    } finally {
      window.removeEventListener('keydown', spy);
    }

    expect(reachedWindow).toEqual([]);
  });

  it('is not what a letter with the modifier held means', async () => {
    await openRegister();
    highlight('Cobblestone Cafe');

    // Ctrl+M is nothing of the register's, so it is left to the browser…
    expect(fireEvent.keyDown(grid(), { key: 'm', ctrlKey: true })).toBe(true);
    // …and the highlight has certainly not gone hunting for a payee.
    expect(activeRowText()).toContain('Cobblestone Cafe');
  });
});

describe('Account register — Space reconciles the highlighted row', () => {
  it('ticks the R column through the same write the reconcile checkbox uses', async () => {
    await openRegister();
    highlight('Sandpiper Foods');

    expect(fireEvent.keyDown(grid(), { key: ' ' })).toBe(false);

    await waitFor(() => {
      expect(setTransactionsCleared).toHaveBeenCalledWith(['txn-1'], true);
    });
    expect(setTransactionsCleared).toHaveBeenCalledTimes(1);
  });

  it('un-reconciles a row that already is — the same round trip, the other way', async () => {
    await openRegister();
    highlight('Cobblestone Cafe'); // the one row that arrives cleared

    fireEvent.keyDown(grid(), { key: ' ' });

    await waitFor(() => {
      expect(setTransactionsCleared).toHaveBeenCalledWith(['txn-2'], false);
    });
  });

  it('does nothing with no row highlighted, and lets the page scroll', async () => {
    await openRegister();

    expect(fireEvent.keyDown(grid(), { key: ' ' })).toBe(true);
    expect(setTransactionsCleared).not.toHaveBeenCalled();
  });

  it('never reconciles a row half-way through typing a two-word payee', async () => {
    await openRegister();

    // "sandpiper " — the space arrives mid-search, and must go to the search,
    // not to the R column of whatever row the search had reached.
    'sandpiper '.split('').forEach(key => fireEvent.keyDown(grid(), { key }));

    expect(setTransactionsCleared).not.toHaveBeenCalled();
    expect(activeRowText()).toContain('Sandpiper Foods');

    // And once the search has been let go of, Space reconciles as it should.
    fireEvent.keyDown(grid(), { key: 'Escape' });
    highlight('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: ' ' });
    await waitFor(() => {
      expect(setTransactionsCleared).toHaveBeenCalledWith(['txn-1'], true);
    });
  });
});

describe('Account register — Shift stretches the highlight over a run of rows', () => {
  it('selects everything between the anchor and the highlight', async () => {
    await openRegister();
    highlight('Sandpiper Foods');

    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });

    expect(selectedDescriptions()).toEqual([
      'Sandpiper Foods', 'Cobblestone Cafe', 'Sandpiper Fuel',
    ]);
    // The arrows are still on the far end of the run, not on the anchor.
    expect(activeRowText()).toContain('Sandpiper Fuel');
    // And a screen reader is told the list can hold more than one.
    expect(grid()).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('shrinks again on the way back, and collapses on a plain arrow', async () => {
    await openRegister();
    highlight('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });
    expect(selectedDescriptions()).toHaveLength(3);

    fireEvent.keyDown(grid(), { key: 'ArrowUp', shiftKey: true });
    expect(selectedDescriptions()).toEqual(['Sandpiper Foods', 'Cobblestone Cafe']);

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    expect(selectedDescriptions()).toEqual(['Sandpiper Fuel']);
  });

  it('offers what can be done with the run, and what each button would change', async () => {
    await openRegister();
    highlight('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });

    expect(selectionBar()).toHaveTextContent('3 transactions selected');
    // Two of the three are unreconciled, one is reconciled already — the
    // buttons say so rather than claiming all three.
    expect(screen.getByRole('button', { name: /^Reconcile 2$/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Un-reconcile 1$/ })).toBeEnabled();
    // The single-row quick editor has stood down: it edits ONE transaction.
    expect(screen.queryByLabelText('Stop editing this row')).not.toBeInTheDocument();
  });

  it('says the count out loud, in a region that was already there to say it in', async () => {
    await openRegister();
    // The region exists before there is anything to announce — one that
    // appears already holding its message is announced unreliably or not at
    // all, which is the same as not having one.
    const live = document.querySelector('[aria-live="polite"].sr-only');
    expect(live).not.toBeNull();
    expect(live).toHaveTextContent('');

    highlight('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });

    expect(live).toHaveTextContent('2 transactions selected');
  });

  it('reconciles the whole run in one round trip', async () => {
    await openRegister();
    highlight('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });

    // Some are unreconciled, so Space reconciles the lot — one call, not three.
    fireEvent.keyDown(grid(), { key: ' ' });

    await waitFor(() => {
      expect(setTransactionsCleared).toHaveBeenCalledWith(['txn-1', 'txn-2', 'txn-3'], true);
    });
    expect(setTransactionsCleared).toHaveBeenCalledTimes(1);
  });

  it('archives the run row by row, and says what archiving did not do', async () => {
    await openRegister();
    highlight('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });

    fireEvent.click(screen.getByRole('button', { name: /^Archive 2$/ }));

    await waitFor(() => {
      expect(setTransactionArchived).toHaveBeenCalledTimes(2);
    });
    expect(setTransactionArchived).toHaveBeenNthCalledWith(1, 'txn-1', true);
    expect(setTransactionArchived).toHaveBeenNthCalledWith(2, 'txn-2', true);
    expect(await screen.findByText(/hidden from this list, not deleted/)).toBeInTheDocument();
  });

  it('lets go of the run first, and the highlight only on the second Escape', async () => {
    await openRegister();
    highlight('Sandpiper Foods');
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });
    expect(selectedDescriptions()).toHaveLength(2);

    fireEvent.keyDown(grid(), { key: 'Escape' });
    expect(selectedDescriptions()).toEqual(['Cobblestone Cafe']);

    fireEvent.keyDown(grid(), { key: 'Escape' });
    expect(selectedDescriptions()).toHaveLength(0);
    expect(grid().getAttribute('aria-activedescendant')).toBeNull();
  });
});

describe('Account register — deleting a run of rows', () => {
  const bulkDialog = (): HTMLElement => screen.getByRole('alertdialog');

  /** Select the four rows from the transfer down to the last one. */
  const selectAcrossTheAwkwardRows = (): void => {
    highlight('Marigold Insurance');
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true }); // the transfer
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true }); // the split
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true }); // Thistledown
  };

  it('names the row that would leave half a transfer behind, and where', async () => {
    await openRegister();
    selectAcrossTheAwkwardRows();

    fireEvent.keyDown(grid(), { key: 'Delete' });

    const dialog = bulkDialog();
    expect(within(dialog).getByText('Delete 3 transactions?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('One of these leaves something behind in another account:')
    ).toBeInTheDocument();

    // Scoped to the one PARAGRAPH, not to the dialog: the point of this
    // warning is that a named row is tied to a named account, and asserting
    // the two strings merely exist somewhere on screen would pass just as
    // happily if the dialog blamed the wrong row.
    const strandingNote = within(dialog).getByText(
      (_text, element) =>
        element?.tagName === 'P' && /This is one half of a transfer/.test(element.textContent ?? '')
    );
    expect(strandingNote).toHaveTextContent('Moved to savings');
    expect(strandingNote).toHaveTextContent('Synthetic Savings');
    expect(strandingNote).toHaveTextContent(/still counted in that account's balance/i);
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('refuses the split row BY NAME rather than quietly taking its lines with it', async () => {
    await openRegister();
    selectAcrossTheAwkwardRows();

    fireEvent.keyDown(grid(), { key: 'Delete' });

    const dialog = bulkDialog();
    expect(within(dialog).getByText('One row is being left alone:')).toBeInTheDocument();
    expect(within(dialog).getByText(/split across several categories/)).toBeInTheDocument();
    expect(within(dialog).getByText(/“Weekly shop”/)).toBeInTheDocument();
  });

  it('puts the focus on Cancel — a bulk delete is not one reflex Enter away', async () => {
    await openRegister();
    selectAcrossTheAwkwardRows();
    fireEvent.keyDown(grid(), { key: 'Delete' });

    expect(document.activeElement).toBe(
      within(bulkDialog()).getByRole('button', { name: 'Cancel' })
    );
  });

  it('deletes exactly what it described, and nothing it refused', async () => {
    await openRegister();
    selectAcrossTheAwkwardRows();
    fireEvent.keyDown(grid(), { key: 'Delete' });

    fireEvent.click(within(bulkDialog()).getByRole('button', { name: /^Delete 3 transactions$/ }));

    await waitFor(() => {
      expect(deleteTransaction).toHaveBeenCalledTimes(3);
    });
    expect(deleteTransaction.mock.calls.map(call => call[0])).toEqual(['txn-4', 'txn-5', 'txn-7']);
    // The split row was never touched.
    expect(deleteTransaction).not.toHaveBeenCalledWith('txn-6');
  });

  it('leaves everything alone on Escape', async () => {
    await openRegister();
    selectAcrossTheAwkwardRows();
    fireEvent.keyDown(grid(), { key: 'Delete' });

    fireEvent.keyDown(within(bulkDialog()).getByRole('button', { name: 'Cancel' }), { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteTransaction).not.toHaveBeenCalled();
  });
});

describe('Account register — the other half of a transfer', () => {
  it('opens the account the far half lives in, on that very row', async () => {
    await openRegister();
    highlight('Moved to savings');

    expect(fireEvent.keyDown(grid(), { key: 'Enter', ctrlKey: true })).toBe(false);

    // The far account's register, on the far row — the same deep link the
    // editor's "see this transaction in…" builds.
    expect(visitedPaths).toContain(`/accounts/${SAVINGS.id}?txn=txn-far-side`);
  });

  it('says why nothing happened on a row that is not a transfer', async () => {
    await openRegister();
    highlight('Marigold Insurance');

    fireEvent.keyDown(grid(), { key: 'Enter', metaKey: true });

    expect(await screen.findByText(/no other side to jump to/i)).toBeInTheDocument();
    // Still exactly where it was: the key does nothing rather than erroring.
    expect(visitedPaths).toEqual([`/accounts/${ACCOUNT.id}`]);
  });
});

describe('Account register — copying a row into the add bar', () => {
  it('fills the draft without writing anything', async () => {
    await openRegister();
    highlight('Sandpiper Fuel');

    fireEvent.keyDown(grid(), { key: 'd', ctrlKey: true });

    // The add bar carries the row's description and the size of its amount…
    const description = within(addBar()).getByLabelText('Description');
    expect(description).toHaveValue('Sandpiper Fuel');
    expect(within(addBar()).getByLabelText('Amount')).toHaveValue('52.00');
    // …dated today, not the row's own date.
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    expect(within(addBar()).getByLabelText('Date')).toHaveValue(`${dd}/${mm}/${today.getFullYear()}`);
    // Nothing has been saved, and the cursor is where the edit will be made.
    expect(document.activeElement).toBe(description);
    // And the row was let go of: two half-finished edits on one screen — a
    // quick-edit box still open up in the register, a draft down here — is
    // exactly the confusion this avoids.
    expect(grid().getAttribute('aria-activedescendant')).toBeNull();
    expect(document.querySelector('[data-quick-edit="actions"]')).toBeNull();
  });
});

describe('Account register — starting a new transaction', () => {
  it('reveals the add bar with the cursor in the Date box', async () => {
    await openRegister();
    highlight('Sandpiper Fuel');

    expect(fireEvent.keyDown(grid(), { key: '+' })).toBe(false);

    const date = within(addBar()).getByLabelText('Date');
    await waitFor(() => {
      expect(document.activeElement).toBe(date);
    });
    // The highlight let go, and the quick-edit box with it.
    expect(grid().getAttribute('aria-activedescendant')).toBeNull();
    expect(document.querySelector('[data-quick-edit="actions"]')).toBeNull();
  });
});

describe('Account register — opening search from the keyboard', () => {
  it('opens the filter panel with the cursor already in the search box', async () => {
    await openRegister();

    expect(fireEvent.keyDown(grid(), { key: 'f', ctrlKey: true })).toBe(false);

    const search = await screen.findByPlaceholderText(/Search by description/);
    expect(document.activeElement).toBe(search);
  });
});

describe('Account register — the shortcut list', () => {
  it('opens on ? and hands the dialog the focus', async () => {
    await openRegister();

    expect(fireEvent.keyDown(grid(), { key: '?', shiftKey: true })).toBe(false);

    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('prints the bindings the register actually answers to', async () => {
    await openRegister();
    fireEvent.keyDown(grid(), { key: '?' });

    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(dialog).getByText(/Jump to the first or the last transaction/)).toBeInTheDocument();
    expect(within(dialog).getByText(/the same tick the R column shows/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Open the other half of a transfer/)).toBeInTheDocument();
    // The row editor's own keys, which is where most of the work in this
    // register actually happens. A printed list that stops at the row level
    // would be describing half the register — and one that still promised the
    // OLD rule ("Enter saves") would be describing a register that no longer
    // exists. The rhythm is two Enters now, and the list says so.
    //
    // It also has to say WHERE the editing happens, and that changed: there is
    // no box under the row any more, the row itself is the editor.
    expect(within(dialog).getByText(/Editing the highlighted row in place/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Accept what you have just typed or picked/)).toBeInTheDocument();
    expect(within(dialog).getByText(/type, Enter, Enter, type, Enter, Enter/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Stop editing this row and go back to the list/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Put the cursor in the Date box of the highlighted row/)
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/quick edit box under/)).not.toBeInTheDocument();
    // And says out loud which keys the browser would not let it have.
    expect(within(dialog).getByText(/keeps those for opening its own windows and tabs/)).toBeInTheDocument();
  });

  it('is reachable with a mouse too, from the View menu', async () => {
    await openRegister();

    fireEvent.click(screen.getByRole('button', { name: /^View/ }));
    fireEvent.click(screen.getByRole('button', { name: /Keyboard shortcuts/ }));

    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('closes without disturbing the highlighted row', async () => {
    await openRegister();
    highlight('Cobblestone Cafe');
    fireEvent.keyDown(grid(), { key: '?' });
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });

    fireEvent.click(within(dialog).getByLabelText('Close modal'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
    });
    expect(activeRowText()).toContain('Cobblestone Cafe');
  });
});

describe('Account register — F2 and the way back', () => {
  it('puts the cursor in the quick edit box, and Escape brings it back to the list', async () => {
    await openRegister();
    highlight('Marigold Insurance');

    expect(fireEvent.keyDown(grid(), { key: 'F2' })).toBe(false);

    const boxDate = screen.getByLabelText('Transaction date');
    await waitFor(() => {
      expect(document.activeElement).toBe(boxDate);
    });

    // The date field opens its calendar on focus and answers the first Escape
    // itself; the second reaches the box and hands the keyboard back.
    fireEvent.keyDown(boxDate, { key: 'Escape' });
    fireEvent.keyDown(boxDate, { key: 'Escape' });

    expect(document.activeElement).toBe(grid());
    // Still on the same row, so the next arrow key carries on where it was —
    // but the box itself has gone, which is the whole of what Escape promised.
    expect(activeRowText()).toContain('Marigold Insurance');
    expect(document.querySelector('[data-quick-edit="actions"]')).toBeNull();
  });

  it('opens the box again on a row whose box had been closed', async () => {
    await openRegister();
    highlight('Marigold Insurance');
    fireEvent.keyDown(grid(), { key: 'Escape' }); // let go of the row entirely
    highlight('Marigold Insurance');             // …and take it again

    screen.getByLabelText('Transaction date');

    // Esc closes the box, leaving the row where it was…
    fireEvent.keyDown(screen.getByLabelText('Transaction description'), { key: 'Escape' });
    expect(document.querySelector('[data-quick-edit="actions"]')).toBeNull();
    expect(activeRowText()).toContain('Marigold Insurance');

    // …and F2 brings it straight back, rather than being a dead key on a row
    // that is plainly still selected.
    expect(fireEvent.keyDown(grid(), { key: 'F2' })).toBe(false);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Transaction date'));
    });
  });

  it('does not fire again when the box comes back for another row', async () => {
    await openRegister();
    highlight('Marigold Insurance');
    fireEvent.keyDown(grid(), { key: 'F2' });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Transaction date'));
    });

    // Clear the highlight (the box unmounts) and pick a row again.
    fireEvent.keyDown(grid(), { key: 'Escape' });
    highlight('Thistledown Books');

    screen.getByLabelText('Transaction date');
    // The cursor stays with the register — a stale F2 must not steal it back.
    expect(document.activeElement).toBe(grid());
  });
});
