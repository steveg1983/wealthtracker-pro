import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { withSentry } from '../_lib/sentry.js';

// One request = one atomic RPC = one DB transaction. The client chunks large
// imports into requests of this size; keep it well under Vercel's body limit.
const MAX_ROWS = 2000;
const ALLOWED_TYPES = new Set(['income', 'expense', 'transfer']);

interface ErrorResponse {
  error: string;
  code: string;
}

interface ImportRow {
  date?: unknown;
  description?: unknown;
  amount?: unknown;
  type?: unknown;
  category?: unknown;
  notes?: unknown;
  tags?: unknown;
  is_cleared?: unknown;
  is_recurring?: unknown;
}

interface ImportTransactionsRequest {
  accountId?: unknown;
  transactions?: unknown;
}

interface ImportTransactionsResponse {
  inserted: number;
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

// Validate + normalise one row into the shape the RPC expects. Returns a string
// error message on the first problem, so a bad file is rejected with a clear
// 400 rather than surfacing as a raw database cast error.
const normaliseRow = (row: ImportRow, index: number): { row: Record<string, unknown> } | { error: string } => {
  const date = typeof row.date === 'string' ? row.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: `Row ${index}: date must be an ISO YYYY-MM-DD string` };
  }
  const description = typeof row.description === 'string' ? row.description.trim() : '';
  if (!description) {
    return { error: `Row ${index}: description is required` };
  }
  const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
  if (!Number.isFinite(amount)) {
    return { error: `Row ${index}: amount must be a finite number` };
  }
  const type = typeof row.type === 'string' ? row.type : '';
  if (!ALLOWED_TYPES.has(type)) {
    return { error: `Row ${index}: type must be income, expense or transfer` };
  }
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === 'string')
    : undefined;

  return {
    row: {
      date,
      description,
      amount,
      type,
      category: typeof row.category === 'string' ? row.category : '',
      notes: typeof row.notes === 'string' ? row.notes : '',
      ...(tags && tags.length > 0 ? { tags } : {}),
      is_cleared: row.is_cleared === true,
      is_recurring: row.is_recurring === true
    }
  };
};

async function handler(req: VercelRequest, res: VercelResponse) {
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
    const body = (req.body ?? {}) as ImportTransactionsRequest;

    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
    if (!accountId) {
      return createErrorResponse(res, 400, 'accountId is required', 'invalid_request');
    }

    if (!Array.isArray(body.transactions)) {
      return createErrorResponse(res, 400, 'transactions must be an array', 'invalid_request');
    }
    if (body.transactions.length === 0) {
      return createErrorResponse(res, 400, 'transactions must not be empty', 'invalid_request');
    }
    if (body.transactions.length > MAX_ROWS) {
      return createErrorResponse(res, 413, `Too many rows in one request (max ${MAX_ROWS})`, 'too_many_rows');
    }

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < body.transactions.length; i += 1) {
      const result = normaliseRow(body.transactions[i] as ImportRow, i);
      if ('error' in result) {
        return createErrorResponse(res, 400, result.error, 'invalid_row');
      }
      rows.push(result.row);
    }

    // Atomic bulk insert scoped to the Clerk-verified user. account ownership is
    // re-checked inside the RPC (the service role bypasses RLS).
    const { data, error } = await supabase.rpc('import_transactions_atomic', {
      p_user_id: auth.userId,
      p_account_id: accountId,
      p_rows: rows
    });

    if (error) {
      if (error.message?.includes('account_not_found_or_not_owned')) {
        return createErrorResponse(res, 404, 'Account not found', 'not_found');
      }
      // Log internals server-side; never leak raw database errors to clients.
      console.error('[import-transactions] RPC failed', {
        code: error.code,
        message: error.message
      });
      return createErrorResponse(res, 500, 'Failed to import transactions', 'internal_error');
    }

    const inserted = typeof (data as { inserted?: unknown })?.inserted === 'number'
      ? (data as { inserted: number }).inserted
      : rows.length;
    const response: ImportTransactionsResponse = { inserted };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    console.error('[import-transactions] Unexpected error', error);
    return createErrorResponse(res, 500, 'Unexpected error', 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
