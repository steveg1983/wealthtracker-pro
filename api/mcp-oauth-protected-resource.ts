/**
 * OAuth discovery for the connector: `GET /api/mcp-oauth-protected-resource?listing=full|read`.
 *
 * The 401 from the MCP endpoint points here; Claude reads this document to
 * find Clerk. Public by design — there is nothing in it but the two URLs and
 * the scope names — and served from an API function rather than a static
 * `.well-known` file so `resource` can name the host the request arrived
 * at (see api/_lib/mcp/metadata.ts).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOptionalEnv, getRequiredEnv } from './_lib/env.js';
import { withSentry } from './_lib/sentry.js';
import { clerkIssuerFromPublishableKey, protectedResourceMetadata, requestOrigin } from './_lib/mcp/metadata.js';
import type { Listing } from './_lib/mcp/server.js';

const issuer = (): string =>
  getOptionalEnv('CLERK_OAUTH_ISSUER') ??
  clerkIssuerFromPublishableKey(getOptionalEnv('CLERK_PUBLISHABLE_KEY') ?? getRequiredEnv('VITE_CLERK_PUBLISHABLE_KEY'));

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const raw = Array.isArray(req.query.listing) ? req.query.listing[0] : req.query.listing;
  const listing: Listing = raw === 'read' ? 'read' : 'full';
  const document = protectedResourceMetadata({
    origin: requestOrigin(req.headers),
    listing,
    issuer: issuer(),
    documentation: getOptionalEnv('MCP_DOCUMENTATION_URL'),
  });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(document);
}

export default withSentry(handler);
