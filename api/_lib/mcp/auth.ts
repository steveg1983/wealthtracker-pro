/**
 * Who is calling the connector — a Clerk OAuth access token, resolved to a
 * ledger user.
 *
 * ── NOT THE SESSION PATH ────────────────────────────────────────────────────
 * `api/_lib/auth.ts` verifies the SESSION tokens the app's own front end
 * sends. Claude never has one of those: it holds an OAuth access token that
 * Clerk's authorization server minted after the person consented on Clerk's
 * screen, and such a token says which CLIENT holds it and which SCOPES were
 * granted as well as who the person is. So this is a second verifier, not a
 * second branch in the first — the two kinds of token answer different
 * questions and are checked by different Clerk calls.
 *
 * The mapping to `users.id` is the same as the session path's, and it is the
 * only user id the port is ever built with: a tool argument cannot name a
 * user, so a tool cannot read another person's ledger.
 *
 * ── CACHED, BRIEFLY ─────────────────────────────────────────────────────────
 * An opaque Clerk token is verified by a round trip to Clerk. A conversation
 * makes many tool calls in a row with the same token, so a verified caller is
 * kept for sixty seconds per function instance. Revocation therefore takes
 * at most a minute to bite here; the token itself is never logged.
 */

import type { IncomingMessage } from 'node:http';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { getOptionalEnv, getRequiredEnv } from '../env.js';
import { getServiceRoleSupabase } from '../supabase.js';

export interface VerifiedCaller {
  /** What the MCP handler is handed; `extra.userId` is the ledger user. */
  authInfo: AuthInfo;
  /** `users.id` — the only id the port is built with. */
  userId: string;
  clerkUserId: string;
}

/**
 * The outcome of looking at a request's bearer token.
 *   'anonymous'  — no usable token: answer 401 with the discovery pointer
 *   'unknown-user' — a valid token for a person with no ledger yet: 403
 */
export type VerifyOutcome = VerifiedCaller | 'anonymous' | 'unknown-user';

export type OAuthVerifier = (req: IncomingMessage) => Promise<VerifyOutcome>;

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const cache = new Map<string, { caller: VerifiedCaller; until: number }>();

export const bearerToken = (req: IncomingMessage): string | null => {
  const raw = req.headers.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
};

/** The request as the Fetch API sees it — what Clerk's verifier takes. Headers only; the body is never read. */
export const toFetchRequest = (req: IncomingMessage): Request => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const proto = headers.get('x-forwarded-proto') ?? 'https';
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost';
  return new Request(`${proto}://${host}${req.url ?? '/'}`, { method: req.method ?? 'GET', headers });
};

let clerk: ClerkClient | null = null;
const getClerk = (): ClerkClient => {
  if (!clerk) {
    clerk = createClerkClient({
      secretKey: getRequiredEnv('CLERK_SECRET_KEY'),
      // The publishable key is public by nature; the server reads the same
      // value the front end is built with unless given its own.
      publishableKey: getOptionalEnv('CLERK_PUBLISHABLE_KEY') ?? getRequiredEnv('VITE_CLERK_PUBLISHABLE_KEY'),
      // Networkless verification of JWT-shaped tokens when the key is set.
      jwtKey: getOptionalEnv('CLERK_JWT_KEY'),
    });
  }
  return clerk;
};

const ledgerUserIdFor = async (clerkUserId: string): Promise<string | null> => {
  const { data, error } = await getServiceRoleSupabase()
    .from('users')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .maybeSingle();
  if (error) {
    console.error(`[mcp] user lookup failed: ${error.message}`);
    return null;
  }
  return data?.id ?? null;
};

const remember = (token: string, caller: VerifiedCaller): void => {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(token, { caller, until: Date.now() + CACHE_TTL_MS });
};

/** Verify a Clerk OAuth access token and resolve the person's ledger. */
export const verifyClerkOAuth: OAuthVerifier = async (req) => {
  const token = bearerToken(req);
  if (!token) return 'anonymous';

  const cached = cache.get(token);
  if (cached && cached.until > Date.now()) return cached.caller;
  cache.delete(token);

  const state = await getClerk().authenticateRequest(toFetchRequest(req), { acceptsToken: 'oauth_token' });
  if (!state.isAuthenticated) {
    // Say why, server-side; the token itself is never logged.
    console.warn(`[mcp] OAuth token refused: ${state.reason ?? 'no reason given'}`);
    return 'anonymous';
  }
  const auth = state.toAuth();
  if (auth.tokenType !== 'oauth_token' || !auth.userId) return 'anonymous';

  const userId = await ledgerUserIdFor(auth.userId);
  if (!userId) return 'unknown-user';

  const caller: VerifiedCaller = {
    authInfo: {
      token,
      clientId: auth.clientId,
      scopes: auth.scopes,
      extra: { userId, clerkUserId: auth.userId },
    },
    userId,
    clerkUserId: auth.userId,
  };
  remember(token, caller);
  return caller;
};

/** For specs: forget every cached caller. */
export const forgetVerifiedCallers = (): void => {
  cache.clear();
};
