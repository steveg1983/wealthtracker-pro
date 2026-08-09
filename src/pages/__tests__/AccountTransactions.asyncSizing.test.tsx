import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
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
 * The register while the browser is still working out how big it is.
 *
 * ─ THE GAP THIS FILE CLOSES ────────────────────────────────────────────────
 * Every other test of the virtualised register stands AutoSizer in for at a
 * fixed 800×400, delivered on the first render. The real one does neither of
 * those things:
 *
 *   1. it starts at 0×0 and renders NO CHILDREN AT ALL while it does
 *      (`bailoutOnChildren` — read it in the installed package). react-window
 *      is not merely zero-height on the first pass, it does not exist, and
 *      neither does the ref every scroll in this app is issued through;
 *   2. its measurement arrives from a ResizeObserver, i.e. a frame or two after
 *      mount, and again after any relayout — a sort adding a line above the
 *      table, the window resizing, the dock appearing.
 *
 * So a mocked-synchronous AutoSizer proves "the register asked for a centre and
 * react-window obeyed" while saying nothing about whether a list
 * even existed at the moment it asked. That is precisely the difference
 * between the jsdom result and the owner's, on a register of eleven thousand
 * rows: "it does not hold the centre, it scrolls up and down like it did
 * before."
 *
 * The fake below is faithful on both counts, and the measurement is delivered
 * by the TEST rather than by a timer, so each case can put it exactly where it
 * wants it: before the request, after the request, after the retries.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

const VIEWPORT_HEIGHT = 400;
const ROW_HEIGHT = 44;

/**
 * The measurement, held until a test delivers it — the ResizeObserver's
 * callback, under the test's own hand.
 */
const sizing = vi.hoisted(() => {
  const subscribers = new Set<(size: { height: number; width: number }) => void>();
  return {
    subscribers,
    /** Every AutoSizer on screen learns how big it is. */
    deliver(size: { height: number; width: number }): void {
      subscribers.forEach(notify => notify(size));
    },
  };
});

vi.mock('react-virtualized-auto-sizer', async () => {
  const react = await vi.importActual<typeof import('react')>('react');
  const FakeAutoSizer = ({
    children,
  }: {
    children: (size: { height: number; width: number }) => React.ReactNode;
  }): React.ReactElement => {
    const [size, setSize] = react.useState({ height: 0, width: 0 });
    react.useEffect(() => {
      sizing.subscribers.add(setSize);
      return () => { sizing.subscribers.delete(setSize); };
    }, []);
    // The real component's own rule: nothing is rendered until there is a
    // measurement. This one line is the whole difference from the other fakes.
    return react.createElement('div', null, size.height === 0 ? null : children(size));
  };
  return { default: FakeAutoSizer };
});

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

/** Sixty rows — over the register's fifty-row virtualisation threshold. */
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

const updateTransaction = vi.fn(async (id: string, updates: Partial<Transaction>) => {
  rows = rows.map(t => (t.id === id ? { ...t, ...updates } : t));
  __setAppContextValue({ transactions: rows });
});

const registerTree = (path: string): React.ReactElement => (
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

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

const isListViewport = (el: HTMLElement): boolean => el.style.overflow === 'auto';

const listViewport = (): HTMLElement => {
  const el = grid().querySelector('div[style*="overflow: auto"]');
  if (!(el instanceof HTMLElement)) throw new Error('react-window rendered no scroll container');
  return el;
};

const listHasMounted = (): boolean =>
  grid().querySelector('div[style*="overflow: auto"]') !== null;

/** The height most recently delivered, so the DOM agrees with react-window. */
let deliveredHeight = 0;

// ── The non-virtualised list, for the one test that crosses the threshold ────
// Under fifty rows the register drops react-window and renders every row into a
// plain scrolling div, and the scroll arithmetic there is the app's own rather
// than react-window's. jsdom lays nothing out, so the three figures it reads —
// the viewport's height, each row's height, and where each row starts — are
// stood in at their real sizes.

const isPlainContainer = (el: HTMLElement): boolean => el.hasAttribute('data-virtualized-list');

const isPlainRow = (el: HTMLElement): boolean =>
  el.parentElement !== null && isPlainContainer(el.parentElement);

const plainRowHeight = (el: HTMLElement): number =>
  el.querySelector('[data-quick-edit="actions"]')
    ? QUICK_EDIT_ROW_HEIGHT + QUICK_EDIT_STRIP_HEIGHT
    : ROW_HEIGHT;

const plainRowTop = (el: HTMLElement): number => {
  let top = 0;
  for (let sibling = el.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (sibling instanceof HTMLElement) top += plainRowHeight(sibling);
  }
  return top;
};

const rectAt = (top: number, height: number): DOMRect => ({
  x: 0, y: top, top, bottom: top + height, left: 0, right: 0, width: 0, height,
  toJSON: () => ({}),
});

const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

/** jsdom lays nothing out; these are what the two scroll paths read back. */
const stubLayout = (): void => {
  const heightOf = function (this: HTMLElement): number {
    if (isListViewport(this)) return deliveredHeight;
    if (isPlainContainer(this)) return VIEWPORT_HEIGHT;
    return isPlainRow(this) ? plainRowHeight(this) : 0;
  };
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: heightOf });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: heightOf });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement): number {
      if (isPlainContainer(this)) {
        return Array.from(this.children).reduce(
          (total, child) => total + (child instanceof HTMLElement ? plainRowHeight(child) : 0),
          0
        );
      }
      if (!isListViewport(this)) return 0;
      const inner = this.firstElementChild;
      if (!(inner instanceof HTMLElement)) return 0;
      return Number.parseFloat(inner.style.height) || 0;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    if (isPlainContainer(this)) return rectAt(0, VIEWPORT_HEIGHT);
    if (isPlainRow(this)) {
      const scrolled = this.parentElement?.scrollTop ?? 0;
      return rectAt(plainRowTop(this) - scrolled, plainRowHeight(this));
    }
    return rectAt(0, 0);
  };
};

const restoreLayout = (): void => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).clientHeight;
  delete (HTMLElement.prototype as Partial<HTMLElement>).offsetHeight;
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollHeight;
  HTMLElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
};

const plainContainer = (): HTMLElement => {
  const el = grid().querySelector('[data-virtualized-list]');
  if (!(el instanceof HTMLElement)) throw new Error('the register is not on the plain list');
  return el;
};

/** How far down the plain list the highlighted row's middle sits, in px. */
const plainCentreOfActiveRow = (): number => {
  const id = grid().getAttribute('aria-activedescendant');
  const row = id ? document.getElementById(id) : null;
  if (!row) throw new Error('no row is highlighted');
  let wrapper: HTMLElement | null = row;
  while (wrapper && !isPlainRow(wrapper)) wrapper = wrapper.parentElement;
  if (!wrapper) throw new Error('the highlighted row is not in the plain list');
  return plainRowTop(wrapper) - plainContainer().scrollTop + plainRowHeight(wrapper) / 2;
};

/** How far down the viewport the highlighted row's middle sits, in px. */
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

const measurementArrives = (height = VIEWPORT_HEIGHT): void => {
  deliveredHeight = height;
  act(() => { sizing.deliver({ height, width: 800 }); });
};

/** Put the list somewhere, the way a user's own scrolling does. */
const scrollListTo = (offset: number): void => {
  const el = listViewport();
  el.scrollTop = offset;
  fireEvent.scroll(el);
};

/** Past both retries in VirtualizedList, whatever they are for. */
const settle = async (): Promise<void> => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
};

beforeEach(() => {
  localStorage.clear();
  rows = makeRows();
  updateTransaction.mockClear();
  sizing.subscribers.clear();
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

describe('Account register — the list does not exist yet when the first scroll is asked for', () => {
  it('renders no scroll container at all until the browser has measured it', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    // The premise, asserted rather than assumed: this is what every other
    // virtualised test in this repo skips past, and it is the state the real
    // register is in when its opening scroll and any deep link are issued.
    expect(listHasMounted()).toBe(false);
  });

  it('opens at the foot even though the measurement arrived after the request', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    // The register asked to be parked at its foot while there was nothing to
    // ask; the measurement lands afterwards, as a browser's always does.
    measurementArrives();
    await settle();

    const list = listViewport();
    expect(list.scrollTop).toBe(list.scrollHeight - VIEWPORT_HEIGHT);
  });

  it('still opens at the foot when the measurement is a slow one', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    // ─ THE CASE THE OWNER IS IN ────────────────────────────────────────────
    // A ResizeObserver callback is queued behind whatever else the main thread
    // is doing, and on THIS register that is a great deal: eleven thousand
    // rows filtered, sorted, and run through a Decimal running balance in the
    // same flush. Half a second between "the register asked to be scrolled"
    // and "there is a list to scroll" is an ordinary bad frame there.
    //
    // The retry that covered AutoSizer was a blind one — 0ms, 100ms, 300ms,
    // whether or not anything was listening — so past 300ms the request was
    // simply lost, and the register stayed where an unscrolled list starts:
    // the top, which for his account is 2008.
    await settle();
    measurementArrives();
    await settle();

    const list = listViewport();
    expect(list.scrollTop).toBe(list.scrollHeight - VIEWPORT_HEIGHT);
  });

  it('still centres a deep-linked row when the measurement is a slow one', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}?txn=txn-25`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    await settle();
    measurementArrives();
    await settle();

    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
  });

  it('centres a deep-linked row that was asked for before the list existed', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}?txn=txn-25`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    measurementArrives();
    // The delivery this waits on has a designed budget of 1500ms (deliverScroll),
    // so the default 1000ms waitFor loses the race by construction under
    // full-pipeline load. The wait must exceed the budget with slack.
    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Synthetic row 25');
    }, { timeout: 5000 });
    await settle();

    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
  });
});

describe('Account register — centring once the browser has measured', () => {
  it('centres the row a click opens the box on', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    measurementArrives();
    await settle();

    scrollListTo(700);
    fireEvent.click(within(grid()).getByText('Synthetic row 25'));

    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
  });

  it('centres the row Save & Next moves on to', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    measurementArrives();
    await settle();

    scrollListTo(700);
    fireEvent.click(within(grid()).getByText('Synthetic row 25'));
    fireEvent.click(within(strip()).getByRole('button', { name: 'Save & Next' }));
    await waitFor(() => {
      expect(descriptionField()).toHaveValue('Synthetic row 26');
    }, { timeout: 5000 });

    // Waited for rather than read on the spot, and the reason is worth writing
    // down: a Save & Next crosses an await (the write) and the scroll that
    // follows it runs in a PASSIVE effect, which React flushes on its own
    // schedule. So the box can be showing the next row a moment before the
    // register has been scrolled to it — reading in that gap catches the list
    // still centred on the row just saved, which is a fact about React's
    // scheduler and not about this register.
    await waitFor(() => {
      expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
    }, { timeout: 5000 });
  });

  it('holds the centre under a held arrow key, box and all', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    measurementArrives();
    await settle();

    scrollListTo(700);
    fireEvent.click(within(grid()).getByText('Synthetic row 25'));
    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);

    // A held arrow key, which is the stress case for all of this at once: five
    // centre requests in a row, each one moving the box to a different row, so
    // each one changes the height of two rows and makes react-window forget
    // every offset it had measured (resetAfterIndex) in the same commit that
    // asks for the scroll. If the scroll were computed before the re-measure,
    // the box would drift a box-height further off centre with every keystroke.
    for (let step = 0; step < 5; step += 1) {
      fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    }

    expect(screen.getByDisplayValue('Synthetic row 30')).toBeInTheDocument();
    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
    // …and it is still there once the retries behind each of those requests
    // have all run, rather than the last one landing on stale geometry.
    await settle();
    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
  });

  it('holds the centre when the register is re-measured under it', async () => {
    render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    measurementArrives();
    await settle();

    scrollListTo(700);
    fireEvent.click(within(grid()).getByText('Synthetic row 25'));
    expect(centreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);

    // A second measurement, which a real browser delivers whenever anything
    // above the table moves — the sort's own explanatory line appearing, the
    // dock swapping to the selection bar, the window being resized. The row
    // being worked on must not be left wherever the old arithmetic put it.
    measurementArrives(VIEWPORT_HEIGHT - ROW_HEIGHT * 2);
    await settle();

    expect(centreOfActiveRow()).toBe((VIEWPORT_HEIGHT - ROW_HEIGHT * 2) / 2);
  });
});

describe('Account register — when the register stops being virtualised', () => {
  it('scrolls the list that is actually on screen, not the one that left', async () => {
    const { rerender } = render(registerTree(`/accounts/${ACCOUNT.id}`));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    measurementArrives();
    await settle();
    expect(listHasMounted()).toBe(true);

    // A search that narrows an eleven-thousand-row register to a payee's dozen
    // rows, in effect: under fifty rows the register drops react-window and
    // renders the lot into a plain scrolling div. react-window goes off screen.
    rows = makeRows().slice(0, 30);
    __setAppContextValue({ transactions: rows });
    rerender(registerTree(`/accounts/${ACCOUNT.id}`));
    expect(listHasMounted()).toBe(false);

    plainContainer().scrollTop = 0;
    fireEvent.click(within(grid()).getByText('Synthetic row 20'));

    // THE BUG THIS GUARDS. The ref holding react-window was only ever assigned
    // when React handed it an instance, never when React handed it null — so
    // after the switch it still pointed at an unmounted list, every scroll was
    // issued to a component that is no longer on screen, and the container the
    // user is actually looking at was never touched. Centring simply stopped
    // working, silently, for the rest of the session.
    expect(plainCentreOfActiveRow()).toBe(VIEWPORT_HEIGHT / 2);
  });
});
