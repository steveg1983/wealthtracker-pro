import { describe, it, expect } from 'vitest';
import { buildAccountBalanceReport } from './accountBalanceReport';
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
