import { describe, it, expect } from 'vitest';
import { findSamePayeeUncategorized, normalizePayee, FALLBACK_BANK_DESCRIPTION } from '../payeeAutoCategorize';
import type { Transaction } from '../../types';

const txn = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  date: new Date('2026-01-01'),
  amount: -23.8,
  description: 'O2',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  cleared: false,
  ...overrides,
});

describe('normalizePayee', () => {
  it('uppercases and trims so matching mirrors the SQL side', () => {
    expect(normalizePayee('  o2  ')).toBe('O2');
    expect(normalizePayee('Pizza Federicci Sevenoaks')).toBe('PIZZA FEDERICCI SEVENOAKS');
  });
});

describe('findSamePayeeUncategorized', () => {
  const transactions: Transaction[] = [
    txn({ id: 'a', description: 'O2', category: '' }),
    txn({ id: 'b', description: 'o2 ', category: undefined as unknown as string }),
    txn({ id: 'c', description: 'O2', category: 'cat-mobile' }),          // already categorized
    txn({ id: 'd', description: 'O2', accountId: 'acc-2' }),              // different account
    txn({ id: 'e', description: 'VODAFONE', category: '' }),              // different payee
    txn({ id: 'f', description: 'O2', category: '' }),
    txn({ id: 'g', description: 'O2', type: 'income', category: '' }),    // refund — other direction
    txn({ id: 'h', description: 'Bank transaction', category: '' }),      // sentinel description
  ];

  it('returns uncategorized same-payee same-direction transactions in the same account', () => {
    expect(findSamePayeeUncategorized(transactions, 'acc-1', 'O2', 'expense')).toEqual(['a', 'b', 'f']);
  });

  it('matches case- and whitespace-insensitively', () => {
    expect(findSamePayeeUncategorized(transactions, 'acc-1', '  o2', 'expense')).toEqual(['a', 'b', 'f']);
  });

  it('never returns transactions that already have a category', () => {
    expect(findSamePayeeUncategorized(transactions, 'acc-1', 'O2', 'expense')).not.toContain('c');
  });

  it('never crosses transaction direction (an expense category stays off income rows)', () => {
    expect(findSamePayeeUncategorized(transactions, 'acc-1', 'O2', 'expense')).not.toContain('g');
    expect(findSamePayeeUncategorized(transactions, 'acc-1', 'O2', 'income')).toEqual(['g']);
  });

  it('excludes the transaction being edited', () => {
    expect(findSamePayeeUncategorized(transactions, 'acc-1', 'O2', 'expense', 'a')).toEqual(['b', 'f']);
  });

  it('is scoped to the given account', () => {
    expect(findSamePayeeUncategorized(transactions, 'acc-2', 'O2', 'expense')).toEqual(['d']);
  });

  it('returns nothing for a blank description', () => {
    expect(findSamePayeeUncategorized(transactions, 'acc-1', '   ', 'expense')).toEqual([]);
  });

  it('never matches on the bank-sync fallback description sentinel', () => {
    // 'Bank transaction' stands in for MANY unrelated merchants — propagating
    // through it would categorize rent as groceries.
    expect(findSamePayeeUncategorized(transactions, 'acc-1', 'Bank transaction', 'expense')).toEqual([]);
    expect(normalizePayee('Bank transaction')).toBe(FALLBACK_BANK_DESCRIPTION);
  });
});
