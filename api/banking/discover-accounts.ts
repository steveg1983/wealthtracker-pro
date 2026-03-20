import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  DiscoverAccountsRequest,
  DiscoverAccountsResponse,
  DiscoveredBankAccount,
  ErrorResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { setCorsHeaders } from '../_lib/cors.js';
import {
  getUserTrueLayerConnection,
  withTrueLayerAccessToken
} from '../_lib/banking-sync.js';
import { fetchAccountBalance, fetchAccounts } from '../_lib/truelayer.js';

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
      return 'checking';
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
    const supabase = getServiceRoleSupabase();
    const body = req.body as DiscoverAccountsRequest | undefined;
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
        truelayerAccounts.map(async (account): Promise<DiscoveredBankAccount> => {
          let balance = 0;
          try {
            const fetchedBalance = await fetchAccountBalance(accessToken, account.account_id);
            if (typeof fetchedBalance === 'number' && Number.isFinite(fetchedBalance)) {
              balance = fetchedBalance;
            }
          } catch {
            // Balance endpoint failures should not block account discovery.
          }

          const accountNumber = account.account_number?.number?.replace(/\s+/g, '');
          const iban = account.account_number?.iban?.replace(/\s+/g, '');
          const mask = accountNumber && accountNumber.length >= 4
            ? accountNumber.slice(-4)
            : iban && iban.length >= 4
              ? iban.slice(-4)
              : undefined;

          return {
            externalAccountId: account.account_id,
            name: account.display_name?.trim() || connection.institution_name,
            type: mapAccountType(account.account_type),
            balance,
            currency: account.currency || 'GBP',
            sortCode: account.account_number?.sort_code ?? undefined,
            accountNumber: accountNumber ?? undefined,
            mask
          };
        })
      );
    });

    const response: DiscoverAccountsResponse = {
      success: true,
      accounts
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
