import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon, CheckIcon } from '../icons';
import type { BudgetRecommendation } from '../../services/budgetRecommendationService';
import { useLogger } from '../services/ServiceProvider';

interface RecommendationCardProps {
  recommendation: BudgetRecommendation;
  isSelected: boolean;
  onToggleSelect: () => void;
  onApply: () => void;
  formatCurrency: (amount: any) => string;
}

export const RecommendationCard = memo(function RecommendationCard({ recommendation,
  isSelected,
  onToggleSelect,
  onApply,
  formatCurrency
 }: RecommendationCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RecommendationCard component initialized', {
      componentName: 'RecommendationCard'
    });
  }, []);

  const getTrendIcon = () => {
    if (recommendation.spendingTrend === 'increasing') {
      return <TrendingUpIcon size={16} className="text-orange-500" />;
    }
    if (recommendation.spendingTrend === 'decreasing') {
      return <TrendingDownIcon size={16} className="text-green-500" />;
    }
    return null;
  };

  const getPriorityColor = () => {
    switch (recommendation.priority) {
      case 'high': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      default: return 'border-gray-300';
    }
  };

  return (
    <div className={`p-4 border-l-4 rounded-lg ${getPriorityColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="rounded border-gray-300"
            />
            <h4 className="font-medium text-gray-900 dark:text-white">
              {recommendation.categoryName}
            </h4>
            {getTrendIcon()}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              recommendation.priority === 'high' ? 'bg-red-100 text-red-700' :
              recommendation.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {recommendation.priority} priority
            </span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {recommendation.reasoning}
          </p>
          
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">Current: </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(recommendation.currentBudget || 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Recommended: </span>
              <span className="font-medium text-green-600">
                {formatCurrency(recommendation.recommendedBudget)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Avg Spending: </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(recommendation.averageSpending)}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={onApply}
          className="ml-4 p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          title="Apply this recommendation"
        >
          <CheckIcon size={20} />
        </button>
      </div>
    </div>
  );
});
