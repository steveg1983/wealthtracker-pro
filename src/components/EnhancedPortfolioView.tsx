import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useStockPrices } from '../hooks/useStockPrices';
import { useCurrency } from '../hooks/useCurrency';
import { convertStockPrice } from '../services/stockPriceService';
import type { Holding } from '../types';

interface EnhancedPortfolioViewProps {
  accountId: string;
  accountName: string;
  holdings: Holding[];
  currency: string;
  onClose: () => void;
}

export default function EnhancedPortfolioView({ 
  accountId, 
  accountName, 
  holdings, 
  currency,
  onClose 
}: EnhancedPortfolioViewProps) {
  const navigate = useNavigate();
  const { } = useCurrency();
  const { prices, loading, error, refreshPrices } = useStockPrices(holdings);
  const [sortBy, setSortBy] = useState<'value' | 'shares' | 'name' | 'gain'>('value');
  const [enhancedHoldings, setEnhancedHoldings] = useState<Holding[]>([]);
  const [totalMarketValue, setTotalMarketValue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [totalGain, setTotalGain] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate enhanced holdings with live prices
  useEffect(() => {
    const calculateEnhancedHoldings = async () => {
      const enhanced: Holding[] = [];
      let marketValue = 0;
      let cost = 0;

      for (const holding of holdings) {
        const livePrice = prices.get(holding.ticker);
        
        if (livePrice) {
          // Convert live price to account currency
          const convertedPrice = await convertStockPrice(
            livePrice.price,
            livePrice.currency,
            currency
          );
          
          const holdingMarketValue = convertedPrice * holding.shares;
          const holdingCost = (holding.averageCost || holding.value / holding.shares) * holding.shares;
          const gain = holdingMarketValue - holdingCost;
          const gainPercent = holdingCost > 0 ? (gain / holdingCost) * 100 : 0;

          enhanced.push({
            ...holding,
            currentPrice: convertedPrice,
            marketValue: holdingMarketValue,
            gain: gain,
            gainPercent: gainPercent,
            currency: livePrice.currency,
            lastUpdated: livePrice.lastUpdated,
            name: livePrice.name || holding.name
          });

          marketValue += holdingMarketValue;
          cost += holdingCost;
        } else {
          // Fallback to static data if no live price
          const staticValue = holding.value;
          enhanced.push({
            ...holding,
            marketValue: staticValue,
            currentPrice: holding.shares > 0 ? staticValue / holding.shares : 0
          });
          marketValue += staticValue;
          cost += staticValue;
        }
      }

      setEnhancedHoldings(enhanced);
      setTotalMarketValue(marketValue);
      setTotalCost(cost);
      setTotalGain(marketValue - cost);
    };

    calculateEnhancedHoldings();
  }, [holdings, prices, currency]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshPrices();
    setTimeout(() => setRefreshing(false), 1000);
  };
  
  const sortedHoldings = [...enhancedHoldings].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return (b.marketValue || 0) - (a.marketValue || 0);
      case 'shares':
        return b.shares - a.shares;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'gain':
        return (b.gain || 0) - (a.gain || 0);
      default:
        return 0;
    }
  });
  
  const getPercentage = (value: number) => {
    return totalMarketValue > 0 ? ((value / totalMarketValue) * 100).toFixed(1) : '0';
  };

  const formatPercent = (value: number) => {
    const formatted = value.toFixed(2);
    return value >= 0 ? `+${formatted}%` : `${formatted}%`;
  };
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {accountName} Portfolio
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Real-time portfolio valuation
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            className={`flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 ${
              refreshing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={refreshing || loading}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh Prices
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {error}
            </p>
          </div>
        )}
        
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => navigate(`/transactions?account=${accountId}`)}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            View Transactions
          </button>
        </div>
      </div>
      
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Market Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalMarketValue, currency)}
          </p>
          {loading && (
            <p className="text-xs text-gray-400 mt-1">Updating...</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalCost, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Gain/Loss</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain, currency)}
            </p>
            {totalGain >= 0 ? (
              <TrendingUp className="text-green-600" size={20} />
            ) : (
              <TrendingDown className="text-red-600" size={20} />
            )}
          </div>
          <p className={`text-sm ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalCost > 0 ? formatPercent((totalGain / totalCost) * 100) : '0.00%'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Holdings</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{holdings.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {prices.size} with live prices
          </p>
        </div>
      </div>
      
      {/* Holdings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Holdings</h2>
        </div>
        
        {holdings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No holdings in this portfolio yet.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Add investments to track your portfolio.
            </p>
          </div>
        ) : (
        <>
        
        {/* Sort Options */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
            <button
              onClick={() => setSortBy('value')}
              className={`text-sm px-3 py-1 rounded ${
                sortBy === 'value' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Value
            </button>
            <button
              onClick={() => setSortBy('gain')}
              className={`text-sm px-3 py-1 rounded ${
                sortBy === 'gain' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Gain/Loss
            </button>
            <button
              onClick={() => setSortBy('shares')}
              className={`text-sm px-3 py-1 rounded ${
                sortBy === 'shares' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Shares
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`text-sm px-3 py-1 rounded ${
                sortBy === 'name' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Name
            </button>
          </div>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Shares
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Current Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Market Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gain/Loss
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  % Portfolio
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedHoldings.map((holding, index) => {
                const livePrice = prices.get(holding.ticker);
                const hasLivePrice = !!livePrice;
                
                return (
                  <tr key={`${holding.ticker}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {holding.ticker}
                        </span>
                        {hasLivePrice && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Live
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {holding.name}
                      {holding.currency && holding.currency !== currency && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({holding.currency})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {holding.shares.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {formatCurrency(holding.averageCost || holding.value / holding.shares, currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatCurrency(holding.currentPrice || 0, currency)}
                        </span>
                        {livePrice && (
                          <span className={`text-xs ${livePrice.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(livePrice.changePercent)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(holding.marketValue || holding.value, currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {holding.gain !== undefined ? (
                        <div className="flex flex-col items-end">
                          <span className={`font-medium ${holding.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {holding.gain >= 0 ? '+' : ''}{formatCurrency(holding.gain, currency)}
                          </span>
                          <span className={`text-xs ${(holding.gainPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(holding.gainPercent || 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${getPercentage(holding.marketValue || holding.value)}%` }}
                          />
                        </div>
                        <span className="text-gray-600 dark:text-gray-400 w-12 text-right">
                          {getPercentage(holding.marketValue || holding.value)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden">
          {sortedHoldings.map((holding, index) => {
            const livePrice = prices.get(holding.ticker);
            const hasLivePrice = !!livePrice;
            
            return (
              <div 
                key={`${holding.ticker}-${index}`}
                className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">{holding.ticker}</p>
                      {hasLivePrice && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{holding.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(holding.marketValue || holding.value, currency)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {getPercentage(holding.marketValue || holding.value)}%
                    </p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {holding.shares.toLocaleString()} @ {formatCurrency(holding.currentPrice || 0, currency)}
                  </span>
                  {holding.gain !== undefined && (
                    <span className={`font-medium ${holding.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {holding.gain >= 0 ? '+' : ''}{formatCurrency(holding.gain, currency)} ({formatPercent(holding.gainPercent || 0)})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Last Update Time */}
        {prices.size > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>Prices updated: {new Date().toLocaleTimeString()}</span>
              </div>
              <span>Live prices from Yahoo Finance</span>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}