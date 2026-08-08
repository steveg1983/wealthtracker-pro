/**
 * Payee cleanup — the page the owner opened and found EMPTY.
 *
 * His report: "Showing 9,137 of 9,137 payees" above a table with nothing in it;
 * Select all shown ticks 9,137 and the count agrees, but the body stays blank.
 * Search for something that narrows it to two dozen and the same table draws
 * perfectly. In the same screenshot the "Dismissed suggestions" footer is
 * printed OVER the middle of the rows.
 *
 * Both are one fault, and it is a LAYOUT fault rather than a data one — which
 * is why every existing test of this screen passes while the screen is unusable:
 * they all use a handful of payees, and a handful takes the plain (non-
 * virtualised) path, which needs no measurement at all.
 *
 * ─ THE MECHANISM ────────────────────────────────────────────────────────────
 * Over a hundred rows the table virtualises, and a virtualised list is
 * MEASURED, not laid out: AutoSizer asks the browser how tall its parent is and
 * renders NO CHILDREN while the answer is zero (`bailoutOnChildren` — read it
 * in the installed package). The page gives the table a 560px box; the table's
 * own root is `flex flex-col` at AUTO height, so unless it is told to fill that
 * box its flex-1 list child resolves its height against a container that is as
 * tall as its content, the measurement comes back 0, and react-window renders
 * nothing at all. The header, the counts and the selection all keep working —
 * they never depended on the measurement — so the page looks fine and is empty.
 *
 * The same missing rule fails the other way under a hundred rows: the plain
 * list grows to its content, the 560px box does not clip, and the surplus rows
 * are painted over whatever follows them on the page. Hence the footer sitting
 * across the middle of the table in the screenshot.
 *
 * ─ HOW THIS FILE PROVES IT ──────────────────────────────────────────────────
 * jsdom lays nothing out, so it cannot answer "how tall is this?" on its own.
 * Two things stand in, and both are deliberately narrow:
 *
 *   1. an AutoSizer with the REAL one's rule — no children until a measurement
 *      arrives, and the measurement is its parent's height, delivered by the
 *      test rather than by a timer (the technique the register's async-sizing
 *      tests established);
 *   2. `definiteHeight`, a model of the ONE CSS rule this bug turns on: a
 *      height only reaches a descendant through elements that claim it —
 *      `h-full` (height:100%) or a flex child stretching inside a flex column —
 *      and stops dead at the first element whose height is its content's.
 *
 * Every payee, date and figure below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import PayeeCleanup from './PayeeCleanup';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { payeeMerchantDismissalKey } from '../../utils/suggestionDismissals';
import type { SuggestionDismissal, Transaction } from '../../types';

/** The page's own figures, restated here so the test fails if either moves. */
const LIST_BOX_HEIGHT = 560;
const ROW_HEIGHT = 56;
/** Over VirtualizedTable's default threshold, so the list virtualises. */
const VIRTUALISED_ROWS = 120;
/** Under it, so the list renders every row into a plain scrolling div. */
const PLAIN_ROWS = 24;

const layout = vi.hoisted(() => {
  /** The table's one header row, at the height its padding gives it. */
  const HEADER_HEIGHT = 41;

  /**
   * How tall the browser would make this element — or null when nothing in its
   * ancestry fixes a height and it is therefore exactly as tall as whatever it
   * contains.
   *
   * The whole model, and it is deliberately only what this bug turns on:
   *
   *   · an inline pixel height is definite, full stop;
   *   · `h-full` is height:100%, which resolves only against a parent that
   *     itself has a definite height, and to nothing at all against one whose
   *     height is its content's;
   *   · a `flex-1` child of a `flex flex-col` parent stretches to what is left
   *     of the parent's definite height once its earlier siblings have taken
   *     theirs — and, again, to nothing when the parent has no definite height,
   *     because a column box that is as tall as its content has nothing spare
   *     to hand out;
   *   · anything else is content-height, which is where the chain ends.
   */
  const definiteHeight = (el: HTMLElement | null): number | null => {
    if (el === null) return null;

    const inline = Number.parseFloat(el.style.height);
    if (Number.isFinite(inline)) return inline;

    const parent = el.parentElement;
    if (parent === null) return null;

    if (el.classList.contains('h-full')) return definiteHeight(parent);

    if (
      el.classList.contains('flex-1') &&
      parent.classList.contains('flex') &&
      parent.classList.contains('flex-col')
    ) {
      const outer = definiteHeight(parent);
      if (outer === null) return null;
      let taken = 0;
      for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
        taken += HEADER_HEIGHT;
      }
      return Math.max(0, outer - taken);
    }

    return null;
  };

  const subscribers = new Set<() => void>();
  return {
    HEADER_HEIGHT,
    definiteHeight,
    subscribers,
    /** The ResizeObserver's callback, under the test's own hand. */
    deliver(): void {
      subscribers.forEach(measure => measure());
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
    const host = react.useRef<HTMLDivElement>(null);
    const [height, setHeight] = react.useState(0);
    react.useEffect(() => {
      const measure = (): void => {
        setHeight(layout.definiteHeight(host.current?.parentElement ?? null) ?? 0);
      };
      layout.subscribers.add(measure);
      return () => { layout.subscribers.delete(measure); };
    }, []);
    // The real component's own rule: nothing is rendered until there is a
    // measurement, and a measurement of zero is not one.
    return react.createElement(
      'div',
      { ref: host },
      height === 0 ? null : children({ height, width: 900 })
    );
  };
  return { default: FakeAutoSizer };
});

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(),
    showWarning: vi.fn(), showInfo: vi.fn(), dismissToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

/**
 * A register of unrelated one-off payees: a leading digit means none of them
 * yields a merchant key, so nothing clusters and the page is exactly what this
 * file is about — a long list in a box.
 *
 * One transaction each and the same amount on all of them, so the list's own
 * sort (most transactions, then biggest total, then alphabetical) falls all the
 * way through to alphabetical and the row at the top is knowably the first.
 */
const register = (payees: number): Transaction[] =>
  Array.from({ length: payees }, (_, i) => ({
    id: `t${i}`,
    description: `${String(i).padStart(4, '0')} SUNDRY REF ${4471000 + i}`,
    date: new Date('2026-03-01'),
    amount: -10,
    category: 'cat-1',
    accountId: 'acc-1',
    type: 'expense' as const,
  }));

/** Every payee row currently in the DOM — the thing the owner could not see. */
const rowsOnScreen = (): HTMLElement[] => screen.queryAllByLabelText(/^Select \d{4} SUNDRY/);

const measurementArrives = (): void => { act(() => { layout.deliver(); }); };

const plainList = (): HTMLElement => {
  const el = document.querySelector('[data-virtualized-list]');
  if (!(el instanceof HTMLElement)) throw new Error('the payee list is not on the plain path');
  return el;
};

/**
 * How many rows are drawn OUTSIDE the page's fixed-height box — over whatever
 * the page puts after it, which here is "Dismissed suggestions".
 *
 * A container that has a definite height and scrolls keeps every row it holds;
 * one whose height is its content's is as tall as the rows, and everything past
 * the box it sits in is painted over the page beneath.
 */
const rowsOutsideTheBox = (): number => {
  const container = plainList();
  const box = layout.definiteHeight(container);
  if (box !== null && container.classList.contains('overflow-y-auto')) return 0;
  const surplus = PLAIN_ROWS * ROW_HEIGHT + layout.HEADER_HEIGHT - LIST_BOX_HEIGHT;
  return Math.max(0, Math.ceil(surplus / ROW_HEIGHT));
};

const dismissal = (subjectKey: string): SuggestionDismissal => ({
  id: 'd-1', kind: 'payee-merchant', subjectKey, subjectIds: [], dismissedAt: new Date('2026-06-01'),
});

afterEach(() => {
  cleanup();
  layout.subscribers.clear();
  __resetAppContextValue();
});

describe('Payee cleanup — the list a browser has to measure', () => {
  it('renders nothing until the measurement arrives, which is the state the page opens in', () => {
    __setAppContextValue({ transactions: register(VIRTUALISED_ROWS) });
    render(<PayeeCleanup />);

    // The premise, asserted rather than assumed: AutoSizer starts at zero and
    // renders no children, so this is what every user sees for a frame or two.
    expect(screen.getByText(`Showing ${VIRTUALISED_ROWS} of ${VIRTUALISED_ROWS} payees`))
      .toBeInTheDocument();
    expect(rowsOnScreen()).toHaveLength(0);
  });

  it('puts the payees on screen once the browser has measured the box', () => {
    __setAppContextValue({ transactions: register(VIRTUALISED_ROWS) });
    render(<PayeeCleanup />);

    measurementArrives();

    // THE BUG. Without a height that reaches it, the measurement comes back 0
    // however long you wait, react-window renders nothing, and the page stays
    // exactly as blank as it was before the measurement — under a header that
    // says there are 120 payees.
    expect(rowsOnScreen().length).toBeGreaterThan(0);
    expect(screen.getByText('0000 SUNDRY REF 4471000')).toBeInTheDocument();
  });

  it('does not let the count and the body contradict each other', () => {
    __setAppContextValue({ transactions: register(VIRTUALISED_ROWS) });
    render(<PayeeCleanup />);
    measurementArrives();

    // The owner's exact move: Select all shown says 120, so the page KNOWS
    // about 120 payees. Whatever it knows, it has to show.
    fireEvent.click(screen.getByRole('button', { name: `Select all shown (${VIRTUALISED_ROWS})` }));

    expect(screen.getByText(`${VIRTUALISED_ROWS} selected · ${VIRTUALISED_ROWS} transactions`))
      .toBeInTheDocument();
    expect(rowsOnScreen().length).toBeGreaterThan(0);
  });

  it('keeps a search result on screen too — the case that always worked', () => {
    __setAppContextValue({ transactions: register(VIRTUALISED_ROWS) });
    render(<PayeeCleanup />);
    measurementArrives();

    fireEvent.change(screen.getByLabelText('Search payees'), { target: { value: '4471007' } });

    // Under a hundred matches the list drops react-window entirely, which is
    // why the owner's search box appeared to fix the page.
    expect(screen.getByText('0007 SUNDRY REF 4471007')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 120 payees')).toBeInTheDocument();
  });
});

describe('Payee cleanup — the list stays inside its box', () => {
  it('does not paint its rows over the section beneath it', () => {
    __setAppContextValue({
      transactions: register(PLAIN_ROWS),
      // So there IS a footer under the list to be painted over — the thing the
      // owner's screenshot shows sitting across the middle of the rows.
      suggestionDismissals: [dismissal(payeeMerchantDismissalKey('SUNDRY'))],
    });
    render(<PayeeCleanup />);

    expect(screen.getByText('Dismissed suggestions')).toBeInTheDocument();
    expect(rowsOnScreen()).toHaveLength(PLAIN_ROWS);
    // 24 rows of 56px do not fit in 560px, and the surplus has to go somewhere.
    // Inside a box that scrolls, "somewhere" is below the fold; without one it
    // is straight over the footer.
    expect(rowsOutsideTheBox()).toBe(0);
  });
});
