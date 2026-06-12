import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getRequiredEnv, getOptionalEnv } from '../_lib/env.js';

/**
 * Weekly data-retention enforcement (GDPR Art. 5(1)(e)).
 *
 * Purges financial_audit_log entries older than the retention window
 * (default 6 years / 2190 days — UK financial record-keeping convention;
 * override with AUDIT_LOG_RETENTION_DAYS, minimum 365 enforced in SQL).
 *
 * Scheduled via vercel.json crons; protected by CRON_SECRET like
 * api/stripe/reconcile.ts.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? '';
  const cronSecret = getRequiredEnv('CRON_SECRET');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
  }

  const retainDays = Number(getOptionalEnv('AUDIT_LOG_RETENTION_DAYS') ?? 2190);
  if (!Number.isInteger(retainDays) || retainDays < 365) {
    console.error('[retention] Invalid AUDIT_LOG_RETENTION_DAYS', { retainDays });
    return res.status(500).json({ error: 'Invalid retention configuration', code: 'config_error' });
  }

  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase.rpc('purge_expired_audit_log', {
    p_retain_days: retainDays
  });

  if (error) {
    console.error('[retention] Purge failed', { code: error.code, message: error.message });
    return res.status(500).json({ error: 'Retention purge failed', code: 'internal_error' });
  }

  const deleted = typeof data === 'number' ? data : 0;
  console.log('[retention] Audit log purge complete', { retainDays, deleted });
  return res.status(200).json({ retainDays, deleted });
}
