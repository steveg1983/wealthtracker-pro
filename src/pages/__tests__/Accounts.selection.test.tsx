import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { readProvenance, returnState } from '../../utils/navigationProvenance';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';
import {
  ACCOUNT_ROW_COLUMNS_CLASS,
  ACCOUNT_ROW_NAME_LINK_CLASS,
  ACCOUNT_ROW_SELECTED_CLASS,
} from '../../components/AccountRowColumns';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import type { Account } from '../../types';

/**
 * The Accounts list as an instrument you can drive, and the way back from a
 * register landing where you left.
 *
 * ─ WHAT CHANGED, AND WHY IT NEEDED TESTS ───────────────────────────────────
 * Clicking anywhere on a card used to open it. That left no gesture at all for
 * "this one" — the idea the register has had since it was built — so the list
 * could not be walked, and coming back from an account always meant coming back
 * to the top of two hundred rows. Now the NAME is a link (openable in a new tab
 * like any other), the row's plain background picks the row out, the arrows walk
 * the selection through everything on screen (nested cash rows included, because
 * a cash sleeve is a full account), and the way back into the list carries which
 * account you left.
 *
 * A paired cash row also gains the reconcile button its parent has always had.
 * Those rows are the Money-imported investment sleeves — the paired accounts
 * whose cash actually moves — so they were the ones you could not reconcile
 * from the list.
 *
 * ─ WHAT JSDOM CAN AND CANNOT SAY ───────────────────────────────────────────
 * It lays nothing out, so it cannot tell you the two lines of figures LOOK
 * aligned. What it can hold is the structure the alignment depends on: that
 * both kinds of row render the same column definition, with the same number of
 * slots, and the reconcile button in the same slot of each. Match the numbers up
 * by hand instead and these fail.
 *
 * Every name, figure and id below is invented: this repo is public.
 */

const EVERYDAY: Account = {
  id: 'acc-everyday', name: 'Synthetic Everyday', type: 'current', balance: 0,
  currency: 'GBP', institution: 'Synthetic Bank', lastUpdated: new Date('2026-01-01'),
  openingBalance: 0, isActive: true,
};

const PORTFOLIO: Account = {
  id: 'acc-portfolio', name: 'Synthetic Portfolio', type: 'investment', balance: 0,
  currency: 'GBP', institution: 'Synthetic Brokers', lastUpdated: new Date('2026-01-01'),
  openingBalance: 0, isActive: true,
};

/**
 * The cash sleeve of the pair, named the way the MS Money import names one —
 * which is what makes the list draw it as plain "Cash" inside its parent.
 */
const PORTFOLIO_CASH: Account = {
  id: 'acc-portfolio-cash', name: 'Synthetic Portfolio (Cash)', type: 'current', balance: 0,
  currency: 'GBP', institution: 'Synthetic Brokers', lastUpdated: new Date('2026-01-01'),
  openingBalance: 0, isActive: true, parentAccountId: PORTFOLIO.id,
};

/**
 * A name longer than any column will hold, for the truncation half of the hit
 * area. Kept OUT of the default set on purpose: it would sort in among the rows
 * the arrow-walking tests step through and change what "the next one down" is.
 */
const LONG_NAMED: Account = {
  id: 'acc-long', name: 'Synthetic Joint Reserve and Renovation Fund (Second Account)',
  type: 'current', balance: 0, currency: 'GBP', institution: 'Synthetic Bank',
  lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

/**
 * A stand-in for the register: where the router ended up, what it was handed —
 * and the way back.
 *
 * The back button is the real one's two lines verbatim (see
 * AccountTransactions: `backTo ? navigate(backTo.path, { state:
 * returnState(backTo) })`), running the real navigationProvenance functions
 * rather than a test-only imitation. That is what makes the round trip below a
 * test of the mechanism and not of a mock: cut the crumbs at either end and it
 * fails.
 */
function Register(): React.JSX.Element {
  const { accountId } = useParams<{ accountId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = readProvenance(location.state);
  return (
    <div>
      <h1>Register</h1>
      <span data-testid="register-account">{accountId}</span>
      <span data-testid="register-state">{JSON.stringify(location.state)}</span>
      <button
        type="button"
        onClick={() => (backTo
          ? navigate(backTo.path, { state: returnState(backTo) })
          : navigate('/accounts'))}
      >
        {backTo ? backTo.label : 'Back to Accounts'}
      </button>
    </div>
  );
}

function Reconciliation(): React.JSX.Element {
  const location = useLocation();
  return (
    <div>
      <h1>Reconciliation</h1>
      <span data-testid="reconcile-query">{location.search}</span>
    </div>
  );
}

/**
 * `state` is what a return trip from a register hands back — the crumbs this
 * page left for itself on the way in. Driven through location.state exactly as
 * the register's own back button drives it.
 */
const renderAccounts = (state?: unknown): void => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/accounts', state }]}>
      <PreferencesProvider>
        <ToastProvider>
          <Routes>
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:accountId" element={<Register />} />
            <Route path="/reconciliation" element={<Reconciliation />} />
          </Routes>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/** The link that opens an account — the account's name. */
const nameLink = (name: string): HTMLElement => screen.getByRole('link', { name });

/** An element's classes as whole names — `max-w-full` is not `w-full`. */
const classesOf = (element: HTMLElement): string[] => Array.from(element.classList);

/**
 * The NAME CELL: the heading (or, on a cash row, the line) the link sits in.
 *
 * This is the strip of row the bug was about. It runs the full width of the
 * name column whatever the name's length — which is right, because the phone
 * balance to its right is pushed there by it — so everything in it past the
 * last letter of the name is row background, and clicking there means "this
 * one", not "open it".
 */
const nameCell = (name: string): HTMLElement => {
  const cell = nameLink(name).parentElement;
  if (!(cell instanceof HTMLElement)) throw new Error(`no name cell for "${name}"`);
  return cell;
};

/**
 * The ROW an account is drawn as: the nearest ancestor of its name that can
 * take the focus. Both kinds of row are focusable and nothing between them is,
 * so this answers "the card" for a top-level account and "the cash row" for a
 * nested one — which is the distinction every assertion below turns on.
 */
const row = (name: string): HTMLElement => {
  const found = nameLink(name).closest('[tabindex]');
  if (!(found instanceof HTMLElement)) throw new Error(`no focusable row for "${name}"`);
  return found;
};

/** That row's column block — the one shared definition, as rendered. */
const columnsOf = (rowEl: HTMLElement): HTMLElement => {
  const found = rowEl.querySelector('[data-account-columns]');
  if (!(found instanceof HTMLElement)) throw new Error('the row rendered no columns');
  return found;
};

/** The name of whichever row is currently picked out, or null for none. */
const selectedRowName = (): string | null => {
  const marked = document.querySelectorAll('[aria-current="true"]');
  if (marked.length === 0) return null;
  if (marked.length > 1) throw new Error(`${marked.length} rows claim to be current`);
  const link = marked[0].querySelector('a');
  return link?.textContent ?? null;
};

const openList = async (state?: unknown): Promise<void> => {
  renderAccounts(state);
  await screen.findByRole('link', { name: 'Synthetic Everyday' });
};

/**
 * jsdom implements no scrolling at all — `scrollIntoView` is simply absent, and
 * both the page and the arrival hook call it optionally for exactly that
 * reason. Installing a spy is the only way to say "and the row was brought into
 * view", which is half of what landing on the right row means.
 */
const spyOnScrollIntoView = (): ReturnType<typeof vi.fn> => {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true, writable: true, value: scrollIntoView,
  });
  return scrollIntoView;
};

const restoreScrollIntoView = (): void => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
};

beforeEach(() => {
  localStorage.clear();
  __setAppContextValue({
    accounts: [EVERYDAY, PORTFOLIO, PORTFOLIO_CASH],
    transactions: [],
    isLoading: false,
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Accounts list — the name is the way in', () => {
  it('opens the account when its name is clicked', async () => {
    await openList();

    fireEvent.click(nameLink('Synthetic Everyday'));

    expect(screen.getByRole('heading', { level: 1, name: 'Register' })).toBeInTheDocument();
    expect(screen.getByTestId('register-account')).toHaveTextContent(EVERYDAY.id);
  });

  it('is a real link, so it can be opened in a new tab or copied', async () => {
    await openList();

    // An href — not a div with a click handler. Middle-click, ⌘-click and
    // "copy link address" all work because the browser is doing the work.
    expect(nameLink('Synthetic Everyday')).toHaveAttribute('href', `/accounts/${EVERYDAY.id}`);
    expect(nameLink('Cash')).toHaveAttribute('href', `/accounts/${PORTFOLIO_CASH.id}`);
  });

  it('tells the register where the user came from, and which row to come back to', async () => {
    await openList();

    fireEvent.click(nameLink('Synthetic Everyday'));

    // The provenance mechanism, unchanged (utils/navigationProvenance): the
    // register renders `label` on its back button and hands `resume` back
    // untouched. The crumbs are this page's own note to itself.
    expect(JSON.parse(screen.getByTestId('register-state').textContent || 'null')).toEqual({
      from: {
        path: '/accounts',
        label: 'Back to Accounts',
        resume: { accountId: EVERYDAY.id },
      },
    });
  });
});

describe('Accounts list — the link is the letters, and no wider', () => {
  /**
   * ─ THE MISS THIS BLOCK EXISTS FOR ──────────────────────────────────────────
   * The name link shipped as a plain `block` inside a flex-1 heading, so its box
   * filled the whole name column. A click in what LOOKS like empty row an inch
   * to the right of a short name landed on the link and opened the register —
   * the hover underline and the "Open …" tooltip showing up under a cursor that
   * was nowhere near the text. It caught the owner over and over.
   *
   * ─ WHAT jsdom CAN AND CANNOT SAY ───────────────────────────────────────────
   * There is no layout here, so there is no x=300 to click at: which element a
   * click at that x actually hits is decided by the link's WIDTH, and jsdom
   * knows nothing about widths. So each behavioural test below states the width
   * as a class in the SAME test as the click it explains. Split them apart and
   * the behavioural half becomes worthless: clicking the heading directly
   * selects the row whether the link is stretched across it or not, so a
   * separated test would sail through the very regression it was written for.
   */
  it('picks the row out when the click lands right of the name', async () => {
    await openList();

    // As wide as its own letters (w-fit) and never wider than the column
    // (max-w-full) — so the rest of the heading is row background.
    const link = nameLink('Synthetic Everyday');
    expect(classesOf(link)).toContain('w-fit');
    expect(classesOf(link)).toContain('max-w-full');
    // And nothing that would fill the track again. Whole class names, not a
    // substring search: `max-w-full` contains the letters of `w-full`.
    for (const stretches of ['w-full', 'flex-1', 'grow', 'self-stretch']) {
      expect(classesOf(link)).not.toContain(stretches);
    }

    fireEvent.click(nameCell('Synthetic Everyday'));

    // Still on the list, with the row picked out: exactly what the owner meant
    // by that click.
    expect(screen.queryByRole('heading', { level: 1, name: 'Register' })).not.toBeInTheDocument();
    expect(selectedRowName()).toBe('Synthetic Everyday');
  });

  it('opens the account when the click lands ON the letters', async () => {
    await openList();

    fireEvent.click(nameLink('Synthetic Everyday'));

    // The other half of the same rule, and the reason the test above cannot
    // stand alone: a link that had been shrunk to nothing — or dropped for a
    // span — would pass the dead-zone test perfectly and leave the page with no
    // way in at all.
    expect(screen.getByTestId('register-account')).toHaveTextContent(EVERYDAY.id);
  });

  it('leaves the widest dead zone of all — the cash row’s — to the row', async () => {
    await openList();

    // This link reads plain "Cash": four letters across a line as wide as its
    // parent card's, which made it the easiest miss on the page.
    expect(classesOf(nameLink('Cash'))).toContain('w-fit');

    fireEvent.click(nameCell('Cash'));

    expect(screen.queryByRole('heading', { level: 1, name: 'Register' })).not.toBeInTheDocument();
    // ITS row, not the card it sits inside.
    expect(selectedRowName()).toBe('Cash');
  });

  it('gives both kinds of row the same hit area, from one definition', async () => {
    await openList();

    // Not "both look about right" — the same string, from the same export, the
    // way the columns are shared. The hit area cannot come out right for a card
    // and wrong for a cash row.
    for (const name of ['Synthetic Everyday', 'Cash']) {
      expect(nameLink(name).className).toContain(ACCOUNT_ROW_NAME_LINK_CLASS);
    }
  });

  it('holds a long name inside its column rather than running it over the figures', async () => {
    __setAppContextValue({ accounts: [EVERYDAY, LONG_NAMED], transactions: [], isLoading: false });
    await openList();

    const link = nameLink(LONG_NAMED.name);
    // fit-content of a nowrap line is the WHOLE name however long it runs, so
    // the cap is what stands between this name and the Bank Bal column, and the
    // ellipsis is what makes the cap readable rather than a guillotine.
    expect(classesOf(link)).toContain('max-w-full');
    expect(classesOf(link)).toContain('truncate');
    // Long or short, the row still answers a click beside the name.
    fireEvent.click(nameCell(LONG_NAMED.name));
    expect(selectedRowName()).toBe(LONG_NAMED.name);
  });

  it('draws the keyboard focus ring round the name, where it can be seen', async () => {
    await openList();

    // The indicator belongs to the link, so it is the size of the link — which
    // is the size of the letters and not of the row.
    //
    // It used to be asserted as the link's own `focus-visible:ring-2`. That
    // ring is gone: it painted INSIDE the app-wide `*:focus-visible` outline,
    // so the name wore two (RULINGS_ON_CAUSE_2026-08-13 §3). What still has to
    // hold is the GEOMETRY the outline inherits — `w-fit` is what makes the
    // indicator hug the letters, and it is now the only thing that does.
    expect(classesOf(nameLink('Synthetic Everyday'))).toContain('w-fit');
    expect(classesOf(nameLink('Synthetic Everyday'))).not.toContain('focus-visible:ring-2');
    // …and the heading around it no longer clips. `truncate` there had nothing
    // left to clip once the link capped itself, but it did clip the ring: an
    // ancestor's overflow clips a descendant's outline and box-shadow alike, so
    // the account name showed no keyboard focus at all.
    expect(classesOf(nameCell('Synthetic Everyday'))).not.toContain('truncate');
    expect(classesOf(nameCell('Cash'))).not.toContain('truncate');
  });
});

describe('Accounts list — clicking the row picks it out', () => {
  it('selects the row and stays on the page', async () => {
    await openList();

    fireEvent.click(row('Synthetic Everyday'));

    // Still here. A click on the background is not a request to go anywhere.
    expect(screen.queryByRole('heading', { level: 1, name: 'Register' })).not.toBeInTheDocument();
    expect(selectedRowName()).toBe('Synthetic Everyday');
  });

  it('gives the selected row the register’s floating look', async () => {
    await openList();

    fireEvent.click(row('Synthetic Everyday'));

    // The same wash, ring and lift the register's active row has — echoed from
    // ONE definition, so a change to the look is a change to both rows.
    for (const utility of ACCOUNT_ROW_SELECTED_CLASS.split(' ')) {
      expect(row('Synthetic Everyday').className).toContain(utility);
    }
    // …and the row that is not selected wears none of it.
    expect(row('Synthetic Portfolio').className).not.toContain('bg-blue-50/80');
  });

  it('hands the row the keyboard, so the arrows are live without a second click', async () => {
    await openList();

    fireEvent.click(row('Synthetic Everyday'));

    expect(document.activeElement).toBe(row('Synthetic Everyday'));
  });

  it('leaves the row alone when a button inside it was clicked', async () => {
    await openList();

    fireEvent.click(screen.getByRole('button', { name: `Account settings for ${PORTFOLIO.name}` }));

    // The settings dialog is the answer to that click; picking the row out as
    // well would move the focus out from under the dialog that just opened.
    expect(selectedRowName()).toBeNull();
  });

  it('selects the CASH row, not the card it sits in', async () => {
    await openList();

    fireEvent.click(row('Cash'));

    expect(selectedRowName()).toBe('Cash');
  });
});

describe('Accounts list — the arrow keys walk it', () => {
  it('moves down across sections and into the nested cash row', async () => {
    await openList();

    const start = row('Synthetic Everyday');
    fireEvent.click(start);
    expect(selectedRowName()).toBe('Synthetic Everyday');

    // Out of Current Accounts and into Investments: a section boundary is not
    // a wall, it is a heading.
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    expect(selectedRowName()).toBe('Synthetic Portfolio');

    // …and on into the cash sitting inside that card. It is a row like any
    // other — its own register, its own figures — so the arrows reach it.
    fireEvent.keyDown(row('Synthetic Portfolio'), { key: 'ArrowDown' });
    expect(selectedRowName()).toBe('Cash');
    expect(document.activeElement).toBe(row('Cash'));
  });

  it('moves back up the same way', async () => {
    await openList();

    fireEvent.click(row('Cash'));
    fireEvent.keyDown(row('Cash'), { key: 'ArrowUp' });

    expect(selectedRowName()).toBe('Synthetic Portfolio');
  });

  it('stops at the ends rather than wrapping', async () => {
    await openList();

    fireEvent.click(row('Synthetic Everyday'));
    fireEvent.keyDown(row('Synthetic Everyday'), { key: 'ArrowUp' });

    // The first row is where it stays. A list that jumped to the bottom would
    // lose the user's place with no way of knowing it had.
    expect(selectedRowName()).toBe('Synthetic Everyday');
  });

  it('opens the selected account on Enter', async () => {
    await openList();

    fireEvent.click(row('Synthetic Everyday'));
    fireEvent.keyDown(row('Synthetic Everyday'), { key: 'ArrowDown' });
    fireEvent.keyDown(row('Synthetic Portfolio'), { key: 'Enter' });

    expect(screen.getByTestId('register-account')).toHaveTextContent(PORTFOLIO.id);
    // The same journey the name link makes, crumbs and all — so Enter and a
    // click land the user in the same place, and come back to the same row.
    expect(JSON.parse(screen.getByTestId('register-state').textContent || 'null')).toEqual({
      from: { path: '/accounts', label: 'Back to Accounts', resume: { accountId: PORTFOLIO.id } },
    });
  });

  it('lets go of the row on Escape', async () => {
    await openList();

    fireEvent.click(row('Synthetic Everyday'));
    fireEvent.keyDown(row('Synthetic Everyday'), { key: 'Escape' });

    expect(selectedRowName()).toBeNull();
  });

  it('keeps out of the way of the search box', async () => {
    await openList();

    fireEvent.click(row('Synthetic Everyday'));
    const search = screen.getByRole('searchbox');
    search.focus();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'ArrowUp' });

    // Arrows in a text box belong to the text box (and to whatever suggestion
    // list a browser puts under a search field). The keys live on the ROW, so
    // they cannot reach this at all — the selection has not moved.
    expect(selectedRowName()).toBe('Synthetic Everyday');
    expect(document.activeElement).toBe(search);
  });

  it('is one tab stop, not two hundred', async () => {
    await openList();

    // With nothing selected the FIRST row is the way in; every other row is
    // reachable from it with the arrows. Two hundred accounts must not cost
    // two hundred presses of Tab to get past.
    expect(row('Synthetic Everyday')).toHaveAttribute('tabindex', '0');
    expect(row('Synthetic Portfolio')).toHaveAttribute('tabindex', '-1');
    expect(row('Cash')).toHaveAttribute('tabindex', '-1');

    // Once a row is picked out, IT is the tab stop.
    fireEvent.click(row('Cash'));
    expect(row('Cash')).toHaveAttribute('tabindex', '0');
    expect(row('Synthetic Everyday')).toHaveAttribute('tabindex', '-1');
  });

  it('brings the row it moves to into view', async () => {
    const scrollIntoView = spyOnScrollIntoView();
    try {
      await openList();

      fireEvent.click(row('Synthetic Everyday'));
      fireEvent.keyDown(row('Synthetic Everyday'), { key: 'ArrowDown' });

      // `center`, and this test used to pin `nearest`. `nearest` is DEFINED
      // as "scroll the least that makes it visible", so it does nothing while
      // the row is on screen and then jumps when it reaches an edge — the
      // owner's report: "the page doesn't move until the highlighted account
      // is out of sight, then the page starts scrolling". A stall then a lurch.
      //
      // `center` keeps the selection mid-screen with the list moving under it,
      // which is what the register already does (useArrivalFocus). Clamping at
      // the ends needs no code: a container cannot scroll past its own extent.
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
      expect(scrollIntoView.mock.instances[0]).toBe(row('Synthetic Portfolio'));
    } finally {
      restoreScrollIntoView();
    }
  });

  it('keeps a way in when a search hides the selected row', async () => {
    await openList();

    fireEvent.click(row('Cash'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'everyday' } });

    // The selection is off screen, so the first row STILL on screen becomes the
    // way in. Without that the list would have no tab stop at all and could not
    // be reached from the keyboard until the box was cleared.
    expect(screen.queryByRole('link', { name: 'Cash' })).not.toBeInTheDocument();
    expect(row('Synthetic Everyday')).toHaveAttribute('tabindex', '0');
  });
});

describe('Accounts list — coming back from a register', () => {
  /**
   * The whole journey, end to end: out through an account's name, back through
   * the register's own back button, and the list remembers where you were.
   *
   * The one test here that touches BOTH halves of the mechanism — the crumbs
   * this page sends, and the crumbs it reads on the way back in. The others
   * below drive the arrival directly, so a break in the outbound half cannot
   * hide behind them.
   */
  it('goes into an account and comes back to its row', async () => {
    await openList();

    fireEvent.click(nameLink('Synthetic Portfolio'));
    expect(screen.getByTestId('register-account')).toHaveTextContent(PORTFOLIO.id);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Accounts' }));

    expect(selectedRowName()).toBe('Synthetic Portfolio');
    expect(document.activeElement).toBe(row('Synthetic Portfolio'));
  });

  it('remembers a nested cash row through the same round trip', async () => {
    await openList();

    fireEvent.click(nameLink('Cash'));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Accounts' }));

    expect(selectedRowName()).toBe('Cash');
  });

  it('lands on the row that was left, selected and in view', async () => {
    // Exactly what the register's back button sends: the crumbs this page gave
    // it on the way in, handed back untouched (see navigationProvenance).
    await openList({ resume: { accountId: PORTFOLIO.id } });

    expect(selectedRowName()).toBe('Synthetic Portfolio');
    // Focused as well as marked, so the arrows carry on from there rather than
    // making the user hunt for the list with the Tab key.
    expect(document.activeElement).toBe(row('Synthetic Portfolio'));
  });

  it('scrolls the row it came back to into the middle of the view', async () => {
    const scrollIntoView = spyOnScrollIntoView();
    try {
      await openList({ resume: { accountId: PORTFOLIO.id } });

      // Centred, not merely on screen: this is the app's shared arrival
      // behaviour (useArrivalRowFocus), the same landing a chart click into a
      // report gets. A row two hundred deep is no use highlighted off-screen.
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
      expect(scrollIntoView.mock.instances[0]).toBe(row('Synthetic Portfolio'));
    } finally {
      restoreScrollIntoView();
    }
  });

  it('comes back to a nested cash row just as readily', async () => {
    await openList({ resume: { accountId: PORTFOLIO_CASH.id } });

    expect(selectedRowName()).toBe('Cash');
  });

  it('singles out nobody on an ordinary arrival', async () => {
    await openList();

    expect(selectedRowName()).toBeNull();
  });

  it('singles out nobody when the state came from another build', async () => {
    // History entries outlive a deploy. Anything unreadable is an ordinary
    // arrival — never a highlight on a row picked at random.
    await openList({ resume: { accountId: 42 } });

    expect(selectedRowName()).toBeNull();
  });
});

describe('Accounts list — a paired cash row reconciles too', () => {
  it('offers its own reconcile button, scoped to the cash account', async () => {
    await openList();

    fireEvent.click(screen.getByRole('button', { name: `Reconcile ${PORTFOLIO_CASH.name}` }));

    expect(screen.getByRole('heading', { level: 1, name: 'Reconciliation' })).toBeInTheDocument();
    // ITS id, not its parent's: reconciling the sleeve against the broker's
    // cash statement is a different job from reconciling the investment.
    expect(screen.getByTestId('reconcile-query')).toHaveTextContent(
      `?account=${PORTFOLIO_CASH.id}&from=accounts`
    );
  });

  it('leaves the parent’s reconcile button pointed at the parent', async () => {
    await openList();

    fireEvent.click(screen.getByRole('button', { name: `Reconcile ${PORTFOLIO.name}` }));

    expect(screen.getByTestId('reconcile-query')).toHaveTextContent(
      `?account=${PORTFOLIO.id}&from=accounts`
    );
  });

  it('names both buttons, so a card with two of them can be told apart', async () => {
    await openList();

    const card = row('Synthetic Portfolio');
    expect(within(card).getByRole('button', { name: 'Reconcile Synthetic Portfolio' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Reconcile Synthetic Portfolio (Cash)' })).toBeInTheDocument();
  });
});

describe('Accounts list — both rows read down the same columns', () => {
  it('renders ONE column definition, consumed by both kinds of row', async () => {
    await openList();

    const parentColumns = columnsOf(row('Synthetic Portfolio'));
    const cashColumns = columnsOf(row('Cash'));

    // Not "these two look similar" — the same string, from the same export.
    // Hand-matched widths are what let the two lines drift apart in the first
    // place, and this is the assertion that stops it happening again.
    expect(parentColumns.className).toBe(ACCOUNT_ROW_COLUMNS_CLASS);
    expect(cashColumns.className).toBe(parentColumns.className);
  });

  it('gives both rows the same nine slots, in the same order', async () => {
    await openList();

    const parentSlots = Array.from(columnsOf(row('Synthetic Portfolio')).children);
    const cashSlots = Array.from(columnsOf(row('Cash')).children);

    expect(parentSlots).toHaveLength(9);
    expect(cashSlots).toHaveLength(9);

    // Slot 8 of 9 is Reconcile on BOTH rows — which is what "the button lines
    // up under the button" means when there is no layout engine to ask.
    expect(parentSlots[7].querySelector('button')).toHaveAttribute(
      'aria-label', 'Reconcile Synthetic Portfolio'
    );
    expect(cashSlots[7].querySelector('button')).toHaveAttribute(
      'aria-label', 'Reconcile Synthetic Portfolio (Cash)'
    );
  });

  it('keeps the Bank Bal slot EMPTY on a cash row rather than dropping it', async () => {
    await openList();

    const cashRow = row('Cash');
    const cashSlots = Array.from(columnsOf(cashRow).children);

    // A cash sleeve has no feed of its own — the money arrives through the
    // investment account it belongs to — so there is no figure and no heading.
    expect(within(cashRow).queryByText('Bank Bal')).not.toBeInTheDocument();
    expect(cashSlots[0].textContent).toBe('');
    // But the column position stays: drop it and every figure after it shifts
    // one place left of its parent's, which is the whole bug.
    expect(within(cashRow).getByText('Account Bal')).toBeInTheDocument();
    expect(within(cashRow).getByText('Unreconciled')).toBeInTheDocument();
    expect(within(cashRow).getByText('To Review')).toBeInTheDocument();
  });

  it('still shows the parent card its own four figures', async () => {
    await openList();

    // The cash row joining the grid must not have cost the card anything.
    const card = columnsOf(row('Synthetic Portfolio'));
    for (const label of ['Bank Bal', 'Account Bal', 'Unreconciled', 'To Review']) {
      expect(within(card).getByText(label)).toBeInTheDocument();
    }
  });
});
