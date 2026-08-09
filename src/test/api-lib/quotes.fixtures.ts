/**
 * Recorded Yahoo `/v8/finance/chart` and `/v1/finance/search` shapes.
 *
 * These are PUBLIC MARKET DATA for public tickers — no personal data of any
 * kind. They are trimmed to the `meta` fields api/_lib/quotes.ts reads (the
 * live responses also carry timestamp/indicator arrays hundreds of entries
 * long, which this module never looks at).
 *
 * The three cases exist because they are the three units Yahoo will hand us,
 * and getting them confused is a 100x error in someone's net worth:
 *
 *   SHEL.L   LSE ordinary share  ->  "currency": "GBp"  (PENCE)
 *   VUSA.L   LSE-listed ETF      ->  "currency": "GBP"  (POUNDS)
 *   AAPL     Nasdaq share        ->  "currency": "USD"
 *
 * The first two are the same exchange and the same `.L` suffix. Nothing but
 * meta.currency — one character of case — distinguishes them.
 */

/** SHEL.L: quoted in pence. 3277.5 GBp is £32.775, not £3,277.50. */
export const SHELL_LSE_GBP_PENCE = {
  chart: {
    result: [
      {
        meta: {
          currency: 'GBp',
          symbol: 'SHEL.L',
          exchangeName: 'LSE',
          fullExchangeName: 'LSE',
          instrumentType: 'EQUITY',
          regularMarketTime: 1_754_668_800,
          regularMarketPrice: 3277.5,
          chartPreviousClose: 3260,
          previousClose: 3260,
          longName: 'Shell plc',
          shortName: 'SHELL PLC',
          priceHint: 2
        }
      }
    ],
    error: null
  }
} as const;

/** VUSA.L: an ETF on the SAME exchange, quoted in POUNDS. Must not be divided. */
export const VANGUARD_LSE_GBP_POUNDS = {
  chart: {
    result: [
      {
        meta: {
          currency: 'GBP',
          symbol: 'VUSA.L',
          exchangeName: 'LSE',
          fullExchangeName: 'LSE',
          instrumentType: 'ETF',
          regularMarketTime: 1_754_668_800,
          regularMarketPrice: 95.42,
          chartPreviousClose: 94.88,
          previousClose: 94.88,
          longName: 'Vanguard S&P 500 UCITS ETF',
          shortName: 'VANGUARD S&P 500 UCITS ETF',
          priceHint: 2
        }
      }
    ],
    error: null
  }
} as const;

/** AAPL: plain USD, the case that already worked. */
export const APPLE_NASDAQ_USD = {
  chart: {
    result: [
      {
        meta: {
          currency: 'USD',
          symbol: 'AAPL',
          exchangeName: 'NMS',
          fullExchangeName: 'NasdaqGS',
          instrumentType: 'EQUITY',
          regularMarketTime: 1_754_683_200,
          regularMarketPrice: 231.59,
          chartPreviousClose: 229.35,
          previousClose: 229.35,
          longName: 'Apple Inc.',
          shortName: 'Apple Inc.',
          priceHint: 2
        }
      }
    ],
    error: null
  }
} as const;

/** What Yahoo sends for a ticker that does not exist (with HTTP 404). */
export const SYMBOL_NOT_FOUND = {
  chart: {
    result: null,
    error: {
      code: 'Not Found',
      description: 'No data found, symbol may be delisted'
    }
  }
} as const;

/** A UK OEIC fund: prices in POUNDS and carries no regularMarketTime. */
export const UK_OEIC_FUND_NO_MARKET_TIME = {
  chart: {
    result: [
      {
        meta: {
          currency: 'GBP',
          symbol: '0P0000KSPA.L',
          exchangeName: 'LSE',
          instrumentType: 'MUTUALFUND',
          regularMarketPrice: 3.4271,
          longName: 'Vanguard LifeStrategy 60% Equity Fund A Acc'
        }
      }
    ],
    error: null
  }
} as const;

/** Trimmed `/v1/finance/search?q=shell` response. */
export const SEARCH_SHELL = {
  count: 3,
  quotes: [
    {
      exchange: 'LSE',
      shortname: 'SHELL PLC',
      quoteType: 'EQUITY',
      symbol: 'SHEL.L',
      typeDisp: 'Equity',
      longname: 'Shell plc',
      exchDisp: 'London',
      isYahooFinance: true
    },
    {
      exchange: 'NYQ',
      shortname: 'Shell PLC American Depositary S',
      quoteType: 'EQUITY',
      symbol: 'SHEL',
      typeDisp: 'Equity',
      longname: 'Shell plc',
      exchDisp: 'NYSE',
      isYahooFinance: true
    },
    {
      // A news/industry row with no symbol: must be dropped, not rendered.
      index: 'industries',
      industryName: 'Oil & Gas Integrated'
    }
  ],
  news: []
} as const;
