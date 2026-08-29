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
