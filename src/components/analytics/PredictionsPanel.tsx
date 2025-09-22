/**
 * Predictions Panel Component
 * Displays spending predictions
 */

import React, { useEffect } from 'react';
import { TrendingUpIcon, ArrowUpIcon, ArrowDownIcon } from '../icons';
import { format } from 'date-fns';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { advancedAnalyticsComponentService } from '../../services/advancedAnalyticsComponentService';
import type { SpendingPrediction } from '../../services/advancedAnalyticsService';
import { useLogger } from '../services/ServiceProvider';

interface PredictionsPanelProps {
  predictions: SpendingPrediction[];
}

const PredictionsPanel = React.memo(({ predictions }: PredictionsPanelProps) => {
  const { formatCurrency } = useCurrencyDecimal();

  if (predictions.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('predictions');
    return (
      <div className="text-center py-12">
        <TrendingUpIcon className="mx-auto h-12 w-12 text-gray-400" />
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
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {predictions.map((prediction) => (
        <div
          key={prediction.category}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {prediction.category}
            </h4>
            <span className={`text-sm font-medium ${
              advancedAnalyticsComponentService.getConfidenceColor(prediction.confidence)
            }`}>
              {advancedAnalyticsComponentService.formatConfidence(prediction.confidence)} confidence
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Next period</span>
              <span className="flex items-center space-x-1">
                {prediction.trend === 'increasing' ? (
                  <ArrowUpIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                ) : prediction.trend === 'decreasing' ? (
                  <ArrowDownIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : null}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(prediction.predictedAmount)}
                </span>
              </span>
            </div>
            
            {/* explanation not present in type; omit */}
          </div>
        </div>
      ))}
    </div>
  );
});

PredictionsPanel.displayName = 'PredictionsPanel';

export default PredictionsPanel;
