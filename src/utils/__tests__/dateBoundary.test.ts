import { describe, it, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import { toDateMs, toDateValue, normalizeTransactionDates } from '../dateBoundary';
import type { Transaction } from '../../types';

const transaction = (date: unknown): Transaction => {
  const row: Transaction = {
    id: 'txn-1',
    date: new Date('2026-08-01'),
    amount: -10,
    description: 'Test',
    category: 'cat-1',
    accountId: 'acct-1',
    type: 'expense'
  };
  // The whole point of this module is rows whose `date` is not a Date, so the
  // fixture writes through the same widened view the boundary itself uses.
  const target: { date: unknown } = row;
  target.date = date;
  return row;
};

describe('toDateMs', () => {
  it('reads the wire shape Postgres sends for a date column', () => {
    expect(toDateMs('2026-08-15')).toBe(Date.parse('2026-08-15T00:00:00.000Z'));
  });

  it('reads a full ISO timestamp and an offset timestamp identically', () => {
    expect(toDateMs('2026-08-15T13:45:00.000Z')).toBe(toDateMs('2026-08-15T14:45:00+01:00'));
  });

  it('reads a Date and an epoch number', () => {
    const date = new Date('2026-08-15T13:45:00.000Z');
    expect(toDateMs(date)).toBe(date.getTime());
    expect(toDateMs(date.getTime())).toBe(date.getTime());
  });

  it('returns NaN for anything unreadable, so a bad date filters out rather than landing in a period', () => {
    expect(Number.isNaN(toDateMs('not a date'))).toBe(true);
    expect(Number.isNaN(toDateMs(null))).toBe(true);
    expect(Number.isNaN(toDateMs(undefined))).toBe(true);
    expect(Number.isNaN(toDateMs({}))).toBe(true);
    expect(Number.isNaN(toDateMs(Number.NaN))).toBe(true);
  });
});

describe('toDateValue', () => {
  it('hands a Date straight back', () => {
    const date = new Date('2026-08-15T13:45:00.000Z');
    expect(toDateValue(date)).toBe(date);
  });

  it('turns the wire string into the same instant the app already read it as', () => {
    expect(toDateValue('2026-08-01').toISOString()).toBe(new Date('2026-08-01').toISOString());
  });

  it('rebuilds a Date that crossed a realm boundary instead of discarding it', () => {
    // A structured clone out of IndexedDB (or a worker/iframe message) can
    // deliver a genuine Date whose prototype belongs to another realm, so
    // `instanceof` is false — observed for real with fake-indexeddb under
    // jsdom. Treating that as garbage would replace real money data with an
    // Invalid Date, so the boundary rebuilds it at the same instant.
    const crossRealm: unknown = runInNewContext('new Date("2026-08-15T13:45:00.000Z")');
    expect(crossRealm instanceof Date).toBe(false);

    const result = toDateValue(crossRealm);

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-08-15T13:45:00.000Z');
    expect(toDateMs(crossRealm)).toBe(Date.parse('2026-08-15T13:45:00.000Z'));
  });

  it('gives an Invalid Date, never the epoch, for an unreadable value', () => {
    const result = toDateValue('nonsense');
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(true);
  });
});

describe('normalizeTransactionDates', () => {
  it('converts string dates in place and returns the same array', () => {
    const rows = [transaction('2026-08-01'), transaction('2026-08-02T10:00:00.000Z')];

    const result = normalizeTransactionDates(rows);

    expect(result).toBe(rows);
    expect(rows[0].date).toBeInstanceOf(Date);
    expect(rows[0].date.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(rows[1].date.toISOString()).toBe('2026-08-02T10:00:00.000Z');
  });

  it('leaves an existing Date untouched (same instance)', () => {
    const date = new Date('2026-08-01T00:00:00.000Z');
    const rows = [transaction(date)];

    normalizeTransactionDates(rows);

    expect(rows[0].date).toBe(date);
  });

  it('makes the comparison that reported £0 spent answer correctly', () => {
    const rows = normalizeTransactionDates([transaction('2026-08-15')]);

    expect(rows[0].date >= new Date('2026-08-01')).toBe(true);
    expect(rows[0].date <= new Date('2026-08-31')).toBe(true);
  });
});
