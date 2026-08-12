import { describe, it, expect } from 'vitest';
import { accountHasHistory } from './accountHistory';
import type { Transaction } from '../types';

const row = (overrides: Partial<Transaction> & { accountId: string }): Transaction => ({
  id: 't1',
  date: new Date('2026-03-01'),
  amount: -25,
  description: 'Tesco',
  category: 'cat-1',
  type: 'expense',
  ...overrides,
});

describe('accountHasHistory', () => {
  it('is false for an account nothing has been recorded in', () => {
    expect(accountHasHistory([row({ id: 'a', accountId: 'other' })], 'empty')).toBe(false);
  });

  it('is true as soon as one row names the account', () => {
    expect(accountHasHistory([row({ id: 'a', accountId: 'acc-1' })], 'acc-1')).toBe(true);
  });

  it('counts ARCHIVED rows as history', () => {
    // Archiving hides a row from the live register; it does not un-record the
    // money. Treating an archived-away account as empty would licence exactly
    // the re-denomination this guards.
    expect(
      accountHasHistory([row({ id: 'a', accountId: 'acc-1', archived: true })], 'acc-1')
    ).toBe(true);
  });

  it('counts a split parent, which is how split history reaches an account', () => {
    expect(
      accountHasHistory([row({ id: 'a', accountId: 'acc-1', isSplit: true })], 'acc-1')
    ).toBe(true);
  });

  it('is false for no account at all rather than matching a blank accountId', () => {
    expect(accountHasHistory([row({ id: 'a', accountId: '' })], '')).toBe(false);
  });
});
