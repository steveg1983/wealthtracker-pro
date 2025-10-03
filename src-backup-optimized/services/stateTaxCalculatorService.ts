import { stateTaxService, type RetirementIncome, type StateTaxCalculation } from './stateTaxService';

export class StateTaxCalculatorService {
  /**
   * Get default retirement income
   */
  static getDefaultIncome(): RetirementIncome {
    return {
      wages: 0,
      socialSecurity: 30000,
      pension: 20000,
      ira401k: 40000,
      rothDistributions: 10000,
      capitalGains: 5000,
      other: 0
    };
  }

  /**
   * Calculate total income from all sources
   */
  static calculateTotalIncome(income: RetirementIncome): number {
    return Object.values(income).reduce((sum, val) => sum + (val || 0), 0);
  }

  /**
   * Format state name for display
   */
  static formatStateName(stateCode: string): string {
    const stateNames: Record<string, string> = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
      'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
      'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
      'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
      'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
      'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
      'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
      'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
      'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
      'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
      'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    return stateNames[stateCode] || stateCode;
  }

  /**
   * Get state tax rate color based on percentage
   */
  static getTaxRateColor(rate: number): string {
    if (rate === 0) return 'text-green-600';
    if (rate < 3) return 'text-green-500';
    if (rate < 5) return 'text-yellow-500';
    if (rate < 7) return 'text-orange-500';
    return 'text-red-500';
  }

  /**
   * Get effective tax rate from calculation
   */
  static getEffectiveTaxRate(calculation: StateTaxCalculation | null): number {
    if (!calculation || !calculation.totalTax || calculation.taxableIncome === 0) return 0;
    return (calculation.totalTax / calculation.taxableIncome) * 100;
  }

  /**
   * Format comparison data for display
   */
  static formatComparisonData(
    results: StateTaxCalculation[],
    formatCurrency: (amount: any) => string
  ) {
    return results.map(result => ({
      state: this.formatStateName(result.state),
      stateCode: result.state,
      totalTax: result.totalTax,
      formattedTax: formatCurrency(result.totalTax),
      effectiveRate: this.getEffectiveTaxRate(result),
      taxableIncome: result.taxableIncome,
      formattedTaxableIncome: formatCurrency(result.taxableIncome),
      breakdown: result.breakdown
    }));
  }

  /**
   * Get income field labels
   */
  static getIncomeFieldLabels(): Record<keyof RetirementIncome, string> {
    return {
      wages: 'Wages/Salary',
      socialSecurity: 'Social Security',
      pension: 'Pension',
      ira401k: 'IRA/401(k) Distributions',
      rothDistributions: 'Roth Distributions',
      capitalGains: 'Capital Gains',
      other: 'Other Income'
    };
  }

  /**
   * Get income field descriptions
   */
  static getIncomeFieldDescriptions(): Record<keyof RetirementIncome, string> {
    return {
      wages: 'Part-time work or consulting income',
      socialSecurity: 'Annual Social Security benefits',
      pension: 'Company or government pension',
      ira401k: 'Traditional IRA or 401(k) withdrawals',
      rothDistributions: 'Tax-free Roth withdrawals',
      capitalGains: 'Investment gains from taxable accounts',
      other: 'Rental income, dividends, etc.'
    };
  }

  /**
   * Validate income values
   */
  static validateIncome(income: RetirementIncome): string[] {
    const errors: string[] = [];
    
    Object.entries(income).forEach(([field, value]) => {
      if (value < 0) {
        errors.push(`${this.getIncomeFieldLabels()[field as keyof RetirementIncome]} cannot be negative`);
      }
    });
    
    const total = this.calculateTotalIncome(income);
    if (total === 0) {
      errors.push('Please enter at least one income source');
    }
    
    return errors;
  }

  /**
   * Get tax breakdown categories
   */
  static getTaxBreakdownCategories(breakdown: any) {
    const categories = [];
    
    if (breakdown.socialSecurityTaxable > 0) {
      categories.push({
        label: 'Social Security (Taxable)',
        amount: breakdown.socialSecurityTaxable,
        type: 'income'
      });
    }
    
    if (breakdown.pensionTaxable > 0) {
      categories.push({
        label: 'Pension (Taxable)',
        amount: breakdown.pensionTaxable,
        type: 'income'
      });
    }
    
    if (breakdown.retirementTaxable > 0) {
      categories.push({
        label: 'IRA/401(k) (Taxable)',
        amount: breakdown.retirementTaxable,
        type: 'income'
      });
    }
    
    if (breakdown.standardDeduction > 0) {
      categories.push({
        label: 'Standard Deduction',
        amount: -breakdown.standardDeduction,
        type: 'deduction'
      });
    }
    
    if (breakdown.seniorExemption > 0) {
      categories.push({
        label: 'Senior Exemption',
        amount: -breakdown.seniorExemption,
        type: 'deduction'
      });
    }
    
    return categories;
  }
}