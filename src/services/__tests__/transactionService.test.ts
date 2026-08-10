import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTransactionService,
  TransactionService,
  toAccountBalanceMap,
  mergeTransactionDelta
} from '../api/transactionService';
import type { Transaction } from '../../types';
import { STORAGE_KEYS } from '../storageAdapter';

const fixedNow = new Date('2025-05-01T12:00:00.000Z');

const createStorage = (initial: Transaction[] = []) => {
  const data = new Map<string, Transaction[]>([[STORAGE_KEYS.TRANSACTIONS, initial]]);

  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: Transaction[]) => {
      data.set(key, value);
    }),
    snapshot: () => data.get(STORAGE_KEYS.TRANSACTIONS) ?? []
  };
};

const baseTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  date: new Date('2025-04-15T00:00:00.000Z'),
  amount: 25,
  description: 'Test purchase',
  category: 'coffee',
  accountId: 'acct-1',
  type: 'expense',
  cleared: false,
  ...overrides
});

describe('TransactionService (deterministic fallback)', () => {
  const logger = { error: vi.fn() };
  const now = vi.fn(() => new Date(fixedNow));
  const uuid = vi.fn(() => 'generated-id');

  beforeEach(() => {
    logger.error.mockReset();
    now.mockClear();
    uuid.mockClear();
  });

  it('returns stored transactions when Supabase is disabled', async () => {
    const storage = createStorage([baseTransaction({ id: 'stored-1' })]);
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const transactions = await service.getTransactions('user-1');
    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe('stored-1');
    expect(storage.get).toHaveBeenCalledWith(STORAGE_KEYS.TRANSACTIONS);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('creates a transaction via local storage fallback with deterministic metadata', async () => {
    const storage = createStorage([]);
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...transactionInput } = baseTransaction();
    const created = await service.createTransaction(
      'user-1',
      transactionInput as Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
    );

    expect(created.id).toBe('generated-id');
    expect(created.createdAt?.toISOString()).toBe(fixedNow.toISOString());
    expect(created.updatedAt?.toISOString()).toBe(fixedNow.toISOString());
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.TRANSACTIONS, expect.any(Array));
    expect(storage.snapshot()).toHaveLength(1);
  });

  it('bulk creates transactions locally when Supabase is unavailable', async () => {
    const storage = createStorage([]);
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid: () => 'bulk-id'
    });

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...transactionInput } = baseTransaction({
      date: new Date('2025-04-01T00:00:00.000Z')
    });

    const created = await service.bulkCreateTransactions('user-1', [
      transactionInput as Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
    ]);

    expect(created).toHaveLength(1);
    expect(created[0].id).toBe('bulk-id');
    expect(storage.snapshot()).toHaveLength(1);
    expect(storage.snapshot()[0].id).toBe('bulk-id');
  });

  it('allows the static TransactionService to be reconfigured for tests', async () => {
    const storage = createStorage([baseTransaction({ id: 'static-1' })]);
    TransactionService.configure({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const transactions = await TransactionService.getTransactions('user-1');
    expect(transactions[0].id).toBe('static-1');
  });

  it('uses the authenticated API delete path when a Clerk token is available', async () => {
    const storage = createStorage([]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200
    })) as unknown as typeof fetch;
    const authTokenProvider = vi.fn(async () => 'clerk-token');
    const service = createTransactionService({
      isSupabaseConfigured: () => true,
      storageAdapter: storage,
      logger,
      now,
      uuid,
      fetchImpl: fetchMock,
      authTokenProvider,
      supabaseClient: {
        from: vi.fn()
      } as unknown as never
    });

    await service.deleteTransaction('txn-secure');

    expect(authTokenProvider).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/data/delete-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer clerk-token'
      },
      body: JSON.stringify({ transactionId: 'txn-secure' })
    });
  });

  describe('getTransactions (Supabase paged load)', () => {
    // A minimal chainable stand-in for the PostgREST query builder: the count
    // query ends at .eq() with { head: true }; a page query ends at .range().
    const makeClient = (rows: Record<string, unknown>[]) => {
      const selectArgs: { cols: unknown; opts: unknown }[] = [];
      const from = vi.fn(() => {
        const builder: Record<string, unknown> = {};
        let isCount = false;
        let range: [number, number] | null = null;
        builder.select = vi.fn((cols: unknown, opts: unknown) => {
          selectArgs.push({ cols, opts });
          isCount = Boolean(opts && (opts as { head?: boolean }).head);
          return builder;
        });
        builder.eq = vi.fn(() => builder);
        builder.order = vi.fn(() => builder);
        builder.range = vi.fn((from_: number, to: number) => {
          range = [from_, to];
          return builder;
        });
        builder.then = (resolve: (value: unknown) => unknown) => {
          if (isCount) return resolve({ count: rows.length, error: null });
          const [f, t] = range ?? [0, rows.length - 1];
          return resolve({ data: rows.slice(f, t + 1), error: null });
        };
        return builder;
      });
      return { client: { from }, selectArgs };
    };

    it('fetches only the trimmed boot columns — keeps notes/tags, drops the heavy unused ones, never *', async () => {
      const { client, selectArgs } = makeClient([
        { id: 'db-1', account_id: 'acct-1', amount: 10, type: 'expense', date: '2025-04-01', is_cleared: true }
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: client as unknown as never
      });

      const transactions = await service.getTransactions('user-1');

      // Rows still map correctly through the narrowed select (is_cleared → cleared).
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe('db-1');
      expect(transactions[0].cleared).toBe(true);

      // The page select (the one without the count head option) carries the
      // trimmed column list, not '*'.
      const pageSelect = selectArgs.find(a => !(a.opts as { head?: boolean } | undefined)?.head);
      const cols = pageSelect?.cols;
      expect(typeof cols).toBe('string');
      expect(cols).not.toBe('*');
      // User-visible columns MUST survive the trim.
      expect(cols).toContain('notes');
      expect(cols).toContain('tags');
      // The heavy, unconsumed columns MUST be gone (this is where the payload
      // saving comes from; re-adding one silently re-inflates the boot).
      for (const dropped of ['metadata', 'plaid_transaction_id', 'merchant_name', 'location_city', 'import_source']) {
        expect(cols).not.toContain(dropped);
      }
      // The bank's own intra-day order. Without it the register cannot walk a
      // day the way the statement prints it — see compareChronological.
      expect(cols).toContain('statement_sequence');
      // "Has anybody looked at this row?" Without it the register cannot print
      // an arrival in bold and the To Review box counts nothing.
      expect(cols).toContain('needs_review');
    });

    /**
     * A database that predates 20260808090000_transaction_statement_sequence.
     *
     * PostgREST rejects an EXPLICIT select naming a column that does not exist,
     * so this is not a degraded register, it is a boot that returns no
     * transactions at all. The owner applies migrations himself, so the deploy
     * can legitimately reach a database that has not had it yet.
     */
    const makeClientWithoutSequenceColumn = (rows: Record<string, unknown>[]) => {
      const selectArgs: { cols: unknown; opts: unknown }[] = [];
      const from = vi.fn(() => {
        const builder: Record<string, unknown> = {};
        let isCount = false;
        let asked = '';
        let range: [number, number] | null = null;
        builder.select = vi.fn((cols: unknown, opts: unknown) => {
          selectArgs.push({ cols, opts });
          asked = typeof cols === 'string' ? cols : '';
          isCount = Boolean(opts && (opts as { head?: boolean }).head);
          return builder;
        });
        builder.eq = vi.fn(() => builder);
        builder.order = vi.fn(() => builder);
        builder.range = vi.fn((from_: number, to: number) => {
          range = [from_, to];
          return builder;
        });
        builder.then = (resolve: (value: unknown) => unknown) => {
          if (isCount) return resolve({ count: rows.length, error: null });
          if (asked.includes('statement_sequence')) {
            return resolve({
              data: null,
              error: {
                code: '42703',
                message: 'column transactions.statement_sequence does not exist'
              }
            });
          }
          const [f, t] = range ?? [0, rows.length - 1];
          return resolve({ data: rows.slice(f, t + 1), error: null });
        };
        return builder;
      });
      return { client: { from }, selectArgs };
    };

    it('still loads every transaction when the statement-sequence migration has not been applied', async () => {
      const { client, selectArgs } = makeClientWithoutSequenceColumn([
        { id: 'db-1', account_id: 'acct-1', amount: 10, type: 'expense', date: '2025-04-01', is_cleared: true },
        { id: 'db-2', account_id: 'acct-1', amount: -5, type: 'expense', date: '2025-04-02', is_cleared: false }
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: client as unknown as never
      });

      const transactions = await service.getTransactions('user-1');

      // An unordered register is a shortfall; no register at all is an outage.
      expect(transactions.map(t => t.id)).toEqual(['db-1', 'db-2']);

      const pageSelects = selectArgs
        .filter(a => !(a.opts as { head?: boolean } | undefined)?.head)
        .map(a => String(a.cols));
      const settled = pageSelects[pageSelects.length - 1];
      // Asked with the column, was refused, and kept descending the ladder
      // (newest column first) until the ask was one this database can answer.
      // The number of rungs is not asserted: it is the number of migrations
      // this build knows how to fall back past, and it goes up whenever one is
      // added — what matters is that the descent ends somewhere that works.
      expect(pageSelects[0]).toContain('statement_sequence');
      expect(settled).not.toContain('statement_sequence');
      // …and every column that was already being read survives the fallback.
      expect(settled).toContain('notes');
      expect(settled).toContain('tags');
      expect(settled).toContain('is_cleared');
    });

    /**
     * A database that predates 20260810090000_imported_rows_arrive_new but has
     * everything before it — the state every database is in until the owner
     * applies that migration, which is to say the state the deploy will find.
     *
     * It must descend EXACTLY ONE RUNG. Dropping category_confirmed as well
     * would take the suggested-category badge off a database that supports it
     * perfectly well, which is a working feature lost to an unrelated deploy.
     */
    it('gives up only the review column on a database that has everything else', async () => {
      const selectArgs: { cols: unknown; opts: unknown }[] = [];
      const rows = [{ id: 'db-1', account_id: 'acct-1', amount: 10, type: 'expense', date: '2025-04-01' }];
      const from = vi.fn(() => {
        const builder: Record<string, unknown> = {};
        let isCount = false;
        let asked = '';
        builder.select = vi.fn((cols: unknown, opts: unknown) => {
          selectArgs.push({ cols, opts });
          asked = typeof cols === 'string' ? cols : '';
          isCount = Boolean(opts && (opts as { head?: boolean }).head);
          return builder;
        });
        builder.eq = vi.fn(() => builder);
        builder.order = vi.fn(() => builder);
        builder.range = vi.fn(() => builder);
        builder.then = (resolve: (value: unknown) => unknown) => {
          if (isCount) return resolve({ count: rows.length, error: null });
          if (asked.includes('needs_review')) {
            return resolve({
              data: null,
              error: { code: '42703', message: 'column transactions.needs_review does not exist' }
            });
          }
          return resolve({ data: rows, error: null });
        };
        return builder;
      });

      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { from } as unknown as never
      });

      const transactions = await service.getTransactions('user-1');
      expect(transactions.map(t => t.id)).toEqual(['db-1']);

      const pageSelects = selectArgs
        .filter(a => !(a.opts as { head?: boolean } | undefined)?.head)
        .map(a => String(a.cols));
      expect(pageSelects).toHaveLength(2);
      expect(pageSelects[1]).not.toContain('needs_review');
      expect(pageSelects[1]).toContain('category_confirmed');
      expect(pageSelects[1]).toContain('statement_sequence');
    });

    it('does not re-ask for the missing column on every page of a boot', async () => {
      const { client, selectArgs } = makeClientWithoutSequenceColumn([
        { id: 'db-1', account_id: 'acct-1', amount: 10, type: 'expense', date: '2025-04-01' }
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: client as unknown as never
      });

      const refusedSoFar = (): number => selectArgs.filter(
        a => !(a.opts as { head?: boolean } | undefined)?.head && String(a.cols).includes('statement_sequence')
      ).length;

      await service.getTransactions('user-1');
      const afterFirstBoot = refusedSoFar();
      await service.getTransactions('user-1');

      // One descent for the life of the service, not one per page — a 50-page
      // history would otherwise pay for the same refusals fifty times. The
      // second boot must add NOTHING, whatever the ladder's length is.
      expect(afterFirstBoot).toBeGreaterThan(0);
      expect(refusedSoFar()).toBe(afterFirstBoot);
    });
  });

  describe('loadTransactionsForBoot (local snapshot + delta)', () => {
    type DbRow = Record<string, unknown>;

    const dbRow = (id: string, date: string, updatedAt: string, description = id): DbRow => ({
      id,
      account_id: 'acct-1',
      amount: 10,
      type: 'expense',
      date,
      description,
      updated_at: updatedAt
    });

    /**
     * Chainable PostgREST stand-in that understands the delta filter: a query
     * with .gte('updated_at', X) returns only the rows at or after X, so the
     * test data IS the server's truth. `count` is passed separately so a
     * deletion (server holds fewer rows than the cache) can be simulated.
     */
    const makeClient = (rows: DbRow[], count = rows.length) => {
      const deltaFloors: string[] = [];
      const pageFetches: { since: string | null }[] = [];
      const from = vi.fn(() => {
        const builder: Record<string, unknown> = {};
        let isCount = false;
        let since: string | null = null;
        let range: [number, number] | null = null;
        builder.select = vi.fn((_cols: unknown, opts: unknown) => {
          isCount = Boolean(opts && (opts as { head?: boolean }).head);
          return builder;
        });
        builder.eq = vi.fn(() => builder);
        builder.gte = vi.fn((_column: string, value: string) => {
          since = value;
          deltaFloors.push(value);
          return builder;
        });
        builder.order = vi.fn(() => builder);
        builder.range = vi.fn((from_: number, to: number) => {
          range = [from_, to];
          return builder;
        });
        builder.then = (resolve: (value: unknown) => unknown) => {
          if (isCount) return resolve({ count, error: null });
          pageFetches.push({ since });
          const scoped = since === null
            ? rows
            : rows.filter(r => String(r.updated_at) >= since);
          const [f, t] = range ?? [0, scoped.length - 1];
          return resolve({ data: scoped.slice(f, t + 1), error: null });
        };
        return builder;
      });
      return { client: { from }, deltaFloors, pageFetches };
    };

    const createCache = (snapshot: { rows: Transaction[]; highWaterMark: string } | null) => {
      const writes: { userId: string; rows: Transaction[] }[] = [];
      return {
        cache: {
          read: vi.fn(async () => snapshot),
          write: vi.fn(async (userId: string, _columns: string, rows: Transaction[]) => {
            writes.push({ userId, rows });
          }),
          clear: vi.fn(async () => {})
        },
        writes
      };
    };

    /** A cached row in the shape the boot path holds (ISO strings, camelCase). */
    const cachedRow = (id: string, date: string, updatedAt: string, description = id): Transaction => {
      const base: Transaction = {
        id,
        date: new Date(date),
        amount: 10,
        description,
        category: '',
        accountId: 'acct-1',
        type: 'expense',
        updatedAt: new Date(updatedAt)
      };
      return JSON.parse(JSON.stringify(base));
    };

    const build = (
      client: { from: unknown },
      cache: ReturnType<typeof createCache>['cache']
    ) => createTransactionService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now,
      uuid,
      transactionCache: cache,
      supabaseClient: client as never
    });

    it('downloads everything and stores a snapshot when there is no cache', async () => {
      const { client } = makeClient([
        dbRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z'),
        dbRow('b', '2026-07-01', '2026-07-01T00:00:00.000Z')
      ]);
      const { cache, writes } = createCache(null);

      const result = await build(client, cache).loadTransactionsForBoot('user-1');

      expect(result.transactions.map(t => t.id)).toEqual(['a', 'b']);
      expect(result.stats).toEqual({ cached: 0, fetched: 2, total: 2, fullFetchReason: 'no cache' });
      expect(writes).toHaveLength(1);
      expect(writes[0].userId).toBe('user-1');
      expect(writes[0].rows).toHaveLength(2);
    });

    it('serves the snapshot untouched when nothing has been written since', async () => {
      // The delta still returns the newest rows (the overlap window re-reads
      // them), but none is newer than the high-water mark, so no merge, no
      // re-sort and — critically — no multi-megabyte rewrite of the snapshot.
      const rows = [
        dbRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z'),
        dbRow('b', '2026-07-01', '2026-07-01T00:00:00.000Z')
      ];
      const { client, pageFetches } = makeClient(rows);
      const cached = [
        cachedRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z'),
        cachedRow('b', '2026-07-01', '2026-07-01T00:00:00.000Z')
      ];
      const { cache, writes } = createCache({ rows: cached, highWaterMark: '2026-07-02T00:00:00.000Z' });

      const result = await build(client, cache).loadTransactionsForBoot('user-1');

      expect(result.transactions).toBe(cached);
      expect(result.stats.cached).toBe(2);
      expect(result.stats.total).toBe(2);
      expect(result.stats.fullFetchReason).toBeNull();
      expect(writes).toHaveLength(0);
      // Every page request carried the delta filter — the full history was
      // never asked for.
      expect(pageFetches.every(f => f.since !== null)).toBe(true);
    });

    it('folds in changed and newly-inserted rows, keeps server order, and re-caches', async () => {
      const { client } = makeClient([
        dbRow('c', '2026-07-05', '2026-07-05T09:00:00.000Z', 'brand new'),
        dbRow('a', '2026-07-02', '2026-07-04T08:00:00.000Z', 'edited'),
        dbRow('b', '2026-07-01', '2026-07-01T00:00:00.000Z')
      ]);
      const cached = [
        cachedRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z', 'original'),
        cachedRow('b', '2026-07-01', '2026-07-01T00:00:00.000Z')
      ];
      const { cache, writes } = createCache({ rows: cached, highWaterMark: '2026-07-02T00:00:00.000Z' });

      const result = await build(client, cache).loadTransactionsForBoot('user-1');

      expect(result.transactions.map(t => t.id)).toEqual(['c', 'a', 'b']);
      expect(result.transactions[1].description).toBe('edited');
      expect(result.stats).toEqual({ cached: 2, fetched: 2, total: 3, fullFetchReason: null });
      expect(writes).toHaveLength(1);
      expect(writes[0].rows.map(t => t.id)).toEqual(['c', 'a', 'b']);
    });

    it('refetches everything when the server row count disagrees — a deletion is invisible to a delta', async () => {
      // The cache holds three rows; the server holds two. updated_at can never
      // report the missing one, so the count is what catches it. A finance app
      // may pay for a refetch, but must never serve a wrong total.
      const { client } = makeClient([
        dbRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z'),
        dbRow('b', '2026-07-01', '2026-07-01T00:00:00.000Z')
      ]);
      const cached = [
        cachedRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z'),
        cachedRow('b', '2026-07-01', '2026-07-01T00:00:00.000Z'),
        cachedRow('gone', '2026-06-30', '2026-06-30T00:00:00.000Z')
      ];
      const { cache, writes } = createCache({ rows: cached, highWaterMark: '2026-07-02T00:00:00.000Z' });

      const result = await build(client, cache).loadTransactionsForBoot('user-1');

      expect(result.transactions.map(t => t.id)).toEqual(['a', 'b']);
      expect(result.stats.cached).toBe(0);
      expect(result.stats.total).toBe(2);
      expect(result.stats.fullFetchReason).toBe('cache held 3 of 2 rows');
      // The refetched truth replaces the stale snapshot.
      expect(writes).toHaveLength(1);
      expect(writes[0].rows.map(t => t.id)).toEqual(['a', 'b']);
    });

    it('refetches everything when the delta query fails', async () => {
      const rows = [dbRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z')];
      const { client } = makeClient(rows);
      let firstCall = true;
      const failingOnce = {
        from: vi.fn((table: string) => {
          if (firstCall) {
            firstCall = false;
            const builder: Record<string, unknown> = {};
            builder.select = vi.fn(() => builder);
            builder.eq = vi.fn(() => builder);
            builder.gte = vi.fn(() => builder);
            builder.order = vi.fn(() => builder);
            builder.range = vi.fn(() => builder);
            builder.then = (resolve: (value: unknown) => unknown) =>
              resolve({ data: null, error: { message: 'delta exploded' } });
            return builder;
          }
          return client.from(table);
        })
      };
      const cached = [cachedRow('a', '2026-07-02', '2026-07-02T00:00:00.000Z')];
      const { cache } = createCache({ rows: cached, highWaterMark: '2026-07-02T00:00:00.000Z' });

      const result = await build(failingOnce, cache).loadTransactionsForBoot('user-1');

      expect(result.transactions.map(t => t.id)).toEqual(['a']);
      expect(result.stats.fullFetchReason).toBe('delta load failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('asks for a window that reaches back before the high-water mark', async () => {
      // updated_at is stamped with the writing transaction's START time, so a
      // strict "newer than the mark" filter would miss a write that began
      // before the snapshot and committed after it.
      const { client, deltaFloors } = makeClient([dbRow('a', '2026-07-02', '2026-07-02T12:00:00.000Z')]);
      const cached = [cachedRow('a', '2026-07-02', '2026-07-02T12:00:00.000Z')];
      const { cache } = createCache({ rows: cached, highWaterMark: '2026-07-02T12:00:00.000Z' });

      await build(client, cache).loadTransactionsForBoot('user-1');

      expect(deltaFloors[0]).toBe('2026-07-02T11:50:00.000Z');
    });

    it('reads local storage and never touches the cache in local mode', async () => {
      const storage = createStorage([baseTransaction({ id: 'local-1' })]);
      const { cache } = createCache(null);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid,
        transactionCache: cache
      });

      const result = await service.loadTransactionsForBoot('user-1');

      expect(result.transactions.map(t => t.id)).toEqual(['local-1']);
      expect(result.stats.fullFetchReason).toBe('local mode');
      expect(cache.read).not.toHaveBeenCalled();
      expect(cache.write).not.toHaveBeenCalled();
    });
  });

  // Regression (audit 2026-08): `Transaction.date` is typed Date, but PostgREST
  // sends the `date` column as "2026-08-01" and mapFromDbFields copied it
  // verbatim, so app state held strings. Every `t.date >= startDate` comparison
  // in the app then coerced to NaN and answered false — £0 spent on every
  // budget, no spending alerts, empty category totals and exports. The type is
  // made TRUE at each boundary; these tests hold every one of them shut.
  describe('date boundary — every entry point yields a real Date', () => {
    const dbRow = (date: unknown): Record<string, unknown> => ({
      id: 'db-1',
      account_id: 'acct-1',
      amount: -12.5,
      type: 'expense',
      description: 'Wire row',
      date,
      updated_at: '2026-08-01T09:00:00.000Z'
    });

    /** Chainable PostgREST stand-in: count query, then one page of rows. */
    const makeClient = (rows: Record<string, unknown>[]) => ({
      from: vi.fn(() => {
        const builder: Record<string, unknown> = {};
        let isCount = false;
        builder.select = vi.fn((_cols: unknown, opts: unknown) => {
          isCount = Boolean(opts && (opts as { head?: boolean }).head);
          return builder;
        });
        builder.eq = vi.fn(() => builder);
        builder.gte = vi.fn(() => builder);
        builder.order = vi.fn(() => builder);
        builder.range = vi.fn(() => builder);
        builder.then = (resolve: (value: unknown) => unknown) =>
          resolve(isCount ? { count: rows.length, error: null } : { data: rows, error: null });
        return builder;
      })
    });

    const cloudService = (client: { from: unknown }) => createTransactionService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now,
      uuid,
      supabaseClient: client as unknown as never
    });

    it('converts the fetched date column — a Postgres date arrives as "2026-08-01"', async () => {
      const service = cloudService(makeClient([dbRow('2026-08-01')]));

      const transactions = await service.getTransactions('user-1');

      expect(transactions[0].date).toBeInstanceOf(Date);
      expect(transactions[0].date.toISOString()).toBe('2026-08-01T00:00:00.000Z');
      // The whole point: this comparison was false for a string.
      expect(transactions[0].date >= new Date('2026-07-01')).toBe(true);
      expect(transactions[0].date <= new Date('2026-08-31')).toBe(true);
    });

    it('converts a full timestamp from the wire too', async () => {
      const service = cloudService(makeClient([dbRow('2026-08-01T13:45:00+00:00')]));

      const transactions = await service.getTransactions('user-1');

      expect(transactions[0].date).toBeInstanceOf(Date);
      expect(transactions[0].date.toISOString()).toBe('2026-08-01T13:45:00.000Z');
    });

    it('converts the row an atomic create RPC returns', async () => {
      const rpc = vi.fn(async () => ({ data: dbRow('2026-08-01'), error: null }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = baseTransaction();
      const created = await service.createTransaction(
        'user-1',
        input as Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
      );

      expect(created.date).toBeInstanceOf(Date);
    });

    it('converts the row an atomic update RPC returns', async () => {
      const rpc = vi.fn(async () => ({ data: dbRow('2026-08-01'), error: null }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const updated = await service.updateTransaction('db-1', { description: 'edited' }, 'user-1');

      expect(updated.date).toBeInstanceOf(Date);
    });

    it('converts both sides of a linked transfer pair', async () => {
      const rpc = vi.fn(async () => ({
        data: { a: dbRow('2026-08-01'), b: dbRow('2026-08-02') },
        error: null
      }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const { a, b } = await service.linkTransferPair('txn-1', 'txn-2', 'user-1');

      expect(a.date).toBeInstanceOf(Date);
      expect(b.date).toBeInstanceOf(Date);
    });

    it('converts rows rehydrated from the boot snapshot (JSON turned them back into strings)', async () => {
      // A snapshot written before the boundary existed — and what any
      // JSON-serialising cache hands back — holds the raw wire string.
      const stale: Transaction = JSON.parse(JSON.stringify({
        id: 'cached-1',
        date: new Date('2026-08-01'),
        amount: -12.5,
        description: 'Cached row',
        category: '',
        accountId: 'acct-1',
        type: 'expense',
        updatedAt: new Date('2026-08-01T09:00:00.000Z')
      }));
      const cache = {
        read: vi.fn(async () => ({ rows: [stale], highWaterMark: '2026-08-01T09:00:00.000Z' })),
        write: vi.fn(async () => {}),
        clear: vi.fn(async () => {})
      };
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        transactionCache: cache,
        supabaseClient: makeClient([dbRow('2026-08-01')]) as unknown as never
      });

      const result = await service.loadTransactionsForBoot('user-1');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toBeInstanceOf(Date);
    });

    it('converts rows read back from local/demo storage', async () => {
      // Local mode stores through JSON, so its dates come back as strings too.
      const stored: Transaction = JSON.parse(JSON.stringify(baseTransaction({ id: 'local-1' })));
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: createStorage([stored]),
        logger,
        now,
        uuid
      });

      const transactions = await service.getTransactions('user-1');

      expect(transactions[0].date).toBeInstanceOf(Date);
      expect(transactions[0].date.toISOString()).toBe('2025-04-15T00:00:00.000Z');
    });

    it('converts a caller-supplied string date on the local create path', async () => {
      const storage = createStorage([]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      // An importer hands over the wire shape; the row goes straight to state.
      const input: Transaction = JSON.parse(JSON.stringify(baseTransaction()));
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...transactionInput } = input;
      const created = await service.createTransaction(
        'user-1',
        transactionInput as Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
      );

      expect(created.date).toBeInstanceOf(Date);
    });

    it('leaves an unreadable date as an Invalid Date rather than filing it at the epoch', async () => {
      const service = cloudService(makeClient([dbRow('not a date')]));

      const transactions = await service.getTransactions('user-1');

      expect(transactions[0].date).toBeInstanceOf(Date);
      expect(Number.isNaN(transactions[0].date.getTime())).toBe(true);
    });
  });

  describe('mergeTransactionDelta', () => {
    const at = (id: string, date: string, description = id): Transaction => ({
      id,
      date: new Date(date),
      amount: 1,
      description,
      category: '',
      accountId: 'acct-1',
      type: 'expense'
    });

    it('replaces cached rows by id and appends new ones', () => {
      const merged = mergeTransactionDelta(
        [at('a', '2026-07-02', 'old'), at('b', '2026-07-01')],
        [at('a', '2026-07-02', 'new'), at('c', '2026-07-03')]
      );

      expect(merged.map(t => t.id)).toEqual(['c', 'a', 'b']);
      expect(merged.find(t => t.id === 'a')?.description).toBe('new');
    });

    it('restores the server ordering — date descending, id descending as the tiebreak', () => {
      const merged = mergeTransactionDelta(
        [at('b1', '2026-07-01'), at('a9', '2026-07-01')],
        [at('m5', '2026-07-01')]
      );

      expect(merged.map(t => t.id)).toEqual(['m5', 'b1', 'a9']);
    });
  });

  describe('setTransactionsCleared', () => {
    it('bulk-sets cleared on matching ids in local mode and returns the count', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', cleared: false }),
        baseTransaction({ id: 'txn-2', cleared: false }),
        baseTransaction({ id: 'txn-3', cleared: true })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.setTransactionsCleared(['txn-1', 'txn-2'], true);

      expect(count).toBe(2);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.cleared).toBe(true);
      expect(stored.find(t => t.id === 'txn-2')?.cleared).toBe(true);
      expect(stored.find(t => t.id === 'txn-3')?.cleared).toBe(true);
    });

    it('can mark transactions uncleared without touching others', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', cleared: true }),
        baseTransaction({ id: 'txn-2', cleared: true })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.setTransactionsCleared(['txn-2'], false);

      expect(count).toBe(1);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.cleared).toBe(true);
      expect(stored.find(t => t.id === 'txn-2')?.cleared).toBe(false);
    });

    it('returns 0 and performs no write for an empty id list', async () => {
      const storage = createStorage([baseTransaction({ id: 'txn-1' })]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.setTransactionsCleared([], true);

      expect(count).toBe(0);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('calls the set_transactions_cleared RPC with owner scope in Supabase mode', async () => {
      const rpc = vi.fn(async () => ({ data: 3, error: null }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const count = await service.setTransactionsCleared(['a', 'b', 'c'], true, 'user-1');

      expect(count).toBe(3);
      expect(rpc).toHaveBeenCalledWith('set_transactions_cleared', {
        p_ids: ['a', 'b', 'c'],
        p_cleared: true,
        p_user_id: 'user-1'
      });
    });

    it('throws when the RPC reports an error', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      await expect(service.setTransactionsCleared(['a'], true, 'user-1')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('applyCategoryToUncategorized', () => {
    it('fills blanks on matching ids in local mode and returns the count', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', category: '' }),
        baseTransaction({ id: 'txn-2', category: '' }),
        baseTransaction({ id: 'txn-3', category: 'cat-keep' })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.applyCategoryToUncategorized(['txn-1', 'txn-2'], 'cat-mobile');

      expect(count).toBe(2);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.category).toBe('cat-mobile');
      expect(stored.find(t => t.id === 'txn-2')?.category).toBe('cat-mobile');
      expect(stored.find(t => t.id === 'txn-3')?.category).toBe('cat-keep');
    });

    it('never overwrites an existing category even when its id is passed', async () => {
      // Fill-blanks contract: a stale caller may pass a row that was
      // categorized elsewhere in the meantime — it must be left untouched.
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', category: 'cat-explicit' }),
        baseTransaction({ id: 'txn-2', category: '' })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.applyCategoryToUncategorized(['txn-1', 'txn-2'], 'cat-mobile');

      expect(count).toBe(1);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.category).toBe('cat-explicit');
      expect(stored.find(t => t.id === 'txn-2')?.category).toBe('cat-mobile');
    });

    it('returns 0 and performs no write for an empty id list', async () => {
      const storage = createStorage([baseTransaction({ id: 'txn-1' })]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.applyCategoryToUncategorized([], 'cat-mobile');

      expect(count).toBe(0);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('calls the apply_category_to_uncategorized RPC with owner scope in Supabase mode', async () => {
      const rpc = vi.fn(async () => ({ data: 2, error: null }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const count = await service.applyCategoryToUncategorized(['a', 'b'], 'cat-mobile', 'user-1');

      expect(count).toBe(2);
      expect(rpc).toHaveBeenCalledWith('apply_category_to_uncategorized', {
        p_ids: ['a', 'b'],
        p_category: 'cat-mobile',
        p_user_id: 'user-1'
      });
    });

    it('throws when the RPC reports an error', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      await expect(service.applyCategoryToUncategorized(['a'], 'cat-x', 'user-1')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  /**
   * The local twin of update_transaction_atomic's provenance rule. Written in
   * the service, not in each editor, so signed-in and signed-out behave the
   * same — a rule enforced in only one of the two is a rule that drifts.
   */
  describe('updateTransaction — category provenance in local mode', () => {
    const localService = (rows: Transaction[]) => {
      const storage = createStorage(rows);
      return {
        storage,
        service: createTransactionService({
          isSupabaseConfigured: () => false,
          storageAdapter: storage,
          logger,
          now,
          uuid
        })
      };
    };

    it('treats a category CHANGE as confirmation', async () => {
      const { service } = localService([
        baseTransaction({ id: 'txn-1', category: 'cat-guessed', categoryConfirmed: false })
      ]);

      const updated = await service.updateTransaction('txn-1', { category: 'cat-chosen' });

      expect(updated.category).toBe('cat-chosen');
      expect(updated.categoryConfirmed).toBe(true);
    });

    it('leaves provenance alone for an edit that is not about the category', async () => {
      const { service } = localService([
        baseTransaction({ id: 'txn-1', category: 'cat-guessed', categoryConfirmed: false })
      ]);

      const updated = await service.updateTransaction('txn-1', { description: 'Renamed payee' });

      expect(updated.categoryConfirmed).toBe(false);
    });

    it('honours an explicit flag — letting a suggestion stand is a decision too', async () => {
      const { service } = localService([
        baseTransaction({ id: 'txn-1', category: 'cat-guessed', categoryConfirmed: false })
      ]);

      const updated = await service.updateTransaction('txn-1', {
        category: 'cat-guessed',
        categoryConfirmed: true
      });

      expect(updated.category).toBe('cat-guessed');
      expect(updated.categoryConfirmed).toBe(true);
    });
  });

  describe('confirmTransactionCategories', () => {
    it('flips only genuinely suggested rows in local mode and returns the count', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', category: 'cat-a', categoryConfirmed: false }),
        baseTransaction({ id: 'txn-2', category: 'cat-b', categoryConfirmed: false }),
        // Already the user's own choice — re-confirming it would be a second
        // write and a second audit entry for a decision already recorded.
        baseTransaction({ id: 'txn-3', category: 'cat-c', categoryConfirmed: true }),
        // No flag at all: a row from a database without the migration, or from
        // the local store. Reads as confirmed, so there is nothing to do.
        baseTransaction({ id: 'txn-4', category: 'cat-d' })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.confirmTransactionCategories(['txn-1', 'txn-2', 'txn-3', 'txn-4']);

      expect(count).toBe(2);
      const stored = storage.snapshot();
      expect(stored.map(t => t.categoryConfirmed)).toEqual([true, true, true, undefined]);
    });

    it('ends the row\'s review as well — agreeing IS reviewing', async () => {
      // The same UPDATE confirm_transaction_categories does server-side. Both
      // stores implement one rule, and a rule kept in only one of them drifts:
      // signed out, the register would keep a row bold after the user had
      // explicitly answered the question it was asking.
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', category: 'cat-a', categoryConfirmed: false, needsReview: true }),
        // Nothing to agree with, so nothing happens — including to its review,
        // which is a save's job to end.
        baseTransaction({ id: 'txn-2', category: 'cat-b', categoryConfirmed: true, needsReview: true })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      await service.confirmTransactionCategories(['txn-1', 'txn-2']);

      expect(storage.snapshot().map(t => t.needsReview)).toEqual([false, true]);
    });

    it('never changes a category — only who vouched for it', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', category: 'cat-a', categoryConfirmed: false })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      await service.confirmTransactionCategories(['txn-1']);

      expect(storage.snapshot()[0].category).toBe('cat-a');
    });

    it('returns 0 and performs no write for an empty id list', async () => {
      const storage = createStorage([baseTransaction({ id: 'txn-1' })]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      expect(await service.confirmTransactionCategories([])).toBe(0);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('calls the confirm_transaction_categories RPC with owner scope in Supabase mode', async () => {
      const rpc = vi.fn(async () => ({ data: 2, error: null }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const count = await service.confirmTransactionCategories(['a', 'b'], 'user-1');

      expect(count).toBe(2);
      // No category argument: the RPC is incapable of changing what was filed,
      // only of recording that the user agrees with it.
      expect(rpc).toHaveBeenCalledWith('confirm_transaction_categories', {
        p_ids: ['a', 'b'],
        p_user_id: 'user-1'
      });
    });

    it('throws when the RPC reports an error', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      await expect(service.confirmTransactionCategories(['a'], 'user-1')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

// Audit finding L10: the atomic RPCs default p_user_id to NULL, and NULL means
// the statement names no owner at all — it falls back to RLS alone and the
// defence-in-depth IDOR guard silently disappears. Every owner-scoped path must
// therefore refuse rather than call the RPC unscoped. These tests exist to make
// a future "userId is optional here" edit fail loudly.
describe('TransactionService — owner id cannot be silently omitted', () => {
  const logger = { error: vi.fn() };

  /** Supabase-mode service whose rpc must never be reached without an owner. */
  const createOwnerlessService = () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const service = createTransactionService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now: () => new Date(fixedNow),
      uuid: () => 'generated-id',
      supabaseClient: { rpc } as unknown as never
    });
    return { service, rpc };
  };

  beforeEach(() => {
    logger.error.mockReset();
  });

  const cases: [string, (service: ReturnType<typeof createOwnerlessService>['service']) => Promise<unknown>][] = [
    ['updateTransaction', s => s.updateTransaction('txn-1', { description: 'edited' })],
    ['setTransactionsCleared', s => s.setTransactionsCleared(['txn-1'], true)],
    ['applyCategoryToUncategorized', s => s.applyCategoryToUncategorized(['txn-1'], 'cat-1')],
    ['confirmTransactionCategories', s => s.confirmTransactionCategories(['txn-1'])],
    ['setTransactionSplits', s => s.setTransactionSplits('txn-1', [
      { category: 'cat-1', amount: 10 },
      { category: 'cat-2', amount: 15 }
    ], 25)],
    ['linkTransferPair', s => s.linkTransferPair('txn-1', 'txn-2')],
    ['linkSplitLineTransfer', s => s.linkSplitLineTransfer('split-1', 'txn-2')],
    ['clearTransferLinks', s => s.clearTransferLinks(['txn-1'])],
    ['setTransactionArchived', s => s.setTransactionArchived('txn-1', true)],
    ['repairClaimedTransfer', s => s.repairClaimedTransfer('txn-1', 'txn-2', 'txn-3', 'cat-1')],
    ['createTransferCounterpart', s => s.createTransferCounterpart('txn-1', 'acct-2')],
    ['archiveTransactionsBefore', s => s.archiveTransactionsBefore('acct-1', '2025-01-31')],
    ['unarchiveAccount', s => s.unarchiveAccount('acct-1')],
    ['deleteTransaction', s => s.deleteTransaction('txn-1')]
  ];

  it.each(cases)('%s refuses to reach the RPC without an owner id', async (operation, call) => {
    const { service, rpc } = createOwnerlessService();

    await expect(call(service)).rejects.toThrow(`${operation} requires a user id`);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('still calls the RPC once the owner id is supplied', async () => {
    const { service, rpc } = createOwnerlessService();

    await service.setTransactionsCleared(['txn-1'], true, 'user-1');

    expect(rpc).toHaveBeenCalledWith('set_transactions_cleared', {
      p_ids: ['txn-1'],
      p_cleared: true,
      p_user_id: 'user-1'
    });
  });
});


// Audit 2026-08-05: unlinking a transfer and archiving a row were the last two
// financial writes that reached the table directly, so they left no
// financial_audit_log entry — two ways to change a transaction, one of them
// silent. Migration 20260805145035 gives each an audited RPC. These tests exist
// so a future edit cannot quietly put the table update back.
describe('TransactionService — transfer repair goes through audited RPCs', () => {
  const logger = { error: vi.fn() };

  const createRpcService = (data: unknown) => {
    const rpc = vi.fn(async () => ({ data, error: null }));
    const from = vi.fn(() => {
      throw new Error('financial writes must not touch the table directly');
    });
    const service = createTransactionService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now: () => new Date(fixedNow),
      uuid: () => 'generated-id',
      supabaseClient: { rpc, from } as unknown as never
    });
    return { service, rpc };
  };

  beforeEach(() => {
    logger.error.mockReset();
  });

  it('unlinks through clear_transfer_links and returns what the database changed', async () => {
    const { service, rpc } = createRpcService(2);

    const count = await service.clearTransferLinks(['txn-1', 'txn-2'], 'user-1');

    expect(rpc).toHaveBeenCalledWith('clear_transfer_links', {
      p_ids: ['txn-1', 'txn-2'],
      p_user_id: 'user-1'
    });
    expect(count).toBe(2);
  });

  it('refuses to guess when the database does not report a count', async () => {
    const { service } = createRpcService(null);

    await expect(service.clearTransferLinks(['txn-1'], 'user-1')).rejects.toThrow(/refusing to assume/);
  });

  it('archives through set_transactions_archived, one row at a time', async () => {
    const { service, rpc } = createRpcService(1);

    await service.setTransactionArchived('txn-1', true, 'user-1');

    expect(rpc).toHaveBeenCalledWith('set_transactions_archived', {
      p_ids: ['txn-1'],
      p_archived: true,
      p_user_id: 'user-1'
    });
  });

  it('repairs a claimed transfer in ONE call and converts all three rows it returns', async () => {
    const row = (id: string): Record<string, unknown> => ({
      id,
      account_id: 'acct-1',
      amount: 200,
      type: 'transfer',
      date: '2026-05-01',
      description: id
    });
    const { service, rpc } = createRpcService({
      stranded: row('stranded'),
      counterpart: row('counterpart'),
      partner: row('partner')
    });

    const result = await service.repairClaimedTransfer(
      'stranded', 'counterpart', 'partner', 'cat-adjustment', 'user-1'
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('repair_claimed_transfer', {
      p_stranded_id: 'stranded',
      p_counterpart_id: 'counterpart',
      p_partner_id: 'partner',
      p_adjustment_category_id: 'cat-adjustment',
      p_user_id: 'user-1'
    });
    expect(result.stranded.date).toBeInstanceOf(Date);
    expect(result.counterpart.id).toBe('counterpart');
    expect(result.partner.id).toBe('partner');
  });

  it('links a split LINE in ONE call and converts both rows it returns', async () => {
    const { service, rpc } = createRpcService({
      split: {
        id: 'leg', transaction_id: 'parent', category: 'tofrom-current',
        amount: '30000.00', sort_order: 1,
        transfer_account_id: 'loan', linked_transfer_id: 'loan-row'
      },
      transaction: {
        id: 'loan-row', account_id: 'loan', amount: -30000, type: 'transfer',
        date: '2026-07-10', description: 'Repaid in full',
        transfer_account_id: 'current', linked_transfer_id: 'parent',
        linked_transfer_split_id: 'leg'
      }
    });

    const result = await service.linkSplitLineTransfer('leg', 'loan-row', 'user-1');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('link_split_line_transfer', {
      p_split_id: 'leg',
      p_transaction_id: 'loan-row',
      p_user_id: 'user-1'
    });
    // numeric columns arrive as strings from PostgREST; the line is the thing
    // whose amount has to survive that intact.
    expect(result.split).toMatchObject({
      id: 'leg', amount: 30000, transferAccountId: 'loan', linkedTransferId: 'loan-row'
    });
    expect(result.transaction).toMatchObject({
      id: 'loan-row', type: 'transfer', linkedTransferId: 'parent', linkedTransferSplitId: 'leg'
    });
    expect(result.transaction.date).toBeInstanceOf(Date);
  });

  it('surfaces the database refusal verbatim', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'transfer_pair_not_linked' } }));
    const service = createTransactionService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now: () => new Date(fixedNow),
      uuid: () => 'generated-id',
      supabaseClient: { rpc } as unknown as never
    });

    await expect(
      service.repairClaimedTransfer('stranded', 'counterpart', 'partner', 'cat-adjustment', 'user-1')
    ).rejects.toThrow('transfer_pair_not_linked');
  });
});


// The local fallback of setTransactionSplits was removed: DataService owns the
// only local split writer, and nothing could reach this one (DataService calls
// it from its cloud branch alone, and both gate on the same
// isSupabaseConfigured). What survives of the 2026-07-21 regression — a split
// whose total differs must move the account balance by an exact Decimal delta —
// is covered against the surviving writer in dataService.test.ts.
describe('TransactionService setTransactionSplits — local mode refuses', () => {
  it('sends local mode to DataService instead of writing a second mirror', async () => {
    const storage = createStorage();
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn() },
      now: vi.fn(() => new Date('2025-05-01T12:00:00.000Z')),
      uuid: vi.fn(() => 'generated-id')
    });

    await expect(
      service.setTransactionSplits(
        'txn-1',
        [
          { category: 'cat-a', amount: -0.2 },
          { category: 'cat-b', amount: -70.1 }
        ],
        null
      )
    ).rejects.toThrow('local mode goes through DataService');
    expect(storage.set).not.toHaveBeenCalled();
  });
});

describe('toAccountBalanceMap', () => {
  it('reads numeric balances that arrive as strings without float drift', () => {
    const balances = toAccountBalanceMap([
      { account_id: 'acc-1', balance: '1234.56', txn_count: '3' },
      { account_id: 'acc-2', balance: -99.99, txn_count: 1 }
    ]);

    expect(balances.get('acc-1')).toEqual({ balance: 1234.56, txnCount: 3 });
    expect(balances.get('acc-2')).toEqual({ balance: -99.99, txnCount: 1 });
  });

  it('skips unusable rows instead of failing the whole load', () => {
    const balances = toAccountBalanceMap([
      null,
      'nonsense',
      { account_id: '', balance: 5 },
      { account_id: 'acc-2', balance: 'not-a-number' },
      { account_id: 'acc-3' },
      { account_id: 'acc-4', balance: 10 }
    ]);

    expect(balances.size).toBe(1);
    expect(balances.get('acc-4')).toEqual({ balance: 10, txnCount: 0 });
  });

  it('returns an empty map for a payload that is not a row array', () => {
    expect(toAccountBalanceMap(null).size).toBe(0);
    expect(toAccountBalanceMap(undefined).size).toBe(0);
    expect(toAccountBalanceMap({ account_id: 'acc-1', balance: 1 }).size).toBe(0);
  });
});

describe('TransactionService.getAccountBalances', () => {
  it('returns an empty map without the cloud connection — it is only an optimisation', async () => {
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: createStorage(),
      logger: { error: vi.fn() }
    });

    await expect(service.getAccountBalances()).resolves.toEqual(new Map());
  });
});
