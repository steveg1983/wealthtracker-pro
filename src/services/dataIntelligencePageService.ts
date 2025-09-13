import { dataIntelligenceService } from './dataIntelligenceService';
import { logger } from './loggingService';
import type { Transaction } from '../types';
import type { DataIntelligenceStats, SpendingInsight, Subscription } from './dataIntelligenceService';

export type ActiveTab = 'overview' | 'subscriptions' | 'merchants' | 'patterns' | 'insights' | 'verification';

export interface TabConfig {
  id: ActiveTab;
  label: string;
  icon: string;
  showBadge?: boolean;
}

export interface SubscriptionWithDays extends Subscription {
  daysUntilRenewal: number;
}

class DataIntelligencePageService {
  getTabConfigs(insightsCount: number): TabConfig[] {
    return [
      { id: 'overview', label: 'Overview', icon: 'BarChart3Icon' },
      { id: 'subscriptions', label: 'Subscriptions', icon: 'CreditCardIcon' },
      { id: 'merchants', label: 'Merchants', icon: 'SearchIcon' },
      { id: 'patterns', label: 'Patterns', icon: 'TrendingUpIcon' },
      { id: 'insights', label: 'Insights', icon: 'BellIcon', showBadge: insightsCount > 0 },
      { id: 'verification', label: 'Verification', icon: 'ShieldIcon' }
    ];
  }

  async loadInitialData(): Promise<{
    stats: DataIntelligenceStats;
    insights: SpendingInsight[];
    subscriptions: Subscription[];
  }> {
    try {
      return {
        stats: dataIntelligenceService.getStats(),
        insights: dataIntelligenceService.getInsights(),
        subscriptions: dataIntelligenceService.getSubscriptions()
      };
    } catch (error) {
      logger.error('Error loading data intelligence data:', error);
      throw error;
    }
  }

  async analyzeTransactions(transactions: Transaction[]): Promise<{
    detectedSubscriptions: Subscription[];
    insights: SpendingInsight[];
    stats: DataIntelligenceStats;
  }> {
    if (!transactions || transactions.length === 0) {
      return {
        detectedSubscriptions: [],
        insights: [],
        stats: dataIntelligenceService.getStats()
      };
    }

    try {
      // Learn from actual transactions
      transactions.forEach(transaction => {
        dataIntelligenceService.learnMerchantFromTransaction(transaction);
      });
      
      // Detect subscriptions from real transactions
      const detectedSubscriptions = dataIntelligenceService.detectSubscriptions(transactions);
      
      // Analyze spending patterns
      dataIntelligenceService.analyzeSpendingPatterns(transactions);
      
      // Generate insights
      const insights = dataIntelligenceService.generateInsights(transactions);
      
      // Get updated stats
      const stats = dataIntelligenceService.getStats();

      return {
        detectedSubscriptions,
        insights,
        stats
      };
    } catch (error) {
      logger.error('Error analyzing transactions:', error);
      throw error;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getInsightSeverityColor(severity: SpendingInsight['severity']): string {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  }

  getInsightIconData(type: SpendingInsight['type']): { icon: string; className: string } {
    switch (type) {
      case 'subscription_alert':
        return { icon: 'CreditCardIcon', className: 'text-gray-600 dark:text-gray-500' };
      case 'spending_spike':
        return { icon: 'TrendingUpIcon', className: 'text-red-600 dark:text-red-400' };
      case 'new_merchant':
        return { icon: 'SearchIcon', className: 'text-green-600 dark:text-green-400' };
      case 'category_trend':
        return { icon: 'BarChart3Icon', className: 'text-purple-600 dark:text-purple-400' };
      case 'duplicate_transaction':
        return { icon: 'AlertCircleIcon', className: 'text-orange-600 dark:text-orange-400' };
      default:
        return { icon: 'BellIcon', className: 'text-gray-600 dark:text-gray-400' };
    }
  }

  calculateDaysUntilRenewal(nextPaymentDate: Date): number {
    return Math.ceil(
      (nextPaymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }

  getRenewalStatusColor(daysUntilRenewal: number): string {
    if (daysUntilRenewal <= 3) return 'bg-red-500';
    if (daysUntilRenewal <= 7) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  processSubscriptionsForDisplay(
    subscriptions: Subscription[],
    detectedSubscriptions: Subscription[]
  ): SubscriptionWithDays[] {
    return [...subscriptions, ...detectedSubscriptions].map(subscription => ({
      ...subscription,
      daysUntilRenewal: this.calculateDaysUntilRenewal(subscription.nextPaymentDate)
    }));
  }

  getActiveSubscriptionsCount(
    subscriptions: Subscription[],
    detectedSubscriptions: Subscription[]
  ): number {
    return subscriptions.length + detectedSubscriptions.length;
  }

  getMonthlyCost(stats: DataIntelligenceStats): string | null {
    if (stats.monthlySubscriptionCost > 0) {
      return this.formatCurrency(stats.monthlySubscriptionCost);
    }
    return null;
  }

  hasTransactions(transactions: Transaction[]): boolean {
    return transactions && transactions.length > 0;
  }

  getEmptyStateMessage(): string {
    return 'Add some transactions to start analyzing your spending patterns, detecting subscriptions, and gaining insights.';
  }

  getTabClassName(isActive: boolean): string {
    return `py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
      isActive
        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
    }`;
  }
}

export const dataIntelligencePageService = new DataIntelligencePageService();