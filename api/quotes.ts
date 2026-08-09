import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from './_lib/auth.js';
import { setCorsHeaders } from './_lib/cors.js';
import { createErrorResponse } from './_lib/http-error.js';
import { applyRateLimit } from './_lib/rate-limit.js';
import { withSentry } from './_lib/sentry.js';
import { fetchQuotes, parseSymbolsPayload, type QuoteResult } from './_lib/quotes.js';

/**
 * POST /api/quotes — market quotes for a batch of tickers.
 *
 * The browser cannot reach Yahoo (CSP `connect-src` excludes it AND Yahoo sends
 * no CORS headers), so this is the only working quote path in the app. See
 * api/_lib/quotes.ts for the GBp→GBP normalisation the proxy performs — prices
 * leave here in major units, always.
 *
 * AUTHENTICATED on purpose. The data is public, but an open proxy on our domain
 * is someone else's free market-data API, billed to us and rate-limited against
 * our Yahoo reputation. `requireAuth` also gives the rate limiter a real
 * identity to attach abuse to.
 *
 * PARTIAL SUCCESS IS THE NORMAL CASE: the response always contains one entry per
 * distinct requested symbol, either a quote or `{ symbol, error }`. A batch
 * never silently omits — the previous client did, which is why a watchlist card
 * for a bad ticker showed "Loading…" forever.
 */

interface QuotesResponse {
  quotes: QuoteResult[];
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  // A quote screen refreshes on a button press, not in a loop: 30 batches a
  // minute is generous for a person and a hard ceiling on a script.
  if (await applyRateLimit(req, res, { name: 'quotes', limit: 30, windowMs: 60_000 })) {
    return;
  }

  try {
    await requireAuth(req);

    const body: unknown = req.body ?? {};
    const symbolsField = typeof body === 'object' && body !== null && 'symbols' in body
      ? (body as { symbols: unknown }).symbols
      : undefined;

    const parsed = parseSymbolsPayload(symbolsField);
    if ('error' in parsed) {
      return createErrorResponse(res, 400, parsed.error, 'invalid_request');
    }

    const quotes = await fetchQuotes(parsed.symbols);

    // Daily-close grade data (the product is Microsoft Money's model: one close
    // a day plus a manual refresh), so a shared 15-minute edge cache costs
    // nobody accuracy and spares Yahoo the repeat. private=false is deliberate:
    // a quote is public market data, identical for every user, and carries
    // nothing about who asked.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=900');

    const payload: QuotesResponse = { quotes };
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    console.error('[quotes] Unexpected error', error);
    return createErrorResponse(res, 500, 'Unable to fetch quotes', 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
