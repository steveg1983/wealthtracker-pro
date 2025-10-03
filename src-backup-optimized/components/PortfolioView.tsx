/**
 * PortfolioView Component - Investment portfolio overview
 *
 * Features:
 * - Portfolio value summary
 * - Asset allocation
 * - Performance tracking
 * - Holdings breakdown
 */

import React from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

interface PortfolioViewProps {
  accountId?: string;
  className?: string;
}

interface Holding {
  symbol: string;
  name: string;
  shares: number;
  price: number;
  value: number;
  change: number;
  changePercent: number;
}

export default function PortfolioView({
  accountId,
  className = ''
}: PortfolioViewProps): React.JSX.Element {
  // Mock portfolio data
  const holdings: Holding[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      shares: 10,
      price: 150.25,
      value: 1502.50,
      change: 2.45,
      changePercent: 1.66
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      shares: 5,
      price: 280.15,
      value: 1400.75,
      change: -3.25,
      changePercent: -1.15
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      shares: 3,
      price: 2750.80,
      value: 8252.40,
      change: 15.20,
      changePercent: 0.55
    }
  ];

  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const totalChange = holdings.reduce((sum, holding) => sum + (holding.change * holding.shares), 0);
  const totalChangePercent = totalValue > 0 ? (totalChange / (totalValue - totalChange)) * 100 : 0;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  React.useEffect(() => {
    logger.debug('PortfolioView rendered', { accountId, holdingsCount: holdings.length });
  }, [accountId, holdings.length]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Portfolio Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Portfolio Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalValue)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Value</div>
          </div>

          <div className="text-center">
            <div className={`text-2xl font-bold ${
              totalChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {totalChange >= 0 ? '+' : ''}{formatCurrency(totalChange)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Today's Change</div>
          </div>

          <div className="text-center">
            <div className={`text-2xl font-bold ${
              totalChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(totalChangePercent)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Today's Change %</div>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Holdings</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Shares
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Change
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {holdings.map((holding) => (
                <tr key={holding.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                    {holding.shares.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatCurrency(holding.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatCurrency(holding.value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className={`${
                      holding.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <div>{formatCurrency(holding.change)}</div>
                      <div>{formatPercent(holding.changePercent)}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Asset Allocation
        </h3>

        <div className="space-y-3">
          {holdings.map((holding) => {
            const percentage = (holding.value / totalValue) * 100;
            return (
              <div key={holding.symbol} className="flex items-center">
                <div className="w-16 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {holding.symbol}
                </div>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}