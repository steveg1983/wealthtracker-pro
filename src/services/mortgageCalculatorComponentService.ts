/**
 * Mortgage Calculator Component Service
 * Business logic for mortgage calculator UI component
 */

import { financialPlanningService } from './financialPlanningService';
import type { MortgageCalculation } from './financialPlanningService';

export interface MortgageFormData {
  loanAmount: number;
  interestRate: number;
  loanTermYears: number;
}

class MortgageCalculatorComponentService {
  /**
   * Get initial form data
   */
  getInitialFormData(): MortgageFormData {
    return {
      loanAmount: 400000,
      interestRate: 6.5,
      loanTermYears: 30
    };
  }

  /**
   * Load all mortgage calculations
   */
  loadCalculations(): MortgageCalculation[] {
    // This should be refactored to be async and accept clerkUserId
    return [];
  }

  /**
   * Calculate mortgage based on form data
   */
  calculateMortgage(formData: MortgageFormData): MortgageCalculation {
    // calculateMortgage is deprecated, calculate locally
    const monthlyRate = (formData.interestRate / 100) / 12;
    const numPayments = formData.loanTermYears * 12;
    const monthlyPayment = formData.loanAmount * 
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    
    return {
      id: Date.now().toString(),
      monthly_payment: monthlyPayment,
      total_payment: monthlyPayment * numPayments,
      total_interest: (monthlyPayment * numPayments) - formData.loanAmount,
      principal: formData.loanAmount,
      interest_rate: formData.interestRate,
      loan_term: formData.loanTermYears
    } as unknown as MortgageCalculation;
  }

  /**
   * Delete a mortgage calculation
   */
  deleteMortgageCalculation(calculationId: string): void {
    // TODO: Implement deletion when available in financialPlanningService
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format percentage for display
   */
  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get the first calculation or null
   */
  getFirstCalculation(calculations: MortgageCalculation[]): MortgageCalculation | null {
    return calculations.length > 0 ? calculations[0] : null;
  }

  /**
   * Update selected calculation after deletion
   */
  getNewSelectedCalculation(
    calculations: MortgageCalculation[],
    deletedId: string,
    currentSelectedId: string | undefined
  ): MortgageCalculation | null {
    if (currentSelectedId === deletedId) {
      const remaining = calculations.filter(c => c.id !== deletedId);
      return remaining.length > 0 ? remaining[0] : null;
    }
    return calculations.find(c => c.id === currentSelectedId) || null;
  }

  /**
   * Check if should show empty state
   */
  shouldShowEmptyState(calculations: MortgageCalculation[]): boolean {
    return calculations.length === 0;
  }

  /**
   * Get amortization preview (first 12 months)
   */
  getAmortizationPreview(calculation: MortgageCalculation & { amortizationSchedule?: any[] }) {
    const schedule = calculation.amortizationSchedule || [];
    return {
      entries: schedule.slice(0, 12),
      totalPayments: schedule.length,
      previewCount: 12
    };
  }

  /**
   * Validate form data
   */
  validateFormData(formData: MortgageFormData): boolean {
    return (
      formData.loanAmount > 0 &&
      formData.interestRate >= 0 &&
      formData.interestRate <= 20 &&
      formData.loanTermYears > 0
    );
  }
}

export const mortgageCalculatorComponentService = new MortgageCalculatorComponentService();