/**
 * WHAT A BANK-FEED PROVIDER HAS TO BE ABLE TO DO.
 *
 * The database has expected two providers since it was written —
 * `bank_connections.provider` is `CHECK (provider IN ('truelayer','plaid'))`,
 * the uniqueness constraint is `UNIQUE (user_id, institution_id, provider)`,
 * and `transactions.external_provider` carries the same check. The CODE never
 * caught up: the client passed a provider argument that never left the
 * browser, the exchange handler wrote the literal `'truelayer'`, and
 * `banking-sync` REJECTED any row whose provider was not TrueLayer — so a
 * second provider's connection would have 404'd as "Connection not found" on
 * every sync.
 *
 * This interface is the seam that was missing. It is deliberately narrow: it
 * covers only the things that genuinely differ between providers and that the
 * shared sync path has to ask about. Everything else the feed does — AES-GCM
 * token storage, the HMAC state token, account re-adoption, balance
 * snapshots, the atomic import RPC, dedup — is already provider-neutral and
 * stays where it is.
 *
 * ── THE TWO ERROR PREDICATES ARE THE POINT ─────────────────────────────────
 *
 * The old code decided "should I refresh?" with `/\b401\b/` against an error
 * MESSAGE, and "is this unrecoverable?" with a regex for `invalid_grant`.
 * Both are TrueLayer's vocabulary. Plaid says `ITEM_LOGIN_REQUIRED` in a JSON
 * body and does not use 401 for an expired item at all, so a provider that
 * inherited those regexes would retry forever on a dead item and never raise
 * the reauth CTA. Each provider therefore owns its own classification, and
 * the shared path only asks the question.
 */

/** What a token refresh yields, in the shape the connection row stores. */
export interface ProviderTokens {
  accessToken: string;
  /** Null when the provider does not rotate (or does not issue) refresh tokens. */
  refreshToken: string | null;
  /** Seconds until the access token expires, when the provider states it. */
  expiresInSeconds: number | null;
}

export interface BankProvider {
  /**
   * The value stored in `bank_connections.provider`. Must be one of the
   * values the table's CHECK constraint allows, or an insert will fail with
   * PG 23514 rather than anything helpful.
   */
  readonly id: string;

  /** Human name, for errors and the health endpoint. */
  readonly displayName: string;

  /**
   * True when the provider's credentials are present in the environment.
   * A deploy configured for one provider must report healthy, not degraded,
   * merely because the other one's variables are absent.
   */
  isConfigured(): boolean;

  /**
   * Exchange a stored refresh token for a fresh access token. Throws when the
   * refresh itself fails — the caller turns that into `reauth_required`,
   * because a dead refresh token can only be fixed by the user re-consenting.
   */
  refreshAccessToken(refreshToken: string): Promise<ProviderTokens>;

  /**
   * "This call failed because the ACCESS token is stale — refresh and retry
   * once." Distinct from the predicate below: this one is recoverable
   * without the user.
   */
  isExpiredTokenError(error: unknown): boolean;

  /**
   * "Only the user re-linking their bank can fix this." Drives the
   * `reauth_required` status, the 409, and the Reconnect button.
   */
  isReauthRequiredError(error: unknown): boolean;

  /**
   * Tell the provider to forget the connection, on disconnect. Optional:
   * not every provider exposes a revoke, and a provider that does not must
   * not stop the row being deleted — the local delete is what the user
   * asked for.
   */
  revokeAccessToken?(accessToken: string): Promise<void>;
}
