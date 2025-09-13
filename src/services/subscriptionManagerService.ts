/**
 * Subscription Manager Service
 * Handles business logic for subscription management
 */

import { dataIntelligenceService } from './dataIntelligenceService';
import type { Subscription } from './dataIntelligenceService';
import { logger } from './loggingService';

export interface SubscriptionStats {
  activeCount: number;
  monthlyCost: number;
  dueSoonCount: number;
  cancelledCount: number;
}

export type FilterOption = 'all' | 'active' | 'cancelled' | 'trial' | 'paused';
export type SortOption = 'nextPayment' | 'amount' | 'merchant';

class SubscriptionManagerService {
  /**
   * Load all subscriptions
   */
  loadSubscriptions(): Subscription[] {
    try {
      return dataIntelligenceService.getSubscriptions();
    } catch (error) {
      logger.error('Error loading subscriptions:', error);
      return [];
    }
  }

  /**
   * Add a new subscription
   */
  addSubscription(
    subscription: Omit<Subscription, 'id' | 'createdAt' | 'lastUpdated'>
  ): void {
    dataIntelligenceService.addSubscription(subscription);
  }

  /**
   * Update an existing subscription
   */
  updateSubscription(id: string, updates: Partial<Subscription>): void {
    dataIntelligenceService.updateSubscription(id, updates);
  }

  /**
   * Delete a subscription
   */
  deleteSubscription(id: string): void {
    dataIntelligenceService.deleteSubscription(id);
  }

  /**
   * Filter and sort subscriptions
   */
  filterAndSortSubscriptions(
    subscriptions: Subscription[],
    filter: FilterOption,
    sortBy: SortOption
  ): Subscription[] {
    const filtered = filter === 'all' 
      ? subscriptions 
      : subscriptions.filter(sub => sub.status === filter);

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'nextPayment':
          return a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime();
        case 'amount':
          return b.amount - a.amount;
        case 'merchant':
          return a.merchantName.localeCompare(b.merchantName);
        default:
          return 0;
      }
    });
  }

  /**
   * Calculate subscription statistics
   */
  calculateStats(subscriptions: Subscription[]): SubscriptionStats {
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    
    const monthlyCost = activeSubscriptions.reduce((sum, sub) => {
      const monthlyAmount = this.calculateMonthlyAmount(sub);
      return sum + monthlyAmount;
    }, 0);

    const dueSoonCount = activeSubscriptions.filter(
      s => this.getDaysUntilRenewal(s.nextPaymentDate) <= 7
    ).length;

    return {
      activeCount: activeSubscriptions.length,
      monthlyCost,
      dueSoonCount,
      cancelledCount: subscriptions.filter(s => s.status === 'cancelled').length
    };
  }

  /**
   * Calculate monthly equivalent amount
   */
  calculateMonthlyAmount(subscription: Subscription): number {
    switch (subscription.frequency) {
      case 'monthly':
        return subscription.amount;
      case 'yearly':
        return subscription.amount / 12;
      case 'quarterly':
        return subscription.amount / 3;
      case 'weekly':
        return subscription.amount * 4.33;
      default:
        return subscription.amount;
    }
  }

  /**
   * Get days until renewal
   */
  getDaysUntilRenewal(date: Date): number {
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Format date
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get status color classes
   */
  getStatusColor(status: Subscription['status']): string {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'trial':
        return 'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  }

  /**
   * Get status icon name
   */
  getStatusIconName(status: Subscription['status']): string {
    switch (status) {
      case 'active':
        return 'CheckCircleIcon';
      case 'cancelled':
        return 'XCircleIcon';
      case 'paused':
        return 'StopIcon';
      case 'trial':
        return 'ClockIcon';
      default:
        return 'AlertCircleIcon';
    }
  }

  /**
   * Get status icon color
   */
  getStatusIconColor(status: Subscription['status']): string {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'cancelled':
        return 'text-red-500';
      case 'paused':
        return 'text-yellow-500';
      case 'trial':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  }

  /**
   * Check if subscription is upcoming
   */
  isUpcoming(subscription: Subscription): boolean {
    const days = this.getDaysUntilRenewal(subscription.nextPaymentDate);
    return days <= 7 && days > 0;
  }

  /**
   * Check if subscription is overdue
   */
  isOverdue(subscription: Subscription): boolean {
    return this.getDaysUntilRenewal(subscription.nextPaymentDate) < 0;
  }

  /**
   * Get renewal status text
   */
  getRenewalStatusText(daysUntilRenewal: number): string {
    if (daysUntilRenewal < 0) {
      return `${Math.abs(daysUntilRenewal)} days overdue`;
    } else if (daysUntilRenewal === 0) {
      return 'Due today';
    } else {
      return `${daysUntilRenewal} days`;
    }
  }

  /**
   * Get renewal status color
   */
  getRenewalStatusColor(subscription: Subscription): string {
    if (this.isOverdue(subscription)) {
      return 'text-red-600 dark:text-red-400';
    } else if (this.isUpcoming(subscription)) {
      return 'text-orange-600 dark:text-orange-400';
    } else {
      return 'text-gray-900 dark:text-white';
    }
  }
}

export const subscriptionManagerService = new SubscriptionManagerService();