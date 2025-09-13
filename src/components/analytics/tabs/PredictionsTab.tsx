/**
 * Predictions Tab Component
 * Display spending predictions in analytics dashboard
 */

import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, ArrowUpIcon, ArrowDownIcon } from '../../icons';
import { advancedAnalyticsComponentService } from '../../../services/advancedAnalyticsComponentService';
import type { SpendingPrediction } from '../../../services/advancedAnalyticsService';
import type { DecimalInstance } from '../../../utils/decimal';
import { logger } from '../../../services/loggingService';

interface PredictionsTabProps {
  predictions: SpendingPrediction[];
  formatCurrency: (amount: DecimalInstance | number) => string;
}

export const PredictionsTab = memo(function PredictionsTab({ 
  predictions,
  formatCurrency 
}: PredictionsTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PredictionsTab component initialized', {
      componentName: 'PredictionsTab'
    });
  }, []);

  const sortedPredictions = advancedAnalyticsComponentService.sortPredictions(predictions);

  if (predictions.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('predictions');
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <TrendingUpIcon size={48} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">{emptyState.title}</p>
        <p className="text-sm mt-1">{emptyState.description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Next Month Forecast:</strong> Based on your spending patterns, 
          we predict your expenses for each category next month.
        </p>
      </div>
      
      {sortedPredictions.map(prediction => (
        <div
          key={prediction.category}
          className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {prediction.category}
            </h3>
            <div className="flex items-center gap-2">
              {prediction.trend === 'increasing' ? (
                <ArrowUpIcon size={16} className="text-red-600 dark:text-red-400" />
              ) : prediction.trend === 'decreasing' ? (
                <ArrowDownIcon size={16} className="text-green-600 dark:text-green-400" />
              ) : (
                <span className="w-4 h-0.5 bg-gray-400" />
              )}
              <span className={`text-sm ${
                prediction.trend === 'increasing' 
                  ? 'text-red-600 dark:text-red-400'
                  : prediction.trend === 'decreasing'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {prediction.trend}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Predicted</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(prediction.predictedAmount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Avg</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(prediction.monthlyAverage)}
              </p>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gray-600 h-2 rounded-full"
                  style={{ width: `${prediction.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {advancedAnalyticsComponentService.formatConfidence(prediction.confidence)} confidence
              </span>
            </div>
          </div>
          
          {prediction.recommendation && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-500">
              =� {prediction.recommendation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
});
