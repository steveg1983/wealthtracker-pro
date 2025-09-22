import { memo, useEffect } from 'react';
import type { Asset, EfficientFrontierPoint } from '../../../services/portfolioOptimizationService';
import { formatCurrency } from '../../../utils/formatters';
import { useLogger } from '../services/ServiceProvider';

interface PortfolioAllocationProps {
  assets: Asset[];
  portfolio: EfficientFrontierPoint | null;
  portfolioValue: number;
  isSelected?: boolean;
}

/**
 * Portfolio allocation display component
 * Shows the allocation breakdown and statistics
 */
export const PortfolioAllocation = memo(function PortfolioAllocation({ assets,
  portfolio,
  portfolioValue,
  isSelected = false
 }: PortfolioAllocationProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioAllocation component initialized', {
      componentName: 'PortfolioAllocation'
    });
  }, []);

  if (!portfolio) return null;

  return (
    <div className="mb-6">
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">
        {isSelected ? 'Selected' : 'Optimal'} Portfolio Allocation
      </h4>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Expected Return</p>
          <p className="text-lg font-semibold text-gray-600 dark:text-gray-500">
            {(portfolio.return * 100).toFixed(2)}%
          </p>
        </div>
        
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Risk (Volatility)</p>
          <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
            {(portfolio.risk * 100).toFixed(2)}%
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            {portfolio.sharpeRatio.toFixed(3)}
          </p>
        </div>
      </div>

      {/* Allocation Breakdown */}
      <div className="space-y-2">
        {assets.map((asset, index) => {
          const weight = portfolio.weights[asset.symbol] || 0;
          const value = portfolioValue * weight;
          
          return (
            <div key={asset.symbol} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <div 
                  className="w-2 h-8 rounded" 
                  style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }} 
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{asset.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{asset.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {(weight * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatCurrency(value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
