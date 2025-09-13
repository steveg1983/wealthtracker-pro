import { memo, useEffect } from 'react';
import type { TransactionFormData, FormErrors } from '../../services/transactionFormService';
import { logger } from '../../services/loggingService';

interface BasicFieldsProps {
  formData: TransactionFormData;
  errors: FormErrors;
  touched: Record<string, boolean>;
  onFieldChange: (field: keyof TransactionFormData, value: string) => void;
  onFieldBlur: (field: string) => void;
}

/**
 * Basic transaction fields component
 */
export const BasicFields = memo(function BasicFields({
  formData,
  errors,
  touched,
  onFieldChange,
  onFieldBlur
}: BasicFieldsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BasicFields component initialized', {
      componentName: 'BasicFields'
    });
  }, []);

  return (
    <>
      {/* Date Field */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Date <span className="text-red-500" aria-label="required">*</span>
        </label>
        <input
          id="date"
          type="date"
          required
          value={formData.date}
          onChange={(e) => onFieldChange('date', e.target.value)}
          onBlur={() => onFieldBlur('date')}
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

      {/* Description Field */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description <span className="text-red-500" aria-label="required">*</span>
        </label>
        <input
          id="description"
          type="text"
          required
          value={formData.description}
          onChange={(e) => onFieldChange('description', e.target.value)}
          onBlur={() => onFieldBlur('description')}
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

      {/* Type and Amount Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type <span className="text-red-500" aria-label="required">*</span>
          </label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => onFieldChange('type', e.target.value)}
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
            onChange={(e) => onFieldChange('amount', e.target.value)}
            onBlur={() => onFieldBlur('amount')}
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
    </>
  );
});