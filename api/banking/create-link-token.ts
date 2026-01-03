import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import type { BankingAPI } from '../../src/types/banking-api.js';
import { createStateToken } from '../_lib/state.js';
import { getAuthClient, getRedirectUri, isSandboxEnvironment } from '../_lib/truelayer.js';

const AUTH_SCOPES = ['info', 'accounts', 'balance', 'transactions', 'offline_access'];

const parseRequestBody = (req: VercelRequest): unknown => {
  if (req.body) {
    return req.body;
  }

  if (req.rawBody) {
    try {
      return JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      throw new Error('Invalid JSON body');
    }
  }

  return undefined;
};

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
  } satisfies BankingAPI.ErrorResponse);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const body = parseRequestBody(req) as BankingAPI.CreateLinkTokenRequest | undefined;
    if (!body || typeof body.userId !== 'string' || !body.userId.trim()) {
      return createErrorResponse(res, 400, 'userId is required', 'invalid_request');
    }

    const state = createStateToken(body.userId.trim());
    const nonce = randomBytes(12).toString('hex');
    const client = getAuthClient();
    const authUrl = client.getAuthUrl({
      redirectURI: getRedirectUri(),
      scope: AUTH_SCOPES,
      nonce,
      state,
      enableOpenBanking: true,
      enableOauth: true,
      enableMock: isSandboxEnvironment()
    });

    const response: BankingAPI.CreateLinkTokenResponse = {
      authUrl,
      state
    };

    return res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return createErrorResponse(res, 500, message, 'internal_error');
  }
}
