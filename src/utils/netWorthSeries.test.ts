import { describe, it, expect } from 'vitest';
import { buildNetWorthSnapshots } from './netWorthSeries';
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
