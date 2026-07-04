import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOptionalEnv } from './env.js';

/**
 * Rate limiter (audit finding #18).
 *
 * Two layers, chosen at runtime:
 *
 *  1. SHARED STORE (Upstash Redis over REST) when UPSTASH_REDIS_REST_URL/TOKEN
 *     (or the Vercel-marketplace KV_REST_API_URL/TOKEN names) are configured:
 *     one fixed window per (route, client) across ALL serverless instances —
 *     limits no longer multiply by instance count.
 *  2. IN-MEMORY fallback otherwise — the previous per-instance behaviour, kept
 *     so the module is inert-until-configured (same pattern as api/_lib/sentry).
 *
 * Client key: `x-real-ip`, which Vercel's proxy sets from the CONNECTING IP
 * and overwrites if a client supplies it — unlike the leftmost
 * `x-forwarded-for` entry (the previous key), which is client-controlled and
 * let an attacker mint a fresh bucket per request by rotating the header.
 *
 * Failure policy: the limiter is an abuse/cost brake in front of auth'd
 * endpoints, not an access-control boundary — on store errors/timeouts it
 * FAILS OVER to the per-instance in-memory limiter (NOT fully open), so a
 * Redis blip can never take the API down, while an attacker who induces store
 * timeouts still hits the old in-memory floor.
 */

interface WindowEntry {
  timestamps: number[];
}

const buckets = new Map<string, WindowEntry>();
const MAX_BUCKETS = 10_000; // memory guard for long-lived instances

const UPSTASH_TIMEOUT_MS = 800;

const getStoreConfig = (): { url: string; token: string } | null => {
  const url = getOptionalEnv('UPSTASH_REDIS_REST_URL') ?? getOptionalEnv('KV_REST_API_URL');
  const token = getOptionalEnv('UPSTASH_REDIS_REST_TOKEN') ?? getOptionalEnv('KV_REST_API_TOKEN');
  return url && token ? { url, token } : null;
};

const getClientKey = (req: VercelRequest): string => {
  // Trusted on Vercel: set by the proxy from the connection, not spoofable
  // through it.
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  // Fallback outside Vercel: the RIGHTmost x-forwarded-for hop is the one
  // appended by the nearest proxy; the leftmost is client-supplied. A trailing
  // comma must not yield an empty hop (that would lump everyone into one
  // shared empty-string bucket) — fall through to the socket instead.
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) {
      return hops[hops.length - 1];
    }
  }
  return req.socket?.remoteAddress ?? 'unknown';
};

export interface RateLimitOptions {
  /** Identifier for the route so limits are tracked per endpoint. */
  name: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

interface LimitDecision {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * Fixed window in Redis: INCR the (route, client) key and set its TTL on first
 * hit — one pipeline round-trip. Returns null on any store failure (fail open).
 */
const checkSharedStore = async (
  store: { url: string; token: string },
  key: string,
  options: RateLimitOptions
): Promise<LimitDecision | null> => {
  try {
    const response = await fetch(`${store.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${store.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, String(options.windowMs), 'NX'],
        ['PTTL', key]
      ]),
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS)
    });
    if (!response.ok) {
      console.error('[rate-limit] store returned non-OK', { status: response.status });
      return null;
    }
    const results = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    // Upstash pipelines are NON-atomic and keep executing past a failed
    // command — every command's error field must be inspected. In particular,
    // a store that rejected PEXPIRE NX would leave the INCR key with NO TTL:
    // the counter would grow forever and permanently 429 a legitimate client
    // (on checkout/account-delete!). Any command error, or a counter that has
    // no expiry (PTTL -1 after the first hit), is treated as a store failure
    // → fail over to in-memory instead of trusting a counter that never resets.
    const failedCommand = results?.find((r) => r?.error);
    if (failedCommand) {
      console.error('[rate-limit] pipeline command failed', { error: failedCommand.error });
      return null;
    }
    const count = Number(results?.[0]?.result);
    const pttl = Number(results?.[2]?.result);
    if (!Number.isFinite(count)) {
      console.error('[rate-limit] unexpected store response shape');
      return null;
    }
    if (pttl === -1 && count > 1) {
      console.error('[rate-limit] counter has no TTL — refusing to enforce a window that never resets');
      return null;
    }
    const retryAfterSeconds = Number.isFinite(pttl) && pttl > 0
      ? Math.ceil(pttl / 1000)
      : Math.ceil(options.windowMs / 1000);
    return { limited: count > options.limit, retryAfterSeconds };
  } catch (error) {
    // Timeout/network/etc: fail open — availability beats strictness for a brake.
    console.error('[rate-limit] store check failed', {
      message: error instanceof Error ? error.message : 'unknown'
    });
    return null;
  }
};

/** The previous per-instance sliding window, kept as the unconfigured fallback. */
const checkInMemory = (key: string, options: RateLimitOptions): LimitDecision => {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    buckets.clear();
  }

  let entry = buckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }

  const windowStart = now - options.windowMs;
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  if (entry.timestamps.length >= options.limit) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.timestamps[0] + options.windowMs - now) / 1000)
      )
    };
  }

  entry.timestamps.push(now);
  return { limited: false, retryAfterSeconds: 0 };
};

/**
 * Returns true (and writes a 429 response) when the caller is over the limit.
 * Usage at the top of a handler:
 *   if (await applyRateLimit(req, res, { name: 'checkout', limit: 10, windowMs: 60_000 })) return;
 */
export const applyRateLimit = async (
  req: VercelRequest,
  res: VercelResponse,
  options: RateLimitOptions
): Promise<boolean> => {
  const key = `rl:${options.name}:${getClientKey(req)}`;

  const store = getStoreConfig();
  const decision = (store && (await checkSharedStore(store, key, options)))
    ?? checkInMemory(key, options);

  if (decision.limited) {
    res.setHeader('Retry-After', String(Math.max(1, decision.retryAfterSeconds)));
    res.status(429).json({
      error: 'Too many requests, please try again shortly',
      code: 'rate_limited'
    });
    return true;
  }
  return false;
};
