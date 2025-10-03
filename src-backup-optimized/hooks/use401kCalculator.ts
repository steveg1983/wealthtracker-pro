/**
 * Custom Hook for 401(k) Calculator
 * Manages form state and calculations
 */

import { useState, useEffect, useCallback } from 'react';
import { retirement401kService, type Retirement401kFormData, type Contribution401k } from '../services/retirement401kService';

export interface Use401kCalculatorReturn {
  formData: Retirement401kFormData;
  results: Contribution401k | null;
  showAdvanced: boolean;
  isEligibleForCatchUp: boolean;
  maxContribution: number;
  contributionLimits: { regular: number; catchUp: number };
  matchDescription: string;
  isBelowMatchLimit: boolean;
  lostMatchAmount: number;
  setFormData: (data: Retirement401kFormData) => void;
  updateField: (field: keyof Retirement401kFormData, value: number) => void;
  toggleAdvanced: () => void;
  resetForm: () => void;
}

export function use401kCalculator(): Use401kCalculatorReturn {
  const [formData, setFormData] = useState<Retirement401kFormData>(
    retirement401kService.getDefaultFormData()
  );
  const [results, setResults] = useState<Contribution401k | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate results whenever form data changes
  useEffect(() => {
    const calculationResults = retirement401kService.calculateContribution(formData);
    setResults(calculationResults);
  }, [formData]);

  // Update single field
  const updateField = useCallback((field: keyof Retirement401kFormData, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Toggle advanced settings
  const toggleAdvanced = useCallback(() => {
    setShowAdvanced(prev => !prev);
  }, []);

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setFormData(retirement401kService.getDefaultFormData());
    setShowAdvanced(false);
  }, []);

  // Computed values
  const isEligibleForCatchUp = retirement401kService.isEligibleForCatchUp(formData.currentAge);
  const maxContribution = retirement401kService.getMaxContribution(formData.currentAge);
  const contributionLimits = retirement401kService.getContributionLimits();
  
  const matchDescription = retirement401kService.getMatchDescription(
    formData.employerMatchPercent,
    formData.employerMatchLimit
  );
  
  const isBelowMatchLimit = retirement401kService.isBelowMatchLimit(
    formData.contributionPercent,
    formData.employerMatchLimit
  );
  
  const lostMatchAmount = retirement401kService.calculateLostMatch(
    formData.annualSalary,
    formData.contributionPercent,
    formData.employerMatchPercent,
    formData.employerMatchLimit
  );

  return {
    formData,
    results,
    showAdvanced,
    isEligibleForCatchUp,
    maxContribution,
    contributionLimits,
    matchDescription,
    isBelowMatchLimit,
    lostMatchAmount,
    setFormData,
    updateField,
    toggleAdvanced,
    resetForm
  };
}