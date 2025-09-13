/**
 * Investment Type Selector Component
 * World-class investment type selection with clear visual hierarchy
 */

import React, { useEffect, memo } from 'react';
import { investmentService, type InvestmentType } from '../../services/investment/investmentService';
import { logger } from '../../services/loggingService';

interface InvestmentTypeSelectorProps {
  value: InvestmentType;
  onChange: (type: InvestmentType) => void;
}

/**
 * Premium investment type selector
 */
export const InvestmentTypeSelector = memo(function InvestmentTypeSelector({
  value,
  onChange
}: InvestmentTypeSelectorProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('InvestmentTypeSelector component initialized', {
      componentName: 'InvestmentTypeSelector'
    });
  }, []);

  const types = investmentService.getInvestmentTypes();

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Category of Investment*
      </label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {types.map((type) => (
          <TypeButton
            key={type.value}
            type={type}
            isSelected={value === type.value}
            onClick={() => onChange(type.value)}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * Type button
 */
const TypeButton = memo(function TypeButton({
  type,
  isSelected,
  onClick
}: {
  type: { value: InvestmentType; label: string };
  isSelected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg transition-colors ${
        isSelected
          ? 'bg-gray-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
      aria-pressed={isSelected}
      aria-label={`Select ${type.label} investment type`}
    >
      {type.label}
    </button>
  );
});