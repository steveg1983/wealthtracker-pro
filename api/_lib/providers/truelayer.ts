import type { BankProvider, ProviderTokens } from './types.js';
import {
  refreshAccessToken as trueLayerRefresh,
  revokeAccessToken as trueLayerRevoke,
} from '../truelayer.js';
import { getOptionalEnv } from '../env.js';

/**
 * TrueLayer, behind the shared provider interface.
 *
 * A thin adapter, deliberately: `api/_lib/truelayer.ts` keeps every byte of
 * its HTTP knowledge and is not touched. All this does is answer the four
 * questions the shared sync path asks, in TrueLayer's own vocabulary — which
 * is the whole reason the questions are asked of a provider rather than
 * answered by a regex in the shared path.
 *
 * NOTE the `.js` import suffixes. `serverlessImportClosure.test.ts` walks the
 * whole `api/**` import graph and rejects extensionless relative imports,
 * because a missing suffix took `discover-accounts` and `sync-accounts` down
 * in production on 2026-08-09 — the module simply fails to load in the
 * serverless runtime, so the failure is a 500 at request time, not a build
 * error anyone would have seen.
 */
export const trueLayerProvider: BankProvider = {
  id: 'truelayer',
  displayName: 'TrueLayer',

  isConfigured(): boolean {
    return Boolean(
      getOptionalEnv('TRUELAYER_CLIENT_ID') &&
      getOptionalEnv('TRUELAYER_CLIENT_SECRET') &&
      getOptionalEnv('TRUELAYER_REDIRECT_URI')
    );
  },

  async refreshAccessToken(refreshToken: string): Promise<ProviderTokens> {
    const refreshed = await trueLayerRefresh(refreshToken);
    return {
      accessToken: refreshed.access_token,
      // TrueLayer may or may not rotate the refresh token; when it does not,
      // the caller keeps the one it already holds.
      refreshToken: refreshed.refresh_token ?? null,
      expiresInSeconds:
        typeof refreshed.expires_in === 'number' && Number.isFinite(refreshed.expires_in)
          ? refreshed.expires_in
          : null,
    };
  },

  /**
   * TrueLayer signals a stale ACCESS token as a literal 401, which the HTTP
   * helpers fold into the error message. Recoverable: refresh and retry.
   */
  isExpiredTokenError(error: unknown): boolean {
    return error instanceof Error && /\b401\b/.test(error.message);
  },

  /**
   * A dead REFRESH token comes back as `invalid_grant` on an HTTP 400 — not a
   * 401 — which is why a literal-401 check missed it (issue #22) and left the
   * user with a Sync button that could never succeed.
   */
  isReauthRequiredError(error: unknown): boolean {
    return (
      error instanceof Error &&
      /invalid_grant|no refresh token|token refresh failed|reauth/i.test(error.message)
    );
  },

  async revokeAccessToken(accessToken: string): Promise<void> {
    await trueLayerRevoke(accessToken);
  },
};
