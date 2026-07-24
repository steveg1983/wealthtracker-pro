import { describe, it, expect } from 'vitest';
import {
  effectiveOpeningDate,
  findSiblingAccount,
  resolveEffectiveOpeningDates,
} from './openingDates';
import type { Account, Transaction } from '../types';

/** Synthetic fixtures only — no real accounts or amounts in this repo. */
const account = (over: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date(2026, 0, 1),
  openingBalance: 0,
  ...over,
});

const txn = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'accountId'>): Transaction => ({
  amount: 0,
  description: 'synthetic row',
  category: 'cat-x',
  type: 'expense',
  ...over,
});

const D = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

describe('effectiveOpeningDate — precedence', () => {
  it('rung 1: an explicit date is used as-is when it is no later than the first transaction', () => {
    const acc = account({ id: 'a', name: 'A', openingBalanceDate: D(2011, 3, 1) });
    expect(effectiveOpeningDate(acc, D(2011, 6, 1), undefined)).toEqual(D(2011, 3, 1));
  });

  it('rung 1 clamp: an explicit date LATER than the first transaction is pulled back to it', () => {
    // Money's dtOpen can post-date real activity; the opening lump must exist by
    // the first transaction or the running balance is wrong.
    const acc = account({ id: 'a', name: 'A', openingBalanceDate: D(2012, 1, 1) });
    expect(effectiveOpeningDate(acc, D(2011, 5, 1), undefined)).toEqual(D(2011, 5, 1));
  });

  it('rung 1 with no transactions keeps the explicit date (nothing to clamp against)', () => {
    const acc = account({ id: 'a', name: 'A', openingBalanceDate: D(2011, 3, 1) });
    expect(effectiveOpeningDate(acc, undefined, undefined)).toEqual(D(2011, 3, 1));
  });

  it('rung 2: no explicit date → the first transaction, same-day (not the day before)', () => {
    const acc = account({ id: 'a', name: 'A' });
    expect(effectiveOpeningDate(acc, D(2015, 7, 9), undefined)).toEqual(D(2015, 7, 9));
  });

  it('rung 3: no own transactions → the paired sibling’s first activity', () => {
    const acc = account({ id: 'a', name: 'A' });
    expect(effectiveOpeningDate(acc, undefined, D(2018, 2, 2))).toEqual(D(2018, 2, 2));
  });

  it('rung 4: no signal at all → undefined (beginning of time, flagged not hidden)', () => {
    const acc = account({ id: 'a', name: 'A' });
    expect(effectiveOpeningDate(acc, undefined, undefined)).toBeUndefined();
  });

  it('own activity outranks the sibling when both exist', () => {
    const acc = account({ id: 'a', name: 'A' });
    expect(effectiveOpeningDate(acc, D(2016, 1, 1), D(2010, 1, 1))).toEqual(D(2016, 1, 1));
  });
});

describe('findSiblingAccount — the "(Cash)" pairing, both directions', () => {
  const accounts = [
    account({ id: 'inv', name: 'Rathbones - Share ISA', type: 'investment' }),
    account({ id: 'cash', name: 'Rathbones - Share ISA (Cash)' }),
    account({ id: 'other', name: 'Everyday Current' }),
  ];

  it('pairs the position account with its "(Cash)" sibling', () => {
    expect(findSiblingAccount(accounts[0], accounts)?.id).toBe('cash');
  });

  it('pairs the "(Cash)" account back to its position account', () => {
    expect(findSiblingAccount(accounts[1], accounts)?.id).toBe('inv');
  });

  it('matches case-insensitively', () => {
    const list = [account({ id: 'x', name: 'Fund X' }), account({ id: 'xc', name: 'fund x (CASH)' })];
    expect(findSiblingAccount(list[0], list)?.id).toBe('xc');
  });

  it('returns undefined for an account that does not fit the convention', () => {
    expect(findSiblingAccount(accounts[2], accounts)).toBeUndefined();
  });
});

describe('resolveEffectiveOpeningDates — one pass over a multi-account fixture', () => {
  const accounts = [
    // explicit date, later than first txn → clamps to the first txn
    account({ id: 'clamped', name: 'Clamped', openingBalanceDate: D(2012, 1, 1) }),
    // no date, has txns → first txn
    account({ id: 'inferred', name: 'Inferred' }),
    // investment with no txns of its own → its cash sibling's first txn
    account({ id: 'inv', name: 'ISA', type: 'investment' }),
    account({ id: 'inv-cash', name: 'ISA (Cash)' }),
    // no date, no txns, no sibling → undefined
    account({ id: 'orphan', name: 'Orphan' }),
  ];
  const transactions = [
    txn({ id: 't1', date: D(2011, 5, 1), accountId: 'clamped' }),
    txn({ id: 't2', date: D(2013, 9, 9), accountId: 'clamped' }),
    txn({ id: 't3', date: D(2015, 2, 2), accountId: 'inferred' }),
    txn({ id: 't4', date: D(2019, 4, 4), accountId: 'inv-cash' }),
    txn({ id: 't5', date: D(2020, 1, 1), accountId: 'inv-cash' }),
  ];

  it('resolves every account by its correct rung', () => {
    const map = resolveEffectiveOpeningDates(accounts, transactions);
    expect(map.get('clamped')).toEqual(D(2011, 5, 1)); // explicit clamped to first txn
    expect(map.get('inferred')).toEqual(D(2015, 2, 2)); // first own txn
    expect(map.get('inv')).toEqual(D(2019, 4, 4));      // sibling's first txn
    expect(map.get('inv-cash')).toEqual(D(2019, 4, 4)); // its own first txn
    expect(map.get('orphan')).toBeUndefined();          // no signal
  });

  it('ignores transactions with an unparseable date', () => {
    const map = resolveEffectiveOpeningDates(
      [account({ id: 'a', name: 'A' })],
      [
        txn({ id: 'bad', date: new Date('not-a-date'), accountId: 'a' }),
        txn({ id: 'good', date: D(2021, 6, 6), accountId: 'a' }),
      ]
    );
    expect(map.get('a')).toEqual(D(2021, 6, 6));
  });
});
