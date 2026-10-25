/**
 * The Reckley connector for Claude — Complete Access listing.
 *
 * `POST /api/mcp`. Every piece is in `api/_lib/mcp`; this file only names
 * the listing and wires the real verifier, the real port and the shared
 * rate limiter. See docs/mcp-connector.md.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, bearerClientKey } from './_lib/rate-limit.js';
import { withSentry } from './_lib/sentry.js';
import { getServiceRoleSupabase } from './_lib/supabase.js';
import { verifyClerkOAuth } from './_lib/mcp/auth.js';
import { createSupabasePort } from './_lib/mcp/port.js';
import { createMcpRoute } from './_lib/mcp/route.js';

const route = createMcpRoute<VercelRequest, VercelResponse>({
  listing: 'full',
  verify: verifyClerkOAuth,
  portFor: caller => createSupabasePort(getServiceRoleSupabase(), caller.userId, { clientId: caller.authInfo.clientId }),
  // A conversation makes a handful of calls a minute; a runaway loop makes
  // hundreds. Per caller IP, like every other route.
  rateLimit: (req, res) => applyRateLimit(req, res, {
    name: 'mcp',
    // Per IP this is a CEILING: Claude reaches us from Anthropic's few egress
    // addresses on behalf of everyone, so the real limit is per caller —
    // the token's hash — and the IP figure only brakes a flood of invented
    // tokens from one place. A token that fails verification is counted
    // too: it is counted BEFORE anyone looks at it.
    limit: 1_200,
    windowMs: 60_000,
    perClient: { key: bearerClientKey, limit: 120 },
  }),
});

export default withSentry(route);
