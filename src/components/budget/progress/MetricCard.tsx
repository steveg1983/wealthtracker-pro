/**
 * @component MetricCard
 * @description Reusable metric display card with icon and trend indicator
 */

import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../../icons';
import type { MetricCardProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const MetricCard = memo(function MetricCard({ icon,
  label,
  value,
  trend,
  color = 'text-gray-900'
 }: MetricCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MetricCard component initialized', {
      componentName: 'MetricCard'
    });
  }, []);

  
  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend) {
      case 'up':
        return <TrendingUpIcon size={14} className="text-green-600" />;
      case 'down':
        return <TrendingDownIcon size={14} className="text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="text-gray-500">{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-lg font-semibold ${color}`}>
            {value}
          </p>
        </div>
      </div>
      {getTrendIcon()}
    </div>
  );
});