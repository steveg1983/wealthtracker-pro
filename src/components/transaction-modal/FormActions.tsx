import { memo, useEffect } from 'react';
import { logger } from '../../services/loggingService';

interface FormActionsProps {
  isEditMode: boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * Form action buttons component
 */
export const FormActions = memo(function FormActions({
  isEditMode,
  onCancel,
  isSubmitting = false
}: FormActionsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('FormActions component initialized', {
        isEditMode,
        isSubmitting,
        componentName: 'FormActions'
      });
    } catch (error) {
      logger.error('FormActions initialization failed:', error, 'FormActions');
    }
  }, [isEditMode, isSubmitting]);

  try {
    return (
      <>
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => {
              try {
                logger.debug('Form cancel button clicked', { 
                  isEditMode, 
                  componentName: 'FormActions' 
                });
                onCancel();
              } catch (error) {
                logger.error('Failed to handle cancel action:', error, 'FormActions');
              }
            }}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            aria-describedby="submit-hint"
          >
            {(() => {
              try {
                if (isSubmitting) {
                  return (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {isEditMode ? 'Saving...' : 'Adding...'}
                    </>
                  );
                }
                return isEditMode ? 'Save Changes' : 'Add Transaction';
              } catch (error) {
                logger.error('Failed to determine button text:', error, 'FormActions');
                return 'Submit';
              }
            })()}
          </button>
        </div>
        <p id="submit-hint" className="sr-only">
          {(() => {
            try {
              return isEditMode 
                ? 'Click to save your changes to this transaction' 
                : 'Click to add this new transaction to your account';
            } catch (error) {
              logger.error('Failed to generate submit hint:', error, 'FormActions');
              return 'Click to submit the form';
            }
          })()}
        </p>
      </>
    );
  } catch (error) {
    logger.error('Failed to render FormActions:', error, 'FormActions');
    return (
      <div className="flex gap-3 pt-4">
        <div className="text-red-600 dark:text-red-400 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
          Error rendering form actions
        </div>
      </div>
    );
  }
});