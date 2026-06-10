import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Lightweight sliding-window rate limiter.
 *
 * HONEST LIMITATION: state is per serverless instance — a determined attacker
 * spread across many cold starts can exceed the nominal limit. This is a
 * meaningful brake on casual abuse and credential stuffing, not a hard
 * guarantee. For a hard guarantee, back this with a shared store
 * (Upstash/Redis) — the call-site API is designed so only this file changes.
 */

interface WindowEntry {
  timestamps: number[];
}

const buckets = new Map<string, WindowEntry>();
const MAX_BUCKETS = 10_000; // memory guard for long-lived instances

const getClientKey = (req: VercelRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress ?? 'unknown';
  return ip;
};

export interface RateLimitOptions {
  /** Identifier for the route so limits are tracked per endpoint. */
  name: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Returns true (and writes a 429 response) when the caller is over the limit.
 * Usage at the top of a handler:
 *   if (applyRateLimit(req, res, { name: 'checkout', limit: 10, windowMs: 60_000 })) return;
 */
export const applyRateLimit = (
  req: VercelRequest,
  res: VercelResponse,
  options: RateLimitOptions
): boolean => {
  const now = Date.now();
  const key = `${options.name}:${getClientKey(req)}`;

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
    const retryAfterSeconds = Math.ceil(
      (entry.timestamps[0] + options.windowMs - now) / 1000
    );
    res.setHeader('Retry-After', String(Math.max(1, retryAfterSeconds)));
    res.status(429).json({
      error: 'Too many requests, please try again shortly',
      code: 'rate_limited'
    });
    return true;
  }

  entry.timestamps.push(now);
  return false;
};
