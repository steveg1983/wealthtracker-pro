import { memo, useEffect } from 'react';
import { CheckIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface NoDuplicatesFoundProps {
  isImport: boolean;
}

/**
 * No duplicates found component
 * Shows success message when no duplicates are detected
 */
export const NoDuplicatesFound = memo(function NoDuplicatesFound({ isImport }: NoDuplicatesFoundProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('NoDuplicatesFound component initialized', {
      componentName: 'NoDuplicatesFound'
    });
  }, []);

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 text-center">
      <CheckIcon className="mx-auto text-green-600 dark:text-green-400 mb-3" size={48} />
      <h4 className="font-medium text-green-900 dark:text-green-300">
        No duplicates found!
      </h4>
      <p className="text-sm text-green-800 dark:text-green-200 mt-1">
        {isImport 
          ? "All transactions in the import appear to be unique."
          : "Your transaction history doesn't contain any duplicates."
        }
      </p>
    </div>
  );
});