import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Plus } from 'lucide-react';
import CategoryCreationModal from './CategoryCreationModal';
import { getCurrencySymbol } from '../utils/currency';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';

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
}

export default function AddTransactionModal({ isOpen, onClose }: AddTransactionModalProps) {
  const { accounts, addTransaction, categories, getSubCategories, getDetailCategories } = useApp();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  const { formData, updateField, handleSubmit } = useModalForm<FormData>(
    {
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      subCategory: '',
      accountId: '',
      date: new Date().toISOString().split('T')[0]
    },
    {
      onSubmit: (data) => {
        if (!data.description || !data.amount || !data.category || !data.accountId) return;
        
        addTransaction({
          description: data.description,
          amount: Math.round(parseFloat(data.amount) * 100) / 100,
          type: data.type,
          category: data.category,
          accountId: data.accountId,
          date: new Date(data.date),
        });
      },
      onClose
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
                >
                  Transfer
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account
              </label>
              <select
                value={formData.accountId}
                onChange={(e) => updateField('accountId', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                required
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                placeholder="e.g., Grocery shopping"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount {formData.accountId && (() => {
                  const selectedAccount = accounts.find(a => a.id === formData.accountId);
                  return selectedAccount ? `(${getCurrencySymbol(selectedAccount.currency)})` : '(£)';
                })()}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => updateField('amount', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                placeholder="0.00"
                required
              />
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
                    <Plus size={14} />
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
