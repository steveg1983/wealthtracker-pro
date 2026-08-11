/**
 * Find's matching rules, stated directly.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

import { describe, it, expect } from 'vitest';
import {
  FIND_RESULT_CAP,
  findTransactions,
  isFindCriteriaEmpty,
  matchesFindText,
  parseAmountQuery,
} from './findTransactions';
import type { Transaction } from '../types';

const row = (overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction => ({
  date: new Date(Date.UTC(2026, 3, 1)),
  amount: -24.5,
  description: 'Wexford Bakery',
  category: 'det-groceries',
  accountId: 'acc-current',
  type: 'expense',
  cleared: false,
  ...overrides,
});

describe('parseAmountQuery', () => {
  it('reads an amount the way a statement prints it', () => {
    expect(parseAmountQuery('141.50')?.toString()).toBe('141.5');
    expect(parseAmountQuery('£1,250')?.toString()).toBe('1250');
    expect(parseAmountQuery(' 12 ')?.toString()).toBe('12');
  });

  it('reads a signed amount as its size', () => {
    // Which side of the ledger it fell on is what the user is trying to find
    // out, not something they already know.
    expect(parseAmountQuery('-141.50')?.toString()).toBe('141.5');
  });

  it('refuses anything that is not one', () => {
    expect(parseAmountQuery('bakery')).toBeNull();
    expect(parseAmountQuery('12.34.56')).toBeNull();
    expect(parseAmountQuery('')).toBeNull();
  });
});

describe('matchesFindText', () => {
  const bakery = row({ id: 'txn-1', description: 'Wexford Bakery', amount: -141.5 });

  it('matches part of a description, in any case', () => {
    expect(matchesFindText(bakery, 'bakery')).toBe(true);
    expect(matchesFindText(bakery, 'WEXFORD')).toBe(true);
    expect(matchesFindText(bakery, 'ford Bak')).toBe(true);
  });

  it('matches the amount as printed, on either side of the ledger', () => {
    // The half a substring cannot do: (-141.5).toString() is "-141.5", so
    // "141.50" — how the statement prints it — finds nothing without the
    // numeric rule.
    expect(matchesFindText(bakery, '141.50')).toBe(true);
    expect(matchesFindText(row({ id: 'txn-2', description: 'Refund', amount: 141.5 }), '141.50')).toBe(true);
  });

  it('keeps the register\'s substring habit on amounts', () => {
    expect(matchesFindText(bakery, '141')).toBe(true);
    expect(matchesFindText(bakery, '41.5')).toBe(true);
  });

  it('says no when neither field carries the text', () => {
    expect(matchesFindText(bakery, 'ironmongers')).toBe(false);
    expect(matchesFindText(bakery, '99.99')).toBe(false);
  });

  it('treats empty text as no condition at all', () => {
    expect(matchesFindText(bakery, '   ')).toBe(true);
  });
});

describe('isFindCriteriaEmpty', () => {
  it('is empty when nothing has been asked', () => {
    expect(isFindCriteriaEmpty({ text: '  ' })).toBe(true);
  });

  it('is not empty once a date range names one', () => {
    expect(isFindCriteriaEmpty({ text: '', dateFrom: '2026-04-01', dateTo: '2026-04-01' })).toBe(false);
  });

  it('treats a range it cannot read as no range at all', () => {
    // Otherwise one malformed URL parameter conjures back the global list of
    // everything that this whole change exists to retire.
    expect(isFindCriteriaEmpty({ text: '', dateFrom: 'last-tuesday' })).toBe(true);
  });
});

describe('findTransactions', () => {
  const rows: Transaction[] = [
    row({ id: 'txn-old', description: 'Halberd Ironmongers', date: new Date(Date.UTC(2026, 2, 30)), amount: -10 }),
    row({ id: 'txn-mid', description: 'Wexford Bakery', date: new Date(Date.UTC(2026, 3, 1)), amount: -141.5 }),
    row({ id: 'txn-new', description: 'Pellam Tyres', date: new Date(Date.UTC(2026, 3, 2)), amount: -141.5 }),
  ];

  it('answers nothing at all when nothing has been asked', () => {
    // Not "everything": that would rebuild the global ledger this replaced.
    expect(findTransactions(rows, { text: '' })).toEqual({ rows: [], total: 0, capped: false });
  });

  it('returns the matches newest first', () => {
    const found = findTransactions(rows, { text: '141.50' });

    expect(found.rows.map(r => r.id)).toEqual(['txn-new', 'txn-mid']);
    expect(found.total).toBe(2);
    expect(found.capped).toBe(false);
  });

  it('honours an inclusive day range', () => {
    const found = findTransactions(rows, { text: '', dateFrom: '2026-04-01', dateTo: '2026-04-01' });

    expect(found.rows.map(r => r.id)).toEqual(['txn-mid']);
  });

  it('keeps a row timed later in the last day of the range', () => {
    // The ceiling is the last millisecond of the named day. Comparing against
    // midnight — which the account register's own filter does — would drop
    // every row carrying a real time of day.
    const timed = row({ id: 'txn-timed', date: new Date(Date.UTC(2026, 3, 1, 18, 30)) });

    const found = findTransactions([timed], { text: '', dateFrom: '2026-04-01', dateTo: '2026-04-01' });

    expect(found.rows.map(r => r.id)).toEqual(['txn-timed']);
  });

  it('ignores a bound it cannot read rather than emptying the list', () => {
    const found = findTransactions(rows, { text: 'Bakery', dateFrom: 'last-tuesday' });

    expect(found.rows.map(r => r.id)).toEqual(['txn-mid']);
  });

  it('combines the text and the range', () => {
    const found = findTransactions(rows, { text: 'Bakery', dateFrom: '2026-04-02', dateTo: '2026-04-02' });

    expect(found.total).toBe(0);
  });

  it('leaves archived rows out', () => {
    const packedAway = row({ id: 'txn-archived', description: 'Wexford Bakery', archived: true });

    expect(findTransactions([packedAway], { text: 'Bakery' }).total).toBe(0);
  });

  it('caps the rows it hands back but states the true total', () => {
    const many = Array.from({ length: FIND_RESULT_CAP + 12 }, (_, index) =>
      row({ id: `txn-${index}`, description: `Wexford Bakery ${index}` })
    );

    const found = findTransactions(many, { text: 'Bakery' });

    expect(found.rows).toHaveLength(FIND_RESULT_CAP);
    expect(found.total).toBe(FIND_RESULT_CAP + 12);
    expect(found.capped).toBe(true);
  });
});
