import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Sentry from '@sentry/node';
import { getOptionalEnv } from './env.js';

/**
 * Server-side error reporting for the API (audit findings #7 + #35).
 *
 * Before this the api/ handlers were completely uninstrumented — a 500 in a
 * banking, Stripe, or cron handler was invisible. This wires @sentry/node.
 *
 * SENTRY_DSN is intentionally NON-VITE (server-only; a VITE_-prefixed secret
 * would be inlined into the public client bundle). When it is unset the whole
 * module is an inert no-op, so the API behaves identically until the DSN is
 * configured in the deploy environment.
 */

let initialized: boolean | null = null;

export const initServerSentry = (): boolean => {
  if (initialized !== null) {
    return initialized;
  }
  const dsn = getOptionalEnv('SENTRY_DSN');
  if (!dsn) {
    initialized = false;
    return false;
  }
  Sentry.init({
    dsn,
    environment: getOptionalEnv('VERCEL_ENV') ?? 'production',
    release: getOptionalEnv('VERCEL_GIT_COMMIT_SHA'),
    tracesSampleRate: 0,   // error capture only — no performance tracing server-side
    sendDefaultPii: false  // never attach cookies / headers / client IP
  });
  initialized = true;
  return true;
};

/**
 * Report a server-side error, then flush — a serverless function can freeze the
 * event loop the instant its handler returns, dropping un-flushed events. Safe
 * no-op when Sentry is unconfigured.
 *
 * `extra` MUST contain only non-PII diagnostics (route, stable ids, error
 * code) — never tokens, request bodies, or bank/transaction data.
 */
export const captureServerError = async (
  error: unknown,
  extra?: Record<string, unknown>
): Promise<void> => {
  if (!initServerSentry()) {
    return;
  }
  Sentry.captureException(error, extra ? { extra } : undefined);
  try {
    await Sentry.flush(2000);
  } catch {
    /* flush timed out — telemetry must never affect the response path */
  }
};

/**
 * Wrap a Vercel handler so any UNHANDLED throw is reported (with minimal,
 * non-PII request context) and answered with a generic 500 that matches the
 * app's no-leak convention. Handlers that catch their own errors are
 * unaffected — this is the safety net for the unexpected ones.
 */
export const withSentry = <
  H extends (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
>(handler: H) =>
  async (req: VercelRequest, res: VercelResponse): Promise<unknown> => {
    try {
      return await handler(req, res);
    } catch (error) {
      await captureServerError(error, {
        route: typeof req.url === 'string' ? req.url.split('?')[0] : undefined,
        method: req.method
      });
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error', code: 'internal_error' });
      }
      return undefined;
    }
  };
