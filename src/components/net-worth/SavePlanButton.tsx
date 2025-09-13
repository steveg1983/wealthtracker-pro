import React, { useEffect, memo } from 'react';
import { SaveIcon, CheckCircleIcon } from '../icons';
import type { FinancialPlan } from '../../types/financial-plans';
import { logger } from '../../services/loggingService';

interface SavePlanButtonProps {
  savedPlan: FinancialPlan | null;
  isSaving: boolean;
  onSave: () => void;
}

export const SavePlanButton = memo(function SavePlanButton({
  savedPlan,
  isSaving,
  onSave
}: SavePlanButtonProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SavePlanButton component initialized', {
      componentName: 'SavePlanButton'
    });
  }, []);

  return (
    <button
      onClick={onSave}
      disabled={isSaving}
      className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm
               text-white rounded-lg hover:bg-white/30 transition-colors
               disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {savedPlan ? (
        <>
          <CheckCircleIcon size={18} />
          {isSaving ? 'Updating...' : 'Update Plan'}
        </>
      ) : (
        <>
          <SaveIcon size={18} />
          {isSaving ? 'Saving...' : 'Save Plan'}
        </>
      )}
    </button>
  );
});