import React, { useEffect, memo } from 'react';
import { logger } from '../../../services/loggingService';

interface SharedOwnershipFormProps {
  formData: {
    propertyPrice: number;
    sharePercentage: number;
    deposit: number;
    interestRate: number;
    termYears: number;
  };
  onFormChange: (updates: Partial<SharedOwnershipFormProps['formData']>) => void;
  formatCurrency: (value: number) => string;
}

export const SharedOwnershipForm = memo(function SharedOwnershipForm({
  formData,
  onFormChange,
  formatCurrency
}: SharedOwnershipFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SharedOwnershipForm component initialized', {
      componentName: 'SharedOwnershipForm'
    });
  }, []);

  
  const sharePrice = formData.propertyPrice * (formData.sharePercentage / 100);
  const monthlyRent = (formData.propertyPrice * (1 - formData.sharePercentage / 100) * 0.0275) / 12;
  
  return (
    <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
      <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-3">
        Shared Ownership Details
      </h4>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Property Full Market Value
        </label>
        <input
          type="number"
          value={formData.propertyPrice}
          onChange={(e) => onFormChange({ propertyPrice: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="400000"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Share Percentage (%)
        </label>
        <input
          type="number"
          value={formData.sharePercentage}
          onChange={(e) => onFormChange({ sharePercentage: parseFloat(e.target.value) || 0 })}
          min="25"
          max="75"
          step="5"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="40"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Typically between 25% and 75%
        </p>
      </div>
      
      <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-purple-700 dark:text-purple-300">Share Price:</span>
          <span className="font-semibold text-purple-900 dark:text-purple-100">
            {formatCurrency(sharePrice)}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-purple-700 dark:text-purple-300">Est. Monthly Rent:</span>
          <span className="font-semibold text-purple-900 dark:text-purple-100">
            {formatCurrency(monthlyRent)}
          </span>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Deposit for Your Share
        </label>
        <input
          type="number"
          value={formData.deposit}
          onChange={(e) => onFormChange({ deposit: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="20000"
        />
        {sharePrice > 0 && formData.deposit > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {((formData.deposit / sharePrice) * 100).toFixed(1)}% of share value
          </p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mortgage Interest Rate (%)
        </label>
        <input
          type="number"
          value={formData.interestRate}
          onChange={(e) => onFormChange({ interestRate: parseFloat(e.target.value) || 0 })}
          step="0.01"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="4.5"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mortgage Term (years)
        </label>
        <input
          type="number"
          value={formData.termYears}
          onChange={(e) => onFormChange({ termYears: parseInt(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="25"
        />
      </div>
    </div>
  );
});