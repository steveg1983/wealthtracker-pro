import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ErrorResponse, OpsAlertStatsResponse } from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import {
  getOpsAlertNotifyEvery,
  getOpsAlertSuppressionThreshold,
  requireBankingOpsAdmin
} from '../_lib/banking-ops.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

const supabase = getServiceRoleSupabase();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface OpsAlertCounterRow {
  dedupe_key: string;
  event_type: string;
  last_sent_at: string | null;
  suppressed_count: number;
  updated_at: string | null;
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

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
  max: number,
  min = 1
): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
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

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    requireBankingOpsAdmin(auth);

    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim() : '';
    const eventTypePrefix = typeof req.query.eventTypePrefix === 'string' ? req.query.eventTypePrefix.trim() : '';
    const minSuppressed = parsePositiveInt(
      typeof req.query.minSuppressed === 'string' ? req.query.minSuppressed : undefined,
      0,
      1000000,
      0
    );
    const limit = parsePositiveInt(
      typeof req.query.limit === 'string' ? req.query.limit : undefined,
      DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const onlyAboveThreshold = typeof req.query.onlyAboveThreshold === 'string' &&
      ['1', 'true', 'yes'].includes(req.query.onlyAboveThreshold.toLowerCase());

    const threshold = getOpsAlertSuppressionThreshold();
    const notifyEvery = getOpsAlertNotifyEvery();

    let query = supabase
      .from('banking_ops_alert_counters')
      .select('dedupe_key, event_type, last_sent_at, suppressed_count, updated_at')
      .order('suppressed_count', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    if (eventTypePrefix) {
      query = query.ilike('event_type', `${eventTypePrefix}%`);
    }
    if (minSuppressed > 0) {
      query = query.gte('suppressed_count', minSuppressed);
    }
    if (onlyAboveThreshold && typeof threshold === 'number') {
      query = query.gte('suppressed_count', threshold);
    }

    const { data, error } = await query;
    if (error) {
      if (relationMissing(error)) {
        const emptyResponse: OpsAlertStatsResponse = {
          success: true,
          filters: {
            eventType: eventType || null,
            eventTypePrefix: eventTypePrefix || null,
            minSuppressed,
            limit,
            onlyAboveThreshold
          },
          threshold: {
            enabled: typeof threshold === 'number',
            suppressionThreshold: threshold,
            suppressionNotifyEvery: notifyEvery
          },
          count: 0,
          summary: {
            totalSuppressed: 0,
            maxSuppressedCount: 0,
            mostRecentLastSentAt: null,
            mostRecentUpdatedAt: null,
            rowsAboveThreshold: 0
          },
          rows: []
        };
        return res.status(200).json(emptyResponse);
      }
      return createErrorResponse(res, 500, 'Failed to load ops alert stats', 'internal_error', error);
    }

    const rows = (data ?? []) as OpsAlertCounterRow[];
    const rowsAboveThreshold = typeof threshold === 'number'
      ? rows.filter((row) => row.suppressed_count >= threshold).length
      : 0;
    const maxSuppressedCount = rows.reduce((max, row) => Math.max(max, row.suppressed_count), 0);
    const totalSuppressed = rows.reduce((sum, row) => sum + row.suppressed_count, 0);
    const mostRecentLastSentAt = rows
      .map((row) => row.last_sent_at)
      .filter((value): value is string => typeof value === 'string')
      .sort()
      .at(-1) ?? null;
    const mostRecentUpdatedAt = rows
      .map((row) => row.updated_at)
      .filter((value): value is string => typeof value === 'string')
      .sort()
      .at(-1) ?? null;

    const response: OpsAlertStatsResponse = {
      success: true,
      filters: {
        eventType: eventType || null,
        eventTypePrefix: eventTypePrefix || null,
        minSuppressed,
        limit,
        onlyAboveThreshold
      },
      threshold: {
        enabled: typeof threshold === 'number',
        suppressionThreshold: threshold,
        suppressionNotifyEvery: notifyEvery
      },
      count: rows.length,
      summary: {
        totalSuppressed,
        maxSuppressedCount,
        mostRecentLastSentAt,
        mostRecentUpdatedAt,
        rowsAboveThreshold
      },
      rows: rows.map((row) => ({
        dedupeKey: row.dedupe_key,
        eventType: row.event_type,
        lastSentAt: row.last_sent_at,
        suppressedCount: row.suppressed_count,
        updatedAt: row.updated_at,
        isAboveThreshold: typeof threshold === 'number'
          ? row.suppressed_count >= threshold
          : false
      }))
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
