/**
 * Wizard Footer Component
 * Footer controls for import wizard
 */

import React, { useEffect } from 'react';
import { LoadingButton } from '../loading/LoadingState';
import { ChevronLeftIcon, ChevronRightIcon, WrenchIcon } from '../icons';
import { enhancedImportWizardService } from '../../services/enhancedImportWizardService';
import type { WizardStep } from '../../services/enhancedImportWizardService';
import { useLogger } from '../services/ServiceProvider';

interface WizardFooterProps {
  currentStep: WizardStep;
  canProceed: boolean;
  isProcessing: boolean;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
  onShowRules?: () => void;
}

const WizardFooter = React.memo(({
  currentStep,
  canProceed,
  isProcessing,
  onBack,
  onNext,
  onClose,
  onShowRules
}: WizardFooterProps) => {
  const nextButtonText = currentStep === 'preview' ? 'Import' : 'Next';

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex gap-2">
        {currentStep === 'preview' && onShowRules && (
          <button
            onClick={onShowRules}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <WrenchIcon size={16} />
            Manage Rules
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {currentStep !== 'files' && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            <ChevronLeftIcon size={16} />
            Back
          </button>
        )}

        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>

        <LoadingButton
          onClick={onNext}
          isLoading={isProcessing}
          disabled={!canProceed}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {nextButtonText}
          <ChevronRightIcon size={16} />
        </LoadingButton>
      </div>
    </div>
  );
});

WizardFooter.displayName = 'WizardFooter';

export default WizardFooter;
