import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import type { InsuranceRecommendation } from './types';
import { logger } from '../../services/loggingService';

interface RecommendationCardProps {
  recommendation: InsuranceRecommendation;
}

export const RecommendationCard = memo(function RecommendationCard({ 
  recommendation 
}: RecommendationCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RecommendationCard component initialized', {
      componentName: 'RecommendationCard'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <h4 className="font-semibold text-gray-900">{recommendation.type}</h4>
            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
              recommendation.priority === 'high' ? 'bg-red-100 text-red-700' :
              recommendation.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {recommendation.priority} priority
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{recommendation.reason}</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Current:</span>
              <p className="font-medium">{formatCurrency(recommendation.currentCoverage)}</p>
            </div>
            <div>
              <span className="text-gray-600">Recommended:</span>
              <p className="font-medium">{formatCurrency(recommendation.recommendedCoverage)}</p>
            </div>
            <div>
              <span className="text-gray-600">Gap:</span>
              <p className="font-medium text-red-600">{formatCurrency(recommendation.gap)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});