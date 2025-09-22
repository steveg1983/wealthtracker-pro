import { memo, useEffect } from 'react';
import { AlertCircleIcon } from '../icons';
import type { MappedData } from '../../services/migrationWizardService';
import { useLogger } from '../services/ServiceProvider';

interface ReviewStepProps {
  mappedData: MappedData;
}

/**
 * Review step component
 * Extracted from DataMigrationWizard for single responsibility
 */
export const ReviewStep = memo(function ReviewStep({ mappedData  }: ReviewStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ReviewStep component initialized', {
      componentName: 'ReviewStep'
    });
  }, []);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Review Import Summary
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Please review the data that will be imported
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Accounts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mappedData.accounts}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transactions</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mappedData.transactions}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Categories</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mappedData.categories}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date Range</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {mappedData.dateRange}
          </p>
        </div>
      </div>

      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircleIcon size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-1">
              Important Note
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Duplicate transactions will be automatically detected and skipped during import.
              Your existing data will not be affected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});