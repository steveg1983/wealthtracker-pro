import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PlusIcon } from '../components/icons';
import CategoryCreationModal from './CategoryCreationModal';
import { getCurrencySymbol } from '../utils/currency';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';
import MarkdownEditor from './MarkdownEditor';
import { ValidationService } from '../services/validationService';
import { z } from 'zod';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}


interface FormData {
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subCategory: string;
  accountId: string;
  date: string;
  notes: string;
}

export default function AddTransactionModal({ isOpen, onClose }: AddTransactionModalProps): React.JSX.Element {
  const { accounts, addTransaction, categories, getSubCategories, getDetailCategories } = useApp();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const { formData, updateField, handleSubmit } = useModalForm<FormData>(
    {
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      subCategory: '',
      accountId: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    },
    {
      onSubmit: (data) => {
        try {
          // Clear previous errors
          setValidationErrors({});
          
          // Validate the transaction data
          const validatedData = ValidationService.validateTransaction({
            description: data.description,
            amount: data.amount,
            type: data.type === 'transfer' ? 'expense' : data.type,
            category: data.category,
            accountId: data.accountId,
            date: data.date,
            notes: data.notes || undefined,
          });
          
          // If validation passes, add the transaction
          addTransaction({
            description: validatedData.description,
            amount: parseFloat(validatedData.amount),
            type: data.type,
            category: validatedData.category,
            accountId: validatedData.accountId,
            date: new Date(validatedData.date),
            notes: validatedData.notes,
          });
          
          onClose();
        } catch (error) {
          if (error instanceof z.ZodError) {
            setValidationErrors(ValidationService.formatErrors(error));
          } else {
            console.error('Failed to add transaction:', error);
            setValidationErrors({ general: 'Failed to add transaction. Please try again.' });
          }
        }
      },
      onClose: () => {
        setValidationErrors({});
        onClose();
      }
    }
  );


  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Add Transaction" size="md">
        <form onSubmit={handleSubmit}>
          <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateField('type', 'income')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.type === 'income'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label="Select income transaction type"
                  aria-pressed={formData.type === 'income'}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => updateField('type', 'expense')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.type === 'expense'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label="Select expense transaction type"
                  aria-pressed={formData.type === 'expense'}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => updateField('type', 'transfer')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.type === 'transfer'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label="Select transfer transaction type"
                  aria-pressed={formData.type === 'transfer'}
                >
                  Transfer
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="account-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account
              </label>
              <select
                id="account-select"
                value={formData.accountId}
                onChange={(e) => updateField('accountId', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                required
                aria-label="Select account for transaction"
              >
                <option value="">Select account</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                id="description-input"
                type="text"
                value={formData.description}
                onChange={(e) => {
                  updateField('description', e.target.value);
                  if (validationErrors.description) {
                    setValidationErrors(prev => ({ ...prev, description: '' }));
                  }
                }}
                className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 ${validationErrors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-500'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]`}
                placeholder="e.g., Grocery shopping"
                maxLength={500}
                required
                aria-label="Transaction description"
                aria-describedby={validationErrors.description ? "description-error" : undefined}
              />
              {validationErrors.description && (
                <p id="description-error" className="mt-1 text-sm text-red-500" role="alert">{validationErrors.description}</p>
              )}
            </div>

            <div>
              <label htmlFor="amount-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount {formData.accountId && (() => {
                  const selectedAccount = accounts.find(a => a.id === formData.accountId);
                  return selectedAccount ? `(${getCurrencySymbol(selectedAccount.currency)})` : '(£)';
                })()}
              </label>
              <input
                id="amount-input"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => {
                  updateField('amount', e.target.value);
                  if (validationErrors.amount) {
                    setValidationErrors(prev => ({ ...prev, amount: '' }));
                  }
                }}
                className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 ${validationErrors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-500'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]`}
                placeholder="0.00"
                min="0.01"
                required
                aria-label="Transaction amount"
                aria-describedby={validationErrors.amount ? "amount-error" : undefined}
              />
              {validationErrors.amount && (
                <p id="amount-error" className="mt-1 text-sm text-red-500" role="alert">{validationErrors.amount}</p>
              )}
            </div>

            {/* Category Selection */}
            <div className="space-y-3">
              {/* Sub-category */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-sm text-primary hover:text-secondary flex items-center gap-1"
                  >
                    <PlusIcon size={14} />
                    Create new category
                  </button>
                </div>
                <select
                  value={formData.subCategory}
                  onChange={(e) => {
                    updateField('subCategory', e.target.value);
                    updateField('category', ''); // Reset detail category
                  }}
                  className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                  required
                >
                  <option value="">Select category</option>
                  {getSubCategories(`type-${formData.type}`).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Detail category */}
              {formData.subCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sub-category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                    required
                  >
                    <option value="">Select sub-category</option>
                    {getDetailCategories(formData.subCategory).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (Optional)
              </label>
              <MarkdownEditor
                value={formData.notes}
                onChange={(value) => {
                  // Limit notes length
                  if (value.length <= 1000) {
                    updateField('notes', value);
                  }
                }}
                placeholder="Add any additional notes or details..."
                maxHeight="150px"
                className="w-full"
              />
              {formData.notes.length > 900 && (
                <p className="mt-1 text-sm text-gray-500">
                  {1000 - formData.notes.length} characters remaining
                </p>
              )}
            </div>
            {validationErrors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                {validationErrors.general}
              </div>
            )}
          </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm sm:text-base bg-primary text-white rounded-lg hover:bg-secondary"
              >
                Add Transaction
              </button>
            </div>
          </ModalFooter>
        </form>
      </Modal>

        {/* Category Creation Modal */}
        <CategoryCreationModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          initialType={formData.type === 'transfer' ? 'expense' : formData.type}
          onCategoryCreated={(categoryId) => {
            // Find the created category and its parent
            const createdCategory = categories.find(c => c.id === categoryId);
            if (createdCategory) {
              if (createdCategory.level === 'detail') {
                updateField('subCategory', createdCategory.parentId || '');
                updateField('category', categoryId);
              } else {
                updateField('subCategory', categoryId);
                updateField('category', '');
              }
            }
            setShowCategoryModal(false);
          }}
        />
    </>
  );
}
