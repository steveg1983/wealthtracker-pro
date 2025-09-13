/**
 * Action Sheet Component
 * Simple bottom sheet for displaying action options
 */

import React, { useEffect, memo } from 'react';
import { BottomSheet } from '../BottomSheet';
import { BottomSheetItem } from './BottomSheetItem';
import { logger } from '../../services/loggingService';

export interface ActionSheetAction {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

export const ActionSheet = memo(function ActionSheet({
  isOpen,
  onClose,
  title,
  actions,
  cancelLabel = 'Cancel'
}: ActionSheetProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ActionSheet component initialized', {
      componentName: 'ActionSheet'
    });
  }, []);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      showCloseButton={false}
      height="auto"
    >
      <div className="py-2">
        {actions.map((action, index) => (
          <BottomSheetItem
            key={index}
            {...action}
            onClick={() => {
              action.onClick();
              onClose();
            }}
          />
        ))}
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        <button
          onClick={onClose}
          className="w-full py-3 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
});