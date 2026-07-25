import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOptionalEnv } from './env.js';

/**
 * True only on a developer's own machine — never on a deployed Vercel runtime.
 *
 * Preview deployments are NOT local development: they run against the LIVE
 * Supabase project, so trusting `http://localhost` there let any page served
 * from a developer's (or an attacker's) local server both call the API
 * cross-origin and be used as an open-redirect target for the checkout/portal
 * flows. Vercel sets VERCEL_ENV on every deployment — 'production' and
 * 'preview' are both remote; only `vercel dev` reports 'development'. With no
 * VERCEL_ENV at all we are outside Vercel entirely (local vite / CI), so fall
 * back to NODE_ENV.
 */
const isLocalDevelopment = (): boolean => {
  const vercelEnv = (getOptionalEnv('VERCEL_ENV') ?? '').toLowerCase();
  if (vercelEnv) {
    return vercelEnv === 'development';
  }
  return (getOptionalEnv('NODE_ENV') ?? '').toLowerCase() !== 'production';
};

const parseAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  const explicit = getOptionalEnv('BANKING_ALLOWED_ORIGINS');
  if (explicit) {
    explicit
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((origin) => origins.add(origin));
  }

  const vercelUrl = getOptionalEnv('VERCEL_URL');
  if (vercelUrl) {
    origins.add(`https://${vercelUrl}`);
  }

  if (isLocalDevelopment()) {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:3000');
  }

  return origins;
};

const isOriginAllowed = (origin: string, allowed: Set<string>): boolean => {
  if (!origin) {
    return true;
  }
  return allowed.has(origin);
};

/**
 * Validate that a client-supplied redirect URL points at one of our own
 * origins. Used by checkout/portal endpoints to prevent open redirects.
 */
export const isRedirectUrlAllowed = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parseAllowedOrigins().has(parsed.origin);
  } catch {
    return false;
  }
};

export const setCorsHeaders = (req: VercelRequest, res: VercelResponse): boolean => {
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin ?? '';
  const allowedOrigins = parseAllowedOrigins();
  const allowed = isOriginAllowed(origin, allowedOrigins);

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(allowed ? 200 : 403).end();
    return true;
  }

  return false;
};
