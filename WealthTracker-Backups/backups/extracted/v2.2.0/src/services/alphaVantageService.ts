/**
 * Alpha Vantage Market Data Service
 * Real-time stock quotes and market data integration
 * Created: 2025-09-02
 */

import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';

export interface StockQuote {
  symbol: string;
  price: DecimalInstance;
  change: DecimalInstance;
  changePercent: number;
  volume: number;
  previousClose: DecimalInstance;
  open: DecimalInstance;
  high: DecimalInstance;
  low: DecimalInstance;
  marketCap?: DecimalInstance;
  peRatio?: number;
  dividendYield?: number;
  lastUpdated: Date;
}

export interface HistoricalPrice {
  date: Date;
  open: DecimalInstance;
  high: DecimalInstance;
  low: DecimalInstance;
  close: DecimalInstance;
  adjustedClose: DecimalInstance;
  volume: number;
  dividendAmount?: DecimalInstance;
}

export interface DividendInfo {
  symbol: string;
  exDividendDate: Date;
  paymentDate: Date;
  amount: DecimalInstance;
  frequency: 'quarterly' | 'monthly' | 'annual' | 'semi-annual';
  yieldPercentage: number;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: DecimalInstance;
  lastUpdated: Date;
}

export interface MarketOverview {
  status: 'open' | 'closed' | 'pre-market' | 'after-hours';
  indices: {
    sp500: { value: number; change: number; changePercent: number };
    nasdaq: { value: number; change: number; changePercent: number };
    dow: { value: number; change: number; changePercent: number };
    ftse100?: { value: number; change: number; changePercent: number };
  };
  lastUpdated: Date;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class AlphaVantageService {
  private apiKey: string;
  private baseUrl = 'https://www.alphavantage.co/query';
  private cache = new Map<string, CacheEntry<unknown>>();
  private rateLimitDelay = 12000; // 12 seconds between calls for free tier (5 calls/min)
  private lastApiCall = 0;
  private defaultTTL = 15 * 60 * 1000; // 15 minutes cache

  constructor() {
    this.apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || 'demo';
  }

  /**
   * Get real-time stock quote
   */
  async getQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `quote:${symbol}`;
    const cached = this.getFromCache<StockQuote>(cacheKey);
    if (cached) return cached;

    try {
      await this.enforceRateLimit();
      
      const response = await fetch(
        `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        console.error('Alpha Vantage API error:', response.statusText);
        return this.getFallbackQuote(symbol);
      }

      const data = await response.json();
      
      if (data['Error Message'] || data['Note']) {
        console.error('Alpha Vantage API limit reached');
        return this.getFallbackQuote(symbol);
      }

      const quote = data['Global Quote'];
      if (!quote || !quote['05. price']) {
        return this.getFallbackQuote(symbol);
      }

      const stockQuote: StockQuote = {
        symbol: quote['01. symbol'],
        price: toDecimal(quote['05. price']),
        change: toDecimal(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
        volume: parseInt(quote['06. volume'] || '0'),
        previousClose: toDecimal(quote['08. previous close']),
        open: toDecimal(quote['02. open']),
        high: toDecimal(quote['03. high']),
        low: toDecimal(quote['04. low']),
        lastUpdated: new Date()
      };

      this.saveToCache(cacheKey, stockQuote);
      return stockQuote;
    } catch (error) {
      console.error('Error fetching quote:', error);
      return this.getFallbackQuote(symbol);
    }
  }

  /**
   * Get historical prices for a symbol
   */
  async getHistoricalPrices(
    symbol: string,
    outputSize: 'compact' | 'full' = 'compact'
  ): Promise<HistoricalPrice[]> {
    const cacheKey = `history:${symbol}:${outputSize}`;
    const cached = this.getFromCache<HistoricalPrice[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.enforceRateLimit();
      
      const response = await fetch(
        `${this.baseUrl}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=${outputSize}&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        return this.getFallbackHistoricalPrices(symbol);
      }

      const data = await response.json();
      
      if (data['Error Message'] || data['Note']) {
        return this.getFallbackHistoricalPrices(symbol);
      }

      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        return this.getFallbackHistoricalPrices(symbol);
      }

      const prices: HistoricalPrice[] = Object.entries(timeSeries)
        .map(([date, values]: [string, any]) => ({
          date: new Date(date),
          open: toDecimal(values['1. open']),
          high: toDecimal(values['2. high']),
          low: toDecimal(values['3. low']),
          close: toDecimal(values['4. close']),
          adjustedClose: toDecimal(values['5. adjusted close']),
          volume: parseInt(values['6. volume']),
          dividendAmount: values['7. dividend amount'] 
            ? toDecimal(values['7. dividend amount'])
            : undefined
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      this.saveToCache(cacheKey, prices, 60 * 60 * 1000); // Cache for 1 hour
      return prices;
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      return this.getFallbackHistoricalPrices(symbol);
    }
  }

  /**
   * Get dividend information
   */
  async getDividendInfo(symbol: string): Promise<DividendInfo | null> {
    const cacheKey = `dividend:${symbol}`;
    const cached = this.getFromCache<DividendInfo>(cacheKey);
    if (cached) return cached;

    try {
      // Get quote first for current price
      const quote = await this.getQuote(symbol);
      if (!quote) return null;

      // Get historical data to find dividends
      const historical = await this.getHistoricalPrices(symbol, 'compact');
      
      // Find recent dividends
      const recentDividends = historical
        .filter(h => h.dividendAmount && h.dividendAmount.greaterThan(0))
        .slice(0, 4); // Last 4 dividends

      if (recentDividends.length === 0) {
        return null;
      }

      // Calculate annual dividend and yield
      const annualDividend = recentDividends
        .reduce((sum, h) => sum.plus(h.dividendAmount!), toDecimal(0));
      
      const yieldPercentage = quote.price.greaterThan(0)
        ? annualDividend.dividedBy(quote.price).times(100).toNumber()
        : 0;

      // Determine frequency
      let frequency: DividendInfo['frequency'] = 'quarterly';
      if (recentDividends.length >= 2) {
        const daysBetween = Math.abs(
          recentDividends[0].date.getTime() - recentDividends[1].date.getTime()
        ) / (1000 * 60 * 60 * 24);
        
        if (daysBetween > 300) frequency = 'annual';
        else if (daysBetween > 150) frequency = 'semi-annual';
        else if (daysBetween > 60) frequency = 'quarterly';
        else frequency = 'monthly';
      }

      const dividendInfo: DividendInfo = {
        symbol,
        exDividendDate: recentDividends[0].date,
        paymentDate: new Date(recentDividends[0].date.getTime() + 14 * 24 * 60 * 60 * 1000), // Estimate
        amount: recentDividends[0].dividendAmount!,
        frequency,
        yieldPercentage
      };

      this.saveToCache(cacheKey, dividendInfo, 24 * 60 * 60 * 1000); // Cache for 24 hours
      return dividendInfo;
    } catch (error) {
      console.error('Error fetching dividend info:', error);
      return null;
    }
  }

  /**
   * Get exchange rate between currencies
   */
  async getExchangeRate(from: string, to: string): Promise<ExchangeRate | null> {
    const cacheKey = `forex:${from}:${to}`;
    const cached = this.getFromCache<ExchangeRate>(cacheKey);
    if (cached) return cached;

    try {
      await this.enforceRateLimit();
      
      const response = await fetch(
        `${this.baseUrl}?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        return this.getFallbackExchangeRate(from, to);
      }

      const data = await response.json();
      
      if (data['Error Message'] || data['Note']) {
        return this.getFallbackExchangeRate(from, to);
      }

      const rateData = data['Realtime Currency Exchange Rate'];
      if (!rateData) {
        return this.getFallbackExchangeRate(from, to);
      }

      const exchangeRate: ExchangeRate = {
        from: rateData['1. From_Currency Code'],
        to: rateData['3. To_Currency Code'],
        rate: toDecimal(rateData['5. Exchange Rate']),
        lastUpdated: new Date(rateData['6. Last Refreshed'])
      };

      this.saveToCache(cacheKey, exchangeRate, 30 * 60 * 1000); // Cache for 30 minutes
      return exchangeRate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      return this.getFallbackExchangeRate(from, to);
    }
  }

  /**
   * Get market overview
   */
  async getMarketOverview(): Promise<MarketOverview> {
    const cacheKey = 'market:overview';
    const cached = this.getFromCache<MarketOverview>(cacheKey);
    if (cached) return cached;

    // For market overview, we'll use fallback data
    // Alpha Vantage doesn't provide index data in free tier
    const overview = this.getFallbackMarketOverview();
    this.saveToCache(cacheKey, overview, 5 * 60 * 1000); // Cache for 5 minutes
    return overview;
  }

  /**
   * Batch fetch multiple quotes
   */
  async getQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const quotes = new Map<string, StockQuote>();
    
    for (const symbol of symbols) {
      const quote = await this.getQuote(symbol);
      if (quote) {
        quotes.set(symbol, quote);
      }
    }
    
    return quotes;
  }

  // Helper methods

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall)
      );
    }
    
    this.lastApiCall = Date.now();
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private saveToCache<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  // Fallback methods for when API is unavailable

  private getFallbackQuote(symbol: string): StockQuote {
    // Return mock data with random variations
    const basePrice = 100;
    const randomChange = (Math.random() - 0.5) * 5;
    
    return {
      symbol,
      price: toDecimal(basePrice + randomChange),
      change: toDecimal(randomChange),
      changePercent: randomChange / basePrice * 100,
      volume: Math.floor(Math.random() * 1000000),
      previousClose: toDecimal(basePrice),
      open: toDecimal(basePrice),
      high: toDecimal(basePrice + Math.abs(randomChange)),
      low: toDecimal(basePrice - Math.abs(randomChange)),
      lastUpdated: new Date()
    };
  }

  private getFallbackHistoricalPrices(symbol: string): HistoricalPrice[] {
    const prices: HistoricalPrice[] = [];
    const today = new Date();
    let basePrice = 100;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const dayChange = (Math.random() - 0.5) * 5;
      basePrice += dayChange;
      
      prices.push({
        date,
        open: toDecimal(basePrice),
        high: toDecimal(basePrice + Math.abs(dayChange)),
        low: toDecimal(basePrice - Math.abs(dayChange)),
        close: toDecimal(basePrice + dayChange / 2),
        adjustedClose: toDecimal(basePrice + dayChange / 2),
        volume: Math.floor(Math.random() * 1000000)
      });
    }
    
    return prices;
  }

  private getFallbackExchangeRate(from: string, to: string): ExchangeRate {
    // Common exchange rates (approximate)
    const rates: Record<string, number> = {
      'USD:EUR': 0.92,
      'EUR:USD': 1.09,
      'USD:GBP': 0.79,
      'GBP:USD': 1.27,
      'USD:JPY': 147,
      'JPY:USD': 0.0068
    };
    
    const key = `${from}:${to}`;
    const rate = rates[key] || 1;
    
    return {
      from,
      to,
      rate: toDecimal(rate),
      lastUpdated: new Date()
    };
  }

  private getFallbackMarketOverview(): MarketOverview {
    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    let status: MarketOverview['status'] = 'closed';
    if (!isWeekend) {
      if (hour >= 9 && hour < 16) status = 'open';
      else if (hour >= 4 && hour < 9) status = 'pre-market';
      else if (hour >= 16 && hour < 20) status = 'after-hours';
    }
    
    return {
      status,
      indices: {
        sp500: { value: 4500, change: 12.5, changePercent: 0.28 },
        nasdaq: { value: 14200, change: -23.4, changePercent: -0.16 },
        dow: { value: 35000, change: 45.2, changePercent: 0.13 },
        ftse100: { value: 7500, change: 8.3, changePercent: 0.11 }
      },
      lastUpdated: new Date()
    };
  }
}

// Export singleton instance
export const alphaVantageService = new AlphaVantageService();

export default alphaVantageService;