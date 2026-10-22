/**
 * The Reckley connector for Claude — Complete Access listing.
 *
 * `POST /api/mcp`. Every piece is in `api/_lib/mcp`; this file only names
 * the listing and wires the real verifier, the real port and the shared
 * rate limiter. See docs/mcp-connector.md.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit } from './_lib/rate-limit.js';
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
  rateLimit: (req, res) => applyRateLimit(req, res, { name: 'mcp', limit: 120, windowMs: 60_000 }),
});

export default withSentry(route);
