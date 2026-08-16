import type { SymbolMatch } from './quotes.js';

/**
 * TWELVE DATA, for symbol search only.
 *
 * ─ WHY A SECOND PROVIDER AT ALL ────────────────────────────────────────────
 *
 * Yahoo's search is unkeyed, and it rate-limits by IP. A Vercel function shares
 * its egress IP with other customers, so the limit we hit is one we did not
 * spend — measured on 15 August: 429 from BOTH hosts and from Yahoo's own crumb
 * endpoint, while the app was making a handful of calls a day behind a 300ms
 * debounce and an hour of CDN cache.
 *
 * A key is the fix, not a bigger allowance: quota attached to US rather than to
 * whichever address the function happened to land on.
 *
 * ─ THE THING THAT MATTERS MOST HERE: SYMBOL FORMAT ─────────────────────────
 *
 * A symbol picked in search is stored on the holding and later priced by the
 * YAHOO quote path (`fetchQuote`, and the nightly cron). So a search result has
 * to be expressed in Yahoo's dialect or the holding silently never prices —
 * which is a worse outcome than search being down, because it looks like it
 * worked.
 *
 * Twelve Data answers `{ symbol: 'SHEL', exchange: 'LSE' }` where Yahoo wants
 * `SHEL.L`. `EXCHANGE_SUFFIX` is that translation, and it is deliberately a
 * SHORT list of exchanges this app's users actually hold rather than a complete
 * one: a wrong suffix produces a symbol that looks right and never prices.
 *
 * An unmapped exchange is DROPPED rather than returned. Offering somebody a
 * result that cannot price is the same offence as a dead toggle — it accepts
 * the choice and quietly fails afterwards. Both forms stay typeable by hand, so
 * dropping a result never blocks recording a holding.
 */

/** Twelve Data exchange (or MIC) → the suffix Yahoo wants. '' means none. */
const EXCHANGE_SUFFIX: Readonly<Record<string, string>> = {
  // The ones this app's users hold. US first: Yahoo takes these bare.
  NASDAQ: '',
  NYSE: '',
  'NYSE AMERICAN': '',
  'NYSE ARCA': '',
  BATS: '',
  OTC: '',
  // UK — the reason for the whole exercise.
  LSE: '.L',
  XLON: '.L',
  'LONDON STOCK EXCHANGE': '.L',
  // Ireland and the near continent, which a UK holder reaches often enough.
  EURONEXT: '.PA',
  XPAR: '.PA',
  XAMS: '.AS',
  XBRU: '.BR',
  XDUB: '.IR',
  XETR: '.DE',
  XETRA: '.DE',
  FSX: '.F',
  SIX: '.SW',
  XSWX: '.SW',
  XMIL: '.MI',
  BME: '.MC',
  // Further afield, where the mapping is unambiguous.
  TSX: '.TO',
  XTSE: '.TO',
  ASX: '.AX',
  XASX: '.AX',
  TSE: '.T',
  XTKS: '.T',
  HKEX: '.HK',
  XHKG: '.HK'
};

interface TwelveDataRow {
  symbol?: unknown;
  instrument_name?: unknown;
  exchange?: unknown;
  mic_code?: unknown;
  instrument_type?: unknown;
  country?: unknown;
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * The Yahoo-dialect symbol for a Twelve Data row, or null when this app cannot
 * price it. Exported for the test that pins the translation, because a wrong
 * suffix is invisible until a price fails to arrive weeks later.
 */
export function toYahooSymbol(row: {
  symbol: string;
  exchange: string;
  micCode: string;
}): string | null {
  const base = row.symbol.trim().toUpperCase();
  if (base === '') return null;
  // Already carries a suffix (some feeds do) — leave it alone rather than
  // appending a second one.
  if (base.includes('.')) return base;

  const byExchange = EXCHANGE_SUFFIX[row.exchange.trim().toUpperCase()];
  const byMic = EXCHANGE_SUFFIX[row.micCode.trim().toUpperCase()];
  const suffix = byExchange !== undefined ? byExchange : byMic;

  if (suffix === undefined) return null; // unmapped: cannot price it, so do not offer it
  return `${base}${suffix}`;
}

export interface TwelveDataOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Ticker/name lookup through Twelve Data.
 *
 * Throws on an unusable response for the same reason the Yahoo path does:
 * "nothing matched" and "the lookup is broken" are different answers, and
 * telling somebody their real ticker does not exist is the worse of the two.
 */
export async function searchSymbolsTwelveData(
  query: string,
  options: TwelveDataOptions
): Promise<SymbolMatch[]> {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const doFetch = options.fetchImpl ?? fetch;
  const url =
    'https://api.twelvedata.com/symbol_search' +
    `?symbol=${encodeURIComponent(trimmed)}` +
    `&outputsize=${options.limit ?? 10}`;

  // The key goes in a HEADER, never the query string: Vercel logs full URLs,
  // and a key in a log is a key that has leaked.
  const response = await doFetch(url, {
    headers: { Authorization: `apikey ${options.apiKey}`, Accept: 'application/json' },
    signal: options.signal
  });

  if (!response.ok) {
    const failure = new Error(`upstream returned ${response.status}`) as Error & {
      upstreamStatus?: number;
    };
    failure.upstreamStatus = response.status;
    throw failure;
  }

  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) return [];

  // Twelve Data answers 200 with `{ code, message }` for a bad key or an
  // exhausted plan. A 200 that is really an error must not read as "no
  // results" — that is the shape that tells somebody their ticker is fictional.
  const asRecord = body as { code?: unknown; message?: unknown; data?: unknown };
  if (typeof asRecord.code === 'number' && asRecord.code >= 400) {
    const failure = new Error(
      asString(asRecord.message) || `upstream returned ${asRecord.code}`
    ) as Error & { upstreamStatus?: number };
    failure.upstreamStatus = asRecord.code;
    throw failure;
  }

  const rows = Array.isArray(asRecord.data) ? asRecord.data : [];
  const matches: SymbolMatch[] = [];

  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as TwelveDataRow;

    const symbol = toYahooSymbol({
      symbol: asString(row.symbol),
      exchange: asString(row.exchange),
      micCode: asString(row.mic_code)
    });
    if (symbol === null) continue;

    matches.push({
      symbol,
      name: asString(row.instrument_name) || symbol,
      exchange: asString(row.exchange),
      type: asString(row.instrument_type)
    });
  }

  return matches;
}

/**
 * A PRICE from Twelve Data, for symbols that carry no exchange suffix.
 *
 * ─ WHY ONLY UNSUFFIXED SYMBOLS ─────────────────────────────────────────────
 *
 * Yahoo reports LSE equities in PENCE and labels them `GBp`, and `fetchQuote`
 * divides by a hundred on that label. Whether Twelve Data does the same — and
 * more importantly whether it LABELS pence as pence — cannot be established
 * from the documentation, and a provider that returns 3277.5 while calling it
 * `GBP` would make every UK holding a hundred times too valuable, silently, in
 * a ledger measured in millions.
 *
 * So this handles the case where that question does not arise: a bare `AAPL`
 * with no suffix, priced in USD. Everything with a suffix — `.L`, `.DE`, `.TO`
 * — stays on Yahoo, which this app has already reconciled against real
 * statements.
 *
 * That is not a permanent answer, it is the honest one until somebody prices a
 * known UK share through both and compares. When that is done, the guard is one
 * condition in `fetchQuoteVia`.
 *
 * ─ THE UNIT IS STILL READ FROM THE RESPONSE ────────────────────────────────
 *
 * Not assumed to be major. The caller passes what this returns through the
 * same `MINOR_UNIT_CURRENCIES` table Yahoo's answers go through, so a provider
 * that does say `GBp` is handled correctly the moment the suffix guard is
 * lifted.
 */
export interface TwelveDataQuote {
  symbol: string;
  price: string;
  currency: string;
  previousClose?: string;
  name?: string;
  asOf: string;
}

const asNumericString = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (text === '' || !Number.isFinite(Number(text))) return null;
  return text;
};

/** True when a symbol names no exchange, i.e. Yahoo's bare US form. */
export function isUnsuffixedSymbol(symbol: string): boolean {
  return !symbol.includes('.');
}

export async function fetchQuoteTwelveData(
  symbol: string,
  options: TwelveDataOptions
): Promise<TwelveDataQuote | null> {
  const doFetch = options.fetchImpl ?? fetch;
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}`;

  const response = await doFetch(url, {
    headers: { Authorization: `apikey ${options.apiKey}`, Accept: 'application/json' },
    signal: options.signal
  });

  if (!response.ok) {
    const failure = new Error(`upstream returned ${response.status}`) as Error & {
      upstreamStatus?: number;
    };
    failure.upstreamStatus = response.status;
    throw failure;
  }

  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) return null;

  // A 200 carrying `{ code, message }` is a failure — a bad key, or the daily
  // ceiling. Reading it as "no price" would show a stale figure as current.
  const row = body as {
    code?: unknown; message?: unknown; symbol?: unknown; name?: unknown;
    close?: unknown; previous_close?: unknown; currency?: unknown; datetime?: unknown;
  };
  if (typeof row.code === 'number' && row.code >= 400) {
    const failure = new Error(
      asString(row.message) || `upstream returned ${row.code}`
    ) as Error & { upstreamStatus?: number };
    failure.upstreamStatus = row.code;
    throw failure;
  }

  const price = asNumericString(row.close);
  const currency = asString(row.currency);
  // No price or no currency is NOT an error to report as a price of zero.
  if (price === null || currency === '') return null;

  const previous = asNumericString(row.previous_close);
  const day = asString(row.datetime);

  return {
    symbol,
    price,
    currency,
    ...(previous === null ? {} : { previousClose: previous }),
    ...(asString(row.name) === '' ? {} : { name: asString(row.name) }),
    // `datetime` is the exchange's day for an EOD quote. Kept as an ISO
    // instant, as QuoteSuccess.asOf promises.
    asOf: day === '' ? new Date().toISOString() : new Date(`${day}T00:00:00Z`).toISOString()
  };
}
