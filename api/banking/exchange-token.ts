import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  ErrorResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { encryptSecret } from '../_lib/encryption.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { decodeStateToken } from '../_lib/state.js';
import { exchangeCodeForToken, fetchAccounts } from '../_lib/truelayer.js';

interface ProviderMetadata {
  id: string;
  name: string;
  logo?: string;
}

const supabase = getServiceRoleSupabase();

const createErrorResponse = (
  res: VercelResponse,
  status: number,
  error: string,
  code: string,
  details?: unknown
) => {
  const payload: ErrorResponse = { error, code };
  if (details) {
    payload.details = details;
  }
  return res.status(status).json(payload);
};

const getProviderFromAccounts = (
  accounts: Array<{
    provider?: {
      provider_id: string;
      display_name: string;
      logo_uri?: string;
    };
  }>
): ProviderMetadata => {
  const provider = accounts[0]?.provider;
  if (provider) {
    return {
      id: provider.provider_id,
      name: provider.display_name,
      logo: provider.logo_uri
    };
  }
  return {
    id: `truelayer-${Date.now()}`,
    name: 'Unknown institution'
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    const body = req.body as ExchangeTokenRequest | undefined;
    if (!body || typeof body.code !== 'string' || typeof body.state !== 'string') {
      return createErrorResponse(res, 400, 'code and state are required', 'invalid_request');
    }

    const statePayload = decodeStateToken(body.state);
    if (!statePayload) {
      return createErrorResponse(res, 400, 'Invalid or expired state token', 'invalid_state');
    }

    if (statePayload.userId !== auth.userId) {
      return createErrorResponse(res, 403, 'State token does not match user', 'invalid_state');
    }

    const userId = auth.userId;
    const { access_token: accessToken, refresh_token: refreshToken } = await exchangeCodeForToken(body.code);

    const encryptedAccess = encryptSecret(accessToken);
    const encryptedRefresh = refreshToken ? encryptSecret(refreshToken) : null;

    let accountsCount = 0;
    let providerMetadata: ProviderMetadata = {
      id: `truelayer-${statePayload.nonce}`,
      name: 'Unknown institution'
    };

    try {
      const accounts = await fetchAccounts(accessToken);
      accountsCount = accounts.length;
      if (accounts.length > 0) {
        providerMetadata = getProviderFromAccounts(accounts);
      }
    } catch (accountError) {
      console.warn('Failed to fetch account details from TrueLayer', accountError);
    }

    const nowIso = new Date().toISOString();
    const connectionPayload = {
      user_id: userId,
      provider: 'truelayer',
      institution_id: providerMetadata.id,
      institution_name: providerMetadata.name,
      institution_logo: providerMetadata.logo ?? null,
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      status: 'connected',
      last_sync: null,
      expires_at: null,
      error: null,
      created_at: nowIso,
      updated_at: nowIso,
      item_id: null,
      token_last_refreshed: nowIso,
      refresh_attempts: 0,
      needs_reauth: false
    };

    let connectionId: string | null = null;

    const insertResult = await supabase
      .from('bank_connections')
      .insert(connectionPayload)
      .select('id')
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === '23505') {
        const updatePayload = {
          access_token_encrypted: encryptedAccess,
          refresh_token_encrypted: encryptedRefresh,
          institution_name: providerMetadata.name,
          institution_logo: providerMetadata.logo ?? null,
          status: 'connected',
          error: null,
          updated_at: nowIso,
          token_last_refreshed: nowIso,
          refresh_attempts: 0,
          needs_reauth: false
        };
        const updateResult = await supabase
          .from('bank_connections')
          .update(updatePayload)
          .eq('user_id', userId)
          .eq('institution_id', providerMetadata.id)
          .eq('provider', 'truelayer')
          .select('id')
          .single();
        if (updateResult.error || !updateResult.data) {
          return createErrorResponse(res, 500, 'Failed to update existing connection', 'internal_error', updateResult.error);
        }
        connectionId = updateResult.data.id;
      } else {
        return createErrorResponse(res, 500, 'Failed to store connection', 'internal_error', insertResult.error);
      }
    } else {
      connectionId = insertResult.data?.id ?? null;
    }

    if (!connectionId) {
      return createErrorResponse(res, 500, 'Unable to determine connection ID', 'internal_error');
    }

    const response: ExchangeTokenResponse = {
      success: true,
      connectionId,
      institutionId: providerMetadata.id,
      institutionName: providerMetadata.name,
      institutionLogo: providerMetadata.logo,
      accountsCount
    };

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    console.error('exchange-token error', error);
    return createErrorResponse(res, 500, 'Unexpected error', 'internal_error');
  }
}
