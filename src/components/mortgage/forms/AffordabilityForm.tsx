import React, { useEffect, memo } from 'react';
import { RadioCheckbox } from '../../common/RadioCheckbox';
import { logger } from '../../../services/loggingService';

interface AffordabilityFormProps {
  formData: {
    annualIncome: number;
    monthlyExpenses: number;
    existingDebt: number;
  };
  onFormChange: (updates: Partial<AffordabilityFormProps['formData']>) => void;
  useRealIncomeData: boolean;
  setUseRealIncomeData: (value: boolean) => void;
  financialData?: any;
  formatCurrency: (value: number) => string;
}

export const AffordabilityForm = memo(function AffordabilityForm({
  formData,
  onFormChange,
  useRealIncomeData,
  setUseRealIncomeData,
  financialData,
  formatCurrency
}: AffordabilityFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AffordabilityForm component initialized', {
      componentName: 'AffordabilityForm'
    });
  }, []);

  
  const monthlyIncome = formData.annualIncome / 12;
  const disposableIncome = monthlyIncome - formData.monthlyExpenses;
  const affordabilityMultiple = 4.5; // Standard UK multiple
  const maxLoan = formData.annualIncome * affordabilityMultiple;
  
  return (
    <div className="space-y-4 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg">
      <h4 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-3">
        Affordability Assessment
      </h4>
      
      {/* Income Section */}
      <div>
        {useRealIncomeData && financialData && (
          <div className="mb-4 p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                Using Real Income Data
              </span>
              <button
                onClick={() => setUseRealIncomeData(false)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Use manual input
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-indigo-600 dark:text-indigo-400">Monthly Income:</span>
                <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                  {formatCurrency(financialData.monthlyIncome || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-600 dark:text-indigo-400">Annual Income:</span>
                <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                  {formatCurrency((financialData.monthlyIncome || 0) * 12)}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {!useRealIncomeData && (
          <>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Annual Household Income
              {financialData && (
                <button
                  onClick={() => setUseRealIncomeData(true)}
                  className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Use real income data
                </button>
              )}
            </label>
            <input
              type="number"
              value={formData.annualIncome}
              onChange={(e) => onFormChange({ annualIncome: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="65000"
            />
          </>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Monthly Expenses (excl. rent/mortgage)
        </label>
        <input
          type="number"
          value={formData.monthlyExpenses}
          onChange={(e) => onFormChange({ monthlyExpenses: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="2000"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Include bills, groceries, transport, entertainment, etc.
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Total Existing Debt
        </label>
        <input
          type="number"
          value={formData.existingDebt}
          onChange={(e) => onFormChange({ existingDebt: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="5000"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Credit cards, loans, car finance, etc.
        </p>
      </div>
      
      {/* Affordability Summary */}
      {formData.annualIncome > 0 && (
        <div className="p-4 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg space-y-3">
          <h5 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            Affordability Summary
          </h5>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-indigo-600 dark:text-indigo-400">Monthly Income:</span>
              <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                {formatCurrency(monthlyIncome)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-indigo-600 dark:text-indigo-400">Monthly Expenses:</span>
              <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                {formatCurrency(formData.monthlyExpenses)}
              </span>
            </div>
            
            <div className="flex justify-between border-t border-indigo-200 dark:border-indigo-800 pt-2">
              <span className="text-indigo-600 dark:text-indigo-400">Disposable Income:</span>
              <span className={`font-semibold ${
                disposableIncome > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(disposableIncome)}
              </span>
            </div>
            
            <div className="flex justify-between border-t border-indigo-200 dark:border-indigo-800 pt-2">
              <span className="text-indigo-600 dark:text-indigo-400">
                Max Loan (4.5x income):
              </span>
              <span className="font-bold text-indigo-900 dark:text-indigo-100">
                {formatCurrency(maxLoan)}
              </span>
            </div>
            
            {formData.existingDebt > 0 && (
              <div className="flex justify-between">
                <span className="text-indigo-600 dark:text-indigo-400">
                  Adjusted for Debt:
                </span>
                <span className="font-bold text-indigo-900 dark:text-indigo-100">
                  {formatCurrency(maxLoan - formData.existingDebt)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});