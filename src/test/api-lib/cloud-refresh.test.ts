import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cloudRefreshCutoff,
  runCloudRefresh,
  HOURS_BETWEEN_UNATTENDED_REFRESHES,
  UNATTENDED_READS_PER_DAY,
  type CloudRefreshDeps,
  type DueConnection,
} from '../../../api/_lib/cloud-refresh';
import { SyncRefusal } from '../../../api/_lib/sync-outcome';
import type { BankConnectionRow } from '../../../api/_lib/banking-sync';

/**
 * THE CLOUD REFRESH'S RULES, WITHOUT A BANK.
 *
 * Feeds that keep flowing while the app is closed (owner, 11 Sep 2026). The
 * runner is a function over injected verbs, and these pin what the verbs are
 * asked and in what order — the four-a-day cap, the stamp-before-speak rule,
 * the budget, and that a failure on one connection is a fact about one
 * connection. api/** is excluded from the vitest project, so these run from
 * here like their siblings.
 *
 * Every id and name here invented: this repo is public.
 */

const T0 = new Date('2026-09-11T03:07:00Z');

const due = (n: number, overrides: Partial<DueConnection> = {}): DueConnection => ({
  connection_id: `conn-${n}`,
  user_id: `user-${n}`,
  institution_name: `Bank ${n}`,
  last_sync: null,
  ...overrides,
});

const row = (n: number, overrides: Partial<BankConnectionRow> = {}): BankConnectionRow => ({
  id: `conn-${n}`,
  user_id: `user-${n}`,
  provider: 'truelayer',
  institution_id: `inst-${n}`,
  institution_name: `Bank ${n}`,
  access_token_encrypted: 'x',
  refresh_token_encrypted: null,
  status: 'connected',
  needs_reauth: false,
  ...overrides,
});

/**
 * A clock that advances only when asked, a due-list that shrinks as attempts
 * are stamped (the real function's behaviour), and every verb recorded.
 */
function harness(initialDue: DueConnection[], opts: { tickMs?: number } = {}) {
  let clock = T0.getTime();
  const tickMs = opts.tickMs ?? 0;
  const stamped: string[] = [];
  const calls: string[] = [];
  let remaining = [...initialDue];
  const rows = new Map<string, BankConnectionRow>(initialDue.map((d, i) => [d.connection_id, row(i + 1)]));

  const deps: CloudRefreshDeps = {
    now: () => new Date(clock),
    listDue: vi.fn(async (_notSince: Date, limit: number) => {
      calls.push(`listDue:${limit}`);
      return remaining.slice(0, limit);
    }),
    stampAttempt: vi.fn(async (connectionId: string) => {
      calls.push(`stamp:${connectionId}`);
      stamped.push(connectionId);
      remaining = remaining.filter((d) => d.connection_id !== connectionId);
    }),
    loadConnection: vi.fn(async (_userId: string, connectionId: string) => rows.get(connectionId) ?? null),
    syncAccounts: vi.fn(async (_userId: string, connection: BankConnectionRow) => {
      calls.push(`accounts:${connection.id}`);
      clock += tickMs;
      return { success: true, accountsSynced: 1, accounts: [] };
    }),
    syncTransactions: vi.fn(async (_userId: string, connection: BankConnectionRow) => {
      calls.push(`transactions:${connection.id}`);
      clock += tickMs;
      return { success: true, transactionsImported: 3, duplicatesSkipped: 0 };
    }),
    recordFailure: vi.fn(async () => ({ needsReauth: false })),
  };

  return { deps, calls, stamped, rows, advance: (ms: number) => { clock += ms; } };
}

describe('the cap is PSD2\'s, not ours', () => {
  it('four unattended reads a day means six hours between them', () => {
    expect(UNATTENDED_READS_PER_DAY).toBe(4);
    expect(HOURS_BETWEEN_UNATTENDED_REFRESHES).toBe(6);
    expect(24 / HOURS_BETWEEN_UNATTENDED_REFRESHES).toBeLessThanOrEqual(UNATTENDED_READS_PER_DAY);
  });

  it('the cutoff asked of the due-list is now minus that interval', () => {
    expect(cloudRefreshCutoff(T0).toISOString()).toBe('2026-09-10T21:07:00.000Z');
  });
});

describe('one connection, the same sync as the button', () => {
  it('stamps the attempt BEFORE speaking to the bank, then accounts, then transactions', async () => {
    const h = harness([due(1)]);
    const summary = await runCloudRefresh(h.deps, { budgetMs: 60_000 });

    expect(h.calls).toEqual(['listDue:25', 'stamp:conn-1', 'accounts:conn-1', 'transactions:conn-1', 'listDue:25']);
    expect(summary.synced).toBe(1);
    expect(summary.imported).toBe(3);
    expect(summary.exhausted).toBe(false);
    expect(summary.results[0]?.outcome).toEqual({ kind: 'synced', imported: 3 });
  });

  it('a row that turned reauth_required between listing and loading is skipped, unsynced', async () => {
    const h = harness([due(1)]);
    h.rows.set('conn-1', row(1, { needs_reauth: true, status: 'reauth_required' }));
    const summary = await runCloudRefresh(h.deps, { budgetMs: 60_000 });

    expect(h.deps.syncAccounts).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
    // …and it was still stamped: the interval applies whatever the answer.
    expect(h.stamped).toEqual(['conn-1']);
  });

  it('a row no longer the user\'s is skipped rather than synced under the wrong owner', async () => {
    const h = harness([due(1)]);
    h.rows.delete('conn-1');
    const summary = await runCloudRefresh(h.deps, { budgetMs: 60_000 });
    expect(summary.skipped).toBe(1);
    expect(h.deps.syncAccounts).not.toHaveBeenCalled();
  });
});

describe('a failure on one connection is a fact about one connection', () => {
  it('records the failure through the shared recorder and carries on to the next', async () => {
    const h = harness([due(1), due(2)]);
    h.deps.syncTransactions = vi.fn(async (_u: string, c: BankConnectionRow) => {
      if (c.id === 'conn-1') throw new Error('TrueLayer transactions fetch failed: 503');
      return { success: true, transactionsImported: 1, duplicatesSkipped: 0 };
    });
    const summary = await runCloudRefresh(h.deps, { budgetMs: 60_000 });

    expect(h.deps.recordFailure).toHaveBeenCalledTimes(1);
    expect(h.deps.recordFailure).toHaveBeenCalledWith('user-1', 'conn-1', 'transactions', expect.any(Error));
    expect(summary.failed).toBe(1);
    expect(summary.synced).toBe(1);
    expect(summary.imported).toBe(1);
  });

  it('names which half failed — an accounts failure is recorded as accounts', async () => {
    const h = harness([due(1)]);
    h.deps.syncAccounts = vi.fn(async () => { throw new Error('boom'); });
    await runCloudRefresh(h.deps, { budgetMs: 60_000 });
    expect(h.deps.recordFailure).toHaveBeenCalledWith('user-1', 'conn-1', 'accounts', expect.any(Error));
    expect(h.deps.syncTransactions).not.toHaveBeenCalled();
  });

  it('a reauth verdict from the recorder is counted as reauth, not as a failure', async () => {
    const h = harness([due(1)]);
    h.deps.syncAccounts = vi.fn(async () => { throw new Error('invalid_grant'); });
    h.deps.recordFailure = vi.fn(async () => ({ needsReauth: true }));
    const summary = await runCloudRefresh(h.deps, { budgetMs: 60_000 });
    expect(summary.reauthRequired).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.results[0]?.outcome).toEqual({ kind: 'reauth_required' });
  });

  it('a SyncRefusal marks nothing — it is "could not be attempted", the handler\'s own treatment', async () => {
    const h = harness([due(1)]);
    h.deps.syncTransactions = vi.fn(async () => {
      throw new SyncRefusal(500, 'Atomic import RPC missing', 'schema_mismatch');
    });
    const summary = await runCloudRefresh(h.deps, { budgetMs: 60_000 });
    expect(h.deps.recordFailure).not.toHaveBeenCalled();
    expect(summary.refused).toBe(1);
    expect(summary.results[0]?.outcome).toEqual({ kind: 'refused', code: 'schema_mismatch' });
  });
});

describe('one run, one budget', () => {
  it('stops taking connections once the budget is spent, and says the list was not cleared', async () => {
    // Each sync half costs 20 s. The first connection is begun inside the
    // budget and overruns it — a sync begun is finished — and the run then
    // stops rather than beginning a second.
    const h = harness([due(1), due(2), due(3)], { tickMs: 20_000 });
    const summary = await runCloudRefresh(h.deps, { budgetMs: 30_000 });

    expect(summary.considered).toBe(1);
    expect(summary.synced).toBe(1);
    expect(summary.exhausted).toBe(true);
    // The connections it did not reach were NOT stamped: they are still due
    // for the next run, exactly as they should be.
    expect(h.stamped).toEqual(['conn-1']);
  });

  it('a cleared list is not exhaustion, however long it took', async () => {
    const h = harness([due(1), due(2)], { tickMs: 1_000 });
    const summary = await runCloudRefresh(h.deps, { budgetMs: 60_000 });
    expect(summary.considered).toBe(2);
    expect(summary.exhausted).toBe(false);
  });

  it('asks in batches and re-asks until the list is empty — the stamp is what shrinks it', async () => {
    const h = harness([due(1), due(2), due(3)]);
    await runCloudRefresh(h.deps, { budgetMs: 60_000, batchSize: 2 });
    expect(h.calls.filter((c) => c.startsWith('listDue'))).toEqual(['listDue:2', 'listDue:2', 'listDue:2']);
    expect(h.stamped).toEqual(['conn-1', 'conn-2', 'conn-3']);
  });
});

describe('the cron is wired, and its budget fits its wall-clock', () => {
  const root = resolve(__dirname, '../../../');
  const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
    crons: Array<{ path: string; schedule: string }>;
    functions: Record<string, { maxDuration: number }>;
  };
  const handler = readFileSync(resolve(root, 'api/cron/bank-feeds.ts'), 'utf8');

  it('runs hourly — the due-list, not the schedule, is what enforces the six-hour interval', () => {
    const cron = vercel.crons.find((c) => c.path === '/api/cron/bank-feeds');
    expect(cron?.schedule).toBe('7 * * * *');
  });

  it('the run budget sits under the function\'s maxDuration with room for the last sync to finish', () => {
    const maxDuration = vercel.functions['api/cron/bank-feeds.ts']?.maxDuration;
    const budget = Number(/RUN_BUDGET_MS = ([\d_]+)/.exec(handler)?.[1]?.replace(/_/g, ''));
    expect(maxDuration).toBe(120);
    expect(budget).toBe(90_000);
    expect(budget).toBeLessThan(maxDuration * 1000);
  });

  it('is protected by CRON_SECRET like every other cron', () => {
    expect(handler).toContain("getRequiredEnv('CRON_SECRET')");
    expect(handler).toContain('timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)');
  });
});
