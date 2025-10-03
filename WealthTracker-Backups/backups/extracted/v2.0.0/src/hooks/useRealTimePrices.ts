import { useState, useEffect, useCallback, useRef } from 'react';
import { realTimePriceService, type PriceUpdate } from '../services/realtimePriceService';
import type { StockQuote } from '../services/stockPriceService';

interface UseRealTimePricesOptions {
  symbols: string[];
  enabled?: boolean;
  onUpdate?: (update: PriceUpdate) => void;
}

interface UseRealTimePricesResult {
  quotes: Map<string, StockQuote>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  marketStatus: { isOpen: boolean; nextCheck: Date };
  refresh: () => void;
}

export function useRealTimePrices({
  symbols,
  enabled = true,
  onUpdate
}: UseRealTimePricesOptions): UseRealTimePricesResult {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [marketStatus, setMarketStatus] = useState(() => realTimePriceService.getMarketStatus());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    setQuotes(prev => {
      const newQuotes = new Map(prev);
      newQuotes.set(update.symbol, update.quote);
      return newQuotes;
    });
    setLastUpdate(update.timestamp);
    setError(null);
    
    if (onUpdate) {
      onUpdate(update);
    }
  }, [onUpdate]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    symbols.forEach(symbol => {
      // This will trigger immediate fetch through the service
      realTimePriceService['fetchAndBroadcast'](symbol);
    });
  }, [symbols]);

  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      return;
    }

    setIsLoading(true);

    // Subscribe to real-time updates
    unsubscribeRef.current = realTimePriceService.subscribeMultiple(
      symbols,
      handlePriceUpdate
    );

    // Update market status periodically
    const marketStatusInterval = setInterval(() => {
      setMarketStatus(realTimePriceService.getMarketStatus());
    }, 60000); // Check every minute

    // Handle errors
    const handleError = ({ symbol, error }: { symbol: string; error: Error }) => {
      setError(`Failed to fetch price for ${symbol}: ${error.message}`);
      setIsLoading(false);
    };

    realTimePriceService.on('error', handleError);

    // Set loading to false after initial fetch attempt
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      clearInterval(marketStatusInterval);
      clearTimeout(loadingTimeout);
      realTimePriceService.off('error', handleError);
    };
  }, [symbols, enabled, handlePriceUpdate]);

  return {
    quotes,
    isLoading,
    error,
    lastUpdate,
    marketStatus,
    refresh
  };
}

// Hook for single symbol
export function useRealTimePrice(symbol: string, enabled = true) {
  const result = useRealTimePrices({ symbols: [symbol], enabled });
  return {
    ...result,
    quote: result.quotes.get(symbol) || null
  };
}