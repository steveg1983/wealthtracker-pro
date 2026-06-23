import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  LinkAccountsRequest,
  LinkAccountsResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { getUserTrueLayerConnection } from '../_lib/banking-sync.js';

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

    // Create linked_accounts entries and snap balances to the bank's figures
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

      // Persist the provider-stable bank identifiers on the account (when the
      // client supplied them) so a future disconnect→reconnect can re-adopt
      // this account instead of creating a duplicate (see sync-accounts
      // findAdoptableAccountId). Link time is the primary account-binding path,
      // so without this the re-adoption key would be missing for manually
      // linked accounts.
      const identifierFields: Record<string, string> = {};
      if (link.sortCode) identifierFields.sort_code = link.sortCode;
      if (link.accountNumber) identifierFields.account_number = link.accountNumber;
      if (Object.keys(identifierFields).length > 0) {
        const { error: idError } = await supabase
          .from('accounts')
          .update(identifierFields)
          .eq('id', link.accountId)
          .eq('user_id', auth.userId);
        if (idError) {
          console.error('[link-accounts] failed to store bank identifiers', {
            code: idError.code,
            message: idError.message
          });
          return createErrorResponse(res, 500, 'Failed to store account identifiers', 'internal_error');
        }
      }

      // Snap the account to the bank's reported balance via the audited RPC:
      // it shifts initial_balance by the same delta as balance, so the ledger
      // invariant (balance = initial_balance + Σtxns) holds through the snap
      // and the change lands in financial_audit_log. A raw `balance := bank`
      // overwrite here was audit finding #12.
      const snapResult = await supabase.rpc('link_bank_account_snap', {
        p_account_id: link.accountId,
        p_user_id: auth.userId,
        p_bank_balance: link.balance
      });

      if (snapResult.error) {
        console.error('[link-accounts] balance snap failed', {
          code: snapResult.error.code,
          message: snapResult.error.message
        });
        return createErrorResponse(res, 500, 'Failed to update account balance', 'internal_error');
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
