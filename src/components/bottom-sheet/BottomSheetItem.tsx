/**
 * Bottom Sheet Item Component
 * Reusable list item for bottom sheets
 */

import React, { useEffect, memo } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface BottomSheetItemProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export const BottomSheetItem = memo(function BottomSheetItem({ icon,
  label,
  description,
  onClick,
  danger = false,
  disabled = false
 }: BottomSheetItemProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BottomSheetItem component initialized', {
      componentName: 'BottomSheetItem'
    });
  }, []);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {icon && (
        <div className={`flex-shrink-0 ${
          danger ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'
        }`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${
          danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
        }`}>
          {label}
        </p>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
    </button>
  );
});