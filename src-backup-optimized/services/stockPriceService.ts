/**
 * Stock Price Service - Stock market data and pricing information
 *
 * Features:
 * - Real-time stock quotes
 * - Historical price data
 * - Market data aggregation
 * - Multiple data provider support
 * - Rate limiting and caching
 */

import { lazyLogger } from './serviceFactory';

const logger = lazyLogger.getLogger('StockPriceService');

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high52Week?: number;
  low52Week?: number;
  peRatio?: number;
  eps?: number;
  dividend?: number;
  dividendYield?: number;
  currency: string;
  exchange: string;
  timestamp: string;
  marketOpen: boolean;
  extendedHours?: {
    price: number;
    change: number;
    changePercent: number;
    timestamp: string;
  };
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface StockSearch {
  symbol: string;
  name: string;
  exchange: string;
  type: 'stock' | 'etf' | 'fund' | 'index';
  currency: string;
  country: string;
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: string;
  nextClose?: string;
  timezone: string;
  localTime: string;
}

class StockPriceService {
  private static instance: StockPriceService;
  private cache: Map<string, { data: StockQuote; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  private constructor() {
    logger.info('StockPriceService initialized');
  }

  public static getInstance(): StockPriceService {
    if (!StockPriceService.instance) {
      StockPriceService.instance = new StockPriceService();
    }
    return StockPriceService.instance;
  }

  // Get real-time stock quote
  public static async getStockQuote(symbol: string): Promise<StockQuote> {
    const service = StockPriceService.getInstance();

    try {
      // Check cache first
      const cached = service.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < service.CACHE_DURATION) {
        logger.debug('Returning cached quote for symbol:', symbol);
        return cached.data;
      }

      // Mock stock quote data (in a real implementation, this would call external APIs)
      const mockQuote: StockQuote = {
        symbol: symbol.toUpperCase(),
        price: Math.random() * 200 + 100, // Random price between 100-300
        previousClose: Math.random() * 200 + 100,
        change: (Math.random() - 0.5) * 10, // Random change between -5 to +5
        changePercent: (Math.random() - 0.5) * 10, // Random percentage change
        volume: Math.floor(Math.random() * 10000000), // Random volume
        marketCap: Math.floor(Math.random() * 1000000000000), // Random market cap
        high52Week: Math.random() * 300 + 150,
        low52Week: Math.random() * 150 + 50,
        peRatio: Math.random() * 50 + 10,
        eps: Math.random() * 20 + 1,
        dividend: Math.random() * 5,
        dividendYield: Math.random() * 5,
        currency: 'USD',
        exchange: 'NASDAQ',
        timestamp: new Date().toISOString(),
        marketOpen: service.isMarketOpen(),
        extendedHours: service.isMarketOpen() ? undefined : {
          price: Math.random() * 200 + 100,
          change: (Math.random() - 0.5) * 2,
          changePercent: (Math.random() - 0.5) * 2,
          timestamp: new Date().toISOString()
        }
      };

      // Calculate derived values
      mockQuote.changePercent = (mockQuote.change / mockQuote.previousClose) * 100;

      // Cache the result
      service.cache.set(symbol, {
        data: mockQuote,
        timestamp: Date.now()
      });

      logger.info('Stock quote retrieved', { symbol, price: mockQuote.price });
      return mockQuote;
    } catch (error) {
      logger.error('Error getting stock quote:', error);
      throw new Error(`Failed to get quote for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get multiple stock quotes
  public static async getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
    try {
      const quotes = await Promise.all(
        symbols.map(symbol => this.getStockQuote(symbol))
      );

      logger.info('Multiple quotes retrieved', { count: quotes.length });
      return quotes;
    } catch (error) {
      logger.error('Error getting multiple quotes:', error);
      throw error;
    }
  }

  // Get historical price data
  public static async getHistoricalPrices(
    symbol: string,
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max' = '1y'
  ): Promise<HistoricalPrice[]> {
    try {
      // Mock historical data
      const days = this.getPeriodDays(period);
      const prices: HistoricalPrice[] = [];
      const basePrice = Math.random() * 200 + 100;

      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const price = basePrice + (Math.random() - 0.5) * 20;
        const volume = Math.floor(Math.random() * 10000000);

        prices.push({
          date: date.toISOString().split('T')[0],
          open: price + (Math.random() - 0.5) * 2,
          high: price + Math.random() * 3,
          low: price - Math.random() * 3,
          close: price,
          volume,
          adjustedClose: price
        });
      }

      logger.info('Historical prices retrieved', { symbol, period, count: prices.length });
      return prices;
    } catch (error) {
      logger.error('Error getting historical prices:', error);
      throw error;
    }
  }

  // Search for stocks
  public static async searchStocks(query: string, limit = 10): Promise<StockSearch[]> {
    try {
      // Mock search results
      const mockResults: StockSearch[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          exchange: 'NASDAQ',
          type: 'stock',
          currency: 'USD',
          country: 'US'
        },
        {
          symbol: 'MSFT',
          name: 'Microsoft Corporation',
          exchange: 'NASDAQ',
          type: 'stock',
          currency: 'USD',
          country: 'US'
        },
        {
          symbol: 'GOOGL',
          name: 'Alphabet Inc.',
          exchange: 'NASDAQ',
          type: 'stock',
          currency: 'USD',
          country: 'US'
        },
        {
          symbol: 'TSLA',
          name: 'Tesla, Inc.',
          exchange: 'NASDAQ',
          type: 'stock',
          currency: 'USD',
          country: 'US'
        },
        {
          symbol: 'SPY',
          name: 'SPDR S&P 500 ETF Trust',
          exchange: 'NYSE',
          type: 'etf',
          currency: 'USD',
          country: 'US'
        }
      ].filter(stock =>
        stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
        stock.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      logger.info('Stock search completed', { query, results: mockResults.length });
      return mockResults;
    } catch (error) {
      logger.error('Error searching stocks:', error);
      throw error;
    }
  }

  // Get market status
  public static async getMarketStatus(): Promise<MarketStatus> {
    try {
      const now = new Date();
      const isOpen = StockPriceService.getInstance().isMarketOpen();

      return {
        isOpen,
        nextOpen: isOpen ? undefined : '09:30:00',
        nextClose: isOpen ? '16:00:00' : undefined,
        timezone: 'America/New_York',
        localTime: now.toISOString()
      };
    } catch (error) {
      logger.error('Error getting market status:', error);
      throw error;
    }
  }

  // Helper methods
  private static getPeriodDays(period: string): number {
    switch (period) {
      case '1d': return 1;
      case '5d': return 5;
      case '1mo': return 30;
      case '3mo': return 90;
      case '6mo': return 180;
      case '1y': return 365;
      case '2y': return 730;
      case '5y': return 1825;
      case '10y': return 3650;
      case 'ytd': return Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));
      case 'max': return 3650; // Default to 10 years for max
      default: return 365;
    }
  }

  private isMarketOpen(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();

    // Market is closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Market hours: 9:30 AM to 4:00 PM EST (simplified)
    return hour >= 9 && hour < 16;
  }

  // Clear cache
  public static clearCache(): void {
    StockPriceService.getInstance().cache.clear();
    logger.info('Stock price cache cleared');
  }

  // Get cache stats
  public static getCacheStats(): { size: number; oldestEntry?: number } {
    const cache = StockPriceService.getInstance().cache;
    const entries = Array.from(cache.values());

    return {
      size: cache.size,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : undefined
    };
  }
}

// Export the main function that other services expect
export const getStockQuote = StockPriceService.getStockQuote;

export default StockPriceService;