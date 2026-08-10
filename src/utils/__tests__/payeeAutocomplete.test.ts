import { describe, it, expect } from 'vitest';
import {
  buildPayeeCompletionIndex,
  findPayeeCompletion,
  rememberedCategoryForPayee,
} from '../payeeAutocomplete';
import type { Category, Transaction } from '../../types';

/**
 * The payee list behind the register's ghost completion, and the memory behind
 * the category it offers with it.
 *
 * Every payee, category and figure below is invented — this repo is public.
 */

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-takeaway', name: 'Takeaway', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'grp-earnings', name: 'Earnings', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'det-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'grp-earnings' },
];

let nextId = 0;
const row = (over: Partial<Transaction>): Transaction => ({
  id: `txn-${(nextId++).toString().padStart(3, '0')}`,
  date: new Date('2026-03-01'),
  description: 'Marrow & Vine',
  amount: -10,
  type: 'expense',
  category: 'det-groceries',
  accountId: 'acc-one',
  cleared: false,
  ...over,
});

describe('buildPayeeCompletionIndex — who the user actually pays', () => {
  it('ranks the most-used payee first, however recent the others are', () => {
    const index = buildPayeeCompletionIndex([
      row({ description: 'Marrow & Vine', date: new Date('2026-01-01') }),
      row({ description: 'Marrow & Vine', date: new Date('2026-01-02') }),
      row({ description: 'Marrow & Vine', date: new Date('2026-01-03') }),
      row({ description: 'Marchbank Cycles', date: new Date('2026-06-30') }),
    ]);

    expect(index.map(entry => entry.text)).toEqual(['Marrow & Vine', 'Marchbank Cycles']);
  });

  it('breaks a tie on how recently the payee was used', () => {
    const index = buildPayeeCompletionIndex([
      row({ description: 'Marchbank Cycles', date: new Date('2026-01-05') }),
      row({ description: 'Marlow Post Office', date: new Date('2026-05-05') }),
    ]);

    expect(index.map(entry => entry.text)).toEqual(['Marlow Post Office', 'Marchbank Cycles']);
  });

  it('keeps the payee spelled exactly as the transactions spell it', () => {
    const index = buildPayeeCompletionIndex([row({ description: '  MARROW & VINE  ' })]);

    // Trimmed of the padding, but not re-cased: accepting writes this string.
    expect(index[0]).toEqual({ text: 'MARROW & VINE', lower: 'marrow & vine' });
  });

  it('leaves out blanks and the bank-sync placeholder', () => {
    const index = buildPayeeCompletionIndex([
      row({ description: '   ' }),
      row({ description: 'Bank Transaction' }),
      row({ description: 'Marrow & Vine' }),
    ]);

    expect(index.map(entry => entry.text)).toEqual(['Marrow & Vine']);
  });

  it('survives a row whose date cannot be read', () => {
    const index = buildPayeeCompletionIndex([
      row({ description: 'Marchbank Cycles', date: new Date('not a date') }),
      row({ description: 'Marlow Post Office', date: new Date('2026-02-02') }),
    ]);

    expect(index.map(entry => entry.text)).toEqual(['Marlow Post Office', 'Marchbank Cycles']);
  });
});

describe('findPayeeCompletion — what continues what was typed', () => {
  const index = buildPayeeCompletionIndex([
    row({ description: 'Marrow & Vine' }),
    row({ description: 'Marrow & Vine' }),
    row({ description: 'Marchbank Cycles' }),
  ]);

  it('completes a prefix, ignoring case', () => {
    expect(findPayeeCompletion('mar', index)).toBe('Marrow & Vine');
    expect(findPayeeCompletion('MARC', index)).toBe('Marchbank Cycles');
  });

  it('narrows as more is typed', () => {
    expect(findPayeeCompletion('Marr', index)).toBe('Marrow & Vine');
    expect(findPayeeCompletion('Marc', index)).toBe('Marchbank Cycles');
  });

  it('offers nothing for an empty box', () => {
    expect(findPayeeCompletion('', index)).toBeNull();
  });

  it('offers nothing once the typing has broken the match', () => {
    expect(findPayeeCompletion('Marz', index)).toBeNull();
  });

  it('offers nothing when there is no remainder left to draw', () => {
    expect(findPayeeCompletion('Marrow & Vine', index)).toBeNull();
  });
});

describe('rememberedCategoryForPayee — the category this payee usually gets', () => {
  it('takes the most common filing, not the most recent one', () => {
    const history: Transaction[] = [
      row({ description: 'Marrow & Vine', category: 'det-groceries', date: new Date('2026-01-01') }),
      row({ description: 'Marrow & Vine', category: 'det-groceries', date: new Date('2026-01-02') }),
      row({ description: 'Marrow & Vine', category: 'det-takeaway', date: new Date('2026-09-09') }),
    ];

    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Marrow & Vine', 'expense'))
      .toBe('det-groceries');
  });

  it('breaks a tie on the most recent filing', () => {
    const history: Transaction[] = [
      row({ description: 'Marrow & Vine', category: 'det-groceries', date: new Date('2026-01-01') }),
      row({ description: 'Marrow & Vine', category: 'det-takeaway', date: new Date('2026-08-01') }),
    ];

    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Marrow & Vine', 'expense'))
      .toBe('det-takeaway');
  });

  it('matches the payee the way the rest of payee memory does — trimmed and case-blind', () => {
    const history: Transaction[] = [
      row({ description: 'MARROW & VINE', category: 'det-groceries' }),
    ];

    expect(rememberedCategoryForPayee(history, CATEGORIES, '  marrow & vine ', 'expense'))
      .toBe('det-groceries');
  });

  it('keeps the two directions apart', () => {
    const history: Transaction[] = [
      row({ description: 'Halgrove Studio', category: 'det-salary', amount: 900, type: 'income' }),
      row({ description: 'Halgrove Studio', category: 'det-takeaway' }),
    ];

    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Halgrove Studio', 'income'))
      .toBe('det-salary');
    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Halgrove Studio', 'expense'))
      .toBe('det-takeaway');
  });

  it('classifies a refund by its CATEGORY, not by which way the money moved', () => {
    // Money IN, filed under an expense category: an expense credit, and the
    // next one from this payee should be offered that same expense category.
    const history: Transaction[] = [
      row({
        description: 'Marrow & Vine',
        category: 'det-groceries',
        amount: 12,
        type: 'income',
      }),
    ];

    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Marrow & Vine', 'expense'))
      .toBe('det-groceries');
    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Marrow & Vine', 'income'))
      .toBeUndefined();
  });

  it('remembers nothing about a payee that has never been filed', () => {
    const history: Transaction[] = [
      row({ description: 'Marrow & Vine', category: '' }),
      row({ description: 'Marrow & Vine', category: 'no-such-category' }),
    ];

    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Marrow & Vine', 'expense'))
      .toBeUndefined();
  });

  it('never remembers a transfer', () => {
    const history: Transaction[] = [
      row({ description: 'Marrow & Vine', category: 'transfer-out', type: 'transfer' }),
    ];

    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Marrow & Vine', 'expense'))
      .toBeUndefined();
  });

  it('has nothing to say about a blank payee or the bank-sync placeholder', () => {
    const history: Transaction[] = [row({ description: 'Bank Transaction' })];

    expect(rememberedCategoryForPayee(history, CATEGORIES, '', 'expense')).toBeUndefined();
    expect(rememberedCategoryForPayee(history, CATEGORIES, 'Bank Transaction', 'expense'))
      .toBeUndefined();
  });
});
