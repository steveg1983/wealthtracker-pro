import Decimal from 'decimal.js';
import type { Transaction } from '../../types';
import type { Subscription } from './types';
import { lazyLogger as logger } from '../serviceFactory';

/**
 * Subscription detection service
 * Identifies and tracks recurring subscriptions
 */
export class SubscriptionDetector {
  private subscriptions: Subscription[] = [];
  private readonly STORAGE_KEY = 'dataIntelligence_subscriptions';

  constructor() {
    this.loadSubscriptions();
  }

  /**
   * Load subscriptions from storage
   */
  private loadSubscriptions(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.subscriptions = JSON.parse(stored, (key, value) => {
          if (key === 'nextPaymentDate' || key === 'startDate' || key === 'endDate' || 
              key === 'createdAt' || key === 'lastUpdated') {
            return value ? new Date(value) : undefined;
          }
          return value;
        });
      }
    } catch (error) {
      logger.error('Failed to load subscriptions:', error);
    }
  }

  /**
   * Save subscriptions to storage
   */
  private saveSubscriptions(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.subscriptions));
    } catch (error) {
      logger.error('Failed to save subscriptions:', error);
    }
  }

  /**
   * Detect subscriptions from transactions
   */
  detectSubscriptions(transactions: Transaction[]): Subscription[] {
    const merchantGroups = this.groupByMerchant(transactions);
    const detectedSubs: Subscription[] = [];
    
    merchantGroups.forEach((txns, merchant) => {
      if (txns.length < 3) return; // Need at least 3 transactions
      
      const subscription = this.analyzeForSubscription(merchant, txns);
      if (subscription) {
        detectedSubs.push(subscription);
      }
    });
    
    // Merge with existing subscriptions
    this.mergeSubscriptions(detectedSubs);
    
    return this.subscriptions;
  }

  /**
   * Group transactions by merchant
   */
  private groupByMerchant(transactions: Transaction[]): Map<string, Transaction[]> {
    const groups = new Map<string, Transaction[]>();
    
    transactions.forEach(txn => {
      if (txn.type !== 'expense') return;
      
      const merchant = this.extractMerchantName(txn.description);
      if (!groups.has(merchant)) {
        groups.set(merchant, []);
      }
      groups.get(merchant)!.push(txn);
    });
    
    return groups;
  }

  /**
   * Analyze transactions for subscription pattern
   */
  private analyzeForSubscription(
    merchant: string, 
    transactions: Transaction[]
  ): Subscription | null {
    // Sort by date
    const sorted = transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate intervals between transactions
    const intervals: number[] = [];
    const amounts: number[] = [];
    
    for (let i = 1; i < sorted.length; i++) {
      const days = this.daysBetween(
        new Date(sorted[i-1].date),
        new Date(sorted[i].date)
      );
      intervals.push(days);
      amounts.push(Math.abs(sorted[i].amount));
    }
    
    // Check for regular pattern
    const frequency = this.detectFrequency(intervals);
    if (!frequency) return null;
    
    // Check for consistent amounts
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const amountVariance = this.calculateVariance(amounts, avgAmount);
    
    // High variance suggests not a subscription
    if (amountVariance > 0.2) return null;
    
    const lastTransaction = sorted[sorted.length - 1];
    
    return {
      id: `sub-${merchant}-${Date.now()}`,
      merchantId: merchant,
      merchantName: merchant,
      amount: avgAmount,
      frequency,
      nextPaymentDate: this.predictNextPayment(
        new Date(lastTransaction.date),
        frequency
      ),
      category: lastTransaction.category || 'Subscriptions',
      status: 'active',
      startDate: new Date(sorted[0].date),
      renewalType: 'auto',
      paymentMethod: 'card',
      transactionIds: sorted.map(t => t.id),
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Detect subscription frequency
   */
  private detectFrequency(intervals: number[]): Subscription['frequency'] | null {
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    
    // Check for weekly (7 days +/- 2)
    if (avgInterval >= 5 && avgInterval <= 9) {
      const isWeekly = intervals.every(i => i >= 5 && i <= 9);
      if (isWeekly) return 'weekly';
    }
    
    // Check for monthly (30 days +/- 5)
    if (avgInterval >= 25 && avgInterval <= 35) {
      const isMonthly = intervals.every(i => i >= 25 && i <= 35);
      if (isMonthly) return 'monthly';
    }
    
    // Check for quarterly (90 days +/- 10)
    if (avgInterval >= 80 && avgInterval <= 100) {
      const isQuarterly = intervals.every(i => i >= 80 && i <= 100);
      if (isQuarterly) return 'quarterly';
    }
    
    // Check for yearly (365 days +/- 15)
    if (avgInterval >= 350 && avgInterval <= 380) {
      const isYearly = intervals.every(i => i >= 350 && i <= 380);
      if (isYearly) return 'yearly';
    }
    
    return null;
  }

  /**
   * Calculate variance for amount consistency
   */
  private calculateVariance(amounts: number[], mean: number): number {
    const squaredDiffs = amounts.map(a => Math.pow(a - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / amounts.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    return stdDev / mean; // Coefficient of variation
  }

  /**
   * Predict next payment date
   */
  private predictNextPayment(
    lastDate: Date,
    frequency: Subscription['frequency']
  ): Date {
    const next = new Date(lastDate);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    
    return next;
  }

  /**
   * Merge detected subscriptions with existing
   */
  private mergeSubscriptions(detected: Subscription[]): void {
    detected.forEach(sub => {
      const existing = this.subscriptions.find(s => 
        s.merchantName === sub.merchantName &&
        s.amount === sub.amount
      );
      
      if (existing) {
        // Update existing subscription
        existing.lastUpdated = new Date();
        existing.nextPaymentDate = sub.nextPaymentDate;
        existing.transactionIds = [...new Set([...existing.transactionIds, ...sub.transactionIds])];
      } else {
        // Add new subscription
        this.subscriptions.push(sub);
      }
    });
    
    this.saveSubscriptions();
  }

  /**
   * Extract merchant name from description
   */
  private extractMerchantName(description: string): string {
    // Simple extraction - take first few words and clean
    return description
      .replace(/\*\d+/, '')
      .replace(/#\d+/, '')
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .trim();
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
   * Get all subscriptions
   */
  getSubscriptions(): Subscription[] {
    return this.subscriptions;
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): Subscription[] {
    return this.subscriptions.filter(s => s.status === 'active');
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(id: string): void {
    const sub = this.subscriptions.find(s => s.id === id);
    if (sub) {
      sub.status = 'cancelled';
      sub.endDate = new Date();
      sub.lastUpdated = new Date();
      this.saveSubscriptions();
    }
  }

  /**
   * Calculate total monthly subscription cost
   */
  calculateMonthlyCost(): InstanceType<typeof Decimal> {
    return this.getActiveSubscriptions().reduce((total, sub) => {
      let monthlyAmount = new Decimal(sub.amount);
      
      switch (sub.frequency) {
        case 'weekly':
          monthlyAmount = monthlyAmount.times(4.33); // Average weeks per month
          break;
        case 'quarterly':
          monthlyAmount = monthlyAmount.div(3);
          break;
        case 'yearly':
          monthlyAmount = monthlyAmount.div(12);
          break;
      }
      
      return total.plus(monthlyAmount);
    }, new Decimal(0));
  }
}

export const subscriptionDetector = new SubscriptionDetector();