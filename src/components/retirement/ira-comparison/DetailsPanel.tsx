import React, { useEffect, memo } from 'react';
import { InfoIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface DetailsPanelProps {
  showDetails: boolean;
  onToggle: () => void;
}

export const DetailsPanel = memo(function DetailsPanel({ showDetails, onToggle }: DetailsPanelProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DetailsPanel component initialized', {
      componentName: 'DetailsPanel'
    });
  }, []);

  return (
    <div className="mt-6">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark"
      >
        <InfoIcon size={16} />
        {showDetails ? 'Hide' : 'Show'} Important Details
      </button>
      
      {showDetails && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3 text-sm">
          <div>
            <h5 className="font-medium text-gray-900 dark:text-white mb-1">
              2024 Contribution Limits
            </h5>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Under 50: $7,000</li>
              <li>• 50 and older: $8,000 (includes $1,000 catch-up)</li>
              <li>• Total across all IRAs cannot exceed these limits</li>
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-900 dark:text-white mb-1">
              Income Phase-Out Ranges (2024)
            </h5>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Traditional IRA deduction phase-out starts at $77K (single)</li>
              <li>• Roth IRA contribution phase-out starts at $146K (single)</li>
              <li>• Higher limits for married filing jointly</li>
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-900 dark:text-white mb-1">
              Key Considerations
            </h5>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Traditional: Tax deduction now, taxed in retirement</li>
              <li>• Roth: No deduction now, tax-free in retirement</li>
              <li>• Required Minimum Distributions (RMDs) apply to Traditional at 73</li>
              <li>• Roth has no RMDs during owner's lifetime</li>
              <li>• Consider backdoor Roth if income is too high</li>
            </ul>
          </div>
          
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> This calculator provides estimates based on current tax law. 
              Consult a tax professional for personalized advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});