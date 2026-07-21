import { describe, it, expect } from 'vitest';
import {
  resolveCutoff, isArchivable, countArchivable, broughtForwardBalance, hasArchived,
} from './archive';
import type { Transaction } from '../types';

const NOW = new Date('2026-07-21T00:00:00Z');

const txn = (o: Partial<Transaction>): Transaction => ({
  id: 'x', accountId: 'a1', amount: 0, date: new Date('2024-01-01'),
  description: '', category: '', type: 'expense', ...o,
});

describe('resolveCutoff', () => {
  it('maps presets to N months back and passes custom/all through', () => {
    expect(resolveCutoff('12m', '', NOW)?.toISOString().slice(0, 10)).toBe('2025-07-21');
    expect(resolveCutoff('24m', '', NOW)?.toISOString().slice(0, 10)).toBe('2024-07-21');
    expect(resolveCutoff('all', '', NOW)).toBeNull();
    expect(resolveCutoff('custom', '2023-01-15', NOW)?.toISOString().slice(0, 10)).toBe('2023-01-15');
    expect(resolveCutoff('custom', '', NOW)).toBeNull();
  });
});

describe('isArchivable / countArchivable', () => {
  const cutoff = new Date('2025-01-01');
  it('only reconciled transactions on/before the cutoff qualify', () => {
    expect(isArchivable(txn({ cleared: true, date: new Date('2024-06-01') }), cutoff)).toBe(true);
    // unreconciled → stays live
    expect(isArchivable(txn({ cleared: false, date: new Date('2024-06-01') }), cutoff)).toBe(false);
    // after cutoff → stays live
    expect(isArchivable(txn({ cleared: true, date: new Date('2025-06-01') }), cutoff)).toBe(false);
  });

  it('counts only the account’s not-yet-archived, archivable transactions', () => {
    const txns = [
      txn({ id: '1', accountId: 'a1', cleared: true, date: new Date('2024-01-01') }),      // yes
      txn({ id: '2', accountId: 'a1', cleared: true, date: new Date('2024-01-01'), archived: true }), // already archived
      txn({ id: '3', accountId: 'a1', cleared: false, date: new Date('2024-01-01') }),     // unreconciled
      txn({ id: '4', accountId: 'a2', cleared: true, date: new Date('2024-01-01') }),      // other account
    ];
    expect(countArchivable(txns, 'a1', cutoff)).toBe(1);
  });
});

describe('broughtForwardBalance', () => {
  it('adds only the archived transactions of the account to opening (Decimal, no float drift)', () => {
    const txns = [
      txn({ accountId: 'a1', amount: 0.1, archived: true }),
      txn({ accountId: 'a1', amount: 0.2, archived: true }),
      txn({ accountId: 'a1', amount: 999, archived: false }), // live → excluded
      txn({ accountId: 'a2', amount: 5, archived: true }),    // other account → excluded
    ];
    expect(broughtForwardBalance(txns, 'a1', 1)).toBe(1.3); // 1 + 0.1 + 0.2 exactly
  });
});

describe('hasArchived', () => {
  it('detects archived rows overall and per account', () => {
    const txns = [txn({ accountId: 'a1', archived: true }), txn({ accountId: 'a2' })];
    expect(hasArchived(txns)).toBe(true);
    expect(hasArchived(txns, 'a1')).toBe(true);
    expect(hasArchived(txns, 'a2')).toBe(false);
  });
});
