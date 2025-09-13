/**
 * Pattern Stats Component
 * Displays summary statistics for spending patterns
 */

import React, { useEffect } from 'react';
import { 
  BarChart3Icon, 
  CalendarIcon, 
  CheckCircleIcon, 
  AlertCircleIcon 
} from '../icons';
import type { PatternStats } from '../../services/spendingPatternsService';
import { logger } from '../../services/loggingService';

interface PatternStatsProps {
  stats: PatternStats;
}

const PatternStats = React.memo(({ stats }: PatternStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Patterns</p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
              {stats.totalPatterns}
            </p>
          </div>
          <BarChart3Icon size={24} className="text-gray-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Recurring</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.recurringCount}
            </p>
          </div>
          <CalendarIcon size={24} className="text-green-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">High Confidence</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.highConfidenceCount}
            </p>
          </div>
          <CheckCircleIcon size={24} className="text-purple-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Anomalies</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.anomalyCount}
            </p>
          </div>
          <AlertCircleIcon size={24} className="text-red-500" />
        </div>
      </div>
    </div>
  );
});

PatternStats.displayName = 'PatternStats';

export default PatternStats;