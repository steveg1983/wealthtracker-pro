import React, { useState, useEffect } from 'react';
import { getStockQuote } from '../services/stockPriceService';
import type { DecimalInstance } from '../types/decimal-types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { SearchIcon, TrendingUpIcon, TrendingDownIcon, RefreshCwIcon } from './icons';
import { logger } from '../services/loggingService';

interface StockQuote {
  symbol: string;
  price: DecimalInstance;
  currency: string;
  change: DecimalInstance;
  changePercent: DecimalInstance;
  previousClose: DecimalInstance;
  marketCap?: DecimalInstance;
  volume?: number;
  name?: string;
  lastUpdated: Date;
}

interface StockQuoteWidgetProps {
  symbol: string;
  showDetails?: boolean;
  onQuoteUpdate?: (quote: StockQuote) => void;
}

export default function StockQuoteWidget({ 
  symbol, 
  showDetails = false, 
  onQuoteUpdate 
}: StockQuoteWidgetProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = async () => {
    if (!symbol) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const stockQuote = await getStockQuote(symbol);
      if (stockQuote) {
        setQuote(stockQuote);
        onQuoteUpdate?.(stockQuote);
      } else {
        setError('Quote not found');
      }
    } catch (err) {
      setError('Failed to fetch quote');
      logger.error('Error fetching quote:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQuote, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

  if (isLoading && !quote) {
    return (
      <div className="flex items-center justify-center p-4">
        <RefreshCwIcon size={20} className="animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading quote...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="text-sm text-red-500">{error}</span>
        <button
          onClick={fetchQuote}
          className="ml-2 text-sm text-blue-500 hover:text-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="text-sm text-gray-500">No quote available</span>
      </div>
    );
  }

  const isPositive = quote.change.greaterThanOrEqualTo(0);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-lg shadow border border-white/20 dark:border-gray-700/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{quote.symbol}</h3>
          {isLoading && <RefreshCwIcon size={14} className="animate-spin text-gray-400" />}
        </div>
        <button
          onClick={fetchQuote}
          disabled={isLoading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
        >
          <RefreshCwIcon size={16} />
        </button>
      </div>

      {quote.name && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{quote.name}</p>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(quote.price)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {quote.currency}
          </span>
        </div>
        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isPositive ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
          <span className="text-sm font-medium">
            {isPositive ? '+' : ''}{formatCurrency(quote.change)}
          </span>
          <span className="text-sm">
            ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Previous Close</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatCurrency(quote.previousClose)}
            </p>
          </div>
          
          {quote.volume && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Volume</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {quote.volume.toLocaleString()}
              </p>
            </div>
          )}
          
          {quote.marketCap && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Market Cap</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatCurrency(quote.marketCap)}
              </p>
            </div>
          )}
          
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {quote.lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Component for searching and adding stock quotes
export function StockQuoteSearch({ 
  onStockSelect 
}: { 
  onStockSelect: (symbol: string) => void 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Common stock symbols for suggestions
  const popularStocks = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
    'V', 'JPM', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'VZ',
    'ADBE', 'NFLX', 'KO', 'NKE', 'CRM', 'INTC', 'CSCO', 'PFE', 'XOM', 'CVX'
  ];

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    
    if (value.length > 0) {
      const filtered = popularStocks.filter(stock => 
        stock.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 10));
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectStock = (symbol: string) => {
    onStockSelect(symbol);
    setSearchTerm('');
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search stocks (e.g., AAPL)"
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((symbol) => (
            <button
              key={symbol}
              onClick={() => handleSelectStock(symbol)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}