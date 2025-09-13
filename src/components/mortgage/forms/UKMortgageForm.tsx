import React, { useEffect, memo } from 'react';
import { CalculatorTypeSelector } from './CalculatorTypeSelector';
import { StandardMortgageForm } from './StandardMortgageForm';
import { SharedOwnershipForm } from './SharedOwnershipForm';
import { RemortgageForm } from './RemortgageForm';
import { AffordabilityForm } from './AffordabilityForm';
import { logger } from '../../../services/loggingService';

interface UKMortgageFormProps {
  formData: {
    propertyPrice: number;
    deposit: number;
    interestRate: number;
    termYears: number;
    region: 'england' | 'scotland' | 'wales';
    firstTimeBuyer: boolean;
    additionalProperty: boolean;
    mortgageType: 'fixed' | 'variable' | 'tracker';
    calculatorType: 'standard' | 'helpToBuy' | 'sharedOwnership' | 'remortgage' | 'affordability';
    useTwoTierRate: boolean;
    initialRatePeriod: 2 | 3 | 5 | 10;
    initialRate: number;
    subsequentRate: number;
    useHelpToBuy: boolean;
    isLondon: boolean;
    sharePercentage: number;
    currentBalance: number;
    currentRate: number;
    currentRemainingYears: number;
    newRate: number;
    arrangementFee: number;
    annualIncome: number;
    monthlyExpenses: number;
    existingDebt: number;
  };
  onFormChange: (updates: Partial<UKMortgageFormProps['formData']>) => void;
  useRealAccountData: boolean;
  setUseRealAccountData: (value: boolean) => void;
  selectedAccountIds: string[];
  onAccountSelection: (selectedIds: string[]) => void;
  useRealIncomeData: boolean;
  setUseRealIncomeData: (value: boolean) => void;
  financialData?: any;
  formatCurrency: (value: number) => string;
}

export const UKMortgageForm = memo(function UKMortgageForm({
  formData,
  onFormChange,
  useRealAccountData,
  setUseRealAccountData,
  selectedAccountIds,
  onAccountSelection,
  useRealIncomeData,
  setUseRealIncomeData,
  financialData,
  formatCurrency
}: UKMortgageFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('UKMortgageForm component initialized', {
      componentName: 'UKMortgageForm'
    });
  }, []);

  
  const handleCalculatorTypeChange = (type: typeof formData.calculatorType) => {
    onFormChange({ calculatorType: type });
  };

  return (
    <div className="space-y-4">
      {/* Calculator Type Selector */}
      <CalculatorTypeSelector
        calculatorType={formData.calculatorType}
        onTypeChange={handleCalculatorTypeChange}
      />

      {/* Standard Mortgage Form */}
      {formData.calculatorType === 'standard' && (
        <StandardMortgageForm
          formData={{
            propertyPrice: formData.propertyPrice,
            deposit: formData.deposit,
            interestRate: formData.interestRate,
            termYears: formData.termYears,
            region: formData.region,
            firstTimeBuyer: formData.firstTimeBuyer,
            additionalProperty: formData.additionalProperty,
            mortgageType: formData.mortgageType,
            useTwoTierRate: formData.useTwoTierRate,
            initialRatePeriod: formData.initialRatePeriod,
            initialRate: formData.initialRate,
            subsequentRate: formData.subsequentRate,
            useHelpToBuy: formData.useHelpToBuy,
            isLondon: formData.isLondon
          }}
          onFormChange={onFormChange}
          useRealAccountData={useRealAccountData}
          setUseRealAccountData={setUseRealAccountData}
          selectedAccountIds={selectedAccountIds}
          onAccountSelection={onAccountSelection}
          financialData={financialData}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Shared Ownership Form */}
      {formData.calculatorType === 'sharedOwnership' && (
        <SharedOwnershipForm
          formData={{
            propertyPrice: formData.propertyPrice,
            sharePercentage: formData.sharePercentage,
            deposit: formData.deposit,
            interestRate: formData.interestRate,
            termYears: formData.termYears
          }}
          onFormChange={onFormChange}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Remortgage Form */}
      {formData.calculatorType === 'remortgage' && (
        <RemortgageForm
          formData={{
            propertyPrice: formData.propertyPrice,
            currentBalance: formData.currentBalance,
            currentRate: formData.currentRate,
            currentRemainingYears: formData.currentRemainingYears,
            newRate: formData.newRate,
            termYears: formData.termYears,
            arrangementFee: formData.arrangementFee
          }}
          onFormChange={onFormChange}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Affordability Form */}
      {formData.calculatorType === 'affordability' && (
        <AffordabilityForm
          formData={{
            annualIncome: formData.annualIncome,
            monthlyExpenses: formData.monthlyExpenses,
            existingDebt: formData.existingDebt
          }}
          onFormChange={onFormChange}
          useRealIncomeData={useRealIncomeData}
          setUseRealIncomeData={setUseRealIncomeData}
          financialData={financialData}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
});

export default UKMortgageForm;