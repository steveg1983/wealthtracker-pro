/**
 * Credit Score Indicator Component
 * Displays credit score category and description
 */

import React, { useEffect, memo } from 'react';
import { usMortgageFormService } from '../../../services/usMortgageFormService';
import { useLogger } from '../services/ServiceProvider';

interface CreditScoreIndicatorProps {
  score: number;
}

export const CreditScoreIndicator = memo(function CreditScoreIndicator({ score 
 }: CreditScoreIndicatorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CreditScoreIndicator component initialized', {
      componentName: 'CreditScoreIndicator'
    });
  }, []);

  const category = usMortgageFormService.getCreditScoreCategory(score);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`font-medium ${category.color}`}>
        {category.label}
      </span>
      <span className="text-gray-500 dark:text-gray-400">
        {category.description}
      </span>
    </div>
  );
});