import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import { captureServerError, withSentry } from '../_lib/sentry.js';
import { timingSafeStringEqual } from '../_lib/timing-safe.js';
import { dedupeSymbols, fetchQuotes, isQuoteFailure } from '../_lib/quotes.js';

/**
 * Nightly close prices for every holding, from Microsoft Money's playbook:
 * one price a day, plus a manual "Update quotes" button for anyone who cannot
 * wait. No streaming, no websocket, no per-minute polling — a portfolio page
 * that re-priced every 30 seconds was never what the numbers deserved, and it
 * is not what the exchange publishes.
 *
 * Scheduled via vercel.json crons; protected by CRON_SECRET exactly like
 * api/cron/retention.ts.
 *
 * ── WHY IT USES THE SERVICE ROLE ────────────────────────────────────────────
 * There is no signed-in user at 04:20 UTC, so RLS has no identity to work with.
 * The write is nonetheless safe to run across every user's rows because a price
 * is PUBLIC MARKET DATA, identical for everyone holding the symbol: this
 * handler sets current_price/last_updated by SYMBOL and touches no other
 * column, no other table, and nothing user-specific. It cannot move a balance,
 * a quantity, or a cost basis.
 *
 * ── THE NORMALISATION IS THE SAME CODE ──────────────────────────────────────
 * It imports api/_lib/quotes.js, the module /api/quotes uses. Two copies of the
 * GBp→GBP rule is one copy too many: the day they disagree, half the prices in
 * the table are 100x out and nothing on screen says which half.
 */

/**
 * Symbols we will re-price in one run. Sized to finish inside the 60s
 * maxDuration this function is given in vercel.json (a Yahoo pass plus one
 * UPDATE per symbol), because a run that times out writes NOTHING for its tail
 * and reports nothing at all. Above the ceiling the run prices the first
 * MAX_SYMBOLS_PER_RUN and says `truncated: true` rather than pretending.
 */
const MAX_SYMBOLS_PER_RUN = 150;

/**
 * Holding rows read in one pass.
 *
 * Stated explicitly because PostgREST applies a default ceiling of its own
 * (1000) and applying it SILENTLY is how a symbol stops being priced without
 * anyone finding out. Naming the limit here means we can also detect hitting
 * it: a full page back is reported, so the ceiling becomes visible in the run's
 * output instead of being discovered by a stale price months later.
 */
const MAX_ROWS_PER_RUN = 5000;

/** Symbols per Yahoo pass, with a pause between passes — a polite crawl. */
const CHUNK_SIZE = 25;
const CHUNK_PAUSE_MS = 250;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface QuotesCronResult {
  /** Distinct symbols this run attempted. */
  symbols: number;
  priced: number;
  failed: number;
  rowsUpdated: number;
  /** True when there were more distinct symbols than MAX_SYMBOLS_PER_RUN. */
  truncated: boolean;
  /** True when the holdings read filled its page — there may be more rows. */
  rowsCapped: boolean;
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? '';
  // getRequiredEnv throws when CRON_SECRET is unset, so an unconfigured deploy
  // rejects every request rather than accepting an empty secret.
  const cronSecret = getRequiredEnv('CRON_SECRET');
  if (!timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
  }

  const supabase = getServiceRoleSupabase();

  const { data, error } = await supabase
    .from('investments')
    .select('symbol')
    .limit(MAX_ROWS_PER_RUN);
  if (error) {
    console.error('[quotes-cron] Could not read holdings', { code: error.code, message: error.message });
    await captureServerError(new Error(`quotes cron read failed: ${error.message}`), {
      cron: 'quotes',
      code: error.code
    });
    return res.status(500).json({ error: 'Failed to read holdings', code: 'internal_error' });
  }

  const rows = data ?? [];
  const rowsCapped = rows.length >= MAX_ROWS_PER_RUN;
  if (rowsCapped) {
    console.warn('[quotes-cron] holdings read hit its row ceiling', { limit: MAX_ROWS_PER_RUN });
  }

  // ONE fetch per distinct symbol, not one per row: a fund held by fifty people
  // is fifty rows and exactly one quote.
  const rawSymbols = rows
    .map((row) => row.symbol)
    .filter((symbol): symbol is string => typeof symbol === 'string');
  const allSymbols = dedupeSymbols(rawSymbols);
  const truncated = allSymbols.length > MAX_SYMBOLS_PER_RUN;
  const symbols = truncated ? allSymbols.slice(0, MAX_SYMBOLS_PER_RUN) : allSymbols;

  let priced = 0;
  let failed = 0;
  let rowsUpdated = 0;

  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    const results = await fetchQuotes(chunk);

    for (const result of results) {
      if (isQuoteFailure(result)) {
        failed += 1;
        // Not an alert: a delisted ticker in someone's history fails every
        // night and is not a fault in this job. The count is the signal.
        console.warn('[quotes-cron] symbol failed', { symbol: result.symbol });
        continue;
      }
      priced += 1;

      // Price and stamp only. A row's quantity, cost basis and account are the
      // user's data and are never touched here. `.select('id')` makes the
      // affected-row count observable — without it a run that matched nothing
      // (a renamed symbol, a mis-cased ticker) reports success.
      const { data: updated, error: updateError } = await supabase
        .from('investments')
        .update({
          current_price: result.price,
          last_updated: result.asOf,
          updated_at: new Date().toISOString()
        })
        .eq('symbol', result.symbol)
        .select('id');

      if (updateError) {
        failed += 1;
        console.error('[quotes-cron] price write failed', {
          symbol: result.symbol,
          code: updateError.code,
          message: updateError.message
        });
        continue;
      }
      rowsUpdated += updated?.length ?? 0;
    }

    if (i + CHUNK_SIZE < symbols.length) {
      await sleep(CHUNK_PAUSE_MS);
    }
  }

  // A run where EVERY symbol failed is an outage (Yahoo down, shape changed),
  // not a data quirk, and is the one case worth waking someone for.
  if (symbols.length > 0 && priced === 0) {
    await captureServerError(
      new Error(`quotes cron priced 0 of ${symbols.length} symbols`),
      { cron: 'quotes', symbols: symbols.length }
    );
  }

  const result: QuotesCronResult = {
    symbols: symbols.length,
    priced,
    failed,
    rowsUpdated,
    truncated,
    rowsCapped
  };
  console.log('[quotes-cron] Complete', result);
  return res.status(200).json(result);
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
