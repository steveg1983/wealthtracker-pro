/**
 * Sheet Item Component
 * List item for bottom sheet actions
 */

import React, { useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface SheetItemProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export const BottomSheetItem = React.memo(({
  icon,
  label,
  description,
  onClick,
  danger = false,
  disabled = false
}: SheetItemProps) => {
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

BottomSheetItem.displayName = 'BottomSheetItem';

export default BottomSheetItem;