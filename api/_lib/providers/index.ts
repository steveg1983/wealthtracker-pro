import type { BankProvider } from './types.js';
import { trueLayerProvider } from './truelayer.js';

export type { BankProvider, ProviderTokens } from './types.js';

/**
 * THE REGISTRY — every bank-feed provider the server knows how to drive.
 *
 * Adding one is: write the adapter, add it here, add its id to the two CHECK
 * constraints if it is not already allowed (`bank_connections.provider` and
 * `transactions.external_provider` already permit 'plaid'), and — if it uses
 * a browser SDK rather than a redirect — allowlist its origins in BOTH
 * content security policies. That last one is not optional and not
 * cosmetic: a dev server sends no CSP, so an SDK blocked in production
 * passes every local check and fails only for real users. That exact failure
 * hid a broken currency conversion for weeks (see
 * connectSrcCoversFetchOrigins.test.ts, which now guards it).
 *
 * The registry is keyed by the string stored in `bank_connections.provider`,
 * so a row IS the routing decision — no second source of truth about which
 * provider a connection belongs to.
 */
const PROVIDERS: Record<string, BankProvider> = {
  [trueLayerProvider.id]: trueLayerProvider,
};

/**
 * The provider that drives this connection, or null when the row names one
 * the server does not know. Null is a real case, not a defensive
 * afterthought: a row written by a newer deploy, or a provider retired
 * between deploys, must fail as "this connection cannot be driven" rather
 * than being silently treated as the default one — which is precisely how a
 * feed would sync the wrong bank's data into the wrong account.
 */
export const getProvider = (providerId: string | null | undefined): BankProvider | null => {
  if (!providerId) return null;
  return PROVIDERS[providerId] ?? null;
};

/** Every provider the server can drive, for the health endpoint. */
export const listProviders = (): BankProvider[] => Object.values(PROVIDERS);

/**
 * The provider a NEW connection should use when the client did not name one.
 *
 * Kept explicit rather than "the first one in the object": when a second
 * provider lands, which one an unqualified request gets is a product
 * decision, and it should be visible here rather than emergent from key
 * order.
 */
export const defaultProviderId = (): string => trueLayerProvider.id;
