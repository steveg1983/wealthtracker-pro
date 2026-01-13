import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOptionalEnv } from './env.js';

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

  const env = (getOptionalEnv('VERCEL_ENV') ?? getOptionalEnv('NODE_ENV') ?? '').toLowerCase();
  if (env !== 'production') {
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
