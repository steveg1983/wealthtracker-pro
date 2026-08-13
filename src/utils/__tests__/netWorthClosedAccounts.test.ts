/**
 * A closed account still counts toward what you WERE worth.
 *
 * ─ THE BUG ─────────────────────────────────────────────────────────────────
 * `accountService.getAccounts` fetches with `.eq('is_active', true)`, so the
 * app context holds open accounts only, and the net-worth history was built
 * from that list. Every closed account was therefore missing from every point
 * in the past — and the owner has 110 of them.
 *
 * He found it by asking: "Does my net worth over time report include closed
 * accounts?" It did not, and his answer to the diagnosis was "then that is what
 * has been the problem with my net worth over time".
 *
 * The error is not uniform, which is what made it hard to see: it grows the
 * FURTHER BACK you look, because more of a person's closed accounts were open
 * then. A chart understated by a slowly-increasing amount reads as a gentler
 * slope rather than as a mistake.
 *
 * These tests are on the series builder, deliberately. What the hook does —
 * fetch the closed list and merge it — is plumbing; what matters is that money
 * in a closed account lands on the right day, and that is arithmetic.
 */
import { describe, it, expect } from 'vitest';
import { buildNetWorthSnapshots } from '../netWorthSeries';
import type { Account, Transaction } from '../../types';

const account = (id: string, isActive: boolean, opening: number): Account => ({
  id,
  name: `Account ${id}`,
  type: 'current',
  balance: opening,
  currency: 'GBP',
  institution: 'Test Bank',
  lastUpdated: new Date('2020-01-01'),
  openingBalance: opening,
  openingBalanceDate: new Date('2015-01-01'),
  isActive,
} as Account);

const txn = (id: string, accountId: string, date: string, amount: number): Transaction => ({
  id,
  accountId,
  date: new Date(date),
  description: 'Test',
  amount,
  type: amount >= 0 ? 'income' : 'expense',
  category: 'cat-1',
  cleared: true,
} as Transaction);

/** 2015 through 2020, which spans both accounts' lives. */
const RANGE = { from: new Date('2015-01-01'), to: new Date('2020-12-31') };

describe('net worth over time, with a closed account in the history', () => {
  it('counts a closed account’s money, and does not when it is left out', () => {
    const open = account('open-1', true, 1000);
    const closed = account('closed-1', false, 5000);
    const transactions = [txn('t1', 'open-1', '2016-06-01', 500)];

    const withoutClosed = buildNetWorthSnapshots([open], transactions, RANGE);
    const withClosed = buildNetWorthSnapshots([open, closed], transactions, RANGE);

    const lastOf = (s: typeof withClosed): number => s[s.length - 1].netWorth;

    // The whole bug in two numbers: the same ledger, £5,000 apart, because one
    // walk was handed an account list the database had already filtered.
    expect(lastOf(withoutClosed)).toBe(1500);
    expect(lastOf(withClosed)).toBe(6500);
  });

  it('puts the closed account’s balance on the right DAY, not at the start of time', () => {
    // Opening dates still govern: a closed account joins history when it opened
    // and not before, exactly as an open one does. Otherwise "include the
    // closed accounts" would trade one overstatement for another.
    const closed = { ...account('closed-1', false, 5000), openingBalanceDate: new Date('2018-01-01') };
    const snapshots = buildNetWorthSnapshots([closed], [], RANGE);

    const before = snapshots.find(s => s.date < new Date('2018-01-01'));
    const after = snapshots[snapshots.length - 1];

    expect(before?.netWorth).toBe(0);
    expect(after.netWorth).toBe(5000);
  });

  it('counts a closed account’s transactions too, not just its opening balance', () => {
    const closed = account('closed-1', false, 5000);
    const transactions = [
      txn('t1', 'closed-1', '2016-03-01', -2000),
      txn('t2', 'closed-1', '2017-03-01', 500),
    ];

    const snapshots = buildNetWorthSnapshots([closed], transactions, RANGE);

    // 5000 - 2000 + 500. The rows were always loaded — `getTransactions` pages
    // by user, not by account — they simply had no account to attach to.
    expect(snapshots[snapshots.length - 1].netWorth).toBe(3500);
  });
});
