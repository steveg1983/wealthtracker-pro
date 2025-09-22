import { memo, useEffect } from 'react';
import { PlusIcon } from '../../icons';
import { MortgageTypesComparison } from '../tables/MortgageTypesComparison';
import { LoanTypesComparison } from '../tables/LoanTypesComparison';
import type { MortgageSavedCalculation as SavedCalculation } from '../../../services/mortgageCalculatorService';
import { useLogger } from '../services/ServiceProvider';

interface ComparisonModalProps {
  show: boolean;
  region: 'UK' | 'US';
  selectedCalculation: SavedCalculation | null;
  mortgageTypes?: any;
  loanTypes?: any;
  formatCurrency: (amount: number) => string;
  onClose: () => void;
}

/**
 * Comparison Modal component
 * Shows mortgage/loan type comparisons
 */
export const ComparisonModal = memo(function ComparisonModal({ show,
  region,
  selectedCalculation,
  mortgageTypes,
  loanTypes,
  formatCurrency,
  onClose
 }: ComparisonModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ComparisonModal component initialized', {
      componentName: 'ComparisonModal'
    });
  }, []);

  if (!show || !selectedCalculation) return <></>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Compare {region === 'UK' ? 'Mortgage' : 'Loan'} Types
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <PlusIcon size={20} className="rotate-45" />
            </button>
          </div>

          {region === 'UK' && mortgageTypes ? (
            <MortgageTypesComparison
              loanAmount={selectedCalculation.loanAmount}
              termYears={selectedCalculation.termYears}
              mortgageTypes={mortgageTypes}
              formatCurrency={formatCurrency}
            />
          ) : loanTypes ? (
            <LoanTypesComparison
              loanAmount={selectedCalculation.loanAmount}
              homePrice={selectedCalculation.propertyPrice}
              loanTypes={loanTypes}
              formatCurrency={formatCurrency}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});
