import type { Transaction, Account, Investment } from '../types';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { startOfYear, endOfYear, isWithinInterval } from 'date-fns';

export interface TaxCategory {
  id: string;
  name: string;
  description: string;
  deductible: boolean;
  form?: string;
  maxDeduction?: DecimalInstance;
}

export interface TaxDeduction {
  id: string;
  categoryId: string;
  description: string;
  amount: DecimalInstance;
  date: Date;
  transactionIds: string[];
  documentation?: string;
}

export interface TaxEstimate {
  income: DecimalInstance;
  deductions: DecimalInstance;
  taxableIncome: DecimalInstance;
  estimatedTax: DecimalInstance;
  effectiveRate: number;
  marginalRate: number;
  quarterlyPayments?: DecimalInstance[];
}

export interface TaxDocument {
  id: string;
  type: 'W2' | '1099' | '1098' | 'receipt' | 'other';
  description: string;
  year: number;
  uploadDate: Date;
  fileName?: string;
  relatedTransactions?: string[];
}

export interface TaxReport {
  year: number;
  summary: TaxEstimate;
  deductions: TaxDeduction[];
  capitalGains: CapitalGain[];
  optimizations: TaxOptimization[]; 
  generatedDate: Date;
}

export interface TaxOptimization {
  id: string;
  title: string;
  description: string;
  potentialSavings: DecimalInstance;
  deadline?: Date;
  actionRequired: string;
  category: 'retirement' | 'charitable' | 'business' | 'investment' | 'other';
}

export interface CapitalGain {
  investmentId: string;
  investmentName: string;
  purchaseDate: Date;
  saleDate?: Date;
  costBasis: DecimalInstance;
  currentValue: DecimalInstance;
  gain: DecimalInstance;
  type: 'short-term' | 'long-term' | 'unrealized';
  taxRate: number;
  estimatedTax: DecimalInstance;
}

// Common tax categories for individuals
export const DEFAULT_TAX_CATEGORIES: TaxCategory[] = [
  {
    id: 'mortgage-interest',
    name: 'Mortgage Interest',
    description: 'Interest paid on mortgage loans',
    deductible: true,
    form: '1098'
  },
  {
    id: 'property-tax',
    name: 'Property Tax',
    description: 'State and local property taxes',
    deductible: true,
    maxDeduction: toDecimal(10000) // SALT limit
  },
  {
    id: 'charitable',
    name: 'Charitable Donations',
    description: 'Donations to qualified charitable organizations',
    deductible: true
  },
  {
    id: 'medical',
    name: 'Medical Expenses',
    description: 'Qualified medical and dental expenses',
    deductible: true
  },
  {
    id: 'business-expenses',
    name: 'Business Expenses',
    description: 'Expenses related to self-employment or business',
    deductible: true,
    form: 'Schedule C'
  },
  {
    id: 'education',
    name: 'Education Expenses',
    description: 'Qualified education expenses and student loan interest',
    deductible: true
  },
  {
    id: 'retirement',
    name: 'Retirement Contributions',
    description: 'Contributions to traditional IRA, 401(k), etc.',
    deductible: true
  },
  {
    id: 'hsa',
    name: 'HSA Contributions',
    description: 'Health Savings Account contributions',
    deductible: true,
    maxDeduction: toDecimal(3850) // 2024 individual limit
  }
];

class TaxPlanningService {
  /**
   * Estimate taxes based on transactions and current tax laws
   */
  estimateTaxes(
    transactions: Transaction[],
    accounts: Account[],
    year: number = new Date().getFullYear()
  ): TaxEstimate {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 11, 31));
    
    // Filter transactions for the tax year
    const yearTransactions = transactions.filter(t => 
      isWithinInterval(new Date(t.date), { start: yearStart, end: yearEnd })
    );
    
    // Calculate total income
    const income = yearTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
    
    // Calculate deductions
    const deductions = this.calculateDeductions(yearTransactions);
    
    // Calculate taxable income
    const standardDeduction = toDecimal(13850); // 2024 single filer
    const totalDeductions = deductions.greaterThan(standardDeduction) ? deductions : standardDeduction;
    const taxableIncome = income.minus(totalDeductions).greaterThan(0) 
      ? income.minus(totalDeductions) 
      : toDecimal(0);
    
    // Estimate tax (simplified 2024 brackets for single filer)
    const estimatedTax = this.calculateFederalTax(taxableIncome);
    
    // Calculate rates
    const effectiveRate = income.greaterThan(0) 
      ? estimatedTax.dividedBy(income).times(100).toNumber() 
      : 0;
    const marginalRate = this.getMarginalTaxRate(taxableIncome);
    
    // Calculate quarterly payments if self-employed
    const quarterlyPayments = this.calculateQuarterlyPayments(estimatedTax);
    
    return {
      income,
      deductions: totalDeductions,
      taxableIncome,
      estimatedTax,
      effectiveRate,
      marginalRate,
      quarterlyPayments
    };
  }

  /**
   * Track deductible expenses
   */
  trackDeductibleExpenses(
    transactions: Transaction[],
    year: number = new Date().getFullYear()
  ): TaxDeduction[] {
    const deductions: TaxDeduction[] = [];
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 11, 31));
    
    // Filter transactions for the tax year
    const yearTransactions = transactions.filter(t => 
      t.type === 'expense' &&
      isWithinInterval(new Date(t.date), { start: yearStart, end: yearEnd })
    );
    
    // Group by potential tax categories
    const taxCategories = new Map<string, Transaction[]>();
    
    yearTransactions.forEach(t => {
      const category = this.identifyTaxCategory(t);
      if (category) {
        if (!taxCategories.has(category.id)) {
          taxCategories.set(category.id, []);
        }
        taxCategories.get(category.id)!.push(t);
      }
    });
    
    // Create deduction records
    taxCategories.forEach((transactions, categoryId) => {
      const category = DEFAULT_TAX_CATEGORIES.find(c => c.id === categoryId);
      if (category) {
        const amount = transactions.reduce(
          (sum, t) => sum.plus(toDecimal(t.amount)), 
          toDecimal(0)
        );
        
        deductions.push({
          id: `deduction-${categoryId}-${year}`,
          categoryId,
          description: category.name,
          amount,
          date: new Date(),
          transactionIds: transactions.map(t => t.id),
          documentation: `${transactions.length} transactions totaling ${amount}`
        });
      }
    });
    
    return deductions;
  }

  /**
   * Suggest tax optimization strategies
   */
  suggestOptimizations(
    transactions: Transaction[],
    accounts: Account[],
    investments: Investment[]
  ): TaxOptimization[] {
    const optimizations: TaxOptimization[] = [];
    const currentYear = new Date().getFullYear();
    const yearEnd = endOfYear(new Date(currentYear, 11, 31));
    
    // 1. Retirement contribution optimization
    const retirementContributions = this.calculateRetirementContributions(transactions, currentYear);
    const maxContribution = toDecimal(23000); // 2024 401(k) limit
    
    if (retirementContributions.lessThan(maxContribution)) {
      const remaining = maxContribution.minus(retirementContributions);
      optimizations.push({
        id: 'opt-retirement',
        title: 'Maximize Retirement Contributions',
        description: `You can contribute ${remaining} more to reduce taxable income`,
        potentialSavings: remaining.times(0.24), // Assume 24% tax bracket
        deadline: yearEnd,
        actionRequired: 'Increase 401(k) contribution percentage',
        category: 'retirement'
      });
    }
    
    // 2. Tax-loss harvesting opportunities
    const capitalGains = this.calculateCapitalGains(investments);
    const netGains = capitalGains
      .filter(g => g.type !== 'unrealized')
      .reduce((sum, g) => sum.plus(g.gain), toDecimal(0));
    
    if (netGains.greaterThan(0)) {
      const losses = capitalGains.filter(g => g.gain.lessThan(0) && g.type === 'unrealized');
      if (losses.length > 0) {
        const potentialOffset = losses.reduce((sum, l) => sum.plus(l.gain.abs()), toDecimal(0));
        optimizations.push({
          id: 'opt-harvest',
          title: 'Tax-Loss Harvesting Opportunity',
          description: 'Sell losing investments to offset capital gains',
          potentialSavings: potentialOffset.times(0.15), // Long-term capital gains rate
          deadline: yearEnd,
          actionRequired: 'Review and sell underperforming investments',
          category: 'investment'
        });
      }
    }
    
    // 3. Charitable donation bunching
    const charitableDeductions = this.calculateCharitableDeductions(transactions, currentYear);
    if (charitableDeductions.greaterThan(0) && charitableDeductions.lessThan(10000)) {
      optimizations.push({
        id: 'opt-charitable',
        title: 'Bundle Charitable Donations',
        description: 'Consider bunching 2 years of donations to exceed standard deduction',
        potentialSavings: charitableDeductions.times(0.24),
        actionRequired: 'Make next year\'s planned donations before year-end',
        category: 'charitable'
      });
    }
    
    // 4. HSA contributions
    const hsaContributions = this.calculateHSAContributions(transactions, currentYear);
    const hsaLimit = toDecimal(3850); // 2024 individual limit
    
    if (hsaContributions.lessThan(hsaLimit)) {
      const remaining = hsaLimit.minus(hsaContributions);
      optimizations.push({
        id: 'opt-hsa',
        title: 'Max Out HSA Contributions',
        description: 'Triple tax advantage: deductible, grows tax-free, tax-free withdrawals',
        potentialSavings: remaining.times(0.24),
        deadline: new Date(currentYear + 1, 3, 15), // Tax filing deadline
        actionRequired: 'Increase HSA contributions',
        category: 'other'
      });
    }
    
    return optimizations;
  }

  /**
   * Calculate capital gains for investments
   */
  calculateCapitalGains(investments: Investment[]): CapitalGain[] {
    const gains: CapitalGain[] = [];
    const today = new Date();
    
    investments.forEach(inv => {
      const costBasis = toDecimal(inv.costBasis || inv.quantity * inv.averageCost);
      const currentValue = toDecimal(inv.currentValue);
      const gain = currentValue.minus(costBasis);
      
      // Determine if it's short-term or long-term
      const purchaseDate = new Date(inv.purchaseDate || inv.createdAt);
      const holdingPeriod = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      const isLongTerm = holdingPeriod > 365;
      
      const taxRate = isLongTerm ? 0.15 : 0.24; // Simplified rates
      const estimatedTax = gain.greaterThan(0) ? gain.times(taxRate) : toDecimal(0);
      
      gains.push({
        investmentId: inv.id,
        investmentName: inv.name,
        purchaseDate,
        costBasis,
        currentValue,
        gain,
        type: 'unrealized',
        taxRate: taxRate * 100,
        estimatedTax
      });
    });
    
    return gains;
  }

  /**
   * Generate tax reports
   */
  generateTaxReport(
    transactions: Transaction[],
    accounts: Account[],
    investments: Investment[],
    year: number
  ): TaxReport {
    const estimate = this.estimateTaxes(transactions, accounts, year);
    const deductions = this.trackDeductibleExpenses(transactions, year);
    const capitalGains = this.calculateCapitalGains(investments);
    const optimizations = this.suggestOptimizations(transactions, accounts, investments);
    
    return {
      year,
      summary: estimate,
      deductions,
      capitalGains,
      optimizations,
      generatedDate: new Date()
    };
  }

  // Helper methods
  private calculateFederalTax(taxableIncome: DecimalInstance): DecimalInstance {
    // 2024 tax brackets for single filer
    const brackets = [
      { min: 0, max: 11000, rate: 0.10 },
      { min: 11000, max: 44725, rate: 0.12 },
      { min: 44725, max: 95375, rate: 0.22 },
      { min: 95375, max: 182050, rate: 0.24 },
      { min: 182050, max: 231250, rate: 0.32 },
      { min: 231250, max: 578125, rate: 0.35 },
      { min: 578125, max: Infinity, rate: 0.37 }
    ];
    
    let tax = toDecimal(0);
    const income = taxableIncome.toNumber();
    
    for (const bracket of brackets) {
      if (income > bracket.min) {
        const taxableInBracket = Math.min(income - bracket.min, bracket.max - bracket.min);
        tax = tax.plus(toDecimal(taxableInBracket * bracket.rate));
      }
    }
    
    return tax;
  }

  private getMarginalTaxRate(taxableIncome: DecimalInstance): number {
    const income = taxableIncome.toNumber();
    
    if (income <= 11000) return 10;
    if (income <= 44725) return 12;
    if (income <= 95375) return 22;
    if (income <= 182050) return 24;
    if (income <= 231250) return 32;
    if (income <= 578125) return 35;
    return 37;
  }

  private calculateQuarterlyPayments(annualTax: DecimalInstance): DecimalInstance[] {
    const quarterlyAmount = annualTax.dividedBy(4);
    return [quarterlyAmount, quarterlyAmount, quarterlyAmount, quarterlyAmount];
  }

  private calculateDeductions(transactions: Transaction[]): DecimalInstance {
    // Simplified deduction calculation
    return transactions
      .filter(t => this.identifyTaxCategory(t) !== null)
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }

  private identifyTaxCategory(transaction: Transaction): TaxCategory | null {
    const description = transaction.description.toLowerCase();
    
    // Simple keyword matching (in production, this would be more sophisticated)
    if (description.includes('mortgage') && description.includes('interest')) {
      return DEFAULT_TAX_CATEGORIES.find(c => c.id === 'mortgage-interest') || null;
    }
    if (description.includes('property tax') || description.includes('real estate tax')) {
      return DEFAULT_TAX_CATEGORIES.find(c => c.id === 'property-tax') || null;
    }
    if (description.includes('charity') || description.includes('donation')) {
      return DEFAULT_TAX_CATEGORIES.find(c => c.id === 'charitable') || null;
    }
    if (description.includes('medical') || description.includes('doctor') || description.includes('hospital')) {
      return DEFAULT_TAX_CATEGORIES.find(c => c.id === 'medical') || null;
    }
    
    return null;
  }

  private calculateRetirementContributions(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        (t.description.toLowerCase().includes('401k') || 
         t.description.toLowerCase().includes('ira') ||
         t.description.toLowerCase().includes('retirement'))
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

  private calculateHSAContributions(transactions: Transaction[], year: number): DecimalInstance {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getFullYear() === year &&
        t.description.toLowerCase().includes('hsa')
      )
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  }
}

export const taxPlanningService = new TaxPlanningService();
