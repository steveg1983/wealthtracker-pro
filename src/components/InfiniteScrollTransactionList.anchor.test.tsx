/**
 * WHICH END THE PHONE OPENS ON.
 *
 * The owner, 29 Aug: sorting an account's register oldest-first put him on
 * 2008 and left eleven thousand rows between him and this month. The desktop
 * register never had the problem — it keeps the same order and scrolls to its
 * foot — but a list that loads downward from the top has no foot to scroll to,
 * so the phone had to learn to load from the other end.
 *
 * These pin WHICH ROWS EXIST, which is the half that decides whether the
 * newest is reachable at all. The scroll correction that keeps a reader's
 * place while older rows are added above them is a browser behaviour jsdom
 * does not model, and is called out in the component rather than asserted
 * here — pretending to test it would be worse than saying so.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { InfiniteScrollTransactionList } from './InfiniteScrollTransactionList';
import type { Transaction } from '../types';

vi.mock('./SwipeableTransactionRow', () => ({
  SwipeableTransactionRow: ({ transaction }: { transaction: Transaction }) => (
    <div data-testid="row">{transaction.description}</div>
  )
}));

const ledger = (count: number): Transaction[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    // Oldest first, exactly as the register orders it: t0 is 2008, the last
    // one is this month.
    description: i === 0 ? 'OLDEST 2008' : i === count - 1 ? 'NEWEST TODAY' : `row ${i}`,
    amount: -1,
    date: new Date(2008, 0, 1 + i),
    accountId: 'a1',
    type: 'expense',
    category: undefined,
    cleared: false
  })) as unknown as Transaction[];

const renderList = (anchor: 'start' | 'end', count = 60, newestEnd?: 'start' | 'end') =>
  render(
    <InfiniteScrollTransactionList
      transactions={ledger(count)}
      accounts={[]}
      categories={[]}
      formatCurrency={(n) => `£${n}`}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onView={vi.fn()}
      emptyContent={<p>nothing</p>}
      itemsPerBatch={20}
      anchor={anchor}
      newestEnd={newestEnd}
    />
  );

describe('which end of a register the phone opens on', () => {
  it('opens on the NEWEST when the register is ordered oldest-first', () => {
    renderList('end');

    expect(screen.getByText('NEWEST TODAY')).toBeInTheDocument();
    // …and 2008 is NOT rendered, which is the whole complaint: it is fifty
    // rows away, not the first thing he meets.
    expect(screen.queryByText('OLDEST 2008')).not.toBeInTheDocument();
  });

  it('still opens on the first row for every other list', () => {
    renderList('start');

    expect(screen.getByText('OLDEST 2008')).toBeInTheDocument();
    expect(screen.queryByText('NEWEST TODAY')).not.toBeInTheDocument();
  });

  it('offers to load EARLIER rows, not "more", when it grows upward', () => {
    // The word matters: on an end-anchored list the next batch is older, and
    // "Load More" says nothing about which direction you are travelling.
    renderList('end');

    expect(screen.getByRole('button', { name: 'Load earlier' })).toBeInTheDocument();
  });

  it('shows the whole register when it fits, whichever end it is anchored to', () => {
    renderList('end', 5);

    expect(screen.getByText('OLDEST 2008')).toBeInTheDocument();
    expect(screen.getByText('NEWEST TODAY')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load earlier' })).not.toBeInTheDocument();
  });

  it('counts what is on screen out of the whole register either way', () => {
    renderList('end');

    expect(screen.getByText('Showing 20 of 60 transactions')).toBeInTheDocument();
  });
});

/**
 * THE WAY BACK TO THE OTHER END.
 *
 * The owner, 29 Aug: "I need a way to quickly get to the newest… whether a 'to
 * top' button that appears as you scroll up, or a 'To bottom' if you scroll
 * down." Both ends of the register are destinations — Quick Add is under the
 * last row, the filters are above the first.
 *
 * jsdom lays nothing out: `document.body.scrollHeight` is 0 and nothing ever
 * scrolls. So the three numbers the control is a function of are STATED here,
 * and what the component concludes from them is what these pin. The smooth
 * scroll itself is a browser behaviour and is not pretended at.
 */
const VIEWPORT = 800;

const geometry: Array<[object, string, PropertyDescriptor | undefined]> = [];

const pinPage = (pageHeight: number, scrolledTo = 0): void => {
  const stub = (target: object, property: string, value: number): void => {
    geometry.push([target, property, Object.getOwnPropertyDescriptor(target, property)]);
    Object.defineProperty(target, property, { configurable: true, get: () => value });
  };
  stub(document.body, 'scrollHeight', pageHeight);
  stub(window, 'innerHeight', VIEWPORT);
  stub(window, 'scrollY', scrolledTo);
};

/** Move the viewport and tell the listener, then let its rAF land. */
const scrollPageTo = async (position: number, pageHeight: number): Promise<void> => {
  pinPage(pageHeight, position);
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
    // requestAnimationFrame is a 16ms timeout under this runner (browserShims).
    await new Promise(resolve => setTimeout(resolve, 40));
  });
};

const jumpButton = (): HTMLElement | null => screen.queryByRole('button', { name: /^Jump/ });

/** Let `count` animation frames land, one act() at a time. */
const runFrames = async (count: number): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
    });
  }
};

const scrollToCalls = (): number => vi.mocked(window.scrollTo).mock.calls.length;

const lastScrollTo = (): unknown => {
  const calls = vi.mocked(window.scrollTo).mock.calls;
  return calls[calls.length - 1]?.[0];
};

afterEach(() => {
  // Restore in reverse: the same property is stubbed more than once per test.
  for (const [target, property, descriptor] of geometry.reverse()) {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  }
  geometry.length = 0;
});

describe('getting from one end of a long register to the other', () => {
  it('stays away entirely when the whole page is barely a screen and a half', () => {
    // Nothing to shortcut to: the other end is a flick away, and a floating
    // button here would only cover a row.
    pinPage(VIEWPORT + 200);
    renderList('start');

    expect(jumpButton()).not.toBeInTheDocument();
  });

  it('offers the far end, and names it by what is there', () => {
    // Oldest-first register, so the newest line is the LAST one — and the
    // reader is at the top.
    pinPage(VIEWPORT * 4);
    renderList('end', 60, 'end');

    expect(jumpButton()).toHaveAccessibleName('Jump to newest');
  });

  it('turns round once the reader is past the middle', async () => {
    pinPage(VIEWPORT * 4);
    renderList('end', 60, 'end');

    await scrollPageTo(VIEWPORT * 2.5, VIEWPORT * 4);

    // Same button, other direction: from down here the far end is the top,
    // and on an oldest-first list the top is 2008.
    expect(jumpButton()).toHaveAccessibleName('Jump to oldest');
  });

  it('reads the ends the other way round for a newest-first list', async () => {
    // The phone's untouched default: newest at the top, loading downward.
    pinPage(VIEWPORT * 4);
    renderList('start', 60, 'start');

    expect(jumpButton()).toHaveAccessibleName('Jump to oldest');

    await scrollPageTo(VIEWPORT * 2.5, VIEWPORT * 4);

    expect(jumpButton()).toHaveAccessibleName('Jump to newest');
  });

  it('names a direction instead of a chronology when neither end is newest', () => {
    // Sorted by amount: "newest" would be a claim about the ends that the
    // order does not support.
    pinPage(VIEWPORT * 4);
    renderList('start');

    expect(jumpButton()).toHaveAccessibleName('Jump to the bottom of the list');
  });

  it('actually travels to the far end when tapped', async () => {
    pinPage(VIEWPORT * 4);
    renderList('end', 60, 'end');
    // The end-anchored list scrolls itself on arrival; that call is not this
    // one's, so it is cleared before the tap.
    vi.mocked(window.scrollTo).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to newest' }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: VIEWPORT * 4, behavior: 'smooth' });

    await scrollPageTo(VIEWPORT * 2.5, VIEWPORT * 4);
    vi.mocked(window.scrollTo).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to oldest' }));
    await runFrames(3);

    // WHAT "THE FAR END" MEANS, RESTATED — this assertion used to read "the
    // top of what is LOADED, where 'Load earlier' sits", on the ruling that
    // scrolling somebody to rows not in the DOM would be a lie dressed as a
    // feature. The owner met the other half of that bargain on 29 August: the
    // end of the loaded rows is not an end, it is a place the next batch
    // moves. So the jump loads the rest on the way and arrives at 2008 for
    // real — which is why there is no longer anything earlier to load.
    expect(lastScrollTo()).toEqual({ top: 0, behavior: 'auto' });
    expect(screen.getByText('OLDEST 2008')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load earlier' })).not.toBeInTheDocument();
  });
});

/**
 * THE JUMP THAT KEPT ARRIVING SOMEWHERE ELSE.
 *
 * The owner, 29 August, on the phone register — 1,842 rows, 120 of them
 * loaded: "when I press the down arrow, the screen briefly shows me the bottom
 * and then ends up somewhere last year, and so I still have to continuously
 * scroll… the up arrow works perfectly."
 *
 * The cascade is in the component's own header. What these pin is the promise
 * that replaced the single scroll: while a jump towards the GROWING end is in
 * flight the list keeps loading and keeps re-arriving, and it lets go only
 * when there is nothing left to load — or the moment the reader steers.
 *
 * WHAT JSDOM CANNOT PROVE, and is not pretended at here: there is no layout in
 * it, so `document.body.scrollHeight` is whatever these tests say it is and
 * nothing ever moves. The real physics — that landing at the foot brings the
 * sentinel into view, that a smooth scroll and a growing page fight, that a
 * touch halts a scroll on iOS — are browser behaviours. These pin the STATE
 * MACHINE: which end is pinned, that growth continues to the full length while
 * it is, that the last scroll before the pin lets go targets the true end, and
 * that a gesture or an unmount stops everything.
 */
describe('a jump towards the growing end arrives at the END, not at the end of what is loaded', () => {
  const PAGE = VIEWPORT * 4;

  it('keeps loading and re-arriving until the whole register is in the page', async () => {
    // The phone's default: newest first, loading downward, 500 rows of which
    // 20 exist. His down arrow.
    pinPage(PAGE);
    renderList('start', 500, 'start');
    vi.mocked(window.scrollTo).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to oldest' }));
    await runFrames(6);

    // Every row there is — the "somewhere last year" was row 120 of 1,842.
    expect(screen.getByText('Showing 500 of 500 transactions')).toBeInTheDocument();
    // And the LAST thing it did was arrive, after the last rows landed.
    expect(lastScrollTo()).toEqual({ top: PAGE, behavior: 'auto' });

    // Then it let go: no further frame touches the page.
    const settled = scrollToCalls();
    await runFrames(3);
    expect(scrollToCalls()).toBe(settled);
  });

  it('does the same thing upwards for a register that grows at the top', async () => {
    // The mirror case: oldest-first, loading "Load earlier" upward. The
    // cascade there is the same one — arriving at the top brings the sentinel
    // into view — so it is the same promise, not a mirrored copy of one.
    pinPage(PAGE);
    renderList('end', 500, 'end');

    await scrollPageTo(VIEWPORT * 2.5, PAGE);
    vi.mocked(window.scrollTo).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to oldest' }));
    await runFrames(6);

    expect(screen.getByText('Showing 500 of 500 transactions')).toBeInTheDocument();
    expect(lastScrollTo()).toEqual({ top: 0, behavior: 'auto' });
    expect(screen.getByText('OLDEST 2008')).toBeInTheDocument();
  });

  it('lets go the instant the reader grabs the page, and stays let go', async () => {
    pinPage(PAGE);
    renderList('start', 500, 'start');
    vi.mocked(window.scrollTo).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to oldest' }));
    await runFrames(1);
    // One stride in, and not at the end: this is mid-flight.
    expect(screen.getByText('Showing 220 of 500 transactions')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('wheel'));
    });
    const atRelease = scrollToCalls();
    await runFrames(4);

    // The reader wins: no more rows arrive under them and nothing moves the
    // page again.
    expect(screen.getByText('Showing 220 of 500 transactions')).toBeInTheDocument();
    expect(scrollToCalls()).toBe(atRelease);
  });

  it('lets go for a touch as well as a wheel — the phone is where this bug lives', async () => {
    pinPage(PAGE);
    renderList('start', 500, 'start');

    fireEvent.click(screen.getByRole('button', { name: 'Jump to oldest' }));
    await runFrames(1);

    await act(async () => {
      window.dispatchEvent(new Event('touchstart'));
    });
    await runFrames(4);

    expect(screen.getByText('Showing 220 of 500 transactions')).toBeInTheDocument();
  });

  it('scrolls once, and loads nothing, towards the end that cannot move', async () => {
    // The up arrow "works perfectly" because the top of a downward-loading
    // list is a fixed edge. It must stay a single smooth scroll: pinning an
    // edge nothing is added to would only be a slower way of standing still.
    pinPage(PAGE);
    renderList('start', 500, 'start');

    await scrollPageTo(VIEWPORT * 2.5, PAGE);
    vi.mocked(window.scrollTo).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to newest' }));
    await runFrames(4);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(lastScrollTo()).toEqual({ top: 0, behavior: 'smooth' });
    expect(screen.getByText('Showing 20 of 500 transactions')).toBeInTheDocument();
  });

  it('takes its frame with it when the reader navigates away mid-flight', async () => {
    // A frame that outlives its component scrolls whatever page replaced it.
    pinPage(PAGE);
    renderList('start', 500, 'start');
    vi.mocked(window.scrollTo).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to oldest' }));
    await runFrames(1);
    const beforeUnmount = scrollToCalls();

    cleanup();
    await runFrames(4);

    expect(scrollToCalls()).toBe(beforeUnmount);
  });
});
