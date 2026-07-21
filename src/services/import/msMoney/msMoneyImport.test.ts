import { describe, it, expect, beforeEach, vi } from 'vitest';
import { planCloudImport, importToLocalStorage } from './msMoneyImport';
import type { MsMoneyImportResult } from './transform';

function sampleResult(): MsMoneyImportResult {
  return {
    accounts: [
      { id: 'mny-acct-1', name: 'Current', type: 'current', balance: 100, openingBalance: 0, currency: 'GBP', isActive: true, lastUpdated: new Date('2020-01-01') },
      { id: 'mny-acct-2', name: 'Savings', type: 'savings', balance: 50, openingBalance: 0, currency: 'GBP', isActive: false, lastUpdated: new Date('2020-01-01') },
    ],
    categories: [
      { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
      { id: 'mny-cat-10', name: 'Food', type: 'expense', level: 'detail', parentId: 'type-expense' },
      { id: 'mny-tofrom-2', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true, accountId: 'mny-acct-2' },
    ],
    transactions: [
      { id: 'mny-txn-100', date: new Date('2020-02-01'), description: 'Shop', amount: -20, type: 'expense', category: 'mny-cat-10', accountId: 'mny-acct-1' },
      // transfer pair 200↔201
      { id: 'mny-txn-200', date: new Date('2020-02-02'), description: 'To savings', amount: -30, type: 'transfer', category: 'mny-tofrom-2', accountId: 'mny-acct-1', transferAccountId: 'mny-acct-2', linkedTransferId: 'mny-txn-201' },
      { id: 'mny-txn-201', date: new Date('2020-02-02'), description: 'From current', amount: 30, type: 'transfer', accountId: 'mny-acct-2', transferAccountId: 'mny-acct-1', linkedTransferId: 'mny-txn-200' },
      // a split parent
      { id: 'mny-txn-300', date: new Date('2020-02-03'), description: 'Split', amount: -50, type: 'expense', category: '', accountId: 'mny-acct-1', isSplit: true },
    ] as MsMoneyImportResult['transactions'],
    transactionSplits: [
      { id: 'mny-split-300-1', transactionId: 'mny-txn-300', category: 'mny-cat-10', amount: -50, sortOrder: 1 },
    ],
    summary: {
      accounts: { total: 2, open: 1, closed: 1 },
      categories: { subs: 0, details: 2, hidden: 0 },
      transactions: { imported: 4, standalone: 1, transfers: 2, splitTransactions: 1, splitLines: 1 },
      simplifications: [],
    },
  };
}

describe('planCloudImport', () => {
  it('remaps every cross-reference onto fresh ids and stages links separately', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);

    // System categories are NOT inserted (they exist per-user already).
    expect(plan.categories).toHaveLength(2);
    expect(plan.categories.some(c => c.name === 'Expense')).toBe(false);

    // account 'current' maps to DB type 'checking'; closed stays is_active:false
    const current = plan.accounts.find(a => a.name === 'Current')!;
    expect(current.type).toBe('checking');
    expect(current.user_id).toBe('user-abc');
    expect(plan.accounts.find(a => a.name === 'Savings')!.is_active).toBe(false);

    // Every account/category/transaction id is a fresh generated id (no mny- ids leak).
    const allIds = [...plan.accounts, ...plan.categories, ...plan.transactions].map(r => String(r.id));
    expect(allIds.every(id => id.startsWith('new-'))).toBe(true);

    // Transactions insert WITHOUT linked_transfer_id; the two transfer legs are staged as links.
    expect(plan.transactions.every(t => !('linked_transfer_id' in t) || t.linked_transfer_id == null)).toBe(true);
    expect(plan.transferLinks).toHaveLength(2);
    // Each link points at the *remapped* counterpart, never the original mny id.
    for (const l of plan.transferLinks) {
      expect(l.id.startsWith('new-')).toBe(true);
      expect(l.linked_transfer_id.startsWith('new-')).toBe(true);
    }

    // Split parent keeps is_split + blank category; its line references the remapped parent + category.
    const splitParent = plan.transactions.find(t => t.is_split === true)!;
    expect(splitParent.category).toBe('');
    expect(plan.splits).toHaveLength(1);
    expect(plan.splits[0].transaction_id).toBe(splitParent.id);
    expect(String(plan.splits[0].category).startsWith('new-')).toBe(true);
  });
});

describe('importToLocalStorage', () => {
  const KEYS = { ACCOUNTS: 'a', TRANSACTIONS: 't', CATEGORIES: 'c', TRANSACTION_SPLITS: 's', BUDGETS: 'b', GOALS: 'g', RECURRING: 'r' };
  beforeEach(() => { window.localStorage.clear(); });

  it('writes the imported collections and clears the rest', async () => {
    const onProgress = vi.fn();
    await importToLocalStorage(sampleResult(), KEYS, { onProgress });

    expect(JSON.parse(window.localStorage.getItem('a')!)).toHaveLength(2);
    expect(JSON.parse(window.localStorage.getItem('t')!)).toHaveLength(4);
    expect(JSON.parse(window.localStorage.getItem('c')!)).toHaveLength(3);
    expect(JSON.parse(window.localStorage.getItem('s')!)).toHaveLength(1);
    // A total migration replaces — the other collections are emptied.
    expect(window.localStorage.getItem('b')).toBe('[]');
    expect(window.localStorage.getItem('g')).toBe('[]');
    expect(window.localStorage.getItem('r')).toBe('[]');
    // progress reaches the terminal phase
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'done', fraction: 1 }));
  });
});
