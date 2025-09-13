import { memo, useEffect } from 'react';
import type { SIPPInputs } from '../../../services/sippCalculatorService';
import { logger } from '../../../services/loggingService';

interface SIPPInputFormProps {
  inputs: SIPPInputs;
  onInputChange: (inputs: SIPPInputs) => void;
}

/**
 * SIPP calculator input form component
 */
export const SIPPInputForm = memo(function SIPPInputForm({
  inputs,
  onInputChange
}: SIPPInputFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SIPPInputForm component initialized', {
      componentName: 'SIPPInputForm'
    });
  }, []);

  const handleChange = (field: keyof SIPPInputs, value: string | number) => {
    onInputChange({
      ...inputs,
      [field]: value
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Current Age
        </label>
        <input
          type="number"
          value={inputs.currentAge}
          onChange={(e) => handleChange('currentAge', parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          min="18"
          max="75"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Target Retirement Age
        </label>
        <input
          type="number"
          value={inputs.retirementAge}
          onChange={(e) => handleChange('retirementAge', parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          min="55"
          max="75"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Current SIPP Balance
        </label>
        <input
          type="number"
          value={inputs.currentBalance || ''}
          onChange={(e) => handleChange('currentBalance', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Your Monthly Contribution
        </label>
        <input
          type="number"
          value={inputs.monthlyContribution || ''}
          onChange={(e) => handleChange('monthlyContribution', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Employer Contribution
        </label>
        <input
          type="number"
          value={inputs.employerContribution || ''}
          onChange={(e) => handleChange('employerContribution', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tax Band
        </label>
        <select
          value={inputs.taxBand}
          onChange={(e) => handleChange('taxBand', e.target.value as 'basic' | 'higher' | 'additional')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="basic">Basic Rate (20%)</option>
          <option value="higher">Higher Rate (40%)</option>
          <option value="additional">Additional Rate (45%)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Expected Annual Growth
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={(inputs.annualGrowthRate * 100).toFixed(1)}
            onChange={(e) => handleChange('annualGrowthRate', parseFloat(e.target.value) / 100 || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            step="0.1"
            min="0"
            max="15"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
        </div>
      </div>
    </div>
  );
});