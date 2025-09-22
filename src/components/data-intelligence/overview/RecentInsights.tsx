import React, { useEffect, memo } from 'react';
import { BellIcon, CheckCircleIcon } from '../../icons';
import InsightCard from '../InsightCard';
import type { SpendingInsight } from '../../../services/dataIntelligenceService';
import { useLogger } from '../services/ServiceProvider';

interface RecentInsightsProps {
  insights: SpendingInsight[];
  onViewAll: () => void;
}

const RecentInsights = memo(function RecentInsights({ insights,
  onViewAll
 }: RecentInsightsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RecentInsights component initialized', {
      componentName: 'RecentInsights'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BellIcon size={20} className="text-orange-600 dark:text-orange-400" />
          Recent Insights
        </h3>
        <button
          onClick={onViewAll}
          className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
        >
          View All
        </button>
      </div>
      
      {insights.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircleIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">No active insights</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.slice(0, 3).map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
});

export default RecentInsights;