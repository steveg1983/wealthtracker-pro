import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, TrendingDownIcon, AlertTriangleIcon } from '../icons';
import type { DecimalInstance } from '../../types/decimal-types';
import { useLogger } from '../services/ServiceProvider';

export interface HoldingAnalysis {
  symbol: string;
  name: string;
  shares: number;
  currentPrice: DecimalInstance;
  totalValue: DecimalInstance;
  costBasis: DecimalInstance;
  gain: DecimalInstance;
  gainPercent: number;
  allocation: number;
  risk: 'low' | 'medium' | 'high';
  recommendation?: string;
}

interface HoldingsTableProps {
  holdings: HoldingAnalysis[];
  formatCurrency: (value: DecimalInstance | number) => string;
}

export const HoldingsTable = memo(function HoldingsTable({ holdings,
  formatCurrency
 }: HoldingsTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HoldingsTable component initialized', {
      componentName: 'HoldingsTable'
    });
  }, []);

  const getRiskColor = (risk: 'low' | 'medium' | 'high'): string => {
    switch (risk) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-red-600 dark:text-red-400';
    }
  };

  if (holdings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          No holdings found. Add investment transactions to track your portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Portfolio Holdings</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Shares
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Value
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cost Basis
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Gain/Loss
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Allocation
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Risk
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {holdings.map(holding => (
              <tr key={holding.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {holding.symbol}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {holding.name}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                  {holding.shares}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                  {formatCurrency(holding.currentPrice)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(holding.totalValue)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                  {formatCurrency(holding.costBasis)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-medium ${
                      holding.gainPercent >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(holding.gain)}
                    </span>
                    <span className={`text-xs ${
                      holding.gainPercent >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {holding.gainPercent >= 0 ? '+' : ''}{holding.gainPercent.toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                  {holding.allocation.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium ${getRiskColor(holding.risk)}`}>
                    {holding.risk.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Recommendations */}
      {holdings.some(h => h.recommendation) && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-start">
            <AlertTriangleIcon className="text-yellow-600 dark:text-yellow-400 mt-1" size={16} />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Recommendations
              </h4>
              <ul className="mt-2 space-y-1">
                {holdings.filter(h => h.recommendation).map(h => (
                  <li key={h.symbol} className="text-xs text-yellow-700 dark:text-yellow-400">
                    <span className="font-medium">{h.symbol}:</span> {h.recommendation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});