/**
 * Custom Hook for Mortgage Calculator
 * Manages mortgage calculator state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { mortgageCalculatorComponentService } from '../services/mortgageCalculatorComponentService';
import type { MortgageCalculation } from '../services/financialPlanningService';
import type { MortgageFormData } from '../services/mortgageCalculatorComponentService';

export interface UseMortgageCalculatorReturn {
  calculations: MortgageCalculation[];
  selectedCalculation: MortgageCalculation | null;
  showCalculator: boolean;
  formData: MortgageFormData;
  setShowCalculator: (show: boolean) => void;
  setFormData: (data: MortgageFormData) => void;
  handleCalculate: () => void;
  handleDeleteCalculation: (calculation: MortgageCalculation) => void;
  setSelectedCalculation: (calculation: MortgageCalculation | null) => void;
}

export function useMortgageCalculator(
  onDataChange: () => void
): UseMortgageCalculatorReturn {
  const [calculations, setCalculations] = useState<MortgageCalculation[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [formData, setFormData] = useState<MortgageFormData>(
    mortgageCalculatorComponentService.getInitialFormData()
  );
  const [selectedCalculation, setSelectedCalculation] = useState<MortgageCalculation | null>(null);

  // Load calculations on mount
  useEffect(() => {
    loadCalculations();
  }, []);

  const loadCalculations = useCallback(() => {
    const mortgageCalculations = mortgageCalculatorComponentService.loadCalculations();
    setCalculations(mortgageCalculations);
    
    // Auto-select first calculation if none selected
    if (mortgageCalculations.length > 0 && !selectedCalculation) {
      setSelectedCalculation(mortgageCalculatorComponentService.getFirstCalculation(mortgageCalculations));
    }
  }, [selectedCalculation]);

  const handleCalculate = useCallback(() => {
    if (!mortgageCalculatorComponentService.validateFormData(formData)) {
      return;
    }

    const calculation = mortgageCalculatorComponentService.calculateMortgage(formData);
    setSelectedCalculation(calculation);
    setShowCalculator(false);
    loadCalculations();
    onDataChange();
  }, [formData, loadCalculations, onDataChange]);

  const handleDeleteCalculation = useCallback((calculation: MortgageCalculation) => {
    if (window.confirm('Are you sure you want to delete this mortgage calculation?')) {
      mortgageCalculatorComponentService.deleteMortgageCalculation(calculation.id);
      
      // Update selected calculation if needed
      const newSelected = mortgageCalculatorComponentService.getNewSelectedCalculation(
        calculations,
        calculation.id,
        selectedCalculation?.id
      );
      setSelectedCalculation(newSelected);
      
      loadCalculations();
      onDataChange();
    }
  }, [calculations, selectedCalculation, loadCalculations, onDataChange]);

  return {
    calculations,
    selectedCalculation,
    showCalculator,
    formData,
    setShowCalculator,
    setFormData,
    handleCalculate,
    handleDeleteCalculation,
    setSelectedCalculation
  };
}