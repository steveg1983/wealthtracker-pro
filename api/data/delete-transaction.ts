import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
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
    const supabase = getServiceRoleSupabase();
    const body = (req.body ?? {}) as DeleteTransactionRequest;
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    if (!transactionId) {
      return createErrorResponse(res, 400, 'transactionId is required', 'invalid_request');
    }

    const transactionResult = await supabase
      .from('transactions')
      .select('id, account_id, amount')
      .eq('id', transactionId)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (transactionResult.error) {
      return createErrorResponse(
        res,
        500,
        'Failed to load transaction',
        'internal_error',
        transactionResult.error
      );
    }

    const transaction = transactionResult.data;
    if (!transaction) {
      return createErrorResponse(res, 404, 'Transaction not found', 'not_found');
    }

    const deleteResult = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', auth.userId)
      .select('id');

    if (deleteResult.error) {
      return createErrorResponse(
        res,
        500,
        'Failed to delete transaction',
        'internal_error',
        deleteResult.error
      );
    }

    if (!deleteResult.data || deleteResult.data.length === 0) {
      return createErrorResponse(res, 404, 'Transaction not found', 'not_found');
    }

    if (transaction.account_id && typeof transaction.amount === 'number' && Number.isFinite(transaction.amount)) {
      const accountResult = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', transaction.account_id)
        .eq('user_id', auth.userId)
        .maybeSingle();

      if (accountResult.error) {
        return createErrorResponse(
          res,
          500,
          'Transaction deleted but failed to load account balance',
          'partial_failure',
          accountResult.error
        );
      }

      if (accountResult.data) {
        const currentBalance = typeof accountResult.data.balance === 'number' ? accountResult.data.balance : 0;
        const updateResult = await supabase
          .from('accounts')
          .update({ balance: currentBalance - transaction.amount })
          .eq('id', transaction.account_id)
          .eq('user_id', auth.userId);

        if (updateResult.error) {
          return createErrorResponse(
            res,
            500,
            'Transaction deleted but failed to update account balance',
            'partial_failure',
            updateResult.error
          );
        }
      }
    }

    const response: DeleteTransactionResponse = { success: true };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return createErrorResponse(res, 500, message, 'internal_error');
  }
}
