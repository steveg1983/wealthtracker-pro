import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import type {
  CreateLinkTokenResponse,
  ErrorResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { createStateToken } from '../_lib/state.js';
import { buildAuthUrl, getRedirectUri, isSandboxEnvironment } from '../_lib/truelayer.js';

const AUTH_SCOPES = ['info', 'accounts', 'balance', 'transactions', 'offline_access'];

const createErrorResponse = (
  res: VercelResponse,
  status: number,
  error: string,
  code: string,
  details?: unknown
) => {
  res.status(status).json({
    error,
    code,
    details
  } satisfies ErrorResponse);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (applyRateLimit(req, res, { name: 'link-token', limit: 10, windowMs: 60_000 })) {
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
    const authUrl = buildAuthUrl({
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
