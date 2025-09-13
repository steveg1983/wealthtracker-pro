/**
 * @component MoversSection
 * @description Display top gainers and losers in the portfolio
 */

import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../../icons';
import type { MoversSectionProps } from './types';
import type { StockHolding } from '../../../services/realTimePortfolioService';
import { logger } from '../../../services/loggingService';

export const MoversSection = memo(function MoversSection({
  gainers,
  losers,
  quotes,
  formatCurrency
}: MoversSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('MoversSection component initialized', {
      componentName: 'MoversSection'
    });
  }, []);

  
  const renderMover = (holding: StockHolding, isGainer: boolean) => {
    const quote = quotes[holding.symbol];
    if (!quote) return null;
    
    const changePercent = quote.changePercent;
    const changeValue = holding.shares.toNumber() * quote.change;
    
    return (
      <div key={holding.symbol} className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          {isGainer ? (
            <TrendingUpIcon size={16} className="text-green-600" />
          ) : (
            <TrendingDownIcon size={16} className="text-red-600" />
          )}
          <span className="font-medium">{holding.symbol}</span>
        </div>
        <div className="text-right">
          <div className={isGainer ? 'text-green-600' : 'text-red-600'}>
            {isGainer ? '+' : ''}{changePercent.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">
            {formatCurrency(changeValue)}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Today's Movers
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-green-600 mb-2">Top Gainers</h4>
          <div className="space-y-1">
            {gainers.length > 0 ? (
              gainers.map(holding => renderMover(holding, true))
            ) : (
              <p className="text-sm text-gray-500">No gainers today</p>
            )}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-red-600 mb-2">Top Losers</h4>
          <div className="space-y-1">
            {losers.length > 0 ? (
              losers.map(holding => renderMover(holding, false))
            ) : (
              <p className="text-sm text-gray-500">No losers today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});