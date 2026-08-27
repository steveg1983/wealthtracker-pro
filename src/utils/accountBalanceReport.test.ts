import { describe, it, expect } from 'vitest';
import { buildAccountBalanceReport, movedSideLabel, sideOfType } from './accountBalanceReport';
import { toDecimal } from './decimal';
import type { Account, Transaction } from '../types';

/** Synthetic fixtures only — no real accounts or amounts in this repo. */
const account = (over: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account => ({
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date(2026, 0, 1),
  openingBalance: 0,
  ...over,
});

const txn = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'date' | 'accountId'>): Transaction => ({
  description: 'synthetic row',
  category: 'cat-x',
  type: 'expense',
  ...over,
});

const ACCOUNTS: Account[] = [
  account({ id: 'acc-current', name: 'Test Current', type: 'current', openingBalance: 100 }),
  account({ id: 'acc-card', name: 'Test Card', type: 'credit', openingBalance: 0 }),
];

const RANGE = { from: new Date(2026, 1, 1), to: new Date(2026, 1, 28, 23, 59, 59, 999) };

describe('buildAccountBalanceReport', () => {
  it('separates history before the period from movement inside it', () => {
    const report = buildAccountBalanceReport(
      ACCOUNTS,
      [
        txn({ id: 'b1', amount: 50, date: new Date(2026, 0, 15), accountId: 'acc-current', type: 'income' }),
        txn({ id: 'i1', amount: -30, date: new Date(2026, 1, 10), accountId: 'acc-current' }),
        txn({ id: 'i2', amount: 20, date: new Date(2026, 1, 12), accountId: 'acc-current', type: 'income' }),
        // After the window — not this report's business.
        txn({ id: 'a1', amount: -999, date: new Date(2026, 2, 1), accountId: 'acc-current' }),
      ],
      RANGE
    );

    const row = report.rows.find(r => r.accountId === 'acc-current');
    expect(row).toMatchObject({
      opening: 150,
      moneyIn: 20,
      moneyOut: 30,
      change: -10,
      closing: 140,
      count: 2,
    });
  });

  it('reads the whole history as the period when the window is open-started', () => {
    const report = buildAccountBalanceReport(
      ACCOUNTS,
      [txn({ id: 'b1', amount: 50, date: new Date(2026, 0, 15), accountId: 'acc-current', type: 'income' })],
      { from: null, to: null },
      new Date(2026, 1, 20)
    );

    const row = report.rows.find(r => r.accountId === 'acc-current');
    expect(row).toMatchObject({ opening: 100, moneyIn: 50, closing: 150, count: 1 });
  });

  it('counts a negative balance as a liability whatever the account type says', () => {
    const report = buildAccountBalanceReport(
      ACCOUNTS,
      [txn({ id: 'i1', amount: -60, date: new Date(2026, 1, 10), accountId: 'acc-card' })],
      RANGE
    );

    expect(report.assets).toBe(100);
    expect(report.liabilities).toBe(60);
    expect(report.netWorth).toBe(40);
    expect(report.openingNetWorth).toBe(100);
    expect(report.change).toBe(-60);
  });

  it('groups accounts by type in statement order, with subtotals', () => {
    const report = buildAccountBalanceReport(
      [
        ...ACCOUNTS,
        account({ id: 'acc-savings', name: 'Test Savings', type: 'savings', openingBalance: 500 }),
      ],
      [],
      RANGE
    );

    expect(report.groups.map(g => g.label)).toEqual(['Current accounts', 'Savings', 'Credit cards']);
    expect(report.groups[1]).toMatchObject({ closing: 500, change: 0 });
  });

  it('ignores transactions belonging to accounts outside the report', () => {
    const report = buildAccountBalanceReport(
      ACCOUNTS,
      [txn({ id: 'x1', amount: -999, date: new Date(2026, 1, 10), accountId: 'acc-deleted' })],
      RANGE
    );

    expect(report.netWorth).toBe(100);
    expect(report.rows.every(r => r.count === 0)).toBe(true);
  });

  it('keeps decimals exact over many small movements', () => {
    const report = buildAccountBalanceReport(
      [account({ id: 'acc-current', name: 'Test Current', type: 'current', openingBalance: 0 })],
      Array.from({ length: 10 }, (_, i) =>
        txn({ id: `t${i}`, amount: -0.1, date: new Date(2026, 1, 2 + i), accountId: 'acc-current' })
      ),
      RANGE
    );

    expect(report.rows[0].moneyOut).toBe(1);
    expect(report.rows[0].closing).toBe(-1);
  });

  it('states the closing date as the end of the window', () => {
    const report = buildAccountBalanceReport(ACCOUNTS, [], RANGE);
    expect(report.asOf).toEqual(RANGE.to);

    const now = new Date(2026, 5, 6);
    expect(buildAccountBalanceReport(ACCOUNTS, [], { from: null, to: null }, now).asOf).toEqual(now);
  });

  it('an opening balance effective before the window sits in the opening column', () => {
    const report = buildAccountBalanceReport(
      [account({ id: 'acc-x', name: 'Opened Earlier', type: 'current', openingBalance: 1000, openingBalanceDate: new Date(2026, 0, 1) })],
      [],
      RANGE
    );
    const row = report.rows.find(r => r.accountId === 'acc-x');
    expect(row).toMatchObject({ opening: 1000, moneyIn: 0, moneyOut: 0, closing: 1000, count: 0 });
    expect(report.openingNetWorth).toBe(1000);
  });

  it('an opening balance that only becomes effective inside the window is period movement, not opening', () => {
    // The account did not exist at the window start, so its opening net worth is
    // 0 — the lump appears as money coming in during the period.
    const report = buildAccountBalanceReport(
      [account({ id: 'acc-x', name: 'Opened Mid', type: 'current', openingBalance: 1000, openingBalanceDate: new Date(2026, 1, 10) })],
      [],
      RANGE
    );
    const row = report.rows.find(r => r.accountId === 'acc-x');
    expect(row).toMatchObject({ opening: 0, moneyIn: 1000, moneyOut: 0, change: 1000, closing: 1000 });
    expect(report.openingNetWorth).toBe(0);
    expect(report.netWorth).toBe(1000);
    expect(report.change).toBe(1000);
  });

  it('an opening balance not yet effective by the as-of date contributes nothing', () => {
    const report = buildAccountBalanceReport(
      [account({ id: 'acc-x', name: 'Opened Later', type: 'current', openingBalance: 1000, openingBalanceDate: new Date(2026, 2, 15) })],
      [],
      RANGE
    );
    const row = report.rows.find(r => r.accountId === 'acc-x');
    expect(row).toMatchObject({ opening: 0, moneyIn: 0, closing: 0 });
    expect(report.netWorth).toBe(0);
  });

  it('a negative opening balance appearing inside the window counts as money out', () => {
    const report = buildAccountBalanceReport(
      [account({ id: 'acc-card', name: 'New Card', type: 'credit', openingBalance: -200, openingBalanceDate: new Date(2026, 1, 10) })],
      [],
      RANGE
    );
    const row = report.rows.find(r => r.accountId === 'acc-card');
    expect(row).toMatchObject({ opening: 0, moneyIn: 0, moneyOut: 200, change: -200, closing: -200 });
    expect(report.liabilities).toBe(200);
  });
});

/**
 * THE DATED CONVERSION SEAM (balance reports, 23 Aug): the table's contract
 * is the accounting identity — opening + change = closing — so every column
 * converts on the identity's own terms: each movement at its own day's rate,
 * the opening column at the day the window opens. Rows stay native; only
 * the totals wear the converted figures.
 * Every figure here is invented; the repo is public.
 */
describe('buildAccountBalanceReport — the dated conversion seam', () => {
  const usd = account({ id: 'acc-usd', name: 'Dollar Current', type: 'current', currency: 'USD' });
  // Two dollars to the pound in January, four from February on.
  const conversionAt = (date: Date) => ({
    factors: new Map([['acc-usd', toDecimal(date < new Date(2026, 1, 1) ? 0.5 : 0.25)]]),
    unconverted: [] as string[],
  });
  const rows: Transaction[] = [
    txn({ id: 'pre', accountId: 'acc-usd', amount: 1000, date: new Date(2026, 0, 10) }),   // pre-window
    txn({ id: 'in', accountId: 'acc-usd', amount: 400, date: new Date(2026, 1, 10) }),     // in-window
  ];
  const range = { from: new Date(2026, 1, 1), to: new Date(2026, 1, 28) };

  it('converts each column at its basis and keeps the identity in the totals', () => {
    const report = buildAccountBalanceReport([usd], rows, range, new Date(2026, 2, 1), conversionAt);
    const row = report.rows[0];
    // The row itself stays native, in its own currency.
    expect(row.opening).toBe(1000);
    expect(row.closing).toBe(1400);
    // Opening at the window's opening day (31 Jan → £0.50/$): $1,000 = £500.
    expect(row.openingConverted).toBe(500);
    // The February movement at its own day (£0.25/$): $400 = £100.
    expect(row.changeConverted).toBe(100);
    // The identity holds in the converted figures the totals show.
    expect(row.closingConverted).toBe(600);
    expect(report.netWorth).toBe(600);
    expect(report.openingNetWorth).toBe(500);
    expect(report.holdsForeign).toBe(true);
  });

  it('without the seam every figure is native and unflagged — unchanged behaviour', () => {
    const report = buildAccountBalanceReport([usd], rows, range);
    expect(report.rows[0].closingConverted).toBe(1400);
    expect(report.netWorth).toBe(1400);
    expect(report.holdsForeign).toBe(false);
  });
});

describe('the closing snapshot basis (one-net-worth ruling, 24 Aug §1)', () => {
  // Every figure and rate below is invented; the repo is public.
  const FOREIGN_ACCOUNTS: Account[] = [
    account({ id: 'acc-gbp', name: 'Test Sterling', type: 'current', openingBalance: 100 }),
    account({ id: 'acc-usd', name: 'Test Dollar', type: 'savings', currency: 'USD', openingBalance: 0 }),
  ];
  const MOVES: Transaction[] = [
    txn({ id: 'u1', amount: 300, date: new Date(2026, 1, 10), accountId: 'acc-usd', type: 'income' }),
  ];
  const factors = (usdPerDisplay: number) => ({
    factors: new Map([['acc-usd', toDecimal(usdPerDisplay)]]),
    unconverted: [] as string[],
  });
  /** Movements convert at a per-day factor of 0.5 whatever the day. */
  const perDay = () => factors(0.5);

  it('values the converted closing at the snapshot factors, never the identity construction', () => {
    const report = buildAccountBalanceReport(
      FOREIGN_ACCOUNTS, MOVES, RANGE, new Date(2026, 1, 28),
      perDay,
      factors(0.8) // the as-at day's rate differs from every movement day's
    );
    const usd = report.rows.find(r => r.accountId === 'acc-usd');
    // Native closing 300 × snapshot 0.8 — NOT the identity's 300 × 0.5.
    expect(usd?.closingConverted).toBe(240);
    // The movement keeps its own day's basis.
    expect(usd?.changeConverted).toBe(150);
    expect(report.holdsForeign).toBe(true);
  });

  it('reports the period change as the movements’ own basis, never netWorth − opening', () => {
    const report = buildAccountBalanceReport(
      FOREIGN_ACCOUNTS, MOVES, RANGE, new Date(2026, 1, 28),
      perDay,
      factors(0.8)
    );
    // 150 converted movement + nothing on the sterling account — the FX
    // drift between 0.5 and 0.8 belongs to no flow.
    expect(report.change).toBe(150);
    // And the snapshot aggregates follow the snapshot closings.
    expect(report.netWorth).toBe(100 + 240);
  });

  it('keeps the identity construction when no snapshot is given (old callers)', () => {
    const report = buildAccountBalanceReport(
      FOREIGN_ACCOUNTS, MOVES, RANGE, new Date(2026, 1, 28),
      perDay
    );
    const usd = report.rows.find(r => r.accountId === 'acc-usd');
    expect(usd?.closingConverted).toBe(150);
    expect(report.netWorth).toBe(100 + 150);
  });
});

describe('resolveClosingSnapshot — which day values the closings', () => {
  const today = new Date(2026, 7, 24);
  const conversionToday = { factors: new Map([['acc-usd', toDecimal(0.9)]]), unconverted: [] as string[] };
  const conversionOn = (date: Date) =>
    ({ factors: new Map([['acc-usd', toDecimal(date.getFullYear() === 2015 ? 1.5 : 0.7)]]), unconverted: [] as string[] });

  it('as at today (or an open-ended window) → today’s rates, the Accounts page’s own basis', async () => {
    const { resolveClosingSnapshot } = await import('./accountBalanceReport');
    expect(resolveClosingSnapshot({ from: null, to: null }, today, conversionToday, conversionOn)).toBe(conversionToday);
    expect(
      resolveClosingSnapshot({ from: new Date(2026, 7, 1), to: today }, today, conversionToday, conversionOn)
    ).toBe(conversionToday);
  });

  it('as at a past day → that day’s own rate: 2015 dollars value at 2015’s rate', async () => {
    const { resolveClosingSnapshot } = await import('./accountBalanceReport');
    const asAt2015 = resolveClosingSnapshot(
      { from: new Date(2015, 0, 1), to: new Date(2015, 11, 31) }, today, conversionToday, conversionOn
    );
    expect(asAt2015?.factors.get('acc-usd')?.toNumber()).toBe(1.5);
  });

  it('degraded (no history) → today’s rates stand in, stated by the basis line', async () => {
    const { resolveClosingSnapshot } = await import('./accountBalanceReport');
    expect(
      resolveClosingSnapshot({ from: new Date(2015, 0, 1), to: new Date(2015, 11, 31) }, today, conversionToday, null)
    ).toBe(conversionToday);
  });
});

describe('a nested account is filed where its parent is (owner, 25 Aug)', () => {
  // Every name and figure is invented; the repo is public.
  const portfolio = account({ id: 'acc-portfolio', name: 'Test Portfolio', type: 'investment', openingBalance: 1000 });
  const cashSleeve = account({
    id: 'acc-sleeve', name: 'Test Portfolio (Cash)', type: 'current',
    openingBalance: 250, parentAccountId: 'acc-portfolio',
  });
  const ordinaryCurrent = account({ id: 'acc-current', name: 'Test Current', type: 'current', openingBalance: 400 });

  const labelsOf = (report: ReturnType<typeof buildAccountBalanceReport>): string[] =>
    report.groups.map(g => g.label);

  it('puts a cash sleeve under Investments, not Current accounts', () => {
    const report = buildAccountBalanceReport(
      [portfolio, cashSleeve, ordinaryCurrent], [], { from: null, to: null }, new Date(2026, 7, 25)
    );
    const investments = report.groups.find(g => g.label === 'Investments');
    const current = report.groups.find(g => g.label === 'Current accounts');
    // The sleeve's money sits with the portfolio it belongs to…
    expect(investments?.rows.map(r => r.accountId).sort()).toEqual(['acc-portfolio', 'acc-sleeve']);
    expect(investments?.closing).toBe(1250);
    // …and no longer inflates the current-account total, which is now just
    // the account that really is one.
    expect(current?.rows.map(r => r.accountId)).toEqual(['acc-current']);
    expect(current?.closing).toBe(400);
  });

  it('files an INVESTMENT nested in an investment there too', () => {
    // The owner's actual ask: retyping a sleeve to Investments must not throw
    // it back out to the top level.
    const sleeveAsInvestment = { ...cashSleeve, type: 'investment' as const };
    const report = buildAccountBalanceReport(
      [portfolio, sleeveAsInvestment], [], { from: null, to: null }, new Date(2026, 7, 25)
    );
    expect(labelsOf(report)).toEqual(['Investments']);
    expect(report.groups[0].closing).toBe(1250);
  });

  it('falls back to its own type when the parent is not in the window', () => {
    // accountNesting's first invariant: a parent that is not in the set is no
    // parent. Filing the child into a band nobody is drawing would lose it.
    const report = buildAccountBalanceReport(
      [cashSleeve], [], { from: null, to: null }, new Date(2026, 7, 25)
    );
    expect(labelsOf(report)).toEqual(['Current accounts']);
  });

  it('leaves an unnested account exactly where it was', () => {
    const report = buildAccountBalanceReport(
      [ordinaryCurrent, portfolio], [], { from: null, to: null }, new Date(2026, 7, 25)
    );
    expect(labelsOf(report).sort()).toEqual(['Current accounts', 'Investments']);
  });
});


/**
 * THE LOANS BAND, AND THE WORD FOR A ROW THAT MOVED (Design §2.1 and §1.1,
 * ruled 24 Aug and confirmed 25th, after they withdrew the type-based
 * classification that prompted them).
 *
 * Every figure below is invented; this repo is public.
 */
describe('bands agree with the headline', () => {
  const WIDE = { from: null, to: null };

  const loans = (out: number, owed: number): Account[] => [
    account({ id: 'lent', name: 'Money I lent', type: 'loan', openingBalance: out }),
    account({ id: 'borrowed', name: 'Money I borrowed', type: 'loan', openingBalance: owed }),
  ];

  it('splits Loans by side when it holds both — no band nets against the headline', () => {
    const report = buildAccountBalanceReport(loans(2000, -5000), [], WIDE);
    const labels = report.groups.map(g => g.label);
    expect(labels).toContain('Loans out');
    expect(labels).toContain('Loans in');
    expect(labels).not.toContain('Loans');

    // Each band now agrees with the headline figure it feeds, instead of one
    // −£3,000 total contradicting both.
    expect(report.groups.find(g => g.label === 'Loans out')?.closing).toBe(2000);
    expect(report.groups.find(g => g.label === 'Loans in')?.closing).toBe(-5000);
    expect(report.assets).toBe(2000);
    expect(report.liabilities).toBe(5000);
  });

  it('leaves Loans whole when every loan runs the same way', () => {
    // Nothing to resolve: the band total and the headline already agree, and
    // "Loans in" as the only band would draw a distinction against nothing.
    const borrowedOnly = buildAccountBalanceReport(
      [account({ id: 'b', name: 'Mine', type: 'loan', openingBalance: -5000 })], [], WIDE
    );
    expect(borrowedOnly.groups.map(g => g.label)).toEqual(['Loans']);

    const lentOnly = buildAccountBalanceReport(
      [account({ id: 'l', name: 'Theirs', type: 'loan', openingBalance: 2000 })], [], WIDE
    );
    expect(lentOnly.groups.map(g => g.label)).toEqual(['Loans']);
  });

  it('files a cleared loan with the borrowings, never as an asset', () => {
    const report = buildAccountBalanceReport(
      [...loans(2000, -5000), account({ id: 'paid', name: 'Paid off', type: 'loan', openingBalance: 0 })],
      [], WIDE
    );
    const inBand = report.groups.find(g => g.label === 'Loans in');
    expect(inBand?.rows.map(r => r.accountId).sort()).toEqual(['borrowed', 'paid']);
  });

  it('sorts the owed-to-you half up with the assets, the owed half where Loans was', () => {
    const report = buildAccountBalanceReport(
      [
        ...loans(2000, -5000),
        account({ id: 'cur', name: 'Everyday', type: 'current', openingBalance: 100 }),
        account({ id: 'card', name: 'Card', type: 'credit', openingBalance: -50 }),
      ],
      [], WIDE
    );
    const order = report.groups.map(g => g.label);
    // Band order is this report's only way of agreeing with the two headline
    // figures — it has no own/owe headings to file a band under.
    expect(order).toEqual(['Current accounts', 'Loans out', 'Credit cards', 'Loans in']);
  });
});

describe('movedSideLabel — why a row is on the other side', () => {
  it('names the move, in each direction', () => {
    expect(movedSideLabel('current', -120)).toBe('overdrawn');
    expect(movedSideLabel('savings', -1)).toBe('overdrawn');
    expect(movedSideLabel('credit', 45)).toBe('in credit');
    expect(movedSideLabel('mortgage', 10)).toBe('in credit');
  });

  it('says nothing when the row is where its type implies', () => {
    // Otherwise every row in the report would carry a label restating the
    // heading it already sits under.
    expect(movedSideLabel('current', 500)).toBeNull();
    expect(movedSideLabel('credit', -500)).toBeNull();
  });

  it('says nothing for a zero balance, or a type that implies no side', () => {
    expect(movedSideLabel('current', 0)).toBeNull();
    expect(movedSideLabel('other', -500)).toBeNull();
    expect(sideOfType('other')).toBeNull();
  });
});

describe('the investment valuation term (slice 3b)', () => {
  const D = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

  it('keeps the row identity: opening + change + marketChange = closing', () => {
    // £100 of delta at the window's opening edge, £250 by its close: the
    // market moved £150 during the window, beside £50 of cash movement.
    const deltaAt = (accountId: string, day: string) => {
      if (accountId !== 'inv') return toDecimal('0');
      return toDecimal(day >= '2026-02-10' ? '250' : '100');
    };

    const report = buildAccountBalanceReport(
      [account({ id: 'inv', name: 'Portfolio', type: 'investment', openingBalance: 1000 })],
      [
        // History before the window, so the opening lump is effective there
        // (an undated account's lump would otherwise fold into the window).
        txn({ id: 't0', amount: 0, date: D(2026, 1, 5), accountId: 'inv' }),
        txn({ id: 't1', amount: 50, date: D(2026, 2, 15), accountId: 'inv' })
      ],
      { from: D(2026, 2, 1), to: D(2026, 2, 28) },
      D(2026, 2, 28),
      undefined,
      undefined,
      deltaAt
    );

    const row = report.rows[0];
    expect(row.opening).toBe(1100); // ledger 1000 + delta at 31 Jan
    expect(row.change).toBe(50);
    expect(row.marketChange).toBe(150);
    expect(row.closing).toBe(1300); // 1100 + 50 + 150, and = ledger 1050 + 250
    expect(row.opening + row.change + row.marketChange).toBe(row.closing);
    expect(report.marketChange).toBe(150);
    expect(report.netWorth).toBe(1300);
  });

  it('leaves an all-time window\'s opening untouched — no position predates time', () => {
    const deltaAt = (_: string, day: string) => toDecimal(day >= '2026-02-10' ? '250' : '0');

    const report = buildAccountBalanceReport(
      [account({ id: 'inv', name: 'Portfolio', type: 'investment', openingBalance: 1000 })],
      [txn({ id: 't1', amount: 50, date: D(2026, 2, 15), accountId: 'inv' })],
      { from: null, to: D(2026, 2, 28) },
      D(2026, 2, 28),
      undefined,
      undefined,
      deltaAt
    );

    const row = report.rows[0];
    expect(row.opening).toBe(1000);
    expect(row.marketChange).toBe(250);
    expect(row.closing).toBe(1300);
  });

  it('is exactly the old report when no valuation is passed', () => {
    const report = buildAccountBalanceReport(
      [account({ id: 'inv', name: 'Portfolio', type: 'investment', openingBalance: 1000 })],
      [],
      { from: null, to: D(2026, 2, 28) },
      D(2026, 2, 28)
    );

    expect(report.rows[0].marketChange).toBe(0);
    expect(report.marketChange).toBe(0);
    expect(report.rows[0].closing).toBe(1000);
  });
});

describe('closed accounts — listed only where the window touches their life', () => {
  const D = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);
  const closed = (over: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account =>
    account({ ...over, isActive: false });

  it('keeps a closed account\'s row for a window it was alive in', () => {
    // The owner's find: closing an account made its whole story vanish from
    // this report while the net-worth chart still counted it.
    const dormant = closed({ id: 'acc-old', name: 'Aged Brokerage', type: 'investment' });
    const report = buildAccountBalanceReport(
      [...ACCOUNTS, dormant],
      [
        txn({ id: 'o1', amount: 500, date: D(2012, 3, 1), accountId: 'acc-old' }),
        txn({ id: 'o2', amount: -500, date: D(2012, 9, 1), accountId: 'acc-old' })
      ],
      { from: D(2012, 1, 1), to: D(2012, 12, 31) },
      D(2026, 2, 28),
      undefined,
      undefined,
      undefined,
      new Set(['acc-old'])
    );

    const row = report.rows.find(r => r.accountId === 'acc-old');
    expect(row?.moneyIn).toBe(500);
    expect(row?.count).toBe(2);
  });

  it('drops a closed account the window never touched — the archive stays quiet', () => {
    const dormant = closed({ id: 'acc-old', name: 'Aged Brokerage', type: 'investment' });
    const report = buildAccountBalanceReport(
      [...ACCOUNTS, dormant],
      [
        // Its life happened long before this window.
        txn({ id: 'o1', amount: 500, date: D(2012, 3, 1), accountId: 'acc-old' }),
        txn({ id: 'o2', amount: -500, date: D(2012, 9, 1), accountId: 'acc-old' })
      ],
      RANGE,
      D(2026, 2, 28),
      undefined,
      undefined,
      undefined,
      new Set(['acc-old'])
    );

    expect(report.rows.find(r => r.accountId === 'acc-old')).toBeUndefined();
    // The open accounts still all list, zeros included — the report's floor.
    expect(report.rows.map(r => r.accountId)).toEqual(ACCOUNTS.map(a => a.id));
  });

  it('keeps an OPEN all-zero account — only the archive goes quiet', () => {
    const report = buildAccountBalanceReport(
      ACCOUNTS,
      [],
      RANGE,
      D(2026, 2, 28),
      undefined,
      undefined,
      undefined,
      new Set(['acc-old'])
    );

    expect(report.rows).toHaveLength(ACCOUNTS.length);
  });

  it('keeps a closed account whose balance still stands at the window\'s close', () => {
    // Closed since, but its money was real ON the as-at day: nonzero closing
    // keeps the row even with no movement inside the window.
    const dormant = closed({ id: 'acc-old', name: 'Aged Brokerage', type: 'investment' });
    const report = buildAccountBalanceReport(
      [...ACCOUNTS, dormant],
      [txn({ id: 'o1', amount: 750, date: D(2012, 3, 1), accountId: 'acc-old' })],
      { from: D(2013, 1, 1), to: D(2013, 12, 31) },
      D(2026, 2, 28),
      undefined,
      undefined,
      undefined,
      new Set(['acc-old'])
    );

    const row = report.rows.find(r => r.accountId === 'acc-old');
    expect(row?.opening).toBe(750);
    expect(row?.closing).toBe(750);
    expect(row?.count).toBe(0);
  });
});
