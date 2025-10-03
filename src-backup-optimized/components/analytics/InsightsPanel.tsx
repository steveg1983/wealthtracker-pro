/**
 * Insights Panel Component
 * Displays financial insights
 */

import React, { useEffect } from 'react';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon } from '../icons';
import { advancedAnalyticsComponentService } from '../../services/advancedAnalyticsComponentService';
import type { FinancialInsight } from '../../services/advancedAnalyticsService';
import { useLogger } from '../services/ServiceProvider';

interface InsightsPanelProps {
  insights: FinancialInsight[];
}

const InsightsPanel = React.memo(({ insights }: InsightsPanelProps) => {
  if (insights.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('insights');
    return (
      <div className="text-center py-12">
        <InfoIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {emptyState.title}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {emptyState.description}
        </p>
      </div>
    );
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

  return (
    <div className="space-y-4">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getImpactIcon(insight.impact)}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {insight.title}
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {insight.description}
              </p>
              {insight.actionable && (
                <p className="mt-2 text-sm font-medium text-[var(--color-primary)]">
                  Action recommended
                </p>
              )}
              <div className="mt-2 flex items-center space-x-4">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  advancedAnalyticsComponentService.getPriorityColor(insight.priority)
                }`}>
                  {insight.priority} priority
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {insight.type}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

InsightsPanel.displayName = 'InsightsPanel';

export default InsightsPanel;
