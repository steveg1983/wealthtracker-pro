import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { createScopedLogger, type ScopedLogger } from '../loggers/scopedLogger';
import { getSupabaseAccessToken } from '../lib/supabaseToken';

/**
 * Market quotes, from OUR OWN endpoint.
 *
 * ── WHY NOT YAHOO DIRECTLY ──────────────────────────────────────────────────
 * This module used to fetch query1/query2.finance.yahoo.com from the browser.
 * That could never work: our CSP `connect-src` (vercel.json) does not list
 * Yahoo, and Yahoo sends no CORS headers, so the request was blocked and — on
 * the rare path where it was not — the response was unreadable. Every failure
 * was retried three times and then swallowed to `null`, which is why the
 * watchlist showed "Loading…" forever and every symbol the user typed into "add
 * a holding" was reported as "not found".
 *
 * The quote path now runs server-side (api/quotes.ts), where Yahoo answers
 * fine, and this module calls `/api/quotes` — which `connect-src 'self'`
 * already permits.
 *
 * ── FAILURES ARE NAMED, NEVER DROPPED ───────────────────────────────────────
 * `fetchQuotes` returns a result for EVERY symbol asked for: a quote or a
 * reason. The previous `getMultipleStockQuotes` returned a Map containing only
 * the successes, so a caller could not tell a symbol that failed from one it
 * never asked about — which is precisely how a permanently-broken watchlist
 * looked like a slow one.
 *
 * ── UNITS ───────────────────────────────────────────────────────────────────
 * Prices arrive already normalised to major units (pence → pounds) as decimal
 * STRINGS; see api/_lib/quotes.ts for the GBp/GBP trap. Nothing here divides by
 * anything: if a price ever looks 100x wrong, the bug is at the proxy, in one
 * place, and not scattered across the UI.
 */

/** How the app talks about a priced instrument. */
export interface StockQuote {
  symbol: string;
  /** Per unit, in the MAJOR unit of `currency`. */
  price: DecimalInstance;
  /** Major-unit ISO code: 'GBP', never 'GBp'. */
  currency: string;
  /** null when the response carried no previous close — not zero. */
  previousClose: DecimalInstance | null;
  /** price − previousClose, or null when there is no previous close. */
  change: DecimalInstance | null;
  /** The same move as a percentage, or null. */
  changePercent: DecimalInstance | null;
  name?: string;
  /** When the exchange priced it. */
  asOf: Date;
}

/** One instrument the lookup found. */
export interface SymbolMatch {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

/**
 * A batch's outcome. Both maps are keyed by the symbol AS ASKED FOR (upper
 * -cased), so a caller can look up either by the string it rendered.
 */
export interface QuoteBatch {
  quotes: Map<string, StockQuote>;
  /** Symbol → a sentence safe to show the user. */
  errors: Map<string, string>;
}

/** Matches the proxy's own ceiling (api/_lib/quotes.ts). */
export const MAX_SYMBOLS_PER_REQUEST = 25;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type TokenGetter = () => Promise<string | null>;

interface StockPriceDependencies {
  fetch?: FetchLike | null;
  /**
   * Supplies the Clerk session JWT for the Authorization header. Defaults to
   * the app-wide registry AuthContext populates — the same token supabase-js
   * sends — so no component has to wire one up for quotes to work.
   */
  getAuthToken?: TokenGetter;
  now?: () => number;
  logger?: ScopedLogger;
}

interface NormalizedDependencies {
  fetch: FetchLike | null;
  getAuthToken: TokenGetter;
  now: () => number;
  logger: ScopedLogger;
}

function getDefaultDependencies(): NormalizedDependencies {
  return {
    fetch: typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null,
    getAuthToken: getSupabaseAccessToken,
    now: () => Date.now(),
    logger: createScopedLogger('StockPriceService')
  };
}

let dependencies: NormalizedDependencies = getDefaultDependencies();

export function configureStockPriceService(overrides: StockPriceDependencies = {}): void {
  dependencies = {
    ...dependencies,
    ...(overrides.fetch !== undefined ? { fetch: overrides.fetch } : {}),
    ...(overrides.getAuthToken ? { getAuthToken: overrides.getAuthToken } : {}),
    ...(overrides.now ? { now: overrides.now } : {}),
    ...(overrides.logger ? { logger: overrides.logger } : {})
  };
}

export function resetStockPriceService(): void {
  dependencies = getDefaultDependencies();
  quoteCache.clear();
}

interface CachedQuote {
  quote: StockQuote;
  storedAt: number;
}

/**
 * Quotes are daily-close grade (the product is Microsoft Money's model), so a
 * short client cache only stops a tab-switch from re-asking. The real caching
 * is the proxy's `s-maxage=900`.
 */
const CACHE_TTL_MS = 60_000;
const quoteCache = new Map<string, CachedQuote>();

const cleanSymbol = (symbol: string): string => symbol.trim().toUpperCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A decimal from a wire value that may be a string or a number. */
const readDecimal = (value: unknown): DecimalInstance | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return toDecimal(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = toDecimal(value);
    return parsed.isNaN() ? null : parsed;
  }
  return null;
};

const readString = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

function toStockQuote(entry: Record<string, unknown>): StockQuote | null {
  const symbol = readString(entry, 'symbol');
  const price = readDecimal(entry.price);
  if (symbol === null || price === null) return null;

  const previousClose = readDecimal(entry.previousClose);
  const change = previousClose === null ? null : price.minus(previousClose);
  const changePercent =
    change === null || previousClose === null || previousClose.isZero()
      ? null
      : change.dividedBy(previousClose).times(100);

  const asOfText = readString(entry, 'asOf');
  const asOfDate = asOfText === null ? null : new Date(asOfText);

  const quote: StockQuote = {
    symbol: cleanSymbol(symbol),
    price,
    currency: readString(entry, 'currency') ?? 'GBP',
    previousClose,
    change,
    changePercent,
    asOf: asOfDate && !Number.isNaN(asOfDate.getTime()) ? asOfDate : new Date(dependencies.now())
  };
  const name = readString(entry, 'name');
  if (name !== null) {
    quote.name = name;
  }
  return quote;
}

function ensureFetch(): FetchLike {
  if (!dependencies.fetch) {
    throw new Error('Fetch API is not available. Provide one via configureStockPriceService.');
  }
  return dependencies.fetch;
}

async function authorizedHeaders(): Promise<Headers> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = await dependencies.getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

/** The endpoint's `{ error, code }` body as a sentence, or a generic one. */
async function describeFailure(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      const message = readString(body, 'error');
      if (message !== null) return message;
    }
  } catch {
    /* a non-JSON error body tells the user nothing useful */
  }
  return response.status === 401 || response.status === 403
    ? 'Sign in again to fetch prices'
    : fallback;
}

/**
 * Quotes for a list of symbols. Every distinct symbol appears in exactly one of
 * the two maps — never in neither.
 *
 * Lists longer than the proxy's ceiling are sent in successive requests rather
 * than truncated: dropping the tail of a watchlist without saying so is the
 * silent omission this rewrite exists to remove.
 */
export async function fetchQuotes(symbols: readonly string[]): Promise<QuoteBatch> {
  const quotes = new Map<string, StockQuote>();
  const errors = new Map<string, string>();

  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const raw of symbols) {
    const symbol = cleanSymbol(raw);
    if (symbol === '' || seen.has(symbol)) continue;
    seen.add(symbol);

    const cached = quoteCache.get(symbol);
    if (cached && dependencies.now() - cached.storedAt < CACHE_TTL_MS) {
      quotes.set(symbol, cached.quote);
      continue;
    }
    wanted.push(symbol);
  }

  for (let i = 0; i < wanted.length; i += MAX_SYMBOLS_PER_REQUEST) {
    const batch = wanted.slice(i, i + MAX_SYMBOLS_PER_REQUEST);
    try {
      const response = await ensureFetch()('/api/quotes', {
        method: 'POST',
        headers: await authorizedHeaders(),
        body: JSON.stringify({ symbols: batch })
      });

      if (!response.ok) {
        const message = await describeFailure(response, 'Prices are unavailable right now');
        batch.forEach((symbol) => errors.set(symbol, message));
        continue;
      }

      const body: unknown = await response.json();
      const entries = isRecord(body) && Array.isArray(body.quotes) ? body.quotes : [];
      const answered = new Set<string>();

      for (const entry of entries) {
        if (!isRecord(entry)) continue;
        const symbol = readString(entry, 'symbol');
        if (symbol === null) continue;
        const key = cleanSymbol(symbol);
        answered.add(key);

        const failure = readString(entry, 'error');
        if (failure !== null) {
          errors.set(key, failure);
          continue;
        }
        const quote = toStockQuote(entry);
        if (!quote) {
          errors.set(key, `Couldn't read the price for ${key}`);
          continue;
        }
        quotes.set(key, quote);
        quoteCache.set(key, { quote, storedAt: dependencies.now() });
      }

      // A symbol we asked about and the endpoint said nothing about. Should not
      // happen — the proxy answers every symbol — but if it ever does, the user
      // is told rather than left watching a spinner.
      batch
        .filter((symbol) => !answered.has(symbol))
        .forEach((symbol) => errors.set(symbol, `No answer for ${symbol}`));
    } catch (error) {
      dependencies.logger.warn?.('Quote request failed', error);
      const message = 'Could not reach the price service';
      batch.forEach((symbol) => errors.set(symbol, message));
    }
  }

  return { quotes, errors };
}

/**
 * Instruments matching a free-text query — a ticker or a name.
 *
 * This is also what REPLACED symbol validation. The old `validateSymbol` asked
 * for a quote and read null as "no such symbol", so it rejected every ticker on
 * earth (the fetch could not succeed) and would still have rejected a real fund
 * that happens to have no price today. Picking a symbol from this lookup means
 * there is nothing left to validate: it came from the instrument list.
 *
 * Throws on an unavailable lookup, because "nothing matched" and "the lookup is
 * broken" are different answers and only one of them means the user's ticker
 * does not exist.
 */
export async function searchSymbols(query: string): Promise<SymbolMatch[]> {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const response = await ensureFetch()(`/api/quotes-search?q=${encodeURIComponent(trimmed)}`, {
    method: 'GET',
    headers: await authorizedHeaders()
  });

  if (!response.ok) {
    throw new Error(await describeFailure(response, 'Symbol lookup is unavailable'));
  }

  const body: unknown = await response.json();
  const rows = isRecord(body) && Array.isArray(body.matches) ? body.matches : [];

  const matches: SymbolMatch[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const symbol = readString(row, 'symbol');
    if (symbol === null) continue;
    matches.push({
      symbol: cleanSymbol(symbol),
      name: readString(row, 'name') ?? cleanSymbol(symbol),
      exchange: readString(row, 'exchange') ?? '',
      type: readString(row, 'type') ?? ''
    });
  }
  return matches;
}
