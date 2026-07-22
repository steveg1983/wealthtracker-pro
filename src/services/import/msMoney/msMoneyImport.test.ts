import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  planCloudImport, importToLocalStorage, wipeLocalData,
  MS_MONEY_IMPORT_SOURCE, IMPORT_PROVENANCE_CONFLICT,
} from './msMoneyImport';
import type { MsMoneyImportResult } from './transform';

function sampleResult(): MsMoneyImportResult {
  return {
    accounts: [
      { id: 'mny-acct-1', name: 'Current', type: 'current', balance: 100, openingBalance: 0, currency: 'GBP', isActive: true, lastUpdated: new Date('2020-01-01') },
      { id: 'mny-acct-2', name: 'Savings', type: 'savings', balance: 50, openingBalance: 0, currency: 'GBP', isActive: false, lastUpdated: new Date('2020-01-01') },
      // investment↔cash pair (Money's hacctRel): the cash side carries the parent ref
      { id: 'mny-acct-3', name: 'Broker', type: 'investment', balance: 0, openingBalance: 0, currency: 'GBP', isActive: true, lastUpdated: new Date('2020-01-01') },
      { id: 'mny-acct-4', name: 'Broker (Cash)', type: 'current', parentAccountId: 'mny-acct-3', balance: 25, openingBalance: 0, currency: 'GBP', isActive: true, lastUpdated: new Date('2020-01-01') },
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
      accounts: { total: 4, open: 3, closed: 1, investmentCashPairs: 1 },
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

    // Accounts insert WITHOUT parent_account_id; the investment↔cash pairing
    // is staged as a second pass against the remapped ids.
    expect(plan.accounts.every(a => !('parent_account_id' in a))).toBe(true);
    expect(plan.accountParents).toHaveLength(1);
    const broker = plan.accounts.find(a => a.name === 'Broker')!;
    const brokerCash = plan.accounts.find(a => a.name === 'Broker (Cash)')!;
    expect(plan.accountParents[0]).toEqual({ id: brokerCash.id, parent_account_id: broker.id });

    // Split parent keeps is_split + blank category; its line references the remapped parent + category.
    const splitParent = plan.transactions.find(t => t.is_split === true)!;
    expect(splitParent.category).toBe('');
    expect(plan.splits).toHaveLength(1);
    expect(plan.splits[0].transaction_id).toBe(splitParent.id);
    expect(String(plan.splits[0].category).startsWith('new-')).toBe(true);
  });
});

describe('planCloudImport — import provenance / idempotency', () => {
  it('stamps every transaction with its stable source id', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);

    expect(plan.transactions).toHaveLength(4);
    for (const t of plan.transactions) {
      expect(t.import_source).toBe(MS_MONEY_IMPORT_SOURCE);
      expect(String(t.import_source_id)).toMatch(/^mny-txn-\d+$/);
    }
    // The source ids are unique — they are what the unique index keys on, so a
    // collision here would make the import unrunnable rather than idempotent.
    const sourceIds = plan.transactions.map(t => String(t.import_source_id));
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(plan.skippedExisting).toBe(0);

    // The conflict target names exactly the unique index's columns.
    expect(IMPORT_PROVENANCE_CONFLICT).toBe('user_id,import_source,import_source_id');
  });

  it('re-running against rows already imported inserts nothing and reuses their ids', () => {
    // Everything the first run wrote, keyed by source id → the id it already has.
    const existing = new Map([
      ['mny-txn-100', 'db-100'],
      ['mny-txn-200', 'db-200'],
      ['mny-txn-201', 'db-201'],
      ['mny-txn-300', 'db-300'],
    ]);
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, { existingBySourceId: existing });

    // Nothing to insert — the second run is a no-op for transactions…
    expect(plan.transactions).toHaveLength(0);
    expect(plan.skippedExisting).toBe(4);
    // …and for the split lines hanging off an already-imported parent.
    expect(plan.splits).toHaveLength(0);

    // Cross-references still resolve, but to the EXISTING row ids.
    expect(plan.transferLinks).toEqual([
      { id: 'db-200', linked_transfer_id: 'db-201' },
      { id: 'db-201', linked_transfer_id: 'db-200' },
    ]);
  });

  it('a partial re-run inserts only the rows that are missing', () => {
    const existing = new Map([['mny-txn-100', 'db-100'], ['mny-txn-200', 'db-200']]);
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, { existingBySourceId: existing });

    expect(plan.transactions.map(t => t.import_source_id)).toEqual(['mny-txn-201', 'mny-txn-300']);
    expect(plan.skippedExisting).toBe(2);
    // The split parent is new, so its line is inserted and points at the new id.
    expect(plan.splits).toHaveLength(1);
    const splitParent = plan.transactions.find(t => t.import_source_id === 'mny-txn-300')!;
    expect(plan.splits[0].transaction_id).toBe(splitParent.id);
    // The surviving leg still links to the row that is already there.
    expect(plan.transferLinks).toContainEqual({ id: 'db-200', linked_transfer_id: plan.transactions.find(t => t.import_source_id === 'mny-txn-201')!.id });
  });

  it('never writes the bank feed\'s provenance columns', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`);
    // external_transaction_id / external_provider / connection_id belong to the
    // bank feed; import_bank_transactions_atomic keys its dedupe AND its
    // backfill-rebase decision off them.
    for (const t of plan.transactions) {
      expect('external_transaction_id' in t).toBe(false);
      expect('external_provider' in t).toBe(false);
      expect('connection_id' in t).toBe(false);
    }
  });
});

describe('planCloudImport — bank-feed overlap suppression', () => {
  it('drops the Money rows the feed already covers, and nothing else', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-100']),
    });

    expect(plan.transactions.map(t => t.import_source_id)).toEqual([
      'mny-txn-200', 'mny-txn-201', 'mny-txn-300',
    ]);
    expect(plan.skippedFeedOverlap).toBe(1);
    expect(plan.skippedExisting).toBe(0);
    // The transfer pair is untouched — suppression never strands a leg.
    expect(plan.transferLinks).toHaveLength(2);
    // The split parent survived, so its line still goes in.
    expect(plan.splits).toHaveLength(1);
  });

  it('drops a suppressed split parent together with its lines', () => {
    let n = 0;
    const plan = planCloudImport(sampleResult(), 'user-abc', () => `new-${n++}`, {
      suppressedSourceIds: new Set(['mny-txn-300']),
    });
    expect(plan.transactions.map(t => t.import_source_id)).not.toContain('mny-txn-300');
    // No orphaned split line pointing at a row that was never written.
    expect(plan.splits).toHaveLength(0);
    expect(plan.skippedFeedOverlap).toBe(1);
  });
});

describe('wipeLocalData', () => {
  it('empties every financial collection', () => {
    const KEYS = { ACCOUNTS: 'a', TRANSACTIONS: 't', CATEGORIES: 'c', TRANSACTION_SPLITS: 's', BUDGETS: 'b', GOALS: 'g', RECURRING: 'r' };
    for (const k of Object.values(KEYS)) window.localStorage.setItem(k, '[{"id":"x"}]');
    wipeLocalData(KEYS);
    for (const k of Object.values(KEYS)) expect(window.localStorage.getItem(k)).toBe('[]');
  });
});

describe('importToLocalStorage', () => {
  const KEYS = { ACCOUNTS: 'a', TRANSACTIONS: 't', CATEGORIES: 'c', TRANSACTION_SPLITS: 's', BUDGETS: 'b', GOALS: 'g', RECURRING: 'r' };
  beforeEach(() => { window.localStorage.clear(); });

  it('writes the imported collections and clears the rest', async () => {
    const onProgress = vi.fn();
    await importToLocalStorage(sampleResult(), KEYS, { onProgress });

    expect(JSON.parse(window.localStorage.getItem('a')!)).toHaveLength(4);
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
