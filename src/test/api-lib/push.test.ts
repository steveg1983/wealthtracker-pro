import { describe, it, expect, vi } from 'vitest';
import { notifyUser, type PushDeps, type PushDeviceRow } from '../../../api/_lib/push';
import type { ApnsResult } from '../../../api/_lib/apns';

/**
 * TELLING A PERSON'S PHONES SOMETHING — the housekeeping each of Apple's
 * answers calls for, without Apple. Every token invented (public repo).
 */

const device = (n: number, environment: 'production' | 'sandbox' = 'production'): PushDeviceRow => ({
  id: `dev-${n}`,
  token: `${'ab'.repeat(16)}${n}`,
  apns_environment: environment,
});

function harness(devices: PushDeviceRow[], answers: Record<string, ApnsResult[]>) {
  const sends: string[] = [];
  const deps: PushDeps = {
    listEnabledDevices: vi.fn(async () => devices),
    send: vi.fn(async (d: PushDeviceRow, environment: string) => {
      sends.push(`${d.id}@${environment}`);
      const queue = answers[d.id] ?? [];
      return queue.shift() ?? { kind: 'sent' };
    }),
    retireDevice: vi.fn(async () => undefined),
    rememberEnvironment: vi.fn(async () => undefined),
  };
  return { deps, sends };
}

const note = { title: 'Hello', body: 'World' };

describe('notifyUser', () => {
  it('sends to every enabled device and counts what Apple accepted', async () => {
    const h = harness([device(1), device(2)], {});
    const outcome = await notifyUser(h.deps, 'user-1', note);
    expect(outcome).toEqual({ devices: 2, sent: 2, retired: 0, failed: 0 });
    expect(h.sends).toEqual(['dev-1@production', 'dev-2@production']);
  });

  it('a token Apple no longer delivers to is retired with the reason, not deleted', async () => {
    const h = harness([device(1)], { 'dev-1': [{ kind: 'unregistered', reason: 'Unregistered' }] });
    const outcome = await notifyUser(h.deps, 'user-1', note);
    expect(h.deps.retireDevice).toHaveBeenCalledWith('dev-1', 'Unregistered');
    expect(outcome.retired).toBe(1);
    expect(outcome.sent).toBe(0);
  });

  it('a bad token is tried ONCE on the other host, and the row remembers where it lives', async () => {
    // A build run from Xcode registers a sandbox token; the row assumed
    // production. Production says BadDeviceToken; sandbox delivers.
    const h = harness([device(1, 'production')], { 'dev-1': [{ kind: 'bad_token', reason: 'BadDeviceToken' }, { kind: 'sent' }] });
    const outcome = await notifyUser(h.deps, 'user-1', note);
    expect(h.sends).toEqual(['dev-1@production', 'dev-1@sandbox']);
    expect(h.deps.rememberEnvironment).toHaveBeenCalledWith('dev-1', 'sandbox');
    expect(h.deps.retireDevice).not.toHaveBeenCalled();
    expect(outcome.sent).toBe(1);
  });

  it('a token bad on BOTH hosts is retired', async () => {
    const h = harness([device(1)], { 'dev-1': [{ kind: 'bad_token', reason: 'BadDeviceToken' }, { kind: 'bad_token', reason: 'BadDeviceToken' }] });
    const outcome = await notifyUser(h.deps, 'user-1', note);
    expect(h.sends).toHaveLength(2);
    expect(h.deps.retireDevice).toHaveBeenCalledWith('dev-1', 'BadDeviceToken');
    expect(h.deps.rememberEnvironment).not.toHaveBeenCalled();
    expect(outcome.retired).toBe(1);
  });

  it('a refused provider token is counted as a failure and touches no row — it is OUR key that is wrong', async () => {
    const h = harness([device(1), device(2)], { 'dev-1': [{ kind: 'auth_failed', reason: 'InvalidProviderToken' }] });
    const outcome = await notifyUser(h.deps, 'user-1', note);
    expect(h.deps.retireDevice).not.toHaveBeenCalled();
    expect(outcome).toEqual({ devices: 2, sent: 1, retired: 0, failed: 1 });
  });

  it('Apple being unreachable for one device does not stop the next', async () => {
    const h = harness([device(1), device(2)], {});
    h.deps.send = vi.fn(async (d: PushDeviceRow) => {
      if (d.id === 'dev-1') throw new Error('ECONNRESET');
      return { kind: 'sent' } as ApnsResult;
    });
    const outcome = await notifyUser(h.deps, 'user-1', note);
    expect(outcome).toEqual({ devices: 2, sent: 1, retired: 0, failed: 1 });
  });

  it('nobody listening is nothing sent and nothing wrong', async () => {
    const h = harness([], {});
    expect(await notifyUser(h.deps, 'user-1', note)).toEqual({ devices: 0, sent: 0, retired: 0, failed: 0 });
    expect(h.deps.send).not.toHaveBeenCalled();
  });
});
