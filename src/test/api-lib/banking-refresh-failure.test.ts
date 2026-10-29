/**
 * A REFRESH THAT FAILS IS NOT, BY ITSELF, A CONSENT THAT DIED.
 *
 * Until 29 Oct 2026 every failed token refresh became ReauthRequiredError, so
 * the connection was marked `reauth_required`, the hourly refresh stopped
 * syncing it, and the only way back was the person re-consenting at their
 * bank. That is right for exactly one answer — TrueLayer's `invalid_grant`,
 * the refresh token is dead — and wrong for every other:
 *
 *   - a 5xx or a 429 from TrueLayer, or the request timing out, is a fact
 *     about one sync; the next run would have succeeded;
 *   - `invalid_client` is OUR configuration (a mistyped client secret in
 *     Vercel), which no amount of the user re-linking can fix, and which
 *     must be loud rather than look like every bank lapsing at once.
 *
 * One bad hour at :07 — an outage, or a client secret pasted wrong while
 * moving it to Vercel's Secret type — would have sent the owner and Danielle
 * to re-link every bank whose access token happened to expire in it.
 *
 * Real encryption, the real TrueLayer HTTP helper and the real shared sync
 * path: only the network is stubbed. Every id, token and secret is invented;
 * the repo is public.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Set before the first call: `encryption.ts` reads ENCRYPTION_KEY lazily and
// caches it; the TrueLayer helper reads its client credentials per call.
process.env.ENCRYPTION_KEY = 'invented-test-key-0123456789abcdef';
process.env.TRUELAYER_CLIENT_ID = 'invented-client-id';
process.env.TRUELAYER_CLIENT_SECRET = 'invented-client-secret';

const { encryptSecret } = await import('../../../api/_lib/encryption');
const { withProviderAccessToken, isReauthRequiredError, ReauthRequiredError } = await import(
  '../../../api/_lib/banking-sync'
);
import type { BankConnectionRow } from '../../../api/_lib/banking-sync';

const connection: BankConnectionRow = {
  id: 'conn-invented-1',
  user_id: 'user-invented-1',
  provider: 'truelayer',
  institution_id: 'ob-invented-bank',
  institution_name: 'Synthetic Bank',
  access_token_encrypted: encryptSecret('invented-stale-access-token'),
  refresh_token_encrypted: encryptSecret('invented-refresh-token'),
};

// Supabase is written only when a refresh SUCCEEDS. Every case here fails,
// so a client whose transport refuses proves none of them wrote anything.
const supabaseNeverReached = createClient('http://localhost:54321', 'invented-anon-key', {
  global: {
    fetch: () => {
      throw new Error('supabase must not be touched when the refresh failed');
    },
  },
});

/** A data call refused with the stale-access-token answer, so the shared path refreshes. */
const staleAccessToken = () =>
  vi.fn(async () => {
    throw new Error('TrueLayer accounts fetch failed (invented-trace-id): 401 {"error":"invalid_token"}');
  });

/** TrueLayer's token endpoint answers every call with this status and body. */
const tokenEndpointAnswers = (status: number, body: string) => {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Run the shared path to its refresh, and hand back what it threw. */
const refreshFailure = async (): Promise<unknown> => {
  const operation = staleAccessToken();
  const thrown = await withProviderAccessToken(supabaseNeverReached, connection, operation).then(
    () => null,
    (error: unknown) => error
  );
  // The data call is never replayed on a token the refresh did not produce.
  expect(operation).toHaveBeenCalledTimes(1);
  expect(thrown).not.toBeNull();
  return thrown;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a refresh that fails for a reason the user cannot fix leaves the connection alone', () => {
  it.each([
    { why: 'TrueLayer is down', status: 503, body: 'upstream unavailable' },
    { why: 'TrueLayer is rate-limiting us', status: 429, body: '{"error":"rate_limit_exceeded"}' },
    { why: 'our client secret is wrong (401)', status: 401, body: '{"error":"invalid_client"}' },
    { why: 'our client secret is wrong (400)', status: 400, body: '{"error":"invalid_client"}' },
  ])('$why: $status is a failed sync, not a dead consent', async ({ status, body }) => {
    const fetchMock = tokenEndpointAnswers(status, body);
    const thrown = await refreshFailure();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(thrown).not.toBeInstanceOf(ReauthRequiredError);
    // The question recordSyncFailure asks, with the row in hand and without.
    expect(isReauthRequiredError(thrown, connection)).toBe(false);
    expect(isReauthRequiredError(thrown)).toBe(false);
    // …and what it records still says what happened, status and all.
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/token refresh/);
    expect((thrown as Error).message).toContain(String(status));
  });

  it('the request never reaching TrueLayer is a failed sync, not a dead consent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      })
    );
    const thrown = await refreshFailure();

    expect(thrown).not.toBeInstanceOf(ReauthRequiredError);
    expect(isReauthRequiredError(thrown, connection)).toBe(false);
    expect(isReauthRequiredError(thrown)).toBe(false);
    // A bare "fetch failed" names nothing; the sync history should.
    expect((thrown as Error).message).toMatch(/TrueLayer token refresh/);
    expect((thrown as Error).message).toContain('fetch failed');
  });
});

describe('a refresh token TrueLayer calls dead still sends the user to reconnect', () => {
  it('400 invalid_grant is a reauth fact', async () => {
    tokenEndpointAnswers(400, '{"error":"invalid_grant"}');
    const thrown = await refreshFailure();

    expect(thrown).toBeInstanceOf(ReauthRequiredError);
    expect(isReauthRequiredError(thrown, connection)).toBe(true);
    expect((thrown as Error).message).toContain('invalid_grant');
  });
});
