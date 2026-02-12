import type { DeadLetterAdminRow } from '../../src/types/banking-api.js';
import type { AuthContext } from './auth.js';
import { AuthError } from './auth.js';
import { getOptionalEnv } from './env.js';

const DEFAULT_MAX_RETRY_ATTEMPTS = 5;
const DEFAULT_ALERT_SUPPRESSION_THRESHOLD = 10;
const DEFAULT_ALERT_NOTIFY_EVERY = 10;

const isProductionRuntime = (): boolean => {
  const runtime = (getOptionalEnv('VERCEL_ENV') ?? getOptionalEnv('NODE_ENV') ?? '').toLowerCase();
  return runtime === 'production';
};

const parsePositiveInteger = (
  rawValue: string | undefined,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number => {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const parseOptionalPositiveInteger = (
  rawValue: string | undefined,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number | null => {
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(max, Math.max(min, parsed));
};

const parseAdminClerkIds = (): Set<string> => {
  const configured = getOptionalEnv('BANKING_OPS_ADMIN_CLERK_IDS');
  if (!configured) {
    return new Set();
  }

  return new Set(
    configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
};

export const getBankingSyncMaxRetryAttempts = (): number =>
  parsePositiveInteger(
    getOptionalEnv('BANKING_SYNC_MAX_RETRY_ATTEMPTS'),
    DEFAULT_MAX_RETRY_ATTEMPTS,
    1,
    50
  );

export const getOpsAlertSuppressionThreshold = (): number | null =>
  parseOptionalPositiveInteger(getOptionalEnv('BANKING_OPS_ALERT_SUPPRESSION_THRESHOLD'), 1, 1000000);

export const getOpsAlertNotifyEvery = (): number | null =>
  parseOptionalPositiveInteger(getOptionalEnv('BANKING_OPS_ALERT_SUPPRESSION_NOTIFY_EVERY'), 1, 1000000);

export const getEffectiveOpsAlertSuppressionThreshold = (): number =>
  getOpsAlertSuppressionThreshold() ?? DEFAULT_ALERT_SUPPRESSION_THRESHOLD;

export const getEffectiveOpsAlertNotifyEvery = (): number =>
  getOpsAlertNotifyEvery() ?? DEFAULT_ALERT_NOTIFY_EVERY;

export const isBankingOpsAdmin = (auth: AuthContext): boolean => {
  const admins = parseAdminClerkIds();

  if (admins.size === 0) {
    return !isProductionRuntime();
  }

  return admins.has(auth.clerkUserId);
};

export const requireBankingOpsAdmin = (auth: AuthContext): void => {
  if (!isBankingOpsAdmin(auth)) {
    throw new AuthError('Admin access required', 'forbidden', 403);
  }
};

interface DeadLetterConnectionRow {
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
}

const toQueueAttempts = (row: DeadLetterConnectionRow): number => {
  const queueAttempts = typeof row.queue_attempts === 'number' ? row.queue_attempts : null;
  if (queueAttempts !== null && Number.isFinite(queueAttempts)) {
    return Math.max(0, Math.floor(queueAttempts));
  }
  const refreshAttempts = typeof row.refresh_attempts === 'number' ? row.refresh_attempts : 0;
  return Math.max(0, Math.floor(refreshAttempts));
};

const toQueueLastError = (row: DeadLetterConnectionRow): string | null =>
  row.queue_last_error ?? row.error ?? null;

const isDeadLettered = (row: DeadLetterConnectionRow, maxRetryAttempts: number): boolean => {
  if (row.needs_reauth === true) {
    return true;
  }
  if (toQueueAttempts(row) >= maxRetryAttempts) {
    return true;
  }
  const lastError = toQueueLastError(row);
  return row.status === 'error' && typeof lastError === 'string' && lastError.trim().length > 0;
};

export const filterDeadLetterRows = (
  rows: DeadLetterConnectionRow[],
  maxRetryAttempts: number
): DeadLetterAdminRow[] =>
  rows
    .filter((row) => isDeadLettered(row, maxRetryAttempts))
    .map((row) => ({
      connectionId: row.id,
      userId: row.user_id ?? null,
      provider: row.provider ?? null,
      status: row.status ?? null,
      institutionName: row.institution_name ?? null,
      queueAttempts: toQueueAttempts(row),
      queueLastError: toQueueLastError(row),
      queueNextRetryAt: row.queue_next_retry_at ?? null,
      updatedAt: row.updated_at ?? null
    }));
