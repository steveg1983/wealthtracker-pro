import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  DeadLetterAdminListResponse,
  DeadLetterAdminResetRequest,
  DeadLetterAdminResetResponse,
  ErrorResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import {
  filterDeadLetterRows,
  getBankingSyncMaxRetryAttempts,
  requireBankingOpsAdmin
} from '../_lib/banking-ops.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

const supabase = getServiceRoleSupabase();
const RESET_ALL_CONFIRMATION = 'RESET_ALL_DEAD_LETTERED';
const DEFAULT_PREVIEW_LIMIT = 25;
const MAX_PREVIEW_LIMIT = 200;
const MAX_RESET_LIMIT = 500;

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

const parseBoundedLimit = (
  rawValue: string | number | undefined,
  fallback: number,
  max: number
): number => {
  const parsed = typeof rawValue === 'number'
    ? rawValue
    : Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.floor(parsed)));
};

const loadCandidateRows = async (limit: number) => {
  const { data, error } = await supabase
    .from('bank_connections')
    .select(
      'id, user_id, provider, status, institution_name, refresh_attempts, needs_reauth, error, updated_at, queue_attempts, queue_last_error, queue_next_retry_at'
    )
    .order('updated_at', { ascending: false })
    .limit(limit);

  return { data: data ?? [], error };
};

const applyResetUpdate = async (connectionIds: string[]) => {
  if (connectionIds.length === 0) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const withQueueColumns = await supabase
    .from('bank_connections')
    .update({
      status: 'connected',
      error: null,
      refresh_attempts: 0,
      needs_reauth: false,
      queue_attempts: 0,
      queue_last_error: null,
      queue_next_retry_at: null,
      updated_at: nowIso
    })
    .in('id', connectionIds);

  if (!withQueueColumns.error || (withQueueColumns.error as { code?: string }).code !== '42703') {
    return withQueueColumns.error;
  }

  const fallback = await supabase
    .from('bank_connections')
    .update({
      status: 'connected',
      error: null,
      refresh_attempts: 0,
      needs_reauth: false,
      updated_at: nowIso
    })
    .in('id', connectionIds);

  return fallback.error;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    requireBankingOpsAdmin(auth);

    const maxRetryAttempts = getBankingSyncMaxRetryAttempts();

    if (req.method === 'GET') {
      const limit = parseBoundedLimit(
        typeof req.query.limit === 'string' ? req.query.limit : undefined,
        DEFAULT_PREVIEW_LIMIT,
        MAX_PREVIEW_LIMIT
      );
      const candidateLoad = await loadCandidateRows(Math.max(limit * 3, limit));
      if (candidateLoad.error) {
        return createErrorResponse(res, 500, 'Failed to load dead-letter rows', 'internal_error', candidateLoad.error);
      }

      const filteredRows = filterDeadLetterRows(candidateLoad.data, maxRetryAttempts).slice(0, limit);
      const response: DeadLetterAdminListResponse = {
        success: true,
        maxRetryAttempts,
        count: filteredRows.length,
        rows: filteredRows
      };
      return res.status(200).json(response);
    }

    const body = (req.body ?? {}) as DeadLetterAdminResetRequest;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return createErrorResponse(res, 400, 'Reason is required', 'invalid_request');
    }

    const requestedConnectionIds = Array.isArray(body.connectionIds)
      ? Array.from(
        new Set(
          body.connectionIds
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean)
        )
      ).slice(0, MAX_PREVIEW_LIMIT)
      : [];

    const resetAllDeadLettered = body.resetAllDeadLettered === true;
    if (!resetAllDeadLettered && requestedConnectionIds.length === 0) {
      return createErrorResponse(
        res,
        400,
        'Provide connectionIds or set resetAllDeadLettered=true',
        'invalid_request'
      );
    }

    if (resetAllDeadLettered && body.confirm !== RESET_ALL_CONFIRMATION) {
      return createErrorResponse(res, 400, 'Confirmation token is required', 'invalid_confirmation');
    }

    const scope = resetAllDeadLettered
      ? 'all_dead_lettered'
      : requestedConnectionIds.length === 1
        ? 'single'
        : 'bulk';
    const resetLimit = parseBoundedLimit(body.limit, MAX_PREVIEW_LIMIT, MAX_RESET_LIMIT);

    let candidateRows: Array<{
      id: string;
      user_id: string | null;
      provider: string | null;
      status: string | null;
      institution_name: string | null;
      refresh_attempts?: number | null;
      needs_reauth?: boolean | null;
      error?: string | null;
      updated_at?: string | null;
      queue_attempts?: number | null;
      queue_last_error?: string | null;
      queue_next_retry_at?: string | null;
    }> = [];

    if (resetAllDeadLettered) {
      const candidateLoad = await loadCandidateRows(Math.max(resetLimit * 3, resetLimit));
      if (candidateLoad.error) {
        return createErrorResponse(res, 500, 'Failed to load dead-letter rows', 'internal_error', candidateLoad.error);
      }
      candidateRows = candidateLoad.data;
    } else {
      const selectedLoad = await supabase
        .from('bank_connections')
        .select(
          'id, user_id, provider, status, institution_name, refresh_attempts, needs_reauth, error, updated_at, queue_attempts, queue_last_error, queue_next_retry_at'
        )
        .in('id', requestedConnectionIds);
      if (selectedLoad.error) {
        return createErrorResponse(res, 500, 'Failed to load requested rows', 'internal_error', selectedLoad.error);
      }
      candidateRows = selectedLoad.data ?? [];
    }

    const deadLetterRows = filterDeadLetterRows(candidateRows, maxRetryAttempts);
    const resetConnectionIds = deadLetterRows
      .slice(0, resetLimit)
      .map((row) => row.connectionId);

    const nowIso = new Date().toISOString();
    const auditInsert = await supabase
      .from('banking_dead_letter_admin_audit')
      .insert({
        admin_user_id: auth.userId,
        admin_clerk_id: auth.clerkUserId,
        action: 'reset_dead_letter',
        scope,
        reason,
        requested_count: resetConnectionIds.length,
        reset_count: 0,
        max_retry_attempts: maxRetryAttempts,
        connection_ids: resetConnectionIds,
        metadata: {
          resetAllDeadLettered,
          requestConnectionIds: requestedConnectionIds,
          requestedLimit: resetLimit,
          confirmationProvided: typeof body.confirm === 'string' && body.confirm.trim().length > 0
        },
        status: 'pending',
        created_at: nowIso
      })
      .select('id')
      .single();

    if (auditInsert.error) {
      if (relationMissing(auditInsert.error)) {
        return createErrorResponse(
          res,
          500,
          'banking_dead_letter_admin_audit table is missing. Apply pending banking ops migration.',
          'schema_mismatch'
        );
      }
      return createErrorResponse(res, 500, 'Failed to create admin audit row', 'internal_error', auditInsert.error);
    }

    const auditId = auditInsert.data.id;
    const updateError = await applyResetUpdate(resetConnectionIds);
    if (updateError) {
      await supabase
        .from('banking_dead_letter_admin_audit')
        .update({
          status: 'failed',
          error: updateError.message ?? 'Failed to update connections',
          completed_at: new Date().toISOString()
        })
        .eq('id', auditId);
      return createErrorResponse(res, 500, 'Failed to reset dead-letter rows', 'internal_error', updateError);
    }

    await supabase
      .from('banking_dead_letter_admin_audit')
      .update({
        reset_count: resetConnectionIds.length,
        status: 'completed',
        error: null,
        completed_at: new Date().toISOString()
      })
      .eq('id', auditId);

    const response: DeadLetterAdminResetResponse = {
      success: true,
      maxRetryAttempts,
      requested: resetConnectionIds.length,
      resetConnectionIds,
      auditId,
      auditStatus: 'completed'
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
