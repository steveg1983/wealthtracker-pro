import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { XIcon } from './icons/XIcon';
import TagSelector from './TagSelector';
import CategorySelector from './CategorySelector';
import type { Transaction } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
}

interface FormErrors {
  date?: string;
  description?: string;
  amount?: string;
  category?: string;
  account?: string;
}

interface TransactionFormData {
  date: string;
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  accountId: string;
  notes: string;
  tags: string[];
  cleared: boolean;
}

export default function TransactionModal({ isOpen, onClose, transaction }: TransactionModalProps): React.JSX.Element | null {
  const { accounts, addTransaction, updateTransaction } = useApp();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  const [formData, setFormData] = useState<TransactionFormData>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense',
    category: '',
    accountId: accounts[0]?.id || '',
    notes: '',
    tags: [] as string[],
    cleared: false
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const firstInput = modalRef.current.querySelector('input, select, textarea') as HTMLElement;
      firstInput?.focus();
    }
  }, [isOpen]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (transaction) {
      setFormData({
        date: new Date(transaction.date).toISOString().split('T')[0],
        description: transaction.description,
        amount: transaction.amount.toString(),
        type: transaction.type,
        category: transaction.category,
        accountId: transaction.accountId,
        notes: transaction.notes || '',
        tags: transaction.tags || [],
        cleared: transaction.cleared || false
      });
    } else {
      // Reset form for new transaction
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'expense',
        category: '',
        accountId: accounts[0]?.id || '',
        notes: '',
        tags: [],
        cleared: false
      });
    }
    // Reset errors and touched state
    setErrors({});
    setTouched({});
  }, [transaction, accounts]);

  // Validation functions
  type FieldName = keyof TransactionFormData | 'account';

  const validateField = (name: FieldName, value: unknown): string | undefined => {
    switch (name) {
      case 'date':
        return typeof value === 'string' && value ? undefined : 'Date is required';
      case 'description':
        if (typeof value !== 'string' || value.trim() === '') {
          return 'Description is required';
        }
        if (value.length < 2) {
          return 'Description must be at least 2 characters';
        }
        return undefined;
      case 'amount': {
        if (typeof value !== 'string' || value.trim() === '') {
          return 'Amount is required';
        }
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) {
          return 'Amount must be a positive number';
        }
        return undefined;
      }
      case 'category':
        return typeof value === 'string' && value ? undefined : 'Category is required';
      case 'accountId':
      case 'account':
        return typeof value === 'string' && value ? undefined : 'Account is required';
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    newErrors.date = validateField('date', formData.date);
    newErrors.description = validateField('description', formData.description);
    newErrors.amount = validateField('amount', formData.amount);
    newErrors.category = validateField('category', formData.category);
    newErrors.account = validateField('accountId', formData.accountId);
    
    setErrors(newErrors);
    
    // Check if there are any errors
    return !Object.values(newErrors).some(error => error !== undefined);
  };

  type BlurrableField = 'date' | 'description' | 'amount' | 'category' | 'account';

  const handleBlur = (fieldName: BlurrableField) => {
    setTouched({ ...touched, [fieldName]: true });
    const fieldValue = fieldName === 'account' ? formData.accountId : formData[fieldName];
    const error = validateField(fieldName === 'account' ? 'accountId' : fieldName, fieldValue);
    setErrors({ ...errors, [fieldName]: error });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      date: true,
      description: true,
      amount: true,
      category: true,
      account: true
    });
    
    if (!validateForm()) {
      // Announce error to screen readers
      const errorMessages = Object.values(errors).filter(Boolean).join('. ');
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'alert');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = `Form has errors: ${errorMessages}`;
      document.body.appendChild(announcement);
      setTimeout(() => announcement.remove(), 1000);
      return;
    }
    
    const transactionData = {
      ...formData,
      date: new Date(formData.date),
      amount: parseFloat(formData.amount),
    };

    if (transaction) {
      updateTransaction(transaction.id, transactionData);
    } else {
      addTransaction(transactionData);
    }

    onClose();
  };


  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl p-6 w-full max-w-md"
        role="document"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="modal-title" className="text-xl font-semibold dark:text-white">
            {transaction ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close modal"
          >
            <XIcon size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date <span className="text-red-500" aria-label="required">*</span>
            </label>
            <input
              id="date"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              onBlur={() => handleBlur('date')}
              aria-required="true"
              aria-invalid={touched.date && !!errors.date}
              aria-describedby={touched.date && errors.date ? 'date-error' : undefined}
              className={`w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border ${
                touched.date && errors.date 
                  ? 'border-red-500 dark:border-red-500' 
                  : 'border-gray-300/50 dark:border-gray-600/50'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white`}
            />
            {touched.date && errors.date && (
              <p id="date-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.date}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500" aria-label="required">*</span>
            </label>
            <input
              id="description"
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onBlur={() => handleBlur('description')}
              aria-required="true"
              aria-invalid={touched.description && !!errors.description}
              aria-describedby={touched.description && errors.description ? 'description-error' : undefined}
              className={`w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border ${
                touched.description && errors.description 
                  ? 'border-red-500 dark:border-red-500' 
                  : 'border-gray-300/50 dark:border-gray-600/50'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white`}
              placeholder="e.g., Grocery shopping, Salary payment"
            />
            {touched.description && errors.description && (
              <p id="description-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type <span className="text-red-500" aria-label="required">*</span>
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' | 'transfer' })}
                aria-required="true"
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount <span className="text-red-500" aria-label="required">*</span>
              </label>
              <input
                id="amount"
                type="number"
                required
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                onBlur={() => handleBlur('amount')}
                aria-required="true"
                aria-invalid={touched.amount && !!errors.amount}
                aria-describedby={touched.amount && errors.amount ? 'amount-error' : undefined}
                className={`w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border ${
                  touched.amount && errors.amount 
                    ? 'border-red-500 dark:border-red-500' 
                    : 'border-gray-300/50 dark:border-gray-600/50'
                } rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white`}
                placeholder="0.00"
              />
              {touched.amount && errors.amount && (
                <p id="amount-error" className="mt-1 text-sm text-red-500" role="alert">
                  {errors.amount}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category <span className="text-red-500" aria-label="required">*</span>
            </label>
            <div 
              id="category"
              onBlur={() => handleBlur('category')}
              aria-required="true"
              aria-invalid={touched.category && !!errors.category}
              aria-describedby={touched.category && errors.category ? 'category-error' : undefined}
            >
              <CategorySelector
                selectedCategory={formData.category}
                onCategoryChange={(categoryId) => {
                  setFormData({ ...formData, category: categoryId });
                  setTouched({ ...touched, category: true });
                  const error = validateField('category', categoryId);
                  setErrors({ ...errors, category: error });
                }}
                transactionType={formData.type}
                placeholder="Select category..."
                allowCreate={false}
              />
            </div>
            {touched.category && errors.category && (
              <p id="category-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.category}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account <span className="text-red-500" aria-label="required">*</span>
            </label>
            <select
              id="account"
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              onBlur={() => handleBlur('account')}
              aria-required="true"
              aria-invalid={touched.account && !!errors.account}
              aria-describedby={touched.account && errors.account ? 'account-error' : undefined}
              className={`w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border ${
                touched.account && errors.account 
                  ? 'border-red-500 dark:border-red-500' 
                  : 'border-gray-300/50 dark:border-gray-600/50'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white`}
            >
              <option value="">Select an account</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            {touched.account && errors.account && (
              <p id="account-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.account}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes <span className="text-sm text-gray-500">(Optional)</span>
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              aria-describedby="notes-hint"
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              placeholder="Add any additional details..."
            />
            <p id="notes-hint" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              You can add any additional information about this transaction
            </p>
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags <span className="text-sm text-gray-500">(Optional)</span>
            </label>
            <div id="tags" aria-describedby="tags-hint">
              <TagSelector
                selectedTags={formData.tags}
                onTagsChange={(tags) => setFormData({ ...formData, tags })}
                placeholder="Search or create tags..."
                allowNewTags={true}
              />
            </div>
            <p id="tags-hint" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Add tags to help organize and search your transactions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cleared"
              checked={formData.cleared}
              onChange={(e) => setFormData({ ...formData, cleared: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-describedby="cleared-hint"
            />
            <label htmlFor="cleared" className="text-sm text-gray-700 dark:text-gray-300">
              Transaction cleared/reconciled
            </label>
          </div>
          <p id="cleared-hint" className="text-xs text-gray-500 dark:text-gray-400 ml-6">
            Check this if the transaction has been verified against your bank statement
          </p>

          {/* Screen reader only announcement region for form errors */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {Object.entries(errors).filter(([_, error]) => error).length > 0 && (
              <p>Form has {Object.entries(errors).filter(([_, error]) => error).length} errors. Please review and correct them.</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-describedby="submit-hint"
            >
              {transaction ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
          <p id="submit-hint" className="sr-only">
            {transaction 
              ? 'Click to save your changes to this transaction' 
              : 'Click to add this new transaction to your account'}
          </p>
        </form>
      </div>
    </div>
  );
}
