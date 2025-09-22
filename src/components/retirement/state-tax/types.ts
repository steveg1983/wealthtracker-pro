/**
 * @module StateTaxTypes
 * @description Type definitions for state tax calculator components
 */

export interface State {
  code: string;
  name: string;
}

export interface TaxCalculation {
  totalTax: number;
  effectiveRate: number;
  stateIncomeTax: number;
  localTax?: number;
  deductions?: number;
  credits?: number;
}

export interface StateResult extends TaxCalculation {
  state: string;
}

export interface ConfigurationSectionProps {
  filingStatus: 'single' | 'married';
  age: number;
  selectedState: string;
  states: State[];
  onFilingStatusChange: (status: 'single' | 'married') => void;
  onAgeChange: (age: number) => void;
  onStateChange: (state: string) => void;
}

import type { StateTaxCalculation } from '../../../services/stateTaxService';

export interface ResultsSectionProps {
  calculation: StateTaxCalculation | null;
  selectedState: string;
  formatCurrency: (value: number) => string;
  showBreakdown: boolean;
  onToggleBreakdown: () => void;
}

export interface ComparisonSectionProps {
  showComparison: boolean;
  onToggleComparison: () => void;
  compareStates: string[];
  states: State[];
  onToggleState: (stateCode: string) => void;
}

export interface BestStatesSectionProps {
  bestStates: StateResult[];
  formatCurrency: (value: number) => string;
}