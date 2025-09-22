/**
 * EnhancedPortfolioView Component - Advanced portfolio visualization and management
 *
 * Features:
 * - Real-time portfolio performance tracking
 * - Asset allocation charts
 * - Investment timeline and history
 * - Performance analytics and insights
 * - Rebalancing recommendations
 */

import React, { useState, useEffect } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
  assetClass: 'stocks' | 'bonds' | 'real_estate' | 'commodities' | 'crypto' | 'cash';
  sector?: string;
}

interface PortfolioPerformance {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  allTimeHigh: number;
  allTimeLow: number;
}

interface AssetAllocation {
  assetClass: string;
  value: number;
  percentage: number;
  targetPercentage?: number;
}

interface EnhancedPortfolioViewProps {
  userId?: string;
  className?: string;
}

// Mock data for demonstration
const mockHoldings: PortfolioHolding[] = [
  {
    id: 'holding-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    shares: 50,
    currentPrice: 175.50,
    costBasis: 8000.00,
    marketValue: 8775.00,
    gainLoss: 775.00,
    gainLossPercent: 9.69,
    assetClass: 'stocks',
    sector: 'Technology'
  },
  {
    id: 'holding-2',
    symbol: 'VTSAX',
    name: 'Vanguard Total Stock Market Index',
    shares: 100,
    currentPrice: 112.30,
    costBasis: 10500.00,
    marketValue: 11230.00,
    gainLoss: 730.00,
    gainLossPercent: 6.95,
    assetClass: 'stocks',
    sector: 'Diversified'
  },
  {
    id: 'holding-3',
    symbol: 'BND',
    name: 'Vanguard Total Bond Market ETF',
    shares: 75,
    currentPrice: 78.45,
    costBasis: 6000.00,
    marketValue: 5883.75,
    gainLoss: -116.25,
    gainLossPercent: -1.94,
    assetClass: 'bonds'
  }
];

export default function EnhancedPortfolioView({
  userId,
  className = ''
}: EnhancedPortfolioViewProps): React.JSX.Element {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [allocation, setAllocation] = useState<AssetAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'overview' | 'holdings' | 'allocation' | 'performance'>('overview');

  // Load portfolio data
  useEffect(() => {
    const loadPortfolioData = async () => {
      setIsLoading(true);
      try {
        logger.debug('Loading portfolio data for user:', userId);

        // In a real implementation, this would fetch from API
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

        setHoldings(mockHoldings);

        // Calculate performance
        const totalValue = mockHoldings.reduce((sum, h) => sum + h.marketValue, 0);
        const totalCost = mockHoldings.reduce((sum, h) => sum + h.costBasis, 0);
        const totalGainLoss = totalValue - totalCost;

        setPerformance({
          totalValue,
          totalGainLoss,
          totalGainLossPercent: (totalGainLoss / totalCost) * 100,
          dayChange: 245.50,
          dayChangePercent: 0.95,
          allTimeHigh: 28500.00,
          allTimeLow: 22000.00
        });

        // Calculate allocation
        const allocationMap = new Map<string, number>();
        mockHoldings.forEach(holding => {
          const current = allocationMap.get(holding.assetClass) || 0;
          allocationMap.set(holding.assetClass, current + holding.marketValue);
        });

        const allocationData: AssetAllocation[] = Array.from(allocationMap.entries()).map(([assetClass, value]) => ({
          assetClass,
          value,
          percentage: (value / totalValue) * 100,
          targetPercentage: assetClass === 'stocks' ? 70 : assetClass === 'bonds' ? 20 : 10
        }));

        setAllocation(allocationData);
        logger.debug('Portfolio data loaded successfully');
      } catch (error) {
        logger.error('Error loading portfolio data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPortfolioData();
  }, [userId]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Portfolio Overview
        </h1>
        <div className="flex space-x-2">
          {(['overview', 'holdings', 'allocation', 'performance'] as const).map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                selectedView === view
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Summary */}
      {performance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Total Value
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(performance.totalValue)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Total Gain/Loss
            </h3>
            <p className={`text-2xl font-bold ${performance.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(performance.totalGainLoss)}
            </p>
            <p className={`text-sm ${performance.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(performance.totalGainLossPercent)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Day Change
            </h3>
            <p className={`text-2xl font-bold ${performance.dayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(performance.dayChange)}
            </p>
            <p className={`text-sm ${performance.dayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(performance.dayChangePercent)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              All-Time Range
            </h3>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(performance.allTimeHigh)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Low: {formatCurrency(performance.allTimeLow)}
            </p>
          </div>
        </div>
      )}

      {/* Main Content based on selected view */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Holdings Summary */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Top Holdings
            </h3>
            <div className="space-y-3">
              {holdings.slice(0, 5).map(holding => (
                <div key={holding.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {holding.symbol}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {holding.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(holding.marketValue)}
                    </p>
                    <p className={`text-sm ${holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(holding.gainLossPercent)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Allocation */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Asset Allocation
            </h3>
            <div className="space-y-3">
              {allocation.map(asset => (
                <div key={asset.assetClass}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {asset.assetClass.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {asset.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${asset.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedView === 'holdings' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Market Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Gain/Loss
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {holdings.map(holding => (
                  <tr key={holding.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {holding.symbol}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {holding.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {holding.shares}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(holding.currentPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(holding.marketValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(holding.gainLoss)}
                      </div>
                      <div className={`text-xs ${holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(holding.gainLossPercent)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Other views would be implemented similarly */}
      {(selectedView === 'allocation' || selectedView === 'performance') && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {selectedView === 'allocation' ? 'Detailed Asset Allocation' : 'Performance Analytics'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            This view would contain detailed {selectedView} charts and analysis.
          </p>
        </div>
      )}
    </div>
  );
}