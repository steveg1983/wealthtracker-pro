/**
 * Custom Hook for 401(k) Calculator
 * Manages 401(k) calculation state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { retirement401kService } from '../services/retirement401kService';
import type { Retirement401kFormData, Contribution401k } from '../services/retirement401kService';

export interface UseRetirement401kReturn {
  formData: Retirement401kFormData;
  results: Contribution401k | null;
  showAdvanced: boolean;
  maxContribution: number;
  isEligibleForCatchUp: boolean;
  matchDescription: string;
  effectiveMatchRate: number;
  isLeavingMoney: boolean;
  recommendations: {
    minimum: number;
    recommended: number;
    aggressive: number;
  };
  setFormData: (data: Retirement401kFormData) => void;
  setShowAdvanced: (show: boolean) => void;
  updateField: (field: keyof Retirement401kFormData, value: number) => void;
}

export function useRetirement401k(): UseRetirement401kReturn {
  const [formData, setFormData] = useState<Retirement401kFormData>(
    retirement401kService.getInitialFormData()
  );
  const [results, setResults] = useState<Contribution401k | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate derived values
  const isEligibleForCatchUp = retirement401kService.isEligibleForCatchUp(formData.currentAge);
  const maxContribution = retirement401kService.getMaxContribution(formData.currentAge);
  
  const matchDescription = retirement401kService.getMatchDescription(
    formData.employerMatchPercent,
    formData.employerMatchLimit
  );
  
  const effectiveMatchRate = retirement401kService.getEffectiveMatchRate(
    formData.contributionPercent,
    formData.employerMatchPercent,
    formData.employerMatchLimit
  );
  
  const isLeavingMoney = retirement401kService.isLeavingMoneyOnTable(
    formData.contributionPercent,
    formData.employerMatchLimit
  );
  
  // Calculate recommendations based on match and maximums
  const recommendations = {
    minimum: formData.employerMatchLimit, // At least get full match
    recommended: Math.min(15, (maxContribution / formData.annualSalary) * 100), // 15% or max
    aggressive: (maxContribution / formData.annualSalary) * 100 // Max contribution
  };

  // Calculate results when form data changes
  useEffect(() => {
    const validation = retirement401kService.validateFormData(formData);
    if (validation.isValid) {
      const calculationResults = retirement401kService.calculateContribution(formData);
      setResults(calculationResults);
    } else {
      setResults(null);
    }
  }, [formData]);

  // Update single field
  const updateField = useCallback((field: keyof Retirement401kFormData, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  return {
    formData,
    results,
    showAdvanced,
    maxContribution,
    isEligibleForCatchUp,
    matchDescription,
    effectiveMatchRate,
    isLeavingMoney,
    recommendations,
    setFormData,
    setShowAdvanced,
    updateField
  };
}