import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  ErrorResponse,
  SyncAccountsRequest,
  SyncAccountsResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { setCorsHeaders } from '../_lib/cors.js';
import {
  getUserTrueLayerConnection,
  markConnectionSyncFailure,
  markConnectionSyncSuccess,
  withTrueLayerAccessToken
} from '../_lib/banking-sync.js';
import { fetchAccountBalance, fetchAccounts } from '../_lib/truelayer.js';

const supabase = getServiceRoleSupabase();

const createErrorResponse = (
  res: VercelResponse,
  status: number,
  error: string,
  code: string,
  details?: unknown
) => {
  const payload: ErrorResponse = { error, code };
  if (details !== undefined) {
    payload.details = details;
  }
  return res.status(status).json(payload);
};

const inferMask = (account: {
  account_number?: {
    number?: string;
    iban?: string;
  };
}): string | undefined => {
  const accountNumber = account.account_number?.number?.replace(/\s+/g, '');
  if (accountNumber && accountNumber.length >= 4) {
    return accountNumber.slice(-4);
  }

  const iban = account.account_number?.iban?.replace(/\s+/g, '');
  if (iban && iban.length >= 4) {
    return iban.slice(-4);
  }

  return undefined;
};

const mapAccountType = (accountType: string | undefined): string => {
  const normalized = (accountType ?? '').toLowerCase();
  switch (normalized) {
    case 'transaction':
      return 'checking';
    case 'savings':
      return 'savings';
    case 'credit_card':
      return 'credit';
    default:
      return normalized || 'checking';
  }
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
    const body = req.body as SyncAccountsRequest | undefined;
    if (!body || typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
      return createErrorResponse(res, 400, 'connectionId is required', 'invalid_request');
    }

    const connectionId = body.connectionId.trim();
    const connection = await getUserTrueLayerConnection(supabase, auth.userId, connectionId);
    if (!connection) {
      return createErrorResponse(res, 404, 'Connection not found', 'not_found');
    }

    const accounts = await withTrueLayerAccessToken(supabase, connection, async (accessToken) => {
      const truelayerAccounts = await fetchAccounts(accessToken);

      return Promise.all(
        truelayerAccounts.map(async (account) => {
          let balance = 0;
          try {
            const fetchedBalance = await fetchAccountBalance(accessToken, account.account_id);
            if (typeof fetchedBalance === 'number' && Number.isFinite(fetchedBalance)) {
              balance = fetchedBalance;
            }
          } catch {
            // Balance endpoint failures should not block account discovery.
          }

          return {
            id: account.account_id,
            name: account.display_name?.trim() || connection.institution_name,
            type: mapAccountType(account.account_type),
            balance,
            currency: account.currency || 'GBP',
            mask: inferMask(account)
          };
        })
      );
    });

    await markConnectionSyncSuccess(supabase, connection.id);
    await supabase.from('sync_history').insert({
      connection_id: connection.id,
      sync_type: 'accounts',
      status: 'success',
      records_synced: accounts.length,
      created_at: new Date().toISOString()
    });

    const response: SyncAccountsResponse = {
      success: true,
      accountsSynced: accounts.length,
      accounts
    };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    const body = req.body as SyncAccountsRequest | undefined;
    if (body?.connectionId) {
      await markConnectionSyncFailure(supabase, body.connectionId, message);
      await supabase.from('sync_history').insert({
        connection_id: body.connectionId,
        sync_type: 'accounts',
        status: 'failed',
        records_synced: 0,
        error: message.slice(0, 2000),
        created_at: new Date().toISOString()
      });
    }

    return createErrorResponse(res, 500, message, 'internal_error');
  }
}
