import React, { useEffect, memo } from 'react';
import { logger } from '../../../services/loggingService';

type CalculatorType = 'standard' | 'helpToBuy' | 'sharedOwnership' | 'remortgage' | 'affordability';

interface CalculatorTypeSelectorProps {
  calculatorType: CalculatorType;
  onTypeChange: (type: CalculatorType) => void;
}

const calculatorTypes = [
  {
    value: 'standard' as const,
    label: 'Standard Mortgage',
    description: 'Traditional mortgage calculator'
  },
  {
    value: 'sharedOwnership' as const,
    label: 'Shared Ownership',
    description: 'Part buy, part rent'
  },
  {
    value: 'remortgage' as const,
    label: 'Remortgage',
    description: 'Compare existing vs new'
  },
  {
    value: 'affordability' as const,
    label: 'Affordability',
    description: 'Stress test & max loan'
  }
];

export const CalculatorTypeSelector = memo(function CalculatorTypeSelector({
  calculatorType,
  onTypeChange
}: CalculatorTypeSelectorProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CalculatorTypeSelector component initialized', {
      componentName: 'CalculatorTypeSelector'
    });
  }, []);

  
  return (
    <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Calculator Type
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {calculatorTypes.map((type) => (
          <label 
            key={type.value}
            className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800"
          >
            <input
              type="radio"
              name="calculatorType"
              value={type.value}
              checked={calculatorType === type.value}
              onChange={(e) => onTypeChange(e.target.value as CalculatorType)}
              className="mr-3 text-gray-500 focus:ring-blue-400"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {type.label}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {type.description}
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
});