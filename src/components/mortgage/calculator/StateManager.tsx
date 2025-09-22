/**
 * @component StateManager
 * @description Manages state and data loading for mortgage calculator
 */

import { useEffect, useCallback } from 'react';
import { MortgageCalculatorService } from '../../../services/mortgageCalculatorService';
import { useLogger } from '../services/ServiceProvider';
import type { MortgageSavedCalculation as SavedCalculation, UKFormData, USFormData } from '../../../services/mortgageCalculatorService';

interface StateManagerProps {
  user: any;
  financialData: any;
  region: 'UK' | 'US' | 'Other';
  useRealIncomeData: boolean;
  ukFormData: UKFormData;
  usFormData: USFormData;
  calculations: SavedCalculation[];
  setCalculations: (calcs: SavedCalculation[]) => void;
  setSavedCalculations: (calcs: any[]) => void;
  setUkFormData: (data: UKFormData) => void;
  setUsFormData: (data: USFormData) => void;
}

export function useStateManager({ user,
  financialData,
  region,
  useRealIncomeData,
  ukFormData,
  usFormData,
  calculations,
  setCalculations,
  setSavedCalculations,
  setUkFormData,
  setUsFormData
 }: StateManagerProps) {
  const logger = useLogger();
  
  // Load calculations on mount with error handling
  useEffect(() => {
    try {
      const loadedCalcs = MortgageCalculatorService.loadCalculations();
      setCalculations(loadedCalcs);
    } catch (error) {
      logger.error('Failed to load local calculations:', error);
      setCalculations([]);
    }
    
    if (user) {
      MortgageCalculatorService.loadSupabaseCalculations(user.id)
        .then(setSavedCalculations)
        .catch(error => {
          logger.error('Failed to load saved calculations:', error);
          setSavedCalculations([]);
        });
    }
  }, [user, setCalculations, setSavedCalculations]);

  // Auto-populate income data with error handling
  useEffect(() => {
    if (useRealIncomeData && financialData && region === 'UK') {
      try {
        const updatedData = MortgageCalculatorService.updateFormWithRealData(
          ukFormData,
          financialData.annualIncome.toNumber(),
          financialData.monthlyExpenses.toNumber(),
          financialData.totalMonthlyDebtPayments.toNumber()
        );
        setUkFormData(updatedData);
      } catch (error) {
        logger.error('Failed to update form with real data:', error);
      }
    }
    
    if (useRealIncomeData && financialData && region === 'US') {
      try {
        const updatedData = MortgageCalculatorService.updateFormWithRealData(
          usFormData as any,
          financialData.annualIncome.toNumber(),
          financialData.monthlyExpenses.toNumber(),
          financialData.totalMonthlyDebtPayments.toNumber()
        ) as unknown as USFormData;
        setUsFormData(updatedData);
      } catch (error) {
        logger.error('Failed to update US form with real data:', error);
      }
    }
  }, [useRealIncomeData, financialData, region, setUkFormData, setUsFormData]);

  // Save calculation handler
  const handleSaveCalculation = useCallback(async (
    calculation: SavedCalculation
  ): Promise<void> => {
    try {
      // Update state
      const updatedCalculations = [...calculations, calculation];
      setCalculations(updatedCalculations);
      
      // Save locally
      MortgageCalculatorService.saveCalculations(updatedCalculations);
      logger.info('Calculation saved successfully');
    } catch (error) {
      logger.error('Failed to save calculation:', error);
      throw error;
    }
  }, [calculations, setCalculations]);

  // Delete calculation handler
  const handleDeleteCalculation = useCallback(async (id: string): Promise<void> => {
    try {
      // Remove from local storage
      const updatedCalcs = MortgageCalculatorService.deleteCalculation(calculations, id);
      setCalculations(updatedCalcs);
      
      // TODO: Delete from Supabase when method is available
      logger.info('Calculation deleted successfully');
    } catch (error) {
      logger.error('Failed to delete calculation:', error);
    }
  }, [user, setCalculations]);

  return {
    handleSaveCalculation,
    handleDeleteCalculation
  };
}
