import { describe, it, expect } from 'vitest';
import { buildNetWorthSnapshots, netWorthAxisTicks, netWorthValueAxis } from './netWorthSeries';
import type { Account, Transaction } from '../types';
import type { PeriodRange } from '../hooks/usePeriod';

/** Synthetic fixtures only — no real accounts or amounts in this repo. */
const account = (over: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  type: 'current',
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

const D = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

// A daily-cadence window (≤ 92 days → one point per day), so every day is
// addressable by its day-of-month.
const RANGE: PeriodRange = { from: D(2026, 2, 1), to: D(2026, 2, 28) };
const on = (snaps: ReturnType<typeof buildNetWorthSnapshots>, day: number) =>
  snaps.find(s => s.date.getMonth() === 1 && s.date.getDate() === day);

describe('buildNetWorthSnapshots — opening balances happen on a date', () => {
  it('a mid-window opening balance contributes nothing before its date and the lump from that date', () => {
    const snaps = buildNetWorthSnapshots(
      [account({ id: 'a', name: 'A', openingBalance: 1000, openingBalanceDate: D(2026, 2, 15) })],
      [],
      RANGE
    );
    expect(on(snaps, 14)?.netWorth).toBe(0);
    expect(on(snaps, 15)?.netWorth).toBe(1000);
    expect(on(snaps, 28)?.netWorth).toBe(1000);
  });

  it('an undated opening balance behaves as today — present from time-zero', () => {
    const snaps = buildNetWorthSnapshots(
      [account({ id: 'a', name: 'A', openingBalance: 500 })],
      [],
      RANGE
    );
    // No date, no transactions, no sibling → rung 4 → seeded at the very start.
    expect(on(snaps, 1)?.netWorth).toBe(500);
    expect(on(snaps, 28)?.netWorth).toBe(500);
  });

  it('a dated opening balance accumulates its transactions from its effective date', () => {
    const snaps = buildNetWorthSnapshots(
      [account({ id: 'a', name: 'A', openingBalance: 100, openingBalanceDate: D(2026, 2, 5) })],
      [
        txn({ id: 't1', amount: 50, date: D(2026, 2, 10), accountId: 'a', type: 'income' }),
        txn({ id: 't2', amount: -30, date: D(2026, 2, 20), accountId: 'a' }),
      ],
      RANGE
    );
    expect(on(snaps, 4)?.netWorth).toBe(0);    // before the opening date
    expect(on(snaps, 5)?.netWorth).toBe(100);  // opening lump lands
    expect(on(snaps, 10)?.netWorth).toBe(150); // + first transaction
    expect(on(snaps, 20)?.netWorth).toBe(120); // − second transaction
    expect(on(snaps, 28)?.netWorth).toBe(120);
  });

  it('an explicit opening date later than the first transaction is clamped to it', () => {
    // Effective date = first transaction (Feb 8), not the recorded Feb 20.
    const snaps = buildNetWorthSnapshots(
      [account({ id: 'a', name: 'A', openingBalance: 200, openingBalanceDate: D(2026, 2, 20) })],
      [txn({ id: 't1', amount: -10, date: D(2026, 2, 8), accountId: 'a' })],
      RANGE
    );
    expect(on(snaps, 7)?.netWorth).toBe(0);
    expect(on(snaps, 8)?.netWorth).toBe(190); // 200 opening − 10, both on/by Feb 8
    expect(on(snaps, 28)?.netWorth).toBe(190);
  });

  it('splits assets and liabilities by the running balance sign', () => {
    const snaps = buildNetWorthSnapshots(
      [
        account({ id: 'cash', name: 'Cash', openingBalance: 300, openingBalanceDate: D(2026, 2, 2) }),
        account({ id: 'card', name: 'Card', type: 'credit', openingBalance: -80, openingBalanceDate: D(2026, 2, 2) }),
      ],
      [],
      RANGE
    );
    const snap = on(snaps, 28);
    expect(snap?.assets).toBe(300);
    expect(snap?.liabilities).toBe(80);
    expect(snap?.netWorth).toBe(220);
  });
});

/**
 * THE TICK FORMAT FOLLOWS THE SPAN OF THE DOMAIN (Design, 17 Aug §2.3).
 * A sixteen-year monthly series labelled "Apr 10" read as sixteen dates in one
 * April — 2-digit years are indistinguishable from days, and day-first is the
 * en-GB order anyway.
 */
describe('netWorthAxisTicks — the tick format follows the span', () => {
  const seeded = (range: PeriodRange) =>
    buildNetWorthSnapshots(
      [account({ id: 'a', name: 'A', openingBalance: 100 })],
      [],
      range,
      range.to ?? new Date(2026, 7, 17)
    );

  it('monthly labels carry a full year, so a year cannot read as a day', () => {
    const snaps = seeded({ from: D(2010, 4, 1), to: D(2026, 8, 17) });
    expect(snaps[0].label).toMatch(/2010/);
    expect(snaps[0].label).not.toMatch(/\b10\b/);
  });

  it('a multi-year window ticks in bare years, stepped to fit', () => {
    const snaps = seeded({ from: D(2010, 4, 1), to: D(2026, 8, 17) });
    const { ticks, tickFormatter } = netWorthAxisTicks(snaps);
    expect(ticks).toBeDefined();
    expect(tickFormatter).toBeDefined();
    const rendered = ticks!.map(t => tickFormatter!(t));
    // 16 years → every second year, "2010 · 2012 · …" — never "Apr 10".
    expect(rendered[0]).toBe('2010');
    expect(rendered).toEqual(rendered.map(r => r).filter(r => /^\d{4}$/.test(r)));
    expect(rendered.length).toBeGreaterThanOrEqual(5);
    expect(rendered.length).toBeLessThanOrEqual(9);
    // Every tick names a real point, so recharts can place it.
    const labels = new Set(snaps.map(s => s.label));
    for (const t of ticks!) expect(labels.has(t)).toBe(true);
  });

  it('a window under two years keeps its month labels and lets recharts thin them', () => {
    const snaps = seeded({ from: D(2025, 9, 1), to: D(2026, 8, 17) });
    expect(netWorthAxisTicks(snaps)).toEqual({});
  });

  it('a window within one quarter stays day-first — "17 Aug", never "Aug 17"', () => {
    const snaps = seeded({ from: D(2026, 8, 1), to: D(2026, 8, 17) });
    expect(netWorthAxisTicks(snaps)).toEqual({});
    expect(snaps[snaps.length - 1].label).toMatch(/^17 /);
  });
});

describe('netWorthValueAxis — the floor belongs to the data, not the tick step', () => {
  it('a shallow dip below zero never buys a full tick-step band (the measured floor)', () => {
    // The owner's real SHAPE in invented figures: an early dip a small
    // fraction of one tick step deep, a large positive peak at the end.
    // recharts' own rounding answered this with a floor one full step
    // below zero; ours grazes just under the dip.
    const axis = netWorthValueAxis([-90_000, 2_000_000, 21_000_000]);
    expect(Math.min(...axis.ticks)).toBe(0);
    expect(axis.domain[0]).toBeLessThan(-90_000);
    expect(axis.domain[0]).toBeGreaterThan(-600_000);
    expect(axis.domain[1]).toBe(Math.max(...axis.ticks));
    expect(axis.domain[1]).toBeGreaterThanOrEqual(21_000_000);
    expect(axis.ticks).toContain(0);
  });

  it('a genuinely deep negative earns real negative ticks', () => {
    const axis = netWorthValueAxis([-8_000_000, 17_000_000]);
    expect(Math.min(...axis.ticks)).toBeLessThan(0);
    expect(axis.domain[0]).toBeLessThan(-8_000_000);
  });

  it('all-positive data keeps the zero floor it always had', () => {
    const axis = netWorthValueAxis([50_000, 900_000]);
    expect(axis.domain[0]).toBe(0);
    expect(axis.ticks[0]).toBe(0);
    expect(axis.domain[1]).toBeGreaterThanOrEqual(900_000);
  });

  it('ticks are nice multiples of one step, zero among them, top covering the data', () => {
    const axis = netWorthValueAxis([-90_000, 21_000_000]);
    const step = axis.ticks[1] - axis.ticks[0];
    axis.ticks.forEach((tick, i) => {
      expect(tick).toBeCloseTo(axis.ticks[0] + i * step, 6);
    });
    expect(axis.ticks).toContain(0);
    expect(Object.is(axis.ticks.find(t => t === 0), -0)).toBe(false);
  });

  it('an empty or all-zero series stays sane', () => {
    expect(netWorthValueAxis([])).toEqual({ domain: [0, 1], ticks: [0, 1] });
    expect(netWorthValueAxis([0, 0])).toEqual({ domain: [0, 1], ticks: [0, 1] });
  });
});
