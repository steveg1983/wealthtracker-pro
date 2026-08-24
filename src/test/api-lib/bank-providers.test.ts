/**
 * THE PROVIDER SEAM — the thing whose absence made the schema's second
 * provider unreachable.
 *
 * `bank_connections.provider` has allowed 'plaid' since the table was
 * written, and `UNIQUE (user_id, institution_id, provider)` was designed so
 * the same bank could exist under two providers at once. The code never
 * caught up: `banking-sync` returned null for any row that was not
 * TrueLayer, so such a connection 404'd as "Connection not found" on every
 * single sync.
 *
 * These specs pin the seam that replaced that guard. Every id and message
 * below is invented; the repo is public.
 */
import { describe, it, expect } from 'vitest';
// api/** is excluded from the vitest project (see vitest.config.ts), so the
// serverless helpers are exercised from here — the same arrangement
// timing-safe.test.ts and quotes.test.ts use.
import { getProvider, listProviders, defaultProviderId } from '../../../api/_lib/providers/index';
import { trueLayerProvider } from '../../../api/_lib/providers/truelayer';

describe('the bank-provider registry', () => {
  it('answers for a provider it knows, keyed by the value the ROW stores', () => {
    // The row is the routing decision — there is no second source of truth
    // about which provider a connection belongs to.
    expect(getProvider('truelayer')).toBe(trueLayerProvider);
  });

  it('refuses an unknown provider rather than falling back to the default', () => {
    // A silent fallback is how one bank's data would be fetched with another
    // bank's client and land in the wrong account.
    expect(getProvider('some-provider-this-server-cannot-drive')).toBeNull();
    expect(getProvider('')).toBeNull();
    expect(getProvider(null)).toBeNull();
    expect(getProvider(undefined)).toBeNull();
  });

  it('names a default explicitly rather than letting key order decide it', () => {
    expect(defaultProviderId()).toBe('truelayer');
    expect(getProvider(defaultProviderId())).not.toBeNull();
  });

  it('every registered provider is reachable by its own id', () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      expect(getProvider(provider.id)).toBe(provider);
      expect(provider.displayName).toBeTruthy();
    }
  });

  it('every registered id is one the database CHECK constraint allows', () => {
    // bank_connections.provider CHECK (provider IN ('truelayer','plaid')) —
    // registering an id outside that set would fail at INSERT with PG 23514,
    // which surfaces as an opaque 500 long after the mistake was made.
    const allowedByCheckConstraint = ['truelayer', 'plaid'];
    for (const provider of listProviders()) {
      expect(allowedByCheckConstraint).toContain(provider.id);
    }
  });
});

describe('TrueLayer classifies its own failures', () => {
  it('reads a literal 401 as a stale ACCESS token — recoverable by refresh', () => {
    expect(trueLayerProvider.isExpiredTokenError(new Error('Request failed: 401'))).toBe(true);
    expect(trueLayerProvider.isExpiredTokenError(new Error('Request failed: 500'))).toBe(false);
    expect(trueLayerProvider.isExpiredTokenError('not an error')).toBe(false);
  });

  it('reads invalid_grant as needing the USER, not a retry', () => {
    // The bug this encodes (issue #22): a dead refresh token comes back as
    // `invalid_grant` on an HTTP 400, so a literal-401 check missed it and
    // left a Sync button that could never succeed.
    expect(trueLayerProvider.isReauthRequiredError(new Error('invalid_grant'))).toBe(true);
    expect(trueLayerProvider.isReauthRequiredError(new Error('token refresh failed: 400'))).toBe(true);
    expect(trueLayerProvider.isReauthRequiredError(new Error('Request failed: 500'))).toBe(false);
  });

  it('keeps the two questions apart', () => {
    // A 401 is recoverable without the user; invalid_grant is not. A
    // provider that answered both the same way would either retry forever on
    // a dead item or send the user to re-consent over a blip.
    const transient = new Error('Request failed: 401');
    expect(trueLayerProvider.isExpiredTokenError(transient)).toBe(true);
    expect(trueLayerProvider.isReauthRequiredError(transient)).toBe(false);
  });

  it('reads 403 access_denied on a DATA fetch as a lapsed consent, not a blip', () => {
    // The owner's Revolut feed, ten failures out of ten. TrueLayer's docs:
    // when a bank's 90-day consent lapses, fetching data returns 403
    // access_denied and the remedy is the reauthentication flow. Classified
    // as a generic failure it produced "something went wrong" and a Sync
    // button that could never work — the one control that fixes it was
    // never shown.
    const real = new Error(
      'TrueLayer transactions fetch failed (48be73de3317ced2e2be7782afebb07x): 403 {"error":"access_denied"}'
    );
    expect(trueLayerProvider.isReauthRequiredError(real)).toBe(true);
    // …and it is NOT a stale access token, so nothing tries to refresh and
    // replay a call that will always be refused.
    expect(trueLayerProvider.isExpiredTokenError(real)).toBe(false);
  });

  it('does not sweep in an unrelated 403', () => {
    // Narrow on purpose: a 403 from somewhere that is not a data fetch, and
    // carries no access_denied, must not send the user to re-authorise.
    expect(trueLayerProvider.isReauthRequiredError(new Error('Some other 403 thing'))).toBe(false);
    expect(trueLayerProvider.isReauthRequiredError(new Error('Request failed: 500'))).toBe(false);
  });
});

describe('reconnecting lands on the bank, not on a list of ninety', () => {
  /**
   * `bank_connections.institution_id` is written from TrueLayer's own
   * provider metadata, so a stored Revolut connection is `ob-revolut` —
   * while the shortcut map is keyed by our ids (`revolut`). Every existing
   * connection therefore missed the lookup and fell through to the full UK
   * chooser. Merely redundant when connecting; actively misleading when
   * RECONNECTING, which is the journey a lapsed SCA exemption depends on.
   * Every id below is TrueLayer's, from their public registry.
   */
  it('passes a stored TrueLayer provider id straight through', async () => {
    const { providerForInstitution } = await import('../../../api/_lib/truelayer');
    expect(providerForInstitution('ob-revolut')).toBe('ob-revolut');
    expect(providerForInstitution('ob-natwest')).toBe('ob-natwest');
    expect(providerForInstitution('ob-amex')).toBe('ob-amex');
    expect(providerForInstitution('mock')).toBe('mock');
  });

  it('still maps our own shortcut ids, so the connect journey is unchanged', async () => {
    const { providerForInstitution } = await import('../../../api/_lib/truelayer');
    expect(providerForInstitution('revolut')).toBe('ob-revolut');
    expect(providerForInstitution('hsbc')).toBe('ob-hsbc');
  });

  it('still yields nothing for an id it genuinely does not know', async () => {
    // The caller falls back to the full list — a worse journey, never a
    // broken one.
    const { providerForInstitution } = await import('../../../api/_lib/truelayer');
    expect(providerForInstitution('a-bank-we-have-never-heard-of')).toBeUndefined();
    expect(providerForInstitution(undefined)).toBeUndefined();
  });
});

describe('the reauth classifier is reachable from where it is called', () => {
  /**
   * The defect this pins: `isReauthRequiredError` was taught to ask the
   * connection's PROVIDER, but both handlers called it without the
   * connection — so it fell through to a generic fallback every time and
   * the provider-aware answer never ran once in production. The owner's
   * "403 SCA exemption has expired" was filed as an ordinary sync failure,
   * and the row that needed a Reconnect button went on looking healthy.
   */
  const SCA_403 = 'TrueLayer transactions fetch failed (invented-account-id): 403 ' +
    '{"error_description":"SCA exemption has expired. This resource is protected by SCA.","error":"access_denied"}';

  it('classifies through the connection when one is given', async () => {
    const { isReauthRequiredError } = await import('../../../api/_lib/banking-sync');
    const connection = {
      id: 'conn-1', user_id: 'user-1', provider: 'truelayer',
      institution_id: 'ob-revolut', institution_name: 'Invented Bank',
      access_token_encrypted: 'x', refresh_token_encrypted: 'y',
    };
    expect(isReauthRequiredError(new Error(SCA_403), connection)).toBe(true);
  });

  it('and STILL says yes with no connection in hand — the fallback asks every provider', async () => {
    // The fallback used to be a hardcoded copy of one provider's regex,
    // free to drift from the real one. It did.
    const { isReauthRequiredError } = await import('../../../api/_lib/banking-sync');
    expect(isReauthRequiredError(new Error(SCA_403))).toBe(true);
  });

  it('still says no to an ordinary failure, either way', async () => {
    const { isReauthRequiredError } = await import('../../../api/_lib/banking-sync');
    expect(isReauthRequiredError(new Error('TrueLayer accounts fetch failed: 500 upstream'))).toBe(false);
  });
});
