/**
 * @component HoldingsTable
 * @description Enterprise-grade holdings table with sorting and filtering
 */

import { memo, useMemo, useEffect } from 'react';
import { RealTimePortfolioService } from '../../../services/realTimePortfolioService';
import { HoldingRow } from './HoldingRow';
import type { HoldingsTableProps, StockHolding } from './types';
import { useLogger } from '../services/ServiceProvider';

export const HoldingsTable = memo(function HoldingsTable({ holdings,
  quotes,
  searchQuery,
  sortBy,
  formatCurrency
 }: HoldingsTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HoldingsTable component initialized', {
      componentName: 'HoldingsTable'
    });
  }, []);

  
  const filteredAndSortedHoldings = useMemo(() => {
    let filtered = holdings;
    
    // Apply search filter
    if (searchQuery) {
      filtered = holdings.filter(h => 
        h.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting (cast to EnhancedHolding[] as sortHoldings expects)
    return RealTimePortfolioService.sortHoldings(filtered as any, sortBy);
  }, [holdings, quotes, searchQuery, sortBy]);

  if (filteredAndSortedHoldings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {searchQuery ? 'No holdings match your search' : 'No holdings to display'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Symbol
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Shares
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Value
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cost Basis
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Gain/Loss
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Day Change
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Allocation
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {filteredAndSortedHoldings.map((holding) => (
            <HoldingRow
              key={holding.symbol}
              holding={holding}
              formatCurrency={formatCurrency}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});