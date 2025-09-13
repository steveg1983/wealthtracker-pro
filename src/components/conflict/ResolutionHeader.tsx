/**
 * Resolution Header Component
 * Displays conflict status and smart resolution availability
 */

import React, { useEffect } from 'react';
import { AlertTriangleIcon } from '../icons';
import { ConflictAnalysis } from '../../services/conflictResolutionService';
import { logger } from '../../services/loggingService';

interface ResolutionHeaderProps {
  analysis: ConflictAnalysis;
  conflictEntity: string;
}

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M7 11L6 8l-3-1 3-1 1-3 1 3 3 1-3 1-1 3zm5 8l-1-2.5L8.5 15l2.5-1 1-2.5 1 2.5 2.5 1-2.5 1.5L12 19zm7-15l-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3z"/>
  </svg>
);

const ResolutionHeader = React.memo(({ analysis, conflictEntity }: ResolutionHeaderProps) => {
  if (analysis.canAutoResolve) {
    return (
      <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <SparklesIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-green-900 dark:text-green-100">
            Smart Resolution Available
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            We can automatically merge these changes with {analysis.confidence}% confidence.
            {analysis.conflictingFields.length > 0 && 
              ` ${analysis.conflictingFields.length} field(s) have conflicts but can be resolved intelligently.`
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
      <AlertTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="font-medium text-amber-900 dark:text-amber-100">
          Manual Resolution Required
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
          This {conflictEntity} was modified in incompatible ways. Please review the changes and choose how to resolve.
        </p>
      </div>
    </div>
  );
});

ResolutionHeader.displayName = 'ResolutionHeader';

export default ResolutionHeader;