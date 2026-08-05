import { describe, it, expect } from 'vitest';
import { isDuplicateImport, isSameImportedTransaction } from './importDedupe';

/**
 * The bug this covers: both import wizards compared `t.date === candidate.date`
 * with two Date OBJECTS, which is an identity check and was therefore false for
 * every pair ever compared. Re-importing a statement doubled the register.
 */
describe('isSameImportedTransaction', () => {
  const existing = {
    date: new Date('2026-08-15'),
    amount: -42.5,
    description: 'Synthetic merchant'
  };

  it('matches two rows with equal dates held in different Date objects', () => {
    expect(
      isSameImportedTransaction(existing, {
        date: new Date('2026-08-15'),
        amount: -42.5,
        description: 'Synthetic merchant'
      })
    ).toBe(true);
  });

  it('matches a date that arrived as the wire string', () => {
    expect(
      isSameImportedTransaction(existing, {
        date: '2026-08-15',
        amount: -42.5,
        description: 'Synthetic merchant'
      })
    ).toBe(true);
  });

  it('does not match a different day', () => {
    expect(
      isSameImportedTransaction(existing, { ...existing, date: new Date('2026-08-16') })
    ).toBe(false);
  });

  it('does not match a different amount or description', () => {
    expect(isSameImportedTransaction(existing, { ...existing, amount: -42.51 })).toBe(false);
    expect(isSameImportedTransaction(existing, { ...existing, description: 'Something else' })).toBe(false);
  });

  it('compares amounts exactly, without floating-point drift', () => {
    expect(
      isSameImportedTransaction(
        { ...existing, amount: 0.1 + 0.2 },
        { ...existing, amount: 0.3 }
      )
    ).toBe(false);
  });

  it('never calls a row with an unreadable date a duplicate', () => {
    const unreadable = { ...existing, date: 'not a date' };
    expect(isSameImportedTransaction(unreadable, unreadable)).toBe(false);
  });

  it('never calls a row with no amount a duplicate', () => {
    expect(isSameImportedTransaction(existing, { date: existing.date, description: existing.description })).toBe(false);
  });
});

describe('isDuplicateImport', () => {
  it('finds the match anywhere in the existing rows', () => {
    const existing = [
      { date: new Date('2026-08-01'), amount: -10, description: 'One' },
      { date: new Date('2026-08-02'), amount: -20, description: 'Two' }
    ];

    expect(isDuplicateImport(existing, { date: new Date('2026-08-02'), amount: -20, description: 'Two' })).toBe(true);
    expect(isDuplicateImport(existing, { date: new Date('2026-08-03'), amount: -20, description: 'Two' })).toBe(false);
  });

  it('is false against nothing', () => {
    expect(isDuplicateImport([], { date: new Date('2026-08-02'), amount: -20, description: 'Two' })).toBe(false);
  });
});
