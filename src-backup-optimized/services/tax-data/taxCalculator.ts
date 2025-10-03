import type { 
  TaxBracket, 
  StandardDeduction, 
  TaxCalculationResult, 
  TaxBreakdown,
  USFilingStatus 
} from './types';
import { US_FINANCIAL_CONSTANTS } from '../../constants/financial/us';
import { UK_FINANCIAL_CONSTANTS } from '../../constants/financial/uk';

/**
 * Tax calculation engine
 * Performs accurate tax calculations for US and UK
 */
export class TaxCalculator {
  /**
   * Calculate US federal income tax
   */
  calculateUSFederalTax(
    income: number,
    filingStatus: USFilingStatus = 'single',
    year: number = 2024
  ): TaxCalculationResult {
    const constants = US_FINANCIAL_CONSTANTS as any;
    const standardDeduction = constants.STANDARD_DEDUCTION?.[filingStatus.toUpperCase()] || constants.standardDeduction?.[filingStatus] || 0;
    const taxableIncome = Math.max(0, income - standardDeduction);
    
    let tax = 0;
    const breakdown: TaxBreakdown[] = [];
    const brackets = this.getUSBracketsForStatus(filingStatus);
    
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      const bracketMin = bracket.min;
      const bracketMax = bracket.max || Infinity;
      const rate = bracket.rate;
      
      if (taxableIncome > bracketMin) {
        const taxableInBracket = Math.min(taxableIncome - bracketMin, bracketMax - bracketMin);
        const bracketTax = taxableInBracket * rate;
        tax += bracketTax;
        
        breakdown.push({
          bracket: `${(rate * 100).toFixed(0)}%`,
          income: taxableInBracket,
          rate: rate,
          tax: bracketTax
        });
        
        if (taxableIncome <= bracketMax) break;
      }
    }
    
    // Calculate Social Security and Medicare
    const socialSecurity = Math.min(income, constants.SOCIAL_SECURITY_WAGE_BASE) * constants.SOCIAL_SECURITY_TAX_RATE;
    const medicare = income * constants.MEDICARE_TAX_RATE;
    const additionalMedicare = income > constants.ADDITIONAL_MEDICARE_THRESHOLD[filingStatus.toUpperCase()] 
      ? (income - constants.ADDITIONAL_MEDICARE_THRESHOLD[filingStatus.toUpperCase()]) * constants.ADDITIONAL_MEDICARE_TAX_RATE
      : 0;
    
    const totalTax = tax + socialSecurity + medicare + additionalMedicare;
    const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
    const marginalRate = this.getMarginalRate(taxableIncome, brackets) * 100;
    
    return {
      taxableIncome,
      federalTax: tax,
      socialSecurity,
      medicare: medicare + additionalMedicare,
      totalTax,
      effectiveRate,
      marginalRate,
      breakdown
    };
  }

  /**
   * Calculate UK income tax and National Insurance
   */
  calculateUKTax(
    income: number,
    taxYear: string = '2024/25'
  ): TaxCalculationResult {
    const constants = UK_FINANCIAL_CONSTANTS as any;
    
    // Adjust personal allowance for high earners
    let personalAllowance = constants.PERSONAL_ALLOWANCE;
    if (income > 100000) {
      const reduction = Math.min((income - 100000) / 2, personalAllowance);
      personalAllowance = Math.max(0, personalAllowance - reduction);
    }
    
    const taxableIncome = Math.max(0, income - personalAllowance);
    let tax = 0;
    const breakdown: TaxBreakdown[] = [];
    
    // Basic rate
    if (taxableIncome > 0) {
      const basicRateIncome = Math.min(taxableIncome, constants.BASIC_RATE_LIMIT);
      const basicTax = basicRateIncome * constants.BASIC_RATE;
      tax += basicTax;
      breakdown.push({
        bracket: 'Basic Rate (20%)',
        income: basicRateIncome,
        rate: constants.BASIC_RATE,
        tax: basicTax
      });
    }
    
    // Higher rate
    if (taxableIncome > constants.BASIC_RATE_LIMIT) {
      const higherRateIncome = Math.min(
        taxableIncome - constants.BASIC_RATE_LIMIT,
        constants.HIGHER_RATE_LIMIT - constants.BASIC_RATE_LIMIT
      );
      const higherTax = higherRateIncome * constants.HIGHER_RATE;
      tax += higherTax;
      breakdown.push({
        bracket: 'Higher Rate (40%)',
        income: higherRateIncome,
        rate: constants.HIGHER_RATE,
        tax: higherTax
      });
    }
    
    // Additional rate
    if (income > constants.HIGHER_RATE_LIMIT) {
      const additionalRateIncome = income - constants.HIGHER_RATE_LIMIT;
      const additionalTax = additionalRateIncome * constants.ADDITIONAL_RATE;
      tax += additionalTax;
      breakdown.push({
        bracket: 'Additional Rate (45%)',
        income: additionalRateIncome,
        rate: constants.ADDITIONAL_RATE,
        tax: additionalTax
      });
    }
    
    // National Insurance
    const nationalInsurance = this.calculateNationalInsurance(income);
    
    const totalTax = tax + nationalInsurance;
    const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
    const marginalRate = this.getUKMarginalRate(income) * 100;
    
    return {
      taxableIncome,
      federalTax: tax,
      nationalInsurance,
      totalTax,
      effectiveRate,
      marginalRate,
      breakdown
    };
  }

  /**
   * Calculate UK National Insurance
   */
  private calculateNationalInsurance(income: number): number {
    const constants = UK_FINANCIAL_CONSTANTS as any;
    let ni = 0;
    
    // Primary threshold to Upper Earnings Limit at 8%
    if (income > constants.NI_PRIMARY_THRESHOLD) {
      const niableAtMainRate = Math.min(
        income - constants.NI_PRIMARY_THRESHOLD,
        constants.NI_UPPER_EARNINGS_LIMIT - constants.NI_PRIMARY_THRESHOLD
      );
      ni += niableAtMainRate * constants.NI_RATE_MAIN;
    }
    
    // Above Upper Earnings Limit at 2%
    if (income > constants.NI_UPPER_EARNINGS_LIMIT) {
      const niableAtAdditionalRate = income - constants.NI_UPPER_EARNINGS_LIMIT;
      ni += niableAtAdditionalRate * constants.NI_RATE_ADDITIONAL;
    }
    
    return ni;
  }

  /**
   * Get US tax brackets for filing status
   */
  private getUSBracketsForStatus(status: USFilingStatus): TaxBracket[] {
    const constants = US_FINANCIAL_CONSTANTS;
    const filingStatusKey = status === 'single' ? 'single' :
                           status === 'married' ? 'marriedFilingJointly' :
                           status === 'separate' ? 'marriedFilingSeparately' :
                           'headOfHousehold';
    const brackets = constants.federalTaxBrackets[filingStatusKey as keyof typeof constants.federalTaxBrackets];
    
    return brackets.map((b: any) => ({
      min: b.min,
      max: b.max,
      rate: b.rate
    }));
  }

  /**
   * Get marginal tax rate
   */
  private getMarginalRate(taxableIncome: number, brackets: TaxBracket[]): number {
    for (const bracket of brackets) {
      if (taxableIncome >= bracket.min && taxableIncome <= (bracket.max || Infinity)) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1].rate;
  }

  /**
   * Get UK marginal rate including NI
   */
  private getUKMarginalRate(income: number): number {
    const constants = UK_FINANCIAL_CONSTANTS as any;
    
    // Personal allowance taper creates 60% effective rate
    if (income > 100000 && income <= 125140) {
      return 0.60;
    }
    
    // Additional rate
    if (income > constants.HIGHER_RATE_LIMIT) {
      return constants.ADDITIONAL_RATE + constants.NI_RATE_ADDITIONAL;
    }
    
    // Higher rate
    if (income > constants.BASIC_RATE_LIMIT + constants.PERSONAL_ALLOWANCE) {
      if (income <= constants.NI_UPPER_EARNINGS_LIMIT) {
        return constants.HIGHER_RATE + constants.NI_RATE_MAIN;
      } else {
        return constants.HIGHER_RATE + constants.NI_RATE_ADDITIONAL;
      }
    }
    
    // Basic rate
    if (income > constants.PERSONAL_ALLOWANCE) {
      return constants.BASIC_RATE + constants.NI_RATE_MAIN;
    }
    
    return 0;
  }
}

export const taxCalculator = new TaxCalculator();