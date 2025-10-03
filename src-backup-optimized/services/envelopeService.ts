import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import type { DecimalTransaction } from '../types/decimal-types';
import type { Budget, Category } from '../types';

export interface Envelope {
  id: string;
  name: string;
  budgetedAmount: DecimalInstance;
  spentAmount: DecimalInstance;
  remainingAmount: DecimalInstance;
  categoryIds: string[];
  color: string;
  isOverspent: boolean;
  fillPercentage: number;
  priority: 'high' | 'medium' | 'low';
}

export interface EnvelopeTransfer {
  fromEnvelopeId: string;
  toEnvelopeId: string;
  amount: DecimalInstance;
  date: Date;
  description: string;
}

/**
 * Service for envelope budgeting calculations and operations
 */
export class EnvelopeService {
  /**
   * Create envelopes from budgets
   */
  static createEnvelopesFromBudgets(
    budgets: Budget[],
    transactions: DecimalTransaction[],
    categories: Category[],
    currentMonth: string
  ): Envelope[] {
    return budgets.map(budget => {
      const budgetedAmount = toDecimal(budget.amount);
      
      // Calculate spending for this budget's category
      const spentAmount = transactions
        .filter(t => 
          t.type === 'expense' && 
          t.date.toISOString().startsWith(currentMonth) &&
          t.category === budget.categoryId
        )
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const remainingAmount = budgetedAmount.minus(spentAmount);
      const isOverspent = remainingAmount.lessThan(0);
      const fillPercentage = budgetedAmount.greaterThan(0) 
        ? Math.min(spentAmount.dividedBy(budgetedAmount).times(100).toNumber(), 100)
        : 0;

      // Use category name as envelope name
      const categoryName = categories.find(c => c.id === budget.categoryId)?.name || budget.categoryId;

      return {
        id: budget.id,
        name: categoryName,
        budgetedAmount,
        spentAmount,
        remainingAmount,
        categoryIds: [budget.categoryId],
        color: '#3B82F6',
        isOverspent,
        fillPercentage,
        priority: 'medium' as const
      };
    });
  }

  /**
   * Calculate envelope totals
   */
  static calculateTotals(envelopes: Envelope[]) {
    const totalBudgeted = envelopes.reduce(
      (sum, env) => sum.plus(env.budgetedAmount), 
      toDecimal(0)
    );
    
    const totalSpent = envelopes.reduce(
      (sum, env) => sum.plus(env.spentAmount), 
      toDecimal(0)
    );
    
    const totalRemaining = envelopes.reduce(
      (sum, env) => sum.plus(env.remainingAmount), 
      toDecimal(0)
    );
    
    const overbudgetEnvelopes = envelopes.filter(env => env.isOverspent);

    return {
      totalBudgeted,
      totalSpent,
      totalRemaining,
      overbudgetCount: overbudgetEnvelopes.length
    };
  }

  /**
   * Get priority color classes
   */
  static getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Validate envelope creation
   */
  static validateEnvelope(name: string, amount: string, categoryIds: string[]): boolean {
    return !!(name && amount && categoryIds.length > 0);
  }

  /**
   * Validate fund transfer
   */
  static validateTransfer(fromId: string, toId: string, amount: string): boolean {
    if (!fromId || !toId || !amount) return false;
    const numAmount = parseFloat(amount);
    return numAmount > 0;
  }
}

export const envelopeService = new EnvelopeService();
