import React, { useEffect, memo } from 'react';
import { InfoIcon } from '../../icons';
import { retirement401kService } from '../../../services/retirement401kService';
import { useLogger } from '../services/ServiceProvider';

interface IrsLimitsInfoProps {
  currentAge: number;
  formatCurrency: (value: number) => string;
}

export const IrsLimitsInfo = memo(function IrsLimitsInfo({ currentAge,
  formatCurrency
 }: IrsLimitsInfoProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('IrsLimitsInfo component initialized', {
      componentName: 'IrsLimitsInfo'
    });
  }, []);

  const limits = retirement401kService.getContributionLimits();
  const isEligibleForCatchUp = retirement401kService.isEligibleForCatchUp(currentAge);
  const maxContribution = retirement401kService.getMaxContribution(currentAge);

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <InfoIcon size={16} className="text-gray-500 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            2024 IRS Contribution Limits
          </h4>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div>• Regular limit: {formatCurrency(limits.regular)}</div>
            {isEligibleForCatchUp && (
              <div>• Catch-up (50+): +{formatCurrency(limits.catchUp)}</div>
            )}
            <div>• Your max: {formatCurrency(maxContribution)}</div>
          </div>
        </div>
      </div>
    </div>
  );
});