import { useState, useEffect } from 'react';
import { useRegionalCurrency } from '../../../hooks/useRegionalSettings';
import type { 
  IRAComparison, 
  IRAFormData
} from './types';
import {
  DEFAULT_FORM_DATA,
  IRA_LIMITS,
  ROTH_PHASE_OUT,
  TRADITIONAL_PHASE_OUT
} from './types';

export function useIRAComparison() {
  const { formatCurrency } = useRegionalCurrency();
  const [formData, setFormData] = useState<IRAFormData>(DEFAULT_FORM_DATA);
  const [comparison, setComparison] = useState<IRAComparison | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const isEligibleForCatchUp = formData.currentAge >= IRA_LIMITS.CATCH_UP_AGE;
  const maxContribution = IRA_LIMITS.CONTRIBUTION_LIMIT + (isEligibleForCatchUp ? IRA_LIMITS.CATCH_UP_LIMIT : 0);

  useEffect(() => {
    calculateComparison();
  }, [formData]);

  const calculatePhaseOut = (income: number, start: number, end: number, amount: number): number => {
    if (income <= start) return amount;
    if (income >= end) return 0;
    
    const phaseOutRange = end - start;
    const incomeOverStart = income - start;
    const phaseOutPercentage = 1 - (incomeOverStart / phaseOutRange);
    
    return Math.floor(amount * phaseOutPercentage);
  };

  const calculateComparison = () => {
    const {
      currentAge,
      retirementAge,
      annualContribution,
      currentBalance,
      expectedReturn,
      currentIncome,
      retirementIncome,
      filingStatus,
      currentTaxRate,
      retirementTaxRate,
      hasWorkplacePlan,
      spouseHasWorkplacePlan
    } = formData;

    const yearsToRetirement = retirementAge - currentAge;
    const monthlyContribution = annualContribution / 12;
    const monthlyReturn = expectedReturn / 100 / 12;
    const months = yearsToRetirement * 12;

    // Calculate future value
    const futureValue = currentBalance * Math.pow(1 + monthlyReturn, months) +
      monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

    // Traditional IRA calculations
    let traditionalDeductible = annualContribution;
    let canDeductTraditional = true;

    if (hasWorkplacePlan) {
      const phaseOut = TRADITIONAL_PHASE_OUT[filingStatus === 'marriedSeparate' ? 'single' : filingStatus];
      traditionalDeductible = calculatePhaseOut(currentIncome, phaseOut.start, phaseOut.end, annualContribution);
      canDeductTraditional = traditionalDeductible > 0;
    } else if (filingStatus === 'married' && spouseHasWorkplacePlan) {
      const phaseOut = TRADITIONAL_PHASE_OUT.marriedSpouseOnly;
      traditionalDeductible = calculatePhaseOut(currentIncome, phaseOut.start, phaseOut.end, annualContribution);
      canDeductTraditional = traditionalDeductible > 0;
    }

    const traditionalTaxDeduction = traditionalDeductible * (currentTaxRate / 100);
    const traditionalNetCost = annualContribution - traditionalTaxDeduction;
    const traditionalTaxOnWithdrawal = futureValue * (retirementTaxRate / 100);
    const traditionalNetWithdrawal = futureValue - traditionalTaxOnWithdrawal;

    // Roth IRA calculations
    const rothPhaseOut = ROTH_PHASE_OUT[filingStatus === 'marriedSeparate' ? 'marriedSeparate' : filingStatus];
    const rothContributionAllowed = calculatePhaseOut(
      currentIncome,
      rothPhaseOut.start,
      rothPhaseOut.end,
      annualContribution
    );
    const canContributeRoth = rothContributionAllowed > 0;

    const rothTaxPaidNow = 0; // No deduction for Roth
    const rothNetCost = rothContributionAllowed; // Pay with after-tax dollars
    const rothTaxOnWithdrawal = 0; // Tax-free withdrawals
    const rothNetWithdrawal = canContributeRoth ? futureValue : 0;

    // Determine recommendation
    let recommendation: 'traditional' | 'roth' | 'both';
    if (currentTaxRate > retirementTaxRate && canDeductTraditional) {
      recommendation = 'traditional';
    } else if (currentTaxRate < retirementTaxRate && canContributeRoth) {
      recommendation = 'roth';
    } else if (canContributeRoth) {
      recommendation = 'roth';
    } else if (canDeductTraditional) {
      recommendation = 'traditional';
    } else {
      recommendation = 'both'; // Consider backdoor Roth or non-deductible traditional
    }

    setComparison({
      traditional: {
        contributionAmount: annualContribution,
        taxDeductionNow: traditionalTaxDeduction,
        netCostNow: traditionalNetCost,
        projectedBalance: futureValue,
        taxesOnWithdrawal: traditionalTaxOnWithdrawal,
        netWithdrawal: traditionalNetWithdrawal,
        effectiveTaxRate: retirementTaxRate,
        canDeduct: canDeductTraditional,
        deductionPhaseOutAmount: traditionalDeductible
      },
      roth: {
        contributionAmount: rothContributionAllowed,
        taxPaidNow: rothTaxPaidNow,
        netCostNow: rothNetCost,
        projectedBalance: canContributeRoth ? futureValue : 0,
        taxesOnWithdrawal: rothTaxOnWithdrawal,
        netWithdrawal: rothNetWithdrawal,
        effectiveTaxRate: 0,
        canContribute: canContributeRoth,
        contributionPhaseOutAmount: rothContributionAllowed
      },
      recommendation,
      difference: Math.abs(traditionalNetWithdrawal - rothNetWithdrawal)
    });
  };

  const getRecommendationText = () => {
    if (!comparison) return '';
    
    switch (comparison.recommendation) {
      case 'traditional':
        return 'Traditional IRA is recommended due to your higher current tax rate';
      case 'roth':
        return 'Roth IRA is recommended for tax-free growth and withdrawals';
      case 'both':
        return 'Consider both or explore backdoor Roth strategies';
      default:
        return '';
    }
  };

  const updateFormData = (updates: Partial<IRAFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return {
    formData,
    updateFormData,
    comparison,
    showDetails,
    setShowDetails,
    isEligibleForCatchUp,
    maxContribution,
    getRecommendationText,
    formatCurrency
  };
}