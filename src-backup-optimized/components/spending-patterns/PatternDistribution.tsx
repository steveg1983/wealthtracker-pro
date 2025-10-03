/**
 * Pattern Distribution Component
 * Shows distribution of pattern types
 */

import React, { useEffect } from 'react';
import { LineChartIcon } from '../icons';
import { spendingPatternsService } from '../../services/spendingPatternsService';
import type { PatternDistribution } from '../../services/spendingPatternsService';
import type { SpendingPattern } from '../../services/dataIntelligenceService';
import { useLogger } from '../services/ServiceProvider';
import {
  CalendarIcon,
  ClockIcon,
  TrendingUpIcon,
  AlertCircleIcon
} from '../icons';

interface PatternDistributionProps {
  distribution: PatternDistribution[];
}

const PatternDistribution = React.memo(({ distribution }: PatternDistributionProps) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'recurring':
        return <CalendarIcon size={16} className="text-gray-600 dark:text-gray-500" />;
      case 'seasonal':
        return <ClockIcon size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'trend':
        return <TrendingUpIcon size={16} className="text-green-600 dark:text-green-400" />;
      case 'anomaly':
        return <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <LineChartIcon size={18} />
        Pattern Distribution
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {distribution.map(({ type, count, percentage }) => (
          <div key={type} className="text-center">
            <div className="flex items-center justify-center mb-2">
              {getIcon(type)}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
});

PatternDistribution.displayName = 'PatternDistribution';

export default PatternDistribution;