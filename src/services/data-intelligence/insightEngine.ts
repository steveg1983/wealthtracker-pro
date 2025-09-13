import Decimal from 'decimal.js';
import type { Transaction } from '../../types';
import type { SpendingInsight, Subscription, SpendingPattern } from './types';
import { logger } from '../loggingService';

/**
 * Insight generation engine
 * Creates actionable insights from transaction data
 */
export class InsightEngine {
  private insights: SpendingInsight[] = [];
  private readonly STORAGE_KEY = 'dataIntelligence_insights';

  constructor() {
    this.loadInsights();
  }

  /**
   * Load insights from storage
   */
  private loadInsights(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.insights = JSON.parse(stored, (key, value) => {
          if (key === 'date' || key === 'createdAt') {
            return new Date(value);
          }
          return value;
        });
      }
    } catch (error) {
      logger.error('Failed to load insights:', error);
    }
  }

  /**
   * Save insights to storage  
   */
  private saveInsights(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.insights));
    } catch (error) {
      logger.error('Failed to save insights:', error);
    }
  }

  /**
   * Generate insights from various data sources
   */
  generateInsights(
    transactions: Transaction[],
    subscriptions: Subscription[],
    patterns: SpendingPattern[]
  ): SpendingInsight[] {
    const newInsights: SpendingInsight[] = [];
    
    // Check for unused subscriptions
    const subscriptionInsights = this.generateSubscriptionInsights(subscriptions, transactions);
    newInsights.push(...subscriptionInsights);
    
    // Check for spending spikes
    const spendingInsights = this.generateSpendingInsights(transactions, patterns);
    newInsights.push(...spendingInsights);
    
    // Check for new merchants
    const merchantInsights = this.generateMerchantInsights(transactions);
    newInsights.push(...merchantInsights);
    
    // Check for category trends
    const categoryInsights = this.generateCategoryInsights(patterns);
    newInsights.push(...categoryInsights);
    
    // Check for duplicate transactions
    const duplicateInsights = this.generateDuplicateInsights(transactions);
    newInsights.push(...duplicateInsights);
    
    // Update stored insights
    this.updateInsights(newInsights);
    
    return this.getActiveInsights();
  }

  /**
   * Generate subscription-related insights
   */
  private generateSubscriptionInsights(
    subscriptions: Subscription[],
    transactions: Transaction[]
  ): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    const now = new Date();
    
    subscriptions.forEach(sub => {
      if (sub.status !== 'active') return;
      
      // Check for unused subscriptions
      const lastUsed = this.getLastUsageDate(sub.merchantName, transactions);
      const daysSinceUse = lastUsed ? 
        Math.round((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)) : 
        999;
      
      if (daysSinceUse > 60) {
        insights.push({
          id: `insight-sub-unused-${sub.id}`,
          type: 'subscription_alert',
          title: `Unused Subscription: ${sub.merchantName}`,
          description: `You haven't used ${sub.merchantName} in ${daysSinceUse} days. Consider cancelling to save ${this.formatAmount(sub.amount)}/month.`,
          severity: 'medium',
          category: sub.category,
          merchant: sub.merchantName,
          amount: sub.amount,
          actionRequired: true,
          createdAt: now
        });
      }
      
      // Check for price increases
      const priceIncrease = this.detectPriceIncrease(sub, transactions);
      if (priceIncrease) {
        insights.push({
          id: `insight-sub-increase-${sub.id}`,
          type: 'subscription_alert',
          title: `Price Increase: ${sub.merchantName}`,
          description: `${sub.merchantName} increased from ${this.formatAmount(priceIncrease.oldAmount)} to ${this.formatAmount(priceIncrease.newAmount)}`,
          severity: 'high',
          category: sub.category,
          merchant: sub.merchantName,
          amount: priceIncrease.newAmount,
          actionRequired: true,
          createdAt: now
        });
      }
    });
    
    return insights;
  }

  /**
   * Generate spending-related insights
   */
  private generateSpendingInsights(
    transactions: Transaction[],
    patterns: SpendingPattern[]
  ): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    const now = new Date();
    
    // Check for spending spikes
    patterns
      .filter(p => p.patternType === 'anomaly' && p.isActive)
      .forEach(pattern => {
        insights.push({
          id: `insight-spike-${pattern.id}`,
          type: 'spending_spike',
          title: `Unusual Spending in ${pattern.category}`,
          description: pattern.description,
          severity: pattern.confidence > 0.8 ? 'high' : 'medium',
          category: pattern.category,
          merchant: pattern.merchant,
          amount: pattern.amount,
          transactions: pattern.transactions,
          actionRequired: false,
          createdAt: now
        });
      });
    
    // Check for rapid spending velocity
    const velocity = this.calculateSpendingVelocity(transactions);
    if (velocity.isAccelerating) {
      insights.push({
        id: `insight-velocity-${Date.now()}`,
        type: 'spending_spike',
        title: 'Spending Acceleration Detected',
        description: `Your spending has increased ${velocity.percentageIncrease.toFixed(1)}% compared to last month`,
        severity: 'high',
        actionRequired: true,
        createdAt: now
      });
    }
    
    return insights;
  }

  /**
   * Generate merchant-related insights
   */
  private generateMerchantInsights(transactions: Transaction[]): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    const now = new Date();
    const recentDays = 7;
    
    // Find new merchants
    const recentTransactions = transactions.filter(t => 
      this.isRecent(new Date(t.date), recentDays)
    );
    
    const merchantCounts = new Map<string, number>();
    transactions.forEach(t => {
      const merchant = this.extractMerchant(t.description);
      merchantCounts.set(merchant, (merchantCounts.get(merchant) || 0) + 1);
    });
    
    recentTransactions.forEach(txn => {
      const merchant = this.extractMerchant(txn.description);
      const count = merchantCounts.get(merchant) || 0;
      
      if (count === 1) { // First time at this merchant
        insights.push({
          id: `insight-new-merchant-${txn.id}`,
          type: 'new_merchant',
          title: `New Merchant: ${merchant}`,
          description: `First purchase at ${merchant} for ${this.formatAmount(txn.amount)}`,
          severity: 'low',
          category: txn.category,
          merchant,
          amount: Math.abs(txn.amount),
          date: new Date(txn.date),
          actionRequired: false,
          createdAt: now
        });
      }
    });
    
    return insights;
  }

  /**
   * Generate category trend insights
   */
  private generateCategoryInsights(patterns: SpendingPattern[]): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    const now = new Date();
    
    patterns
      .filter(p => p.patternType === 'trend' && p.isActive)
      .forEach(pattern => {
        const direction = pattern.frequency; // Using frequency field for trend direction
        
        if (direction === 'increasing' && pattern.variance > 0.2) {
          insights.push({
            id: `insight-trend-${pattern.id}`,
            type: 'category_trend',
            title: `Rising Costs in ${pattern.category}`,
            description: `Your ${pattern.category} spending is trending upward by ${(pattern.variance * 100).toFixed(1)}%`,
            severity: pattern.variance > 0.3 ? 'high' : 'medium',
            category: pattern.category,
            actionRequired: true,
            createdAt: now
          });
        }
      });
    
    return insights;
  }

  /**
   * Generate duplicate transaction insights
   */
  private generateDuplicateInsights(transactions: Transaction[]): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    const now = new Date();
    const recentDays = 7;
    
    const recent = transactions.filter(t => 
      this.isRecent(new Date(t.date), recentDays)
    );
    
    // Check for potential duplicates
    for (let i = 0; i < recent.length; i++) {
      for (let j = i + 1; j < recent.length; j++) {
        if (this.isPotentialDuplicate(recent[i], recent[j])) {
          insights.push({
            id: `insight-duplicate-${recent[i].id}-${recent[j].id}`,
            type: 'duplicate_transaction',
            title: 'Potential Duplicate Transaction',
            description: `Two similar transactions for ${this.formatAmount(recent[i].amount)} on ${new Date(recent[i].date).toLocaleDateString()}`,
            severity: 'medium',
            category: recent[i].category,
            merchant: this.extractMerchant(recent[i].description),
            amount: Math.abs(recent[i].amount),
            transactions: [recent[i].id, recent[j].id],
            actionRequired: true,
            createdAt: now
          });
        }
      }
    }
    
    return insights;
  }

  /**
   * Helper methods
   */
  private getLastUsageDate(merchant: string, transactions: Transaction[]): Date | null {
    // For subscriptions, we'd need to check actual usage patterns
    // This is simplified - just check last transaction
    const relevantTxns = transactions.filter(t => 
      t.description.toLowerCase().includes(merchant.toLowerCase())
    );
    
    if (relevantTxns.length === 0) return null;
    
    const sorted = relevantTxns.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return new Date(sorted[0].date);
  }

  private detectPriceIncrease(
    subscription: Subscription,
    transactions: Transaction[]
  ): { oldAmount: number; newAmount: number } | null {
    const relevantTxns = transactions
      .filter(t => 
        t.description.toLowerCase().includes(subscription.merchantName.toLowerCase())
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (relevantTxns.length < 2) return null;
    
    const recent = relevantTxns[relevantTxns.length - 1];
    const previous = relevantTxns[relevantTxns.length - 2];
    
    const recentAmount = Math.abs(recent.amount);
    const previousAmount = Math.abs(previous.amount);
    
    if (recentAmount > previousAmount * 1.05) { // 5% increase threshold
      return {
        oldAmount: previousAmount,
        newAmount: recentAmount
      };
    }
    
    return null;
  }

  private calculateSpendingVelocity(transactions: Transaction[]) {
    const now = new Date();
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const thisYear = now.getFullYear();
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    
    const thisMonthTxns = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === thisMonth && 
             date.getFullYear() === thisYear &&
             t.type === 'expense';
    });
    
    const lastMonthTxns = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === lastMonth && 
             date.getFullYear() === lastMonthYear &&
             t.type === 'expense';
    });
    
    const thisMonthTotal = thisMonthTxns.reduce((sum, t) => 
      sum + Math.abs(t.amount), 0
    );
    
    const lastMonthTotal = lastMonthTxns.reduce((sum, t) => 
      sum + Math.abs(t.amount), 0
    );
    
    const percentageIncrease = lastMonthTotal > 0 ? 
      ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 
      0;
    
    return {
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthTotal,
      percentageIncrease,
      isAccelerating: percentageIncrease > 20 // 20% threshold
    };
  }

  private isPotentialDuplicate(txn1: Transaction, txn2: Transaction): boolean {
    // Same day, same amount, similar description
    const sameDay = new Date(txn1.date).toDateString() === new Date(txn2.date).toDateString();
    const sameAmount = Math.abs(txn1.amount) === Math.abs(txn2.amount);
    const similarDescription = this.extractMerchant(txn1.description) === 
                              this.extractMerchant(txn2.description);
    
    return sameDay && sameAmount && similarDescription;
  }

  private isRecent(date: Date, days: number): boolean {
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= days;
  }

  private extractMerchant(description: string): string {
    return description
      .replace(/\*\d+/, '')
      .replace(/#\d+/, '')
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .trim();
  }

  private formatAmount(amount: number): string {
    return new Decimal(amount).toFixed(2);
  }

  private updateInsights(newInsights: SpendingInsight[]): void {
    // Remove old insights (older than 30 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    this.insights = this.insights.filter(i => 
      i.createdAt > cutoffDate
    );
    
    // Add new insights (avoid duplicates)
    newInsights.forEach(insight => {
      const existing = this.insights.find(i => i.id === insight.id);
      if (!existing) {
        this.insights.push(insight);
      }
    });
    
    this.saveInsights();
  }

  /**
   * Get active insights
   */
  getActiveInsights(): SpendingInsight[] {
    // Return recent insights
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Last 7 days
    
    return this.insights
      .filter(i => i.createdAt > cutoffDate)
      .sort((a, b) => {
        // Sort by severity and date
        const severityOrder = { high: 0, medium: 1, low: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  /**
   * Dismiss insight
   */
  dismissInsight(id: string): void {
    this.insights = this.insights.filter(i => i.id !== id);
    this.saveInsights();
  }
}

export const insightEngine = new InsightEngine();