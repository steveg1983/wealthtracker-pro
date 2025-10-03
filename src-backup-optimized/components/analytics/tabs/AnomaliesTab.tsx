/**
 * Anomalies Tab Component
 * Display spending anomalies in analytics dashboard
 */

import React, { useEffect, memo } from 'react';
import { AlertTriangleIcon } from '../../icons';
import { advancedAnalyticsComponentService } from '../../../services/advancedAnalyticsComponentService';
import { format } from 'date-fns';
import type { SpendingAnomaly } from '../../../services/advancedAnalyticsService';
import type { DecimalInstance } from '../../../utils/decimal';
import { useLogger } from '../services/ServiceProvider';

interface AnomaliesTabProps {
  anomalies: SpendingAnomaly[];
  formatCurrency: (amount: DecimalInstance | number) => string;
}

export const AnomaliesTab = memo(function AnomaliesTab({ anomalies,
  formatCurrency 
 }: AnomaliesTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AnomaliesTab component initialized', {
      componentName: 'AnomaliesTab'
    });
  }, []);

  const sortedAnomalies = advancedAnalyticsComponentService.sortAnomalies(anomalies);

  if (anomalies.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('anomalies');
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <AlertTriangleIcon size={48} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">{emptyState.title}</p>
        <p className="text-sm mt-1">{emptyState.description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedAnomalies.map(anomaly => (
        <div
          key={anomaly.id}
          className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  advancedAnalyticsComponentService.getSeverityColor(anomaly.severity)
                }`}>
                  {anomaly.severity} severity
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {format(anomaly.date, 'MMM d, yyyy')}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {anomaly.description}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {anomaly.reason}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  Category: {anomaly.category}
                </span>
                <span className="text-red-600 dark:text-red-400">
                  {anomaly.percentageAboveNormal}% above normal
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(anomaly.amount)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
