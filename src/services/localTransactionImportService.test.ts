import { describe, it, expect, vi } from 'vitest';
import { importTransactionsLocally, type LocalTransactionImportStore } from './localTransactionImportService';
import { STORAGE_KEYS } from './storageAdapter';
import type { Account, Transaction } from '../types';

/**
 * Invented data throughout — a small current account with one row already in
 * it, and a three-line statement that reads like a real day: two payments out,
 * then an evening sweep in that returns the balance to where it started.
 */
const heldAccount: Account = {
  id: 'acc-current',
  name: 'Everyday Account',
  type: 'current',
  balance: 100,
  currency: 'GBP',
  lastUpdated: new Date('2024-02-01')
};

const heldTransaction: Transaction = {
  id: 'txn-existing',
  date: new Date('2024-02-01'),
  description: 'OPENING ENTRY',
  amount: 100,
  type: 'income',
  accountId: 'acc-current',
  category: '',
  cleared: true
};

const statement: Omit<Transaction, 'id'>[] = [
  {
    date: new Date('2024-02-05'),
    description: 'DIRECT DEBIT THAMES WATER',
    amount: -12.75,
    type: 'expense',
    accountId: 'acc-current',
    category: '',
    cleared: false,
    statementSequence: 0
  },
  {
    date: new Date('2024-02-05'),
    description: 'STANDING ORDER OUT',
    amount: -300,
    type: 'transfer',
    accountId: 'acc-current',
    category: '',
    cleared: false,
    statementSequence: 1
  },
  {
    date: new Date('2024-02-05'),
    description: 'TWO WAY SWEEP IN',
    amount: 312.75,
    type: 'transfer',
    accountId: 'acc-current',
    category: '',
    cleared: false,
    statementSequence: 2
  }
];

interface StoreHarness {
  store: LocalTransactionImportStore;
  setMany: ReturnType<typeof vi.fn>;
}

/**
 * Browser storage is an untyped key/value store, so the harness holds `unknown`
 * — which also lets a test seed the JSON-shaped rows storage really returns
 * (dates as strings) without pretending they are already Transactions.
 */
const makeStore = (
  overrides: {
    setMany?: LocalTransactionImportStore['setMany'];
    accounts?: readonly unknown[];
    transactions?: readonly unknown[];
  } = {}
): StoreHarness => {
  const contents = new Map<string, unknown>([
    [STORAGE_KEYS.ACCOUNTS, overrides.accounts ?? [heldAccount]],
    [STORAGE_KEYS.TRANSACTIONS, overrides.transactions ?? [heldTransaction]]
  ]);
  const setMany = vi.fn(overrides.setMany ?? (async () => undefined));
  return {
    setMany,
    store: {
      // The single cast the storage port's own signature requires, and the one
      // the real adapter makes too. Everything read back below is checked at
      // runtime rather than asserted.
      get: async <T,>(key: string): Promise<T | null> => (contents.get(key) ?? null) as T | null,
      setMany
    }
  };
};

/** The value written for a given key by the single setMany call. */
const writtenValue = (setMany: ReturnType<typeof vi.fn>, key: string): unknown => {
  const entries: unknown = setMany.mock.calls[0][0];
  if (!Array.isArray(entries)) throw new Error('setMany was not called with a list of entries');
  const entry = entries.find((e): e is { key: string; value: unknown } =>
    typeof e === 'object' && e !== null && 'key' in e && e.key === key);
  if (!entry) throw new Error(`nothing written for ${key}`);
  return entry.value;
};

const writtenTransactions = (setMany: ReturnType<typeof vi.fn>): Transaction[] => {
  const value = writtenValue(setMany, STORAGE_KEYS.TRANSACTIONS);
  if (!Array.isArray(value)) throw new Error('transactions were not written as a list');
  return value;
};

const writtenAccounts = (setMany: ReturnType<typeof vi.fn>): Account[] => {
  const value = writtenValue(setMany, STORAGE_KEYS.ACCOUNTS);
  if (!Array.isArray(value)) throw new Error('accounts were not written as a list');
  return value;
};

describe('importTransactionsLocally', () => {
  it('writes the rows and the balance in ONE storage transaction', () => {
    // The whole atomicity claim in one assertion: two collections change, and
    // there is exactly one write. Two writes could half-succeed and leave a
    // register that does not add up to its own account balance.
    const { store, setMany } = makeStore();

    return importTransactionsLocally('acc-current', statement, { store, uuid: () => 'id' })
      .then(() => {
        expect(setMany).toHaveBeenCalledTimes(1);
        expect(writtenTransactions(setMany)).toHaveLength(4);
        expect(writtenAccounts(setMany)).toHaveLength(1);
      });
  });

  it('reports every row as landed and appends them after what was held', async () => {
    let counter = 0;
    const { store, setMany } = makeStore();

    const result = await importTransactionsLocally('acc-current', statement, {
      store,
      uuid: () => `new-${counter++}`
    });

    expect(result).toEqual({ inserted: 3, alreadyPresent: 0, total: 3, complete: true });
    const rows = writtenTransactions(setMany);
    expect(rows).toHaveLength(4);
    expect(rows[0].id).toBe('txn-existing');
    expect(rows.slice(1).map(r => r.id)).toEqual(['new-0', 'new-1', 'new-2']);
  });

  it('carries statementSequence through to storage', async () => {
    // Without it the register has nothing but guesswork to order a day by, and
    // the running balance shows figures the account never held.
    const { store, setMany } = makeStore();

    await importTransactionsLocally('acc-current', statement, { store, uuid: () => 'id' });

    const rows = writtenTransactions(setMany);
    expect(rows.slice(1).map(r => ({ description: r.description, statementSequence: r.statementSequence })))
      .toEqual([
        { description: 'DIRECT DEBIT THAMES WATER', statementSequence: 0 },
        { description: 'STANDING ORDER OUT', statementSequence: 1 },
        { description: 'TWO WAY SWEEP IN', statementSequence: 2 }
      ]);
  });

  it('moves the balance by exactly the sum of the rows, in Decimal', async () => {
    // 100 - 12.75 - 300 + 312.75 = 100.00 exactly. As IEEE doubles this
    // accumulates to 100.00000000000003, which is a ledger that does not agree
    // with its own transactions.
    const { store, setMany } = makeStore();

    await importTransactionsLocally('acc-current', statement, { store, uuid: () => 'id' });

    const accounts = writtenAccounts(setMany);
    expect(accounts[0].balance).toBe(100);
  });

  it('leaves every other account alone', async () => {
    const other: Account = { ...heldAccount, id: 'acc-savings', name: 'Savings', balance: 5000 };
    const { store, setMany } = makeStore({ accounts: [heldAccount, other] });

    await importTransactionsLocally('acc-current', statement, { store, uuid: () => 'id' });

    const accounts = writtenAccounts(setMany);
    expect(accounts.find(a => a.id === 'acc-savings')?.balance).toBe(5000);
  });

  it('files rows against the destination, overruling whatever the parser guessed', async () => {
    const misrouted = statement.map(row => ({ ...row, accountId: 'default' }));
    const { store, setMany } = makeStore();

    await importTransactionsLocally('acc-current', misrouted, { store, uuid: () => 'id' });

    const rows = writtenTransactions(setMany);
    expect(rows.slice(1).every(r => r.accountId === 'acc-current')).toBe(true);
  });

  it('writes NOTHING when the storage write fails, and says so', async () => {
    // The failure this module exists for. A per-row loop would have left some
    // of the statement in the register with a balance nobody could explain.
    const { store, setMany } = makeStore({
      setMany: async () => { throw new Error('QuotaExceededError'); }
    });

    const result = await importTransactionsLocally('acc-current', statement, { store, uuid: () => 'id' });

    expect(result).toEqual({
      inserted: 0,
      alreadyPresent: 0,
      total: 3,
      complete: false,
      error: 'QuotaExceededError'
    });
    expect(setMany).toHaveBeenCalledTimes(1);
  });

  it('refuses an account that does not exist rather than filing rows nowhere', async () => {
    // The local twin of the RPC's account_not_found_or_not_owned.
    const { store, setMany } = makeStore();

    const result = await importTransactionsLocally('acc-deleted', statement, { store, uuid: () => 'id' });

    expect(result.inserted).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.error).toMatch(/no longer exists/);
    expect(setMany).not.toHaveBeenCalled();
  });

  it('does not touch storage for an empty file', async () => {
    const { store, setMany } = makeStore();

    const result = await importTransactionsLocally('acc-current', [], { store });

    expect(result).toEqual({ inserted: 0, alreadyPresent: 0, total: 0, complete: true });
    expect(setMany).not.toHaveBeenCalled();
  });

  it('reads a JSON-serialised date back as a real Date', async () => {
    // Storage holds JSON, so a previously-saved row's `date` comes back as a
    // string. These rows go straight into app state, where a string date is a
    // crash waiting for the first `.getTime()`.
    const serialised = [{ ...heldTransaction, date: '2024-02-01T00:00:00.000Z' }];
    const { store, setMany } = makeStore({ transactions: serialised });

    await importTransactionsLocally('acc-current', statement, { store, uuid: () => 'id' });

    const rows = writtenTransactions(setMany);
    expect(rows[0].date).toBeInstanceOf(Date);
    expect(rows[1].date).toBeInstanceOf(Date);
  });
});
