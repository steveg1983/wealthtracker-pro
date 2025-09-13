import { toDecimal } from '../../utils/decimal';
import type { Transaction } from '../../types';
import type { SavingsOpportunity } from './types';
import type {
  Subscription,
  DuplicateService,
  CategorySpendingStats,
  MerchantSpendingStats
} from '../../types/analytics';

/**
 * Finds savings opportunities in spending patterns
 */
export class OpportunityFinder {
  /**
   * Find all savings opportunities
   */
  findSavingsOpportunities(transactions: Transaction[]): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];
    
    // 1. Identify unused subscriptions
    const subscriptionOpportunities = this.findUnusedSubscriptions(transactions);
    opportunities.push(...subscriptionOpportunities);
    
    // 2. Identify high spending categories
    const categoryOpportunities = this.findCategoryOpportunities(transactions);
    opportunities.push(...categoryOpportunities);
    
    // 3. Identify duplicate services
    const duplicateOpportunities = this.findDuplicateServices(transactions);
    opportunities.push(...duplicateOpportunities);
    
    // 4. Merchant-specific opportunities
    const merchantOpportunities = this.findMerchantOpportunities(transactions);
    opportunities.push(...merchantOpportunities);
    
    return opportunities.sort((a, b) => 
      b.potentialSavings.minus(a.potentialSavings).toNumber()
    );
  }

  /**
   * Find unused subscriptions
   */
  private findUnusedSubscriptions(transactions: Transaction[]): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];
    const subscriptions = this.detectSubscriptions(transactions);
    
    subscriptions.forEach(sub => {
      if (sub.unusedMonths !== undefined && sub.unusedMonths > 2 && sub.monthlyAmount !== undefined) {
        opportunities.push({
          id: `opp-sub-${sub.merchant}`,
          type: 'subscription',
          title: `Unused Subscription: ${sub.merchant}`,
          description: `You haven't used ${sub.merchant} in ${sub.unusedMonths} months`,
          potentialSavings: sub.monthlyAmount.times(12),
          difficulty: 'easy',
          actionRequired: 'Cancel subscription',
          relatedTransactions: sub.transactionIds
        });
      }
    });
    
    return opportunities;
  }

  /**
   * Find category-based opportunities
   */
  private findCategoryOpportunities(transactions: Transaction[]): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];
    const categorySpending = this.analyzeCategorySpending(transactions);
    
    categorySpending.forEach((data, category) => {
      if (data.trend === 'increasing' && data.percentageOfIncome !== undefined && data.percentageOfIncome > 15 && data.monthlyAverage !== undefined) {
        opportunities.push({
          id: `opp-cat-${category}`,
          type: 'category',
          title: `Reduce ${category} Spending`,
          description: `Your ${category} spending is ${data.percentageIncrease}% higher than 3 months ago`,
          potentialSavings: data.monthlyAverage.times(0.2), // 20% reduction
          difficulty: 'medium',
          actionRequired: `Review and reduce ${category} expenses`
        });
      }
    });
    
    return opportunities;
  }

  /**
   * Find duplicate services
   */
  private findDuplicateServices(transactions: Transaction[]): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];
    const duplicates = this.detectDuplicateServices(transactions);
    
    duplicates.forEach(dup => {
      opportunities.push({
        id: `opp-dup-${dup.category}`,
        type: 'recurring',
        title: `Duplicate ${dup.category} Services`,
        description: `You're paying for multiple ${dup.category} services`,
        potentialSavings: dup.potentialSavings,
        difficulty: 'easy',
        actionRequired: 'Consolidate or cancel duplicate services',
        relatedTransactions: dup.transactionIds
      });
    });
    
    return opportunities;
  }

  /**
   * Find merchant-specific opportunities
   */
  private findMerchantOpportunities(transactions: Transaction[]): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];
    const merchantAnalysis = this.analyzeMerchantSpending(transactions);
    
    merchantAnalysis.forEach((data, merchant) => {
      if (data.averageTransaction !== undefined && data.averageTransaction.greaterThan(50) && data.monthlyTotal !== undefined) {
        opportunities.push({
          id: `opp-merchant-${merchant}`,
          type: 'merchant',
          title: `Optimize ${merchant} Spending`,
          description: `Consider bulk purchases or membership discounts`,
          potentialSavings: data.monthlyTotal.times(0.1), // 10% potential savings
          difficulty: 'medium',
          actionRequired: 'Look for discounts or alternative options'
        });
      }
    });
    
    return opportunities;
  }

  /**
   * Detect subscriptions
   */
  private detectSubscriptions(transactions: Transaction[]): Subscription[] {
    const subscriptions: Subscription[] = [];
    const merchantGroups = new Map<string, Transaction[]>();
    
    // Group by merchant
    transactions.forEach(t => {
      const merchant = t.description.split(' ')[0]; // Simple merchant extraction
      if (!merchantGroups.has(merchant)) {
        merchantGroups.set(merchant, []);
      }
      merchantGroups.get(merchant)!.push(t);
    });
    
    // Analyze each merchant for subscription patterns
    merchantGroups.forEach((txns, merchant) => {
      if (txns.length < 3) return;
      
      // Sort by date
      const sorted = txns.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      // Check for regular intervals
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const days = Math.round(
          (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }
      
      // Check if intervals are regular (monthly)
      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      const isRegular = intervals.every(i => Math.abs(i - avgInterval) < 7);
      
      if (isRegular && avgInterval >= 25 && avgInterval <= 35) {
        const lastTransaction = sorted[sorted.length - 1];
        const daysSinceLastTransaction = Math.round(
          (Date.now() - new Date(lastTransaction.date).getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        
        subscriptions.push({
          id: `sub-${merchant.replace(/\s+/g, '-').toLowerCase()}`,
          merchant,
          amount: toDecimal(Math.abs(lastTransaction.amount)),
          frequency: 'monthly',
          monthlyAmount: toDecimal(Math.abs(lastTransaction.amount)),
          lastChargeDate: new Date(lastTransaction.date),
          unusedMonths: Math.floor(daysSinceLastTransaction / 30),
          transactionIds: txns.map(t => t.id),
          isActive: daysSinceLastTransaction < 45,
          category: lastTransaction.category || 'Uncategorized'
        });
      }
    });
    
    return subscriptions;
  }

  /**
   * Analyze category spending
   */
  private analyzeCategorySpending(transactions: Transaction[]): Map<string, CategorySpendingStats> {
    const categoryStats = new Map<string, CategorySpendingStats>();
    // Simplified implementation
    return categoryStats;
  }

  /**
   * Detect duplicate services
   */
  private detectDuplicateServices(transactions: Transaction[]): DuplicateService[] {
    const duplicates: DuplicateService[] = [];
    // Simplified implementation
    return duplicates;
  }

  /**
   * Analyze merchant spending
   */
  private analyzeMerchantSpending(transactions: Transaction[]): Map<string, MerchantSpendingStats> {
    const merchantStats = new Map<string, MerchantSpendingStats>();
    const merchantGroups = new Map<string, Transaction[]>();
    
    // Group by merchant
    transactions.forEach(t => {
      const merchant = t.description.split(' ')[0]; // Simple merchant extraction
      if (!merchantGroups.has(merchant)) {
        merchantGroups.set(merchant, []);
      }
      merchantGroups.get(merchant)!.push(t);
    });
    
    // Calculate stats for each merchant
    merchantGroups.forEach((txns, merchant) => {
      const amounts = txns.map(t => toDecimal(Math.abs(t.amount)));
      const total = amounts.reduce((sum, a) => sum.plus(a), toDecimal(0));
      const avg = total.div(amounts.length);
      
      const frequency = txns.length > 20 ? 'daily' : 
                       txns.length > 10 ? 'weekly' :
                       txns.length > 3 ? 'monthly' : 'occasional';
      
      merchantStats.set(merchant, {
        merchantName: merchant,
        totalSpent: total,
        transactionCount: txns.length,
        averageAmount: avg,
        frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'occasional',
        monthlyTotal: total.div(12), // Simplified monthly calculation
        averageTransaction: avg,
        category: txns[0].category || 'Uncategorized'
      });
    });
    
    return merchantStats;
  }
}

export const opportunityFinder = new OpportunityFinder();