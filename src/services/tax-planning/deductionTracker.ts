/**
 * Deduction Tracker Module
 * Tracks and manages tax deductions
 */

import type { Transaction } from '../../types';
import type { TaxDeduction, TaxCategory } from './types';
import type { DecimalInstance } from '../../types/decimal-types';
import { toDecimal } from '../../utils/decimal';
import { startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { taxCategoryService } from './taxCategories';

/**
 * Deduction tracking service
 */
export class DeductionTracker {
  private deductions: Map<string, TaxDeduction[]> = new Map();

  /**
   * Track deductible expenses from transactions
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
    
    // Group by tax categories
    const categoryGroups = this.groupByTaxCategory(yearTransactions);
    
    // Create deduction records
    categoryGroups.forEach((transactions, category) => {
      const amount = this.calculateCategoryTotal(transactions, category);
      
      // Apply category limits if any
      const finalAmount = category.maxDeduction && amount.greaterThan(category.maxDeduction)
        ? category.maxDeduction
        : amount;
      
      deductions.push({
        id: `deduction-${category.id}-${year}`,
        categoryId: category.id,
        description: category.name,
        amount: finalAmount,
        date: new Date(),
        transactionIds: transactions.map(t => t.id),
        documentation: this.generateDocumentation(transactions, category)
      });
    });
    
    // Store deductions for the year
    this.deductions.set(year.toString(), deductions);
    
    return deductions;
  }

  /**
   * Group transactions by tax category
   */
  private groupByTaxCategory(
    transactions: Transaction[]
  ): Map<TaxCategory, Transaction[]> {
    const groups = new Map<TaxCategory, Transaction[]>();
    
    transactions.forEach(t => {
      const category = taxCategoryService.identifyCategory(t);
      if (category && category.deductible) {
        if (!groups.has(category)) {
          groups.set(category, []);
        }
        groups.get(category)!.push(t);
      }
    });
    
    return groups;
  }

  /**
   * Calculate total for a category
   */
  private calculateCategoryTotal(
    transactions: Transaction[],
    category: TaxCategory
  ): DecimalInstance {
    const total = transactions.reduce(
      (sum, t) => sum.plus(toDecimal(t.amount)),
      toDecimal(0)
    );
    
    // Apply special rules for certain categories
    if (category.id === 'medical') {
      // Medical expenses are only deductible above 7.5% of AGI
      // This would need AGI as input in a real implementation
      // For now, we'll return the full amount
      return total;
    }
    
    if (category.id === 'property-tax' || category.id === 'state-income-tax') {
      // SALT deduction limit applies to combined state and local taxes
      // This should be handled at a higher level when combining categories
      return total;
    }
    
    return total;
  }

  /**
   * Generate documentation for deduction
   */
  private generateDocumentation(
    transactions: Transaction[],
    category: TaxCategory
  ): string {
    const count = transactions.length;
    const total = transactions.reduce(
      (sum, t) => sum.plus(toDecimal(t.amount)),
      toDecimal(0)
    );
    
    let doc = `${count} transaction${count !== 1 ? 's' : ''} totaling ${total.toFixed(2)}`;
    
    if (category.form) {
      doc += ` (Form ${category.form})`;
    }
    
    if (category.maxDeduction) {
      doc += ` (Limited to ${category.maxDeduction.toFixed(2)})`;
    }
    
    return doc;
  }

  /**
   * Calculate total deductions
   */
  calculateTotalDeductions(year: number): DecimalInstance {
    const deductions = this.deductions.get(year.toString()) || [];
    return deductions.reduce(
      (sum, d) => sum.plus(d.amount),
      toDecimal(0)
    );
  }

  /**
   * Get deductions by category
   */
  getDeductionsByCategory(
    year: number,
    categoryId: string
  ): TaxDeduction | null {
    const deductions = this.deductions.get(year.toString()) || [];
    return deductions.find(d => d.categoryId === categoryId) || null;
  }

  /**
   * Apply SALT limit to state and local taxes
   */
  applySALTLimit(
    deductions: TaxDeduction[],
    limit: DecimalInstance
  ): TaxDeduction[] {
    const saltCategories = ['property-tax', 'state-income-tax'];
    const saltDeductions = deductions.filter(d => saltCategories.includes(d.categoryId));
    const otherDeductions = deductions.filter(d => !saltCategories.includes(d.categoryId));
    
    if (saltDeductions.length === 0) {
      return deductions;
    }
    
    // Calculate total SALT deductions
    const totalSALT = saltDeductions.reduce(
      (sum, d) => sum.plus(d.amount),
      toDecimal(0)
    );
    
    if (totalSALT.lessThanOrEqualTo(limit)) {
      return deductions;
    }
    
    // Create combined SALT deduction with limit
    const combinedSALT: TaxDeduction = {
      id: 'deduction-salt-combined',
      categoryId: 'salt-combined',
      description: 'State and Local Taxes (Limited)',
      amount: limit,
      date: new Date(),
      transactionIds: saltDeductions.flatMap(d => d.transactionIds),
      documentation: `Combined SALT deductions limited to ${limit.toFixed(2)}`
    };
    
    return [...otherDeductions, combinedSALT];
  }

  /**
   * Check if itemizing is beneficial
   */
  shouldItemize(
    totalDeductions: DecimalInstance,
    standardDeduction: DecimalInstance
  ): boolean {
    return totalDeductions.greaterThan(standardDeduction);
  }

  /**
   * Get deduction summary
   */
  getDeductionSummary(year: number): {
    total: DecimalInstance;
    byCategory: Array<{ category: string; amount: DecimalInstance }>;
    shouldItemize: boolean;
    standardDeduction: DecimalInstance;
  } {
    const deductions = this.deductions.get(year.toString()) || [];
    const total = this.calculateTotalDeductions(year);
    const standardDeduction = toDecimal(13850); // 2024 single filer
    
    const byCategory = deductions.map(d => ({
      category: d.description,
      amount: d.amount
    }));
    
    return {
      total,
      byCategory,
      shouldItemize: this.shouldItemize(total, standardDeduction),
      standardDeduction
    };
  }

  /**
   * Export deductions for tax preparation
   */
  exportDeductions(year: number): string {
    const deductions = this.deductions.get(year.toString()) || [];
    const summary = this.getDeductionSummary(year);
    
    let output = `Tax Deductions Summary - ${year}\n`;
    output += '=' .repeat(40) + '\n\n';
    
    deductions.forEach(d => {
      output += `${d.description}: $${d.amount.toFixed(2)}\n`;
      output += `  Documentation: ${d.documentation}\n`;
      output += `  Transactions: ${d.transactionIds.length}\n\n`;
    });
    
    output += '-'.repeat(40) + '\n';
    output += `Total Itemized Deductions: $${summary.total.toFixed(2)}\n`;
    output += `Standard Deduction: $${summary.standardDeduction.toFixed(2)}\n`;
    output += `Recommendation: ${summary.shouldItemize ? 'Itemize' : 'Use Standard Deduction'}\n`;
    
    return output;
  }
}

export const deductionTracker = new DeductionTracker();