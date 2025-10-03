/**
 * Expense Split Service
 * Handles business logic for expense splitting
 */

import { collaborationService } from './collaborationService';
import { toDecimal } from '../utils/decimal';
import type { HouseholdMember } from './collaborationService';
import type Decimal from 'decimal.js';

export type SplitMethod = 'equal' | 'custom' | 'percentage';

export interface CustomSplit {
  amount: number;
  percentage: number;
}

export interface ValidationError {
  field?: string;
  message: string;
}

class ExpenseSplitService {
  /**
   * Initialize custom splits for members
   */
  initializeCustomSplits(
    members: HouseholdMember[],
    totalAmount: number
  ): Record<string, CustomSplit> {
    const splits: Record<string, CustomSplit> = {};
    const memberCount = members.length || 1;
    
    members.forEach(member => {
      splits[member.id] = {
        amount: totalAmount / memberCount,
        percentage: 100 / memberCount
      };
    });
    
    return splits;
  }

  /**
   * Recalculate equal splits
   */
  recalculateEqualSplits(
    selectedMembers: string[],
    totalAmount: number
  ): Record<string, CustomSplit> {
    if (selectedMembers.length === 0) return {};
    
    const equalAmount = totalAmount / selectedMembers.length;
    const equalPercentage = 100 / selectedMembers.length;
    
    const splits: Record<string, CustomSplit> = {};
    selectedMembers.forEach(id => {
      splits[id] = {
        amount: equalAmount,
        percentage: equalPercentage
      };
    });
    
    return splits;
  }

  /**
   * Update amount and calculate percentage
   */
  updateAmountAndPercentage(
    amount: number,
    totalAmount: number
  ): CustomSplit {
    return {
      amount,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
    };
  }

  /**
   * Update percentage and calculate amount
   */
  updatePercentageAndAmount(
    percentage: number,
    totalAmount: number
  ): CustomSplit {
    return {
      percentage,
      amount: (totalAmount * percentage) / 100
    };
  }

  /**
   * Validate split configuration
   */
  validateSplit(
    description: string,
    totalAmount: number,
    selectedMembers: string[],
    splitMethod: SplitMethod,
    customSplits: Record<string, CustomSplit>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!description.trim()) {
      errors.push({ field: 'description', message: 'Description is required' });
    }
    
    if (totalAmount <= 0) {
      errors.push({ field: 'totalAmount', message: 'Total amount must be greater than 0' });
    }
    
    if (selectedMembers.length === 0) {
      errors.push({ field: 'members', message: 'At least one member must be selected' });
    }
    
    if (splitMethod === 'custom' || splitMethod === 'percentage') {
      const totalSplitAmount = this.calculateTotalSplitAmount(selectedMembers, customSplits);
      const totalPercentage = this.calculateTotalPercentage(selectedMembers, customSplits);
      
      if (Math.abs(totalSplitAmount - totalAmount) > 0.01) {
        errors.push({ 
          field: 'splitAmount', 
          message: 'Split amounts must equal the total amount' 
        });
      }
      
      if (splitMethod === 'percentage' && Math.abs(totalPercentage - 100) > 0.01) {
        errors.push({ 
          field: 'percentage', 
          message: 'Percentages must add up to 100%' 
        });
      }
    }
    
    return errors;
  }

  /**
   * Calculate total split amount
   */
  calculateTotalSplitAmount(
    selectedMembers: string[],
    customSplits: Record<string, CustomSplit>
  ): number {
    return selectedMembers.reduce((sum, memberId) => 
      sum + (customSplits[memberId]?.amount || 0), 0
    );
  }

  /**
   * Calculate total percentage
   */
  calculateTotalPercentage(
    selectedMembers: string[],
    customSplits: Record<string, CustomSplit>
  ): number {
    return selectedMembers.reduce((sum, memberId) => 
      sum + (customSplits[memberId]?.percentage || 0), 0
    );
  }

  /**
   * Create expense split
   */
  createExpenseSplit(
    transactionId: string | undefined,
    totalAmount: number,
    description: string,
    splitMethod: SplitMethod,
    selectedMembers: string[],
    customSplits: Record<string, CustomSplit>
  ): boolean {
    const splits = selectedMembers.map(memberId => ({
      memberId,
      amount: toDecimal(customSplits[memberId]?.amount || 0),
      percentage: splitMethod === 'percentage' ? customSplits[memberId]?.percentage : undefined
    }));
    
    const expenseSplit = collaborationService.createExpenseSplit(
      transactionId || 'manual-' + Date.now(),
      toDecimal(totalAmount),
      description.trim(),
      splitMethod,
      splits
    );
    
    return !!expenseSplit;
  }

  /**
   * Get active household members
   */
  getActiveMembers(): HouseholdMember[] {
    const household = collaborationService.getCurrentHousehold();
    if (!household) return [];
    return household.members.filter(m => m.isActive);
  }

  /**
   * Check if split totals are valid
   */
  isSplitAmountValid(
    totalSplitAmount: number,
    totalAmount: number
  ): boolean {
    return Math.abs(totalSplitAmount - totalAmount) < 0.01;
  }

  /**
   * Check if percentage total is valid
   */
  isPercentageValid(totalPercentage: number): boolean {
    return Math.abs(totalPercentage - 100) < 0.01;
  }

  /**
   * Get validation status color class
   */
  getValidationColorClass(isValid: boolean): string {
    return isValid 
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  }

  /**
   * Format error messages for display
   */
  formatErrorMessages(errors: ValidationError[]): string[] {
    return errors.map(error => error.message);
  }
}

export const expenseSplitService = new ExpenseSplitService();