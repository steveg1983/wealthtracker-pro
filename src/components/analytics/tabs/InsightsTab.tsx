/**
 * Insights Tab Component
 * Display financial insights in analytics dashboard
 */

import React, { useEffect, memo } from 'react';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, LightbulbIcon } from '../../icons';
import { advancedAnalyticsComponentService } from '../../../services/advancedAnalyticsComponentService';
import type { FinancialInsight } from '../../../services/advancedAnalyticsService';
import { useLogger } from '../services/ServiceProvider';

interface InsightsTabProps {
  insights: FinancialInsight[];
}

const getImpactIcon = (impact: 'positive' | 'negative' | 'neutral') => {
  switch (impact) {
    case 'positive':
      return <CheckCircleIcon size={20} className="text-green-600 dark:text-green-400" />;
    case 'negative':
      return <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400" />;
    case 'neutral':
      return <InfoIcon size={20} className="text-gray-600 dark:text-gray-500" />;
  }
};

export const InsightsTab = memo(function InsightsTab({ insights  }: InsightsTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InsightsTab component initialized', {
      componentName: 'InsightsTab'
    });
  }, []);

  const sortedInsights = advancedAnalyticsComponentService.sortInsights(insights);

  if (insights.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('insights');
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <LightbulbIcon size={48} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">{emptyState.title}</p>
        <p className="text-sm mt-1">{emptyState.description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedInsights.map(insight => (
        <div
          key={insight.id}
          className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
        >
          <div className="flex items-start gap-4">
            {getImpactIcon(insight.impact)}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {insight.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {insight.description}
              </p>
              {insight.actionable && (
                <button className="mt-2 text-sm text-gray-600 dark:text-gray-500 hover:underline">
                  Take action �
                </button>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              advancedAnalyticsComponentService.getPriorityColor(insight.priority)
            }`}>
              {insight.priority} priority
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});