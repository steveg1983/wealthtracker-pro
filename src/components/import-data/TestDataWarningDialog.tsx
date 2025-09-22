import { memo, useEffect } from 'react';
import { AlertTriangleIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface TestDataWarningDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onContinue: () => void;
  onClearAndImport: () => void;
}

/**
 * Test data warning dialog component
 * Warns user about existing test data before import
 */
export const TestDataWarningDialog = memo(function TestDataWarningDialog({ isOpen,
  onCancel,
  onContinue,
  onClearAndImport
 }: TestDataWarningDialogProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('TestDataWarningDialog component initialized', {
      componentName: 'TestDataWarningDialog'
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangleIcon className="text-orange-500" size={24} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Test Data Detected</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          You currently have test data loaded in your application. You're about to import real bank data.
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Would you like to:
        </p>
        <div className="space-y-3 mb-6">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-white">Clear test data first (Recommended)</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Remove all test data and start fresh with your real bank data
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="font-medium text-gray-800 dark:text-gray-200">Continue with test data</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Mix your real bank data with the existing test data
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Continue
          </button>
          <button
            onClick={onClearAndImport}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            Clear & Import
          </button>
        </div>
      </div>
    </div>
  );
});
