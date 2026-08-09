import { describe, it, expect } from 'vitest';
import {
  WIPE_CHUNK_SIZE,
  WIPE_TABLE_ORDER,
  runWipe,
  type WipeProgress,
  type WipeStore,
} from './msMoneyImport';

/**
 * The bug these exist for, in the owner's words: "Delete All Data" reported
 * `canceling statement due to statement timeout` on 51,000 transactions and
 * left the login with its transfer links nulled and its splits gone and every
 * transaction still there.
 *
 * The store below is a REAL in-memory implementation of the five verbs a wipe
 * uses, not a fake query builder. A mock that recorded calls would only prove
 * the chain was invoked in the order the test expected; this one can be asked
 * what is actually left.
 */

interface Row {
  id: string;
  user_id: string;
  linked: boolean;
}

/** Every table, populated with `counts[table]` rows belonging to `user`. */
function memoryStore(
  counts: Partial<Record<string, number>>,
  options: {
    user?: string;
    linkedTransfers?: number;
    /** Someone else's rows, which a wipe must not touch. */
    otherUser?: Partial<Record<string, number>>;
    /** Fail the nth call to this table's delete (1-based). */
    failDelete?: { table: string; onCall: number; message: string };
    countFails?: boolean;
  } = {}
): WipeStore & { tables: Map<string, Row[]>; calls: { verb: string; table: string; rows: number }[] } {
  const user = options.user ?? 'u-1';
  const tables = new Map<string, Row[]>();
  for (const table of WIPE_TABLE_ORDER) {
    const mine = Array.from({ length: counts[table] ?? 0 }, (_, n) => ({
      id: `${table}-${n}`,
      user_id: user,
      linked: table === 'transactions' && n < (options.linkedTransfers ?? 0),
    }));
    const theirs = Array.from({ length: options.otherUser?.[table] ?? 0 }, (_, n) => ({
      id: `${table}-other-${n}`,
      user_id: 'someone-else',
      linked: false,
    }));
    tables.set(table, [...mine, ...theirs]);
  }

  const calls: { verb: string; table: string; rows: number }[] = [];
  const deletesSeen = new Map<string, number>();

  return {
    tables,
    calls,
    async count(table, userId) {
      if (options.countFails) return undefined;
      return (tables.get(table) ?? []).filter(row => row.user_id === userId).length;
    },
    async idsFor(table, userId, limit) {
      const ids = (tables.get(table) ?? [])
        .filter(row => row.user_id === userId)
        .slice(0, limit)
        .map(row => row.id);
      calls.push({ verb: 'select', table, rows: ids.length });
      return ids;
    },
    async linkedTransferIds(userId, limit) {
      const ids = (tables.get('transactions') ?? [])
        .filter(row => row.user_id === userId && row.linked)
        .slice(0, limit)
        .map(row => row.id);
      calls.push({ verb: 'select-linked', table: 'transactions', rows: ids.length });
      return ids;
    },
    async unlinkTransfers(ids) {
      calls.push({ verb: 'unlink', table: 'transactions', rows: ids.length });
      const set = new Set(ids);
      for (const row of tables.get('transactions') ?? []) {
        if (set.has(row.id)) row.linked = false;
      }
    },
    async deleteByIds(table, ids) {
      const seen = (deletesSeen.get(table) ?? 0) + 1;
      deletesSeen.set(table, seen);
      if (options.failDelete && options.failDelete.table === table && options.failDelete.onCall === seen) {
        throw new Error(options.failDelete.message);
      }
      calls.push({ verb: 'delete', table, rows: ids.length });
      const set = new Set(ids);
      tables.set(table, (tables.get(table) ?? []).filter(row => !set.has(row.id)));
    },
  };
}

describe('the wipe — chunking', () => {
  it('never issues one statement for the whole table', async () => {
    // The failure: DELETE FROM transactions WHERE user_id = … over 51k rows.
    const store = memoryStore({ transactions: 5_000 });

    await runWipe(store, 'u-1', { chunkSize: 2_000 });

    const deletes = store.calls.filter(call => call.verb === 'delete' && call.table === 'transactions');
    expect(deletes.map(call => call.rows)).toEqual([2_000, 2_000, 1_000]);
    expect(store.tables.get('transactions')).toEqual([]);
  });

  it('terminates on an empty database without deleting anything', async () => {
    const store = memoryStore({});
    await runWipe(store, 'u-1');
    expect(store.calls.filter(call => call.verb === 'delete')).toHaveLength(0);
  });

  it('terminates when a table holds exactly one chunk', async () => {
    // The off-by-one that would loop forever or stop one chunk early.
    const store = memoryStore({ budgets: 10 });
    await runWipe(store, 'u-1', { chunkSize: 10 });
    expect(store.tables.get('budgets')).toEqual([]);
    expect(store.calls.filter(call => call.verb === 'delete' && call.table === 'budgets')).toHaveLength(1);
  });

  it('leaves other people\'s rows exactly where they were', async () => {
    const store = memoryStore({ transactions: 30 }, { otherUser: { transactions: 7 } });
    await runWipe(store, 'u-1', { chunkSize: 10 });
    expect(store.tables.get('transactions')).toHaveLength(7);
    expect(store.tables.get('transactions')?.every(row => row.user_id === 'someone-else')).toBe(true);
  });

  it('ships a chunk size small enough to have avoided the timeout', () => {
    // Not a magic number check — a floor. The failing statement was 51,000 rows
    // in one go; anything of that order would reproduce it.
    expect(WIPE_CHUNK_SIZE).toBeLessThanOrEqual(5_000);
    expect(WIPE_CHUNK_SIZE).toBeGreaterThan(0);
  });
});

describe('the wipe — the order the database demands', () => {
  it('unlinks transfers first, then empties the tables in dependency order', async () => {
    const store = memoryStore(
      { transaction_splits: 2, transactions: 4, budgets: 1, goals: 1, accounts: 1, categories: 1 },
      { linkedTransfers: 3 }
    );

    await runWipe(store, 'u-1', { chunkSize: 100 });

    const mutations = store.calls
      .filter(call => call.verb === 'unlink' || call.verb === 'delete')
      .map(call => `${call.verb}:${call.table}`);

    expect(mutations).toEqual([
      'unlink:transactions',
      'delete:transaction_splits',
      'delete:transactions',
      'delete:budgets',
      'delete:goals',
      'delete:accounts',
      'delete:categories',
    ]);
    // accounts BEFORE categories — the protect_transfer_category trigger only
    // lets a To/From category go once its account row has gone.
    expect(WIPE_TABLE_ORDER.indexOf('accounts')).toBeLessThan(WIPE_TABLE_ORDER.indexOf('categories'));
  });

  it('chunks the transfer-unlink pass too — it touched 13,000 rows for real', async () => {
    const store = memoryStore({ transactions: 5_000 }, { linkedTransfers: 5_000 });

    await runWipe(store, 'u-1', { chunkSize: 2_000 });

    const unlinks = store.calls.filter(call => call.verb === 'unlink');
    expect(unlinks.map(call => call.rows)).toEqual([2_000, 2_000, 1_000]);
  });
});

describe('the wipe — progress', () => {
  it('reports every table by name, with a running count and a denominator', async () => {
    const store = memoryStore({ transactions: 3_000, accounts: 2 });
    const seen: WipeProgress[] = [];

    await runWipe(store, 'u-1', { chunkSize: 2_000, onProgress: p => seen.push(p) });

    const transactions = seen.filter(p => p.table === 'transactions');
    expect(transactions.map(p => p.deleted)).toEqual([0, 2_000, 3_000]);
    expect(transactions.every(p => p.total === 3_000)).toBe(true);

    // Every step announces itself, including the ones with nothing to do — a
    // step that stays silent reads as a step that hung.
    expect(new Set(seen.map(p => p.table))).toEqual(
      new Set(['transfer links', ...WIPE_TABLE_ORDER])
    );
    expect(seen.every(p => p.stepCount === WIPE_TABLE_ORDER.length + 1)).toBe(true);
    expect(seen.map(p => p.step)).toEqual([...seen.map(p => p.step)].sort((a, b) => a - b));
  });

  it('says "unknown" rather than "0" when the count could not be taken', async () => {
    // A failed count must not fail the wipe, and must not be reported as zero
    // beside a spinner that is plainly still working.
    const store = memoryStore({ transactions: 3 }, { countFails: true });
    const seen: WipeProgress[] = [];

    await runWipe(store, 'u-1', { chunkSize: 2, onProgress: p => seen.push(p) });

    expect(seen.every(p => p.total === undefined)).toBe(true);
    expect(store.tables.get('transactions')).toEqual([]);
  });
});

describe('the wipe — failure part-way through', () => {
  it('names the table it stopped on and keeps the database\'s own message', async () => {
    const store = memoryStore(
      { transactions: 6_000 },
      { failDelete: { table: 'transactions', onCall: 2, message: 'canceling statement due to statement timeout' } }
    );

    await expect(runWipe(store, 'u-1', { chunkSize: 2_000 }))
      .rejects.toThrow(/Failed while clearing transactions: canceling statement due to statement timeout/);
  });

  it('leaves a state the same call can finish — deleting what has already gone is a no-op', async () => {
    const failing = memoryStore(
      { transaction_splits: 10, transactions: 6_000, accounts: 1 },
      { failDelete: { table: 'transactions', onCall: 2, message: 'canceling statement due to statement timeout' } }
    );

    await expect(runWipe(failing, 'u-1', { chunkSize: 2_000 })).rejects.toThrow();

    // Part-way: the splits went, 2,000 transactions went, the rest are there.
    expect(failing.tables.get('transaction_splits')).toEqual([]);
    expect(failing.tables.get('transactions')).toHaveLength(4_000);
    expect(failing.tables.get('accounts')).toHaveLength(1);

    // Run it again — the recovery the dialog tells the user about — against the
    // same store, now without the injected failure.
    const resumed: WipeStore = { ...failing, deleteByIds: async (table, ids) => {
      const set = new Set(ids);
      failing.tables.set(table, (failing.tables.get(table) ?? []).filter(row => !set.has(row.id)));
    } };

    await runWipe(resumed, 'u-1', { chunkSize: 2_000 });

    for (const table of WIPE_TABLE_ORDER) {
      expect(failing.tables.get(table)).toEqual([]);
    }
  });

  it('reports the unlink pass under its own name when it is the pass that fails', async () => {
    const store = memoryStore({ transactions: 10 }, { linkedTransfers: 10 });
    const failingUnlink: WipeStore = {
      ...store,
      unlinkTransfers: () => Promise.reject(new Error('statement timeout')),
    };

    await expect(runWipe(failingUnlink, 'u-1', { chunkSize: 5 }))
      .rejects.toThrow(/Failed while unlinking transfers: statement timeout/);
  });
});
