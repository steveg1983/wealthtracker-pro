/**
 * The rate limiter's two buckets, on the in-memory path.
 *
 * The shared-store path is the same arithmetic over a Redis pipeline; what
 * these specs hold is the SHAPE of the decision — per caller when a bearer
 * names one, per IP always, strictest wins — which is what the connector's
 * public life depends on: many people through one address, none of them
 * paying for another's noise, and a flood of invented tokens from one
 * address still braked.
 */

import { describe, it, expect, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, bearerClientKey } from '../../../api/_lib/rate-limit';

let routes = 0;

const request = (ip: string, token?: string): VercelRequest =>
  ({
    headers: {
      'x-real-ip': ip,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    socket: { remoteAddress: ip },
  } as unknown as VercelRequest);

const response = () => {
  const headers: Record<string, string> = {};
  const res = {
    status: 0,
    body: undefined as unknown,
    setHeader: (name: string, value: string) => { headers[name] = value; },
    status_: (code: number) => { res.status = code; return res; },
  };
  const vercel = {
    setHeader: res.setHeader,
    status: (code: number) => { res.status = code; return vercel; },
    json: (body: unknown) => { res.body = body; return vercel; },
  } as unknown as VercelResponse;
  return { res, vercel, headers };
};

/** A fresh route name per spec, so the module's buckets never bleed between them. */
const options = (over: Partial<Parameters<typeof applyRateLimit>[2]> = {}) => {
  routes += 1;
  return { name: `spec-${routes}`, limit: 3, windowMs: 60_000, ...over };
};

describe('bearerClientKey', () => {
  it('is a hash of the bearer token, never the token, and nothing without one', () => {
    const key = bearerClientKey(request('1.1.1.1', 'secret-token'));
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('secret');
    expect(bearerClientKey(request('1.1.1.1', 'secret-token'))).toBe(key);
    expect(bearerClientKey(request('1.1.1.1', 'other-token'))).not.toBe(key);
    expect(bearerClientKey(request('1.1.1.1'))).toBeUndefined();
    expect(bearerClientKey({ headers: { authorization: 'Basic abc' } } as unknown as VercelRequest)).toBeUndefined();
  });
});

describe('applyRateLimit', () => {
  it('limits per IP when no caller is named', async () => {
    const opts = options();
    const results: boolean[] = [];
    for (let i = 0; i < 4; i += 1) results.push(await applyRateLimit(request('10.0.0.1'), response().vercel, opts));
    expect(results).toEqual([false, false, false, true]);
    // Another address is its own bucket.
    expect(await applyRateLimit(request('10.0.0.2'), response().vercel, opts)).toBe(false);
  });

  it('with perClient, two callers behind one address are counted apart — up to the address’s ceiling', async () => {
    const opts = options({ limit: 5, perClient: { key: bearerClientKey, limit: 2 } });
    const alice = () => applyRateLimit(request('160.79.104.1', 'alice'), response().vercel, opts);
    const bob = () => applyRateLimit(request('160.79.104.1', 'bob'), response().vercel, opts);
    expect(await alice()).toBe(false);
    expect(await alice()).toBe(false);
    expect(await alice()).toBe(true); // Alice's third: her own bucket is full.
    expect(await bob()).toBe(false); // Bob is unaffected by Alice.
    expect(await bob()).toBe(false);
    // The address has now carried 5: the ceiling closes it to everyone, new token or not.
    expect(await applyRateLimit(request('160.79.104.1', 'carol'), response().vercel, opts)).toBe(true);
  });

  it('writes 429 with Retry-After and the code the clients read', async () => {
    const opts = options({ limit: 1 });
    await applyRateLimit(request('10.0.0.9'), response().vercel, opts);
    const { res, vercel, headers } = response();
    expect(await applyRateLimit(request('10.0.0.9'), vercel, opts)).toBe(true);
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: 'rate_limited' });
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1);
  });

  it('does not reach for the store when none is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await applyRateLimit(request('10.0.0.3'), response().vercel, options());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
