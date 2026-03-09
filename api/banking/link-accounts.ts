import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  ErrorResponse,
  LinkAccountsRequest,
  LinkAccountsResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getUserTrueLayerConnection } from '../_lib/banking-sync.js';

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
    const body = req.body as LinkAccountsRequest | undefined;

    if (!body || typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
      return createErrorResponse(res, 400, 'connectionId is required', 'invalid_request');
    }
    if (!Array.isArray(body.links) || body.links.length === 0) {
      return createErrorResponse(res, 400, 'links array is required and must not be empty', 'invalid_request');
    }

    const connectionId = body.connectionId.trim();
    const connection = await getUserTrueLayerConnection(supabase, auth.userId, connectionId);
    if (!connection) {
      return createErrorResponse(res, 404, 'Connection not found', 'not_found');
    }

    // Validate all accountIds belong to this user
    const accountIds = body.links.map((l) => l.accountId);
    const { data: userAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', auth.userId)
      .in('id', accountIds);

    if (accountsError) {
      return createErrorResponse(res, 500, `Failed to validate accounts: ${accountsError.message}`, 'internal_error');
    }

    const validAccountIds = new Set((userAccounts ?? []).map((a: { id: string }) => a.id));
    const invalidIds = accountIds.filter((id) => !validAccountIds.has(id));
    if (invalidIds.length > 0) {
      return createErrorResponse(res, 400, `Invalid account IDs: ${invalidIds.join(', ')}`, 'invalid_account_ids');
    }

    // Create linked_accounts entries and update bank_balance
    const nowIso = new Date().toISOString();
    let linked = 0;

    for (const link of body.links) {
      // Upsert linked_accounts entry
      const { error: upsertError } = await supabase
        .from('linked_accounts')
        .upsert(
          {
            connection_id: connectionId,
            account_id: link.accountId,
            external_account_id: link.externalAccountId,
            external_account_name: link.externalAccountName,
            external_account_mask: link.externalAccountMask ?? null
          },
          { onConflict: 'connection_id,external_account_id' }
        );

      if (upsertError) {
        return createErrorResponse(res, 500, `Failed to link account: ${upsertError.message}`, 'internal_error');
      }

      // Update bank_balance on the WealthTracker account
      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          bank_balance: link.balance,
          balance: link.balance,
          updated_at: nowIso
        })
        .eq('id', link.accountId)
        .eq('user_id', auth.userId);

      if (updateError) {
        return createErrorResponse(res, 500, `Failed to update account balance: ${updateError.message}`, 'internal_error');
      }

      linked++;
    }

    const response: LinkAccountsResponse = {
      success: true,
      linked
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
