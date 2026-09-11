import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import { captureServerError, withSentry } from '../_lib/sentry.js';
import { timingSafeStringEqual } from '../_lib/timing-safe.js';
import { cloudRefreshDeps, runCloudRefresh } from '../_lib/cloud-refresh.js';

/**
 * The cloud refresh: bank feeds that keep flowing while the app is closed.
 *
 * Hourly (vercel.json). Each run syncs every connection whose owner chose
 * "In the cloud" in Settings → App Settings → Bank feed refresh and which has
 * neither synced nor been attempted for six hours — the schedule, the cap it
 * comes from and the budget are all argued in api/_lib/cloud-refresh.ts; this
 * file is the cron's HTTP skin, on the pattern of retention.ts and
 * stripe/reconcile.ts.
 *
 * The budget is set below the function's maxDuration on purpose: a run that
 * is killed mid-sync by the platform records nothing about why, while one
 * that stops itself reports `exhausted` and is heard.
 */

/** Under vercel.json's 120 s for this path: the last sync begun must finish. */
const RUN_BUDGET_MS = 90_000;

async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? '';
  // getRequiredEnv throws when CRON_SECRET is unset, so an unconfigured deploy
  // rejects every request rather than accepting an empty secret.
  const cronSecret = getRequiredEnv('CRON_SECRET');
  if (!timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
  }

  try {
    const summary = await runCloudRefresh(cloudRefreshDeps(getServiceRoleSupabase()), {
      budgetMs: RUN_BUDGET_MS
    });

    const { results, ...counts } = summary;
    console.log('[bank-feeds] cloud refresh complete', counts);

    if (summary.exhausted) {
      // Cron health is otherwise unobservable: a backlog that a run could not
      // clear is the one thing here that gets worse quietly.
      await captureServerError(new Error('cloud refresh ran out of budget with connections still due'), {
        cron: 'bank-feeds',
        ...counts
      });
    }

    // The per-connection results carry institution names and ids; the summary
    // is what the log and the caller need.
    return res.status(200).json({ ...counts, connections: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[bank-feeds] cloud refresh failed', { message });
    await captureServerError(error, { cron: 'bank-feeds' });
    return res.status(500).json({ error: 'Cloud refresh failed', code: 'internal_error' });
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
