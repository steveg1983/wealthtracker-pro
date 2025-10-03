import React, { useEffect, memo } from 'react';
import { AlertCircleIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface TestDataAlertProps {
  hasTestData: boolean;
}

const TestDataAlert = memo(function TestDataAlert({ hasTestData  }: TestDataAlertProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('TestDataAlert component initialized', {
      componentName: 'TestDataAlert'
    });
  }, []);
  if (!hasTestData) return null;

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 mb-6 flex items-start gap-3">
      <AlertCircleIcon className="text-orange-600 dark:text-orange-400 mt-0.5" size={20} />
      <div>
        <p className="font-medium text-orange-800 dark:text-orange-200">Test Data Active</p>
        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
          You currently have test data loaded. When importing real bank data, you'll be prompted to clear this test data first.
        </p>
      </div>
    </div>
  );
});

export default TestDataAlert;
