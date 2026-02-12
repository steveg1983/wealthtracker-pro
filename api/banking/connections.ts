import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ConnectionsResponse, ErrorResponse } from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

const supabase = getServiceRoleSupabase();

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

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    const { data, error } = await supabase
      .from('bank_connections')
      .select('id, provider, institution_id, institution_name, institution_logo, status, last_sync, expires_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return createErrorResponse(res, 500, 'Failed to load connections', 'internal_error', error);
    }

    const connectionIds = (data ?? []).map((connection) => connection.id);
    const linkedAccountCountByConnection = new Map<string, number>();
    if (connectionIds.length > 0) {
      const linkedResult = await supabase
        .from('linked_accounts')
        .select('connection_id')
        .in('connection_id', connectionIds);

      if (!linkedResult.error) {
        (linkedResult.data ?? []).forEach((row) => {
          const current = linkedAccountCountByConnection.get(row.connection_id) ?? 0;
          linkedAccountCountByConnection.set(row.connection_id, current + 1);
        });
      }
    }

    const response: ConnectionsResponse = (data ?? []).map((connection) => ({
      id: connection.id,
      provider: connection.provider,
      institutionId: connection.institution_id,
      institutionName: connection.institution_name,
      institutionLogo: connection.institution_logo ?? undefined,
      status: connection.status as ConnectionsResponse[number]['status'],
      lastSync: connection.last_sync ?? undefined,
      accountsCount: linkedAccountCountByConnection.get(connection.id) ?? 0,
      expiresAt: connection.expires_at ?? undefined
    }));

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return createErrorResponse(res, 500, message, 'internal_error');
  }
}
