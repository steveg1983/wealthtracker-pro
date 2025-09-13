import { useState, useEffect } from 'react';
import { useRegionalCurrency } from '../../../hooks/useRegionalSettings';
import type { 
  ISACalculation, 
  ISAFormData
} from './types';
import {
  DEFAULT_FORM_DATA,
  ISA_LIMITS
} from './types';

export function useISACalculator() {
  const { formatCurrency } = useRegionalCurrency();
  const [formData, setFormData] = useState<ISAFormData>(DEFAULT_FORM_DATA);
  const [calculation, setCalculation] = useState<ISACalculation | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const {
    ISA_ANNUAL_LIMIT,
    LIFETIME_ISA_LIMIT,
    LIFETIME_ISA_BONUS_RATE,
    LIFETIME_ISA_MAX_BONUS,
    LIFETIME_ISA_HOME_LIMIT,
    LIFETIME_ISA_MIN_AGE,
    LIFETIME_ISA_MAX_AGE,
    LIFETIME_ISA_MAX_CONTRIBUTION_AGE,
    LIFETIME_ISA_WITHDRAWAL_AGE,
    LIFETIME_ISA_PENALTY_RATE
  } = ISA_LIMITS;

  useEffect(() => {
    calculateISA();
  }, [formData]);

  const calculateISA = () => {
    const {
      currentAge,
      retirementAge,
      cashISAAmount,
      stocksISAAmount,
      lifetimeISAAmount,
      cashInterestRate,
      stocksExpectedReturn,
      currentTaxRate,
      buyingFirstHome,
      homePurchaseYear,
      homePrice
    } = formData;

    // Validate total doesn't exceed limit
    const totalContribution = cashISAAmount + stocksISAAmount + lifetimeISAAmount;
    const actualLifetimeISA = Math.min(lifetimeISAAmount, LIFETIME_ISA_LIMIT);
    const actualTotal = Math.min(totalContribution, ISA_ANNUAL_LIMIT);
    
    // Adjust if over limit
    let adjustedCash = cashISAAmount;
    let adjustedStocks = stocksISAAmount;
    const adjustedLifetime = actualLifetimeISA;
    
    if (totalContribution > ISA_ANNUAL_LIMIT) {
      const excess = totalContribution - ISA_ANNUAL_LIMIT;
      // Reduce stocks & shares ISA first, then cash ISA
      if (adjustedStocks >= excess) {
        adjustedStocks -= excess;
      } else {
        adjustedCash -= (excess - (stocksISAAmount - adjustedStocks));
        adjustedStocks = 0;
      }
    }

    // Calculate projections
    const yearsToRetirement = retirementAge - currentAge;
    
    // Cash ISA calculation
    const cashProjection = adjustedCash * Math.pow(1 + (cashInterestRate / 100), yearsToRetirement);
    const cashInterestEarned = cashProjection - adjustedCash;
    const cashTaxSaved = cashInterestEarned * (currentTaxRate / 100); // Tax saved on interest

    // Stocks & Shares ISA calculation
    const stocksProjection = adjustedStocks * Math.pow(1 + (stocksExpectedReturn / 100), yearsToRetirement);
    const stocksGainEarned = stocksProjection - adjustedStocks;
    const stocksTaxSaved = stocksGainEarned * 0.20; // Capital gains tax saved (20% for higher rate)

    // Lifetime ISA calculation
    const canContributeLifetime = currentAge >= LIFETIME_ISA_MIN_AGE && currentAge <= LIFETIME_ISA_MAX_AGE;
    const lifetimeBonus = canContributeLifetime ? adjustedLifetime * LIFETIME_ISA_BONUS_RATE : 0;
    const lifetimeTotalContribution = adjustedLifetime + lifetimeBonus;
    
    // Calculate years of contribution (stops at 50)
    const yearsOfContribution = Math.min(
      LIFETIME_ISA_MAX_CONTRIBUTION_AGE - currentAge,
      yearsToRetirement
    );
    
    // Project LISA value (with annual contributions and bonuses)
    let lifetimeProjection = 0;
    if (canContributeLifetime) {
      const annualTotal = adjustedLifetime + lifetimeBonus;
      const monthlyContribution = annualTotal / 12;
      const monthlyReturn = stocksExpectedReturn / 100 / 12;
      const months = yearsOfContribution * 12;
      
      lifetimeProjection = monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);
    }

    // Calculate early withdrawal penalty
    const withdrawalAge = buyingFirstHome ? currentAge + homePurchaseYear : retirementAge;
    const earlyWithdrawal = withdrawalAge < LIFETIME_ISA_WITHDRAWAL_AGE && !buyingFirstHome;
    const penalty = earlyWithdrawal ? lifetimeProjection * LIFETIME_ISA_PENALTY_RATE : 0;
    const netAfterPenalty = lifetimeProjection - penalty;
    
    // Can use for home purchase?
    const canUseForHome = buyingFirstHome && 
                          homePrice <= LIFETIME_ISA_HOME_LIMIT && 
                          canContributeLifetime;

    // Recommendation logic
    let recommendation = '';
    if (currentAge <= LIFETIME_ISA_MAX_AGE && buyingFirstHome && homePrice <= LIFETIME_ISA_HOME_LIMIT) {
      recommendation = 'Maximize Lifetime ISA for the 25% government bonus on your first home';
    } else if (currentAge <= LIFETIME_ISA_MAX_AGE && retirementAge >= LIFETIME_ISA_WITHDRAWAL_AGE) {
      recommendation = 'Consider Lifetime ISA for the 25% bonus and retirement at 60+';
    } else if (yearsToRetirement > 5) {
      recommendation = 'Focus on Stocks & Shares ISA for long-term growth potential';
    } else {
      recommendation = 'Consider Cash ISA for shorter-term savings with guaranteed returns';
    }

    setCalculation({
      cashISA: {
        contribution: adjustedCash,
        interestRate: cashInterestRate,
        projectedValue: cashProjection,
        taxSaved: cashTaxSaved
      },
      stocksISA: {
        contribution: adjustedStocks,
        expectedReturn: stocksExpectedReturn,
        projectedValue: stocksProjection,
        taxSaved: stocksTaxSaved
      },
      lifetimeISA: {
        contribution: adjustedLifetime,
        governmentBonus: lifetimeBonus,
        totalContribution: lifetimeTotalContribution,
        projectedValue: lifetimeProjection,
        earlyWithdrawalPenalty: penalty,
        netAfterPenalty: netAfterPenalty,
        canUseForHome: canUseForHome
      },
      totalUsed: adjustedCash + adjustedStocks + adjustedLifetime,
      remainingAllowance: ISA_ANNUAL_LIMIT - (adjustedCash + adjustedStocks + adjustedLifetime),
      recommendation
    });
  };

  const getTotalAllocation = () => {
    return formData.cashISAAmount + formData.stocksISAAmount + formData.lifetimeISAAmount;
  };

  const isOverLimit = () => {
    return getTotalAllocation() > ISA_ANNUAL_LIMIT;
  };

  const canOpenLifetimeISA = () => {
    return formData.currentAge >= LIFETIME_ISA_MIN_AGE && formData.currentAge <= LIFETIME_ISA_MAX_AGE;
  };

  const updateFormData = (updates: Partial<ISAFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return {
    formData,
    updateFormData,
    calculation,
    showDetails,
    setShowDetails,
    formatCurrency,
    getTotalAllocation,
    isOverLimit,
    canOpenLifetimeISA,
    ISA_ANNUAL_LIMIT,
    LIFETIME_ISA_LIMIT
  };
}