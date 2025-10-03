/**
 * @component VelocityMetrics
 * @description Display spending velocity and projections with visual indicators
 */

import { memo, useMemo, useEffect } from 'react';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  ClockIcon,
  CalendarIcon,
  SparklesIcon
} from '../../icons';
import type { VelocityMetricsProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const VelocityMetrics = memo(function VelocityMetrics({ velocity,
  spent,
  remaining,
  daysInPeriod,
  formatCurrency
 }: VelocityMetricsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('VelocityMetrics component initialized', {
      componentName: 'VelocityMetrics'
    });
  }, []);

  
  const trendIcon = useMemo(() => {
    switch (velocity.trend) {
      case 'increasing':
        return <TrendingUpIcon size={16} className="text-red-600" />;
      case 'decreasing':
        return <TrendingDownIcon size={16} className="text-green-600" />;
      default:
        return <ClockIcon size={16} className="text-gray-600" />;
    }
  }, [velocity.trend]);

  const getProjectionColor = () => {
    if (velocity.projectedTotal <= spent * 0.9) return 'text-green-600';
    if (velocity.projectedTotal <= spent * 1.1) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClockIcon size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500">Daily Average</span>
        </div>
        <div className="text-lg font-semibold">
          {formatCurrency(velocity.dailyAverage)}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarIcon size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500">Days Remaining</span>
        </div>
        <div className="text-lg font-semibold">
          {velocity.daysRemaining}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          {trendIcon}
          <span className="text-xs text-gray-500">Spending Trend</span>
        </div>
        <div className="text-lg font-semibold capitalize">
          {velocity.trend}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <SparklesIcon size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500">Projected Total</span>
        </div>
        <div className={`text-lg font-semibold ${getProjectionColor()}`}>
          {formatCurrency(velocity.projectedTotal)}
        </div>
      </div>
    </div>
  );
});