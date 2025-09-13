import React, { useEffect, memo } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import CategoryCreationModal from '../CategoryCreationModal';
import { useEditTransaction } from './useEditTransaction';
import { BasicInfoForm } from './BasicInfoForm';
import { TransactionTypeSelector } from './TransactionTypeSelector';
import { AmountInput } from './AmountInput';
import { CategorySelector } from './CategorySelector';
import { MetadataFields } from './MetadataFields';
import { StatusFields } from './StatusFields';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import type { EditTransactionModalProps } from './types';
import { logger } from '../../services/loggingService';

const EditTransactionModal = memo(function EditTransactionModal({ 
  isOpen, 
  onClose, 
  transaction 
}: EditTransactionModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EditTransactionModal component initialized', {
      componentName: 'EditTransactionModal'
    });
  }, []);

  const {
    formData,
    updateField,
    handleSubmit,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showCategoryModal,
    setShowCategoryModal,
    formattedAmount,
    amountInputRef,
    availableSubCategories,
    accounts,
    getDetailCategories,
    handleDelete,
    handleAmountChange,
    handleAmountBlur,
    handleAmountFocus,
    handleCategoryCreated
  } = useEditTransaction(transaction, onClose);

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={transaction ? 'Edit Transaction' : 'New Transaction'} 
        size="xl"
      >
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <BasicInfoForm
                date={formData.date}
                accountId={formData.accountId}
                description={formData.description}
                accounts={accounts}
                onDateChange={(value) => updateField('date', value)}
                onAccountChange={(value) => updateField('accountId', value)}
                onDescriptionChange={(value) => updateField('description', value)}
              />

              <TransactionTypeSelector
                type={formData.type}
                onChange={(value) => updateField('type', value)}
              />

              <AmountInput
                amount={formData.amount}
                formattedAmount={formattedAmount}
                accountId={formData.accountId}
                accounts={accounts}
                inputRef={amountInputRef}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                onFocus={handleAmountFocus}
              />

              <CategorySelector
                subCategory={formData.subCategory}
                category={formData.category}
                availableSubCategories={availableSubCategories}
                detailCategories={getDetailCategories(formData.subCategory)}
                onSubCategoryChange={(value) => updateField('subCategory', value)}
                onCategoryChange={(value) => updateField('category', value)}
                onCreateNew={() => setShowCategoryModal(true)}
              />

              <MetadataFields
                tags={formData.tags}
                notes={formData.notes}
                transactionId={transaction?.id}
                onTagsChange={(value) => updateField('tags', value)}
                onNotesChange={(value) => updateField('notes', value)}
              />

              <StatusFields
                cleared={formData.cleared}
                reconciledWith={formData.reconciledWith}
                transactionReconciledWith={transaction?.reconciledWith}
                onClearedChange={(value) => updateField('cleared', value)}
              />
            </div>
          </ModalBody>
          
          <ModalFooter>
            <div className="flex justify-between gap-3 w-full">
              {transaction && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Delete
                </button>
              )}
              
              <div className="flex gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
                >
                  {transaction ? 'Save Changes' : 'Add Transaction'}
                </button>
              </div>
            </div>
          </ModalFooter>
        </form>
      </Modal>

      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />

      <CategoryCreationModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        initialType={formData.type === 'transfer' ? 'expense' : formData.type}
        onCategoryCreated={handleCategoryCreated}
      />
    </>
  );
});

export default EditTransactionModal;