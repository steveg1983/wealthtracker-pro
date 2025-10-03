/**
 * @module MortgageCalculatorTypes
 * @description Enterprise-grade type definitions for mortgage calculator components
 */

import type { MortgageSavedCalculation as SavedCalculation, UKFormData, USFormData } from '../../../services/mortgageCalculatorService';

/**
 * Main calculator state
 */
export interface CalculatorState {
  calculations: SavedCalculation[];
  selectedCalculation: SavedCalculation | null;
  showCalculator: boolean;
  showComparison: boolean;
  savedCalculations: SavedCalculation[];
}

/**
 * Form state
 */
export interface FormState {
  ukFormData: UKFormData;
  usFormData: USFormData;
}

/**
 * Account integration state
 */
export interface AccountIntegrationState {
  selectedAccountIds: string[];
  useRealAccountData: boolean;
  useRealIncomeData: boolean;
}

/**
 * Header props
 */
export interface HeaderProps {
  onNewCalculation: () => void;
  onShowComparison: () => void;
  onToggleAccountData: () => void;
  useRealAccountData: boolean;
  hasCalculations: boolean;
}

/**
 * Results section props
 */
export interface ResultsSectionProps {
  region: 'UK' | 'US' | 'Other';
  selectedCalculation: SavedCalculation | null;
  formatCurrency: (value: number) => string;
  onClose: () => void;
}

/**
 * Calculation list props
 */
export interface CalculationListProps {
  calculations: SavedCalculation[];
  selectedCalculation: SavedCalculation | null;
  onSelect: (calc: SavedCalculation) => void;
  onDelete: (id: string) => void;
  formatCurrency: (value: number) => string;
}

/**
 * Form section props
 */
export interface FormSectionProps {
  region: 'UK' | 'US' | 'Other';
  ukFormData: UKFormData;
  usFormData: USFormData;
  onUKFormChange: (data: UKFormData) => void;
  onUSFormChange: (data: USFormData) => void;
  useRealIncomeData: boolean;
  financialData: any;
}

/**
 * Actions bar props
 */
export interface ActionsBarProps {
  onNewCalculation: () => void;
  onCompare: () => void;
  onExport: () => void;
  hasCalculations: boolean;
  isLoading?: boolean;
}
