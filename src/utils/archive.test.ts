import { describe, it, expect } from 'vitest';
import {
  resolveCutoff, isArchivable, archiveImpactByAccount, broughtForwardBalance, hasArchived,
  isOverrideActive, resolveAccountCutoff, parseAccountArchiveOverrides,
  serializeAccountArchiveOverrides, countWithNoun, describeArchiveConsequence,
  type AccountArchiveOverrides,
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

describe('isArchivable / archiveImpactByAccount', () => {
  const cutoff = new Date('2025-01-01');
  it('only reconciled transactions on/before the cutoff qualify', () => {
    expect(isArchivable(txn({ cleared: true, date: new Date('2024-06-01') }), cutoff)).toBe(true);
    // unreconciled → stays live
    expect(isArchivable(txn({ cleared: false, date: new Date('2024-06-01') }), cutoff)).toBe(false);
    // after cutoff → stays live
    expect(isArchivable(txn({ cleared: true, date: new Date('2025-06-01') }), cutoff)).toBe(false);
  });

  it('splits an account’s rows into hidden, still-visible and already-hidden', () => {
    const txns = [
      txn({ id: '1', accountId: 'a1', cleared: true, date: new Date('2024-01-01') }),      // hidden by this run
      txn({ id: '2', accountId: 'a1', cleared: true, date: new Date('2024-01-01'), archived: true }), // already hidden
      txn({ id: '3', accountId: 'a1', cleared: false, date: new Date('2024-01-01') }),     // unreconciled → stays
      txn({ id: '4', accountId: 'a1', cleared: true, date: new Date('2025-06-01') }),      // after cutoff → stays
      txn({ id: '5', accountId: 'a2', cleared: true, date: new Date('2024-01-01') }),      // other account
    ];
    const impacts = archiveImpactByAccount(txns, new Map([['a1', cutoff]]));
    expect(impacts.get('a1')).toEqual({ willHide: 1, remainingVisible: 2, alreadyHidden: 1 });
    // An account nobody asked about is not measured at all.
    expect(impacts.has('a2')).toBe(false);
  });

  it('measures each account against its OWN cutoff in one pass', () => {
    const txns = [
      txn({ id: '1', accountId: 'a1', cleared: true, date: new Date('2024-06-01') }),
      txn({ id: '2', accountId: 'a2', cleared: true, date: new Date('2024-06-01') }),
      txn({ id: '3', accountId: 'a3', cleared: true, date: new Date('2024-06-01') }),
    ];
    const impacts = archiveImpactByAccount(txns, new Map([
      ['a1', new Date('2025-01-01')], // after the row → hides it
      ['a2', new Date('2024-01-01')], // before the row → keeps it
      ['a3', null],                   // "keep all" → hides nothing
    ]));
    expect(impacts.get('a1')?.willHide).toBe(1);
    expect(impacts.get('a2')).toEqual({ willHide: 0, remainingVisible: 1, alreadyHidden: 0 });
    expect(impacts.get('a3')).toEqual({ willHide: 0, remainingVisible: 1, alreadyHidden: 0 });
  });

  it('gives an account with no transactions a zeroed entry rather than none', () => {
    expect(archiveImpactByAccount([], new Map([['a1', new Date('2025-01-01')]])).get('a1'))
      .toEqual({ willHide: 0, remainingVisible: 0, alreadyHidden: 0 });
  });
});

describe('per-account overrides', () => {
  const globalCutoff = new Date('2025-01-01');

  it('needs both a date and the acknowledgement before it counts', () => {
    expect(isOverrideActive(undefined)).toBe(false);
    expect(isOverrideActive({ date: '', acknowledged: true })).toBe(false);
    expect(isOverrideActive({ date: '2023-06-30', acknowledged: false })).toBe(false);
    expect(isOverrideActive({ date: '2023-06-30', acknowledged: true })).toBe(true);
  });

  it('resolves to the account’s own date only when the override is acknowledged', () => {
    expect(resolveAccountCutoff(globalCutoff, undefined)).toEqual({ cutoff: globalCutoff, source: 'global' });
    // Typed but not agreed to — the global choice still rules.
    expect(resolveAccountCutoff(globalCutoff, { date: '2023-06-30', acknowledged: false }))
      .toEqual({ cutoff: globalCutoff, source: 'global' });
    const resolved = resolveAccountCutoff(globalCutoff, { date: '2023-06-30', acknowledged: true });
    expect(resolved.source).toBe('override');
    expect(resolved.cutoff?.toISOString().slice(0, 10)).toBe('2023-06-30');
  });

  it('overrides a global "keep all" too', () => {
    const resolved = resolveAccountCutoff(null, { date: '2023-06-30', acknowledged: true });
    expect(resolved.cutoff?.toISOString().slice(0, 10)).toBe('2023-06-30');
  });

  it('round-trips through storage and drops anything malformed', () => {
    const overrides: AccountArchiveOverrides = { a1: { date: '2023-06-30', acknowledged: true } };
    expect(parseAccountArchiveOverrides(serializeAccountArchiveOverrides(overrides))).toEqual(overrides);
    expect(parseAccountArchiveOverrides(null)).toEqual({});
    expect(parseAccountArchiveOverrides('not json')).toEqual({});
    expect(parseAccountArchiveOverrides('[1,2,3]')).toEqual({});
    // A junk entry is dropped; its well-formed neighbour survives.
    expect(parseAccountArchiveOverrides(JSON.stringify({
      a1: { date: 2023, acknowledged: true },
      a2: { date: '2023-06-30' },
      a3: { date: '2024-01-31', acknowledged: false },
    }))).toEqual({ a3: { date: '2024-01-31', acknowledged: false } });
  });
});

describe('countWithNoun', () => {
  it('agrees the noun with the number and groups the thousands', () => {
    expect(countWithNoun(0)).toBe('0 transactions');
    expect(countWithNoun(1)).toBe('1 transaction');
    expect(countWithNoun(1204)).toBe('1,204 transactions');
    expect(countWithNoun(1, 'account')).toBe('1 account');
    expect(countWithNoun(25, 'account')).toBe('25 accounts');
  });
});

describe('describeArchiveConsequence', () => {
  const cutoff = new Date('2024-06-30');

  it('names what goes AND what is left, not just the size of the action', () => {
    const said = describeArchiveConsequence({ willHide: 1204, remainingVisible: 96, alreadyHidden: 0 }, cutoff);
    expect(said).toContain('Hides 1,204 transactions');
    expect(said).toContain('30/06/2024');           // UK format, from the shared formatter
    expect(said).toContain('96 transactions stay visible');
  });

  it('says nothing would happen when no cutoff is chosen', () => {
    expect(describeArchiveConsequence({ willHide: 5, remainingVisible: 5, alreadyHidden: 0 }, null))
      .toBe('No cutoff chosen — nothing would be hidden.');
  });

  it('distinguishes "nothing qualifies" from "nothing is there"', () => {
    // Rows exist, none of them reconciled on/before the date.
    expect(describeArchiveConsequence({ willHide: 0, remainingVisible: 42, alreadyHidden: 0 }, cutoff))
      .toBe('Nothing reconciled on or before that date — all 42 transactions stay visible.');
    // The register is already empty (everything hidden by an earlier run, or no rows at all).
    expect(describeArchiveConsequence({ willHide: 0, remainingVisible: 0, alreadyHidden: 7 }, cutoff))
      .toBe('Nothing left to hide in this account.');
  });

  it('agrees the verb with the count, so one row does not "stay visible"', () => {
    expect(describeArchiveConsequence({ willHide: 1, remainingVisible: 1, alreadyHidden: 0 }, cutoff))
      .toBe('Hides 1 transaction dated on or before 30/06/2024; 1 transaction stays visible.');
    expect(describeArchiveConsequence({ willHide: 0, remainingVisible: 1, alreadyHidden: 0 }, cutoff))
      .toBe('Nothing reconciled on or before that date — 1 transaction stays visible.');
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
