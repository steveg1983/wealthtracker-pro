import { describe, it, expect } from 'vitest';
import { buildPortfolioSummary, buildPortfolioHistory } from './portfolioSummary';
import { buildNetWorthConversion } from './netWorthSeries';
import { toDecimal } from './decimal';
import type { Account, Category, Transaction, TransactionSplit } from '../types';

/**
 * Synthetic accounts and round figures throughout — this repo is public.
 *
 * The shape under test is the Microsoft Money pair: an investment account with
 * a cash account nested inside it, money arriving from an ordinary current
 * account outside the pair, and money moving between the pair's own two sides.
 */

const ISA = 'acc-isa';
const ISA_CASH = 'acc-isa-cash';
const PENSION = 'acc-pension';
const EVERYDAY = 'acc-everyday';

function account(overrides: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account {
  return {
    currency: 'GBP',
    // Deliberately wrong: every figure must come from the ledger (opening
    // balance + transactions), never from this cached column.
    balance: -999_999,
    lastUpdated: new Date('2026-01-01'),
    openingBalance: 0,
    ...overrides,
  };
}

function txn(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'accountId' | 'amount'>): Transaction {
  return {
    date: new Date('2026-03-10'),
    description: 'Movement',
    category: '',
    type: 'transfer',
    ...overrides,
  };
}

const accounts: Account[] = [
  account({ id: ISA, name: 'Fund ISA', type: 'investment', institution: 'Sample Brokers', openingBalance: 1000 }),
  account({ id: ISA_CASH, name: 'Fund ISA (Cash)', type: 'current', parentAccountId: ISA, openingBalance: 0 }),
  account({ id: PENSION, name: 'Workplace Pension', type: 'investment', openingBalance: 2000 }),
  account({ id: EVERYDAY, name: 'Everyday Account', type: 'current', openingBalance: 5000 }),
];

const categories: Category[] = [
  { id: 'cat-dividends', name: 'Dividends', type: 'income', level: 'detail' },
  { id: 'tofrom-isa-cash', name: 'To/From Fund ISA (Cash)', type: 'both', level: 'detail', isTransferCategory: true, accountId: ISA_CASH },
  { id: 'tofrom-everyday', name: 'To/From Everyday Account', type: 'both', level: 'detail', isTransferCategory: true, accountId: EVERYDAY },
];

/**
 * £500 in from outside the pair, £200 moved from the fund into its own cash,
 * £30 of dividends, £100 back out to the current account.
 */
const transactions: Transaction[] = [
  txn({ id: 't-in-isa', accountId: ISA, amount: 500, linkedTransferId: 't-in-everyday' }),
  txn({ id: 't-in-everyday', accountId: EVERYDAY, amount: -500, linkedTransferId: 't-in-isa' }),
  txn({ id: 't-internal-out', accountId: ISA, amount: -200, linkedTransferId: 't-internal-in' }),
  txn({ id: 't-internal-in', accountId: ISA_CASH, amount: 200, linkedTransferId: 't-internal-out' }),
  txn({ id: 't-dividend', accountId: ISA_CASH, amount: 30, type: 'income', category: 'cat-dividends' }),
  txn({ id: 't-out-isa-cash', accountId: ISA_CASH, amount: -100, linkedTransferId: 't-out-everyday' }),
  txn({ id: 't-out-everyday', accountId: EVERYDAY, amount: 100, linkedTransferId: 't-out-isa-cash' }),
];

const summaryOf = (
  overrides: Partial<Parameters<typeof buildPortfolioSummary>[0]> = {}
) => buildPortfolioSummary({
  accounts,
  transactions,
  transactionSplits: [],
  categories,
  ...overrides,
});

describe('buildPortfolioSummary — what the portfolio is worth', () => {
  it('counts the nested cash inside the investment account it belongs to', () => {
    const summary = summaryOf();
    const isa = summary.lines.find(line => line.accountId === ISA);

    // Fund: 1000 opening + 500 in − 200 to its own cash = 1300.
    // Cash: 200 in + 30 dividends − 100 out = 130. One holding worth 1430.
    expect(isa?.value.toNumber()).toBe(1430);
    expect(isa?.cash.map(c => [c.label, c.value.toNumber()])).toEqual([['Cash', 130]]);
  });

  it('shortens the importer\'s "<Name> (Cash)" to just Cash, and leaves other names alone', () => {
    const renamed = accounts.map(a =>
      a.id === ISA_CASH ? { ...a, name: 'Settlement Account' } : a
    );

    const isa = summaryOf({ accounts: renamed }).lines.find(line => line.accountId === ISA);

    expect(isa?.cash.map(c => c.label)).toEqual(['Settlement Account']);
  });

  it('gives the nested account no line of its own, so nothing is counted twice', () => {
    const summary = summaryOf();

    expect(summary.lines.map(line => line.accountId)).toEqual([ISA, PENSION]);
    expect(summary.value.toNumber()).toBe(1430 + 2000);
  });

  it('still counts a paired account once when it is retyped as an investment', () => {
    const retyped = accounts.map(a =>
      a.id === ISA_CASH ? { ...a, type: 'investment' as const } : a
    );

    const summary = summaryOf({ accounts: retyped });

    expect(summary.lines.map(line => line.accountId)).toEqual([ISA, PENSION]);
    expect(summary.value.toNumber()).toBe(1430 + 2000);
  });

  it('ignores the cached balance column entirely', () => {
    // Every account carries a nonsense `balance`; a value built from it would
    // be hugely negative.
    expect(summaryOf().value.isPositive()).toBe(true);
  });

  it('allocates each line its share of the whole', () => {
    const allocations = summaryOf().lines.map(line => line.allocation.toNumber());

    expect(allocations[0]).toBeCloseTo((1430 / 3430) * 100, 10);
    expect(allocations[1]).toBeCloseTo((2000 / 3430) * 100, 10);
    expect(allocations.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it('reports zero allocation rather than dividing by nothing', () => {
    const empty = accounts.map(a => ({ ...a, openingBalance: 0 }));

    const summary = summaryOf({ accounts: empty, transactions: [] });

    expect(summary.value.toNumber()).toBe(0);
    expect(summary.lines.every(line => line.allocation.isZero())).toBe(true);
  });
});

describe('buildPortfolioSummary — net external contributions', () => {
  it('counts transfers in from outside and subtracts transfers back out', () => {
    // 500 in − 100 out. The 200 between the fund and its own cash is not a
    // contribution at all, in either direction.
    expect(summaryOf().netContributions.toNumber()).toBe(400);
  });

  it('splits contributions and return per line, and the lines SUM to the totals', () => {
    /*
     * The drill-down's whole guarantee (owner, 16 August): the per-account
     * rows a tile opens into must add up to the tile, exactly. The split is
     * accumulated in the same loop as the totals — one classification, two
     * aggregations — and this is the assertion that keeps it that way.
     */
    const summary = summaryOf();

    const contributionsSum = summary.lines.reduce(
      (t, line) => t.plus(line.netContributions), summary.netContributions.minus(summary.netContributions)
    );
    const returnSum = summary.lines.reduce(
      (t, line) => t.plus(line.totalReturn), summary.totalReturn.minus(summary.totalReturn)
    );

    expect(contributionsSum.toNumber()).toBe(summary.netContributions.toNumber());
    expect(returnSum.toNumber()).toBe(summary.totalReturn.toNumber());
    // And per line, the identity the tile states for the whole portfolio:
    for (const line of summary.lines) {
      expect(line.totalReturn.toNumber()).toBe(line.value.minus(line.netContributions).toNumber());
    }
  });

  it('excludes an internal move filed only under the other side\'s transfer category', () => {
    const filed = transactions.map(t =>
      t.id === 't-internal-out'
        ? { ...t, linkedTransferId: undefined, category: 'tofrom-isa-cash' }
        : t
    );

    expect(summaryOf({ transactions: filed }).netContributions.toNumber()).toBe(400);
  });

  it('counts a transfer named by category alone when the named account is outside', () => {
    const filed = transactions.map(t =>
      t.id === 't-out-isa-cash'
        ? { ...t, linkedTransferId: undefined, category: 'tofrom-everyday' }
        : t
    );

    const summary = summaryOf({ transactions: filed });

    expect(summary.netContributions.toNumber()).toBe(400);
    expect(summary.unattributedTransfers.count).toBe(0);
  });

  it('resolves the other side from the denormalised account id when the link is missing', () => {
    const denormalised = transactions.map(t =>
      t.id === 't-internal-in'
        ? { ...t, linkedTransferId: undefined, transferAccountId: ISA }
        : t
    );

    expect(summaryOf({ transactions: denormalised }).netContributions.toNumber()).toBe(400);
  });

  it('leaves dividends, fees and other non-transfers out of contributions', () => {
    const summary = summaryOf();

    // The £30 dividend is in the value but not in what was put in, which is
    // exactly what makes it show up as return.
    expect(summary.netContributions.toNumber()).toBe(400);
    expect(summary.totalReturn.toNumber()).toBe(3430 - 400);
  });

  it('counts an unattributable transfer as external, and says how much rests on that', () => {
    const stranded = transactions
      .filter(t => t.id !== 't-internal-in')
      .map(t => (t.id === 't-internal-out' ? { ...t, linkedTransferId: undefined } : t));

    const summary = summaryOf({ transactions: stranded });

    // The £200 leg now looks like money leaving the portfolio.
    expect(summary.netContributions.toNumber()).toBe(200);
    expect(summary.unattributedTransfers).toEqual(
      expect.objectContaining({ count: 1 })
    );
    expect(summary.unattributedTransfers.amount.toNumber()).toBe(200);
  });

  it('classifies a transfer leg that is one line of a split', () => {
    // £300 out of the cash side: £50 of charges and a £250 transfer out to the
    // current account. Only the second line is a contribution (a negative one).
    const parent = txn({
      id: 't-split',
      accountId: ISA_CASH,
      amount: -300,
      type: 'expense',
      isSplit: true,
    });
    const splits: TransactionSplit[] = [
      { id: 's-1', transactionId: 't-split', category: 'cat-dividends', amount: -50, sortOrder: 0 },
      { id: 's-2', transactionId: 't-split', category: 'tofrom-everyday', amount: -250, sortOrder: 1 },
    ];

    const summary = summaryOf({
      transactions: [...transactions, parent],
      transactionSplits: splits,
    });

    expect(summary.netContributions.toNumber()).toBe(150);
    expect(summary.unattributedTransfers.count).toBe(0);
  });

  it('leaves a split line that moves money within the pair out of contributions', () => {
    const parent = txn({
      id: 't-split-internal',
      accountId: ISA,
      amount: -300,
      type: 'expense',
      isSplit: true,
    });
    const splits: TransactionSplit[] = [
      { id: 's-3', transactionId: 't-split-internal', category: 'cat-dividends', amount: -50, sortOrder: 0 },
      { id: 's-4', transactionId: 't-split-internal', category: 'tofrom-isa-cash', amount: -250, sortOrder: 1 },
    ];

    const summary = summaryOf({
      transactions: [...transactions, parent],
      transactionSplits: splits,
    });

    expect(summary.netContributions.toNumber()).toBe(400);
    expect(summary.unattributedTransfers.count).toBe(0);
  });

  it('measures return against contributions, and refuses to when there were none', () => {
    const summary = summaryOf();
    expect(summary.returnPercent?.toNumber()).toBeCloseTo(((3430 - 400) / 400) * 100, 10);

    const noContributions = summaryOf({ transactions: [] });
    expect(noContributions.netContributions.toNumber()).toBe(0);
    expect(noContributions.returnPercent).toBeNull();
  });
});

describe('buildPortfolioHistory', () => {
  /**
   * A series that can be worked out by hand, so a fabricated one cannot pass:
   * an opening balance dated the day the account opened, two transactions, and
   * a month with no activity at all — which must repeat the previous month's
   * figure exactly rather than drift towards today's value.
   */
  // Local-time constructors throughout: an ISO string is parsed as UTC, which
  // would move a month boundary by an hour on a machine that is not on it.
  const historyAccounts: Account[] = [
    account({
      id: ISA,
      name: 'Fund ISA',
      type: 'investment',
      openingBalance: 1000,
      openingBalanceDate: new Date(2026, 0, 5),
    }),
    account({
      id: ISA_CASH,
      name: 'Fund ISA (Cash)',
      type: 'current',
      parentAccountId: ISA,
      openingBalance: 0,
      openingBalanceDate: new Date(2026, 0, 5),
    }),
  ];

  const historyTransactions: Transaction[] = [
    txn({ id: 'h-1', accountId: ISA, amount: 500, date: new Date(2026, 1, 10) }),
    txn({ id: 'h-2', accountId: ISA_CASH, amount: 250, date: new Date(2026, 3, 20) }),
    // Another account's money must never reach the portfolio's series.
    txn({ id: 'h-outside', accountId: EVERYDAY, amount: 9000, date: new Date(2026, 2, 1) }),
  ];

  it('is the accounts\' own balance history, month by month', () => {
    const points = buildPortfolioHistory(
      historyAccounts,
      historyTransactions,
      { from: new Date(2026, 0, 1), to: new Date(2026, 5, 15) }
    );

    expect(points.map(p => p.value)).toEqual([
      1000, // Jan: opening balance only
      1500, // Feb: +500
      1500, // Mar: nothing happened — no growth is invented
      1750, // Apr: +250 into the cash side
      1750, // May
      1750, // Jun
    ]);
  });

  it('carries an opening balance from its own date, not from the beginning of time', () => {
    const points = buildPortfolioHistory(
      historyAccounts,
      historyTransactions,
      { from: new Date(2025, 10, 1), to: new Date(2026, 1, 28) }
    );

    expect(points[0].value).toBe(0);
    expect(points[points.length - 1].value).toBe(1500);
  });

  it('ends at today\'s portfolio value', () => {
    const points = buildPortfolioHistory(
      historyAccounts,
      historyTransactions,
      { from: null, to: null },
      new Date(2026, 5, 30)
    );

    const summary = buildPortfolioSummary({
      accounts: historyAccounts,
      transactions: historyTransactions,
      transactionSplits: [],
      categories,
    });

    expect(points[points.length - 1].value).toBe(summary.value.toNumber());
  });

  it('has nothing to draw when no account is paired into a portfolio', () => {
    expect(buildPortfolioHistory([], historyTransactions, { from: null, to: null })).toEqual([]);
  });

  it('converts a foreign member at the summing, exactly as the net-worth walk does', () => {
    // Currency audit, 22 Aug: this was the ONE caller of buildNetWorthSnapshots
    // that kept summing a dollar sleeve's native units as pounds after the walk
    // learned to convert. Every figure here is invented; the repo is public.
    const dollarSleeve = account({
      id: ISA_CASH,
      name: 'Fund ISA ($ Cash)',
      type: 'current',
      parentAccountId: ISA,
      currency: 'USD',
      openingBalance: 200,
      openingBalanceDate: new Date(2026, 0, 5),
    });
    const members = [historyAccounts[0], dollarSleeve];
    const conversion = buildNetWorthConversion(members, { GBP: 1, USD: 2 }, 'GBP');

    // The last point, because a short window walks daily and its first point
    // can predate the 5 January openings.
    const converted = buildPortfolioHistory(
      members, [], { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) },
      new Date(2026, 5, 30), conversion
    );
    // $200 at two-to-one joins as £100 beside the sterling side's 1000.
    expect(converted[converted.length - 1].value).toBe(1100);

    // Omitted, the walk behaves exactly as it always has — native units.
    const native = buildPortfolioHistory(
      members, [], { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) },
      new Date(2026, 5, 30)
    );
    expect(native[native.length - 1].value).toBe(1200);
  });
});

/**
 * THE CURRENCY SEAMS (the Investments chain, 23 Aug): value converts at
 * TODAY's factors — it is a current balance — and each contribution at its
 * own date's factor, so total return is today's worth less the pounds
 * actually put in. Every figure here is invented; the repo is public.
 */
describe('buildPortfolioSummary — the currency seams', () => {
  const usdRoot = account({
    id: 'inv-usd', name: 'Dollar Fund', type: 'investment',
    currency: 'USD', openingBalance: 0, openingBalanceDate: new Date(2026, 0, 5),
  });
  const funding = {
    id: 'c-1', accountId: 'inv-usd', date: new Date(2026, 0, 10), amount: 1000,
    description: 'funding', category: 'tofrom-outside', type: 'transfer' as const,
    transferAccountId: 'acc-outside',
  };

  it('values at today\'s factors, converts each contribution at its own date, and flags the ≈', () => {
    const summary = buildPortfolioSummary({
      accounts: [usdRoot],
      transactions: [funding],
      transactionSplits: [],
      categories,
      // Today: four dollars to the pound. The January contribution: two.
      conversion: buildNetWorthConversion([usdRoot], { GBP: 1, USD: 4 }, 'GBP'),
      flowConvert: () => toDecimal(0.5),
    });
    expect(summary.value.toNumber()).toBe(250);            // $1,000 at £0.25
    expect(summary.netContributions.toNumber()).toBe(500); // $1,000 at £0.50, when it moved
    expect(summary.totalReturn.toNumber()).toBe(-250);     // the currency's doing — return, honestly
    expect(summary.holdsForeign).toBe(true);
  });

  it('without the seams the figures are native and unflagged — unchanged behaviour', () => {
    const summary = buildPortfolioSummary({
      accounts: [usdRoot],
      transactions: [funding],
      transactionSplits: [],
      categories,
    });
    expect(summary.value.toNumber()).toBe(1000);
    expect(summary.holdsForeign).toBe(false);
  });
});
