/**
 * One MCP endpoint, as a Node request handler: the OAuth handshake in front,
 * the SDK's stateless Streamable HTTP handler behind.
 *
 * ── THE ORDER OF QUESTIONS ──────────────────────────────────────────────────
 *   0. Over the rate limit → 429 from the shared limiter, BEFORE any token is
 *      looked at. The limiter is an abuse brake, and the costliest thing this
 *      route does for a stranger is verify a token — a network call to Clerk
 *      unless CLERK_JWT_KEY is set. Metering only after verification (as the
 *      first cut did, 21–23 Oct 2026) left an unauthenticated flood unmetered
 *      and every one of its requests paid for. Keyed by connecting IP, so a
 *      person's own Claude is never throttled by someone else's noise.
 *   1. No usable token → 401 with the discovery pointer. This is the whole
 *      start of sign-in: Claude reads `WWW-Authenticate`, fetches the
 *      metadata, finds Clerk, and comes back with a token. A 200 here would
 *      end the flow before it began — Claude ignores the header on a 200.
 *   2. A valid token for a person with no ledger → 403, said plainly.
 *   3. A token without the read scope → 403 `insufficient_scope`, with the
 *      scopes this listing wants in the challenge, so Claude can re-consent.
 *   4. Otherwise the SDK handler, built fresh for THIS caller: the port is
 *      scoped to their ledger and the tools to their scopes.
 *
 * ── WHY THE PORT IS BUILT INSIDE THE FACTORY ────────────────────────────────
 * `createMcpHandler` calls the server factory once per request with the
 * `authInfo` the route attached. The caller's ledger id travels in
 * `authInfo.extra`, so the factory — and nothing before it — decides which
 * ledger the tools read. There is no module-level port to get wrong.
 *
 * ── TWO LISTINGS, ONE ROUTE ─────────────────────────────────────────────────
 * The read listing's route intersects the token's scopes with the listing's
 * before building the server, so a full-access token aimed at the read URL
 * still gets a read-only server. The promise on the directory card holds
 * whichever token arrives.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMcpHandler, type AuthInfo } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { OAuthVerifier, VerifiedCaller } from './auth.js';
import { challengeHeader, metadataPath, requestOrigin } from './metadata.js';
import type { ReckleyPort } from './port.js';
import { createReckleyServer, LISTING_SCOPES, READ_SCOPE, type Listing } from './server.js';

export interface McpRouteDeps<Req extends IncomingMessage, Res extends ServerResponse> {
  listing: Listing;
  verify: OAuthVerifier;
  /** The port for a verified caller — scoped to their ledger and nothing else. */
  portFor: (caller: VerifiedCaller) => ReckleyPort;
  /** Returns true after writing a 429 itself; omitted in specs. */
  rateLimit?: (req: Req, res: Res) => Promise<boolean>;
  now?: () => Date;
}

export type McpRouteHandler<Req extends IncomingMessage, Res extends ServerResponse> =
  (req: Req, res: Res) => Promise<void>;

const sendJson = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

/** The caller the route verified, read back out of what it attached. */
const callerFrom = (authInfo: AuthInfo | undefined): VerifiedCaller => {
  const userId = authInfo?.extra?.userId;
  const clerkUserId = authInfo?.extra?.clerkUserId;
  if (!authInfo || typeof userId !== 'string' || typeof clerkUserId !== 'string') {
    // The route attaches these before the handler runs; reaching here means
    // the handler was called some other way, and nothing must be read.
    throw new Error('MCP server built without a verified caller');
  }
  return { authInfo, userId, clerkUserId };
};

export function createMcpRoute<Req extends IncomingMessage & { body?: unknown }, Res extends ServerResponse>(
  deps: McpRouteDeps<Req, Res>
): McpRouteHandler<Req, Res> {
  const listingScopes = LISTING_SCOPES[deps.listing];

  const handler = createMcpHandler(ctx => {
    const caller = callerFrom(ctx.authInfo);
    const scopes = caller.authInfo.scopes.filter(scope => listingScopes.includes(scope));
    return createReckleyServer({ port: deps.portFor(caller), scopes, now: deps.now });
  });
  const node = toNodeHandler(handler);

  return async (req, res) => {
    const metadataUrl = `${requestOrigin(req.headers)}${metadataPath(deps.listing)}`;

    if (req.method === 'OPTIONS') {
      // A browser-based client (MCP Inspector) asks before it calls; Claude
      // itself never does, but refusing costs nothing and helps testing.
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
        'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    if (deps.rateLimit && (await deps.rateLimit(req, res))) return;

    const outcome = await deps.verify(req);
    if (outcome === 'anonymous') {
      sendJson(
        res,
        401,
        { error: 'unauthorized', message: 'Sign in to Reckley to use this connector.' },
        { 'WWW-Authenticate': challengeHeader(metadataUrl, listingScopes) }
      );
      return;
    }
    if (outcome === 'unknown-user') {
      sendJson(res, 403, {
        error: 'no_ledger',
        message: 'This Reckley account has no ledger yet. Open the app once to create it, then reconnect.',
      });
      return;
    }
    if (!outcome.authInfo.scopes.includes(READ_SCOPE)) {
      sendJson(
        res,
        403,
        { error: 'insufficient_scope', message: `This connector needs the ${listingScopes.join(' and ')} permission.` },
        {
          'WWW-Authenticate': challengeHeader(metadataUrl, listingScopes, {
            code: 'insufficient_scope',
            description: 'The token does not carry the scopes this connector needs',
          }),
        }
      );
      return;
    }

    await node(Object.assign(req, { auth: outcome.authInfo }), res, req.body);
  };
}
