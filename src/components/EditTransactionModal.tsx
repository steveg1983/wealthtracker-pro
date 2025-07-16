import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Calendar, Tag, FileText, Check, Link, Plus, Hash, Wallet, ArrowRightLeft, Banknote } from 'lucide-react';
import type { Transaction } from '../types';
import CategoryCreationModal from './CategoryCreationModal';
import TagSelector from './TagSelector';
import { getCurrencySymbol } from '../utils/currency';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

interface FormData {
  date: string;
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subCategory: string;
  accountId: string;
  tags: string[];
  notes: string;
  cleared: boolean;
  reconciledWith: string;
}

export default function EditTransactionModal({ isOpen, onClose, transaction }: EditTransactionModalProps) {
  const { accounts, categories, addTransaction, updateTransaction, deleteTransaction, getSubCategories, getDetailCategories } = useApp();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
    {
      date: '',
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      subCategory: '',
      accountId: '',
      tags: [],
      notes: '',
      cleared: false,
      reconciledWith: ''
    },
    {
      onSubmit: (data) => {
        const transactionData = {
          date: new Date(data.date),
          description: data.description,
          amount: Math.round((parseFloat(data.amount) || 0) * 100) / 100,
          type: data.type,
          category: data.category,
          accountId: data.accountId,
          tags: data.tags.length > 0 ? data.tags : undefined,
          notes: data.notes.trim() || undefined,
          cleared: data.cleared,
          reconciledWith: data.reconciledWith.trim() || undefined
        };

        if (transaction) {
          updateTransaction(transaction.id, transactionData);
        } else {
          addTransaction(transactionData);
        }
      },
      onClose
    }
  );

  // Get available sub-categories based on transaction type
  const availableSubCategories = getSubCategories(`type-${formData.type}`);

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      const categoryObj = categories.find(c => c.id === transaction.category);
      const subCategoryId = categoryObj?.parentId || '';
      const categoryId = categoryObj?.parentId ? transaction.category : '';
      
      setFormData({
        date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : new Date(transaction.date).toISOString().split('T')[0],
        description: transaction.description,
        amount: Math.abs(transaction.amount).toFixed(2),
        type: transaction.type,
        category: categoryId,
        subCategory: subCategoryId,
        accountId: transaction.accountId,
        tags: transaction.tags || [],
        notes: transaction.notes || '',
        cleared: transaction.cleared || false,
        reconciledWith: transaction.reconciledWith || ''
      });
    } else {
      // Reset form for new transaction
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        date: today,
        description: '',
        amount: '',
        type: 'expense',
        subCategory: '',
        category: '',
        accountId: accounts.length > 0 ? accounts[0].id : '',
        tags: [],
        notes: '',
        cleared: false,
        reconciledWith: ''
      });
    }
    setShowDeleteConfirm(false);
  }, [transaction, accounts, categories, setFormData]);


  const handleDelete = () => {
    if (!transaction) return;
    deleteTransaction(transaction.id);
    onClose();
  };


  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={transaction ? 'Edit Transaction' : 'New Transaction'} size="xl">
        <form onSubmit={handleSubmit}>
          <ModalBody>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Date */}
            <div className="md:col-span-5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar size={16} />
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>

            {/* Account */}
            <div className="md:col-span-7">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Wallet size={16} />
                Account
              </label>
              <select
                value={formData.accountId}
                onChange={(e) => updateField('accountId', e.target.value)}
                className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              >
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FileText size={16} />
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>

            {/* Type */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <ArrowRightLeft size={16} />
                Type
              </label>
              <div className="flex gap-4 items-center h-[42px]">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="income"
                    checked={formData.type === 'income'}
                    onChange={(e) => updateField('type', e.target.value as 'income' | 'expense' | 'transfer')}
                    className="mr-2"
                  />
                  <span className="text-green-600 dark:text-green-400">Income</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="expense"
                    checked={formData.type === 'expense'}
                    onChange={(e) => updateField('type', e.target.value as 'income' | 'expense' | 'transfer')}
                    className="mr-2"
                  />
                  <span className="text-red-600 dark:text-red-400">Expense</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="transfer"
                    checked={formData.type === 'transfer'}
                    onChange={(e) => updateField('type', e.target.value as 'income' | 'expense' | 'transfer')}
                    className="mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Transfer</span>
                </label>
              </div>
            </div>

            {/* Amount */}
            <div className="md:col-span-5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Banknote size={16} />
                Amount {formData.accountId && (() => {
                  const selectedAccount = accounts.find(a => a.id === formData.accountId);
                  return selectedAccount ? `(${getCurrencySymbol(selectedAccount.currency)})` : '';
                })()}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => updateField('amount', e.target.value)}
                className="w-full px-3 py-2 h-[42px] text-right bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>

            {/* Category Selection */}
            <div className="md:col-span-12 space-y-3">
              {/* Sub-category */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Tag size={16} />
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
                  className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                  required
                >
                  <option value="">Select category</option>
                  {availableSubCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Detail category */}
              {formData.subCategory && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <div className="w-4 h-4"></div>
                    Sub-category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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

            {/* Tags */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Hash size={16} />
                Tags
              </label>
              <TagSelector
                selectedTags={formData.tags}
                onTagsChange={(tags) => updateField('tags', tags)}
                placeholder="Search or create tags..."
                allowNewTags={true}
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FileText size={16} />
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 h-[42px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Status */}
            <div className="md:col-span-12 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.cleared}
                  onChange={(e) => updateField('cleared', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <Check size={16} className="text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Reconciled
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData.reconciledWith && formData.reconciledWith !== 'manual'}
                  disabled
                  className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Link size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Linked to bank statement
                </span>
              </label>

              {transaction?.reconciledWith && transaction.reconciledWith !== 'manual' && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <Link size={16} />
                  <span>Reconciled with transaction ID: {transaction.reconciledWith}</span>
                </div>
              )}
            </div>
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

        {/* Delete confirmation */}
        {showDeleteConfirm && (
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
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

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