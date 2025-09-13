import React, { useEffect, memo } from 'react';
import { AlertCircleIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface TestDataWarningProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export const TestDataWarning = memo(function TestDataWarning({ 
  onCancel, 
  onConfirm 
}: TestDataWarningProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TestDataWarning component initialized', {
      componentName: 'TestDataWarning'
    });
  }, []);

  return (
    <div className="text-center">
      <AlertCircleIcon size={48} className="mx-auto text-yellow-500 mb-4" />
      <h3 className="text-lg font-semibold mb-2">Clear Test Data?</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        You have test data loaded. Importing real data will clear all existing test data.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Clear Test Data & Import
        </button>
      </div>
    </div>
  );
});