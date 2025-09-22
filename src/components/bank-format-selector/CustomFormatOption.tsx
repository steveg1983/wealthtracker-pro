import React, { memo } from 'react';
import { SettingsIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface CustomFormatOptionProps {
  selectedBank: string | null;
  onCustomSelect: () => void;
}

/**
 * Custom format selection option
 * Allows users to manually map unsupported bank formats
 */
export const CustomFormatOption = memo(function CustomFormatOption({ selectedBank,
  onCustomSelect
 }: CustomFormatOptionProps): React.JSX.Element {
  const logger = useLogger();
  try {
    const isSelected = selectedBank === 'custom';

    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCustomSelect}
          className={`w-full p-4 rounded-lg border-2 border-dashed text-center transition-all ${
            isSelected
              ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <SettingsIcon size={20} className="text-gray-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Custom Format (Manual Mapping)
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set up custom column mappings for unsupported formats
          </p>
        </button>
      </div>
    );
  } catch (error) {
    logger.error('CustomFormatOption render error:', error);
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center py-4 text-red-600 dark:text-red-400">
          Error loading custom format option
        </div>
      </div>
    );
  }
});