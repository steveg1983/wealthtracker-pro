import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import Investments from '../Investments';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Category, Transaction } from '../../types';

/**
 * The Investments page over an investment↔cash PAIR (the Microsoft Money
 * model). Synthetic accounts and round figures — this repo is public.
 *
 * Fund ISA: £1,000 opening, £500 in from the current account, £200 moved to
 * its own cash side. Its cash account holds that £200. The pair is therefore
 * worth £1,500, of which £500 was put in from outside.
 */

const ISA = 'acc-isa';
const ISA_CASH = 'acc-isa-cash';
const EVERYDAY = 'acc-everyday';

const account = (overrides: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account => ({
  currency: 'GBP',
  balance: 0,
  lastUpdated: new Date(2026, 0, 1),
  openingBalance: 0,
  ...overrides,
});

const txn = (overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'accountId' | 'amount'>): Transaction => ({
  // BEFORE the harness's pinned clock (browserShims sets 2025-01-20) and
  // inside the default 12-month window — the tiles are WINDOWED now, and a
  // fixture dated after the clock honestly reads as an empty window.
  date: new Date(2024, 5, 10),
  description: 'Movement',
  category: '',
  type: 'transfer',
  ...overrides,
});

const accounts: Account[] = [
  // The opening is DATED, before the default window: it reaches the tiles as
  // starting value, never as a window flow — the owner's opening-balance rule.
  account({ id: ISA, name: 'Fund ISA', type: 'investment', institution: 'Sample Brokers', openingBalance: 1000, openingBalanceDate: new Date(2023, 11, 1) }),
  account({ id: ISA_CASH, name: 'Fund ISA (Cash)', type: 'current', parentAccountId: ISA }),
  account({ id: EVERYDAY, name: 'Everyday Account', type: 'current', openingBalance: 5000 }),
];

const transactions: Transaction[] = [
  txn({ id: 't-in-isa', accountId: ISA, amount: 500, linkedTransferId: 't-in-everyday' }),
  txn({ id: 't-in-everyday', accountId: EVERYDAY, amount: -500, linkedTransferId: 't-in-isa' }),
  txn({ id: 't-internal-out', accountId: ISA, amount: -200, linkedTransferId: 't-internal-in' }),
  txn({ id: 't-internal-in', accountId: ISA_CASH, amount: 200, linkedTransferId: 't-internal-out' }),
];

const categories: Category[] = [
  { id: 'tofrom-everyday', name: 'To/From Everyday Account', type: 'both', level: 'detail', isTransferCategory: true, accountId: EVERYDAY },
];

const renderInvestments = (overrides: { transactions?: Transaction[]; accounts?: Account[] } = {}) => {
  __setAppContextValue({
    accounts: overrides.accounts ?? accounts,
    transactions: overrides.transactions ?? transactions,
    transactionSplits: [],
    categories,
  });
  return render(
    <MemoryRouter initialEntries={['/investments']}>
      <PreferencesProvider>
        <Investments />
      </PreferencesProvider>
    </MemoryRouter>
  );
};

afterEach(() => {
  __resetAppContextValue();
});

describe('Investments page — the pair is the portfolio', () => {
  it('values a holding at the investment account plus its nested cash', async () => {
    renderInvestments();

    // £1,300 in the fund and £200 in its cash: the tile and the holding row
    // both say £1,500 — and since the tiles went windowed, the return
    // band's Ended at is the third voice of the same walk.
    expect(await screen.findAllByText('£1,500.00')).toHaveLength(3);

    /*
     * The £1,300 IS shown now, and that is a ruling change, not a leak. This
     * assertion used to be `.not.toBeInTheDocument()` — the fund's own figure
     * was never printed, only the pair's total. The owner's 16 August spec
     * asks for the opposite: each row itemises "Investments" and "Cash", and
     * the two must sum to the total above them, a check the reader can do by
     * eye. So the figure appears exactly once, labelled, beside the £200 that
     * completes it.
     */
    // The itemised line, not the page title: both say "Investments", so the
    // label is read from the same container as its figure. TWO occurrences
    // since 22 Aug — the itemised line, and the cash-only card's section
    // row — and each must sit beside its own "Investments" label.
    const investedFigures = screen.getAllByText('£1,300.00');
    expect(investedFigures).toHaveLength(2);
    investedFigures.forEach(figure => {
      // The itemised line is a <p>; the section row is a justify-between div
      // whose label sits in a sibling span — either way, the figure's own
      // row must name what it is.
      expect(figure.closest('p, [class*="justify-between"]')?.textContent).toContain('Investments');
    });
  });

  it('shows the nested cash inside the holding, not as a holding of its own', async () => {
    renderInvestments();

    expect(await screen.findByRole('heading', { level: 3, name: 'Fund ISA' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Fund ISA (Cash)' })).not.toBeInTheDocument();

    // Sub-line under the row: the importer's "<Name> (Cash)" reads as 'Cash'.
    // Scoped to the Holdings list because "Allocation by holding" (added 15
    // August) has a Cash slice of its own — a second, deliberate use of the
    // word on this page, and a page-wide getByText can no longer tell them
    // apart. Asserting on the one this test is about, not on there being one.
    const holdingsPanel = screen.getByRole('heading', { name: 'Holdings' }).closest('div');
    expect(holdingsPanel).not.toBeNull();
    expect(within(holdingsPanel as HTMLElement).getByText('Cash')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('£200.00')).toBeInTheDocument();
  });

  it('counts the whole portfolio once, at 100% allocation', async () => {
    renderInvestments();

    // TWO since 22 August, not three: the fixture holds no securities, and a
    // cash-only "Allocation by holding" is now a SENTENCE rather than a
    // one-slice ring (Claude Design §4 — "a donut divides a whole into parts;
    // with one part there is nothing to divide"). The account ring and the
    // account's own row keep their 100%; the sentence is asserted below in
    // its own words. The count is still the point (nothing double-counted),
    // so it moves with the page rather than being loosened.
    expect(await screen.findAllByText('100.00%')).toHaveLength(2);
    // REVISED 22 Aug (owner): the cash-only card shows the TWO SECTION
    // totals — investments against settlement cash, sharing out the
    // portfolio — rather than a sentence naming a figure the reader could
    // not square with the Portfolio Value. £1,300 + £200 = £1,500 here, so
    // the shares are 86.67% and 13.33%, summing to 100%.
    expect(
      screen.getByText(/No individual securities are recorded in these accounts/)
    ).toBeInTheDocument();
    expect(screen.getByText('86.67%')).toBeInTheDocument();
    expect(screen.getByText('13.33%')).toBeInTheDocument();
    expect(screen.getByText(/Together they are the portfolio’s/)).toBeInTheDocument();
  });
});

describe('Investments page — contributions and return', () => {
  it('counts money in from outside and ignores moves within the pair', async () => {
    renderInvestments();

    // £500 in from the current account. The £200 shuffled into the pair's own
    // cash side is not a contribution in either direction.
    expect(await screen.findByText('Net Contributions')).toBeInTheDocument();
    // The tile and the return band's Put in — same figure, same maths.
    expect(screen.getAllByText('£500.00')).toHaveLength(2);
    // OVERRULED with the windowed tiles: the old maths called £1,000 the
    // "return" — but that was the OPENING BALANCE, capital mistaken for
    // growth. Nothing in this fixture grew; the honest gain is zero.
    expect(screen.queryByText('+£1,000.00')).not.toBeInTheDocument();
    // RE-PINNED 22 Aug (Claude Design §1/§2's zero rule reaching this tile):
    // a zero gain is NEUTRAL — no plus sign, no green, no arrow. £0.00 is a
    // fact, not good news.
    expect(screen.queryByText('+£0.00')).not.toBeInTheDocument();
    const returnTile = screen.getByText('Total Return').closest('button');
    expect(returnTile).not.toBeNull();
    expect(within(returnTile as HTMLElement).getByText('£0.00')).toBeInTheDocument();
    // OVERRULED 20 Aug: the tile no longer prints gain-over-net-contributions
    // (+200.00% here) — that ratio turns absurd the moment withdrawals bring
    // the net near zero. The words-pin for the new measure has its own spec.
    expect(screen.queryByText('+200.00%')).not.toBeInTheDocument();
  });

  it('shows the money-weighted rate for the window, annualised — never gain-over-net-contributions', async () => {
    renderInvestments();

    expect(await screen.findByText('Money-weighted, annualised')).toBeInTheDocument();
    expect(screen.queryByText('+200.00%')).not.toBeInTheDocument();
  });

  it('says nothing about unmatched transfers when every transfer is matched', async () => {
    renderInvestments();

    await screen.findByText('Net Contributions');
    expect(screen.queryByText(/no matching row in another account/)).not.toBeInTheDocument();
  });

  it('discloses what an unmatched transfer does to the figures', async () => {
    // The other half of the internal move is gone, so its £200 leg now looks
    // like money leaving the portfolio.
    renderInvestments({
      transactions: transactions
        .filter(t => t.id !== 't-internal-in')
        .map(t => (t.id === 't-internal-out' ? { ...t, linkedTransferId: undefined } : t)),
    });

    expect(await screen.findByText(/no matching row in another account/)).toBeInTheDocument();
  });

  it('refuses to state a return percentage when nothing was ever in the window', async () => {
    // No rows AND no dated opening: an opening predating the window would be
    // capital at work, and 0.00% — not a refusal — would be the honest tile.
    renderInvestments({
      transactions: [],
      accounts: accounts.map(a => ({ ...a, openingBalance: 0, openingBalanceDate: undefined })),
    });

    expect((await screen.findAllByText('—')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Nothing was invested in this window, so there is no return to measure')).toBeInTheDocument();
  });
});
