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
    account({ id: 'inv', name: 'Meridian - Share ISA', type: 'investment' }),
    account({ id: 'cash', name: 'Meridian - Share ISA (Cash)' }),
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

/**
 * THE OWNER'S SPECIFICATION, 15 August 2026, as one story.
 *
 * The rungs above are tested individually. This walks the sequence he
 * described, because the point of it is that each step follows from the last
 * without anyone writing a date anywhere:
 *
 *   "Editable date but defaults to today. If the user does not change the date
 *    then in the register the opening balance of x gets placed with today's
 *    date. If the user then goes to edit the account settings and changes the
 *    opening date, I want the register to change with it, or the opening value
 *    if the user changes that. If the user imports transactions and the
 *    earliest transaction imported is earlier than the currently held opening
 *    date then the opening date gets changed automatically to the same date as
 *    that first imported transaction."
 *
 * All of it holds, and holds by DERIVATION rather than storage: the register
 * asks this resolver on every render, so an edit in Account Settings is
 * followed because nothing cached it, and an import moves the date because the
 * clamp recomputes rather than because anything rewrote the column. A stored
 * answer would have needed a migration AND a backfill AND would drift the
 * first time a transaction was deleted.
 */
describe('the opening date through an account’s life', () => {
  const TODAY = D(2026, 8, 15);

  it('sits on today for a fresh account nobody has imported into', () => {
    const acc = account({ id: 'a', name: 'New', openingBalanceDate: TODAY });
    expect(effectiveOpeningDate(acc, undefined, undefined)).toEqual(TODAY);
  });

  it('follows the account settings when the date is edited', () => {
    // Nothing cached it, so "follows" is not a feature — it is the absence of
    // one. The register reads the account on every render.
    const edited = account({ id: 'a', name: 'New', openingBalanceDate: D(2018, 4, 6) });
    expect(effectiveOpeningDate(edited, undefined, undefined)).toEqual(D(2018, 4, 6));
  });

  it('moves itself back when an import lands earlier than it', () => {
    const acc = account({ id: 'a', name: 'New', openingBalanceDate: TODAY });
    // A year of history imported, earliest 2 January.
    expect(effectiveOpeningDate(acc, D(2026, 1, 2), undefined)).toEqual(D(2026, 1, 2));
  });

  it('stays put when the import is all LATER than the opening date', () => {
    // The clamp only ever pulls backwards. An opening balance dated before the
    // history is a legitimate statement — it is where the running balance
    // starts — and moving it forward would silently drop the gap.
    const acc = account({ id: 'a', name: 'New', openingBalanceDate: D(2018, 4, 6) });
    expect(effectiveOpeningDate(acc, D(2020, 1, 1), undefined)).toEqual(D(2018, 4, 6));
  });
});
