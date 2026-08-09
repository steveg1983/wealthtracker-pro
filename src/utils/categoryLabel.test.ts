import { describe, it, expect } from 'vitest';
import { createCategoryLabeller } from './categoryLabel';
import type { Account, Category } from '../types';

/**
 * The one resolver behind the register's Category column — the cell and the
 * sort both read it, which is the only reason a column sorted by Category now
 * matches what a column headed Category says.
 *
 * Every name below is invented: this repo is public.
 */

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'orphan', name: 'Orphaned Detail', type: 'expense', level: 'detail', parentId: 'grp-vanished' },
  {
    id: 'cat-to-from-savings', name: 'To/From Synthetic Savings', type: 'both', level: 'detail',
    isTransferCategory: true, accountId: 'acc-savings',
  },
];

const SAVINGS: Account = {
  id: 'acc-savings', name: 'Synthetic Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'),
};

const labelFor = createCategoryLabeller(CATEGORIES, [SAVINGS]);

describe('createCategoryLabeller', () => {
  it('shows a filed row as its whole path, parent and leaf', () => {
    // The leaf alone was the old sort key, and it is why a register sorted by
    // Category read Food > Groceries, Home > Insurance, Bills > Water: ordered
    // by a word the column never showed.
    expect(labelFor({ category: 'det-groceries' })).toBe('Food > Groceries');
  });

  it('shows a top-level category as its own name', () => {
    expect(labelFor({ category: 'grp-food' })).toBe('Expenses > Food');
    expect(labelFor({ category: 'type-expense' })).toBe('Expenses');
  });

  it('falls back to the leaf when the parent is missing', () => {
    expect(labelFor({ category: 'orphan' })).toBe('Orphaned Detail');
  });

  it('shows a hand-entered transfer as where the money went', () => {
    // 'transfer-out'/'transfer-in' are literal ids, not category ids — the
    // quick-add dock and the edit modal write them when the other account has
    // no To/From category of its own.
    expect(labelFor({ category: 'transfer-out', type: 'transfer', transferAccountId: 'acc-savings' }))
      .toBe('Transfer > Synthetic Savings');
    expect(labelFor({ category: 'transfer-in', type: 'transfer', transferAccountId: 'acc-savings' }))
      .toBe('Transfer > Synthetic Savings');
  });

  it('names an account it cannot find rather than showing a raw id', () => {
    expect(labelFor({ category: 'transfer-out', type: 'transfer', transferAccountId: 'acc-closed' }))
      .toBe('Transfer > Unknown');
  });

  it('shows an account-managed transfer category by its own name', () => {
    expect(labelFor({ category: 'cat-to-from-savings', type: 'transfer', transferAccountId: 'acc-savings' }))
      .toBe('To/From Synthetic Savings');
  });

  it('says nothing for a row with no category, and nothing for one that resolves to nothing', () => {
    expect(labelFor({ category: '' })).toBe('');
    // A uuid whose category has been deleted, and a slug from an old import:
    // neither is a categorisation the user made, so neither is shown as one.
    expect(labelFor({ category: '11111111-2222-3333-4444-555555555555' })).toBe('');
    expect(labelFor({ category: 'online-shopping' })).toBe('');
  });

  it('does not let one row\'s answer be handed to another', () => {
    // The cache is keyed by everything the answer depends on. A transfer to one
    // account and a transfer to another share a category id and must not share
    // a label — which is the way a memo like this goes wrong.
    const otherAccount: Account = {
      id: 'acc-holiday', name: 'Holiday Fund', type: 'savings', balance: 0,
      currency: 'GBP', lastUpdated: new Date('2026-01-01'),
    };
    const twoAccounts = createCategoryLabeller(CATEGORIES, [SAVINGS, otherAccount]);
    const transfer = { category: 'transfer-out', type: 'transfer' as const };

    expect(twoAccounts({ ...transfer, transferAccountId: 'acc-savings' })).toBe('Transfer > Synthetic Savings');
    expect(twoAccounts({ ...transfer, transferAccountId: 'acc-holiday' })).toBe('Transfer > Holiday Fund');
    // …and back again, off the cache this time.
    expect(twoAccounts({ ...transfer, transferAccountId: 'acc-savings' })).toBe('Transfer > Synthetic Savings');
    // A row that carries the same id without being a transfer resolves as the
    // category it is not: nothing.
    expect(twoAccounts({ category: 'transfer-out', type: 'expense' })).toBe('');
  });
});
