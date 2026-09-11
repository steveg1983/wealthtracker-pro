import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import { captureServerError, withSentry } from '../_lib/sentry.js';
import { timingSafeStringEqual } from '../_lib/timing-safe.js';
import { pushDueReminders, reminderPushDeps } from '../_lib/reminder-push.js';

/**
 * The balance reminder's quarter-hourly look at who is due — the cron's HTTP
 * skin over api/_lib/reminder-push.ts, on the pattern of bank-feeds.ts. A
 * reminder set for 08:30 reaches the lock screen by 08:45 at the latest.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? '';
  const cronSecret = getRequiredEnv('CRON_SECRET');
  if (!timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
  }

  const deps = reminderPushDeps(getServiceRoleSupabase());
  if (!deps) {
    // Inert until the APNs key is configured — the same courtesy Sentry and
    // Stripe extend; a green cron with nothing to do beats a red one daily.
    console.warn('[reminders] APNs is not configured — no reminder pushes sent');
    return res.status(200).json({ skipped: 'apns_not_configured' });
  }

  try {
    const summary = await pushDueReminders(deps);
    console.log('[reminders] balance reminders checked', summary);
    return res.status(200).json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[reminders] reminder push failed', { message });
    await captureServerError(error, { cron: 'reminders' });
    return res.status(500).json({ error: 'Reminder push failed', code: 'internal_error' });
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
