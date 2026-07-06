import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DisconnectRequest, DisconnectResponse } from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
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

    const response: DisconnectResponse = { success: true };
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
