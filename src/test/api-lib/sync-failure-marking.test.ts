/**
 * A FAILED SYNC IS NOT A BROKEN CONNECTION.
 *
 * The owner's audit log, weeks of it: every `accounts` sync succeeded, and
 * the `transactions` sync three seconds later failed against the same access
 * token, over and over. Authentication was never in doubt — one endpoint at
 * the bank was flaky. But any non-auth failure wrote `status: 'error'`, so
 * the app told him "this connection has stopped working" and he
 * re-authorised a perfectly healthy connection, roughly daily.
 *
 * The rule these pin:
 *   - `status` describes the CONNECTION. Only an authentication failure may
 *     say it is broken — that is markConnectionNeedsReauth.
 *   - A fetch that 500s, times out or is rate-limited is a fact about one
 *     SYNC. It records the reason and leaves the connection's own claim
 *     about itself alone.
 *   - `last_sync` means "when did data last actually arrive", so a failure
 *     must not touch it — a run of failures has to show up as a date going
 *     stale, never as a fresh timestamp over missing data.
 *
 * api/** is excluded from the vitest project, so these run from here (the
 * arrangement timing-safe.test.ts and bank-providers.test.ts use).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  markConnectionSyncFailure,
  markConnectionNeedsReauth,
  markConnectionSyncSuccess,
} from '../../../api/_lib/banking-sync';

/** Captures the column set a marker writes, without a database. */
function recordingSupabase() {
  const writes: Record<string, unknown>[] = [];
  const chain = {
    update(payload: Record<string, unknown>) {
      writes.push(payload);
      return {
        eq() {
          return { eq: async () => ({ data: null, error: null }) };
        },
      };
    },
  };
  return {
    writes,
    client: { from: vi.fn(() => chain) } as never,
  };
}

describe('what a failed sync is allowed to say about the connection', () => {
  it('records the reason WITHOUT claiming the connection is broken', async () => {
    const { writes, client } = recordingSupabase();
    await markConnectionSyncFailure(client, 'conn-1', 'user-1', 'TrueLayer transactions fetch failed: 503');

    expect(writes).toHaveLength(1);
    const written = writes[0];
    // The reason is kept — it is what the row's notice reads from.
    expect(written.error).toContain('503');
    // …and the connection's own claim about itself is untouched. This is the
    // whole fix: `status: 'error'` here is what sent the owner to reconnect.
    expect(written).not.toHaveProperty('status');
    // `last_sync` must not move: it means "data arrived", and nothing did.
    expect(written).not.toHaveProperty('last_sync');
  });

  it('an AUTH failure still marks the connection — that one really is broken', async () => {
    const { writes, client } = recordingSupabase();
    await markConnectionNeedsReauth(client, 'conn-1', 'user-1', 'invalid_grant');

    expect(writes[0].status).toBe('reauth_required');
    expect(writes[0].needs_reauth).toBe(true);
  });

  it('a success clears the recorded reason and moves last_sync', async () => {
    const { writes, client } = recordingSupabase();
    await markConnectionSyncSuccess(client, 'conn-1', 'user-1');

    expect(writes[0].status).toBe('connected');
    expect(writes[0].error).toBeNull();
    expect(writes[0].last_sync).toBeTruthy();
  });

  it('the three markers are distinguishable — a caller cannot conflate them', () => {
    // Named separately on purpose: the bug was one function serving two
    // meanings ("the sync failed" and "the connection is dead").
    expect(markConnectionSyncFailure).not.toBe(markConnectionNeedsReauth);
    expect(markConnectionSyncSuccess).not.toBe(markConnectionSyncFailure);
  });
});
