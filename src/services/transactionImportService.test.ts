import { describe, it, expect, vi } from 'vitest';
import { TransactionImportService } from './transactionImportService';
import { toDecimal } from '../utils/decimal';
import type { Transaction } from '../types';

const makeTxns = (n: number): Omit<Transaction, 'id'>[] =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date('2024-01-01'),
    description: `Txn ${i}`,
    amount: -1,
    type: 'expense',
    accountId: 'acc1',
    category: '',
    cleared: false
  }) as Omit<Transaction, 'id'>);

/**
 * A response from a database that HAS 20260808140000 applied: it wrote what it
 * was sent and would refuse the same rows a second time.
 */
const okResp = (inserted: number, skipped = 0, idempotent = true) => ({
  ok: true,
  status: 200,
  json: async () => ({ inserted, skipped, idempotent })
});
/** A response from one that has NOT — no skipped, no idempotent. */
const legacyResp = (inserted: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ inserted })
});
const errResp = (status: number, error: string, code?: string) => ({
  ok: false,
  status,
  json: async () => ({ error, code })
});

interface WireRow {
  description: string;
  amount: number;
  notes?: string;
  statement_sequence?: number;
  category_confirmed?: boolean;
  import_source?: string;
  import_source_id?: string;
}

const bodyOf = (init: unknown): {
  accountId: string;
  transactions: WireRow[];
} => JSON.parse((init as RequestInit).body as string);

/**
 * A stand-in for `import_transactions_atomic`, obeying the one contract this
 * client depends on: a row whose (import_source, import_source_id) this user
 * already holds is SKIPPED, and only rows actually written move the balance.
 * The real thing is proven against Postgres itself in
 * supabase/migrations/20260808140000_file_import_idempotency.sql.
 */
const makeServer = () => {
  const held = new Map<string, number>();
  let balance = toDecimal(0);
  return {
    get rowCount(): number { return held.size; },
    get balance(): string { return balance.toFixed(2); },
    /** Every request the fake has been asked to apply, in order. */
    applied: [] as Array<{ inserted: number; skipped: number }>,
    post(rows: WireRow[]) {
      let inserted = 0;
      let skipped = 0;
      let sum = toDecimal(0);
      for (const row of rows) {
        const key = `${row.import_source ?? ''} ${row.import_source_id ?? ''}`;
        // No import id: nothing to collide with, exactly like a NULL in the
        // unique index. This is the pre-migration behaviour.
        const keyed = Boolean(row.import_source && row.import_source_id);
        if (keyed && held.has(key)) {
          skipped += 1;
          continue;
        }
        held.set(keyed ? key : `${key}#${held.size}`, row.amount);
        sum = sum.plus(toDecimal(row.amount));
        inserted += 1;
      }
      if (inserted > 0) {
        balance = balance.plus(sum);
      }
      this.applied.push({ inserted, skipped });
      return {
        inserted,
        skipped,
        idempotent: rows.length > 0 && rows.every(r => Boolean(r.import_source && r.import_source_id))
      };
    }
  };
};

describe('TransactionImportService', () => {
  it('chunks large imports into multiple requests and sums inserted', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: unknown) => okResp(bodyOf(init).transactions.length));
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: () => 'tok'
    });

    const result = await svc.importInChunks('acc1', makeTxns(2500));

    expect(result).toEqual({ inserted: 2500, alreadyPresent: 0, total: 2500, complete: true });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1000 + 1000 + 500
  });

  it('posts to the endpoint with the bearer token and account id', async () => {
    const fetchMock = vi.fn(async () => okResp(1));
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: async () => 'my-token'
    });

    await svc.importInChunks('acc-42', makeTxns(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/data/import-transactions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer my-token' });
    expect(bodyOf(init).accountId).toBe('acc-42');
  });

  it('reports progress as chunks complete', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: unknown) => okResp(bodyOf(init).transactions.length));
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: () => 't'
    });

    const seen: number[] = [];
    await svc.importInChunks('acc1', makeTxns(2000), { onProgress: p => seen.push(p.inserted) });

    expect(seen).toEqual([1000, 2000]);
  });

  it('stops at the first chunk that fails for good, reporting rows already committed', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
      // First chunk (starts at Txn 0) succeeds; the second always 400s, which
      // is a refusal of the request itself and is never re-posted.
      return bodyOf(init).transactions[0].description === 'Txn 0'
        ? okResp(bodyOf(init).transactions.length)
        : errResp(400, 'Row 3: amount must be a finite number', 'invalid_row');
    });
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: () => 't'
    });

    const result = await svc.importInChunks('acc1', makeTxns(2000));

    expect(result.complete).toBe(false);
    expect(result.inserted).toBe(1000); // first chunk landed
    expect(result.error).toContain('amount must be a finite number');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never calls fetch and reports incomplete when no token is available', async () => {
    const fetchMock = vi.fn();
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: () => null
    });

    const result = await svc.importInChunks('acc1', makeTxns(1));

    expect(result.complete).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a no-op for an empty import', async () => {
    const fetchMock = vi.fn();
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: () => 't'
    });

    const result = await svc.importInChunks('acc1', []);

    expect(result).toEqual({ inserted: 0, alreadyPresent: 0, total: 0, complete: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * THE HEADLINE.
   *
   * A chunk that COMMITS and then loses its response is indistinguishable, from
   * the browser, from one that never arrived. Re-posting it used to insert the
   * whole chunk a second time and move the account balance twice — silent,
   * permanent double-counting. The import id is what makes the second post a
   * no-op instead.
   */
  describe('a chunk that committed and then timed out', () => {
    it('lands once, and moves the balance once, when it is posted again', async () => {
      const server = makeServer();
      let dropNextResponse = true;
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
        const rows = bodyOf(init).transactions;
        // Chunk 2 COMMITS, then the connection dies on the way back.
        if (rows[0].description === 'Txn 1000' && dropNextResponse) {
          dropNextResponse = false;
          server.post(rows);
          throw new TypeError('Failed to fetch');
        }
        const outcome = server.post(rows);
        return okResp(outcome.inserted, outcome.skipped, outcome.idempotent);
      });

      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        delay: async () => {},
        runId: () => 'run-1'
      });

      const result = await svc.importInChunks('acc1', makeTxns(2500));

      // The import completed and every row is accounted for.
      expect(result.complete).toBe(true);
      expect(result.inserted).toBe(2500);
      // 1000 of them were the re-post, which the database refused.
      expect(result.alreadyPresent).toBe(1000);

      // 4 posts: chunk 1, chunk 2 (lost), chunk 2 again, chunk 3.
      expect(fetchMock).toHaveBeenCalledTimes(4);
      // And the second post of chunk 2 wrote nothing at all.
      expect(server.applied).toEqual([
        { inserted: 1000, skipped: 0 },
        { inserted: 1000, skipped: 0 },
        { inserted: 0, skipped: 1000 },
        { inserted: 500, skipped: 0 }
      ]);

      // NO DUPLICATE ROWS, and NO DOUBLE BALANCE MOVEMENT: 2500 rows of -1.
      expect(server.rowCount).toBe(2500);
      expect(server.balance).toBe('-2500.00');
    });

    it('is not re-posted at all against a database without the migration', async () => {
      // The schema-version window. The RPC ignores the import ids it is sent
      // until 20260808140000 is applied, so a re-post WOULD duplicate — and the
      // response says so by omitting `idempotent`. One post per chunk, exactly
      // as this client behaved before retries came back.
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
        const rows = bodyOf(init).transactions;
        if (rows[0].description === 'Txn 1000') {
          throw new TypeError('Failed to fetch');
        }
        return legacyResp(rows.length);
      });

      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        delay: async () => {}
      });

      const result = await svc.importInChunks('acc1', makeTxns(2500));

      expect(result.complete).toBe(false);
      expect(result.inserted).toBe(1000);
      expect(fetchMock).toHaveBeenCalledTimes(2); // chunk 1, chunk 2 ONCE
    });

    it('is not re-posted before the server has said it would refuse a repeat', async () => {
      // The FIRST chunk of a session is posted once and once only: nothing has
      // told this client yet that the database would catch a duplicate, and
      // "probably fine" is not a basis on which to re-send a thousand rows.
      const fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        delay: async () => {}
      });

      const result = await svc.importInChunks('acc1', makeTxns(5));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        inserted: 0,
        alreadyPresent: 0,
        total: 5,
        complete: false,
        error: 'Failed to fetch'
      });
    });

    it('gives up after ATTEMPTS_PER_CHUNK and reports what landed', async () => {
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
        const rows = bodyOf(init).transactions;
        if (rows[0].description === 'Txn 0') {
          return okResp(rows.length);
        }
        throw new TypeError('Failed to fetch');
      });
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        delay: async () => {}
      });

      const result = await svc.importInChunks('acc1', makeTxns(2000));

      expect(result.complete).toBe(false);
      expect(result.inserted).toBe(1000);
      expect(fetchMock).toHaveBeenCalledTimes(4); // chunk 1, then chunk 2 three times
    });

    it('never re-posts a 4xx, however transient the connection looks', async () => {
      // A refusal of the REQUEST. The same bytes will be refused again, and
      // retrying only delays telling the user what is wrong with their file.
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
        const rows = bodyOf(init).transactions;
        return rows[0].description === 'Txn 0'
          ? okResp(rows.length)
          : errResp(404, 'Account not found', 'not_found');
      });
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        delay: async () => {}
      });

      const result = await svc.importInChunks('acc1', makeTxns(2000));

      expect(result.complete).toBe(false);
      expect(result.error).toBe('Account not found');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a 500 and a 429, which are the server and not the request', async () => {
      const statuses = [500, 429];
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
        const rows = bodyOf(init).transactions;
        if (rows[0].description === 'Txn 0') return okResp(rows.length);
        const status = statuses.shift();
        return status === undefined
          ? okResp(rows.length, 0, true)
          : errResp(status, 'Failed to import transactions', 'internal_error');
      });
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        delay: async () => {}
      });

      const result = await svc.importInChunks('acc1', makeTxns(2000));

      expect(result.complete).toBe(true);
      expect(result.inserted).toBe(2000);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('counts a 409 "already imported" as rows that landed, not as a failure', async () => {
      // Belt and braces: the RPC skips repeats row by row and cannot raise
      // this. If anything ever does, the chunk is atomic — its rows are in the
      // account, and calling that a failure would send the user looking for
      // transactions that are in front of them.
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
        const rows = bodyOf(init).transactions;
        return rows[0].description === 'Txn 0'
          ? okResp(rows.length)
          : errResp(409, 'These transactions have already been imported into this account', 'already_imported');
      });
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        delay: async () => {}
      });

      const result = await svc.importInChunks('acc1', makeTxns(2000));

      expect(result).toEqual({ inserted: 2000, alreadyPresent: 1000, total: 2000, complete: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * The id itself: what the database is asked to key each row by.
   */
  describe('import provenance', () => {
    it('gives every row a pair, and never the same pair twice', async () => {
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => okResp(bodyOf(init).transactions.length));
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        runId: () => 'run-1'
      });

      await svc.importInChunks('acc1', makeTxns(2500));

      const rows = fetchMock.mock.calls.flatMap(call => bodyOf(call[1]).transactions);
      expect(rows).toHaveLength(2500);
      expect(rows.every(r => r.import_source === 'file-import')).toBe(true);
      // Indexed across the WHOLE file, not per chunk: chunk 2's first row is
      // 1000, so it can never collide with chunk 1's first row.
      expect(rows[0].import_source_id).toBe('post:run-1:0');
      expect(rows[1000].import_source_id).toBe('post:run-1:1000');
      expect(new Set(rows.map(r => r.import_source_id)).size).toBe(2500);
    });

    it('keeps two identical payments on one day apart', async () => {
      // Same date, same pence, same description, and two separate payments.
      // A content hash would make the database swallow one of them.
      const twice: Omit<Transaction, 'id'>[] = [
        { ...makeTxns(1)[0], description: 'CARD PAYMENT TO EXAMPLE CAFE', amount: -4.25 },
        { ...makeTxns(1)[0], description: 'CARD PAYMENT TO EXAMPLE CAFE', amount: -4.25 }
      ];
      const fetchMock = vi.fn(async () => okResp(2));
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        runId: () => 'run-1'
      });

      await svc.importInChunks('acc1', twice);

      const rows = bodyOf(fetchMock.mock.calls[0][1]).transactions;
      expect(rows.map(r => r.import_source_id)).toEqual(['post:run-1:0', 'post:run-1:1']);
    });

    it('gives a different run different ids, so a genuine second import still lands', async () => {
      const ids: string[] = [];
      const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
        ids.push(String(bodyOf(init).transactions[0].import_source_id));
        return okResp(1);
      });
      let run = 0;
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't',
        runId: () => `run-${++run}`
      });

      await svc.importInChunks('acc1', makeTxns(1));
      await svc.importInChunks('acc1', makeTxns(1));

      expect(ids).toEqual(['post:run-1:0', 'post:run-2:0']);
    });

    describe('OFX', () => {
      const ofxRow = (fitId: string): Omit<Transaction, 'id'> => ({
        ...makeTxns(1)[0],
        description: 'DIRECT DEBIT - EXAMPLE TELCO',
        notes: `FITID: ${fitId}\nRef: 99`
      });

      it('keys on the bank\'s own id, scoped to the account', async () => {
        // FITID is unique within an ACCOUNT, not within a bank, and the unique
        // index is scoped by user — so without the account in the key, one
        // account's statement could suppress another's rows.
        const fetchMock = vi.fn(async () => okResp(1));
        const svc = new TransactionImportService({
          fetch: fetchMock as unknown as typeof fetch,
          authTokenProvider: () => 't',
          runId: () => 'run-1'
        });

        await svc.importInChunks('acc-current', [ofxRow('2027030501')], { source: 'ofx' });
        await svc.importInChunks('acc-savings', [ofxRow('2027030501')], { source: 'ofx' });

        expect(bodyOf(fetchMock.mock.calls[0][1]).transactions[0]).toMatchObject({
          import_source: 'ofx',
          import_source_id: 'fitid:acc-current:2027030501'
        });
        expect(bodyOf(fetchMock.mock.calls[1][1]).transactions[0].import_source_id)
          .toBe('fitid:acc-savings:2027030501');
      });

      it('falls back to the run id when a row has no readable FITID', async () => {
        const fetchMock = vi.fn(async () => okResp(1));
        const svc = new TransactionImportService({
          fetch: fetchMock as unknown as typeof fetch,
          authTokenProvider: () => 't',
          runId: () => 'run-1'
        });

        await svc.importInChunks(
          'acc-current',
          [{ ...makeTxns(1)[0], notes: 'no id here' }],
          { source: 'ofx' }
        );

        expect(bodyOf(fetchMock.mock.calls[0][1]).transactions[0]).toMatchObject({
          import_source: 'ofx',
          import_source_id: 'post:run-1:0'
        });
      });

      it('falls back rather than sending a key the server would refuse', async () => {
        // An import_source_id over 200 characters is rejected outright. A
        // pathological file must still import, so an implausible FITID is not
        // made into a key.
        const fetchMock = vi.fn(async () => okResp(1));
        const svc = new TransactionImportService({
          fetch: fetchMock as unknown as typeof fetch,
          authTokenProvider: () => 't',
          runId: () => 'run-1'
        });

        await svc.importInChunks('acc-current', [ofxRow('X'.repeat(121))], { source: 'ofx' });

        expect(bodyOf(fetchMock.mock.calls[0][1]).transactions[0].import_source_id)
          .toBe('post:run-1:0');
      });

      it('does not read a FITID out of a QIF or CSV row', async () => {
        // Only the OFX importer writes `FITID:` into notes. Reading one out of
        // any row that happens to contain the word would key a hand-typed note
        // as if a bank had guaranteed it.
        const fetchMock = vi.fn(async () => okResp(1));
        const svc = new TransactionImportService({
          fetch: fetchMock as unknown as typeof fetch,
          authTokenProvider: () => 't',
          runId: () => 'run-1'
        });

        await svc.importInChunks('acc-current', [ofxRow('2027030501')]);

        expect(bodyOf(fetchMock.mock.calls[0][1]).transactions[0]).toMatchObject({
          import_source: 'file-import',
          import_source_id: 'post:run-1:0'
        });
      });
    });
  });

  /**
   * The bank's own order within a day, on the wire.
   *
   * Every row of one of these requests lands inside a single database
   * transaction and therefore shares a created_at, and `date` is a calendar
   * day — so if this ordinal is dropped here there is nothing left anywhere
   * that says which of a day's transactions came first.
   */
  describe('statement_sequence', () => {
    const withSequence = (sequence: number | null | undefined): Omit<Transaction, 'id'> => ({
      ...makeTxns(1)[0],
      statementSequence: sequence
    });

    it('sends the ordinal for a row that has one', async () => {
      const fetchMock = vi.fn(async () => okResp(1));
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't'
      });

      await svc.importInChunks('acc1', [withSequence(0), withSequence(7)]);

      expect(bodyOf(fetchMock.mock.calls[0][1]).transactions.map(t => t.statement_sequence))
        .toEqual([0, 7]);
    });

    it('sends no key at all for a row that has none', async () => {
      // Absent means "unknown", which is the truth for a hand-entered row and
      // for any file format that states no order. Sending null or 0 would put a
      // fabricated position where a real one belongs.
      const fetchMock = vi.fn(async () => okResp(2));
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't'
      });

      await svc.importInChunks('acc1', [withSequence(null), withSequence(undefined)]);

      for (const row of bodyOf(fetchMock.mock.calls[0][1]).transactions) {
        expect(row).not.toHaveProperty('statement_sequence');
      }
    });

    it('refuses a value that is not an ordinal', async () => {
      const fetchMock = vi.fn(async () => okResp(2));
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't'
      });

      await svc.importInChunks('acc1', [withSequence(-1), withSequence(1.5)]);

      for (const row of bodyOf(fetchMock.mock.calls[0][1]).transactions) {
        expect(row).not.toHaveProperty('statement_sequence');
      }
    });
  });

  /**
   * Whether the app GUESSED a row's category has to survive the trip to the
   * server, or it is lost the moment the statement lands and the register can
   * no longer tell a guess from the user's own choice.
   */
  describe('category_confirmed', () => {
    const withProvenance = (categoryConfirmed: boolean | undefined): Omit<Transaction, 'id'> => ({
      ...makeTxns(1)[0],
      category: 'det-groceries',
      categoryConfirmed
    });

    it('sends false for a row the app guessed', async () => {
      const fetchMock = vi.fn(async () => okResp(1));
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't'
      });

      await svc.importInChunks('acc1', [withProvenance(false)]);

      expect(bodyOf(fetchMock.mock.calls[0][1]).transactions[0].category_confirmed).toBe(false);
    });

    it('sends no key for a confirmed row — the column already defaults to true', async () => {
      const fetchMock = vi.fn(async () => okResp(2));
      const svc = new TransactionImportService({
        fetch: fetchMock as unknown as typeof fetch,
        authTokenProvider: () => 't'
      });

      await svc.importInChunks('acc1', [withProvenance(true), withProvenance(undefined)]);

      for (const row of bodyOf(fetchMock.mock.calls[0][1]).transactions) {
        expect(row).not.toHaveProperty('category_confirmed');
      }
    });
  });
});
