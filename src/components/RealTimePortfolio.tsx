import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { calculatePortfolioMetrics } from '../services/stockPriceService';
import type { PortfolioMetrics } from '../services/stockPriceService';
import { RefreshCwIcon, TrendingUpIcon, TrendingDownIcon, AlertCircleIcon } from './icons';

interface RealTimePortfolioProps {
  accountId: string;
  accountName: string;
  currency: string;
}

interface StockHolding {
  symbol: string;
  shares: number;
  averageCost: number;
  lastUpdated?: Date;
}

export default function RealTimePortfolio({ accountId, accountName, currency }: RealTimePortfolioProps) {
  const { accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const account = accounts.find(a => a.id === accountId);
  const holdings: StockHolding[] = (account?.holdings || []).map(h => ({
    symbol: h.ticker,
    shares: h.shares,
    averageCost: h.averageCost || h.value / h.shares,
    lastUpdated: h.lastUpdated
  }));

  const fetchPortfolioData = useCallback(async () => {
    if (holdings.length === 0) return;

    setIsLoading(true);
    try {
      const decimalHoldings = holdings.map(holding => ({
        symbol: holding.symbol,
        shares: toDecimal(holding.shares),
        averageCost: toDecimal(holding.averageCost),
      }));

      const metrics = await calculatePortfolioMetrics(decimalHoldings, currency);
      setPortfolioMetrics(metrics);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [holdings, currency]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    fetchPortfolioData();
    
    const interval = setInterval(fetchPortfolioData, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchPortfolioData]);

  const handleManualRefresh = () => {
    fetchPortfolioData();
  };

  if (holdings.length === 0) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="text-center py-8">
          <AlertCircleIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Holdings</h3>
          <p className="text-gray-500 dark:text-gray-400">
            This investment account doesn't have any stock holdings configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{accountName}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCwIcon size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Portfolio Summary */}
      {portfolioMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(portfolioMetrics.totalValue)}
                </p>
              </div>
              <TrendingUpIcon className="text-[var(--color-primary)]" size={24} />
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(portfolioMetrics.totalCost)}
                </p>
              </div>
              <TrendingUpIcon className="text-blue-500" size={24} />
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Gain/Loss</p>
                <p className={`text-xl font-bold ${portfolioMetrics.totalGain.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {portfolioMetrics.totalGain.greaterThanOrEqualTo(0) ? '+' : ''}{formatCurrency(portfolioMetrics.totalGain)}
                </p>
              </div>
              <TrendingUpIcon className={portfolioMetrics.totalGain.greaterThanOrEqualTo(0) ? 'text-green-500' : 'text-red-500'} size={24} />
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Return %</p>
                <p className={`text-xl font-bold ${portfolioMetrics.totalGainPercent.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {portfolioMetrics.totalGainPercent.greaterThanOrEqualTo(0) ? '+' : ''}{formatDecimal(portfolioMetrics.totalGainPercent, 2)}%
                </p>
              </div>
              <TrendingDownIcon className={portfolioMetrics.totalGainPercent.greaterThanOrEqualTo(0) ? 'text-green-500' : 'text-red-500'} size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Holdings List */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Holdings</h3>
        
        {isLoading && !portfolioMetrics ? (
          <div className="text-center py-8">
            <RefreshCwIcon className="mx-auto text-gray-400 mb-4 animate-spin" size={32} />
            <p className="text-gray-500 dark:text-gray-400">Loading portfolio data...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {portfolioMetrics?.holdings.map((holding) => (
              <div
                key={holding.symbol}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{holding.symbol}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{holding.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Shares</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatDecimal(holding.shares, 2)}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Price</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(holding.currentPrice)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Market Value</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(holding.marketValue)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Gain/Loss</p>
                    <p className={`font-semibold ${holding.gain.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {holding.gain.greaterThanOrEqualTo(0) ? '+' : ''}{formatCurrency(holding.gain)}
                    </p>
                    <p className={`text-xs ${holding.gainPercent.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {holding.gainPercent.greaterThanOrEqualTo(0) ? '+' : ''}{formatDecimal(holding.gainPercent, 2)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Allocation</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatDecimal(holding.allocation, 1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
