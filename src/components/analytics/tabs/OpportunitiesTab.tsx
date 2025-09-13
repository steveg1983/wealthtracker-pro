/**
 * Opportunities Tab Component
 * Display savings opportunities in analytics dashboard
 */

import React, { useEffect, memo } from 'react';
import { PiggyBankIcon } from '../../icons';
import { advancedAnalyticsComponentService } from '../../../services/advancedAnalyticsComponentService';
import { toDecimal } from '../../../utils/decimal';
import type { SavingsOpportunity } from '../../../services/advancedAnalyticsService';
import { logger } from '../../../services/loggingService';

interface OpportunitiesTabProps {
  opportunities: SavingsOpportunity[];
  formatCurrency: (amount: any) => string;
}

export const OpportunitiesTab = memo(function OpportunitiesTab({ 
  opportunities,
  formatCurrency 
}: OpportunitiesTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('OpportunitiesTab component initialized', {
      componentName: 'OpportunitiesTab'
    });
  }, []);

  const sortedOpportunities = advancedAnalyticsComponentService.sortOpportunities(opportunities);
  
  const totalSavings = opportunities.reduce(
    (sum, opp) => sum.plus(opp.potentialSavings), 
    toDecimal(0)
  );

  if (opportunities.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('opportunities');
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <PiggyBankIcon size={48} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">{emptyState.title}</p>
        <p className="text-sm mt-1">{emptyState.description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4">
        <p className="text-sm text-green-800 dark:text-green-200">
          <strong>Total Potential Savings:</strong> {formatCurrency(totalSavings)} per year
        </p>
      </div>
      
      {sortedOpportunities.map(opportunity => (
        <div
          key={opportunity.id}
          className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {opportunity.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {opportunity.description}
              </p>
            </div>
            <span className={`text-sm font-medium ${
              advancedAnalyticsComponentService.getDifficultyColor(opportunity.difficulty)
            }`}>
              {opportunity.difficulty}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Potential savings</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatCurrency(opportunity.potentialSavings)}/year
              </p>
            </div>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
              {opportunity.actionRequired}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});