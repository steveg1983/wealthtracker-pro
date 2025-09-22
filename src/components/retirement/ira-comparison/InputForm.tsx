import React, { useEffect, memo } from 'react';
import type { IRAFormData } from './types';
import { useLogger } from '../services/ServiceProvider';

interface InputFormProps {
  formData: IRAFormData;
  onUpdate: (updates: Partial<IRAFormData>) => void;
  maxContribution: number;
  isEligibleForCatchUp: boolean;
  formatCurrency: (value: number) => string;
}

export const InputForm = memo(function InputForm({ formData,
  onUpdate,
  maxContribution,
  isEligibleForCatchUp,
  formatCurrency
 }: InputFormProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InputForm component initialized', {
      componentName: 'InputForm'
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Age
          </label>
          <input
            type="number"
            value={formData.currentAge}
            onChange={(e) => onUpdate({ currentAge: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="18"
            max="70"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Retirement Age
          </label>
          <input
            type="number"
            value={formData.retirementAge}
            onChange={(e) => onUpdate({ retirementAge: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="50"
            max="75"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Annual Contribution
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={formData.annualContribution}
            onChange={(e) => onUpdate({ 
              annualContribution: Math.min(Number(e.target.value), maxContribution) 
            })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max={maxContribution}
            step="100"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          2024 limit: {formatCurrency(maxContribution)} {isEligibleForCatchUp && '(includes catch-up)'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Current Annual Income
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={formData.currentIncome}
            onChange={(e) => onUpdate({ currentIncome: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            step="1000"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Filing Status
        </label>
        <select
          value={formData.filingStatus}
          onChange={(e) => onUpdate({ 
            filingStatus: e.target.value as 'single' | 'married' | 'marriedSeparate' 
          })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="single">Single</option>
          <option value="married">Married Filing Jointly</option>
          <option value="marriedSeparate">Married Filing Separately</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Tax Rate (%)
          </label>
          <input
            type="number"
            value={formData.currentTaxRate}
            onChange={(e) => onUpdate({ currentTaxRate: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="37"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Retirement Tax Rate (%)
          </label>
          <input
            type="number"
            value={formData.retirementTaxRate}
            onChange={(e) => onUpdate({ retirementTaxRate: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="37"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.hasWorkplacePlan}
            onChange={(e) => onUpdate({ hasWorkplacePlan: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I have a workplace retirement plan (401k, 403b, etc.)
          </span>
        </label>
        {formData.filingStatus === 'married' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.spouseHasWorkplacePlan}
              onChange={(e) => onUpdate({ spouseHasWorkplacePlan: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              My spouse has a workplace retirement plan
            </span>
          </label>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Expected Annual Return (%)
        </label>
        <input
          type="number"
          value={formData.expectedReturn}
          onChange={(e) => onUpdate({ expectedReturn: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          min="0"
          max="15"
          step="0.5"
        />
      </div>
    </div>
  );
});