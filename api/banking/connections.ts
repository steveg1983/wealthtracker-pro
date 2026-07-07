import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ConnectionsResponse } from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { withSentry } from '../_lib/sentry.js';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    const supabase = getServiceRoleSupabase();
    const { data, error } = await supabase
      .from('bank_connections')
      .select('id, provider, institution_id, institution_name, institution_logo, status, last_sync, expires_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return createErrorResponse(res, 500, 'Failed to load connections', 'internal_error', error);
    }

    const connectionIds = (data ?? []).map((connection) => connection.id);
    // Collect the WealthTracker account ids each connection is linked to, so the
    // client can map an account → its connection (for a per-account "last synced"
    // label and sync button on the Accounts page).
    const linkedAccountIdsByConnection = new Map<string, string[]>();
    if (connectionIds.length > 0) {
      const linkedResult = await supabase
        .from('linked_accounts')
        .select('connection_id, account_id')
        .in('connection_id', connectionIds);

      if (linkedResult.error) {
        // Non-fatal: still return the connections list, but log so the "every
        // account shows 0 links / no sync button" degradation is diagnosable.
        console.error('[connections] failed to load linked_accounts', {
          message: linkedResult.error.message
        });
      } else {
        (linkedResult.data ?? []).forEach((row) => {
          const list = linkedAccountIdsByConnection.get(row.connection_id) ?? [];
          if (row.account_id) {
            list.push(row.account_id as string);
          }
          linkedAccountIdsByConnection.set(row.connection_id, list);
        });
      }
    }

    const response: ConnectionsResponse = (data ?? []).map((connection) => {
      const linkedAccountIds = linkedAccountIdsByConnection.get(connection.id) ?? [];
      return {
        id: connection.id,
        provider: connection.provider,
        institutionId: connection.institution_id,
        institutionName: connection.institution_name,
        institutionLogo: connection.institution_logo ?? undefined,
        status: connection.status as ConnectionsResponse[number]['status'],
        lastSync: connection.last_sync ?? undefined,
        accountsCount: linkedAccountIds.length,
        linkedAccountIds,
        expiresAt: connection.expires_at ?? undefined
      };
    });

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
