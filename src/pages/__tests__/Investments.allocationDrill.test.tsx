import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import Investments from '../Investments';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account } from '../../types';

/**
 * THE ASSET ALLOCATION RING, AND WHAT ITS LEGEND IS FOR.
 *
 * The owner's report, 29 August, in the shape he met it: his legend named
 * four accounts and folded the remaining two into "2 smaller accounts —
 * 78.73%". His question was the right one — "at 78.73%, there are not '2
 * smaller accounts', they are the bulk of the assets?" — and the answer was
 * that the fold took the LAST two lines `buildPortfolioSummary` handed over
 * (account order), not the smallest two. His two biggest sat there.
 *
 * The same report asked for the other half: "I cannot click on any of the 5
 * legends to drill in to further detail". A named slice is an account and its
 * detail is its register; the fold is not a place, so it opens instead.
 *
 * Six synthetic accounts, round figures, the two largest deliberately LAST in
 * the array so a fold that ignores rank folds exactly the wrong pair. Totals
 * are chosen to make the shares exact: 10,000 across the six. The repo is
 * public — no real figure appears here.
 */

const account = (id: string, name: string, openingBalance: number): Account => ({
  id,
  name,
  type: 'investment',
  currency: 'GBP',
  balance: 0,
  openingBalance,
  // Dated before the harness's pinned clock (browserShims: 2025-01-20), so the
  // opening reaches the page as value rather than as a flow in the window.
  openingBalanceDate: new Date(2023, 11, 1),
  lastUpdated: new Date(2024, 0, 1),
});

const ACCOUNTS: Account[] = [
  account('acc-broker', 'Broker ISA', 1000),      // 10.00%
  account('acc-bond', 'Savings Bond', 2),         //  0.02%
  account('acc-spread', 'Spread Account', 380),   //  3.80%
  account('acc-partner', 'Partnership', 740),     //  7.40%
  account('acc-big', 'Big Pension', 4000),        // 40.00%  <- largest, LAST
  account('acc-bigger', 'Second Pension', 3878),  // 38.78%  <- and the next
];

const renderInvestments = () => {
  __setAppContextValue({
    accounts: ACCOUNTS,
    transactions: [],
    transactionSplits: [],
    categories: [],
  });
  return render(
    <MemoryRouter initialEntries={['/investments']}>
      <PreferencesProvider>
        <Investments />
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/**
 * Render the page and hand back its Asset Allocation card, so that a share
 * measured here is never a share from somewhere else on a long page.
 */
const allocationCard = async (): Promise<HTMLElement> => {
  renderInvestments();
  const heading = await screen.findByRole('heading', { name: 'Asset Allocation' });
  const card = heading.parentElement;
  if (!card) throw new Error('Asset Allocation card has no container');
  return card;
};

afterEach(() => {
  __resetAppContextValue();
});

/**
 * HOW FAR A LEGEND ROW'S RIGHT-HAND CONTENT SITS INSIDE ITS COLUMN, in pixels,
 * worked out from the row's own classes.
 *
 * jsdom lays nothing out — every box in it is 0×0 — so the owner's complaint
 * (29 August: the fold's "3.84%" out of line with the shares above it) cannot
 * be MEASURED here. What can be pinned is the arithmetic that decides it, and
 * for a block box in a column it is three lines:
 *
 *   width auto          →  inset = marginRight + paddingRight   (the box grows)
 *   width + border-box  →  inset = column - marginLeft - width + paddingRight
 *   width + content-box →  inset = column - marginLeft - paddingLeft - width
 *
 * The app's rows all bleed their hover background outwards with `px-2 -mx-2`,
 * which nets to an inset of ZERO — the text ends on the column's own edge and
 * the padding hangs outside it. A row that states `w-full` under the border-box
 * Tailwind's preflight gives everything takes that 1rem out of the ROW instead,
 * and its right-hand content lands 16px in. That was the bug, and it is why
 * the middle line above exists in this helper at all.
 *
 * The column's width cancels out of the auto case, which is what lets a row
 * inside the fold's indented container be compared with one outside it: both
 * are measured from THEIR OWN container's right edge, and those edges are the
 * same edge — indenting moves a left edge.
 */
const NOMINAL_COLUMN = 400;
const SPACING_STEP = 4;

const rightInset = (element: Element): number => {
  let marginLeft = 0;
  let marginRight = 0;
  let paddingLeft = 0;
  let paddingRight = 0;
  let width: number | null = null;
  // Tailwind's preflight puts every element in border-box; a row leaves it
  // deliberately or not at all.
  let borderBox = true;

  for (const token of element.className.split(/\s+/)) {
    // Only the classes that decide the box. Anything else — colour, display,
    // the hover state — cannot move an edge.
    if (!/^-?(?:[mp][xylrtb]?-|w-|box-)/.test(token)) continue;
    if (token === 'box-content') { borderBox = false; continue; }
    if (token === 'box-border') { borderBox = true; continue; }
    if (token === 'w-full') { width = NOMINAL_COLUMN; continue; }

    const spacing = /^(-)?([mp])([xlr])-(\d+)$/.exec(token);
    if (spacing) {
      const size = (spacing[1] ? -1 : 1) * Number(spacing[4]) * SPACING_STEP;
      const axis = spacing[3];
      if (spacing[2] === 'm') {
        if (axis !== 'r') marginLeft = size;
        if (axis !== 'l') marginRight = size;
      } else {
        if (axis !== 'r') paddingLeft = size;
        if (axis !== 'l') paddingRight = size;
      }
      continue;
    }
    // Vertical spacing moves nothing horizontally.
    if (/^-?[mp][ytb]-\d+$/.test(token)) continue;

    // A box class this helper does not model would be silently ignored, and a
    // guard that quietly stops watching is worse than none.
    throw new Error(`legend row carries a box class this test cannot resolve: ${token}`);
  }

  if (width === null) return marginRight + paddingRight;
  return borderBox
    ? NOMINAL_COLUMN - marginLeft - width + paddingRight
    : NOMINAL_COLUMN - marginLeft - paddingLeft - width;
};

/** The share at the end of a legend row — the last thing in it. */
const shareCell = (row: Element): Element => {
  const cell = row.lastElementChild;
  if (!cell) throw new Error('a legend row with nothing in it');
  return cell;
};

describe('Investments — the allocation legend’s percentages are one column', () => {
  it('lands the fold’s share on the same edge as the named accounts’', async () => {
    const card = within(await allocationCard());

    const named = card.getByRole('link', { name: /Partnership/ });
    const fold = card.getByRole('button', { name: /smaller accounts/ });

    // Zero: the column's own right edge, with the hover padding hanging
    // outside it. His fold row sat 16px in — a <button> that had to state a
    // width, stating it against the wrong box.
    expect(rightInset(named)).toBe(0);
    expect(rightInset(fold)).toBe(rightInset(named));

    // And the same treatment, or two numbers in one column would still not
    // read as one: same weight, same colour, same tabular figures.
    expect(shareCell(fold).className).toBe(shareCell(named).className);
    expect(shareCell(fold).className).toContain('tabular-nums');
  });

  it('keeps the folded accounts on that edge too when the fold opens', async () => {
    // The rows inside the fold are indented and quieter, but their shares are
    // read down the SAME column — which is also what makes the fix above
    // load-bearing rather than merely symmetrical. A row that states its width
    // against the wrong box moves away from these, not with them.
    const card = within(await allocationCard());
    fireEvent.click(card.getByRole('button', { name: /smaller accounts/ }));

    const inner = card.getByRole('link', { name: /Spread Account/ });
    const named = card.getByRole('link', { name: /Partnership/ });

    expect(rightInset(inner)).toBe(0);
    expect(rightInset(inner)).toBe(rightInset(named));
  });
});

describe('Investments — the allocation ring folds the tail, not the bulk', () => {
  it('names the four LARGEST accounts, whatever order they arrive in', async () => {
    const card = within(await allocationCard());

    // The owner's two biggest are the last two lines of the summary. Before
    // the ranking moved into capSeriesWithRemainder they had no legend row at
    // all — they were the fold.
    expect(card.getByRole('link', { name: /Big Pension/ })).toBeInTheDocument();
    expect(card.getByRole('link', { name: /Second Pension/ })).toBeInTheDocument();
    expect(card.getByRole('link', { name: /Broker ISA/ })).toBeInTheDocument();
    expect(card.getByRole('link', { name: /Partnership/ })).toBeInTheDocument();

    // And the 0.02% sliver that used to hold a row of its own is in the fold.
    expect(card.queryByRole('link', { name: /Savings Bond/ })).not.toBeInTheDocument();
  });

  it('folds two accounts that really are the smaller ones, and says their share', async () => {
    const card = within(await allocationCard());

    const fold = card.getByRole('button', { name: /smaller accounts/ });
    // 380 + 2 of 10,000. The number the reader is asked to accept as "smaller"
    // must be small; his said 78.73%.
    expect(fold).toHaveTextContent('2 smaller accounts');
    expect(fold).toHaveTextContent('3.82%');

    // Nothing named is smaller than the fold — that is what makes the word true.
    expect(card.getByRole('link', { name: /Partnership/ })).toHaveTextContent('7.40%');
  });

  it('the fold’s count and percentage describe only what is inside it', async () => {
    const card = within(await allocationCard());

    fireEvent.click(card.getByRole('button', { name: /smaller accounts/ }));

    const inside = [
      card.getByRole('link', { name: /Spread Account/ }),
      card.getByRole('link', { name: /Savings Bond/ }),
    ];
    expect(inside).toHaveLength(2); // the count the row claims
    expect(inside[0]).toHaveTextContent('3.80%');
    expect(inside[1]).toHaveTextContent('0.02%');
    // 3.80 + 0.02 = the 3.82% the fold row prints. Opening a summary may not
    // change the arithmetic it summarised.
    const sum = inside
      .map(row => Number(/(\d+\.\d\d)%/.exec(row.textContent ?? '')?.[1] ?? '0'))
      .reduce((total, share) => total + share, 0);
    expect(sum.toFixed(2)).toBe('3.82');
  });

  it('opens the fold in place and shuts it again — a summary, not a destination', async () => {
    const card = within(await allocationCard());

    const fold = card.getByRole('button', { name: /smaller accounts/ });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(card.queryByRole('link', { name: /Spread Account/ })).not.toBeInTheDocument();

    fireEvent.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    expect(card.getByRole('link', { name: /Spread Account/ })).toBeInTheDocument();

    fireEvent.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(card.queryByRole('link', { name: /Spread Account/ })).not.toBeInTheDocument();
  });

  it('every legend row is a real control — a link to a register, or the fold’s button', async () => {
    const card = within(await allocationCard());

    // Four named accounts, each a door to its own register — the same path the
    // Holdings list opens, so a register is reached the same way from both.
    expect(card.getByRole('link', { name: /Big Pension/ })).toHaveAttribute('href', '/accounts/acc-big');
    expect(card.getByRole('link', { name: /Broker ISA/ })).toHaveAttribute('href', '/accounts/acc-broker');

    fireEvent.click(card.getByRole('button', { name: /smaller accounts/ }));
    // The folded ones are doors too: opening the fold is not a dead end.
    expect(card.getByRole('link', { name: /Savings Bond/ })).toHaveAttribute('href', '/accounts/acc-bond');
  });
});
