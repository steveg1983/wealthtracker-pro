import { describe, it, expect } from 'vitest';
import {
  categoryIdIsTransferFiling,
  classifyTransferCategoryChoice,
  findMismatchedTransferFilings,
  isTransferFiling,
  transferTargetAccountFor,
} from './transferCoherence';
import type { Category, Transaction } from '../types';

/**
 * The rule every writer reads: a transfer category and a transfer type must
 * never disagree.
 *
 * Every account, payee and figure below is invented — this repo is public.
 */

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-greengrocer', name: 'Greengrocer', type: 'expense', level: 'detail', parentId: 'grp-food' },
  // The Transfer anchor and the two legacy sentinels that hang off it: they
  // say "transfer" and never say to WHERE.
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
  { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer' },
  // The account-managed To/From categories, which do.
  {
    id: 'tofrom-thrift', name: 'To/From Thistle Thrift', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-thrift',
  },
  {
    id: 'tofrom-daily', name: 'To/From Daily', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-daily',
  },
];

const row = (over: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction => ({
  date: new Date('2026-03-04'),
  description: 'Invented row',
  amount: -25,
  category: 'det-greengrocer',
  accountId: 'acc-daily',
  type: 'expense',
  cleared: false,
  ...over,
});

describe('isTransferFiling', () => {
  it('is true for an account-managed To/From category', () => {
    expect(isTransferFiling(CATEGORIES.find(c => c.id === 'tofrom-thrift'))).toBe(true);
  });

  it('is true for the legacy sentinels under the Transfer root', () => {
    // These carry no isTransferCategory flag, but every report treats them as
    // transfers (categoryKindOf reads the parent), so the writers must too.
    expect(isTransferFiling(CATEGORIES.find(c => c.id === 'transfer-out'))).toBe(true);
  });

  it('is false for an ordinary category and for nothing at all', () => {
    expect(isTransferFiling(CATEGORIES.find(c => c.id === 'det-greengrocer'))).toBe(false);
    expect(isTransferFiling(undefined)).toBe(false);
  });

  it('answers by id against a category list, blanks included', () => {
    expect(categoryIdIsTransferFiling(CATEGORIES, 'tofrom-daily')).toBe(true);
    expect(categoryIdIsTransferFiling(CATEGORIES, 'det-greengrocer')).toBe(false);
    expect(categoryIdIsTransferFiling(CATEGORIES, '')).toBe(false);
    expect(categoryIdIsTransferFiling(CATEGORIES, undefined)).toBe(false);
  });
});

describe('transferTargetAccountFor', () => {
  it('names the account a To/From category belongs to', () => {
    expect(transferTargetAccountFor(CATEGORIES, 'tofrom-thrift')).toBe('acc-thrift');
  });

  it('names nothing for a sentinel — that is the whole point of the distinction', () => {
    expect(transferTargetAccountFor(CATEGORIES, 'transfer-out')).toBeUndefined();
  });

  it('names nothing for an ordinary category', () => {
    expect(transferTargetAccountFor(CATEGORIES, 'det-greengrocer')).toBeUndefined();
  });
});

describe('classifyTransferCategoryChoice', () => {
  it('passes an ordinary category straight through', () => {
    expect(classifyTransferCategoryChoice(CATEGORIES, 'det-greengrocer', 'acc-daily'))
      .toEqual({ kind: 'not-a-transfer' });
  });

  it('converts a To/From category naming another account', () => {
    expect(classifyTransferCategoryChoice(CATEGORIES, 'tofrom-thrift', 'acc-daily'))
      .toEqual({ kind: 'convert', targetAccountId: 'acc-thrift' });
  });

  it('refuses the row’s OWN account’s To/From category, and says which', () => {
    const choice = classifyTransferCategoryChoice(CATEGORIES, 'tofrom-daily', 'acc-daily');
    expect(choice.kind).toBe('refuse');
    if (choice.kind !== 'refuse') throw new Error('expected a refusal');
    expect(choice.message).toContain('own transfer category');
  });

  it('refuses a transfer filing that names no account at all', () => {
    const choice = classifyTransferCategoryChoice(CATEGORIES, 'transfer-out', 'acc-daily');
    expect(choice.kind).toBe('refuse');
    if (choice.kind !== 'refuse') throw new Error('expected a refusal');
    // The user is told what is missing and where to supply it, not that
    // something went wrong.
    expect(choice.message).toContain('Transfer');
    expect(choice.message).toContain('account the money moved to');
  });
});

describe('findMismatchedTransferFilings', () => {
  it('finds a row typed income that is filed under a transfer category', () => {
    const rows = [
      row({ id: 'mismatch', type: 'income', amount: 120, category: 'tofrom-thrift' }),
      row({ id: 'ordinary' }),
    ];
    expect(findMismatchedTransferFilings(rows, CATEGORIES).map(t => t.id)).toEqual(['mismatch']);
  });

  it('finds one filed under a legacy sentinel too', () => {
    const rows = [row({ id: 'sentinel', type: 'expense', category: 'transfer-out' })];
    expect(findMismatchedTransferFilings(rows, CATEGORIES).map(t => t.id)).toEqual(['sentinel']);
  });

  it('leaves real transfers alone — their type and category agree', () => {
    const rows = [row({ id: 'real', type: 'transfer', category: 'tofrom-thrift' })];
    expect(findMismatchedTransferFilings(rows, CATEGORIES)).toEqual([]);
  });

  it('leaves a LINKED row alone: it has its other side, so nothing is stranded', () => {
    const rows = [
      row({ id: 'linked', type: 'income', amount: 40, category: 'tofrom-thrift', linkedTransferId: 'other' }),
    ];
    expect(findMismatchedTransferFilings(rows, CATEGORIES)).toEqual([]);
  });

  it('leaves SPLIT parents alone: a split files itself in its lines', () => {
    // And split LINES are never examined at all — the expansion gives each one
    // an income/expense type from its sign, so a legitimate Money split
    // transfer leg would otherwise be reported as broken.
    const rows = [row({ id: 'split', type: 'expense', category: 'tofrom-thrift', isSplit: true })];
    expect(findMismatchedTransferFilings(rows, CATEGORIES)).toEqual([]);
  });

  it('is empty when the user has no transfer categories at all', () => {
    const rows = [row({ id: 'anything', category: 'det-greengrocer' })];
    expect(findMismatchedTransferFilings(rows, [])).toEqual([]);
  });
});
