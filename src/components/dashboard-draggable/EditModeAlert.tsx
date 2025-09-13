import React, { useEffect, memo } from 'react';
import { logger } from '../../services/loggingService';

interface EditModeAlertProps {
  isEditMode: boolean;
}

const EditModeAlert = memo(function EditModeAlert({ isEditMode }: EditModeAlertProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('EditModeAlert component initialized', {
      componentName: 'EditModeAlert'
    });
  }, []);
  if (!isEditMode) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 mb-4 rounded-lg">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        <strong>Edit Mode:</strong> Drag widgets to rearrange them. Resize by dragging corners. Click "Save Layout" when done.
      </p>
    </div>
  );
});

export default EditModeAlert;
