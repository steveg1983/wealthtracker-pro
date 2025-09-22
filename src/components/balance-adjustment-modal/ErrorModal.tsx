import React, { memo } from 'react';
import { XIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface ErrorModalProps {
  onClose: () => void;
}

/**
 * Error state modal for balance adjustment failures
 * Provides user-friendly error messaging and close action
 */
export const ErrorModal = memo(function ErrorModal({ onClose
 }: ErrorModalProps): React.JSX.Element {
  const logger = useLogger();
  try {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm mx-4">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 mb-3">
              <XIcon size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Balance Adjustment Error
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Unable to load balance adjustment form. Please try again.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    logger.error('ErrorModal render error:', error);
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm mx-4">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">
              Critical error occurred
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
});