import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import type {
  CreateLinkTokenResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { createStateToken } from '../_lib/state.js';
import { buildAuthUrl, getRedirectUri, isSandboxEnvironment, providerForInstitution } from '../_lib/truelayer.js';
import { withSentry } from '../_lib/sentry.js';

// 'cards' unlocks credit-card providers (American Express etc.) in the auth
// dialog and the /data/v1/cards endpoints. Existing connections keep their
// old scopes until re-linked.
const AUTH_SCOPES = ['info', 'accounts', 'balance', 'cards', 'transactions', 'offline_access'];

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (await applyRateLimit(req, res, { name: 'link-token', limit: 10, windowMs: 60_000 })) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);

    const state = createStateToken(auth.userId);
    const nonce = randomBytes(12).toString('hex');
    // The client has always sent which bank was clicked; honouring it is what
    // makes the shortcut list an actual shortcut. Only ids in our own map
    // reach the URL — arbitrary input never does.
    const institutionId =
      typeof (req.body as { institutionId?: unknown })?.institutionId === 'string'
        ? (req.body as { institutionId: string }).institutionId
        : undefined;
    const authUrl = buildAuthUrl({
      providerId: providerForInstitution(institutionId),
      redirectUri: getRedirectUri(),
      scope: AUTH_SCOPES,
      nonce,
      state,
      enableOpenBanking: true,
      enableOauth: true,
      enableMock: isSandboxEnvironment()
    });

    const response: CreateLinkTokenResponse = {
      authUrl,
      state
    };

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
