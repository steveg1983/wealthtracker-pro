/**
 * @component Modals
 * @description Renders calculator and comparison modals
 */

import { memo, useEffect } from 'react';
import { CalculatorModal } from './CalculatorModal';
import { ComparisonModal } from './ComparisonModal';
import type { MortgageSavedCalculation as SavedCalculation, UKFormData, USFormData } from '../../../services/mortgageCalculatorService';
import { useLogger } from '../services/ServiceProvider';

interface ModalsProps {
  showCalculator: boolean;
  showComparison: boolean;
  onCloseCalculator: () => void;
  onCloseComparison: () => void;
  onCalculatorSubmit: (calculation: SavedCalculation) => Promise<void>;
  region: 'UK' | 'US' | 'Other';
  ukFormData: UKFormData;
  usFormData: USFormData;
  setUkFormData: (data: UKFormData) => void;
  setUsFormData: (data: USFormData) => void;
  formatCurrency: (value: number) => string;
  selectedCalculation: SavedCalculation | null;
  calculations: SavedCalculation[];
}

export const Modals = memo(function Modals({ showCalculator,
  showComparison,
  onCloseCalculator,
  onCloseComparison,
  onCalculatorSubmit,
  region,
  ukFormData,
  usFormData,
  setUkFormData,
  setUsFormData,
  formatCurrency,
  selectedCalculation,
  calculations
 }: ModalsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('Modals component initialized', {
      componentName: 'Modals'
    });
  }, []);

  return (
    <>
      {showCalculator && (
        <CalculatorModal
          show={showCalculator}
          onClose={onCloseCalculator}
          onCalculate={() => {}}
          region={region === 'Other' ? 'UK' : region}
          ukFormData={ukFormData}
          usFormData={usFormData}
          useRealAccountData={false}
          selectedAccountIds={[]}
          formatCurrency={formatCurrency}
          onAccountSelection={() => {}}
          setUseRealAccountData={() => {}}
        />
      )}
      
      {showComparison && (
        <ComparisonModal
          show={showComparison}
          onClose={onCloseComparison}
          region={region === 'Other' ? 'UK' : region}
          selectedCalculation={selectedCalculation}
          formatCurrency={formatCurrency}
        />
      )}
    </>
  );
});
