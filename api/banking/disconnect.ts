import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DisconnectRequest, DisconnectResponse } from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { revokeConnectionConsent } from '../_lib/banking-consent.js';
import { withSentry } from '../_lib/sentry.js';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    const supabase = getServiceRoleSupabase();
    const body = req.body as DisconnectRequest | undefined;
    if (!body || typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
      return createErrorResponse(res, 400, 'connectionId is required', 'invalid_request');
    }

    // ── REVOKE AT THE PROVIDER FIRST, THEN FORGET IT HERE ───────────────
    //
    // The row delete below is what stops the connection recreating its
    // accounts on the next sync. It is NOT what stops TrueLayer holding an
    // authorisation for this person's bank — until now nothing did, so a
    // "disconnect" left the app having forgotten the bank and the bank still
    // holding a live consent.
    //
    // Order matters: the token lives in the row, so revoking after deleting is
    // impossible. Read, revoke, then delete.
    //
    // Best effort, deliberately. If TrueLayer refuses, the row STILL goes:
    // the user asked to disconnect, and a connection left standing is what
    // recreates the accounts. But the response says so, rather than reporting
    // a clean disconnection that did not happen.
    //
    // The revocation itself moved to `_lib/banking-consent.ts` when account
    // deletion turned out to need exactly the same act — this handler was the
    // only place that knew how to give a consent back, and "delete my account"
    // could not reach it.
    const { data: existing } = await supabase
      .from('bank_connections')
      .select('id, provider, access_token_encrypted')
      .eq('id', body.connectionId)
      .eq('user_id', auth.userId)
      .maybeSingle();

    const revokedAtProvider = existing ? await revokeConnectionConsent(existing) : false;

    const { data, error } = await supabase
      .from('bank_connections')
      .delete()
      .eq('id', body.connectionId)
      .eq('user_id', auth.userId)
      .select('id');

    if (error) {
      return createErrorResponse(res, 500, 'Failed to disconnect', 'internal_error', error);
    }

    if (!data || data.length === 0) {
      return createErrorResponse(res, 404, 'Connection not found', 'not_found');
    }

    const response: DisconnectResponse = { success: true, revokedAtProvider };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return createErrorResponse(res, 500, message, 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
