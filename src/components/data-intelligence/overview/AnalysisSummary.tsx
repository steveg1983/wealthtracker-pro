import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, ClockIcon } from '../../icons';
type DataIntelligenceStats = {
  lastAnalysisRun: Date;
  categoryAccuracy: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
};
import { logger } from '../../../services/loggingService';

interface AnalysisSummaryProps {
  stats: DataIntelligenceStats;
  formatDate: (date: Date) => string;
}

const AnalysisSummary = memo(function AnalysisSummary({
  stats,
  formatDate
}: AnalysisSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AnalysisSummary component initialized', {
      componentName: 'AnalysisSummary'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUpIcon size={20} className="text-purple-600 dark:text-purple-400" />
          Analysis Summary
        </h3>
        <ClockIcon size={16} className="text-gray-400" />
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Last Analysis:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(stats.lastAnalysisRun)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Data Quality:</span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${stats.categoryAccuracy}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {stats.categoryAccuracy.toFixed(0)}%
            </span>
          </div>
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.activeSubscriptions}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {stats.cancelledSubscriptions}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AnalysisSummary;
