import { getExchangeRates } from '../utils/currency';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { errorHandlingService, ErrorCategory, ErrorSeverity, retryWithBackoff } from './errorHandlingService';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Logger = Pick<Console, 'warn' | 'error'>;

interface StockPriceDependencies {
  fetch?: FetchLike | null;
  locationSearch?: () => string;
  now?: () => number;
  timeoutSignal?: (ms: number) => AbortSignal | null;
  logger?: Logger;
}

interface NormalizedDependencies {
  fetch: FetchLike | null;
  locationSearch: () => string;
  now: () => number;
  timeoutSignal: (ms: number) => AbortSignal | null;
  logger: Logger;
}

export interface StockQuote {
  symbol: string;
  price: DecimalInstance;
  currency: string;
  change: DecimalInstance;
  changePercent: DecimalInstance;
  previousClose: DecimalInstance;
  marketCap?: DecimalInstance;
  volume?: number;
  dayHigh?: DecimalInstance;
  dayLow?: DecimalInstance;
  fiftyTwoWeekHigh?: DecimalInstance;
  fiftyTwoWeekLow?: DecimalInstance;
  name?: string;
  exchange?: string;
  lastUpdated: Date;
}

interface CachedQuote extends StockQuote {
  timestamp: number;
}

// Cache for stock quotes (1 minute TTL)
const quoteCache = new Map<string, CachedQuote>();
const CACHE_TTL = 60 * 1000; // 1 minute

let dependencies: NormalizedDependencies = getDefaultDependencies();

function getDefaultDependencies(): NormalizedDependencies {
  const globalFetch = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null;
  const logger = typeof console !== 'undefined' ? console : { warn: () => {}, error: () => {} };
  const locationSearch = () => {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.search ?? '';
    }
    return '';
  };
  const timeoutSignal = (ms: number) => {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    return null;
  };
  return {
    fetch: globalFetch,
    locationSearch,
    now: () => Date.now(),
    timeoutSignal,
    logger
  };
}

export function configureStockPriceService(overrides: StockPriceDependencies = {}): void {
  dependencies = {
    ...dependencies,
    ...(overrides.fetch !== undefined ? { fetch: overrides.fetch } : {}),
    ...(overrides.locationSearch ? { locationSearch: overrides.locationSearch } : {}),
    ...(overrides.now ? { now: overrides.now } : {}),
    ...(overrides.timeoutSignal ? { timeoutSignal: overrides.timeoutSignal } : {}),
    ...(overrides.logger ? { logger: overrides.logger } : {})
  }; // apply overrides
}

export function resetStockPriceService(): void {
  dependencies = getDefaultDependencies();
  quoteCache.clear();
}

// Yahoo Finance API proxy endpoints
// Note: Using proxy services as Yahoo Finance doesn't have official API
const YAHOO_FINANCE_ENDPOINTS = [
  'https://query1.finance.yahoo.com/v8/finance/chart/',
  'https://query2.finance.yahoo.com/v8/finance/chart/'
];

/**
 * Clean and validate stock symbol
 */
function cleanSymbol(symbol: string): string {
  return symbol.toUpperCase().trim();
}

/**
 * Generate mock stock data for demo mode
 */
function generateMockStockQuote(symbol: string): StockQuote {
  // Generate realistic but fake stock prices
  const mockData: Record<string, { price: number; name: string; change: number }> = {
    'AAPL': { price: 189.50, name: 'Apple Inc.', change: 2.34 },
    'GOOGL': { price: 142.75, name: 'Alphabet Inc.', change: -1.12 },
    'MSFT': { price: 378.20, name: 'Microsoft Corporation', change: 4.56 },
    'AMZN': { price: 156.80, name: 'Amazon.com Inc.', change: 1.89 },
    'TSLA': { price: 245.30, name: 'Tesla Inc.', change: -5.67 },
    'META': { price: 512.40, name: 'Meta Platforms Inc.', change: 3.21 },
    'NVDA': { price: 723.90, name: 'NVIDIA Corporation', change: 12.45 },
    'BRK.B': { price: 367.50, name: 'Berkshire Hathaway Inc.', change: 0.98 },
    'JPM': { price: 195.60, name: 'JPMorgan Chase & Co.', change: 2.10 },
    'V': { price: 276.30, name: 'Visa Inc.', change: 1.45 }
  };

  const defaultMock = {
    price: 100 + Math.random() * 400,
    name: `${symbol} Corp.`,
    change: (Math.random() - 0.5) * 10
  };

  const data = mockData[symbol.toUpperCase()] || defaultMock;
  const price = toDecimal(data.price);
  const change = toDecimal(data.change);
  const changePercent = price.greaterThan(0) ? change.dividedBy(price.minus(change)).times(100) : toDecimal(0);
  const previousClose = price.minus(change);

  return {
    symbol: symbol.toUpperCase(),
    price,
    currency: 'USD',
    change,
    changePercent,
    previousClose,
    marketCap: price.times(toDecimal(Math.random() * 1000000000 + 100000000)),
    volume: Math.floor(Math.random() * 50000000 + 1000000),
    dayHigh: price.times(toDecimal(1 + Math.random() * 0.02)),
    dayLow: price.times(toDecimal(1 - Math.random() * 0.02)),
    fiftyTwoWeekHigh: price.times(toDecimal(1.2 + Math.random() * 0.3)),
    fiftyTwoWeekLow: price.times(toDecimal(0.5 + Math.random() * 0.3)),
    name: data.name,
    exchange: 'NASDAQ',
    lastUpdated: getCurrentDate()
  };
}

/**
 * Get stock quote from Yahoo Finance
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const cleanedSymbol = cleanSymbol(symbol);
    
    // Validate symbol
    if (!cleanedSymbol || cleanedSymbol.length > 10) {
      throw new Error('Invalid stock symbol');
    }

    // Check if we're in demo mode
    const urlParams = new URLSearchParams(dependencies.locationSearch());
    const isDemoMode = urlParams.get('demo') === 'true';
    
    if (isDemoMode) {
      // Return mock data for demo mode
      return generateMockStockQuote(cleanedSymbol);
    }
    
    // Check cache first
    const cached = quoteCache.get(cleanedSymbol);
    if (cached && dependencies.now() - cached.timestamp < CACHE_TTL) {
      return cached;
    }

    // Try to fetch with retry logic
    const quote = await retryWithBackoff(
      () => fetchQuoteFromEndpoints(cleanedSymbol),
      {
        maxRetries: 3,
        initialDelay: 500,
        onRetry: (attempt, error) => {
          dependencies.logger.warn?.(`Stock quote fetch attempt ${attempt} failed:`, error.message);
        }
      }
    );

    if (quote) {
      // Cache the result
      const cachedQuote: CachedQuote = {
        ...quote,
        timestamp: dependencies.now()
      };
      quoteCache.set(cleanedSymbol, cachedQuote);
    }

    return quote;
  } catch (error) {
    errorHandlingService.handleError(error as Error, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.LOW,
      context: { symbol },
      userMessage: `Unable to fetch quote for ${symbol}. Please try again later.`,
      retryable: true
    });
    return null;
  }
}

/**
 * Fetch quote from available endpoints
 */
async function fetchQuoteFromEndpoints(symbol: string): Promise<StockQuote | null> {
  const errors: Error[] = [];
  const fetchImpl = ensureFetch();
  
  // Try multiple endpoints for redundancy
  for (const endpoint of YAHOO_FINANCE_ENDPOINTS) {
    try {
      const response = await fetchImpl(`${endpoint}${symbol}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: dependencies.timeoutSignal(5000) ?? undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const quote = data.chart?.result?.[0];
      
      if (!quote || !quote.meta) {
        throw new Error('Invalid response format');
      }

      const meta = quote.meta;
      const regularMarketPrice = meta.regularMarketPrice;
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      
      if (!regularMarketPrice || !previousClose) {
        throw new Error('Missing price data');
      }
      
      const price = toDecimal(regularMarketPrice);
      const prevClose = toDecimal(previousClose);
      const change = price.minus(prevClose);
      const changePercent = prevClose.greaterThan(0) ? change.dividedBy(prevClose).times(100) : toDecimal(0);

      const stockQuote: StockQuote = {
        symbol: symbol,
        price: price,
        currency: meta.currency || 'USD',
        change: change,
        changePercent: changePercent,
        previousClose: prevClose,
        marketCap: meta.marketCap ? toDecimal(meta.marketCap) : undefined,
        volume: meta.regularMarketVolume,
        dayHigh: meta.regularMarketDayHigh ? toDecimal(meta.regularMarketDayHigh) : undefined,
        dayLow: meta.regularMarketDayLow ? toDecimal(meta.regularMarketDayLow) : undefined,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ? toDecimal(meta.fiftyTwoWeekHigh) : undefined,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ? toDecimal(meta.fiftyTwoWeekLow) : undefined,
        name: meta.longName || meta.shortName,
        exchange: meta.exchangeName,
        lastUpdated: getCurrentDate()
      };

      return stockQuote;
    } catch (error) {
      errors.push(error as Error);
      continue;
    }
  }

  // All endpoints failed
  if (errors.length > 0) {
    throw new Error(`All endpoints failed: ${errors.map(e => e.message).join(', ')}`);
  }
  
  return null;
}


/**
 * Get multiple stock quotes in parallel with error handling
 */
export async function getMultipleStockQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
  try {
    const quotes = new Map<string, StockQuote>();
    
    // Validate input
    if (!symbols || symbols.length === 0) {
      return quotes;
    }
    
    // Limit concurrent requests
    const MAX_CONCURRENT = 5;
    const results: Array<{ symbol: string; quote: StockQuote | null }> = [];
    
    for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
      const batch = symbols.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map(async (symbol) => ({
        symbol,
        quote: await getStockQuote(symbol)
      }));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.quote) {
          quotes.set(result.value.symbol, result.value.quote);
        }
      });
    }
    
    return quotes;
  } catch (error) {
    errorHandlingService.handleError(error as Error, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      context: { symbols },
      userMessage: 'Failed to fetch stock quotes. Please try again later.'
    });
    return new Map();
  }
}

/**
 * Convert stock price to base currency
 */
export async function convertStockPrice(
  price: DecimalInstance,
  stockCurrency: string,
  baseCurrency: string
): Promise<DecimalInstance> {
  if (stockCurrency === baseCurrency) {
    return price;
  }

  try {
    const rates = await getExchangeRates();
    
    // Convert to GBP first (as base), then to target currency
    const priceInGBP = stockCurrency === 'GBP' 
      ? price 
      : price.dividedBy(toDecimal(rates[stockCurrency] || 1));
    
    const priceInBaseCurrency = baseCurrency === 'GBP'
      ? priceInGBP
      : priceInGBP.times(toDecimal(rates[baseCurrency] || 1));

    return priceInBaseCurrency;
  } catch (error) {
    dependencies.logger.error('Error converting stock price:', error as Error);
    return price; // Return original price if conversion fails
  }
}

/**
 * Calculate portfolio metrics with live prices
 */
export interface PortfolioMetrics {
  totalValue: DecimalInstance;
  totalCost: DecimalInstance;
  totalGain: DecimalInstance;
  totalGainPercent: DecimalInstance;
  holdings: Array<{
    symbol: string;
    name: string;
    shares: DecimalInstance;
    averageCost: DecimalInstance;
    currentPrice: DecimalInstance;
    marketValue: DecimalInstance;
    gain: DecimalInstance;
    gainPercent: DecimalInstance;
    allocation: DecimalInstance;
    currency: string;
  }>;
}

export async function calculatePortfolioMetrics(
  holdings: Array<{ symbol: string; shares: DecimalInstance; averageCost: DecimalInstance }>,
  baseCurrency: string
): Promise<PortfolioMetrics> {
  const symbols = holdings.map(h => h.symbol);
  const quotes = await getMultipleStockQuotes(symbols);
  
  let totalValue = toDecimal(0);
  let totalCost = toDecimal(0);
  
  const enhancedHoldings = await Promise.all(holdings.map(async (holding) => {
    const quote = quotes.get(holding.symbol);
    const currentPrice = quote?.price || holding.averageCost;
    const currency = quote?.currency || baseCurrency;
    
    // Convert prices to base currency
    const convertedPrice = await convertStockPrice(currentPrice, currency, baseCurrency);
    const convertedCost = await convertStockPrice(holding.averageCost, currency, baseCurrency);
    
    const marketValue = convertedPrice.times(holding.shares);
    const costBasis = convertedCost.times(holding.shares);
    const gain = marketValue.minus(costBasis);
    const gainPercent = costBasis.greaterThan(0) ? gain.dividedBy(costBasis).times(100) : toDecimal(0);
    
    totalValue = totalValue.plus(marketValue);
    totalCost = totalCost.plus(costBasis);
    
    return {
      symbol: holding.symbol,
      name: quote?.name || holding.symbol,
      shares: holding.shares,
      averageCost: holding.averageCost,
      currentPrice: currentPrice,
      marketValue: marketValue,
      gain: gain,
      gainPercent: gainPercent,
      allocation: toDecimal(0), // Will be calculated after total
      currency: currency
    };
  }));
  
  // Calculate allocations
  enhancedHoldings.forEach(holding => {
    holding.allocation = totalValue.greaterThan(0) ? holding.marketValue.dividedBy(totalValue).times(100) : toDecimal(0);
  });
  
  const totalGain = totalValue.minus(totalCost);
  const totalGainPercent = totalCost.greaterThan(0) ? totalGain.dividedBy(totalCost).times(100) : toDecimal(0);
  
  return {
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
    holdings: enhancedHoldings
  };
}

/**
 * Clear quote cache
 */
export function clearQuoteCache(): void {
  quoteCache.clear();
}

/**
 * Validate if a symbol exists
 */
export async function validateSymbol(symbol: string): Promise<boolean> {
  const quote = await getStockQuote(symbol);
  return quote !== null;
}

function ensureFetch(): FetchLike {
  if (!dependencies.fetch) {
    throw new Error('Fetch API is not available. Provide a fetch implementation via configureStockPriceService.');
  }
  return dependencies.fetch;
}

function getCurrentDate(): Date {
  return new Date(dependencies.now());
}
