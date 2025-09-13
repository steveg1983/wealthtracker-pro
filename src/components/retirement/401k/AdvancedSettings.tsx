/**
 * 401(k) Advanced Settings Component
 * Advanced configuration options
 */

import React, { useEffect } from 'react';
import type { Retirement401kFormData } from '../../../services/retirement401kService';
import { logger } from '../../../services/loggingService';

interface AdvancedSettingsProps {
  formData: Retirement401kFormData;
  isVisible: boolean;
  onFieldChange: (field: keyof Retirement401kFormData, value: number) => void;
  onToggle: () => void;
}

const AdvancedSettings = React.memo(({
  formData,
  isVisible,
  onFieldChange,
  onToggle
}: AdvancedSettingsProps) => {
  return (
    <>
      <button
        onClick={onToggle}
        className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
      >
        {isVisible ? 'Hide' : 'Show'} Advanced Settings
      </button>

      {isVisible && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Age
              </label>
              <input
                type="number"
                value={formData.currentAge}
                onChange={(e) => onFieldChange('currentAge', Number(e.target.value))}
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
                onChange={(e) => onFieldChange('retirementAge', Number(e.target.value))}
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
                onChange={(e) => onFieldChange('expectedReturn', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="20"
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
                onChange={(e) => onFieldChange('taxRate', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="50"
                step="1"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});

AdvancedSettings.displayName = 'AdvancedSettings';

export default AdvancedSettings;