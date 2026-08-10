import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
 * Where the row you are WORKING ON sits on the screen.
 *
 * The owner, having used the inline editor: "Whenever you click on a
 * transaction, and we have the quick edit box now coming up below, can we make
 * it so that the 'selected transaction' is always in the middle of the viewable
 * transactions box? … It is nice to see the transactions above and below the
 * one you are working on."
 *
 * So the rule, which is written out in full at RowScrollRequest in the register
 * itself: opening or moving the EDITOR centres its row; moving only the
 * HIGHLIGHT does not. Four things are proved here, and each is measured rather
 * than assumed — every assertion below reads the position the register's own
 * arithmetic actually put the list in:
 *
 *   1. a click centres the row it opened the editor on, even when that row was
 *      perfectly visible already (which is exactly where the old behaviour did
 *      nothing at all);
 *   2. F2 re-centres — including on the row that was already the target, which
 *      is only possible because a scroll request is counted (RowScrollRequest
 *      .token) rather than compared;
 *   3. Save & Next centres the row it moves ON to, so a run down a statement
 *      keeps the work in the middle of the screen instead of walking it to the
 *      foot;
 *   4. the arrow keys do NOT centre: they scroll the least amount that shows
 *      the row, and nothing at all when it is already on screen.
 *
 * WHAT IS STOOD IN FOR, AND WHY IT IS HONEST: jsdom performs no layout — every
 * element is 0×0 and every rect is at the origin — so the register's scroll
 * arithmetic would be run against zeroes and prove nothing. The three figures
 * it reads (the viewport's height, each row's height, and where each row
 * starts) are stood in for here at their real sizes: a 400px viewport, 44px
 * rows, and — for the row being edited — the two heights the editor itself
 * declares, its taller line and its strip. Everything else is left at jsdom's
 * defaults. What this canNOT show is what the result looks like — that the
 * movement is not distracting, that a click near the foot feels right rather
 * than lurching — and that is named in the handover as a browser check.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

/** The register's own uncompacted row height (AccountTransactions: rowHeight). */
const ROW_H = 44;
/** A viewport that shows about nine rows — a small laptop window. */
const VIEWPORT = 400;

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
 * Forty rows, oldest first — far more than a 400px viewport can show, and
 * still under the register's fifty-row virtualisation threshold, which is the
 * only path jsdom can lay out at all. The virtualised path's own centring is
 * held to account next door, in VirtualizedTable.scrollAlign.test.tsx.
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

const updateTransaction = vi.fn(async () => {});

// ── The stood-in geometry ───────────────────────────────────────────────────

const isListContainer = (el: HTMLElement): boolean => el.hasAttribute('data-virtualized-list');

/** A row's outermost element — the list's own direct child. */
const isRowWrapper = (el: HTMLElement): boolean =>
  el.parentElement !== null && isListContainer(el.parentElement);

/**
 * How tall a row is: its own line, or — while it is the editor — the taller
 * line its fields need PLUS the strip beneath it.
 */
const heightOfWrapper = (el: HTMLElement): number =>
  el.querySelector('[data-quick-edit="actions"]')
    ? QUICK_EDIT_ROW_HEIGHT + QUICK_EDIT_STRIP_HEIGHT
    : ROW_H;

/** Where a row starts in the list's content: the sum of everything above it. */
const topOfWrapper = (el: HTMLElement): number => {
  let top = 0;
  for (let sibling = el.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (sibling instanceof HTMLElement) top += heightOfWrapper(sibling);
  }
  return top;
};

const rectAt = (top: number, height: number): DOMRect => ({
  x: 0, y: top, top, bottom: top + height, left: 0, right: 0, width: 0, height,
  toJSON: () => ({}),
});

const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

const stubLayout = (): void => {
  const heightOf = function (this: HTMLElement): number {
    if (isListContainer(this)) return VIEWPORT;
    return isRowWrapper(this) ? heightOfWrapper(this) : 0;
  };
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: heightOf });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: heightOf });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement): number {
      if (!isListContainer(this)) return 0;
      return Array.from(this.children).reduce(
        (total, child) => total + (child instanceof HTMLElement ? heightOfWrapper(child) : 0),
        0
      );
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    if (isListContainer(this)) return rectAt(0, VIEWPORT);
    if (isRowWrapper(this)) {
      const scrolled = this.parentElement?.scrollTop ?? 0;
      return rectAt(topOfWrapper(this) - scrolled, heightOfWrapper(this));
    }
    // Everything else keeps jsdom's own answer: an empty rect at the origin.
    return rectAt(0, 0);
  };
};

const restoreLayout = (): void => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).clientHeight;
  delete (HTMLElement.prototype as Partial<HTMLElement>).offsetHeight;
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollHeight;
  HTMLElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
};

// ── Reading the register ────────────────────────────────────────────────────

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

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

const listViewport = (): HTMLElement => {
  const el = grid().querySelector('[data-virtualized-list]');
  if (!(el instanceof HTMLElement)) throw new Error('the register rendered no scroll container');
  return el;
};

/** The strip under the row being edited — the buttons and the hint. */
const strip = (): HTMLElement => {
  const el = document.querySelector('[data-quick-edit="actions"]');
  if (!(el instanceof HTMLElement)) throw new Error('no row is being edited');
  return el;
};

const isEditing = (): boolean => document.querySelector('[data-quick-edit="actions"]') !== null;

const descriptionField = (): HTMLInputElement => {
  const el = screen.getByLabelText('Transaction description');
  if (!(el instanceof HTMLInputElement)) throw new Error('the description is not an input');
  return el;
};

/** The row the register says is active, as the list's own direct child. */
const activeRowWrapper = (): HTMLElement => {
  const id = grid().getAttribute('aria-activedescendant');
  const row = id ? document.getElementById(id) : null;
  if (!row) throw new Error('no row is highlighted');
  let el: HTMLElement | null = row;
  while (el && !isRowWrapper(el)) el = el.parentElement;
  if (!el) throw new Error('the highlighted row is not in the list');
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

/** How far down the visible viewport the highlighted row's middle sits, in px. */
const middleOfActiveRow = (): number => {
  const wrapper = activeRowWrapper();
  return topOfWrapper(wrapper) - listViewport().scrollTop + heightOfWrapper(wrapper) / 2;
};

/** …and its bottom edge, for the "scrolled the least amount" case. */
const bottomOfActiveRow = (): number => {
  const wrapper = activeRowWrapper();
  return topOfWrapper(wrapper) - listViewport().scrollTop + heightOfWrapper(wrapper);
};

const clickRow = (description: string): void => {
  fireEvent.click(within(grid()).getByText(description));
};

/**
 * Open the register and let it settle where it opens (the foot), past the
 * retries that cover AutoSizer's zero-height first pass. Every test then puts
 * the list somewhere deliberate of its own.
 */
const openRegister = async (path = `/accounts/${ACCOUNT.id}`): Promise<void> => {
  renderRegister(path);
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
  await new Promise(resolve => setTimeout(resolve, 350));
};

beforeEach(() => {
  localStorage.clear();
  updateTransaction.mockClear();
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    updateTransaction,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
  stubLayout();
});

afterEach(() => {
  restoreLayout();
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — the row being worked on sits in the middle', () => {
  it('centres the row a click opens the box on, even when it was already visible', async () => {
    await openRegister();

    // Row 20 is on screen and fully visible, box and all — so "scroll the least
    // amount that shows it" would do nothing whatsoever, and did. The list is
    // put here deliberately: this is the case the owner was looking at.
    listViewport().scrollTop = 700;
    clickRow(ROWS[20].description);

    expect(isEditing()).toBe(true);
    expect(activeRowText()).toContain(ROWS[20].description);
    // The whole point, in one number: the row and its box are centred on the
    // viewport, so there are transactions above it and transactions below it.
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
  });

  it('centres a row clicked from the other end of the register', async () => {
    await openRegister();

    // Nowhere near the viewport this time: the row has to be brought in, and
    // it is brought into the middle rather than merely onto the screen.
    listViewport().scrollTop = 0;
    clickRow(ROWS[6].description);

    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
  });

  it('leaves the first rows where they are rather than scrolling above them', async () => {
    await openRegister();

    listViewport().scrollTop = 600;
    clickRow(ROWS[0].description);

    // The owner's own exception: near the top there is nothing above to show,
    // so the list pins at the top and the row sits above the middle. Anything
    // else would mean scrolling past the start of the register.
    expect(listViewport().scrollTop).toBe(0);
    expect(middleOfActiveRow()).toBeLessThan(VIEWPORT / 2);
  });

  it('centres the row a deep link arrives on, and stays there', async () => {
    await openRegister(`/accounts/${ACCOUNT.id}?txn=${ROWS[20].id}`);

    await waitFor(() => {
      expect(descriptionField()).toHaveValue(ROWS[20].description);
    });
    // Already true before this change; asserted so that counting the requests
    // cannot start a fight between the deep link and the foot-of-list opening,
    // which are the two things that scroll on arrival.
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
  });
});

describe('Account register — F2 re-centres the row it re-opens the box on', () => {
  it('brings the row back to the middle after the user has scrolled away', async () => {
    await openRegister();

    listViewport().scrollTop = 700;
    clickRow(ROWS[20].description);
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);

    // Escape puts the box away but keeps the row highlighted…
    fireEvent.keyDown(descriptionField(), { key: 'Escape' });
    expect(isEditing()).toBe(false);
    // …and the user goes off to look at the start of the year.
    listViewport().scrollTop = 0;

    fireEvent.keyDown(grid(), { key: 'F2' });

    // F2 is "edit this row": the box comes back, and it comes back where it
    // can be worked — in the middle, not wherever the list happens to be.
    //
    // This is the assertion that fails without RowScrollRequest.token. The row
    // and the alignment are both exactly what they were when the click asked,
    // so nothing about the request has changed for React to notice, and the
    // register would sit at the top of the year with the box off screen.
    expect(isEditing()).toBe(true);
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
  });
});

describe('Account register — Save & Next keeps the work in the middle', () => {
  it('centres the row it moves on to, not merely the row it started on', async () => {
    await openRegister();

    listViewport().scrollTop = 700;
    clickRow(ROWS[20].description);
    const startedAt = listViewport().scrollTop;

    fireEvent.click(within(strip()).getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => {
      expect(descriptionField()).toHaveValue(ROWS[21].description);
    });
    // The next row is comfortably on screen already — so "the least scroll that
    // shows it" would leave the list exactly where it was, and the work would
    // creep towards the foot a row at a time down a long statement.
    expect(listViewport().scrollTop).not.toBe(startedAt);
    expect(activeRowText()).toContain(ROWS[21].description);
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
  });
});

describe('Account register — the arrows move the LIST while the box is open', () => {
  it('keeps the box in the middle as it walks down the register, and back up', async () => {
    await openRegister();

    listViewport().scrollTop = 700;
    clickRow(ROWS[20].description);
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
    const centredOn20 = listViewport().scrollTop;

    fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    // The owner, on the register that did NOT do this: "it is not the list
    // moving up and down and the highlighted box staying in the middle, it is
    // the highlighted box that moves down or up the list." Row 21 was already
    // fully visible, so "the least scroll that shows it" is no scroll at all —
    // which is exactly what he was looking at, and why the list moving here is
    // the whole assertion.
    expect(activeRowText()).toContain(ROWS[21].description);
    expect(isEditing()).toBe(true);
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
    expect(listViewport().scrollTop).not.toBe(centredOn20);

    fireEvent.keyDown(grid(), { key: 'ArrowUp' });

    // Both directions, and the list comes back to where it was: the box holds
    // the middle whichever way the work goes.
    expect(activeRowText()).toContain(ROWS[20].description);
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);
    expect(listViewport().scrollTop).toBe(centredOn20);
  });

  it('centres a Page and an End the same way, box and all', async () => {
    await openRegister();

    listViewport().scrollTop = 700;
    clickRow(ROWS[20].description);

    fireEvent.keyDown(grid(), { key: 'PageDown' });
    expect(isEditing()).toBe(true);
    expect(middleOfActiveRow()).toBe(VIEWPORT / 2);

    fireEvent.keyDown(grid(), { key: 'Home' });
    // The register's own exception at the ends: there is nothing above the
    // first row to show, so the list pins at the top and the row sits above the
    // middle rather than scrolling off the start of the account.
    expect(activeRowText()).toContain(ROWS[0].description);
    expect(listViewport().scrollTop).toBe(0);
    expect(middleOfActiveRow()).toBeLessThan(VIEWPORT / 2);
  });

  it('leaves the list alone while Shift is stretching a selection', async () => {
    await openRegister();

    listViewport().scrollTop = 700;
    clickRow(ROWS[20].description);
    const centred = listViewport().scrollTop;

    // TWO of them, deliberately. When the editor was a box below the row it was
    // exactly two rows tall, so centring row 21 without it landed on the very
    // same offset as centring row 20 with it and a single Shift+arrow would
    // have passed whatever this did. The editor's new geometry breaks that
    // coincidence (790 against 768 after one), but two rows in the gap is 66px
    // and no arithmetic can close it by accident.
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(grid(), { key: 'ArrowDown', shiftKey: true });

    // Shift+arrow is not moving a box, it is stretching a run — and the box is
    // not on screen at all once more than one row is selected, so there would
    // be nothing in the middle to keep there. The rows either side of the run
    // are what the user is reading; dragging the register under them would make
    // the reach of the selection harder to see, not easier.
    expect(isEditing()).toBe(false);
    expect(activeRowText()).toContain(ROWS[22].description);
    expect(listViewport().scrollTop).toBe(centred);
  });
});

describe('Account register — the arrow keys do not move the page while browsing', () => {
  it('scrolls the least amount that shows the row, and centres nothing', async () => {
    await openRegister();

    listViewport().scrollTop = 700;
    clickRow(ROWS[20].description);
    // Box away: from here on this is the highlight walking the list, which is
    // browsing rather than working, and browsing must not heave the page about.
    fireEvent.keyDown(descriptionField(), { key: 'Escape' });
    const beforeTheKeys = listViewport().scrollTop;

    fireEvent.keyDown(grid(), { key: 'End' });

    // The last row is far below the fold, so the list must move — but only far
    // enough to show it. Its bottom edge is the viewport's bottom edge; centred
    // it would sit half a screen higher up.
    expect(activeRowText()).toContain(ROWS[ROWS.length - 1].description);
    expect(bottomOfActiveRow()).toBe(VIEWPORT);
    expect(middleOfActiveRow()).not.toBe(VIEWPORT / 2);

    // And a step to a row that is already on screen moves the list not at all.
    const afterEnd = listViewport().scrollTop;
    fireEvent.keyDown(grid(), { key: 'ArrowUp' });
    fireEvent.keyDown(grid(), { key: 'ArrowUp' });

    expect(activeRowText()).toContain(ROWS[ROWS.length - 3].description);
    expect(listViewport().scrollTop).toBe(afterEnd);
    // …which is only meaningful because centring WOULD have moved it.
    expect(middleOfActiveRow()).not.toBe(VIEWPORT / 2);
    expect(beforeTheKeys).not.toBe(afterEnd);
  });
});
