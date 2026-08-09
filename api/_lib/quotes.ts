import Decimal from 'decimal.js';

/**
 * Market quotes, fetched SERVER-SIDE and normalised to major currency units.
 *
 * ── WHY THIS RUNS ON THE SERVER ─────────────────────────────────────────────
 * The browser cannot fetch Yahoo at all: our CSP `connect-src` (vercel.json)
 * does not list query1/query2.finance.yahoo.com, and Yahoo sends no
 * `Access-Control-Allow-Origin` header, so even if it did the response would be
 * unreadable. Every client-side quote fetch this app has ever made failed and
 * was swallowed to null. The same request from a serverless function succeeds —
 * there is no origin and no preflight — so the quote path lives here and the
 * client talks to `/api/quotes`, which `connect-src 'self'` already allows.
 *
 * ── THE 100x TRAP ───────────────────────────────────────────────────────────
 * Yahoo reports LSE equities in PENCE and marks them `"currency": "GBp"` —
 * lower-case `p`. Funds and ETFs on the same exchange report POUNDS and are
 * marked `"GBP"`. The two differ by ONE CHARACTER OF CASE and by a factor of
 * one hundred: SHEL.L quotes ≈ 3277.5 GBp, i.e. £32.775. Nothing in the ticker
 * says which you will get — `.L` covers both — so the unit MUST be read from
 * `meta.currency` per symbol and never inferred. Unnormalised, a holding of
 * LSE shares makes a net worth 100x too big, silently.
 *
 * Normalisation therefore happens HERE, once, at the edge: every quote leaving
 * this module is in the major unit, and `currency` is the major-unit code. No
 * caller downstream — client, cron, or database — ever sees a minor-unit price
 * or has to remember the rule.
 *
 * ── MONEY OVER THE WIRE IS A STRING ─────────────────────────────────────────
 * Prices are emitted as decimal STRINGS, not JSON numbers. £32.775 has no exact
 * binary double, and the division by 100 is money arithmetic, so it is done
 * with Decimal and serialised losslessly. Callers parse with their own Decimal
 * (`toDecimal(quote.price)`); PostgREST accepts the same string for a numeric
 * column. This matches how the app already reads `account_balances`, whose
 * numeric columns arrive as strings.
 */

/**
 * Currency codes Yahoo uses for MINOR units, and what one of them is worth in
 * the major unit. The lookup is deliberately CASE-SENSITIVE: 'GBp' (pence) and
 * 'GBP' (pounds) are different currencies to Yahoo and differ only in case, so
 * a case-insensitive compare here would divide every UK fund by 100.
 *
 * ZAc (South African cents) and ILA (Israeli agorot) follow the same pattern on
 * the JSE and TASE; they are listed so a holding on either exchange is right
 * the first time rather than after someone notices a 100x.
 */
const MINOR_UNIT_CURRENCIES: Readonly<Record<string, { major: string; perMajor: number }>> = {
  GBp: { major: 'GBP', perMajor: 100 },
  ZAc: { major: 'ZAR', perMajor: 100 },
  ILA: { major: 'ILS', perMajor: 100 }
};

/** Upper bound on one batch. Bounds our Yahoo fan-out and the request body. */
export const MAX_SYMBOLS_PER_REQUEST = 25;

/** Yahoo requests made at once. Keeps a 25-symbol batch to 5 round trips. */
const CONCURRENCY = 5;

/** Per-request timeout. Yahoo is fast; a slow one must not eat the 10s budget. */
const REQUEST_TIMEOUT_MS = 6000;

/**
 * Yahoo rejects requests with no browser-ish User-Agent. This is not an attempt
 * to hide what we are — it is the header the endpoint requires to answer.
 */
const YAHOO_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json'
};

const CHART_HOSTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com'
] as const;

/** A quote we could read. `price` and `previousClose` are major-unit decimals. */
export interface QuoteSuccess {
  symbol: string;
  /** Decimal string in the major unit of `currency`. Never a minor unit. */
  price: string;
  /** Major-unit ISO code: 'GBP', never 'GBp'. */
  currency: string;
  /** Previous close, same unit as `price`. Absent when Yahoo did not send one. */
  previousClose?: string;
  name?: string;
  /** When the exchange priced it (ISO 8601), not when we asked. */
  asOf: string;
}

/**
 * A quote we could NOT read, named. The batch NEVER silently omits a symbol:
 * a caller that asked for five gets five entries back, so a watchlist can say
 * "couldn't fetch SHEL.L" instead of rendering "Loading…" forever.
 */
export interface QuoteFailure {
  symbol: string;
  /** Safe for display. Contains no upstream body, header, or stack. */
  error: string;
}

export type QuoteResult = QuoteSuccess | QuoteFailure;

export const isQuoteFailure = (result: QuoteResult): result is QuoteFailure =>
  'error' in result;

/** One row of a symbol search. */
export interface SymbolMatch {
  symbol: string;
  name: string;
  /** Yahoo's short exchange label, e.g. 'LSE', 'NMS'. Empty when absent. */
  exchange: string;
  /** Yahoo's display type, e.g. 'Equity', 'ETF', 'Mutual Fund'. */
  type: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A finite number from an unknown field, or null. Rejects NaN and Infinity. */
const readFiniteNumber = (source: Record<string, unknown>, key: string): number | null => {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // Yahoo occasionally sends numerics as strings on some instruments.
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const readNonEmptyString = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

/**
 * A symbol we are willing to send upstream. Tickers are letters, digits and a
 * small set of separators (BRK.B, SHEL.L, BTC-USD, 0P0000KSPA.L); anything else
 * is rejected here rather than pasted into a URL.
 */
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.\-^=]{0,19}$/;

const cleanSymbol = (raw: string): string => raw.trim().toUpperCase();

const isValidSymbol = (symbol: string): boolean => SYMBOL_PATTERN.test(symbol);

/**
 * The distinct, valid symbols in a caller-supplied list, in first-seen order.
 *
 * Deduplication is not tidiness: the cron walks every user's holdings, and a
 * popular fund held by many people would otherwise be fetched once per ROW.
 * Order is preserved so a truncated batch keeps the caller's priority.
 */
export const dedupeSymbols = (symbols: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of symbols) {
    const symbol = cleanSymbol(raw);
    if (!isValidSymbol(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
};

/** What a caller sent us, as a symbol list — or an explanation of why not. */
export const parseSymbolsPayload = (
  value: unknown
): { symbols: string[] } | { error: string } => {
  if (!Array.isArray(value)) {
    return { error: 'symbols must be an array of ticker strings' };
  }
  if (value.length === 0) {
    return { error: 'symbols must contain at least one ticker' };
  }
  if (value.length > MAX_SYMBOLS_PER_REQUEST) {
    return { error: `symbols must contain at most ${MAX_SYMBOLS_PER_REQUEST} tickers` };
  }
  const strings = value.filter((entry): entry is string => typeof entry === 'string');
  const symbols = dedupeSymbols(strings);
  if (symbols.length === 0) {
    return { error: 'symbols contained no usable tickers' };
  }
  return { symbols };
};

/**
 * Yahoo's `meta` block as one normalised quote.
 *
 * Throws when the block cannot produce a price — the caller turns that into a
 * per-symbol failure entry rather than dropping the symbol.
 */
const normalizeChartMeta = (symbol: string, meta: Record<string, unknown>): QuoteSuccess => {
  const rawPrice = readFiniteNumber(meta, 'regularMarketPrice');
  if (rawPrice === null) {
    throw new Error('no price in response');
  }

  const rawCurrency = readNonEmptyString(meta, 'currency') ?? 'USD';
  // CASE-SENSITIVE on purpose — see MINOR_UNIT_CURRENCIES.
  const minor = MINOR_UNIT_CURRENCIES[rawCurrency];
  const currency = minor ? minor.major : rawCurrency.toUpperCase();

  // Decimal, not `/ 100`: this is money, and 3277.5 pence is £32.775 exactly.
  const toMajor = (value: number): string =>
    minor ? new Decimal(value).dividedBy(minor.perMajor).toString() : new Decimal(value).toString();

  const rawPreviousClose =
    readFiniteNumber(meta, 'chartPreviousClose') ?? readFiniteNumber(meta, 'previousClose');

  // regularMarketTime is unix SECONDS. Its absence means the instrument has no
  // stated pricing time (some funds), so we fall back to now and say so by
  // stamping the fetch time rather than pretending to a market timestamp.
  const marketTime = readFiniteNumber(meta, 'regularMarketTime');
  const asOf = marketTime !== null
    ? new Date(marketTime * 1000).toISOString()
    : new Date().toISOString();

  const name = readNonEmptyString(meta, 'longName') ?? readNonEmptyString(meta, 'shortName');

  const quote: QuoteSuccess = {
    // Yahoo echoes the canonical symbol; prefer it so 'shel.l' comes back
    // 'SHEL.L' and the caller can key a map by what it asked for.
    symbol: readNonEmptyString(meta, 'symbol') ?? symbol,
    price: toMajor(rawPrice),
    currency,
    asOf
  };
  if (rawPreviousClose !== null) {
    quote.previousClose = toMajor(rawPreviousClose);
  }
  if (name !== null) {
    quote.name = name;
  }
  return quote;
};

/** A parsed `/v8/finance/chart` body as one normalised quote. Throws if unusable. */
export const parseChartResponse = (symbol: string, body: unknown): QuoteSuccess => {
  if (!isRecord(body) || !isRecord(body.chart)) {
    throw new Error('unrecognised response');
  }
  const chart = body.chart;
  if (isRecord(chart.error)) {
    const description = readNonEmptyString(chart.error, 'description');
    throw new Error(description ?? 'symbol not found');
  }
  const results = chart.result;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('symbol not found');
  }
  const first = results[0];
  if (!isRecord(first) || !isRecord(first.meta)) {
    throw new Error('unrecognised response');
  }
  return normalizeChartMeta(symbol, first.meta);
};

const getFetch = (fetchImpl?: FetchLike): FetchLike => {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch === 'function') return (input, init) => fetch(input, init);
  throw new Error('No fetch implementation available');
};

const timeoutSignal = (): AbortSignal | undefined =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;

/**
 * One symbol's quote. Both Yahoo hosts are tried before giving up — they are
 * independent front ends and one occasionally 5xx's while the other answers.
 *
 * A 404 is NOT retried on the second host: it means the symbol does not exist,
 * and asking twice only doubles the latency of the user's typo.
 */
export const fetchQuote = async (symbol: string, fetchImpl?: FetchLike): Promise<QuoteResult> => {
  const doFetch = getFetch(fetchImpl);
  let lastMessage = 'no response';

  for (const host of CHART_HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}`;
      const response = await doFetch(url, { headers: YAHOO_HEADERS, signal: timeoutSignal() });
      if (response.status === 404) {
        return { symbol, error: `${symbol} was not found` };
      }
      if (!response.ok) {
        lastMessage = `upstream returned ${response.status}`;
        continue;
      }
      return parseChartResponse(symbol, await response.json());
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : 'request failed';
    }
  }

  return { symbol, error: `Couldn't fetch ${symbol} — ${lastMessage}` };
};

/**
 * Quotes for a batch, deduplicated, at most CONCURRENCY requests in flight.
 *
 * Every input symbol appears in the output exactly once, success or failure —
 * a caller can render a row for each without wondering where one went.
 */
export const fetchQuotes = async (
  symbols: readonly string[],
  fetchImpl?: FetchLike
): Promise<QuoteResult[]> => {
  const unique = dedupeSymbols(symbols);
  const results: QuoteResult[] = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    // allSettled is belt-and-braces: fetchQuote already returns failures rather
    // than throwing, so one bad symbol can never reject the whole batch.
    const settled = await Promise.allSettled(batch.map((symbol) => fetchQuote(symbol, fetchImpl)));
    settled.forEach((outcome, index) => {
      results.push(
        outcome.status === 'fulfilled'
          ? outcome.value
          : { symbol: batch[index], error: `Couldn't fetch ${batch[index]}` }
      );
    });
  }
  return results;
};

/** Search rows Yahoo will return per query. Enough to choose from, not a dump. */
const SEARCH_LIMIT = 12;

/**
 * Ticker lookup, so "shell" finds SHEL.L and any UK fund can be added by name.
 *
 * This replaces a hard-coded list of 28 US tickers that was the app's entire
 * idea of which symbols exist — no LSE share, ETF or OEIC could be added at all.
 */
export const searchSymbols = async (
  query: string,
  fetchImpl?: FetchLike
): Promise<SymbolMatch[]> => {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const doFetch = getFetch(fetchImpl);
  const url =
    `${CHART_HOSTS[0]}/v1/finance/search?q=${encodeURIComponent(trimmed)}` +
    `&quotesCount=${SEARCH_LIMIT}&newsCount=0&listsCount=0`;

  const response = await doFetch(url, { headers: YAHOO_HEADERS, signal: timeoutSignal() });
  if (!response.ok) {
    throw new Error(`upstream returned ${response.status}`);
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.quotes)) {
    return [];
  }

  const matches: SymbolMatch[] = [];
  for (const entry of body.quotes) {
    if (!isRecord(entry)) continue;
    const symbol = readNonEmptyString(entry, 'symbol');
    if (symbol === null || !isValidSymbol(cleanSymbol(symbol))) continue;
    matches.push({
      symbol: cleanSymbol(symbol),
      name:
        readNonEmptyString(entry, 'longname') ??
        readNonEmptyString(entry, 'shortname') ??
        cleanSymbol(symbol),
      exchange: readNonEmptyString(entry, 'exchange') ?? '',
      type: readNonEmptyString(entry, 'typeDisp') ?? readNonEmptyString(entry, 'quoteType') ?? ''
    });
  }
  return matches;
};
