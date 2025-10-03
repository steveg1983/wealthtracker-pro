import { memo, useEffect } from 'react';
import { TrashIcon } from '../../icons';
import type { MortgageSavedCalculation as SavedCalculation } from '../../../services/mortgageCalculatorService';
import { useLogger } from '../services/ServiceProvider';

interface CalculationGridProps {
  calculations: SavedCalculation[];
  selectedCalculation: SavedCalculation | null;
  formatCurrency: (amount: number) => string;
  onSelect: (calc: SavedCalculation) => void;
  onDelete: (id: string) => void;
}

/**
 * Calculation Grid component
 * Displays saved mortgage calculations in a grid layout
 */
export const CalculationGrid = memo(function CalculationGrid({ calculations,
  selectedCalculation,
  formatCurrency,
  onSelect,
  onDelete
 }: CalculationGridProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CalculationGrid component initialized', {
      componentName: 'CalculationGrid'
    });
  }, []);

  if (calculations.length === 0) return <></>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {calculations.map(calc => (
        <CalculationCard
          key={calc.id}
          calculation={calc}
          isSelected={selectedCalculation?.id === calc.id}
          formatCurrency={formatCurrency}
          onSelect={() => onSelect(calc)}
          onDelete={() => onDelete(calc.id)}
        />
      ))}
    </div>
  );
});

/**
 * Individual calculation card
 */
const CalculationCard = memo(function CalculationCard({
  calculation,
  isSelected,
  formatCurrency,
  onSelect,
  onDelete
}: {
  calculation: SavedCalculation;
  isSelected: boolean;
  formatCurrency: (amount: number) => string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(calculation.propertyPrice)}
          </p>
          <p className="text-xs text-gray-500">
            {calculation.region} • {calculation.termYears} years
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-red-500 hover:text-red-700"
        >
          <TrashIcon size={16} />
        </button>
      </div>
      <div className="text-sm">
        <p className="text-gray-600 dark:text-gray-400">
          Monthly: {formatCurrency(calculation.monthlyPayment)}
        </p>
      </div>
    </div>
  );
});
