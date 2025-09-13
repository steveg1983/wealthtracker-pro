/**
 * Tax Optimizer Module
 * Suggests tax optimization strategies
 */

import type { Transaction, Account, Investment } from '../../types';
import type { TaxOptimization, TaxEstimate } from './types';
import type { DecimalInstance } from '../../types/decimal-types';
import { toDecimal } from '../../utils/decimal';
import { endOfYear, addMonths } from 'date-fns';
import { taxCalculator } from './taxCalculator';
import { capitalGainsTracker } from './capitalGainsTracker';

/**
 * Tax optimization service
 */
export class TaxOptimizer {
  /**
   * Generate comprehensive tax optimization suggestions
   */
  suggestOptimizations(
    transactions: Transaction[],
    accounts: Account[],
    investments: Investment[],
    currentEstimate: TaxEstimate
  ): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    const currentYear = new Date().getFullYear();
    
    // Add all optimization strategies
    optimizations.push(
      ...this.checkRetirementContributions(transactions, currentYear),
      ...this.checkHSAContributions(transactions, currentYear),
      ...this.checkCharitableGiving(transactions, currentYear),
      ...this.checkTaxLossHarvesting(investments),
      ...this.checkQuarterlyPayments(currentEstimate),
      ...this.checkEducationCredits(transactions, currentYear),
      ...this.checkBusinessDeductions(transactions, currentYear),
      ...this.checkTimingStrategies(currentYear)
    );
    
    // Sort by potential savings
    return optimizations.sort((a, b) => 
      b.potentialSavings.minus(a.potentialSavings).toNumber()
    );
  }

  /**
   * Check retirement contribution optimization
   */
  private checkRetirementContributions(
    transactions: Transaction[],
    year: number
  ): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    const config = taxCalculator.getConfig();
    
    // Calculate current contributions
    const contributions401k = this.calculate401kContributions(transactions, year);
    const contributionsIRA = this.calculateIRAContributions(transactions, year);
    
    // 401(k) optimization
    if (contributions401k.lessThan(config.limits.retirement401k)) {
      const remaining = config.limits.retirement401k.minus(contributions401k);
      const taxSavings = remaining.times(0.24); // Assume 24% bracket
      
      optimizations.push({
        id: 'opt-401k',
        title: 'Maximize 401(k) Contributions',
        description: `Increase 401(k) contributions by $${remaining.toFixed(2)} to reduce taxable income`,
        potentialSavings: taxSavings,
        deadline: endOfYear(new Date(year, 11, 31)),
        actionRequired: 'Contact HR to increase contribution percentage',
        category: 'retirement'
      });
    }
    
    // IRA optimization
    if (contributionsIRA.lessThan(config.limits.retirementIRA)) {
      const remaining = config.limits.retirementIRA.minus(contributionsIRA);
      const taxSavings = remaining.times(0.24);
      
      optimizations.push({
        id: 'opt-ira',
        title: 'Maximize IRA Contributions',
        description: `Contribute $${remaining.toFixed(2)} more to traditional IRA`,
        potentialSavings: taxSavings,
        deadline: new Date(year + 1, 3, 15), // Tax filing deadline
        actionRequired: 'Make additional IRA contribution',
        category: 'retirement'
      });
    }
    
    // Catch-up contributions for 50+
    const age = 50; // Would need actual age from user profile
    if (age >= 50) {
      const catchUp401k = toDecimal(7500); // 2024 catch-up limit
      const catchUpIRA = toDecimal(1000);
      
      optimizations.push({
        id: 'opt-catchup',
        title: 'Utilize Catch-Up Contributions',
        description: 'Additional contribution limits available for age 50+',
        potentialSavings: catchUp401k.plus(catchUpIRA).times(0.24),
        deadline: endOfYear(new Date(year, 11, 31)),
        actionRequired: 'Make catch-up contributions',
        category: 'retirement'
      });
    }
    
    return optimizations;
  }

  /**
   * Check HSA contribution optimization
   */
  private checkHSAContributions(
    transactions: Transaction[],
    year: number
  ): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    const config = taxCalculator.getConfig();
    
    const hsaContributions = this.calculateHSAContributions(transactions, year);
    const limit = config.limits.hsaIndividual; // Could be family limit
    
    if (hsaContributions.lessThan(limit)) {
      const remaining = limit.minus(hsaContributions);
      const taxSavings = remaining.times(0.24);
      
      optimizations.push({
        id: 'opt-hsa',
        title: 'Max Out HSA Contributions',
        description: `Triple tax advantage: Deductible, tax-free growth, tax-free medical withdrawals`,
        potentialSavings: taxSavings,
        deadline: new Date(year + 1, 3, 15),
        actionRequired: `Contribute additional $${remaining.toFixed(2)} to HSA`,
        category: 'other'
      });
    }
    
    return optimizations;
  }

  /**
   * Check charitable giving strategies
   */
  private checkCharitableGiving(
    transactions: Transaction[],
    year: number
  ): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    
    const charitableAmount = this.calculateCharitableDeductions(transactions, year);
    const standardDeduction = toDecimal(13850); // 2024 single filer
    
    // Bunching strategy
    if (charitableAmount.greaterThan(0) && charitableAmount.lessThan(standardDeduction.dividedBy(2))) {
      optimizations.push({
        id: 'opt-bunching',
        title: 'Bundle Charitable Donations',
        description: 'Combine 2 years of donations to exceed standard deduction',
        potentialSavings: charitableAmount.times(0.24),
        deadline: endOfYear(new Date(year, 11, 31)),
        actionRequired: 'Make next year\'s planned donations before year-end',
        category: 'charitable'
      });
    }
    
    // Donor-advised fund
    if (charitableAmount.greaterThan(5000)) {
      optimizations.push({
        id: 'opt-daf',
        title: 'Consider Donor-Advised Fund',
        description: 'Get immediate deduction, distribute to charities over time',
        potentialSavings: toDecimal(1000), // Estimated benefit
        actionRequired: 'Research and open donor-advised fund',
        category: 'charitable'
      });
    }
    
    // Appreciated stock donation
    optimizations.push({
      id: 'opt-stock-donation',
      title: 'Donate Appreciated Stock',
      description: 'Avoid capital gains tax while getting full deduction',
      potentialSavings: toDecimal(500), // Estimated
      actionRequired: 'Transfer appreciated securities directly to charity',
      category: 'charitable'
    });
    
    return optimizations;
  }

  /**
   * Check tax-loss harvesting opportunities
   */
  private checkTaxLossHarvesting(investments: Investment[]): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    
    const opportunities = capitalGainsTracker.identifyHarvestingOpportunities(investments);
    
    if (opportunities.length > 0) {
      const totalLosses = opportunities.reduce(
        (sum, o) => sum.plus(o.loss),
        toDecimal(0)
      );
      
      // Can offset capital gains plus up to $3,000 of ordinary income
      const taxBenefit = totalLosses.times(0.15).plus(
        totalLosses.greaterThan(3000) ? toDecimal(3000).times(0.24) : totalLosses.times(0.24)
      );
      
      optimizations.push({
        id: 'opt-harvest',
        title: 'Tax-Loss Harvesting Opportunity',
        description: `Harvest losses to offset gains and reduce taxes`,
        potentialSavings: taxBenefit,
        deadline: endOfYear(new Date()),
        actionRequired: `Review and sell ${opportunities.length} losing positions`,
        category: 'investment'
      });
    }
    
    return optimizations;
  }

  /**
   * Check quarterly payment optimization
   */
  private checkQuarterlyPayments(estimate: TaxEstimate): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    
    if (estimate.estimatedTax.greaterThan(1000)) {
      const quarterlyAmount = estimate.estimatedTax.dividedBy(4);
      
      optimizations.push({
        id: 'opt-quarterly',
        title: 'Make Quarterly Estimated Payments',
        description: 'Avoid underpayment penalties by making quarterly payments',
        potentialSavings: toDecimal(100), // Penalty avoidance
        deadline: addMonths(new Date(), 3),
        actionRequired: `Pay $${quarterlyAmount.toFixed(2)} quarterly`,
        category: 'other'
      });
    }
    
    return optimizations;
  }

  /**
   * Check education credit opportunities
   */
  private checkEducationCredits(
    transactions: Transaction[],
    year: number
  ): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    
    const educationExpenses = this.calculateEducationExpenses(transactions, year);
    
    if (educationExpenses.greaterThan(0)) {
      // American Opportunity Credit (up to $2,500)
      const aocCredit = educationExpenses.greaterThan(4000)
        ? toDecimal(2500)
        : educationExpenses.times(0.625);
      
      optimizations.push({
        id: 'opt-education',
        title: 'Claim Education Credits',
        description: 'American Opportunity or Lifetime Learning Credit available',
        potentialSavings: aocCredit,
        actionRequired: 'Gather education expense documentation (Form 1098-T)',
        category: 'other'
      });
    }
    
    return optimizations;
  }

  /**
   * Check business deduction opportunities
   */
  private checkBusinessDeductions(
    transactions: Transaction[],
    year: number
  ): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    
    const businessExpenses = this.calculateBusinessExpenses(transactions, year);
    
    if (businessExpenses.greaterThan(0)) {
      // Home office deduction
      optimizations.push({
        id: 'opt-home-office',
        title: 'Home Office Deduction',
        description: 'Deduct portion of home expenses for business use',
        potentialSavings: toDecimal(1500), // Simplified method max
        actionRequired: 'Document exclusive business use of home space',
        category: 'business'
      });
      
      // Section 179 for equipment
      optimizations.push({
        id: 'opt-section179',
        title: 'Section 179 Equipment Deduction',
        description: 'Immediately deduct full cost of qualifying equipment',
        potentialSavings: businessExpenses.times(0.24),
        deadline: endOfYear(new Date(year, 11, 31)),
        actionRequired: 'Purchase necessary business equipment before year-end',
        category: 'business'
      });
    }
    
    return optimizations;
  }

  /**
   * Check timing strategies
   */
  private checkTimingStrategies(year: number): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    
    // Income deferral
    optimizations.push({
      id: 'opt-defer-income',
      title: 'Defer Income to Next Year',
      description: 'Postpone bonuses or self-employment income if possible',
      potentialSavings: toDecimal(500),
      deadline: endOfYear(new Date(year, 11, 31)),
      actionRequired: 'Negotiate income timing with employer/clients',
      category: 'other'
    });
    
    // Accelerate deductions
    optimizations.push({
      id: 'opt-accelerate',
      title: 'Accelerate Deductions',
      description: 'Pay deductible expenses before year-end',
      potentialSavings: toDecimal(300),
      deadline: endOfYear(new Date(year, 11, 31)),
      actionRequired: 'Prepay property tax, mortgage interest, medical expenses',
      category: 'other'
    });
    
    return optimizations;
  }

  // Helper methods for calculating contributions
  private calculate401kContributions(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        t.description.toLowerCase().includes('401k')
      )
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }

  private calculateIRAContributions(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        t.description.toLowerCase().includes('ira')
      )
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }

  private calculateHSAContributions(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        t.description.toLowerCase().includes('hsa')
      )
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }

  private calculateCharitableDeductions(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        (t.description.toLowerCase().includes('charity') || 
         t.description.toLowerCase().includes('donation'))
      )
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }

  private calculateEducationExpenses(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        (t.description.toLowerCase().includes('tuition') || 
         t.description.toLowerCase().includes('education'))
      )
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }

  private calculateBusinessExpenses(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        (t.category === 'Business' || 
         t.description.toLowerCase().includes('business'))
      )
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }
}

export const taxOptimizer = new TaxOptimizer();