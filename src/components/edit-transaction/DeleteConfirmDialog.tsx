import React, { useEffect, memo } from 'react';
import { logger } from '../../services/loggingService';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmDialog = memo(function DeleteConfirmDialog({
  isOpen,
  onCancel,
  onConfirm
}: DeleteConfirmDialogProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('DeleteConfirmDialog component initialized', {
      componentName: 'DeleteConfirmDialog'
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete Transaction?
        </h3>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});
