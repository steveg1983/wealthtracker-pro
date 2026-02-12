import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  ErrorResponse,
  OpsAlertTestRequest,
  OpsAlertTestResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { requireBankingOpsAdmin } from '../_lib/banking-ops.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

const supabase = getServiceRoleSupabase();
const TEST_EVENT_TYPE = 'banking.ops_alert_test';

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
    requireBankingOpsAdmin(auth);

    const body = (req.body ?? {}) as OpsAlertTestRequest;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const dedupeKey = `${TEST_EVENT_TYPE}:${auth.clerkUserId}`;
    const nowIso = new Date().toISOString();

    const existingResult = await supabase
      .from('banking_ops_alert_counters')
      .select('suppressed_count')
      .eq('dedupe_key', dedupeKey)
      .maybeSingle();

    if (existingResult.error) {
      if (relationMissing(existingResult.error)) {
        return createErrorResponse(
          res,
          500,
          'banking_ops_alert_counters table is missing. Apply pending banking ops migration.',
          'schema_mismatch'
        );
      }
      return createErrorResponse(res, 500, 'Failed to load existing alert counter', 'internal_error', existingResult.error);
    }

    const nextCount = (existingResult.data?.suppressed_count ?? 0) + 1;
    const upsertResult = await supabase
      .from('banking_ops_alert_counters')
      .upsert({
        dedupe_key: dedupeKey,
        event_type: TEST_EVENT_TYPE,
        suppressed_count: nextCount,
        last_sent_at: nowIso,
        updated_at: nowIso,
        metadata: {
          source: 'ops-alert-test',
          message: message || null,
          adminClerkId: auth.clerkUserId
        }
      });

    if (upsertResult.error) {
      return createErrorResponse(res, 500, 'Failed to persist test alert counter', 'internal_error', upsertResult.error);
    }

    const response: OpsAlertTestResponse = {
      success: true,
      eventType: TEST_EVENT_TYPE,
      delivered: true
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
