import { memo } from 'react';
import { AlertCircleIcon, TrendingUpIcon, AlertTriangleIcon, CheckCircleIcon } from '../../components/icons';
import type { Insight } from './types';

interface InsightsPanelProps {
  insights: Insight[];
}

/**
 * Panel displaying AI-generated financial insights
 * Shows trends, anomalies, budget alerts, and goal progress
 */
export const InsightsPanel = memo(function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
        <TrendingUpIcon size={48} className="text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Insights Available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Insights will appear as we analyze your financial data
        </p>
      </div>
    );
  }

  const getIcon = (severity: Insight['severity']) => {
    switch (severity) {
      case 'success':
        return CheckCircleIcon;
      case 'warning':
        return AlertTriangleIcon;
      case 'error':
        return AlertCircleIcon;
      default:
        return TrendingUpIcon;
    }
  };

  const getSeverityStyles = (severity: Insight['severity']) => {
    switch (severity) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const getIconStyles = (severity: Insight['severity']) => {
    switch (severity) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-4">
      {insights.map((insight, index) => {
        const Icon = getIcon(insight.severity);
        return (
          <div
            key={index}
            className={`rounded-lg border p-4 ${getSeverityStyles(insight.severity)}`}
          >
            <div className="flex items-start space-x-3">
              <Icon className={`${getIconStyles(insight.severity)} flex-shrink-0 mt-0.5`} size={20} />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {insight.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {insight.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});