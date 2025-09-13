/**
 * Tax Calculator Module
 * Handles tax calculations and bracket determination
 */

import type { TaxBracket, TaxConfiguration } from './types';
import type { DecimalInstance } from '../../types/decimal-types';
import { toDecimal } from '../../utils/decimal';

/**
 * 2024 Tax configuration for single filer
 */
export const TAX_CONFIG_2024: TaxConfiguration = {
  year: 2024,
  standardDeduction: toDecimal(13850),
  brackets: [
    { min: 0, max: 11000, rate: 0.10 },
    { min: 11000, max: 44725, rate: 0.12 },
    { min: 44725, max: 95375, rate: 0.22 },
    { min: 95375, max: 182050, rate: 0.24 },
    { min: 182050, max: 231250, rate: 0.32 },
    { min: 231250, max: 578125, rate: 0.35 },
    { min: 578125, max: Infinity, rate: 0.37 }
  ],
  limits: {
    retirement401k: toDecimal(23000),
    retirementIRA: toDecimal(7000),
    hsaIndividual: toDecimal(3850),
    hsaFamily: toDecimal(7750),
    saltDeduction: toDecimal(10000)
  },
  rates: {
    longTermCapitalGains: 0.15,
    shortTermCapitalGains: 0.24,
    socialSecurity: 0.062,
    medicare: 0.0145
  }
};

/**
 * Tax calculator service
 */
export class TaxCalculator {
  private config: TaxConfiguration;

  constructor(config: TaxConfiguration = TAX_CONFIG_2024) {
    this.config = config;
  }

  /**
   * Calculate federal income tax
   */
  calculateFederalTax(taxableIncome: DecimalInstance): DecimalInstance {
    let tax = toDecimal(0);
    const income = taxableIncome.toNumber();
    
    for (const bracket of this.config.brackets) {
      if (income > bracket.min) {
        const taxableInBracket = Math.min(income - bracket.min, bracket.max - bracket.min);
        tax = tax.plus(toDecimal(taxableInBracket * bracket.rate));
      }
    }
    
    return tax;
  }

  /**
   * Get marginal tax rate
   */
  getMarginalTaxRate(taxableIncome: DecimalInstance): number {
    const income = taxableIncome.toNumber();
    
    for (let i = this.config.brackets.length - 1; i >= 0; i--) {
      const bracket = this.config.brackets[i];
      if (income > bracket.min) {
        return bracket.rate * 100;
      }
    }
    
    return 0;
  }

  /**
   * Calculate effective tax rate
   */
  calculateEffectiveRate(
    totalIncome: DecimalInstance, 
    taxAmount: DecimalInstance
  ): number {
    if (totalIncome.equals(0)) return 0;
    return taxAmount.dividedBy(totalIncome).times(100).toNumber();
  }

  /**
   * Calculate quarterly estimated payments
   */
  calculateQuarterlyPayments(annualTax: DecimalInstance): DecimalInstance[] {
    const quarterlyAmount = annualTax.dividedBy(4);
    return [
      quarterlyAmount,
      quarterlyAmount,
      quarterlyAmount,
      quarterlyAmount
    ];
  }

  /**
   * Calculate FICA taxes (Social Security and Medicare)
   */
  calculateFICATax(income: DecimalInstance): {
    socialSecurity: DecimalInstance;
    medicare: DecimalInstance;
    total: DecimalInstance;
  } {
    // Social Security wage base limit for 2024: $168,600
    const ssWageBase = toDecimal(168600);
    const taxableForSS = income.greaterThan(ssWageBase) ? ssWageBase : income;
    
    const socialSecurity = taxableForSS.times(this.config.rates.socialSecurity);
    const medicare = income.times(this.config.rates.medicare);
    
    // Additional Medicare tax (0.9%) on income over $200,000
    let additionalMedicare = toDecimal(0);
    if (income.greaterThan(200000)) {
      additionalMedicare = income.minus(200000).times(0.009);
    }
    
    const totalMedicare = medicare.plus(additionalMedicare);
    
    return {
      socialSecurity,
      medicare: totalMedicare,
      total: socialSecurity.plus(totalMedicare)
    };
  }

  /**
   * Calculate capital gains tax
   */
  calculateCapitalGainsTax(
    gain: DecimalInstance,
    isLongTerm: boolean
  ): DecimalInstance {
    if (gain.lessThanOrEqualTo(0)) return toDecimal(0);
    
    const rate = isLongTerm 
      ? this.config.rates.longTermCapitalGains 
      : this.config.rates.shortTermCapitalGains;
    
    return gain.times(rate);
  }

  /**
   * Calculate Alternative Minimum Tax (simplified)
   */
  calculateAMT(
    taxableIncome: DecimalInstance,
    regularTax: DecimalInstance
  ): DecimalInstance {
    // Simplified AMT calculation
    // 2024 AMT exemption for single: $85,700
    const amtExemption = toDecimal(85700);
    const amtIncome = taxableIncome.greaterThan(amtExemption)
      ? taxableIncome.minus(amtExemption)
      : toDecimal(0);
    
    // AMT rates: 26% up to $220,700, 28% above
    let amtTax = toDecimal(0);
    if (amtIncome.greaterThan(0)) {
      if (amtIncome.lessThanOrEqualTo(220700)) {
        amtTax = amtIncome.times(0.26);
      } else {
        amtTax = toDecimal(220700).times(0.26)
          .plus(amtIncome.minus(220700).times(0.28));
      }
    }
    
    // Return the difference if AMT is higher
    return amtTax.greaterThan(regularTax)
      ? amtTax.minus(regularTax)
      : toDecimal(0);
  }

  /**
   * Get tax configuration
   */
  getConfig(): TaxConfiguration {
    return this.config;
  }

  /**
   * Update tax configuration
   */
  updateConfig(config: Partial<TaxConfiguration>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate tax on different filing statuses
   */
  calculateWithFilingStatus(
    taxableIncome: DecimalInstance,
    filingStatus: 'single' | 'married-jointly' | 'married-separately' | 'head-of-household'
  ): DecimalInstance {
    // Adjust brackets based on filing status
    // This is simplified - in reality, each status has different brackets
    let multiplier = 1;
    
    switch (filingStatus) {
      case 'married-jointly':
        multiplier = 2; // Double the brackets
        break;
      case 'married-separately':
        multiplier = 0.5; // Half of married-jointly
        break;
      case 'head-of-household':
        multiplier = 1.5; // Between single and married-jointly
        break;
    }
    
    // Adjust income for calculation
    const adjustedIncome = taxableIncome.dividedBy(multiplier);
    const tax = this.calculateFederalTax(adjustedIncome);
    
    // Scale tax back if needed
    return filingStatus === 'married-separately' 
      ? tax.times(2)
      : tax;
  }
}

export const taxCalculator = new TaxCalculator();