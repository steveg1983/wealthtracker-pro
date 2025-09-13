import { memo, useEffect } from 'react';
import CategorySelector from '../CategorySelector';
import type { TransactionFormData, FormErrors } from '../../services/transactionFormService';
import type { Account } from '../../types';
import { logger } from '../../services/loggingService';

interface CategoryAccountFieldsProps {
  formData: TransactionFormData;
  errors: FormErrors;
  touched: Record<string, boolean>;
  accounts: Account[];
  onFieldChange: (field: keyof TransactionFormData, value: string) => void;
  onFieldBlur: (field: string) => void;
  onCategoryChange: (categoryId: string) => void;
}

/**
 * Category and account selection fields
 */
export const CategoryAccountFields = memo(function CategoryAccountFields({
  formData,
  errors,
  touched,
  accounts,
  onFieldChange,
  onFieldBlur,
  onCategoryChange
}: CategoryAccountFieldsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CategoryAccountFields component initialized', {
      componentName: 'CategoryAccountFields'
    });
  }, []);

  return (
    <>
      {/* Category Field */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Category <span className="text-red-500" aria-label="required">*</span>
        </label>
        <div 
          id="category"
          onBlur={() => onFieldBlur('category')}
          aria-required="true"
          aria-invalid={touched.category && !!errors.category}
          aria-describedby={touched.category && errors.category ? 'category-error' : undefined}
        >
          <CategorySelector
            selectedCategory={formData.category}
            onCategoryChange={onCategoryChange}
            transactionType={formData.type}
            placeholder="Select category..."
            allowCreate={false}
            currentAccountId={formData.accountId}
          />
        </div>
        {touched.category && errors.category && (
          <p id="category-error" className="mt-1 text-sm text-red-500" role="alert">
            {errors.category}
          </p>
        )}
      </div>

      {/* Account Field */}
      <div>
        <label htmlFor="account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Account <span className="text-red-500" aria-label="required">*</span>
        </label>
        <select
          id="account"
          value={formData.accountId}
          onChange={(e) => onFieldChange('accountId', e.target.value)}
          onBlur={() => onFieldBlur('account')}
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
    </>
  );
});