import { describe, it, expect, vi } from 'vitest';
import { TransactionImportService } from './transactionImportService';
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

const okResp = (inserted: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ inserted })
});
const errResp = (status: number, error: string) => ({
  ok: false,
  status,
  json: async () => ({ error })
});

const bodyOf = (init: unknown): { accountId: string; transactions: { description: string }[] } =>
  JSON.parse((init as RequestInit).body as string);

describe('TransactionImportService', () => {
  it('chunks large imports into multiple requests and sums inserted', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: unknown) => okResp(bodyOf(init).transactions.length));
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: () => 'tok'
    });

    const result = await svc.importInChunks('acc1', makeTxns(2500));

    expect(result).toEqual({ inserted: 2500, total: 2500, complete: true });
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

  it('retries a failing chunk then stops, reporting rows already committed', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: unknown) => {
      // First chunk (starts at Txn 0) succeeds; the second always 500s.
      return bodyOf(init).transactions[0].description === 'Txn 0'
        ? okResp(bodyOf(init).transactions.length)
        : errResp(500, 'boom');
    });
    const svc = new TransactionImportService({
      fetch: fetchMock as unknown as typeof fetch,
      authTokenProvider: () => 't'
    });

    const result = await svc.importInChunks('acc1', makeTxns(2000));

    expect(result.complete).toBe(false);
    expect(result.inserted).toBe(1000); // first chunk landed
    expect(result.error).toContain('boom');
    // chunk 1 (1 call) + chunk 2 retried up to 3 times
    expect(fetchMock).toHaveBeenCalledTimes(4);
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

    expect(result).toEqual({ inserted: 0, total: 0, complete: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
