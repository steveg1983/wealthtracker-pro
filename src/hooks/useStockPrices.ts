import { useState, useEffect, useCallback } from 'react';
import { getStockQuote, getMultipleStockQuotes } from '../services/stockPriceService';
import type { Holding } from '../types';

interface StockPrice {
  symbol: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  lastUpdated: Date;
  name?: string;
}

interface UseStockPricesResult {
  prices: Map<string, StockPrice>;
  loading: boolean;
  error: string | null;
  refreshPrices: () => Promise<void>;
  getPrice: (symbol: string) => StockPrice | undefined;
}

export function useStockPrices(holdings: Holding[]): UseStockPricesResult {
  const [prices, setPrices] = useState<Map<string, StockPrice>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const symbols = holdings.map(h => h.ticker).filter(Boolean);
      const uniqueSymbols = [...new Set(symbols)];
      
      const quotes = await getMultipleStockQuotes(uniqueSymbols);
      
      const newPrices = new Map<string, StockPrice>();
      quotes.forEach((quote, symbol) => {
        newPrices.set(symbol, {
          symbol: quote.symbol,
          price: quote.price,
          currency: quote.currency,
          change: quote.change,
          changePercent: quote.changePercent,
          lastUpdated: quote.lastUpdated,
          name: quote.name
        });
      });

      setPrices(newPrices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock prices');
      console.error('Error fetching stock prices:', err);
    } finally {
      setLoading(false);
    }
  }, [holdings]);

  useEffect(() => {
    fetchPrices();

    // Refresh prices every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchPrices]);

  const getPrice = useCallback((symbol: string): StockPrice | undefined => {
    return prices.get(symbol.toUpperCase());
  }, [prices]);

  return {
    prices,
    loading,
    error,
    refreshPrices: fetchPrices,
    getPrice
  };
}

// Hook for single stock price
export function useStockPrice(symbol: string | undefined) {
  const [price, setPrice] = useState<StockPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setPrice(null);
      return;
    }

    const fetchPrice = async () => {
      setLoading(true);
      setError(null);

      try {
        const quote = await getStockQuote(symbol);
        if (quote) {
          setPrice({
            symbol: quote.symbol,
            price: quote.price,
            currency: quote.currency,
            change: quote.change,
            changePercent: quote.changePercent,
            lastUpdated: quote.lastUpdated,
            name: quote.name
          });
        } else {
          setError('Failed to fetch price');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stock price');
        console.error('Error fetching stock price:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();

    // Refresh price every minute
    const interval = setInterval(fetchPrice, 60 * 1000);

    return () => clearInterval(interval);
  }, [symbol]);

  return { price, loading, error };
}