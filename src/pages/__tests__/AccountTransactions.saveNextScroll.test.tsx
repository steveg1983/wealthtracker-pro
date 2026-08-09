import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * "Sometimes when I update the category and then press 'save & next', I get
 * kicked back to the start of the transaction list, which for my HSBC Premier
 * Current Account is 2008. I then need to scroll all the way back to the
 * current date." — the owner.
 *
 * His register is sorted oldest-first, so "2008" is scroll position zero.
 *
 * ─ WHAT IT TURNED OUT TO BE ────────────────────────────────────────────────
 * Not a race, and nothing to do with saving. VirtualizedList chooses between
 * react-window's two list components by asking whether the row height it was
 * given is a number or a function, and the register's height became a function
 * only while the quick-edit box was open (the box is part of its row's height).
 * So every time the box went away the list became a DIFFERENT COMPONENT: React
 * unmounted the scroll container and mounted a fresh one, and a fresh list is
 * at offset zero.
 *
 * It looked intermittent because the actions that OPEN the box also ask for a
 * row to be scrolled to, which corrected the jump before anyone could see it.
 * The actions that CLOSE it — Escape, the ×, the Save that ends a run, opening
 * the full editor over it — ask for nothing, so the top is where you stayed.
 *
 * Every test below therefore watches the scroll container itself: its identity
 * (a new node means a remount) and every position it is ever put in.
 *
 * This file is the VIRTUALISED register — over fifty rows, which is every real
 * account, and the only path where react-window is doing the scrolling. The
 * AutoSizer that measures the viewport is stood in for at a fixed 800×400
 * (jsdom performs no layout, so it would report 0×0 and react-window would
 * render nothing); everything else is the register's own code. What jsdom
 * cannot show is what any of this LOOKS like, which is named in the handover
 * as a browser check.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

const VIEWPORT_HEIGHT = 400;

vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }: { children: (size: { height: number; width: number }) => React.ReactNode }) =>
    children({ height: VIEWPORT_HEIGHT, width: 800 }),
}));

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

/** Sixty rows — comfortably over the register's fifty-row virtualisation threshold. */
const makeRows = (): Transaction[] => Array.from({ length: 60 }, (_, i) => ({
  id: `txn-${String(i).padStart(2, '0')}`,
  date: new Date(Date.UTC(2024, 0, 1 + i)),
  description: `Synthetic row ${String(i).padStart(2, '0')}`,
  amount: -(i + 1),
  type: 'expense' as const,
  category: 'det-groceries',
  accountId: ACCOUNT.id,
  cleared: false,
}));

let rows: Transaction[] = makeRows();
/** Whether the next save rebuilds every row rather than just the one saved. */
let rebuildAll = false;

/**
 * The save as the real context performs it: a NEW array with the saved row
 * replaced. `rebuildEverythingOnSave` makes it adversarial — every row a fresh
 * object, which is what a background refresh does, and what re-runs every memo,
 * re-renders every row and makes react-window forget every offset it measured.
 */
const updateTransaction = vi.fn(async (id: string, updates: Partial<Transaction>) => {
  rows = rows.map(t => {
    if (t.id === id) return { ...t, ...updates };
    return rebuildAll ? { ...t } : t;
  });
  __setAppContextValue({ transactions: rows });
});

const rebuildEverythingOnSave = (): void => { rebuildAll = true; };

const registerTree = (): React.ReactElement => (
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

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

/** react-window's own scroll container: the one element that overflows. */
const isListViewport = (el: HTMLElement): boolean => el.style.overflow === 'auto';

const listViewport = (): HTMLElement => {
  const el = grid().querySelector('div[style*="overflow: auto"]');
  if (!(el instanceof HTMLElement)) throw new Error('react-window rendered no scroll container');
  return el;
};

/**
 * The two figures react-window reads back off the DOM when the user scrolls.
 *
 * jsdom performs no layout, so both are 0 — and react-window clamps every
 * scroll event to `scrollHeight - clientHeight`, which would make a user's
 * scroll land at zero every time and prove nothing. The viewport is the height
 * the stood-in AutoSizer reports; the content is the height react-window has
 * itself written on its inner sizing element. Everything else keeps jsdom's
 * own answer.
 */
const stubLayout = (): void => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement): number {
      return isListViewport(this) ? VIEWPORT_HEIGHT : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement): number {
      if (!isListViewport(this)) return 0;
      const inner = this.firstElementChild;
      if (!(inner instanceof HTMLElement)) return 0;
      return Number.parseFloat(inner.style.height) || 0;
    },
  });
};

const restoreLayout = (): void => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).clientHeight;
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollHeight;
};

/**
 * Every position this container is put in from now on.
 *
 * The teleport this file is about is permanent, so sampling would catch it —
 * but a jump that something else immediately corrects is still a jump, and on a
 * real screen it is a flash of 2008. This records the lot.
 */
const watchScrollTop = (el: HTMLElement): number[] => {
  const seen: number[] = [];
  let value = el.scrollTop;
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (next: number) => { value = next; seen.push(next); },
  });
  return seen;
};

/** Put the list somewhere, the way a user's own scrolling does. */
const scrollListTo = (offset: number): void => {
  const el = listViewport();
  el.scrollTop = offset;
  fireEvent.scroll(el);
};

/** The strip under the row being edited — the buttons and the hint. */
const strip = (): HTMLElement => {
  const el = document.querySelector('[data-quick-edit="actions"]');
  if (!(el instanceof HTMLElement)) throw new Error('no row is being edited');
  return el;
};

const descriptionField = (): HTMLInputElement => {
  const el = screen.getByLabelText('Transaction description');
  if (!(el instanceof HTMLInputElement)) throw new Error('the description is not an input');
  return el;
};

/**
 * What the active row holds: its text, AND what has been typed into the boxes
 * it has become — the row being edited has no description TEXT, because that
 * cell is an input now.
 */
const activeRowText = (): string => {
  const id = grid().getAttribute('aria-activedescendant');
  const row = id ? document.getElementById(id) : null;
  if (!row) return '';
  const typed = Array.from(row.querySelectorAll('input')).map(input => input.value).join(' ');
  return `${row.textContent ?? ''} ${typed}`;
};

/**
 * How far down the viewport the highlighted row's middle sits, in px, read off
 * the position react-window actually gave it. A row carrying the box is wrapped
 * (the wrapper owns react-window's slot), so the positioned element is the
 * row's parent in that one case — and its height includes the box.
 */
const centreOfActiveRow = (): number => {
  const id = grid().getAttribute('aria-activedescendant');
  const row = id ? document.getElementById(id) : null;
  if (!row) throw new Error('no row is highlighted');
  const positioned = row.style.top === '' ? row.parentElement : row;
  if (!positioned) throw new Error('the highlighted row has no position');
  const top = Number.parseFloat(positioned.style.top);
  const height = Number.parseFloat(positioned.style.height);
  if (Number.isNaN(top) || Number.isNaN(height)) {
    throw new Error(`the highlighted row is unpositioned: top "${positioned.style.top}"`);
  }
  return top + height / 2 - listViewport().scrollTop;
};

const openRegister = async (): Promise<RenderResult> => {
  const result = render(registerTree());
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
  // Past the retries that cover AutoSizer's zero-height first pass, so the
  // register has settled where it opens: the foot of the list.
  await new Promise(resolve => setTimeout(resolve, 350));
  return result;
};

/**
 * Work in the middle of the register, where "centred" is unambiguous.
 *
 * react-window centres by splitting the range between "this row's top at the
 * top of the viewport" and "its bottom at the bottom" — which is the true
 * centre until one of those ends is clamped by the ends of the list itself.
 * The clamped case is the owner's own exception and has a test of its own.
 */
const clickRowInTheMiddle = (): void => {
  scrollListTo(700);
  fireEvent.click(within(grid()).getByText('Synthetic row 25'));
};

beforeEach(() => {
  localStorage.clear();
  rows = makeRows();
  rebuildAll = false;
  updateTransaction.mockClear();
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: rows,
    categories: CATEGORIES,
    isLoading: false,
    updateTransaction,
    applyCategoryToUncategorized: async () => 0,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
  vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([]);
  stubLayout();
});

afterEach(() => {
  restoreLayout();
  vi.mocked(DataService.getClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — putting the quick-edit box away keeps your place', () => {
  it('does not teleport to 2008 when a click outside the register deselects the row', async () => {
    await openRegister();
    clickRowInTheMiddle();
    const container = listViewport();
    const centred = container.scrollTop;
    const everyPositionFromHere = watchScrollTop(container);

    // The owner's own reproduction, and the reason this stopped looking
    // intermittent: "Once I click outside the transaction list box for whatever
    // reason, the transaction list jumps back to the first transaction showing
    // for that account." A mousedown anywhere else lets go of the row, the box
    // goes with it, and the row's extra height goes with the box.
    fireEvent.mouseDown(document.body);

    expect(document.querySelector('[data-quick-edit="actions"]')).toBeNull();
    expect(grid().getAttribute('aria-activedescendant')).toBeNull();
    // Same container (it was being unmounted and replaced), same position (the
    // replacement started at the top), and no flash of the top on the way.
    expect(listViewport()).toBe(container);
    expect(listViewport().scrollTop).toBe(centred);
    expect(everyPositionFromHere).not.toContain(0);
  });

  it('does not rebuild the list when the box OPENS either', async () => {
    await openRegister();
    scrollListTo(700);
    const container = listViewport();

    fireEvent.click(within(grid()).getByText('Synthetic row 25'));

    // The same remount fired in this direction too, and nobody ever saw it: the
    // click that opens the box also asks for its row to be scrolled to, so the
    // fresh list at the top was corrected in the same breath. Asserted on the
    // container's identity rather than on where it ended up, because where it
    // ended up is exactly what used to hide this.
    expect(listViewport()).toBe(container);
  });

  it('does not teleport to 2008 when Escape closes the box', async () => {
    await openRegister();
    clickRowInTheMiddle();
    const container = listViewport();
    const centred = container.scrollTop;
    const everyPositionFromHere = watchScrollTop(container);

    fireEvent.keyDown(descriptionField(), { key: 'Escape' });

    // THE BUG, in three assertions. Same container (it was being unmounted and
    // replaced), same position (the replacement started at the top), and no
    // flash of the top on the way (a jump something corrects is still a jump).
    expect(listViewport()).toBe(container);
    expect(listViewport().scrollTop).toBe(centred);
    expect(everyPositionFromHere).not.toContain(0);
  });

  it('does not teleport when the Save that ends a run closes the box', async () => {
    await openRegister();

    // The last row: its Save has nowhere to go next, so it closes the box —
    // the keystroke a run of categories ends on.
    fireEvent.click(within(grid()).getByText('Synthetic row 59'));
    const container = listViewport();
    const restingAt = container.scrollTop;
    const everyPositionFromHere = watchScrollTop(container);

    fireEvent.click(within(strip()).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(document.querySelector('[data-quick-edit="actions"]')).toBeNull();
    });

    expect(listViewport()).toBe(container);
    expect(listViewport().scrollTop).toBe(restingAt);
    expect(everyPositionFromHere).not.toContain(0);
    // …and the row that was saved is still the one highlighted, where it was.
    expect(activeRowText()).toContain('Synthetic row 59');
  });

  it('does not teleport when the full editor opens over the box', async () => {
    await openRegister();
    clickRowInTheMiddle();
    const container = listViewport();
    const centred = container.scrollTop;
    const everyPositionFromHere = watchScrollTop(container);

    // The modal takes the editor off the row for as long as it is open — the
    // same vanishing row height, and so the same teleport underneath it, which
    // the user met the moment they dismissed the modal.
    //
    // Clicked on the Balance cell rather than on the payee: the row IS the
    // editor now, so its description is an input with no text to find — and a
    // click inside a field means typing, not "give me the full editor".
    const editing = document.getElementById(grid().getAttribute('aria-activedescendant') ?? '');
    if (!editing) throw new Error('no row is being edited');
    fireEvent.click(within(editing).getByTestId('register-balance'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit Transaction')).toBeInTheDocument();

    expect(listViewport()).toBe(container);
    expect(listViewport().scrollTop).toBe(centred);
    expect(everyPositionFromHere).not.toContain(0);
  });
});

describe('Account register — the row being worked on, virtualised', () => {
  it('centres the row a click opens the box on', async () => {
    await openRegister();

    clickRowInTheMiddle();

    expect(activeRowText()).toContain('Synthetic row 25');
    // Centring is delivered by deliverScroll's measured retry, which has a
    // 1500ms budget — longer than waitFor's 1000ms default, so the assertion
    // must wait past it or a slow runner reads the pre-delivery position.
    await waitFor(() => {
      expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
    }, { timeout: 5000 });
  });

  it('centres the row Save & Next moves on to, with the list rebuilt under it', async () => {
    await openRegister();
    clickRowInTheMiddle();
    const everyPositionFromHere = watchScrollTop(listViewport());

    // The adversarial save: every row a fresh object, landing between the write
    // and the advance.
    rebuildEverythingOnSave();
    fireEvent.click(within(strip()).getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Synthetic row 26');
    });
    expect(activeRowText()).toContain('Synthetic row 26');
    // Same 1500ms delivery budget as above: the editor shows row 26 before the
    // scroll lands, and CI lost exactly this race (position 262, 2026-08-09).
    await waitFor(() => {
      expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
    }, { timeout: 5000 });
    expect(everyPositionFromHere).not.toContain(0);
  });

  it('stays put when the list is rebuilt AFTER the advance has landed', async () => {
    const { rerender } = await openRegister();
    clickRowInTheMiddle();
    fireEvent.click(within(strip()).getByRole('button', { name: 'Save & Next' }));
    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Synthetic row 26');
    });
    // The ADVANCE's own scroll, waited for before its resting place is
    // recorded. A Save & Next crosses an await and the scroll that follows runs
    // in a passive effect, which React flushes on its own schedule — so the
    // editor can be showing row 26 a moment before the register has been
    // scrolled to it. Reading the position in that gap records the row BEFORE's
    // resting place, and this test then reports the advance landing as if the
    // rebuild below had caused it. (The two differ by a row here — 988 is row
    // 25 centred with its editor, 1032 is row 26 centred with it.)
    await waitFor(() => {
      expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
    }, { timeout: 5000 });
    const settledAt = listViewport().scrollTop;
    const everyPositionFromHere = watchScrollTop(listViewport());

    // The other half of the race: a refresh landing a beat later, every row a
    // new object. Nothing has asked for a scroll, so nothing should scroll.
    rows = rows.map(row => ({ ...row }));
    __setAppContextValue({ transactions: rows });
    rerender(registerTree());

    expect(listViewport().scrollTop).toBe(settledAt);
    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
    expect(everyPositionFromHere).not.toContain(0);
  });

  it('does nothing at all when the row asked for is no longer in the list', async () => {
    const { rerender } = await openRegister();
    clickRowInTheMiddle();
    const centred = listViewport().scrollTop;
    const everyPositionFromHere = watchScrollTop(listViewport());

    // A row that has gone: deleted elsewhere, filtered away, not yet arrived.
    // "I cannot find it" has to mean "do not scroll" — never "scroll to row
    // zero", which is the other way a register ends up showing 2008.
    rows = rows.filter(row => row.id !== 'txn-25');
    __setAppContextValue({ transactions: rows });
    rerender(registerTree());

    expect(listViewport().scrollTop).toBe(centred);
    expect(everyPositionFromHere).not.toContain(0);
  });

  it('pins the last row at the foot rather than scrolling past the end', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText('Synthetic row 59'));

    // The owner's own exception to "always in the middle": at the end there is
    // nothing below to show, so the list stops at the foot. react-window does
    // the clamping — this is the proof that centring inherits it.
    const list = listViewport();
    expect(list.scrollTop).toBe(list.scrollHeight - VIEWPORT_HEIGHT);
  });
});
