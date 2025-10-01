import Decimal from 'decimal.js';
import stateTaxData from '../data/tax/us-state-taxes-2025.json';

export interface StateTaxBracket {
  min: number;
  max: number;
  rate: number;
  deduction?: number;
}

export interface StateTaxInfo {
  name: string;
  incomeTax: {
    type: 'none' | 'flat' | 'progressive';
    rate?: number;
    brackets?: StateTaxBracket[];
  };
  socialSecurityTaxed: boolean;
  socialSecurityExemption?: number;
  pensionExclusion?: number;
  retirementIncomeExclusion?: number;
  seniorDeduction?: number;
  seniorExemptionAge?: number;
  capitalGainsTax?: {
    rate: number;
    exclusion?: number;
  };
  notes?: string;
}

export interface RetirementIncome {
  wages?: number;
  socialSecurity?: number;
  pension?: number;
  ira401k?: number;
  rothDistributions?: number;
  capitalGains?: number;
  other?: number;
}

export interface StateTaxCalculation {
  state: string;
  stateName: string;
  totalIncome: number;
  taxableIncome: number;
  stateTax: number;
  effectiveRate: number;
  marginalRate: number;
  breakdown: {
    income: string;
    deductions: string;
    taxableAmount: string;
    tax: string;
    rate: string;
  }[];
}

class StateTaxService {
  private stateTaxData: Record<string, StateTaxInfo>;

  constructor() {
    // Access the states property from the imported JSON data
    const data = stateTaxData as { states: unknown };
    this.stateTaxData = data.states as Record<string, StateTaxInfo>;
  }

  /**
   * Calculate state tax for retirement income
   */
  calculateStateTax(
    stateCode: string,
    income: RetirementIncome,
    filingStatus: 'single' | 'married' | 'head_of_household' = 'single',
    age: number = 65
  ): StateTaxCalculation {
    const stateInfo = this.stateTaxData[stateCode];
    if (!stateInfo) {
      throw new Error(`Invalid state code: ${stateCode}`);
    }

    const breakdown: StateTaxCalculation['breakdown'] = [];
    let totalIncome = 0;
    let taxableIncome = 0;

    // Calculate total income
    const incomeComponents = {
      wages: income.wages || 0,
      socialSecurity: income.socialSecurity || 0,
      pension: income.pension || 0,
      ira401k: income.ira401k || 0,
      rothDistributions: income.rothDistributions || 0,
      capitalGains: income.capitalGains || 0,
      other: income.other || 0
    };

    Object.entries(incomeComponents).forEach(([type, amount]) => {
      if (amount > 0) {
        totalIncome += amount;
      }
    });

    // Calculate taxable income based on state rules
    taxableIncome = this.calculateTaxableIncome(
      stateInfo,
      incomeComponents,
      filingStatus,
      age,
      breakdown
    );

    // Calculate tax based on state tax structure
    const stateTax = this.calculateTax(stateInfo, taxableIncome, filingStatus, breakdown);
    
    const effectiveRate = totalIncome > 0 ? (stateTax / totalIncome) * 100 : 0;
    const marginalRate = this.getMarginalRate(stateInfo, taxableIncome, filingStatus);

    return {
      state: stateCode,
      stateName: stateInfo.name,
      totalIncome,
      taxableIncome,
      stateTax,
      effectiveRate,
      marginalRate,
      breakdown
    };
  }

  /**
   * Calculate taxable income after state-specific exclusions
   */
  private calculateTaxableIncome(
    stateInfo: StateTaxInfo,
    income: Record<string, number>,
    filingStatus: string,
    age: number,
    breakdown: StateTaxCalculation['breakdown']
  ): number {
    let taxableIncome = 0;
    const dec = (n: number) => new Decimal(n);

    // Wages are always taxable
    if (income.wages && income.wages > 0) {
      taxableIncome = dec(taxableIncome).plus(income.wages).toNumber();
      breakdown.push({
        income: 'Wages',
        deductions: '$0',
        taxableAmount: `$${income.wages.toLocaleString()}`,
        tax: '',
        rate: ''
      });
    }

    // Social Security taxation
    if (income.socialSecurity && income.socialSecurity > 0) {
      if (stateInfo.socialSecurityTaxed) {
        let taxableSS = income.socialSecurity;
        if (stateInfo.socialSecurityExemption) {
          taxableSS = Math.max(0, income.socialSecurity - stateInfo.socialSecurityExemption);
        }
        taxableIncome = dec(taxableIncome).plus(taxableSS).toNumber();
        breakdown.push({
          income: 'Social Security',
          deductions: stateInfo.socialSecurityExemption 
            ? `$${stateInfo.socialSecurityExemption.toLocaleString()}` 
            : '$0',
          taxableAmount: `$${taxableSS.toLocaleString()}`,
          tax: '',
          rate: ''
        });
      } else {
        breakdown.push({
          income: 'Social Security',
          deductions: 'Exempt',
          taxableAmount: '$0',
          tax: '',
          rate: ''
        });
      }
    }

    // Pension income
    if (income.pension && income.pension > 0) {
      let taxablePension = income.pension;
      if (stateInfo.pensionExclusion && stateInfo.pensionExclusion > 0) {
        taxablePension = Math.max(0, income.pension - stateInfo.pensionExclusion);
      }
      taxableIncome = dec(taxableIncome).plus(taxablePension).toNumber();
      breakdown.push({
        income: 'Pension',
        deductions: stateInfo.pensionExclusion 
          ? `$${stateInfo.pensionExclusion.toLocaleString()}` 
          : '$0',
        taxableAmount: `$${taxablePension.toLocaleString()}`,
        tax: '',
        rate: ''
      });
    }

    // IRA/401(k) distributions
    if (income.ira401k && income.ira401k > 0) {
      let taxableRetirement = income.ira401k;
      if (stateInfo.retirementIncomeExclusion && age >= (stateInfo.seniorExemptionAge || 65)) {
        taxableRetirement = Math.max(0, income.ira401k - stateInfo.retirementIncomeExclusion);
      }
      taxableIncome = dec(taxableIncome).plus(taxableRetirement).toNumber();
      breakdown.push({
        income: 'IRA/401(k)',
        deductions: stateInfo.retirementIncomeExclusion && age >= (stateInfo.seniorExemptionAge || 65)
          ? `$${stateInfo.retirementIncomeExclusion.toLocaleString()}`
          : '$0',
        taxableAmount: `$${taxableRetirement.toLocaleString()}`,
        tax: '',
        rate: ''
      });
    }

    // Roth distributions (typically not taxed at state level)
    if (income.rothDistributions && income.rothDistributions > 0) {
      breakdown.push({
        income: 'Roth Distributions',
        deductions: 'Exempt',
        taxableAmount: '$0',
        tax: '',
        rate: ''
      });
    }

    // Capital gains
    if (income.capitalGains && income.capitalGains > 0) {
      let taxableGains = income.capitalGains;
      if (stateInfo.capitalGainsTax?.exclusion) {
        taxableGains = Math.max(0, income.capitalGains - stateInfo.capitalGainsTax.exclusion);
      }
      taxableIncome = dec(taxableIncome).plus(taxableGains).toNumber();
      breakdown.push({
        income: 'Capital Gains',
        deductions: stateInfo.capitalGainsTax?.exclusion 
          ? `$${stateInfo.capitalGainsTax.exclusion.toLocaleString()}`
          : '$0',
        taxableAmount: `$${taxableGains.toLocaleString()}`,
        tax: '',
        rate: ''
      });
    }

    // Other income
    if (income.other && income.other > 0) {
      taxableIncome = dec(taxableIncome).plus(income.other).toNumber();
      breakdown.push({
        income: 'Other Income',
        deductions: '$0',
        taxableAmount: `$${income.other.toLocaleString()}`,
        tax: '',
        rate: ''
      });
    }

    // Apply senior deduction if applicable
    if (stateInfo.seniorDeduction && age >= (stateInfo.seniorExemptionAge || 65)) {
      const deduction = stateInfo.seniorDeduction;
      taxableIncome = Math.max(0, taxableIncome - deduction);
      breakdown.push({
        income: 'Senior Deduction',
        deductions: `$${deduction.toLocaleString()}`,
        taxableAmount: `($${deduction.toLocaleString()})`,
        tax: '',
        rate: ''
      });
    }

    return taxableIncome;
  }

  /**
   * Calculate tax based on state's tax structure
   */
  private calculateTax(
    stateInfo: StateTaxInfo,
    taxableIncome: number,
    filingStatus: string,
    breakdown: StateTaxCalculation['breakdown']
  ): number {
    if (stateInfo.incomeTax.type === 'none' || taxableIncome <= 0) {
      return 0;
    }

    const dec = (n: number) => new Decimal(n);
    let tax = dec(0);

    if (stateInfo.incomeTax.type === 'flat' && stateInfo.incomeTax.rate) {
      tax = dec(taxableIncome).times(stateInfo.incomeTax.rate);
      breakdown.push({
        income: 'State Income Tax',
        deductions: '',
        taxableAmount: `$${taxableIncome.toLocaleString()}`,
        tax: `$${tax.toFixed(2)}`,
        rate: `${(stateInfo.incomeTax.rate * 100).toFixed(2)}%`
      });
    } else if (stateInfo.incomeTax.type === 'progressive' && stateInfo.incomeTax.brackets) {
      const brackets = this.getBracketsForFilingStatus(stateInfo.incomeTax.brackets, filingStatus);
      
      for (const bracket of brackets) {
        if (taxableIncome > bracket.min) {
          const taxableInBracket = Math.min(taxableIncome - bracket.min, bracket.max - bracket.min);
          const bracketTax = dec(taxableInBracket).times(bracket.rate);
          tax = tax.plus(bracketTax);
          
          if (taxableInBracket > 0) {
            breakdown.push({
              income: `Tax on $${bracket.min.toLocaleString()}-$${Math.min(taxableIncome, bracket.max).toLocaleString()}`,
              deductions: '',
              taxableAmount: `$${taxableInBracket.toLocaleString()}`,
              tax: `$${bracketTax.toFixed(2)}`,
              rate: `${(bracket.rate * 100).toFixed(2)}%`
            });
          }
        }
      }
    }

    return tax.toNumber();
  }

  /**
   * Get marginal tax rate for given income
   */
  private getMarginalRate(
    stateInfo: StateTaxInfo,
    taxableIncome: number,
    filingStatus: string
  ): number {
    if (stateInfo.incomeTax.type === 'none') {
      return 0;
    }

    if (stateInfo.incomeTax.type === 'flat' && stateInfo.incomeTax.rate) {
      return stateInfo.incomeTax.rate * 100;
    }

    if (stateInfo.incomeTax.type === 'progressive' && stateInfo.incomeTax.brackets) {
      const brackets = this.getBracketsForFilingStatus(stateInfo.incomeTax.brackets, filingStatus);
      for (let i = brackets.length - 1; i >= 0; i--) {
        const bracket = brackets[i];
        if (bracket && taxableIncome > bracket.min) {
          return bracket.rate * 100;
        }
      }
    }

    return 0;
  }

  /**
   * Adjust brackets for filing status (simplified - would need more data for accuracy)
   */
  private getBracketsForFilingStatus(
    brackets: StateTaxBracket[],
    filingStatus: string
  ): StateTaxBracket[] {
    // For married filing jointly, typically double the brackets
    if (filingStatus === 'married') {
      return brackets.map(b => ({
        ...b,
        min: b.min * 2,
        max: b.max === Infinity ? Infinity : b.max * 2
      }));
    }
    return brackets;
  }

  /**
   * Get list of all states
   */
  getAllStates(): Array<{ code: string; name: string; hasTax: boolean }> {
    return Object.entries(this.stateTaxData).map(([code, info]) => ({
      code,
      name: info.name,
      hasTax: info.incomeTax.type !== 'none'
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Compare tax burden across multiple states
   */
  compareStates(
    states: string[],
    income: RetirementIncome,
    filingStatus: 'single' | 'married' | 'head_of_household' = 'single',
    age: number = 65
  ): StateTaxCalculation[] {
    return states.map(state => this.calculateStateTax(state, income, filingStatus, age))
      .sort((a, b) => a.stateTax - b.stateTax);
  }

  /**
   * Find most tax-friendly states for retirement
   */
  findBestStatesForRetirement(
    income: RetirementIncome,
    filingStatus: 'single' | 'married' | 'head_of_household' = 'single',
    age: number = 65,
    limit: number = 10
  ): StateTaxCalculation[] {
    const allStates = Object.keys(this.stateTaxData);
    const calculations = this.compareStates(allStates, income, filingStatus, age);
    return calculations.slice(0, limit);
  }
}

export const stateTaxService = new StateTaxService();