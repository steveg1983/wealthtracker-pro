import { ukMortgageService } from './ukMortgageService';
import { usMortgageService } from './usMortgageService';
import { financialPlanningService } from './financialPlanningService';
import { logger } from './loggingService';

export interface MortgageSavedCalculation {
  id: string;
  date: Date;
  region: 'UK' | 'US';
  propertyPrice: number;
  loanAmount: number;
  interestRate: number;
  termYears: number;
  monthlyPayment: number;
  totalInterest: number;
  stampDuty?: number;
  pmi?: number;
  propertyTax?: number;
  loanType?: string;
  ukRegion?: 'england' | 'scotland' | 'wales';
  usState?: string;
  calculatorType?: 'standard' | 'helpToBuy' | 'sharedOwnership' | 'remortgage' | 'affordability';
  helpToBuy?: any;
  sharedOwnership?: any;
  remortgage?: any;
  affordability?: any;
}

export interface UKFormData {
  propertyPrice: number;
  deposit: number;
  interestRate: number;
  termYears: number;
  region: 'england' | 'scotland' | 'wales';
  firstTimeBuyer: boolean;
  additionalProperty: boolean;
  mortgageType: 'fixed' | 'variable' | 'tracker';
  calculatorType: 'standard' | 'helpToBuy' | 'sharedOwnership' | 'remortgage' | 'affordability';
  useTwoTierRate: boolean;
  initialRatePeriod: 2 | 3 | 5 | 10;
  initialRate: number;
  subsequentRate: number;
  useHelpToBuy: boolean;
  isLondon: boolean;
  sharePercentage: number;
  currentBalance: number;
  currentRate: number;
  currentRemainingYears: number;
  newRate: number;
  arrangementFee: number;
  annualIncome: number;
  monthlyExpenses: number;
  existingDebt: number;
}

export interface USFormData {
  homePrice: number;
  downPayment: number;
  interestRate: number;
  termYears: number;
  state: string;
  loanType: 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo';
  creditScore: number;
}

/**
 * Service for managing mortgage calculations and data
 */
export class MortgageCalculatorService {
  /**
   * Create default UK form data
   */
  static createDefaultUKFormData(): UKFormData {
    return {
      propertyPrice: 350000,
      deposit: 35000,
      interestRate: 5.5,
      termYears: 25,
      region: 'england',
      firstTimeBuyer: false,
      additionalProperty: false,
      mortgageType: 'fixed',
      calculatorType: 'standard',
      useTwoTierRate: false,
      initialRatePeriod: 2,
      initialRate: 5.5,
      subsequentRate: 4.5,
      useHelpToBuy: false,
      isLondon: false,
      sharePercentage: 0.25,
      currentBalance: 200000,
      currentRate: 6.5,
      currentRemainingYears: 20,
      newRate: 4.5,
      arrangementFee: 999,
      annualIncome: 50000,
      monthlyExpenses: 1500,
      existingDebt: 300
    };
  }

  /**
   * Create default US form data
   */
  static createDefaultUSFormData(): USFormData {
    return {
      homePrice: 400000,
      downPayment: 80000,
      interestRate: 6.5,
      termYears: 30,
      state: 'CA',
      loanType: 'conventional',
      creditScore: 740
    };
  }

  /**
   * Calculate UK mortgage
   */
  static calculateUKMortgage(formData: UKFormData): MortgageSavedCalculation {
    const loanAmount = formData.propertyPrice - formData.deposit;
    
    const calculation = ukMortgageService.calculateMortgage(
      loanAmount,
      formData.interestRate / 100,
      formData.termYears
    );
    
    const stampDuty = ukMortgageService.calculateStampDuty(
      formData.propertyPrice,
      formData.region as 'england' | 'scotland' | 'wales' | undefined,
      formData.firstTimeBuyer,
      formData.additionalProperty
    );
    
    return {
      id: Date.now().toString(),
      date: new Date(),
      region: 'UK',
      propertyPrice: formData.propertyPrice,
      loanAmount: loanAmount,
      interestRate: formData.interestRate,
      termYears: formData.termYears,
      monthlyPayment: calculation.monthlyPayment,
      totalInterest: calculation.totalInterest,
      stampDuty: stampDuty.stampDuty,
      ukRegion: formData.region,
      loanType: formData.mortgageType,
      calculatorType: formData.calculatorType
    };
  }

  /**
   * Calculate US mortgage
   */
  static calculateUSMortgage(formData: USFormData): MortgageSavedCalculation {
    const calculation = usMortgageService.calculateMortgage(
      formData.homePrice,
      formData.downPayment,
      formData.interestRate / 100,
      formData.termYears,
      formData.state,
      formData.loanType
    );
    
    return {
      id: Date.now().toString(),
      date: new Date(),
      region: 'US',
      propertyPrice: formData.homePrice,
      loanAmount: formData.homePrice - formData.downPayment,
      interestRate: formData.interestRate,
      termYears: formData.termYears,
      monthlyPayment: calculation.monthlyPayment,
      totalInterest: calculation.totalInterest,
      usState: formData.state,
      loanType: formData.loanType
    };
  }

  /**
   * Load saved calculations from localStorage
   */
  static loadCalculations(): MortgageSavedCalculation[] {
    try {
      const saved = localStorage.getItem('mortgageCalculations');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((calc: MortgageSavedCalculation) => ({
          ...calc,
          date: new Date(calc.date)
        }));
      }
    } catch (error) {
      logger.error('Error loading calculations from localStorage:', error);
    }
    return [];
  }

  /**
   * Save calculations to localStorage
   */
  static saveCalculations(calculations: MortgageSavedCalculation[]): void {
    try {
      localStorage.setItem('mortgageCalculations', JSON.stringify(calculations));
    } catch (error) {
      logger.error('Error saving calculations to localStorage:', error);
    }
  }

  /**
   * Load calculations from Supabase
   */
  static async loadSupabaseCalculations(userId: string): Promise<import('../types/financial-plans').SavedCalculation[]> {
    try {
      return await financialPlanningService.getSavedCalculations(userId, 'mortgage');
    } catch (error) {
      logger.error('Error loading calculations from Supabase:', error);
      return [];
    }
  }

  /**
   * Delete a calculation
   */
  static deleteCalculation(calculations: MortgageSavedCalculation[], id: string): MortgageSavedCalculation[] {
    return calculations.filter(c => c.id !== id);
  }

  /**
   * Compare mortgage types (UK)
   */
  static compareUKMortgageTypes(loanAmount: number, termYears: number) {
    return ukMortgageService.compareMortgageTypes(loanAmount, termYears);
  }

  /**
   * Compare loan types (US)
   */
  static compareUSLoanTypes(homePrice: number, loanAmount: number) {
    return usMortgageService.compareLoanTypes(homePrice, loanAmount);
  }

  /**
   * Update form data with real financial data
   */
  static updateFormWithRealData(
    formData: UKFormData,
    annualIncome: number,
    monthlyExpenses: number,
    monthlyDebtPayments: number
  ): UKFormData {
    return {
      ...formData,
      annualIncome: Math.round(annualIncome),
      monthlyExpenses: Math.round(monthlyExpenses),
      existingDebt: Math.round(monthlyDebtPayments)
    };
  }
}
