/**
 * Step Indicator Component
 * Progress indicator for import wizard
 */

import React, { useEffect } from 'react';
import { ChevronRightIcon } from '../icons';
import { enhancedImportWizardService } from '../../services/enhancedImportWizardService';
import type { WizardStep, ImportFile } from '../../services/enhancedImportWizardService';
import { logger } from '../../services/loggingService';

interface StepIndicatorProps {
  currentStep: WizardStep;
  files: ImportFile[];
  selectedBankFormat: string | null;
}

const StepIndicator = React.memo(({
  currentStep,
  files,
  selectedBankFormat
}: StepIndicatorProps) => {
  const steps: WizardStep[] = ['files', 'format', 'mapping', 'preview'];
  const currentStepNum = enhancedImportWizardService.getStepNumber(currentStep);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step) => {
          const stepNum = enhancedImportWizardService.getStepNumber(step);
          const isActive = stepNum === currentStepNum;
          const isComplete = stepNum < currentStepNum;
          const shouldShow = enhancedImportWizardService.shouldShowStep(
            step,
            files,
            selectedBankFormat
          );

          if (!shouldShow && step !== 'files' && step !== 'preview') return null;

          const { containerClass, textClass } = enhancedImportWizardService.getStepClasses(
            isActive,
            isComplete
          );

          return (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${containerClass}`}>
                {stepNum}
              </div>
              <span className={`ml-2 text-sm ${textClass}`}>
                {enhancedImportWizardService.getStepDisplayName(step)}
              </span>
              {step !== 'preview' && shouldShow && (
                <ChevronRightIcon size={16} className="mx-2 text-gray-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

StepIndicator.displayName = 'StepIndicator';

export default StepIndicator;
