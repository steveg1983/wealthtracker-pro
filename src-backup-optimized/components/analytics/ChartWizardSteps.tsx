import React, { useEffect, memo } from 'react';
import { CheckIcon2 } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface ChartWizardStepsProps {
  currentStep: number;
  steps: Array<{
    title: string;
    description: string;
  }>;
}

export const ChartWizardSteps = memo(function ChartWizardSteps({ currentStep,
  steps
 }: ChartWizardStepsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ChartWizardSteps component initialized', {
      componentName: 'ChartWizardSteps'
    });
  }, []);

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isCompleted = currentStep > stepNumber;
        
        return (
          <div key={stepNumber} className="flex items-center flex-1">
            <div className="relative flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-medium
                  ${isActive 
                    ? 'bg-blue-500 text-white' 
                    : isCompleted 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckIcon2 size={20} />
                ) : (
                  stepNumber
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-sm font-medium ${
                  isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {step.description}
                </p>
              </div>
            </div>
            
            {index < steps.length - 1 && (
              <div className={`
                flex-1 h-0.5 mx-4 mt-[-20px]
                ${isCompleted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
});