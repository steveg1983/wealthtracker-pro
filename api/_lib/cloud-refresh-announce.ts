import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConnectionResult } from './cloud-refresh.js';
import { loadPreferenceValues, notifyUser, pushDeps, type NotifyOutcome, type PushNote } from './push.js';
import { parsePhoneNotificationPrefs, PHONE_NOTIFICATION_PREFS_KEY } from '../../src/services/push/prefs.js';

/**
 * What the cloud refresh tells a phone, once it has run.
 *
 * Two kinds of news, each behind its own switch in Settings → App Settings →
 * Phone notifications (services/push/prefs.ts):
 *
 *   feedActivity   "N new transactions" — ONE push per user per run,
 *                  naming every institution that delivered, so three feeds
 *                  syncing in one pass are one interruption and not three.
 *                  Counts only, never amounts: a lock screen is read by
 *                  whoever is holding the phone.
 *   feedAttention  "<Bank> needs reconnecting" — one push per connection
 *                  that flipped to reauth_required IN THIS RUN. The run
 *                  after it will not list that connection at all (the
 *                  due-list excludes reauth'd rows), so the transition is
 *                  announced exactly once, which is also how the Sentry
 *                  rule in sync-outcome.ts treats it.
 *
 * Written over injected verbs so the wording and the grouping run under
 * vitest; `announceDeps` binds them.
 */

export interface AnnounceDeps {
  loadPreferences: (userIds: readonly string[]) => Promise<Map<string, Record<string, string>>>;
  notify: (userId: string, note: PushNote) => Promise<NotifyOutcome>;
}

export interface AnnounceSummary {
  /** Users the run touched at all. */
  users: number;
  activityPushes: number;
  attentionPushes: number;
  sent: number;
  retired: number;
  failed: number;
}

/** Where a tap on a new-transactions push lands: Accounts, focused on To Review. */
export const REVIEW_URL = '/accounts?focus=review';
/** Where a tap on a needs-reconnecting push lands. */
export const RECONNECT_URL = '/open-banking';

const listInProse = (parts: string[]): string =>
  parts.length <= 1
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/** "14 new transactions" / "3 from HSBC and 11 from American Express are waiting for you." */
export const composeFeedActivity = (
  deliveries: ReadonlyArray<{ institution_name: string; imported: number }>
): PushNote => {
  const total = deliveries.reduce((sum, row) => sum + row.imported, 0);
  const parts = deliveries.map((row) => `${row.imported} from ${row.institution_name}`);
  return {
    title: `${total} new transaction${total === 1 ? '' : 's'}`,
    body: `${listInProse(parts)} ${total === 1 ? 'is' : 'are'} waiting for you to review.`,
    url: REVIEW_URL,
    collapseId: 'feed-activity',
    threadId: 'feed-activity'
  };
};

export const composeFeedAttention = (institutionName: string, connectionId: string): PushNote => ({
  title: `${institutionName} needs reconnecting`,
  body: `Its bank connection has stopped, so nothing new will arrive from it until you reconnect. Open WealthTracker to do that.`,
  url: RECONNECT_URL,
  collapseId: `feed-attention:${connectionId}`,
  threadId: 'feed-attention'
});

export const announceCloudRefresh = async (
  deps: AnnounceDeps,
  results: readonly ConnectionResult[]
): Promise<AnnounceSummary> => {
  const byUser = new Map<string, ConnectionResult[]>();
  for (const result of results) {
    const rows = byUser.get(result.user_id) ?? [];
    rows.push(result);
    byUser.set(result.user_id, rows);
  }

  const summary: AnnounceSummary = { users: byUser.size, activityPushes: 0, attentionPushes: 0, sent: 0, retired: 0, failed: 0 };
  if (byUser.size === 0) return summary;

  const preferences = await deps.loadPreferences([...byUser.keys()]);
  const tally = (outcome: NotifyOutcome): void => {
    summary.sent += outcome.sent;
    summary.retired += outcome.retired;
    summary.failed += outcome.failed;
  };

  for (const [userId, rows] of byUser) {
    const prefs = parsePhoneNotificationPrefs(preferences.get(userId)?.[PHONE_NOTIFICATION_PREFS_KEY]);

    if (prefs.feedActivity) {
      const deliveries = rows.flatMap((row) =>
        row.outcome.kind === 'synced' && row.outcome.imported > 0
          ? [{ institution_name: row.institution_name, imported: row.outcome.imported }]
          : []
      );
      if (deliveries.length > 0) {
        summary.activityPushes += 1;
        tally(await deps.notify(userId, composeFeedActivity(deliveries)));
      }
    }

    if (prefs.feedAttention) {
      for (const row of rows) {
        if (row.outcome.kind !== 'reauth_required') continue;
        summary.attentionPushes += 1;
        tally(await deps.notify(userId, composeFeedAttention(row.institution_name, row.connection_id)));
      }
    }
  }

  return summary;
};

/** The verbs bound to Supabase and Apple, or null when APNs is not configured. */
export const announceDeps = (supabase: SupabaseClient): AnnounceDeps | null => {
  const push = pushDeps(supabase);
  if (!push) return null;
  return {
    loadPreferences: (userIds) => loadPreferenceValues(supabase, userIds),
    notify: (userId, note) => notifyUser(push, userId, note)
  };
};
