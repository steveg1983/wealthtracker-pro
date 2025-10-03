import React from 'react';
import {
  BellIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  XCircleIcon,
  DollarSignIcon
} from '../icons';
import type { SpendingInsight } from '../../services/dataIntelligenceService';

interface RecentInsightsProps {
  insights: SpendingInsight[];
  onViewAll: () => void;
  formatDate: (date: Date) => string;
}

export default function RecentInsights({
  insights,
  onViewAll,
  formatDate
}: RecentInsightsProps): React.JSX.Element {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'overspending':
        return <AlertCircleIcon size={16} className="text-red-500" />;
      case 'saving_opportunity':
        return <DollarSignIcon size={16} className="text-green-500" />;
      case 'unusual_spending':
        return <XCircleIcon size={16} className="text-yellow-500" />;
      default:
        return <BellIcon size={16} className="text-blue-500" />;
    }
  };

  const getInsightSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

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
            <div
              key={insight.id}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex-shrink-0 mt-1">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {insight.title}
                  </h4>
                  <span className={`px-2 py-1 text-xs rounded-full ${getInsightSeverityColor(insight.severity)}`}>
                    {insight.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {insight.description}
                </p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(insight.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}