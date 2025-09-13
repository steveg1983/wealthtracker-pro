import { memo, useEffect } from 'react';
import { CheckCircleIcon } from '../icons';
import type { MigrationStep } from '../../services/migrationWizardService';
import { logger } from '../../services/loggingService';

interface WizardStepProgressProps {
  steps: MigrationStep[];
  currentStep: number;
}

/**
 * Wizard step progress indicator
 * Extracted from DataMigrationWizard for single responsibility
 */
export const WizardStepProgress = memo(function WizardStepProgress({ 
  steps, 
  currentStep 
}: WizardStepProgressProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('WizardStepProgress component initialized', {
      componentName: 'WizardStepProgress'
    });
  }, []);

  return (
    <div className="mt-6 flex items-center justify-between">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
        >
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                currentStep > step.id
                  ? 'bg-green-500 text-white'
                  : currentStep === step.id
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
            >
              {currentStep > step.id ? (
                <CheckCircleIcon size={20} />
              ) : (
                <span className="text-sm font-medium">{step.id}</span>
              )}
            </div>
            <span className="mt-2 text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 transition-colors ${
                currentStep > step.id
                  ? 'bg-green-500'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
});