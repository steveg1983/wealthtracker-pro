/**
 * `GET /api/assistant/status` — is Ask switched on for the signed-in person,
 * and how much of this month's allowance is left?
 *
 *   200 { allowed, reason, used, limit, configured }
 *
 * The app draws the Ask button only when `allowed` is true, or when the
 * allowance is used up (so it can say so). `configured` is false while the
 * server holds no ANTHROPIC_API_KEY, in which case nobody is allowed: a
 * button that could only fail is not drawn. See _lib/assistant/access.ts for
 * who is switched on and why.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AccessLookupError, readAssistantAccess } from '../_lib/assistant/access.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getOptionalEnv } from '../_lib/env.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { withSentry } from '../_lib/sentry.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  if (await applyRateLimit(req, res, { name: 'assistant-status', limit: 60, windowMs: 60_000 })) {
    return;
  }

  try {
    const auth = await requireAuth(req);
    const configured = (getOptionalEnv('ANTHROPIC_API_KEY') ?? '') !== '';
    const access = await readAssistantAccess(getServiceRoleSupabase(), auth.userId, new Date());
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      allowed: configured && access.allowed,
      reason: access.reason,
      used: access.used,
      limit: access.limit,
      configured,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    if (error instanceof AccessLookupError) {
      return createErrorResponse(res, 500, 'Could not check whether Ask is on', 'internal_error', error.message);
    }
    throw error;
  }
}

export default withSentry(handler);
