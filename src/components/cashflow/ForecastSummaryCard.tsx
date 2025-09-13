/**
 * Forecast Summary Card Component
 * World-class financial summary with institutional clarity
 */

import React, { useEffect, memo } from 'react';
import { logger } from '../../services/loggingService';
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  ActivityIcon 
} from '../icons';

interface ForecastSummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color: string;
}

/**
 * Premium summary card with dynamic icons
 */
export const ForecastSummaryCard = memo(function ForecastSummaryCard({
  title,
  value,
  subtitle,
  icon,
  color
}: ForecastSummaryCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ForecastSummaryCard component initialized', {
      componentName: 'ForecastSummaryCard'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`text-xl font-bold ${getTextColor(color)}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <CardIcon icon={icon} color={color} />
      </div>
    </div>
  );
});

/**
 * Card icon
 */
const CardIcon = memo(function CardIcon({
  icon,
  color
}: {
  icon: string;
  color: string;
}): React.JSX.Element {
  const iconClass = `${color}`;
  
  switch (icon) {
    case 'trending-up':
      return <TrendingUpIcon className={iconClass} size={24} />;
    case 'trending-down':
      return <TrendingDownIcon className={iconClass} size={24} />;
    case 'activity':
    default:
      return <ActivityIcon className={iconClass} size={24} />;
  }
});

/**
 * Get text color for value
 */
function getTextColor(color: string): string {
  switch (color) {
    case 'text-green-500':
      return 'text-green-600 dark:text-green-400';
    case 'text-red-500':
      return 'text-red-600 dark:text-red-400';
    case 'text-primary':
    default:
      return 'text-gray-900 dark:text-white';
  }
}