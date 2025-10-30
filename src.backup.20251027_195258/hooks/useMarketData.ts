/**
 * Market Data Hook
 * Real-time market data integration with caching
 * Created: 2025-09-02
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { alphaVantageService } from '../services/alphaVantageService';
import type { StockQuote, HistoricalPrice, DividendInfo, ExchangeRate } from '../services/alphaVantageService';

export interface UseMarketDataReturn {
  getQuote: (symbol: string) => Promise<StockQuote | null>;
  getQuotes: (symbols: string[]) => Promise<Map<string, StockQuote>>;
  getHistoricalPrices: (symbol: string) => Promise<HistoricalPrice[]>;
  getDividendInfo: (symbol: string) => Promise<DividendInfo | null>;
  getExchangeRate: (from: string, to: string) => Promise<ExchangeRate | null>;
  quotes: Map<string, StockQuote>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useMarketData(autoRefresh: boolean = false): UseMarketDataReturn {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Get single quote
  const getQuote = useCallback(async (symbol: string): Promise<StockQuote | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const quote = await alphaVantageService.getQuote(symbol);
      
      if (quote) {
        setQuotes(prev => {
          const updated = new Map(prev);
          updated.set(symbol, quote);
          return updated;
        });
        setLastUpdated(new Date());
      }
      
      return quote;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch quote';
      setError(message);
      console.error('Error fetching quote:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get multiple quotes
  const getQuotes = useCallback(async (symbols: string[]): Promise<Map<string, StockQuote>> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedQuotes = await alphaVantageService.getQuotes(symbols);
      
      setQuotes(prev => {
        const updated = new Map(prev);
        fetchedQuotes.forEach((quote, symbol) => {
          updated.set(symbol, quote);
        });
        return updated;
      });
      
      setLastUpdated(new Date());
      return fetchedQuotes;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch quotes';
      setError(message);
      console.error('Error fetching quotes:', err);
      return new Map();
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get historical prices
  const getHistoricalPrices = useCallback(async (symbol: string): Promise<HistoricalPrice[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const prices = await alphaVantageService.getHistoricalPrices(symbol);
      return prices;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch historical prices';
      setError(message);
      console.error('Error fetching historical prices:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get dividend info
  const getDividendInfo = useCallback(async (symbol: string): Promise<DividendInfo | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const info = await alphaVantageService.getDividendInfo(symbol);
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dividend info';
      setError(message);
      console.error('Error fetching dividend info:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get exchange rate
  const getExchangeRate = useCallback(async (from: string, to: string): Promise<ExchangeRate | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const rate = await alphaVantageService.getExchangeRate(from, to);
      return rate;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch exchange rate';
      setError(message);
      console.error('Error fetching exchange rate:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const quoteSymbols = useMemo(() => Array.from(quotes.keys()), [quotes]);

  // Auto-refresh quotes if enabled
  useEffect(() => {
    if (!autoRefresh || quoteSymbols.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      void getQuotes(quoteSymbols);
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(interval);
  }, [autoRefresh, getQuotes, quoteSymbols]);

  return {
    getQuote,
    getQuotes,
    getHistoricalPrices,
    getDividendInfo,
    getExchangeRate,
    quotes,
    isLoading,
    error,
    lastUpdated
  };
}

export default useMarketData;
