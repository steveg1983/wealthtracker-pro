/**
 * @hook useTaxCalculation
 * @description Custom hook for tax calculation logic and state management
 * @performance Optimized calculation methods with proper error handling
 */

import { useState } from 'react';
import { taxDataService, UKTaxYear } from '../../services/taxDataService';

interface TaxResults {
  incomeTax: number;
  nationalInsurance?: number;
  total: number;
  effectiveRate: number;
  annualIncome: number;
  monthlyIncome: number;
  weeklyIncome: number;
  takeHomeAnnual: number;
  takeHomeMonthly: number;
  takeHomeWeekly: number;
  [key: string]: number | undefined;
}

type PayFrequency = 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly';
type FilingStatus = 'single' | 'married' | 'separate' | 'head';

export function useTaxCalculation() {
  // Form state
  const [grossIncome, setGrossIncome] = useState<string>('');
  const [payFrequency, setPayFrequency] = useState<PayFrequency | null>(null);
  const [overPensionAge, setOverPensionAge] = useState<boolean | null>(null);
  const [selectedTaxYear, setSelectedTaxYear] = useState<UKTaxYear>(taxDataService.getSelectedUKTaxYear());
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  
  // Results state
  const [results, setResults] = useState<TaxResults | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Convert income to annual amount based on frequency
  const getAnnualIncome = (): number => {
    const amount = parseFloat(grossIncome) || 0;
    if (!payFrequency) return 0;
    switch (payFrequency) {
      case 'yearly': return amount;
      case 'monthly': return amount * 12;
      case 'weekly': return amount * 52;
      case 'daily': return amount * 260; // 5 days/week * 52 weeks
      case 'hourly': return amount * 2080; // 40 hours/week * 52 weeks
      default: return amount;
    }
  };

  const calculateTax = (region: 'UK' | 'US') => {
    const annualIncome = getAnnualIncome();
    if (annualIncome <= 0) return;
    
    const taxResult = taxDataService.calculateTax(annualIncome, region, {
      filingStatus: region === 'US' ? filingStatus : undefined,
      taxYear: region === 'UK' ? selectedTaxYear : undefined,
      scottish: false // Could add Scottish tax option later
    });
    
    // Adjust NI if over pension age (UK only)
    const adjustedResult = { ...taxResult };
    if (region === 'UK' && overPensionAge && 'nationalInsurance' in adjustedResult) {
      adjustedResult.nationalInsurance = 0; // No NI if over state pension age
      adjustedResult.total = adjustedResult.incomeTax;
      adjustedResult.effectiveRate = adjustedResult.incomeTax / annualIncome;
    }
    
    // Normalize the result to have incomeTax property
    const incomeTax = 'incomeTax' in adjustedResult ? adjustedResult.incomeTax : 
                     'federal' in adjustedResult ? adjustedResult.federal : 0;
    
    setResults({
      ...adjustedResult,
      incomeTax,
      annualIncome,
      monthlyIncome: annualIncome / 12,
      weeklyIncome: annualIncome / 52,
      takeHomeAnnual: annualIncome - adjustedResult.total,
      takeHomeMonthly: (annualIncome - adjustedResult.total) / 12,
      takeHomeWeekly: (annualIncome - adjustedResult.total) / 52
    });
    setShowResults(true);
  };

  const canCalculate = (region: 'UK' | 'US'): boolean => {
    return !!(
      grossIncome && 
      parseFloat(grossIncome) > 0 && 
      payFrequency && 
      (region !== 'UK' || overPensionAge !== null)
    );
  };

  return {
    // Form state
    grossIncome,
    setGrossIncome,
    payFrequency,
    setPayFrequency,
    overPensionAge,
    setOverPensionAge,
    selectedTaxYear,
    setSelectedTaxYear,
    filingStatus,
    setFilingStatus,
    
    // Results state
    results,
    showResults,
    
    // Methods
    calculateTax,
    canCalculate,
    getAnnualIncome
  };
}