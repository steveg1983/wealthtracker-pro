import React, { useEffect, memo } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { LoadingButton } from '../loading/LoadingState';
import CategoryCreationModal from '../CategoryCreationModal';
import { useAddTransaction } from './useAddTransaction';
import { TransactionForm } from './TransactionForm';
import type { AddTransactionModalProps, FormData, ValidationErrors } from './types';
import { useLogger } from '../services/ServiceProvider';

const AddTransactionModal = memo(function AddTransactionModal({ isOpen, 
  onClose 
 }: AddTransactionModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('AddTransactionModal component initialized', {
        isOpen,
        componentName: 'AddTransactionModal'
      });
    } catch (error) {
      logger.error('AddTransactionModal initialization failed:', error, 'AddTransactionModal');
    }
  }, [isOpen]);

  const {
    formData,
    updateField,
    handleSubmit,
    isSubmitting,
    showCategoryModal,
    setShowCategoryModal,
    validationErrors,
    accounts,
    availableSubCategories,
    getDetailCategories,
    handleCategoryCreated
  } = useAddTransaction(onClose);

  try {
    return (
      <>
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Add New Transaction"
          size="lg"
        >
        <form onSubmit={(e) => {
          try {
            handleSubmit(e);
          } catch (error) {
            logger.error('Error submitting transaction form:', error, 'AddTransactionModal');
          }
        }}>
          <ModalBody>
            {/* Error display for validation errors */}
            {validationErrors.general && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.general}</p>
              </div>
            )}
            
            {(() => {
              try {
                return (
                  <TransactionForm
                    formData={formData}
                    updateField={updateField}
                    accounts={accounts}
                    availableSubCategories={availableSubCategories}
                    detailCategories={getDetailCategories(formData?.subCategory || '') || []}
                    onOpenCategoryModal={() => {
                      try {
                        setShowCategoryModal(true);
                      } catch (error) {
                        logger.error('Error opening category modal:', error, 'AddTransactionModal');
                      }
                    }}
                    validationErrors={validationErrors}
                  />
                );
              } catch (error) {
                logger.error('Failed to render transaction form:', error, 'AddTransactionModal');
                return (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                    <p className="text-red-600 dark:text-red-400 text-sm">⚠️ Form unavailable</p>
                  </div>
                );
              }
            })()}
          </ModalBody>
          
          <ModalFooter>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    onClose();
                  } catch (error) {
                    logger.error('Error closing add transaction modal:', error, 'AddTransactionModal');
                  }
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <LoadingButton
                isLoading={isSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                Add Transaction
              </LoadingButton>
            </div>
          </ModalFooter>
        </form>
      </Modal>

      {(() => {
        try {
          return (
            <CategoryCreationModal
              isOpen={showCategoryModal}
              onClose={() => {
                try {
                  setShowCategoryModal(false);
                } catch (error) {
                  logger.error('Error closing category modal:', error, 'AddTransactionModal');
                }
              }}
              initialType={formData.type === 'transfer' ? 'expense' : formData.type}
              onCategoryCreated={(category) => {
                try {
                  handleCategoryCreated(category);
                } catch (error) {
                  logger.error('Error handling category creation:', error, 'AddTransactionModal');
                }
              }}
            />
          );
        } catch (error) {
          logger.error('Failed to render category creation modal:', error, 'AddTransactionModal');
          return null;
        }
      })()}
    </>
    );
  } catch (error) {
    logger.error('Failed to render AddTransactionModal:', error, 'AddTransactionModal');
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
            Transaction Form Error
          </h3>
          <p className="text-red-600 dark:text-red-400 mb-4">
            Failed to load transaction form. Please try refreshing the page.
          </p>
          <button
            onClick={() => {
              try {
                onClose();
              } catch (closeError) {
                logger.error('Error closing modal from error state:', closeError, 'AddTransactionModal');
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
});

export default AddTransactionModal;
