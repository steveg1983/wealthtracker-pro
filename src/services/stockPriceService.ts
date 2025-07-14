import { getExchangeRates } from '../utils/currency';

interface StockQuote {
  symbol: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  previousClose: number;
  marketCap?: number;
  volume?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
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
  const cleanedSymbol = cleanSymbol(symbol);
  
  // Check cache first
  const cached = quoteCache.get(cleanedSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }

  try {
    // Try multiple endpoints for redundancy
    for (const endpoint of YAHOO_FINANCE_ENDPOINTS) {
      try {
        const response = await fetch(`${endpoint}${cleanedSymbol}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) continue;

        const data = await response.json();
        const quote = data.chart?.result?.[0];
        
        if (!quote) continue;

        const meta = quote.meta;
        const regularMarketPrice = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || meta.previousClose;
        
        const stockQuote: StockQuote = {
          symbol: cleanedSymbol,
          price: regularMarketPrice,
          currency: meta.currency || 'USD',
          change: regularMarketPrice - previousClose,
          changePercent: ((regularMarketPrice - previousClose) / previousClose) * 100,
          previousClose: previousClose,
          marketCap: meta.marketCap,
          volume: meta.regularMarketVolume,
          dayHigh: meta.regularMarketDayHigh,
          dayLow: meta.regularMarketDayLow,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
          name: meta.longName || meta.shortName,
          exchange: meta.exchangeName,
          lastUpdated: new Date()
        };

        // Cache the result
        quoteCache.set(cleanedSymbol, {
          ...stockQuote,
          timestamp: Date.now()
        });

        return stockQuote;
      } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error);
        continue;
      }
    }

    // If all endpoints fail, return cached data if available (even if expired)
    if (cached) {
      console.warn(`Using stale cached data for ${cleanedSymbol}`);
      return cached;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching stock quote for ${cleanedSymbol}:`, error);
    return null;
  }
}

/**
 * Get multiple stock quotes in parallel
 */
export async function getMultipleStockQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
  const quotes = new Map<string, StockQuote>();
  
  // Fetch all quotes in parallel
  const promises = symbols.map(async (symbol) => {
    const quote = await getStockQuote(symbol);
    if (quote) {
      quotes.set(symbol, quote);
    }
  });

  await Promise.all(promises);
  return quotes;
}

/**
 * Convert stock price to base currency
 */
export async function convertStockPrice(
  price: number,
  stockCurrency: string,
  baseCurrency: string
): Promise<number> {
  if (stockCurrency === baseCurrency) {
    return price;
  }

  try {
    const rates = await getExchangeRates();
    
    // Convert to GBP first (as base), then to target currency
    const priceInGBP = stockCurrency === 'GBP' 
      ? price 
      : price / (rates[stockCurrency] || 1);
    
    const priceInBaseCurrency = baseCurrency === 'GBP'
      ? priceInGBP
      : priceInGBP * (rates[baseCurrency] || 1);

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
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  holdings: Array<{
    symbol: string;
    name: string;
    shares: number;
    averageCost: number;
    currentPrice: number;
    marketValue: number;
    gain: number;
    gainPercent: number;
    allocation: number;
    currency: string;
  }>;
}

export async function calculatePortfolioMetrics(
  holdings: Array<{ symbol: string; shares: number; averageCost: number }>,
  baseCurrency: string
): Promise<PortfolioMetrics> {
  const symbols = holdings.map(h => h.symbol);
  const quotes = await getMultipleStockQuotes(symbols);
  
  let totalValue = 0;
  let totalCost = 0;
  
  const enhancedHoldings = await Promise.all(holdings.map(async (holding) => {
    const quote = quotes.get(holding.symbol);
    const currentPrice = quote?.price || holding.averageCost;
    const currency = quote?.currency || baseCurrency;
    
    // Convert prices to base currency
    const convertedPrice = await convertStockPrice(currentPrice, currency, baseCurrency);
    const convertedCost = await convertStockPrice(holding.averageCost, currency, baseCurrency);
    
    const marketValue = convertedPrice * holding.shares;
    const costBasis = convertedCost * holding.shares;
    const gain = marketValue - costBasis;
    const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;
    
    totalValue += marketValue;
    totalCost += costBasis;
    
    return {
      symbol: holding.symbol,
      name: quote?.name || holding.symbol,
      shares: holding.shares,
      averageCost: holding.averageCost,
      currentPrice: currentPrice,
      marketValue: marketValue,
      gain: gain,
      gainPercent: gainPercent,
      allocation: 0, // Will be calculated after total
      currency: currency
    };
  }));
  
  // Calculate allocations
  enhancedHoldings.forEach(holding => {
    holding.allocation = totalValue > 0 ? (holding.marketValue / totalValue) * 100 : 0;
  });
  
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  
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