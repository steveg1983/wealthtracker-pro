import { getExchangeRates } from '../utils/currency';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { errorHandlingService, ErrorCategory, ErrorSeverity, retryWithBackoff } from './errorHandlingService';

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
 * Get stock quote from Yahoo Finance
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const cleanedSymbol = cleanSymbol(symbol);
    
    // Validate symbol
    if (!cleanedSymbol || cleanedSymbol.length > 10) {
      throw new Error('Invalid stock symbol');
    }
    
    // Check cache first
    const cached = quoteCache.get(cleanedSymbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached;
    }

    // Try to fetch with retry logic
    const quote = await retryWithBackoff(
      () => fetchQuoteFromEndpoints(cleanedSymbol),
      {
        maxRetries: 3,
        initialDelay: 500,
        onRetry: (attempt, error) => {
          console.warn(`Stock quote fetch attempt ${attempt} failed:`, error.message);
        }
      }
    );

    if (quote) {
      // Cache the result
      const cachedQuote: CachedQuote = {
        ...quote,
        timestamp: Date.now()
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
  
  // Try multiple endpoints for redundancy
  for (const endpoint of YAHOO_FINANCE_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}${symbol}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
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
        lastUpdated: new Date()
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
    console.error('Error converting stock price:', error);
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