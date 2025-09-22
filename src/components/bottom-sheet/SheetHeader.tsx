/**
 * Sheet Header Component
 * Header with title and close button for bottom sheet
 */

import React, { useEffect } from 'react';
import { XIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface SheetHeaderProps {
  title?: string;
  showCloseButton?: boolean;
  onClose: () => void;
  showHandle?: boolean;
}

const SheetHeader = React.memo(({
  title,
  showCloseButton = true,
  onClose,
  showHandle = true
}: SheetHeaderProps) => {
  return (
    <>
      {/* Drag Handle */}
      {showHandle && (
        <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
      )}

      {/* Title and Close Button */}
      {(title || showCloseButton) && (
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-auto"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </>
  );
});

SheetHeader.displayName = 'SheetHeader';

export default SheetHeader;