import React, { useEffect, memo } from 'react';
import { CheckIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

type WizardStep = 'upload' | 'mapping' | 'preview' | 'result';

interface WizardProgressProps {
  currentStep: WizardStep;
}

interface StepIndicatorProps {
  number: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}

const StepIndicator = memo(function StepIndicator({ number, 
  label, 
  isActive, 
  isComplete 
 }: StepIndicatorProps) {
  const logger = useLogger();
  return (
    <div className="flex items-center">
      <div className={`
        flex items-center justify-center w-8 h-8 rounded-full
        ${isComplete ? 'bg-green-600' : isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}
        text-white transition-colors
      `}>
        {isComplete ? <CheckIcon className="w-4 h-4" /> : number}
      </div>
      <span className={`
        ml-2 text-sm font-medium
        ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}
      `}>
        {label}
      </span>
    </div>
  );
});

export const WizardProgress = memo(function WizardProgress({ currentStep }: WizardProgressProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('WizardProgress component initialized', {
      componentName: 'WizardProgress'
    });
  }, []);

  const steps = [
    { key: 'upload', number: 1, label: 'Upload File' },
    { key: 'mapping', number: 2, label: 'Map Columns' },
    { key: 'preview', number: 3, label: 'Preview' },
    { key: 'result', number: 4, label: 'Import' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.key}>
          <StepIndicator
            number={step.number}
            label={step.label}
            isActive={currentStep === step.key}
            isComplete={currentStepIndex > index || (currentStep === 'result' && step.key === 'result')}
          />
          {index < steps.length - 1 && (
            <div className={`
              flex-1 h-0.5 mx-2
              ${currentStepIndex > index ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}
            `} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
});