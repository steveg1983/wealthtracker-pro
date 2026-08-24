import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from './encryption.js';
import { getProvider, type BankProvider } from './providers/index.js';

/**
 * A connection row, whichever provider issued it.
 *
 * Named for TrueLayer until 24 Aug because it could only ever BE TrueLayer:
 * the loader below rejected every other provider, so a second provider's
 * connection 404'd as "Connection not found" on every sync. The row carries
 * its own provider and the shared path dispatches on it now.
 */
export interface BankConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  institution_id: string;
  institution_name: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
}

/**
 * The provider that drives this row, or a thrown error naming the row that
 * cannot be driven. Called at the top of every operation that talks to a
 * bank, so an unknown provider fails once, loudly, rather than being
 * mistaken for the default one.
 */
const providerFor = (connection: BankConnectionRow): BankProvider => {
  const provider = getProvider(connection.provider);
  if (!provider) {
    throw new Error(
      `Connection ${connection.id} names provider "${connection.provider}", which this server cannot drive`
    );
  }
  return provider;
};

/**
 * Raised when a connection can only be recovered by the user re-linking their
 * bank (expired/absent refresh token, TrueLayer `invalid_grant`, etc.). The
 * sync handler turns this into a persisted `reauth_required` status so the UI's
 * Reauthorize CTA appears, instead of a generic `error` with a Sync button that
 * will always fail.
 */
export class ReauthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReauthRequiredError';
  }
}

/**
 * A token *refresh* failing means the long-lived refresh token is no longer
 * valid — the user must re-consent. TrueLayer signals this as `invalid_grant`
 * (HTTP 400), not 401, so a literal-401 check (issue #22) misses it. Treat any
 * refresh-call failure, plus a missing refresh token, as needs-reauth.
 */
export const isReauthRequiredError = (error: unknown, connection?: BankConnectionRow): boolean => {
  if (error instanceof ReauthRequiredError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  // Each provider classifies in its OWN vocabulary — TrueLayer says
  // `invalid_grant` on a 400, Plaid says ITEM_LOGIN_REQUIRED in a JSON body
  // and never uses 401 for a dead item. A shared regex would retry forever
  // on one provider while raising the reauth CTA correctly on the other.
  const provider = connection ? getProvider(connection.provider) : null;
  if (provider) {
    return provider.isReauthRequiredError(error);
  }
  // No row in hand (the handlers' outer catch): fall back to the union of
  // what the known providers say, which is what this predicate meant before
  // it could ask anyone.
  return /invalid_grant|no refresh token|token refresh failed|reauth/i.test(error.message);
};

export const getUserBankConnection = async (
  supabase: SupabaseClient,
  userId: string,
  connectionId: string
): Promise<BankConnectionRow | null> => {
  const { data, error } = await supabase
    .from('bank_connections')
    .select('id, user_id, provider, institution_id, institution_name, access_token_encrypted, refresh_token_encrypted')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  // DISPATCH, not a guard. This used to `return null` for anything that was
  // not TrueLayer, which is why the schema's second provider was unreachable
  // from the day it was allowed. An unknown provider is still refused —
  // driving a connection with the wrong provider's client is how one bank's
  // data would land in another's account — but a KNOWN one now passes.
  if (!getProvider(data.provider)) {
    return null;
  }

  return data as BankConnectionRow;
};

interface AccessTokenResolution {
  accessToken: string;
  refreshed: boolean;
}

const refreshConnectionAccessToken = async (
  supabase: SupabaseClient,
  connection: BankConnectionRow
): Promise<AccessTokenResolution> => {
  const provider = providerFor(connection);
  if (!connection.refresh_token_encrypted) {
    throw new ReauthRequiredError(
      `${provider.displayName} access token expired and no refresh token is stored`
    );
  }

  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  let refreshed;
  try {
    refreshed = await provider.refreshAccessToken(refreshToken);
  } catch (error) {
    // A failed refresh (invalid_grant / 400 / 401 / expired refresh token) is
    // unrecoverable without the user re-linking — surface it as needs-reauth
    // rather than a transient error.
    const detail = error instanceof Error ? error.message : 'token refresh failed';
    throw new ReauthRequiredError(`${provider.displayName} token refresh failed: ${detail}`);
  }
  const encryptedAccess = encryptSecret(refreshed.accessToken);
  const encryptedRefresh = refreshed.refreshToken
    ? encryptSecret(refreshed.refreshToken)
    : connection.refresh_token_encrypted;

  const expiresAt = refreshed.expiresInSeconds !== null
    ? new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString()
    : null;

  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      token_last_refreshed: nowIso,
      refresh_attempts: 0,
      needs_reauth: false,
      expires_at: expiresAt,
      updated_at: nowIso
    })
    .eq('id', connection.id)
    .eq('user_id', connection.user_id);

  return {
    accessToken: refreshed.accessToken,
    refreshed: true
  };
};

export const withProviderAccessToken = async <T>(
  supabase: SupabaseClient,
  connection: BankConnectionRow,
  operation: (accessToken: string) => Promise<T>
): Promise<T> => {
  const provider = providerFor(connection);
  const accessToken = decryptSecret(connection.access_token_encrypted);
  try {
    return await operation(accessToken);
  } catch (error) {
    // "Is this a stale ACCESS token?" — the provider's own answer, because a
    // literal 401 is TrueLayer's convention and not everyone's.
    if (!provider.isExpiredTokenError(error)) {
      throw error;
    }
  }

  const refreshed = await refreshConnectionAccessToken(supabase, connection);
  return operation(refreshed.accessToken);
};

export const markConnectionSyncSuccess = async (
  supabase: SupabaseClient,
  connectionId: string,
  userId: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      status: 'connected',
      error: null,
      last_sync: nowIso,
      updated_at: nowIso
    })
    .eq('id', connectionId)
    .eq('user_id', userId);
};

/**
 * A SYNC FAILED. THE CONNECTION IS NOT NECESSARILY BROKEN.
 *
 * This used to write `status: 'error'`, which is the app telling the user
 * their bank connection has stopped working — and the owner's audit log
 * shows how wrong that was. Every single `accounts` sync succeeded, and the
 * `transactions` sync three seconds later failed against the same token,
 * over and over, for weeks. The connection was healthy the entire time; one
 * endpoint at the bank was flaky. What he saw was "this connection has
 * stopped working", so he re-authorised a connection that had nothing wrong
 * with it, roughly daily.
 *
 * The rule now: `status` describes the CONNECTION — can we still talk to
 * this bank as this user? Only an authentication failure can answer no, and
 * that is `markConnectionNeedsReauth`. A fetch that 500s, times out or is
 * rate-limited is a fact about one SYNC, and sync facts belong to
 * `sync_history` (which already records every attempt) and to the response
 * the client shows as "Bank sync incomplete".
 *
 * The error text is still stored, because the row is where the last failure
 * is read from — but it no longer changes what the connection CLAIMS about
 * itself. `last_sync` is deliberately untouched: it means "when did data
 * last actually arrive", so a run of failures shows up honestly as a date
 * going stale rather than as a healthy-looking timestamp.
 */
export const markConnectionSyncFailure = async (
  supabase: SupabaseClient,
  connectionId: string,
  userId: string,
  errorMessage: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      error: errorMessage.slice(0, 2000),
      updated_at: nowIso
    })
    .eq('id', connectionId)
    .eq('user_id', userId);
};

/**
 * Persist the needs-reauth state the UI is already wired for (issue #21/#22):
 * status='reauth_required' + needs_reauth=true. The BankConnections component
 * shows its Reauthorize CTA and disables Sync for connections in this state.
 */
export const markConnectionNeedsReauth = async (
  supabase: SupabaseClient,
  connectionId: string,
  userId: string,
  errorMessage: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      status: 'reauth_required',
      needs_reauth: true,
      error: errorMessage.slice(0, 2000),
      updated_at: nowIso
    })
    .eq('id', connectionId)
    .eq('user_id', userId);
};

/**
 * A sync that found no usable linked accounts (issue #23): record that it ran
 * (last_sync) WITHOUT forcing status back to 'connected'. Unconditionally
 * marking success here masked genuinely broken connections (error /
 * reauth_required) as healthy. A previously-connected connection keeps its
 * connected status via the unchanged column; a broken one retains its problem
 * state for the user to act on.
 */
export const markConnectionSyncNoAccounts = async (
  supabase: SupabaseClient,
  connectionId: string,
  userId: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      last_sync: nowIso,
      updated_at: nowIso
    })
    .eq('id', connectionId)
    .eq('user_id', userId);
};
