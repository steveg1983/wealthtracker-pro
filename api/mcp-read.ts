/**
 * The Reckley connector for Claude — Read-Only listing.
 *
 * `POST /api/mcp-read`. The same server as `/api/mcp`, built with the
 * token's scopes intersected with the read listing's, so this URL never
 * registers a write tool whatever token arrives. See docs/mcp-connector.md §1.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, bearerClientKey } from './_lib/rate-limit.js';
import { withSentry } from './_lib/sentry.js';
import { getServiceRoleSupabase } from './_lib/supabase.js';
import { verifyClerkOAuth } from './_lib/mcp/auth.js';
import { createSupabasePort } from './_lib/mcp/port.js';
import { createMcpRoute } from './_lib/mcp/route.js';

const route = createMcpRoute<VercelRequest, VercelResponse>({
  listing: 'read',
  verify: verifyClerkOAuth,
  portFor: caller => createSupabasePort(getServiceRoleSupabase(), caller.userId),
  // The same two buckets as the full listing (see api/mcp.ts): per caller
  // by token hash, and an IP ceiling that only brakes a flood.
  rateLimit: (req, res) => applyRateLimit(req, res, {
    name: 'mcp-read',
    limit: 1_200,
    windowMs: 60_000,
    perClient: { key: bearerClientKey, limit: 120 },
  }),
});

export default withSentry(route);
