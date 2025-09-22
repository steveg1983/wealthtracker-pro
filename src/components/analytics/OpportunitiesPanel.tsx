/**
 * Opportunities Panel Component
 * Displays savings opportunities
 */

import React, { useEffect } from 'react';
import { PiggyBankIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { advancedAnalyticsComponentService } from '../../services/advancedAnalyticsComponentService';
import type { SavingsOpportunity } from '../../services/advancedAnalyticsService';
import { useLogger } from '../services/ServiceProvider';

interface OpportunitiesPanelProps {
  opportunities: SavingsOpportunity[];
}

const OpportunitiesPanel = React.memo(({ opportunities }: OpportunitiesPanelProps) => {
  const { formatCurrency } = useCurrencyDecimal();

  if (opportunities.length === 0) {
    const emptyState = advancedAnalyticsComponentService.getEmptyStateMessage('opportunities');
    return (
      <div className="text-center py-12">
        <PiggyBankIcon className="mx-auto h-12 w-12 text-gray-400" />
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
      {opportunities.map((opportunity) => (
        <div
          key={opportunity.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <PiggyBankIcon size={20} className="text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {opportunity.title}
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {opportunity.description}
              </p>
              
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Potential savings: </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(opportunity.potentialSavings)}
                    </span>
                  </span>
                  <span className={`text-sm ${
                    advancedAnalyticsComponentService.getDifficultyColor(opportunity.difficulty)
                  }`}>
                    {opportunity.difficulty} to implement
                  </span>
                </div>
                {/* category not in type; omit display */}
                <span className="text-xs text-gray-500 dark:text-gray-400" />
              </div>
              
              {/* actionSteps not in type; omit section */}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

OpportunitiesPanel.displayName = 'OpportunitiesPanel';

export default OpportunitiesPanel;
