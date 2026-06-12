import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

interface ErrorResponse {
  error: string;
  code: string;
}

interface DeleteTransactionRequest {
  transactionId?: string;
}

interface DeleteTransactionResponse {
  success: true;
}

const createErrorResponse = (
  res: VercelResponse,
  status: number,
  error: string,
  code: string
) => {
  const payload: ErrorResponse = { error, code };
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
    const supabase = getServiceRoleSupabase();
    const body = (req.body ?? {}) as DeleteTransactionRequest;
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    if (!transactionId) {
      return createErrorResponse(res, 400, 'transactionId is required', 'invalid_request');
    }

    // Atomic RPC: deletes the transaction AND reverses the account balance in
    // a single database transaction — no partial-failure states, SQL numeric
    // math only. p_user_id scopes the delete to the Clerk-verified user
    // (required because the service role bypasses RLS).
    const { error } = await supabase.rpc('delete_transaction_atomic', {
      p_id: transactionId,
      p_user_id: auth.userId
    });

    if (error) {
      if (error.message?.includes('transaction_not_found')) {
        return createErrorResponse(res, 404, 'Transaction not found', 'not_found');
      }
      // Log internals server-side; never leak raw database errors to clients.
      console.error('[delete-transaction] RPC failed', {
        code: error.code,
        message: error.message
      });
      return createErrorResponse(res, 500, 'Failed to delete transaction', 'internal_error');
    }

    const response: DeleteTransactionResponse = { success: true };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    console.error('[delete-transaction] Unexpected error', error);
    return createErrorResponse(res, 500, 'Unexpected error', 'internal_error');
  }
}
