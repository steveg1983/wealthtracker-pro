import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from './_lib/auth.js';
import { setCorsHeaders } from './_lib/cors.js';
import { createErrorResponse } from './_lib/http-error.js';
import { applyRateLimit } from './_lib/rate-limit.js';
import { withSentry } from './_lib/sentry.js';
import { searchSymbols, type SymbolMatch } from './_lib/quotes.js';

/**
 * GET /api/quotes-search?q=… — ticker lookup.
 *
 * Sibling of /api/quotes and for the same reason: Yahoo is unreachable from the
 * browser. This is what makes "add a holding" work for ANY instrument — the LSE
 * shares, ETFs and UK OEIC funds the owner actually holds — instead of the
 * hard-coded list of 28 US tickers it replaces.
 *
 * It is also what validates a symbol before a holding is saved: a search that
 * returns an exact match is proof the ticker exists, and unlike the old
 * validate-by-quoting path it does not fail on an instrument that simply has no
 * price today.
 */

interface SearchResponse {
  matches: SymbolMatch[];
}

/** Long enough to be a query, short enough not to be a payload. */
const MAX_QUERY_LENGTH = 64;

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  // Typing in a search box fires more often than pressing Refresh, so this gets
  // a looser limit than /api/quotes — still a ceiling on a script.
  if (await applyRateLimit(req, res, { name: 'quotes-search', limit: 60, windowMs: 60_000 })) {
    return;
  }

  try {
    await requireAuth(req);

    const raw = req.query.q;
    const query = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
    if (query === '') {
      return createErrorResponse(res, 400, 'q is required', 'invalid_request');
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return createErrorResponse(
        res,
        400,
        `q must be at most ${MAX_QUERY_LENGTH} characters`,
        'invalid_request'
      );
    }

    const matches = await searchSymbols(query);

    // The instrument universe changes by the day, not the minute.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600');

    const payload: SearchResponse = { matches };
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    // Upstream failures are logged server-side; the caller gets a message it can
    // show, never Yahoo's body or our stack.
    console.error('[quotes-search] Lookup failed', error);
    return createErrorResponse(res, 502, 'Symbol lookup is unavailable', 'upstream_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
