import { memo, useEffect } from 'react';
import { TargetIcon, AlertTriangleIcon, TrendingUpIcon } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

interface OptimizationTargetSelectorProps {
  target: 'sharpe' | 'minRisk' | 'maxReturn';
  onTargetChange: (target: 'sharpe' | 'minRisk' | 'maxReturn') => void;
}

/**
 * Optimization target selector component
 * Allows selection of portfolio optimization strategy
 */
export const OptimizationTargetSelector = memo(function OptimizationTargetSelector({ target,
  onTargetChange
 }: OptimizationTargetSelectorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('OptimizationTargetSelector component initialized', {
      componentName: 'OptimizationTargetSelector'
    });
  }, []);

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Optimization Target
      </label>
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onTargetChange('sharpe')}
          className={`p-3 rounded-lg border transition-colors ${
            target === 'sharpe'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
          }`}
        >
          <TargetIcon size={20} className="mx-auto mb-1 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium">Max Sharpe Ratio</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Best risk-adjusted returns</p>
        </button>
        
        <button
          onClick={() => onTargetChange('minRisk')}
          className={`p-3 rounded-lg border transition-colors ${
            target === 'minRisk'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
          }`}
        >
          <AlertTriangleIcon size={20} className="mx-auto mb-1 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm font-medium">Minimum Risk</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Lowest volatility</p>
        </button>
        
        <button
          onClick={() => onTargetChange('maxReturn')}
          className={`p-3 rounded-lg border transition-colors ${
            target === 'maxReturn'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
          }`}
        >
          <TrendingUpIcon size={20} className="mx-auto mb-1 text-green-600 dark:text-green-400" />
          <p className="text-sm font-medium">Maximum Return</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Highest expected return</p>
        </button>
      </div>
    </div>
  );
});