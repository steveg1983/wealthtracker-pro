import React, { useState, useMemo } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { useRealTimePrices } from '../hooks/useRealTimePrices';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { convertStockPrice } from '../services/stockPriceService';
import type { DecimalInstance } from '../types/decimal-types';
import { 
  RefreshCwIcon, 
  TrendingUpIcon, 
  TrendingDownIcon, 
  AlertCircleIcon,
  ActivityIcon,
  WifiIcon,
  WifiOffIcon
} from './icons';
import { LoadingState } from './loading/LoadingState';
import { Skeleton } from './loading/Skeleton';

interface StockHolding {
  symbol: string;
  shares: DecimalInstance;
  averageCost: DecimalInstance;
  costBasis: DecimalInstance;
}

interface RealTimePortfolioEnhancedProps {
  holdings: StockHolding[];
  baseCurrency: string;
  className?: string;
}

export default function RealTimePortfolioEnhanced({ holdings, 
  baseCurrency,
  className = ''
 }: RealTimePortfolioEnhancedProps) {
  const logger = useLogger();
  const { formatCurrency } = useCurrencyDecimal();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const symbols = useMemo(() => holdings.map(h => h.symbol), [holdings]);
  
  const { 
    quotes, 
    isLoading, 
    error, 
    lastUpdate, 
    marketStatus,
    refresh 
  } = useRealTimePrices({ 
    symbols,
    enabled: true,
    onUpdate: (update) => {
      // Optional: Add animation or notification for price updates
      logger.debug('Price updated', { symbol: update.symbol, price: update.quote.price });
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let totalValue = toDecimal(0);
    let totalCost = toDecimal(0);
    let totalDayChange = toDecimal(0);
    
    const enhancedHoldings = holdings.map(holding => {
      const quote = quotes.get(holding.symbol);
      const currentPrice = quote?.price || holding.averageCost;
      const dayChange = quote?.change || toDecimal(0);
      const dayChangePercent = quote?.changePercent || toDecimal(0);
      
      const marketValue = currentPrice.times(holding.shares);
      const gain = marketValue.minus(holding.costBasis);
      const gainPercent = holding.costBasis.greaterThan(0) 
        ? gain.dividedBy(holding.costBasis).times(100) 
        : toDecimal(0);
      
      totalValue = totalValue.plus(marketValue);
      totalCost = totalCost.plus(holding.costBasis);
      totalDayChange = totalDayChange.plus(dayChange.times(holding.shares));
      
      return {
        ...holding,
        quote,
        currentPrice,
        marketValue,
        gain,
        gainPercent,
        dayChange,
        dayChangePercent,
        allocation: toDecimal(0) // Will be calculated after
      };
    });
    
    // Calculate allocations
    enhancedHoldings.forEach(holding => {
      holding.allocation = totalValue.greaterThan(0) 
        ? holding.marketValue.dividedBy(totalValue).times(100) 
        : toDecimal(0);
    });
    
    const totalGain = totalValue.minus(totalCost);
    const totalGainPercent = totalCost.greaterThan(0) 
      ? totalGain.dividedBy(totalCost).times(100) 
      : toDecimal(0);
    const totalDayChangePercent = totalValue.minus(totalDayChange).greaterThan(0)
      ? totalDayChange.dividedBy(totalValue.minus(totalDayChange)).times(100)
      : toDecimal(0);
    
    return {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
      totalDayChange,
      totalDayChangePercent,
      holdings: enhancedHoldings
    };
  }, [holdings, quotes]);

  if (holdings.length === 0) {
    return (
      <div className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 ${className}`}>
        <div className="text-center py-8">
          <AlertCircleIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Holdings</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Add stocks to your portfolio to see real-time prices and performance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with market status */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Real-Time Portfolio</h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
            </p>
            <div className="flex items-center gap-2">
              {marketStatus.isOpen ? (
                <>
                  <WifiIcon size={16} className="text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">Market Open</span>
                </>
              ) : (
                <>
                  <WifiOffIcon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Market Closed</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCwIcon size={16} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
              {isLoading ? (
                <Skeleton variant="text" className="w-24 h-8" />
              ) : (
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(portfolioMetrics.totalValue)}
                </p>
              )}
            </div>
            <ActivityIcon className="text-primary" size={24} />
          </div>
        </div>

        {/* Day Change */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">Day Change</p>
              {isLoading ? (
                <Skeleton variant="text" className="w-24 h-8" />
              ) : (
                <>
                  <p className={`text-xl font-bold ${
                    portfolioMetrics.totalDayChange.greaterThanOrEqualTo(0) 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {portfolioMetrics.totalDayChange.greaterThanOrEqualTo(0) ? '+' : ''}
                    {formatCurrency(portfolioMetrics.totalDayChange)}
                  </p>
                  <p className={`text-sm ${
                    portfolioMetrics.totalDayChangePercent.greaterThanOrEqualTo(0) 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {portfolioMetrics.totalDayChangePercent.greaterThanOrEqualTo(0) ? '+' : ''}
                    {portfolioMetrics.totalDayChangePercent.toFixed(2)}%
                  </p>
                </>
              )}
            </div>
            {portfolioMetrics.totalDayChange.greaterThanOrEqualTo(0) ? (
              <TrendingUpIcon className="text-green-500" size={24} />
            ) : (
              <TrendingDownIcon className="text-red-500" size={24} />
            )}
          </div>
        </div>

        {/* Total Gain/Loss */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Gain/Loss</p>
              {isLoading ? (
                <Skeleton variant="text" className="w-24 h-8" />
              ) : (
                <>
                  <p className={`text-xl font-bold ${
                    portfolioMetrics.totalGain.greaterThanOrEqualTo(0) 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {portfolioMetrics.totalGain.greaterThanOrEqualTo(0) ? '+' : ''}
                    {formatCurrency(portfolioMetrics.totalGain)}
                  </p>
                  <p className={`text-sm ${
                    portfolioMetrics.totalGainPercent.greaterThanOrEqualTo(0) 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {portfolioMetrics.totalGainPercent.greaterThanOrEqualTo(0) ? '+' : ''}
                    {portfolioMetrics.totalGainPercent.toFixed(2)}%
                  </p>
                </>
              )}
            </div>
            {portfolioMetrics.totalGain.greaterThanOrEqualTo(0) ? (
              <TrendingUpIcon className="text-green-500" size={24} />
            ) : (
              <TrendingDownIcon className="text-red-500" size={24} />
            )}
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Invested</p>
              {isLoading ? (
                <Skeleton variant="text" className="w-24 h-8" />
              ) : (
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(portfolioMetrics.totalCost)}
                </p>
              )}
            </div>
            <TrendingUpIcon className="text-blue-500" size={24} />
          </div>
        </div>
      </div>

      {/* Holdings List with Real-Time Prices */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Holdings</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        <div className="space-y-3">
          {portfolioMetrics.holdings.map((holding) => (
            <div
              key={holding.symbol}
              className="relative overflow-hidden"
            >
              {/* Price update animation */}
              {holding.quote && (
                <div className="absolute inset-0 bg-primary/10 dark:bg-primary/20 animate-pulse pointer-events-none opacity-0 price-update" />
              )}
              
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {holding.symbol}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {holding.shares.toFixed(2)} shares @ {formatCurrency(holding.averageCost)}
                      </p>
                    </div>
                    {holding.quote && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-green-600 dark:text-green-400">Live</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6 text-right">
                  {/* Current Price */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
                    {isLoading ? (
                      <Skeleton variant="text" className="w-16 h-6" />
                    ) : (
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(holding.currentPrice)}
                      </p>
                    )}
                  </div>

                  {/* Day Change */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Day</p>
                    {isLoading ? (
                      <Skeleton variant="text" className="w-16 h-6" />
                    ) : (
                      <p className={`font-semibold ${
                        holding.dayChange.greaterThanOrEqualTo(0) 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {holding.dayChange.greaterThanOrEqualTo(0) ? '+' : ''}
                        {holding.dayChangePercent.toFixed(2)}%
                      </p>
                    )}
                  </div>

                  {/* Market Value */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Value</p>
                    {isLoading ? (
                      <Skeleton variant="text" className="w-20 h-6" />
                    ) : (
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(holding.marketValue)}
                      </p>
                    )}
                  </div>

                  {/* Gain/Loss */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Gain/Loss</p>
                    {isLoading ? (
                      <Skeleton variant="text" className="w-20 h-6" />
                    ) : (
                      <>
                        <p className={`font-semibold ${
                          holding.gain.greaterThanOrEqualTo(0) 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {holding.gain.greaterThanOrEqualTo(0) ? '+' : ''}
                          {formatCurrency(holding.gain)}
                        </p>
                        <p className={`text-xs ${
                          holding.gainPercent.greaterThanOrEqualTo(0) 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {holding.gainPercent.greaterThanOrEqualTo(0) ? '+' : ''}
                          {holding.gainPercent.toFixed(2)}%
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Add CSS for price update animation
const style = document.createElement('style');
style.textContent = `
  @keyframes priceFlash {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }
  
  .price-update {
    animation: priceFlash 0.5s ease-in-out;
  }
`;
document.head.appendChild(style);
