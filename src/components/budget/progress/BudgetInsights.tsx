/**
 * @component BudgetInsights
 * @description Intelligent budget insights with actionable recommendations
 */

import { memo, useMemo, useCallback, useEffect } from 'react';
import {
  InfoIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  SparklesIcon
} from '../../icons';
import type { BudgetInsightsProps, BudgetInsight } from './types';
import { logger } from '../../../services/loggingService';

export const BudgetInsights = memo(function BudgetInsights({
  insights,
  budget,
  metrics,
  formatCurrency
}: BudgetInsightsProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetInsights component initialized', {
      componentName: 'BudgetInsights'
    });
  }, []);

  
  const getInsightIcon = useCallback((type: BudgetInsight['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon size={16} className="text-green-600" />;
      case 'warning':
        return <AlertTriangleIcon size={16} className="text-yellow-600" />;
      case 'danger':
        return <AlertTriangleIcon size={16} className="text-red-600" />;
      case 'info':
      default:
        return <InfoIcon size={16} className="text-blue-600" />;
    }
  }, []);

  const getInsightColorClass = useCallback((type: BudgetInsight['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'danger':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  }, []);

  const generatedInsights = useMemo(() => {
    const results: BudgetInsight[] = [...insights];
    
    // Add velocity-based insights
    if (metrics.velocity.isOnTrack) {
      results.push({
        type: 'success',
        message: `You're on track! Keep spending under ${formatCurrency(metrics.velocity.recommendedDailyBudget)} per day.`
      });
    } else if (metrics.velocity.projectedTotal > budget.amount * 1.2) {
      results.push({
        type: 'danger',
        message: `At current pace, you'll exceed budget by ${formatCurrency(metrics.velocity.projectedTotal - budget.amount)}.`
      });
    } else if (metrics.velocity.projectedTotal > budget.amount) {
      results.push({
        type: 'warning',
        message: `Slow down spending to stay within budget. Aim for ${formatCurrency(metrics.velocity.recommendedDailyBudget)} daily.`
      });
    }

    // Add savings opportunity
    if (metrics.percentage < 50 && metrics.velocity.daysRemaining < 10) {
      results.push({
        type: 'info',
        message: `Great job! You might save ${formatCurrency(metrics.remaining)} this period.`,
        icon: <SparklesIcon size={16} className="text-blue-600" />
      });
    }

    return results;
  }, [insights, metrics, budget, formatCurrency]);

  if (generatedInsights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Budget Insights
      </h4>
      {generatedInsights.map((insight, index) => (
        <div
          key={index}
          className={`flex items-start gap-2 p-3 rounded-lg border ${getInsightColorClass(insight.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {insight.icon || getInsightIcon(insight.type)}
          </div>
          <div className="flex-1">
            <p className="text-sm">{insight.message}</p>
            {insight.action && (
              <button
                onClick={insight.action.onClick}
                className="text-sm font-medium underline mt-1 hover:no-underline"
              >
                {insight.action.label}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});
