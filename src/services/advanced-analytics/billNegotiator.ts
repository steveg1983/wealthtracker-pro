import { toDecimal } from '../../utils/decimal';
import type { Transaction } from '../../types';
import type { BillNegotiationSuggestion } from './types';
import type { RecurringBill } from '../../types/analytics';

/**
 * Bill negotiation suggestions
 * Identifies bills that could be negotiated for lower rates
 */
export class BillNegotiator {
  private readonly negotiableCategories = [
    'Internet', 
    'Mobile Phone', 
    'Insurance', 
    'Utilities', 
    'Cable/Streaming', 
    'Gym', 
    'Subscriptions'
  ];

  private readonly categoryTips: Record<string, string[]> = {
    'Internet': [
      'Research competitor prices in your area',
      'Ask about promotional rates for existing customers',
      'Bundle with other services for discounts',
      'Threaten to switch providers',
      'Ask to speak to retention department'
    ],
    'Mobile Phone': [
      'Review your data usage - you may need less',
      'Ask about family plan discounts',
      'Consider switching to a prepaid plan',
      'Negotiate device payment plans separately',
      'Check for employer or association discounts'
    ],
    'Insurance': [
      'Shop around and get quotes from competitors',
      'Increase deductibles to lower premiums',
      'Bundle home and auto insurance',
      'Ask about safe driver discounts',
      'Review coverage - you may be over-insured'
    ],
    'Utilities': [
      'Ask about budget billing programs',
      'Inquire about low-income assistance if eligible',
      'Consider time-of-use rate plans',
      'Ask about energy efficiency rebates',
      'Compare with alternative providers if available'
    ],
    'Cable/Streaming': [
      'Bundle services for discounts',
      'Downgrade to a lower tier package',
      'Cancel and re-subscribe as a new customer',
      'Share subscriptions with family/friends',
      'Rotate subscriptions instead of having all at once'
    ],
    'Gym': [
      'Ask about off-peak hour memberships',
      'Negotiate annual payment discounts',
      'Look for corporate wellness programs',
      'Consider switching to a budget gym chain',
      'Ask about referral discounts'
    ],
    'Subscriptions': [
      'Look for annual payment discounts',
      'Use student or military discounts if eligible',
      'Share family plans with others',
      'Cancel and wait for win-back offers',
      'Stack discounts and promotional codes'
    ]
  };

  private readonly successRates: Record<string, number> = {
    'Internet': 75,
    'Mobile Phone': 80,
    'Insurance': 65,
    'Utilities': 40,
    'Cable/Streaming': 85,
    'Gym': 70,
    'Subscriptions': 60
  };

  /**
   * Suggest bills that could be negotiated
   */
  suggestBillNegotiations(transactions: Transaction[]): BillNegotiationSuggestion[] {
    const suggestions: BillNegotiationSuggestion[] = [];
    
    // Find recurring bills
    const recurringBills = this.findRecurringBills(transactions);
    
    recurringBills.forEach(bill => {
      if (this.negotiableCategories.includes(bill.category)) {
        const suggestion: BillNegotiationSuggestion = {
          merchant: bill.merchant,
          currentAmount: bill.amount,
          potentialSavings: bill.amount.times(0.2), // Assume 20% potential savings
          category: bill.category,
          negotiationTips: this.getNegotiationTips(bill.category),
          successRate: this.getSuccessRate(bill.category),
          lastTransactionDate: bill.lastDate || new Date()
        };
        
        suggestions.push(suggestion);
      }
    });
    
    return suggestions.sort((a, b) => 
      b.potentialSavings.minus(a.potentialSavings).toNumber()
    );
  }

  /**
   * Find recurring bills
   */
  private findRecurringBills(transactions: Transaction[]): RecurringBill[] {
    const bills: RecurringBill[] = [];
    const merchantGroups = new Map<string, Transaction[]>();
    
    // Group by merchant
    transactions.forEach(t => {
      if (t.type !== 'expense') return;
      
      const merchant = this.extractMerchant(t.description);
      if (!merchantGroups.has(merchant)) {
        merchantGroups.set(merchant, []);
      }
      merchantGroups.get(merchant)!.push(t);
    });
    
    // Analyze each merchant for recurring patterns
    merchantGroups.forEach((txns, merchant) => {
      if (txns.length < 3) return; // Need at least 3 transactions
      
      // Sort by date
      const sorted = txns.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      // Check for regular intervals
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const days = this.daysBetween(
          new Date(sorted[i-1].date),
          new Date(sorted[i].date)
        );
        intervals.push(days);
      }
      
      // Determine if it's recurring
      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      const isMonthly = this.isMonthlyRecurring(intervals, avgInterval);
      const isAnnual = this.isAnnualRecurring(intervals, avgInterval);
      
      if (isMonthly || isAnnual) {
        const lastTransaction = sorted[sorted.length - 1];
        
        bills.push({
          id: `bill-${merchant.replace(/\s+/g, '-').toLowerCase()}`,
          merchant,
          amount: toDecimal(Math.abs(lastTransaction.amount)),
          variability: 'fixed' as const,
          frequency: isMonthly ? 'monthly' : 'yearly',
          lastDate: new Date(lastTransaction.date),
          category: this.categorizeByMerchant(merchant, lastTransaction.category),
          isEssential: true
        });
      }
    });
    
    return bills;
  }

  /**
   * Extract merchant name from description
   */
  private extractMerchant(description: string): string {
    // Simple extraction - take first few words
    const words = description.split(' ').slice(0, 3);
    return words.join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  }

  /**
   * Calculate days between dates
   */
  private daysBetween(date1: Date, date2: Date): number {
    return Math.round(
      (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /**
   * Check if intervals suggest monthly recurring
   */
  private isMonthlyRecurring(intervals: number[], avgInterval: number): boolean {
    // Monthly is typically 28-32 days
    return avgInterval >= 28 && 
           avgInterval <= 32 && 
           intervals.every(i => i >= 25 && i <= 35);
  }

  /**
   * Check if intervals suggest annual recurring
   */
  private isAnnualRecurring(intervals: number[], avgInterval: number): boolean {
    // Annual is typically 360-370 days
    return avgInterval >= 360 && 
           avgInterval <= 370 && 
           intervals.every(i => i >= 350 && i <= 380);
  }

  /**
   * Categorize by merchant name
   */
  private categorizeByMerchant(merchant: string, existingCategory?: string): string {
    if (existingCategory && this.negotiableCategories.includes(existingCategory)) {
      return existingCategory;
    }
    
    const merchantLower = merchant.toLowerCase();
    
    if (merchantLower.includes('internet') || merchantLower.includes('broadband')) {
      return 'Internet';
    }
    if (merchantLower.includes('mobile') || merchantLower.includes('phone')) {
      return 'Mobile Phone';
    }
    if (merchantLower.includes('insurance')) {
      return 'Insurance';
    }
    if (merchantLower.includes('electric') || merchantLower.includes('gas')) {
      return 'Utilities';
    }
    if (merchantLower.includes('netflix') || merchantLower.includes('hulu')) {
      return 'Cable/Streaming';
    }
    if (merchantLower.includes('gym') || merchantLower.includes('fitness')) {
      return 'Gym';
    }
    
    return 'Subscriptions';
  }

  /**
   * Predict next bill date
   */
  private predictNextDate(lastDate: Date, avgIntervalDays: number): Date {
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + Math.round(avgIntervalDays));
    return nextDate;
  }

  /**
   * Get negotiation tips for category
   */
  private getNegotiationTips(category: string): string[] {
    return this.categoryTips[category] || [
      'Research competitive prices',
      'Ask for loyalty discounts',
      'Be prepared to switch providers',
      'Speak to retention department',
      'Bundle services for savings'
    ];
  }

  /**
   * Get success rate for category
   */
  private getSuccessRate(category: string): number {
    return this.successRates[category] || 50;
  }
}

export const billNegotiator = new BillNegotiator();