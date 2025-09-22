/**
 * @component RecommendationsList
 * @description List of budget recommendations grouped by priority
 */

import { memo, useEffect } from 'react';
import { RecommendationCard } from './RecommendationCard';
import type { RecommendationsListProps } from './types';
import type { BudgetRecommendation } from '../../services/budgetRecommendationService';
import { useLogger } from '../services/ServiceProvider';

export const RecommendationsList = memo(function RecommendationsList({ highPriority,
  other,
  selectedRecommendations,
  onToggleSelect,
  onApply,
  formatCurrency
 }: RecommendationsListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RecommendationsList component initialized', {
      componentName: 'RecommendationsList'
    });
  }, []);

  return (
    <div className="space-y-6">
      {highPriority.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            High Priority
          </h3>
          <div className="space-y-3">
            {highPriority.map((rec: BudgetRecommendation) => (
              <RecommendationCard
                key={rec.categoryId}
                recommendation={rec}
                isSelected={selectedRecommendations.has(rec.categoryId)}
                onToggleSelect={() => onToggleSelect(rec.categoryId)}
                onApply={() => onApply(rec)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </section>
      )}

      {other.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Other Recommendations
          </h3>
          <div className="space-y-3">
            {other.map((rec: BudgetRecommendation) => (
              <RecommendationCard
                key={rec.categoryId}
                recommendation={rec}
                isSelected={selectedRecommendations.has(rec.categoryId)}
                onToggleSelect={() => onToggleSelect(rec.categoryId)}
                onApply={() => onApply(rec)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
});