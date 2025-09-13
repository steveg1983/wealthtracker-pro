import React, { memo } from 'react';
import { logger } from '../../services/loggingService';

interface ActionButtonsProps {
  onCancel: () => void;
  isSubmitDisabled?: boolean;
}

/**
 * Action buttons for balance adjustment modal
 * Handles cancel and submit actions with proper styling
 */
export const ActionButtons = memo(function ActionButtons({
  onCancel,
  isSubmitDisabled = false
}: ActionButtonsProps): React.JSX.Element {
  try {
    return (
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="flex-1 px-4 py-2 text-sm sm:text-base bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Adjustment
        </button>
      </div>
    );
  } catch (error) {
    logger.error('ActionButtons render error:', error);
    return (
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg"
        >
          Close
        </button>
      </div>
    );
  }
});