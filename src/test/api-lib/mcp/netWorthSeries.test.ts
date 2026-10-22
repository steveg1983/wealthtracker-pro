/**
 * The connector's backward net-worth walk against the app's forward one.
 *
 * One ledger, both walks, every point compared — the proof that
 * api/_lib/mcp/netWorthSeries.ts is `buildNetWorthSnapshots` rearranged and
 * not a second opinion. The ledger exercises each rung of the opening-date
 * rule, a closed account with history, rows before the window, a row after
 * it, and both cadences. Every figure invented (public repo).
 */

import { describe, it, expect } from 'vitest';
import type { Account, Transaction } from '../../../types';
import { buildNetWorthSnapshots } from '../../../utils/netWorthSeries';
import { netWorthSeriesByCurrency, type SeriesAccount } from '../../../../api/_lib/mcp/netWorthSeries';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const local = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

const row = (id: string, accountId: string, date: string, amount: number): Transaction => ({
  id, accountId, date: day(date), amount, description: id, category: 'cat', type: amount < 0 ? 'expense' : 'income', cleared: false,
} as Transaction);

/** Opening + every row = balance: the identity the walk starts from. */
const ledgerAccount = (over: Partial<Account> & { id: string; name: string; openingBalance: number }, rows: Transaction[]): Account => ({
  type: 'checking',
  currency: 'GBP',
  lastUpdated: new Date(0),
  isActive: true,
  ...over,
  balance: rows.filter(t => t.accountId === over.id).reduce((sum, t) => sum + t.amount, over.openingBalance),
} as Account);

const rows: Transaction[] = [
  // Current: history long before the window, activity inside it.
  row('c1', 'current', '2024-03-10', 1500),
  row('c2', 'current', '2026-01-15', -200),
  row('c3', 'current', '2026-04-02', -300.25),
  row('c4', 'current', '2026-09-30', 900),
  row('c5', 'current', '2026-10-20', -50),
  // After the window: today's balance includes it, the walk must take it out.
  row('c6', 'current', '2026-12-01', -1000),
  // Explicit opening date inside the window, clamped by an earlier first row.
  row('n1', 'newcard', '2026-05-20', -80),
  row('n2', 'newcard', '2026-07-01', -120),
  // No explicit date: the opening applies on the first row (rung 2), inside the window.
  row('s1', 'savings', '2026-06-15', 250),
  // Closed account that held money until it was emptied mid-window.
  row('o1', 'old', '2023-01-05', 400),
  row('o2', 'old', '2026-03-31', -400),
  // Euro account: its own line.
  row('e1', 'euro', '2026-02-10', 100),
];

const accounts: Account[] = [
  ledgerAccount({ id: 'current', name: 'Current', openingBalance: 100, openingBalanceDate: day('2024-01-01') }, rows),
  ledgerAccount({ id: 'newcard', name: 'New Card', type: 'credit', openingBalance: -500, openingBalanceDate: day('2026-06-01') }, rows),
  ledgerAccount({ id: 'savings', name: 'Savings', openingBalance: 2000 }, rows),
  ledgerAccount({ id: 'old', name: 'Old', openingBalance: 0, isActive: false }, rows),
  // Rung 4: an opening balance, no rows, no sibling, no date — counts from the start.
  ledgerAccount({ id: 'house', name: 'House', type: 'assets', openingBalance: 250000 }, rows),
  ledgerAccount({ id: 'euro', name: 'Euro', currency: 'EUR', openingBalance: 50 }, rows),
];

const firstActivity = (): Map<string, number> => {
  const first = new Map<string, number>();
  for (const t of rows) {
    const time = t.date.getTime();
    const known = first.get(t.accountId);
    if (known === undefined || time < known) first.set(t.accountId, time);
  }
  return first;
};

const toSeriesAccount = (a: Account): SeriesAccount => ({
  id: a.id, name: a.name, currency: a.currency, openingBalance: a.openingBalance ?? 0, openingBalanceDate: a.openingBalanceDate, balance: a.balance,
});

/** The app's own series over the GBP accounts alone — one currency, no conversion, as the connector reports it. */
const appSeries = (from: Date, to: Date, currency: string) =>
  buildNetWorthSnapshots(
    accounts.filter(a => a.currency === currency),
    rows.filter(t => accounts.some(a => a.id === t.accountId && a.currency === currency)),
    { from, to },
    local(2026, 10, 22)
  );

const ourSeries = (from: Date, to: Date) =>
  netWorthSeriesByCurrency({
    accounts: accounts.map(toSeriesAccount),
    firstActivity: firstActivity(),
    rows: rows.filter(t => t.date >= from).map(t => ({ accountId: t.accountId, date: t.date, amount: t.amount })),
    from,
    to,
  });

describe('the backward walk is the app’s forward walk, rearranged', () => {
  it('lands on the same month-ends with the same figures over a year, per currency', () => {
    const from = local(2025, 11, 1);
    const to = local(2026, 10, 22);
    const ours = ourSeries(from, to);
    expect(ours.monthly).toBe(true);
    expect(ours.series.map(line => line.currency)).toEqual(['EUR', 'GBP']);
    for (const line of ours.series) {
      const theirs = appSeries(from, to, line.currency);
      expect(line.points.length).toBe(theirs.length);
      line.points.forEach((point, index) => {
        expect(point.date.getTime(), `${line.currency} point ${index}`).toBe(theirs[index].date.getTime());
        expect(point.assets, `${line.currency} assets ${index}`).toBeCloseTo(theirs[index].assets, 6);
        expect(point.liabilities, `${line.currency} liabilities ${index}`).toBeCloseTo(theirs[index].liabilities, 6);
        expect(point.netWorth, `${line.currency} net ${index}`).toBeCloseTo(theirs[index].netWorth, 6);
      });
    }
    // The figures are real, not vacuously equal: the new card's opening lump
    // is absent before its clamped date and the old account's money is gone
    // after it was emptied.
    const gbp = ours.series.find(line => line.currency === 'GBP')!;
    const first = gbp.points[0];
    const last = gbp.points[gbp.points.length - 1];
    expect(first.liabilities).toBe(0);
    expect(last.liabilities).toBe(700);
    expect(last.assets).toBe(254199.75);
  });

  it('matches day by day on a short window, including the day a row lands and the day after', () => {
    const from = local(2026, 9, 25);
    const to = local(2026, 10, 22);
    const ours = ourSeries(from, to);
    expect(ours.monthly).toBe(false);
    const gbp = ours.series.find(line => line.currency === 'GBP')!;
    const theirs = appSeries(from, to, 'GBP');
    expect(gbp.points.map(p => p.netWorth)).toEqual(theirs.map(s => s.netWorth));
    expect(gbp.points.map(p => p.date.getTime())).toEqual(theirs.map(s => s.date.getTime()));
    // 30 September carries c4; 29 September does not.
    const sept29 = gbp.points.find(p => p.date.getDate() === 29)!;
    const sept30 = gbp.points.find(p => p.date.getDate() === 30)!;
    expect(sept30.netWorth - sept29.netWorth).toBe(900);
  });

  it('counts an undated opening from the start and says how many there are', () => {
    const ours = ourSeries(local(2026, 1, 1), local(2026, 10, 22));
    expect(ours.undatedOpenings).toBe(1);
    const gbp = ours.series.find(line => line.currency === 'GBP')!;
    expect(gbp.points[0].assets).toBeGreaterThanOrEqual(250000);
  });

  it('without first-activity dates, an explicit opening date still holds and the rest count throughout', () => {
    const from = local(2026, 1, 1);
    const to = local(2026, 10, 22);
    const blind = netWorthSeriesByCurrency({
      accounts: accounts.map(toSeriesAccount),
      firstActivity: null,
      rows: rows.filter(t => t.date >= from).map(t => ({ accountId: t.accountId, date: t.date, amount: t.amount })),
      from,
      to,
    });
    const gbp = blind.series.find(line => line.currency === 'GBP')!;
    // Savings has no explicit date: blind, its 2000 counts from January; dated, it arrives in June.
    const dated = ourSeries(from, to).series.find(line => line.currency === 'GBP')!;
    expect(gbp.points[0].assets - dated.points[0].assets).toBe(2000);
    // The new card's explicit June date is unclamped without activity: May's point owes nothing but n1.
    const may = gbp.points.find(p => p.date.getMonth() === 4)!;
    expect(may.liabilities).toBe(80);
    expect(blind.undatedOpenings).toBe(3);
  });
});
