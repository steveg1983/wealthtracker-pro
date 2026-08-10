import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Transaction } from '../../types';

/**
 * "New transaction" must mean a row that APPEARED during this session, never
 * one that merely loaded. The old implementation compared the newest row's
 * DATE to the wall clock — so any transaction dated in the future (a standing
 * order entered ahead of time) was announced as new on every page refresh,
 * forever, while nothing was actually being added.
 */
const mockApp = vi.hoisted(() => ({
  current: {
    transactions: [] as Transaction[],
    accounts: [] as unknown[],
    budgets: [] as unknown[],
    goals: [] as unknown[],
  },
}));
vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => mockApp.current,
}));

const logged = vi.hoisted(() => ({ items: [] as Array<{ title: string; description: string }> }));
vi.mock('../useActivityTracking', () => ({
  logActivity: (a: { title: string; description: string }) => { logged.items.push(a); },
}));

import { useActivityLogger } from '../useActivityLogger';

// Tomorrow: the exact shape that made the old date-based check fire forever.
const futureDated = (id: string): Transaction => ({
  id,
  date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  description: 'STANDING ORDER — VANGUARD ISA',
  amount: 200,
  type: 'transfer',
  category: 'cat-1',
  accountId: 'acct-1',
} as unknown as Transaction);

describe('useActivityLogger transaction announcements', () => {
  beforeEach(() => {
    logged.items = [];
    localStorage.clear();
    mockApp.current = { transactions: [], accounts: [], budgets: [], goals: [] };
  });

  it('announces nothing when a session merely loads existing rows — even future-dated ones', () => {
    mockApp.current.transactions = [futureDated('t1'), futureDated('t2')];
    renderHook(() => useActivityLogger());

    expect(logged.items.filter(l => l.title === 'New Transaction')).toHaveLength(0);
  });

  it('announces nothing again on refresh (a fresh mount over the same data)', () => {
    mockApp.current.transactions = [futureDated('t1')];
    const first = renderHook(() => useActivityLogger());
    first.unmount();

    const second = renderHook(() => useActivityLogger());
    second.unmount();

    expect(logged.items.filter(l => l.title === 'New Transaction')).toHaveLength(0);
  });

  it('announces a row that appears after the baseline, exactly once', () => {
    mockApp.current.transactions = [futureDated('t1')];
    const hook = renderHook(() => useActivityLogger());

    mockApp.current = { ...mockApp.current, transactions: [futureDated('t1'), futureDated('t2')] };
    hook.rerender();
    hook.rerender(); // a second render with the same data must not re-announce

    const announcements = logged.items.filter(l => l.title === 'New Transaction');
    expect(announcements).toHaveLength(1);
  });
});

/**
 * WHERE a notification takes the user.
 *
 * Both of these used to land on a list: "X Balance Updated" opened the accounts
 * page, and "New Transaction" opened the whole transactions list with nothing
 * pointed at — which on fifty thousand rows is not an answer to either alert.
 * The destination travels as the `actionUrl` the bell already stores, so a
 * register deep link names the account and the row inside the URL itself and
 * nothing new has to be added to a record that is serialised into localStorage
 * and read back by builds that have not shipped yet.
 */
type LoggedActivity = { title: string; description: string; actionUrl?: string };

const loggedActivities = (): LoggedActivity[] => logged.items as LoggedActivity[];

const account = (id: string, name: string, balance: number) => ({
  id, name, balance, type: 'current', currency: 'GBP', lastUpdated: new Date('2026-01-01'),
});

describe('where a notification takes the user', () => {
  beforeEach(() => {
    logged.items = [];
    localStorage.clear();
    mockApp.current = { transactions: [], accounts: [], budgets: [], goals: [] };
  });

  it('sends a new transaction to its own row, in its own account’s register', () => {
    mockApp.current.transactions = [futureDated('t1')];
    const hook = renderHook(() => useActivityLogger());

    mockApp.current = { ...mockApp.current, transactions: [futureDated('t1'), futureDated('t2')] };
    hook.rerender();

    const announcement = loggedActivities().find(l => l.title === 'New Transaction');
    // The register's own deep link: it selects the row and centres it.
    expect(announcement?.actionUrl).toBe('/accounts/acct-1?txn=t2');
  });

  it('sends a balance alert to THAT account’s register, not the list of them', () => {
    // A balance this browser has seen before, so the change is a change.
    localStorage.setItem('account_balance_acc-9', '100');
    mockApp.current.accounts = [account('acc-9', 'Synthetic Current', 250)];

    renderHook(() => useActivityLogger());

    const announcement = loggedActivities().find(l => l.title.endsWith('Balance Updated'));
    expect(announcement?.actionUrl).toBe('/accounts/acc-9');
  });
});
