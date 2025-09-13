import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { CalendarIcon, TagIcon, FileTextIcon, CheckIcon2, LinkIcon, PlusIcon, HashIcon, WalletIcon, ArrowRightLeftIcon, BanknoteIcon, PaperclipIcon } from '../components/icons';
import type { Transaction } from '../types';
import CategoryCreationModal from './CategoryCreationModal';
import TagSelector from './TagSelector';
import { getCurrencySymbol } from '../utils/currency';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { RadioCheckbox } from './common/RadioCheckbox';
import { useModalForm } from '../hooks/useModalForm';
import MarkdownEditor from './MarkdownEditor';
import DocumentManager from './DocumentManager';
import { ValidationService } from '../services/validationService';
import { z } from 'zod';
import { logger } from '../services/loggingService';

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

export default function EditTransactionModal({ isOpen, onClose, transaction }: EditTransactionModalProps): React.JSX.Element {
  const { accounts, categories, updateTransaction, deleteTransaction, getSubCategories, getDetailCategories } = useApp();
  const { addTransaction } = useTransactionNotifications();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formattedAmount, setFormattedAmount] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize form with transaction data if editing, otherwise use defaults
  const initialFormData: FormData = transaction ? {
    date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : new Date(transaction.date).toISOString().split('T')[0],
    description: transaction.description,
    amount: transaction.type === 'transfer' ? transaction.amount.toString() : Math.abs(transaction.amount).toString(),
    type: transaction.type,
    category: '',  // Will be set in useEffect
    subCategory: '', // Will be set in useEffect
    accountId: transaction.accountId,
    tags: transaction.tags || [],
    notes: transaction.notes || '',
    cleared: transaction.cleared || false,
    reconciledWith: transaction.reconciledWith || ''
  } : {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense',
    category: '',
    subCategory: '',
    accountId: accounts.length > 0 ? accounts[0].id : '',
    tags: [],
    notes: '',
    cleared: false,
    reconciledWith: ''
  };
  
  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
    initialFormData,
    {
      onSubmit: (data) => {
        try {
          // Clear previous errors
          setValidationErrors({});
          
          // Validate the transaction data
          const validatedData = ValidationService.validateTransaction({
            id: transaction?.id,
            description: data.description,
            amount: data.amount,
            type: data.type === 'transfer' ? 'expense' : data.type,
            category: data.category,
            accountId: data.accountId,
            date: data.date,
            tags: data.tags.length > 0 ? data.tags : undefined,
            notes: data.notes.trim() || undefined,
          });
          
          const transactionData = {
            date: new Date(validatedData.date),
            description: validatedData.description,
            amount: parseFloat(validatedData.amount),
            type: data.type,
            category: validatedData.category,
            accountId: validatedData.accountId,
            tags: validatedData.tags,
            notes: validatedData.notes,
            cleared: data.cleared,
            reconciledWith: data.reconciledWith.trim() || undefined
          };

          if (transaction) {
            updateTransaction(transaction.id, transactionData);
          } else {
            addTransaction(transactionData);
          }
          
          onClose();
        } catch (error) {
          if (error instanceof z.ZodError) {
            setValidationErrors(ValidationService.formatErrors(error));
          } else {
            logger.error('Failed to update transaction:', error);
            setValidationErrors({ general: 'Failed to update transaction. Please try again.' });
          }
        }
      },
      onClose: () => {
        setValidationErrors({});
        onClose();
      }
    }
  );

  // Get available sub-categories based on transaction type
  const availableSubCategories = getSubCategories(`type-${formData.type}`);

  // Helper function to format number with commas
  const formatWithCommas = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    
    const isNegative = num < 0;
    const formatted = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(num));
    
    return isNegative ? `-${formatted}` : formatted;
  };

  // Helper function to parse formatted string back to number
  const parseFormattedAmount = (value: string): string => {
    return value.replace(/,/g, '');
  };

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      const categoryObj = categories.find(c => c.id === transaction.category);
      const subCategoryId = categoryObj?.parentId || '';
      const categoryId = categoryObj?.parentId ? transaction.category : '';
      
      // For transfers, preserve the sign to show transfer direction
      // For income/expense, always use absolute value since type determines sign
      const amountValue = transaction.type === 'transfer' 
        ? transaction.amount.toString()
        : Math.abs(transaction.amount).toString();
        
      setFormData({
        date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : new Date(transaction.date).toISOString().split('T')[0],
        description: transaction.description,
        amount: amountValue,
        type: transaction.type,
        category: categoryId,
        subCategory: subCategoryId,
        accountId: transaction.accountId,
        tags: transaction.tags || [],
        notes: transaction.notes || '',
        cleared: transaction.cleared || false,
        reconciledWith: transaction.reconciledWith || ''
      });
      // Set formatted amount for display
      setFormattedAmount(formatWithCommas(amountValue));
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
      setFormattedAmount('');
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
                <CalendarIcon size={16} />
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                required
              />
            </div>

            {/* Account */}
            <div className="md:col-span-7">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <WalletIcon size={16} />
                Account
              </label>
              <select
                value={formData.accountId}
                onChange={(e) => updateField('accountId', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
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
                <FileTextIcon size={16} />
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                required
              />
            </div>

            {/* Type */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <ArrowRightLeftIcon size={16} />
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
                <BanknoteIcon size={16} />
                Amount {formData.accountId && (() => {
                  const selectedAccount = accounts.find(a => a.id === formData.accountId);
                  return selectedAccount ? `(${getCurrencySymbol(selectedAccount.currency)})` : '';
                })()}
              </label>
              <input
                ref={amountInputRef}
                type="text"
                value={formattedAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow numbers, commas, decimal point, and minus sign
                  if (value === '' || value === '-' || /^-?[0-9,]*\.?[0-9]{0,2}$/.test(value)) {
                    setFormattedAmount(value);
                    // Update the underlying numeric value
                    const numericValue = parseFormattedAmount(value);
                    if (numericValue === '' || numericValue === '-' || !isNaN(parseFloat(numericValue))) {
                      updateField('amount', numericValue);
                    }
                  }
                }}
                onBlur={() => {
                  // Reformat on blur to ensure proper formatting
                  if (formData.amount && formData.amount !== '') {
                    setFormattedAmount(formatWithCommas(formData.amount));
                  }
                }}
                onFocus={() => {
                  // Select all text on focus for easy editing
                  if (amountInputRef.current) {
                    amountInputRef.current.select();
                  }
                }}
                placeholder="0.00"
                className={`w-full px-3 py-2 h-[42px] text-right bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  formData.amount && parseFloat(formData.amount) < 0
                    ? 'text-red-600 dark:text-red-400'
                    : formData.amount && parseFloat(formData.amount) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                }`}
                required
              />
            </div>

            {/* Category Selection */}
            <div className="md:col-span-12 space-y-3">
              {/* Sub-category */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <TagIcon size={16} />
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
                  className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
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
                    className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
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
                <HashIcon size={16} />
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
                <FileTextIcon size={16} />
                Notes
              </label>
              <MarkdownEditor
                value={formData.notes}
                onChange={(value) => updateField('notes', value)}
                placeholder="Add notes... You can use **bold**, *italic*, [links](url), `code`, lists, etc."
                maxHeight="200px"
                className="w-full"
              />
            </div>
            
            {/* Document Attachments */}
            {transaction && (
              <div className="md:col-span-12">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <PaperclipIcon size={16} />
                  Attachments
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <DocumentManager
                    transactionId={transaction.id}
                    compact
                  />
                </div>
              </div>
            )}

            {/* Status */}
            <div className="md:col-span-12 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioCheckbox
                  checked={formData.cleared}
                  onChange={(checked) => updateField('cleared', checked)}
                />
                <CheckIcon2 size={16} className="text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Reconciled
                </span>
              </label>

              <label className="flex items-center gap-2">
                <RadioCheckbox
                  checked={!!formData.reconciledWith && formData.reconciledWith !== 'manual'}
                  disabled
                  onChange={() => {}}
                />
                <LinkIcon size={16} className="text-gray-600 dark:text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Linked to bank statement
                </span>
              </label>

              {transaction?.reconciledWith && transaction.reconciledWith !== 'manual' && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500">
                  <LinkIcon size={16} />
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