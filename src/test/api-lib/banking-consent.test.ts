/**
 * GIVING THE BANK ITS CONSENT BACK — the act itself, exercised for real.
 *
 * Deleting a `bank_connections` row and revoking the authorisation behind it
 * are different things, and the app has twice shipped the first while implying
 * the second. `api/_lib/banking-consent.ts` is the single description of the
 * revocation both callers now go through — the Disconnect button and account
 * deletion — so these specs are what stop either of them quietly regressing
 * to "we forgot the bank, the bank did not forget us".
 *
 * Real encryption and the real TrueLayer call: only the network is stubbed,
 * which is the one thing a test cannot honestly own. That matters most for the
 * first spec — the token goes over the wire DECRYPTED, and nothing but an
 * end-to-end run through the real `decryptSecret` proves it.
 *
 * api/** is excluded from the vitest project (see vitest.config.ts), so the
 * serverless helpers are exercised from here — the same arrangement
 * timing-safe.test.ts and bank-providers.test.ts use.
 *
 * Every token, id and institution below is invented; the repo is public.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set before the first call: `encryption.ts` reads ENCRYPTION_KEY lazily and
// then caches it for the life of the module.
process.env.ENCRYPTION_KEY = 'invented-test-key-0123456789abcdef';

const { encryptSecret } = await import('../../../api/_lib/encryption');
const { revokeConnectionConsent, revokeConnectionConsents } = await import(
  '../../../api/_lib/banking-consent'
);

const truelayerRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'conn_invented_1',
  provider: 'truelayer',
  access_token_encrypted: encryptSecret('invented-access-token'),
  ...overrides
});

/** Replies with one status to every call, and records what it was asked. */
const stubFetch = (status: number) => {
  const fetchMock = vi.fn(async () => new Response(null, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('revoking one connection', () => {
  it('sends the DECRYPTED token to TrueLayer, and asks it to forget us', async () => {
    const fetchMock = stubFetch(204);

    const revoked = await revokeConnectionConsent(truelayerRow());

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    // DELETE /data/v1/me is the call that drops the consent, not just the
    // token — a token refresh would leave the authorisation standing.
    expect(url).toContain('/data/v1/me');
    expect(init.method).toBe('DELETE');
    // The column holds ciphertext. Sending it verbatim would revoke nothing
    // and look, from here, exactly like success.
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer invented-access-token');
  });

  it.each([401, 403])('treats %i as revoked — the token is already dead', async (status) => {
    stubFetch(status);
    expect(await revokeConnectionConsent(truelayerRow())).toBe(true);
  });

  it('reports a REFUSAL rather than assuming it worked', async () => {
    // The whole point of the boolean. A provider erroring must not reach the
    // user as a clean disconnection.
    stubFetch(500);
    expect(await revokeConnectionConsent(truelayerRow())).toBe(false);
  });

  it('reports a provider that could not be reached, and does not throw', async () => {
    // Nothing here may throw: both callers delete regardless, and a provider
    // being down must not trap somebody in a bank feed or block an erasure.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(revokeConnectionConsent(truelayerRow())).resolves.toBe(false);
  });

  it('survives a token this deployment can no longer decrypt', async () => {
    const fetchMock = stubFetch(204);

    const revoked = await revokeConnectionConsent(
      truelayerRow({ access_token_encrypted: 'not-base64-ciphertext' })
    );

    expect(revoked).toBe(false);
    // And says nothing to TrueLayer: there was no token to say it with.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call TrueLayer about a connection that is not TrueLayer’s', async () => {
    const fetchMock = stubFetch(204);

    expect(await revokeConnectionConsent(truelayerRow({ provider: 'plaid' }))).toBe(false);
    expect(await revokeConnectionConsent(truelayerRow({ access_token_encrypted: null }))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('revoking a whole account’s worth', () => {
  it('attempts every connection even after one refuses', async () => {
    // One bank being down must not leave the rest of somebody's consents
    // standing — least of all during an erasure, where there is no second
    // chance and no ledger left to try again from.
    const fetchMock = stubFetch(500);

    const unrevoked = await revokeConnectionConsents([
      truelayerRow({ id: 'conn_invented_1' }),
      truelayerRow({ id: 'conn_invented_2' })
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(unrevoked).toEqual(['conn_invented_1', 'conn_invented_2']);
  });

  it('names only the ones that did not confirm', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    const unrevoked = await revokeConnectionConsents([
      truelayerRow({ id: 'conn_invented_1' }),
      truelayerRow({ id: 'conn_invented_2' })
    ]);

    expect(unrevoked).toEqual(['conn_invented_1']);
  });

  it('has nothing to say about an account with no bank feeds', async () => {
    const fetchMock = stubFetch(204);

    expect(await revokeConnectionConsents([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
