import { searchSymbols as searchYahoo, type SymbolMatch } from './quotes.js';
import { searchSymbolsTwelveData } from './twelvedata.js';

/**
 * WHICH PROVIDER ANSWERS "does this ticker exist", and nothing else.
 *
 * One file whose whole job is the CHOICE, so that switching providers is an
 * environment variable rather than an edit — the same shape as
 * `services/port/index.ts` on the app side, and for the same reason: a
 * choosing file that also does work is a file whose work only one branch gets.
 *
 * ─ WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * Yahoo's search is unkeyed and rate-limits by IP. A Vercel function shares its
 * egress IP with other customers, so the limit is one this app did not spend:
 * measured 15 August, 429 from both Yahoo hosts AND from Yahoo's own crumb
 * endpoint, while the app was making a handful of calls a day behind a 300ms
 * debounce and an hour of CDN cache. A key attaches quota to US rather than to
 * whichever address the function landed on.
 *
 * ─ THE ORDER, AND WHY YAHOO IS STILL HERE ──────────────────────────────────
 *
 * Twelve Data when a key is configured, Yahoo otherwise, and Yahoo again if
 * Twelve Data fails. Not belt and braces:
 *
 *   · with no key the app must keep working exactly as it did, so that adding
 *     the key is a deployment rather than a migration;
 *   · Twelve Data's free tier has a daily ceiling, and the day it is reached
 *     the honest behaviour is a degraded search rather than none.
 *
 * ─ WHAT A PROVIDER MUST GUARANTEE ──────────────────────────────────────────
 *
 * That every symbol it returns can be PRICED by `fetchQuote`, which speaks
 * Yahoo's dialect. A provider returning `SHEL` where Yahoo wants `SHEL.L` has
 * not failed loudly — it has handed back a holding that silently never prices,
 * which looks like it worked. See `toYahooSymbol` in the Twelve Data adapter;
 * an unmapped exchange is dropped rather than offered.
 */

export type SymbolSearchProvider = 'twelvedata' | 'yahoo';

/** Which provider this deployment will use, and why. Exported for /api health. */
export function activeSymbolSearchProvider(
  env: NodeJS.ProcessEnv = process.env
): SymbolSearchProvider {
  return (env.TWELVE_DATA_API_KEY ?? '').trim() === '' ? 'yahoo' : 'twelvedata';
}

export interface SymbolSearchOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  /** Reported per attempt so a caller can log which provider actually failed. */
  onProviderError?: (provider: SymbolSearchProvider, error: unknown) => void;
}

export async function searchSymbolsVia(
  query: string,
  options: SymbolSearchOptions = {}
): Promise<SymbolMatch[]> {
  const env = options.env ?? process.env;
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const apiKey = (env.TWELVE_DATA_API_KEY ?? '').trim();

  if (apiKey !== '') {
    try {
      return await searchSymbolsTwelveData(trimmed, {
        apiKey,
        fetchImpl: options.fetchImpl
      });
    } catch (error) {
      // Falling through, not swallowing: the caller is told which provider
      // failed, because "search is down" and "our key is exhausted" want
      // different actions and the logs are where that distinction survives.
      options.onProviderError?.('twelvedata', error);
    }
  }

  return searchYahoo(trimmed, options.fetchImpl as never);
}
