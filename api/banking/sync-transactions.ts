import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SyncTransactionsRequest } from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { withSentry } from '../_lib/sentry.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getUserBankConnection } from '../_lib/banking-sync.js';
import { runTransactionSync } from '../_lib/sync-transactions-core.js';
import { recordSyncFailure, SyncRefusal } from '../_lib/sync-outcome.js';

/**
 * The button's route to the transaction sync. The sync itself is
 * api/_lib/sync-transactions-core.ts, shared with the cloud refresh cron;
 * what is left here is what only an HTTP caller needs — CORS, the rate
 * limit, the bearer token, and the two refusals that come before any bank is
 * spoken to.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (await applyRateLimit(req, res, { name: 'sync-transactions', limit: 6, windowMs: 60_000 })) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  let authUserId: string | null = null;
  try {
    const auth = await requireAuth(req);
    authUserId = auth.userId;
    const supabase = getServiceRoleSupabase();
    const body = req.body as SyncTransactionsRequest | undefined;
    if (!body || typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
      return createErrorResponse(res, 400, 'connectionId is required', 'invalid_request');
    }

    const connectionId = body.connectionId.trim();
    const connection = await getUserBankConnection(supabase, auth.userId, connectionId);
    if (!connection) {
      return createErrorResponse(res, 404, 'Connection not found', 'not_found');
    }

    // ALREADY MARKED: a connection waiting on the owner to reconnect is not
    // an error to rediscover hourly. Refusing here — before any provider
    // call — is what turns three days of one email per sync into exactly
    // one email at the transition: the classifier below already keeps the
    // transition itself out of Sentry, and this guard keeps every visit
    // after it out of the provider, the log and the inbox. The 409 is the
    // same answer the transition gave, so the client's handling is one path.
    if (connection.needs_reauth || connection.status === 'reauth_required') {
      return createErrorResponse(res, 409, 'Bank reauthorization required', 'reauth_required');
    }

    const response = await runTransactionSync(supabase, auth.userId, connection, body);
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    if (error instanceof SyncRefusal) {
      return createErrorResponse(res, error.status, error.message, error.code, error.details);
    }

    const body = req.body as SyncTransactionsRequest | undefined;
    const { needsReauth } = await recordSyncFailure(
      getServiceRoleSupabase(),
      authUserId,
      body?.connectionId,
      'transactions',
      error,
      'sync-transactions'
    );

    return needsReauth
      ? createErrorResponse(res, 409, 'Bank reauthorization required', 'reauth_required')
      : createErrorResponse(res, 500, 'Transaction sync failed', 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
