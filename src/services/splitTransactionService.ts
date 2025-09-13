import type { Transaction } from '../types';

export interface SplitItem {
  id: string;
  description: string;
  amount: number;
  category: string;
  percentage?: number;
}

export interface SplitTransactionData {
  originalTransaction: Transaction;
  splitItems: SplitItem[];
  totalAmount: number;
  remainingAmount: number;
}

export class SplitTransactionService {
  static createDefaultSplitItem(): SplitItem {
    return {
      id: `split-${Date.now()}`,
      description: '',
      amount: 0,
      category: '',
      percentage: 0
    };
  }

  static calculateSplitPercentage(itemAmount: number, totalAmount: number): number {
    if (totalAmount === 0) return 0;
    return (itemAmount / totalAmount) * 100;
  }

  static calculateAmountFromPercentage(percentage: number, totalAmount: number): number {
    return (percentage / 100) * totalAmount;
  }

  static calculateRemainingAmount(totalAmount: number, splitItems: SplitItem[]): number {
    const splitTotal = splitItems.reduce((sum, item) => sum + item.amount, 0);
    return totalAmount - splitTotal;
  }

  static validateSplit(splitItems: SplitItem[], totalAmount: number): string[] {
    const errors: string[] = [];
    const splitTotal = splitItems.reduce((sum, item) => sum + item.amount, 0);
    
    if (Math.abs(splitTotal - totalAmount) > 0.01) {
      errors.push(`Split amounts don't match total. Difference: ${(totalAmount - splitTotal).toFixed(2)}`);
    }
    
    splitItems.forEach((item, index) => {
      if (!item.description) {
        errors.push(`Item ${index + 1}: Description is required`);
      }
      if (item.amount <= 0) {
        errors.push(`Item ${index + 1}: Amount must be greater than 0`);
      }
      if (!item.category) {
        errors.push(`Item ${index + 1}: Category is required`);
      }
    });
    
    return errors;
  }

  static distributEvenly(totalAmount: number, numSplits: number): number[] {
    const baseAmount = Math.floor((totalAmount * 100) / numSplits) / 100;
    const remainder = totalAmount - (baseAmount * numSplits);
    const amounts = new Array(numSplits).fill(baseAmount);
    
    if (remainder > 0) {
      amounts[0] += remainder;
    }
    
    return amounts;
  }

  static createSplitTransactions(
    original: Transaction,
    splitItems: SplitItem[]
  ): Transaction[] {
    return splitItems.map((item, index) => ({
      ...original,
      id: `${original.id}-split-${index}`,
      description: item.description || `${original.description} (Split ${index + 1})`,
      amount: item.amount,
      category: item.category,
      isSplit: true,
      parentTransactionId: original.id
    }));
  }
}