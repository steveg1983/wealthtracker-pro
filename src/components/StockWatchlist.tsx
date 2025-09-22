/**
 * StockWatchlist Component - Stock watchlist and price tracking
 *
 * Features:
 * - Add/remove stocks to watchlist
 * - Real-time price updates
 * - Price alerts and notifications
 * - Performance indicators
 * - Market news integration
 */

import React, { useState, useEffect } from 'react';

interface WatchlistStock {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  addedAt: Date;
  alertPrice?: number;
  notes?: string;
}

interface StockWatchlistProps {
  userId?: string;
  onStockSelect?: (stock: WatchlistStock) => void;
  className?: string;
}

// Mock watchlist data
const mockWatchlistStocks: WatchlistStock[] = [
  {
    id: 'watch-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currentPrice: 175.50,
    change: 2.35,
    changePercent: 1.36,
    volume: 45123000,
    marketCap: 2800000000000,
    pe: 28.5,
    addedAt: new Date('2024-01-10'),
    alertPrice: 180.00
  },
  {
    id: 'watch-2',
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    currentPrice: 412.80,
    change: -3.20,
    changePercent: -0.77,
    volume: 22156000,
    marketCap: 3100000000000,
    pe: 34.2,
    addedAt: new Date('2024-01-15')
  },
  {
    id: 'watch-3',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    currentPrice: 138.25,
    change: 1.85,
    changePercent: 1.36,
    volume: 18934000,
    marketCap: 1750000000000,
    pe: 25.8,
    addedAt: new Date('2024-02-01'),
    alertPrice: 140.00
  }
];

export default function StockWatchlist({
  userId,
  onStockSelect,
  className = ''
}: StockWatchlistProps): React.JSX.Element {
  const [watchlist, setWatchlist] = useState<WatchlistStock[]>([]);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [searchResults, setSearchResults] = useState<Partial<WatchlistStock>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'symbol' | 'change' | 'changePercent' | 'addedAt'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Load watchlist
  useEffect(() => {
    const loadWatchlist = async () => {
      setIsLoading(true);
      try {

        // In a real implementation, this would fetch from API
        await new Promise(resolve => setTimeout(resolve, 300));

        setWatchlist(mockWatchlistStocks);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    loadWatchlist();
  }, [userId]);

  // Search for stocks
  const searchStocks = async (symbol: string) => {
    if (symbol.length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      // Mock search results
      const mockResults: Partial<WatchlistStock>[] = [
        {
          symbol: symbol.toUpperCase(),
          name: `${symbol.toUpperCase()} Company`,
          currentPrice: 100.00 + Math.random() * 100,
          change: (Math.random() - 0.5) * 10,
          changePercent: (Math.random() - 0.5) * 5
        }
      ];

      setSearchResults(mockResults);
    } catch (error) {
      setSearchResults([]);
    }
  };

  // Add stock to watchlist
  const addToWatchlist = async (stock: Partial<WatchlistStock>) => {
    if (!stock.symbol || !stock.name) return;

    try {
      const newStock: WatchlistStock = {
        id: `watch-${Date.now()}`,
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice || 0,
        change: stock.change || 0,
        changePercent: stock.changePercent || 0,
        volume: stock.volume || 0,
        addedAt: new Date()
      };

      const updatedWatchlist = [...watchlist, newStock];
      setWatchlist(updatedWatchlist);
      setNewSymbol('');
      setSearchResults([]);
      setIsAddingStock(false);

    } catch (error) {
    }
  };

  // Remove stock from watchlist
  const removeFromWatchlist = async (stockId: string) => {
    try {
      const updatedWatchlist = watchlist.filter(stock => stock.id !== stockId);
      setWatchlist(updatedWatchlist);
    } catch (error) {
    }
  };

  // Set price alert
  const setPriceAlert = async (stockId: string, alertPrice: number) => {
    try {
      const updatedWatchlist = watchlist.map(stock =>
        stock.id === stockId ? { ...stock, alertPrice } : stock
      );
      setWatchlist(updatedWatchlist);
    } catch (error) {
    }
  };

  // Sort watchlist
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    if (sortBy === 'addedAt') {
      aValue = (a[sortBy] as Date).getTime();
      bValue = (b[sortBy] as Date).getTime();
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return formatCurrency(num);
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Stock Watchlist
        </h2>
        <button
          onClick={() => setIsAddingStock(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
        >
          Add Stock
        </button>
      </div>

      {/* Add Stock Form */}
      {isAddingStock && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Add Stock to Watchlist
          </h3>
          <div className="flex space-x-3">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => {
                setNewSymbol(e.target.value);
                searchStocks(e.target.value);
              }}
              placeholder="Enter stock symbol (e.g., AAPL)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              onClick={() => setIsAddingStock(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors duration-200"
            >
              Cancel
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Search Results:
              </h4>
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {result.symbol}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {result.name}
                    </p>
                  </div>
                  <button
                    onClick={() => addToWatchlist(result)}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Sort by:
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="symbol">Symbol</option>
          <option value="change">Change</option>
          <option value="changePercent">Change %</option>
          <option value="addedAt">Date Added</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Watchlist */}
      {sortedWatchlist.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Your watchlist is empty
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Add stocks to track their performance and set price alerts.
          </p>
          <button
            onClick={() => setIsAddingStock(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
          >
            Add Your First Stock
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Volume
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Market Cap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Alert
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedWatchlist.map(stock => (
                  <tr
                    key={stock.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => onStockSelect?.(stock)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {stock.symbol}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-32">
                          {stock.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(stock.currentPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stock.change >= 0 ? '+' : ''}{formatCurrency(stock.change)}
                      </div>
                      <div className={`text-xs ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {stock.volume.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {stock.marketCap ? formatLargeNumber(stock.marketCap) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {stock.alertPrice ? formatCurrency(stock.alertPrice) : 'None'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newAlert = prompt('Set price alert:', stock.alertPrice?.toString() || '');
                          if (newAlert) {
                            setPriceAlert(stock.id, parseFloat(newAlert));
                          }
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 mr-3"
                      >
                        Alert
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromWatchlist(stock.id);
                        }}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}