import { memo, forwardRef, useEffect } from 'react';
import { XIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface FormHeaderProps {
  isEditMode: boolean;
  onClose: () => void;
}

/**
 * Transaction modal header component
 */
export const FormHeader = memo(forwardRef<HTMLButtonElement, FormHeaderProps>(
  function FormHeader({ isEditMode, onClose }, ref): React.JSX.Element {
    // Component initialization logging
    useEffect(() => {
      try {
        logger.info('FormHeader component initialized', {
          isEditMode,
          componentName: 'FormHeader'
        });
      } catch (error) {
        logger.error('FormHeader initialization failed:', error, 'FormHeader');
      }
    }, [isEditMode]);

    try {
      return (
        <div className="flex justify-between items-center mb-4">
          <h2 id="modal-title" className="text-xl font-semibold dark:text-white">
            {(() => {
              try {
                return isEditMode ? 'Edit Transaction' : 'Add Transaction';
              } catch (error) {
                logger.error('Failed to determine modal title:', error, 'FormHeader');
                return 'Transaction';
              }
            })()}
          </h2>
          <button
            ref={ref}
            onClick={() => {
              try {
                logger.debug('Form modal close button clicked', { 
                  isEditMode, 
                  componentName: 'FormHeader' 
                });
                onClose();
              } catch (error) {
                logger.error('Failed to handle close action:', error, 'FormHeader');
              }
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close modal"
          >
            {(() => {
              try {
                return <XIcon size={24} />;
              } catch (error) {
                logger.error('Failed to render close icon:', error, 'FormHeader');
                return '×';
              }
            })()}
          </button>
        </div>
      );
    } catch (error) {
      logger.error('Failed to render FormHeader:', error, 'FormHeader');
      return (
        <div className="flex justify-between items-center mb-4">
          <div className="text-red-600 dark:text-red-400 text-sm">
            Error rendering form header
          </div>
          <button
            ref={ref}
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
      );
    }
  }
));