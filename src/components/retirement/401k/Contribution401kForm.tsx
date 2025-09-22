import React, { useEffect, memo } from 'react';
import type { Retirement401kFormData } from './types';
import { useLogger } from '../services/ServiceProvider';

interface Contribution401kFormProps {
  formData: Retirement401kFormData;
  showAdvanced: boolean;
  onFormChange: (updates: Partial<Retirement401kFormData>) => void;
  onToggleAdvanced: () => void;
}

export const Contribution401kForm = memo(function Contribution401kForm({ formData,
  showAdvanced,
  onFormChange,
  onToggleAdvanced
 }: Contribution401kFormProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('Contribution401kForm component initialized', {
      componentName: 'Contribution401kForm'
    });
  }, []);

  const getMatchDescription = () => {
    const { employerMatchPercent, employerMatchLimit } = formData;
    return `${employerMatchPercent}% match on first ${employerMatchLimit}% of salary`;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Annual Salary
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={formData.annualSalary}
            onChange={(e) => onFormChange({ annualSalary: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            step="1000"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Your Contribution (% of salary)
        </label>
        <input
          type="number"
          value={formData.contributionPercent}
          onChange={(e) => onFormChange({ contributionPercent: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          min="0"
          max="100"
          step="1"
        />
        {formData.contributionPercent < formData.employerMatchLimit && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠️ Contributing below employer match limit - you're leaving free money on the table!
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Employer Match
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={formData.employerMatchPercent}
            onChange={(e) => onFormChange({ employerMatchPercent: Number(e.target.value) })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="100"
            step="25"
            placeholder="Match %"
          />
          <input
            type="number"
            value={formData.employerMatchLimit}
            onChange={(e) => onFormChange({ employerMatchLimit: Number(e.target.value) })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="100"
            step="1"
            placeholder="Up to %"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {getMatchDescription()}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Current 401(k) Balance
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={formData.currentBalance}
            onChange={(e) => onFormChange({ currentBalance: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            step="1000"
          />
        </div>
      </div>

      <button
        onClick={onToggleAdvanced}
        className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Age
              </label>
              <input
                type="number"
                value={formData.currentAge}
                onChange={(e) => onFormChange({ currentAge: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                onChange={(e) => onFormChange({ retirementAge: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="50"
                max="75"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expected Return (%)
              </label>
              <input
                type="number"
                value={formData.expectedReturn}
                onChange={(e) => onFormChange({ expectedReturn: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="15"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={formData.taxRate}
                onChange={(e) => onFormChange({ taxRate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="40"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});