import React, { useEffect, memo } from 'react';
import { PlusIcon } from '../icons';
import { getCurrencySymbol } from '../../utils/currency';
import MarkdownEditor from '../MarkdownEditor';
import type { FormData } from './types';
import { useLogger } from '../services/ServiceProvider';

interface TransactionFormProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  accounts: Array<{ id: string; name: string; currency: string }>;
  availableSubCategories: Array<{ id: string; name: string }>;
  detailCategories: Array<{ id: string; name: string }>;
  onOpenCategoryModal: () => void;
  validationErrors: Record<string, string>;
}

export const TransactionForm = memo(function TransactionForm({ formData,
  updateField,
  accounts,
  availableSubCategories,
  detailCategories,
  onOpenCategoryModal,
  validationErrors
 }: TransactionFormProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TransactionForm component initialized', {
      componentName: 'TransactionForm'
    });
  }, []);

  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const currencySymbol = selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '';

  return (
    <div className="space-y-6">
      {validationErrors.general && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{validationErrors.general}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Account
        </label>
        <select
          value={formData.accountId}
          onChange={(e) => updateField('accountId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
          required
        >
          <option value="">Select account</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
        {validationErrors.accountId && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.accountId}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Date
        </label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => updateField('date', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
          required
        />
        {validationErrors.date && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.date}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Type
        </label>
        <div className="flex gap-4">
          {(['income', 'expense', 'transfer'] as const).map(type => (
            <label key={type} className="flex items-center">
              <input
                type="radio"
                value={type}
                checked={formData.type === type}
                onChange={(e) => updateField('type', e.target.value as typeof type)}
                className="mr-2"
              />
              <span className={`capitalize ${
                type === 'income' ? 'text-green-600' : 
                type === 'expense' ? 'text-red-600' : 
                'text-gray-700 dark:text-gray-300'
              }`}>
                {type}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Description
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
          placeholder="Enter transaction description"
          required
        />
        {validationErrors.description && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.description}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Amount {currencySymbol && `(${currencySymbol})`}
        </label>
        <input
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => updateField('amount', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
          placeholder="0.00"
          required
        />
        {validationErrors.amount && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.amount}</p>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Category
          </label>
          <button
            type="button"
            onClick={onOpenCategoryModal}
            className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
          >
            <PlusIcon size={14} />
            Create new
          </button>
        </div>
        <select
          value={formData.subCategory}
          onChange={(e) => {
            updateField('subCategory', e.target.value);
            updateField('category', '');
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
          required
        >
          <option value="">Select category</option>
          {availableSubCategories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {validationErrors.category && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.category}</p>
        )}
      </div>

      {formData.subCategory && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Sub-category
          </label>
          <select
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
            required
          >
            <option value="">Select sub-category</option>
            {detailCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Notes
        </label>
        <MarkdownEditor
          value={formData.notes}
          onChange={(value) => updateField('notes', value)}
          placeholder="Add notes (optional)"
          maxHeight="150px"
        />
      </div>
    </div>
  );
});