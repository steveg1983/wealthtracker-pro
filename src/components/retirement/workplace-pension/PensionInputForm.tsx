import { memo, useEffect } from 'react';
import type { PensionFormData } from '../../../services/workplacePensionService';
import { WorkplacePensionService } from '../../../services/workplacePensionService';
import { logger } from '../../../services/loggingService';

interface PensionInputFormProps {
  formData: PensionFormData;
  showAdvanced: boolean;
  onFormChange: (data: PensionFormData) => void;
  onToggleAdvanced: () => void;
}

/**
 * Pension input form component
 * Handles all input fields for pension calculations
 */
export const PensionInputForm = memo(function PensionInputForm({
  formData,
  showAdvanced,
  onFormChange,
  onToggleAdvanced
}: PensionInputFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PensionInputForm component initialized', {
      componentName: 'PensionInputForm'
    });
  }, []);

  const isAutoEnrollmentEligible = WorkplacePensionService.isAutoEnrollmentEligible(
    formData.annualSalary,
    formData.currentAge,
    formData.retirementAge
  );

  const meetsMinimumContribution = WorkplacePensionService.meetsMinimumContribution(
    formData.employeePercent,
    formData.employerPercent
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Annual Salary
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            type="number"
            value={formData.annualSalary}
            onChange={(e) => onFormChange({ ...formData, annualSalary: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            step="1000"
          />
        </div>
        {isAutoEnrollmentEligible && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Eligible for auto-enrollment
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Your Contribution (%)
        </label>
        <input
          type="number"
          value={formData.employeePercent}
          onChange={(e) => onFormChange({ ...formData, employeePercent: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          min="0"
          max="100"
          step="1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Employer Contribution (%)
        </label>
        <input
          type="number"
          value={formData.employerPercent}
          onChange={(e) => onFormChange({ ...formData, employerPercent: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          min="0"
          max="100"
          step="1"
        />
        {!meetsMinimumContribution && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠️ Below auto-enrollment minimum (8% total, 3% employer)
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Current Pension Pot
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            type="number"
            value={formData.currentPot}
            onChange={(e) => onFormChange({ ...formData, currentPot: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            step="1000"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.salaryExchange}
            onChange={(e) => onFormChange({ ...formData, salaryExchange: e.target.checked })}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Salary Sacrifice/Exchange (save on NI)
          </span>
        </label>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.qualifyingEarnings}
            onChange={(e) => onFormChange({ ...formData, qualifyingEarnings: e.target.checked })}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Use Qualifying Earnings Band
          </span>
        </label>
      </div>

      <button
        onClick={onToggleAdvanced}
        className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
      </button>

      {showAdvanced && (
        <AdvancedSettings
          formData={formData}
          onFormChange={onFormChange}
        />
      )}
    </div>
  );
});

/**
 * Advanced settings sub-component
 */
const AdvancedSettings = memo(function AdvancedSettings({
  formData,
  onFormChange
}: {
  formData: PensionFormData;
  onFormChange: (data: PensionFormData) => void;
}) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Age
          </label>
          <input
            type="number"
            value={formData.currentAge}
            onChange={(e) => onFormChange({ ...formData, currentAge: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="18"
            max="75"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Retirement Age
          </label>
          <input
            type="number"
            value={formData.retirementAge}
            onChange={(e) => onFormChange({ ...formData, retirementAge: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="55"
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
            onChange={(e) => onFormChange({ ...formData, expectedReturn: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="12"
            step="0.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tax Rate (%)
          </label>
          <select
            value={formData.taxRate}
            onChange={(e) => onFormChange({ ...formData, taxRate: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={20}>Basic Rate (20%)</option>
            <option value={40}>Higher Rate (40%)</option>
            <option value={45}>Additional Rate (45%)</option>
          </select>
        </div>
      </div>
    </div>
  );
});