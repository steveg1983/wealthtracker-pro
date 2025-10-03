import React, { useState, useEffect } from 'react';
import { getMultipleStockQuotes } from '../services/stockPriceService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import StockQuoteWidget, { StockQuoteSearch } from './StockQuoteWidget';
import { PlusIcon, XIcon, RefreshCwIcon } from './icons';
import { logger } from '../services/loggingService';

interface StockQuote {
  symbol: string;
  price: import('../types/decimal-types').DecimalInstance;
  currency: string;
  change: import('../types/decimal-types').DecimalInstance;
  changePercent: import('../types/decimal-types').DecimalInstance;
  previousClose: import('../types/decimal-types').DecimalInstance;
  marketCap?: import('../types/decimal-types').DecimalInstance;
  volume?: number;
  name?: string;
  lastUpdated: Date;
}

export default function StockWatchlist() {
  const { formatCurrency } = useCurrencyDecimal();
  const [watchlist, setWatchlist] = useLocalStorage<string[]>('stock-watchlist', []);
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchQuotes = async () => {
    if (watchlist.length === 0) return;
    
    setIsLoading(true);
    try {
      const stockQuotes = await getMultipleStockQuotes(watchlist);
      setQuotes(stockQuotes);
      setLastUpdated(new Date());
    } catch (error) {
      logger.error('Error fetching watchlist quotes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchQuotes, 60000);
    return () => clearInterval(interval);
  }, [watchlist]);

  const addToWatchlist = (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    if (!watchlist.includes(upperSymbol)) {
      setWatchlist([...watchlist, upperSymbol]);
    }
    setShowAddStock(false);
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
    const newQuotes = new Map(quotes);
    newQuotes.delete(symbol);
    setQuotes(newQuotes);
  };

  const handleManualRefresh = () => {
    fetchQuotes();
  };

  if (watchlist.length === 0) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Stock Watchlist</h2>
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <PlusIcon size={16} />
            Add Stock
          </button>
        </div>

        {showAddStock ? (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Add Stock to Watchlist</h3>
            <StockQuoteSearch onStockSelect={addToWatchlist} />
            <button
              onClick={() => setShowAddStock(false)}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Stocks in Watchlist</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Add stocks to your watchlist to track their real-time performance.
            </p>
            <button
              onClick={() => setShowAddStock(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Your First Stock
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Stock Watchlist</h2>
          {lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            <RefreshCwIcon size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <PlusIcon size={16} />
            Add Stock
          </button>
        </div>
      </div>

      {showAddStock && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Add Stock to Watchlist</h3>
          <StockQuoteSearch onStockSelect={addToWatchlist} />
          <button
            onClick={() => setShowAddStock(false)}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {watchlist.map((symbol) => {
          const quote = quotes.get(symbol);
          return (
            <div key={symbol} className="relative">
              <button
                onClick={() => removeFromWatchlist(symbol)}
                className="absolute -top-2 -right-2 z-10 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <XIcon size={12} />
              </button>
              
              {quote ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{quote.symbol}</h3>
                    {isLoading && <RefreshCwIcon size={14} className="animate-spin text-gray-400" />}
                  </div>
                  
                  {quote.name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 truncate">{quote.name}</p>
                  )}
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(quote.price)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {quote.currency}
                    </span>
                  </div>
                  
                  <div className={`flex items-center gap-1 text-sm ${
                    quote.change.greaterThanOrEqualTo(0) 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    <span>
                      {quote.change.greaterThanOrEqualTo(0) ? '+' : ''}{formatCurrency(quote.change)}
                    </span>
                    <span>
                      ({quote.change.greaterThanOrEqualTo(0) ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{symbol}</h3>
                    <RefreshCwIcon size={14} className="animate-spin text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}