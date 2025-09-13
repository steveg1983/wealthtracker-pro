/**
 * @component ComparisonSection
 * @description State comparison controls for tax calculator
 */

import { memo, useEffect } from 'react';
import { CompareIcon } from '../../icons';
import type { ComparisonSectionProps } from './types';
import { logger } from '../../../services/loggingService';

export const ComparisonSection = memo(function ComparisonSection({
  showComparison,
  onToggleComparison,
  compareStates,
  states,
  onToggleState
}: ComparisonSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ComparisonSection component initialized', {
      componentName: 'ComparisonSection'
    });
  }, []);

  return (
    <div className="mt-6">
      <button
        onClick={onToggleComparison}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
      >
        <CompareIcon size={20} />
        {showComparison ? 'Hide' : 'Show'} State Comparison
      </button>
      
      {showComparison && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Select states to compare:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {states.map(state => (
              <label key={state.code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={compareStates.includes(state.code)}
                  onChange={() => onToggleState(state.code)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{state.code}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});