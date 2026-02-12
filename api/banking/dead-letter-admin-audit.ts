import { Buffer } from 'node:buffer';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  DeadLetterAdminAuditResponse,
  DeadLetterAdminAuditRow,
  ErrorResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { requireBankingOpsAdmin } from '../_lib/banking-ops.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

const supabase = getServiceRoleSupabase();
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

interface DeadLetterAuditDbRow {
  id: string;
  admin_user_id: string | null;
  admin_clerk_id: string;
  action: string;
  scope: string;
  reason: string | null;
  requested_count: number;
  reset_count: number;
  max_retry_attempts: number | null;
  connection_ids: string[] | null;
  metadata: Record<string, unknown> | null;
  status: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
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

const relationMissing = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { code?: unknown };
  return candidate.code === '42P01';
};

const parseLimit = (value: string | undefined): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
};

const parseCursor = (value: string | undefined): { createdAt: string; id: string } | null => {
  if (!value) {
    return null;
  }

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as { createdAt?: string; id?: string };
    if (!parsed.createdAt || !parsed.id) {
      return null;
    }
    return {
      createdAt: parsed.createdAt,
      id: parsed.id
    };
  } catch {
    return null;
  }
};

const encodeCursor = (createdAt: string, id: string): string =>
  Buffer.from(JSON.stringify({ createdAt, id }), 'utf8')
    .toString('base64')
    .replace(/=+$/g, '');

const isBeforeCursor = (row: DeadLetterAuditDbRow, cursor: { createdAt: string; id: string }): boolean => {
  if (row.created_at < cursor.createdAt) {
    return true;
  }
  if (row.created_at > cursor.createdAt) {
    return false;
  }
  return row.id < cursor.id;
};

const mapAuditRow = (row: DeadLetterAuditDbRow): DeadLetterAdminAuditRow => ({
  id: row.id,
  adminUserId: row.admin_user_id,
  adminClerkId: row.admin_clerk_id,
  action: row.action,
  scope: row.scope,
  reason: row.reason,
  requestedCount: row.requested_count,
  resetCount: row.reset_count,
  maxRetryAttempts: row.max_retry_attempts,
  connectionIds: row.connection_ids ?? [],
  metadata: row.metadata ?? {},
  status: row.status,
  error: row.error,
  createdAt: row.created_at,
  completedAt: row.completed_at
});

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
    requireBankingOpsAdmin(auth);

    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const scope = typeof req.query.scope === 'string' ? req.query.scope.trim() : '';
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const adminClerkId = typeof req.query.adminClerkId === 'string' ? req.query.adminClerkId.trim() : '';
    const since = typeof req.query.since === 'string' ? req.query.since.trim() : '';
    const until = typeof req.query.until === 'string' ? req.query.until.trim() : '';
    const limit = parseLimit(typeof req.query.limit === 'string' ? req.query.limit : undefined);
    const cursor = parseCursor(typeof req.query.cursor === 'string' ? req.query.cursor : undefined);

    let query = supabase
      .from('banking_dead_letter_admin_audit')
      .select(
        'id, admin_user_id, admin_clerk_id, action, scope, reason, requested_count, reset_count, max_retry_attempts, connection_ids, metadata, status, error, created_at, completed_at'
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(Math.min(1000, Math.max(200, limit * 4)));

    if (status) {
      query = query.eq('status', status);
    }
    if (scope) {
      query = query.eq('scope', scope);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (adminClerkId) {
      query = query.eq('admin_clerk_id', adminClerkId);
    }
    if (since) {
      query = query.gte('created_at', since);
    }
    if (until) {
      query = query.lte('created_at', until);
    }

    const { data, error } = await query;
    if (error) {
      if (relationMissing(error)) {
        const emptyResponse: DeadLetterAdminAuditResponse = {
          success: true,
          filters: {
            status: status || null,
            scope: scope || null,
            action: action || null,
            adminClerkId: adminClerkId || null,
            since: since || null,
            until: until || null,
            cursor: cursor ? encodeCursor(cursor.createdAt, cursor.id) : null,
            limit
          },
          count: 0,
          summary: {
            requestedTotal: 0,
            resetTotal: 0,
            pendingCount: 0,
            completedCount: 0,
            failedCount: 0
          },
          page: {
            limit,
            hasMore: false,
            nextCursor: null
          },
          rows: []
        };
        return res.status(200).json(emptyResponse);
      }
      return createErrorResponse(res, 500, 'Failed to load dead-letter audit rows', 'internal_error', error);
    }

    const allRows = ((data ?? []) as DeadLetterAuditDbRow[])
      .filter((row) => (cursor ? isBeforeCursor(row, cursor) : true));

    const pageRows = allRows.slice(0, limit);
    const hasMore = allRows.length > limit;
    const nextCursor = hasMore && pageRows.length > 0
      ? encodeCursor(pageRows[pageRows.length - 1]!.created_at, pageRows[pageRows.length - 1]!.id)
      : null;

    const summary = pageRows.reduce(
      (acc, row) => {
        acc.requestedTotal += row.requested_count;
        acc.resetTotal += row.reset_count;
        if (row.status === 'pending') {
          acc.pendingCount += 1;
        } else if (row.status === 'completed') {
          acc.completedCount += 1;
        } else if (row.status === 'failed') {
          acc.failedCount += 1;
        }
        return acc;
      },
      {
        requestedTotal: 0,
        resetTotal: 0,
        pendingCount: 0,
        completedCount: 0,
        failedCount: 0
      }
    );

    const response: DeadLetterAdminAuditResponse = {
      success: true,
      filters: {
        status: status || null,
        scope: scope || null,
        action: action || null,
        adminClerkId: adminClerkId || null,
        since: since || null,
        until: until || null,
        cursor: cursor ? encodeCursor(cursor.createdAt, cursor.id) : null,
        limit
      },
      count: pageRows.length,
      summary,
      page: {
        limit,
        hasMore,
        nextCursor
      },
      rows: pageRows.map(mapAuditRow)
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
