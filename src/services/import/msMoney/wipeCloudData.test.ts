import { describe, it, expect } from 'vitest';
import {
  WIPE_CHUNK_SIZE,
  WIPE_REQUEST_IDS,
  WIPE_TABLE_ORDER,
  runWipe,
  type WipeProgress,
  type WipeStore,
} from './msMoneyImport';

/**
 * Two bugs, both from the same 51,343-row account, both reported by the owner
 * as "Delete All Data" simply failing.
 *
 * The first: `canceling statement due to statement timeout`, which left the
 * login with its transfer links nulled and its splits gone and every
 * transaction still there. Chunking fixed it.
 *
 * The second, which the chunking then caused: `Bad Request`. A chunk of 2,000
 * ids goes to PostgREST in the query string, and 2,000 UUIDs is 78 KB of
 * request line — refused by the edge before Postgres saw it. Hence a second
 * limit, on the size of a REQUEST rather than of a statement, and the
 * `the request the edge refused` block at the bottom of this file.
 *
 * The store below is a REAL in-memory implementation of the five verbs a wipe
 * uses, not a fake query builder. A mock that recorded calls would only prove
 * the chain was invoked in the order the test expected; this one can be asked
 * what is actually left, and it keeps the id arrays it was handed so the URL
 * they would have encoded to can be measured.
 */

interface Row {
  id: string;
  user_id: string;
  linked: boolean;
}

/** One call at the port, which is exactly one request in production. */
interface Call {
  verb: 'select' | 'select-linked' | 'unlink' | 'delete';
  table: string;
  ids: string[];
}

/**
 * A 36-character id — the shape the real tables hold. The URL arithmetic is
 * about nothing else, so a test that measures it has to use real-length ids.
 */
function uuidLike(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

/** Every table, populated with `counts[table]` rows belonging to `user`. */
function memoryStore(
  counts: Partial<Record<string, number>>,
  options: {
    user?: string;
    linkedTransfers?: number;
    /** Someone else's rows, which a wipe must not touch. */
    otherUser?: Partial<Record<string, number>>;
    /** Fail this table's delete once `afterRows` of its rows have already gone. */
    failDelete?: { table: string; afterRows: number; message: string };
    countFails?: boolean;
    /** Ids the length of real UUIDs, for the tests that measure a URL. */
    uuidIds?: boolean;
  } = {}
): WipeStore & { tables: Map<string, Row[]>; calls: Call[] } {
  const user = options.user ?? 'u-1';
  const tables = new Map<string, Row[]>();
  let nextId = 0;
  const idFor = (table: string, label: string): string =>
    options.uuidIds ? uuidLike(nextId++) : `${table}-${label}`;
  for (const table of WIPE_TABLE_ORDER) {
    const mine = Array.from({ length: counts[table] ?? 0 }, (_, n) => ({
      id: idFor(table, `${n}`),
      user_id: user,
      linked: table === 'transactions' && n < (options.linkedTransfers ?? 0),
    }));
    const theirs = Array.from({ length: options.otherUser?.[table] ?? 0 }, (_, n) => ({
      id: idFor(table, `other-${n}`),
      user_id: 'someone-else',
      linked: false,
    }));
    tables.set(table, [...mine, ...theirs]);
  }

  const calls: Call[] = [];
  const rowsDeleted = new Map<string, number>();

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
      calls.push({ verb: 'select', table, ids });
      return ids;
    },
    async linkedTransferIds(userId, limit) {
      const ids = (tables.get('transactions') ?? [])
        .filter(row => row.user_id === userId && row.linked)
        .slice(0, limit)
        .map(row => row.id);
      calls.push({ verb: 'select-linked', table: 'transactions', ids });
      return ids;
    },
    async unlinkTransfers(ids) {
      calls.push({ verb: 'unlink', table: 'transactions', ids });
      const set = new Set(ids);
      for (const row of tables.get('transactions') ?? []) {
        if (set.has(row.id)) row.linked = false;
      }
    },
    async deleteByIds(table, ids) {
      const gone = rowsDeleted.get(table) ?? 0;
      if (options.failDelete?.table === table && gone >= options.failDelete.afterRows) {
        throw new Error(options.failDelete.message);
      }
      rowsDeleted.set(table, gone + ids.length);
      calls.push({ verb: 'delete', table, ids });
      const set = new Set(ids);
      tables.set(table, (tables.get(table) ?? []).filter(row => !set.has(row.id)));
    },
  };
}

describe('the wipe — chunking', () => {
  it('never issues one statement for the whole table', async () => {
    // The failure: DELETE FROM transactions WHERE user_id = … over 51k rows.
    const store = memoryStore({ transactions: 5_000 });

    await runWipe(store, 'u-1', { chunkSize: 2_000, idsPerRequest: 500 });

    // The chunk is what the SELECT pages at — the statement-sized unit.
    const selects = store.calls.filter(call => call.verb === 'select' && call.table === 'transactions');
    expect(selects.map(call => call.ids.length)).toEqual([2_000, 2_000, 1_000, 0]);

    // The batch is what a request carries. Ten of them, covering the 5,000.
    const deletes = store.calls.filter(call => call.verb === 'delete' && call.table === 'transactions');
    expect(deletes.map(call => call.ids.length)).toEqual(Array.from({ length: 10 }, () => 500));
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

    await runWipe(store, 'u-1', { chunkSize: 2_000, idsPerRequest: 1_000 });

    const selected = store.calls.filter(call => call.verb === 'select-linked');
    expect(selected.map(call => call.ids.length)).toEqual([2_000, 2_000, 1_000, 0]);

    const unlinks = store.calls.filter(call => call.verb === 'unlink');
    expect(unlinks.map(call => call.ids.length)).toEqual([1_000, 1_000, 1_000, 1_000, 1_000]);
  });
});

describe('the wipe — the request the edge refused', () => {
  /**
   * The URL supabase-js builds for `.in('id', ids)`, byte for byte:
   * PostgrestFilterBuilder appends `in.(a,b,c)` to the query string, and
   * URLSearchParams percent-encodes the brackets and every comma. Reproduced
   * here rather than asserted against a mocked client, because the length of
   * this string IS the bug — a store that returned 400 would be a test of the
   * store's error handling, not of the thing that made the edge send one.
   */
  function requestUrlBytes(table: string, ids: readonly string[]): number {
    const url = new URL(`https://abcdefghijklmnopqrst.supabase.co/rest/v1/${table}`);
    url.searchParams.append('id', `in.(${ids.join(',')})`);
    return url.toString().length;
  }

  /** What the proxies in front of PostgREST allow a request line to be. */
  const REQUEST_LINE_LIMIT = 8_192;

  it('measures the failure: a whole chunk of uuids is a 78 KB request line', () => {
    const chunk = Array.from({ length: WIPE_CHUNK_SIZE }, (_, n) => uuidLike(n));

    expect(requestUrlBytes('transactions', chunk)).toBeGreaterThan(70_000);
    // …and the batch that ships measures 5,921, which is inside the limit with
    // room for a longer project host and a longer table name. "Comfortably" is
    // the whole reason the number is 150 and not the 200 that also fits.
    expect(requestUrlBytes('transactions', chunk.slice(0, WIPE_REQUEST_IDS)))
      .toBeLessThan(6_500);
  });

  it('hands no delete more ids than one URL can carry, on shipping defaults', async () => {
    // Over one full chunk, so the batching has to happen inside a chunk and
    // again for the remainder — the arithmetic the 51,343-row account hit.
    const store = memoryStore(
      { transactions: 2_500, transaction_splits: 400, accounts: 12 },
      { uuidIds: true }
    );

    await runWipe(store, 'u-1');

    const deletes = store.calls.filter(call => call.verb === 'delete');
    expect(deletes.length).toBeGreaterThanOrEqual(Math.ceil(2_500 / WIPE_REQUEST_IDS));
    for (const call of deletes) {
      expect(call.ids.length).toBeLessThanOrEqual(WIPE_REQUEST_IDS);
      expect(requestUrlBytes(call.table, call.ids)).toBeLessThan(REQUEST_LINE_LIMIT);
    }
    // Batched, and still complete: the limit is on the request, not the wipe.
    for (const table of WIPE_TABLE_ORDER) {
      expect(store.tables.get(table)).toEqual([]);
    }
  });

  it('holds for the unlink pass too — it sends the same kind of id list', async () => {
    const store = memoryStore({ transactions: 2_500 }, { uuidIds: true, linkedTransfers: 2_500 });

    await runWipe(store, 'u-1');

    const unlinks = store.calls.filter(call => call.verb === 'unlink');
    expect(unlinks.length).toBeGreaterThanOrEqual(Math.ceil(2_500 / WIPE_REQUEST_IDS));
    for (const call of unlinks) {
      expect(call.ids.length).toBeLessThanOrEqual(WIPE_REQUEST_IDS);
      expect(requestUrlBytes('transactions', call.ids)).toBeLessThan(REQUEST_LINE_LIMIT);
    }
    expect(unlinks.reduce((sum, call) => sum + call.ids.length, 0)).toBe(2_500);
  });

  it('batches without losing or repeating an id', async () => {
    // The one way sub-batching could break the loop's termination proof: a
    // batch that does not cover its chunk leaves rows the next read returns
    // forever. Every id selected must be written exactly once.
    const store = memoryStore({ transactions: 2_500 }, { uuidIds: true });

    await runWipe(store, 'u-1');

    const written = store.calls
      .filter(call => call.verb === 'delete' && call.table === 'transactions')
      .flatMap(call => call.ids);
    expect(written).toHaveLength(2_500);
    expect(new Set(written).size).toBe(2_500);
  });
});

describe('the wipe — progress', () => {
  it('reports every table by name, with a running count and a denominator', async () => {
    const store = memoryStore({ transactions: 3_000, accounts: 2 });
    const seen: WipeProgress[] = [];

    await runWipe(store, 'u-1', { chunkSize: 2_000, onProgress: p => seen.push(p) });

    // Once per chunk, NOT once per request. Emptying these 3,000 rows takes
    // twenty requests at the shipping batch size; twenty events would say
    // nothing the three say, and the count each one carries is of rows actually
    // gone either way.
    const transactions = seen.filter(p => p.table === 'transactions');
    expect(transactions.map(p => p.deleted)).toEqual([0, 2_000, 3_000]);
    expect(transactions.every(p => p.total === 3_000)).toBe(true);
    const deletes = store.calls.filter(call => call.verb === 'delete' && call.table === 'transactions');
    expect(deletes.length).toBeGreaterThan(transactions.length);

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
      { failDelete: { table: 'transactions', afterRows: 2_000, message: 'canceling statement due to statement timeout' } }
    );

    await expect(runWipe(store, 'u-1', { chunkSize: 2_000 }))
      .rejects.toThrow(/Failed while clearing transactions: canceling statement due to statement timeout/);
  });

  it('names the table for the 400 as well — the message the edge sends is the one the user sees', async () => {
    // The second failure: no statement ran, the request was too long to send.
    const store = memoryStore(
      { transactions: 6_000 },
      { failDelete: { table: 'transactions', afterRows: 0, message: 'Bad Request' } }
    );

    await expect(runWipe(store, 'u-1'))
      .rejects.toThrow(/Failed while clearing transactions: Bad Request/);
  });

  it('leaves a state the same call can finish — deleting what has already gone is a no-op', async () => {
    const failing = memoryStore(
      { transaction_splits: 10, transactions: 6_000, accounts: 1 },
      { failDelete: { table: 'transactions', afterRows: 2_000, message: 'canceling statement due to statement timeout' } }
    );

    await expect(runWipe(failing, 'u-1', { chunkSize: 2_000 })).rejects.toThrow();

    // Part-way, and part-way is the point: the splits went, some thousands of
    // transactions went, the rest are still there, nothing after them started.
    // Batching a chunk across requests does not change that — it only changes
    // where inside a chunk the stopping happens, so this asserts the shape
    // rather than a row count that would be pinning the batch size.
    expect(failing.tables.get('transaction_splits')).toEqual([]);
    const left = failing.tables.get('transactions') ?? [];
    expect(left.length).toBeGreaterThan(0);
    expect(left.length).toBeLessThan(6_000);
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
