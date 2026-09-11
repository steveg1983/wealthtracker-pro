import type { SupabaseClient } from '@supabase/supabase-js';
import { captureServerError } from './sentry.js';
import {
  getUserBankConnection,
  isReauthRequiredError,
  markConnectionNeedsReauth,
  markConnectionSyncFailure
} from './banking-sync.js';

/**
 * What a sync says when it stops for a reason that is NOT a failure to talk
 * to the bank — a schema this database does not have yet, or a request the
 * caller wrote wrongly. It carries an HTTP shape because the handlers turn it
 * straight into a response, and it deliberately does NOT go through
 * recordSyncFailure: the connection is fine, the sync simply could not be
 * attempted, and marking the row would say something about the bank that is
 * not true.
 *
 * `details` is logged server-side by createErrorResponse and never sent to
 * the client — the same rule http-error.ts enforces for every other route.
 */
export class SyncRefusal extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'SyncRefusal';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type SyncType = 'accounts' | 'transactions';

/**
 * A sync threw. Say what that MEANS about the connection, and record it.
 *
 * Lifted verbatim from the two handlers' catch blocks, which had drifted into
 * being the same forty lines twice; the cron is a third caller and a third
 * copy would have drifted too. The rules it keeps:
 *
 *   OWNERSHIP FIRST, THEN CLASSIFY — because the ROW is what says which
 *   provider's vocabulary this error is written in, and asking without it
 *   silently fell back to a generic guess. That is exactly how a
 *   `403 SCA exemption has expired` — the one error that most needs the
 *   Reconnect button — was filed as an ordinary sync failure, leaving the row
 *   looking healthy.
 *
 *   The connection id is caller-supplied and the service-role client bypasses
 *   RLS — so ownership is re-validated before any failure state is persisted,
 *   or one user could flip another's connection to error/reauth.
 *
 *   A needs-reauth failure (expired/invalid refresh token) is unrecoverable
 *   without the user re-linking: persist 'reauth_required' so the UI shows its
 *   Reauthorize CTA instead of a Sync button that will always fail (#21/#22).
 *   It is an expected user-action state, not a system fault — only genuine
 *   failures are reported to Sentry.
 *
 * Returns whether the failure was a reauth fact, which is the one thing every
 * caller decides something on (the handlers pick a 409 over a 500 with it).
 */
export const recordSyncFailure = async (
  supabase: SupabaseClient,
  userId: string | null,
  connectionId: string | null | undefined,
  syncType: SyncType,
  error: unknown,
  handler: string
): Promise<{ needsReauth: boolean }> => {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  // The detailed message can carry DB/driver internals — keep it server-side
  // (console + sync_history audit) and let the caller return a generic one.
  console.error(`[${handler}] sync failed`, { message });

  const ownedConnection = connectionId && userId
    ? await getUserBankConnection(supabase, userId, connectionId.trim())
    : null;
  const needsReauth = isReauthRequiredError(error, ownedConnection ?? undefined);
  if (!needsReauth) {
    await captureServerError(error, { handler });
  }
  if (ownedConnection && userId) {
    if (needsReauth) {
      await markConnectionNeedsReauth(supabase, ownedConnection.id, userId, message);
    } else {
      await markConnectionSyncFailure(supabase, ownedConnection.id, userId, message);
    }
    await supabase.from('sync_history').insert({
      connection_id: ownedConnection.id,
      sync_type: syncType,
      status: 'failed',
      records_synced: 0,
      error: message.slice(0, 2000),
      created_at: new Date().toISOString()
    });
  }
  return { needsReauth };
};
