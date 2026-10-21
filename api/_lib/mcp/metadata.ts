/**
 * OAuth discovery for the connector — the RFC 9728 protected-resource
 * document Claude reads to find the authorization server.
 *
 * ── HOW CLAUDE FINDS CLERK ──────────────────────────────────────────────────
 * An unauthenticated call to the MCP endpoint is answered 401 with
 * `WWW-Authenticate: Bearer resource_metadata="<url>"` (see route.ts). Claude
 * fetches that URL, reads `authorization_servers`, and takes the FIRST entry
 * — Clerk's issuer — whose own `/.well-known/oauth-authorization-server`
 * Clerk serves. From there Claude registers itself (CIMD or DCR), sends the
 * person to Clerk's consent screen for the scopes in `scopes_supported`, and
 * comes back with a token. We serve one small JSON document and write none
 * of the rest.
 *
 * ── THE RESOURCE MUST MATCH THE URL EXACTLY ─────────────────────────────────
 * Claude compares `resource` with the URL the person typed or the listing
 * carries, path included. So the document is built from the request's own
 * host rather than a constant: a preview deployment names itself, production
 * names itself, and neither can be pasted into the other by mistake.
 *
 * ── TWO LISTINGS, TWO DOCUMENTS ─────────────────────────────────────────────
 * The read-only listing advertises only `reckley:read`; the full listing
 * both. Claude asks for exactly what is advertised, Clerk's consent screen
 * shows exactly that, and the token carries no more. That is the whole of
 * the read-only promise (docs/mcp-connector.md §1).
 */

import { LISTING_SCOPES, type Listing } from './server.js';

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: ['header'];
  resource_name: string;
  resource_documentation?: string;
}

/** The MCP endpoint path each listing is served at. */
export const LISTING_PATHS: Record<Listing, string> = {
  full: '/api/mcp',
  read: '/api/mcp-read',
};

/** Where the discovery document for a listing lives — any HTTPS URL will do, and this one needs no `.well-known` routing. */
export const metadataPath = (listing: Listing): string =>
  `/api/mcp-oauth-protected-resource?listing=${listing}`;

export const LISTING_NAMES: Record<Listing, string> = {
  full: 'Reckley',
  read: 'Reckley (read-only)',
};

/**
 * Clerk's issuer, decoded from the publishable key: after the `pk_live_` or
 * `pk_test_` prefix the key is base64 of the Frontend API host with a `$`
 * on the end. The same derivation Clerk's own tooling uses, so the server
 * needs no second setting that could drift from the key it already holds.
 */
export function clerkIssuerFromPublishableKey(publishableKey: string): string {
  const encoded = publishableKey.replace(/^pk_(live|test)_/, '');
  const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    throw new Error('The Clerk publishable key does not decode to a host');
  }
  return `https://${host}`;
}

export function protectedResourceMetadata(input: {
  origin: string;
  listing: Listing;
  issuer: string;
  documentation?: string;
}): ProtectedResourceMetadata {
  return {
    resource: `${input.origin}${LISTING_PATHS[input.listing]}`,
    authorization_servers: [input.issuer],
    scopes_supported: [...LISTING_SCOPES[input.listing]],
    bearer_methods_supported: ['header'],
    resource_name: LISTING_NAMES[input.listing],
    ...(input.documentation ? { resource_documentation: input.documentation } : {}),
  };
}

/** The `WWW-Authenticate` value an unauthenticated call is answered with. */
export const challengeHeader = (metadataUrl: string, scopes: readonly string[], error?: { code: string; description: string }): string => {
  const parts = [`resource_metadata="${metadataUrl}"`, `scope="${scopes.join(' ')}"`];
  if (error) parts.push(`error="${error.code}"`, `error_description="${error.description}"`);
  return `Bearer ${parts.join(', ')}`;
};

/** The origin a request arrived at, honouring Vercel's forwarding headers. */
export const requestOrigin = (headers: Record<string, string | string[] | undefined>): string => {
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;
  const proto = first(headers['x-forwarded-proto']) ?? 'https';
  const host = first(headers['x-forwarded-host']) ?? first(headers.host) ?? 'localhost';
  return `${proto}://${host}`;
};
