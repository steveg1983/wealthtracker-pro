/**
 * Anomalies Panel Component
 * Displays spending anomalies
 */

import React, { useEffect } from 'react';
import { AlertTriangleIcon } from '../icons';
import { format } from 'date-fns';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { advancedAnalyticsComponentService } from '../../services/advancedAnalyticsComponentService';
import type { SpendingAnomaly } from '../../services/advancedAnalyticsService';
import { logger } from '../../services/loggingService';

interface AnomaliesPanelProps {
  anomalies: SpendingAnomaly[];
}

const AnomaliesPanel = React.memo(({ anomalies }: AnomaliesPanelProps) => {
  const { formatCurrency } = useCurrencyDecimal();

  if (anomalies.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('anomalies');
    return (
      <div className="text-center py-12">
        <AlertTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {emptyState.title}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {emptyState.description}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {anomalies.map((anomaly) => (
        <div
          key={anomaly.id}
          className={`rounded-lg p-4 border ${
            advancedAnalyticsComponentService.getSeverityColor(anomaly.severity)
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <AlertTriangleIcon size={20} />
                <h4 className="text-sm font-medium">
                  {anomaly.description}
                </h4>
              </div>
              <p className="mt-1 text-sm opacity-90">
                {anomaly.category} • {format(new Date(anomaly.date), 'MMM dd, yyyy')}
              </p>
              <div className="mt-2 flex items-center space-x-4">
                <span className="text-sm">
                  Amount: {formatCurrency(anomaly.amount)}
                </span>
                <span className="text-sm">
                  Deviation: {Math.round(Math.abs(anomaly.percentageAboveNormal))}%
                </span>
              </div>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
              anomaly.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
              anomaly.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
            }`}>
              {anomaly.severity}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});

AnomaliesPanel.displayName = 'AnomaliesPanel';

export default AnomaliesPanel;
