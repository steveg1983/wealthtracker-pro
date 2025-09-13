import { memo, useEffect } from 'react';
import { GridIcon as LayoutIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface EditModeInstructionsProps {
  isEditMode: boolean;
}

/**
 * Edit mode instructions banner
 */
export const EditModeInstructions = memo(function EditModeInstructions({
  isEditMode
}: EditModeInstructionsProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('EditModeInstructions component initialized', {
      componentName: 'EditModeInstructions'
    });
  }, []);

  if (!isEditMode) return null;

  return (
    <div className="bg-blue-50 dark:bg-gray-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
        <LayoutIcon size={20} />
        <span className="font-medium">Edit Mode Active</span>
      </div>
      <p className="text-sm text-blue-700 dark:text-gray-300 mt-1">
        Drag widgets to reorder, click settings to configure, or remove widgets you don't need.
      </p>
    </div>
  );
});
