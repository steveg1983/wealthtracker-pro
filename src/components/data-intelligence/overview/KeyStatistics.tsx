import React, { useEffect, memo } from 'react';
import { 
  SearchIcon,
  CreditCardIcon,
  TrendingUpIcon,
  BellIcon
} from '../../icons';
import type { SpendingInsight, Subscription } from '../../../services/dataIntelligenceService';
type DataIntelligenceStats = {
  totalMerchants: number;
  enrichedMerchants: number;
  categoryAccuracy: number;
  activeSubscriptions: number;
  monthlySubscriptionCost: number;
  patternsDetected: number;
};
import { dataIntelligencePageService } from '../../../services/dataIntelligencePageService';
import { logger } from '../../../services/loggingService';

interface KeyStatisticsProps {
  stats: DataIntelligenceStats;
  detectedSubscriptions: Subscription[];
  insights: SpendingInsight[];
}

const KeyStatistics = memo(function KeyStatistics({
  stats,
  detectedSubscriptions,
  insights
}: KeyStatisticsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('KeyStatistics component initialized', {
      componentName: 'KeyStatistics'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Merchants</p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
              {stats.totalMerchants > 0 ? stats.totalMerchants : '-'}
            </p>
          </div>
          <SearchIcon size={24} className="text-gray-500" />
        </div>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {stats.totalMerchants > 0 
            ? `${stats.enrichedMerchants} enriched (${stats.categoryAccuracy.toFixed(1)}%)`
            : 'No merchants detected yet'
          }
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Subscriptions</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.activeSubscriptions + detectedSubscriptions.length}
            </p>
          </div>
          <CreditCardIcon size={24} className="text-green-500" />
        </div>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {detectedSubscriptions.length > 0 
            ? `${detectedSubscriptions.length} detected`
            : stats.monthlySubscriptionCost > 0 
              ? `${dataIntelligencePageService.formatCurrency(stats.monthlySubscriptionCost)}/month`
              : 'No subscriptions found'
          }
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Patterns Detected</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.patternsDetected}
            </p>
          </div>
          <TrendingUpIcon size={24} className="text-purple-500" />
        </div>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Spending patterns
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Insights</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {insights.length}
            </p>
          </div>
          <BellIcon size={24} className="text-orange-500" />
        </div>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Actionable insights
        </div>
      </div>
    </div>
  );
});

export default KeyStatistics;
