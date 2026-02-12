import { Buffer } from 'node:buffer';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ErrorResponse } from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { requireBankingOpsAdmin } from '../_lib/banking-ops.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

const supabase = getServiceRoleSupabase();
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

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

const isBeforeCursor = (row: DeadLetterAuditDbRow, cursor: { createdAt: string; id: string }): boolean => {
  if (row.created_at < cursor.createdAt) {
    return true;
  }
  if (row.created_at > cursor.createdAt) {
    return false;
  }
  return row.id < cursor.id;
};

const escapeCsv = (value: string): string => {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
};

const toCsv = (rows: DeadLetterAuditDbRow[]): string => {
  const header = [
    'id',
    'admin_user_id',
    'admin_clerk_id',
    'action',
    'scope',
    'reason',
    'requested_count',
    'reset_count',
    'max_retry_attempts',
    'connection_ids',
    'status',
    'error',
    'created_at',
    'completed_at',
    'metadata_json'
  ];

  const lines = [header.join(',')];
  rows.forEach((row) => {
    const values = [
      row.id,
      row.admin_user_id ?? '',
      row.admin_clerk_id,
      row.action,
      row.scope,
      row.reason ?? '',
      String(row.requested_count),
      String(row.reset_count),
      row.max_retry_attempts === null ? '' : String(row.max_retry_attempts),
      (row.connection_ids ?? []).join('|'),
      row.status,
      row.error ?? '',
      row.created_at,
      row.completed_at ?? '',
      JSON.stringify(row.metadata ?? {})
    ];
    lines.push(values.map((value) => escapeCsv(value)).join(','));
  });
  return lines.join('\n');
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
      .limit(limit);

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
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send('id,admin_user_id,admin_clerk_id,action,scope,reason,requested_count,reset_count,max_retry_attempts,connection_ids,status,error,created_at,completed_at,metadata_json\n');
      }
      return createErrorResponse(res, 500, 'Failed to load dead-letter audit rows', 'internal_error', error);
    }

    const rows = ((data ?? []) as DeadLetterAuditDbRow[])
      .filter((row) => (cursor ? isBeforeCursor(row, cursor) : true));

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(`${csv}\n`);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return createErrorResponse(res, 500, message, 'internal_error');
  }
}
