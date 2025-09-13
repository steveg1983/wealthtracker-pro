import { dataIntelligenceService, type SpendingInsight } from './dataIntelligenceService';

export class DataInsightsService {
  /**
   * Get icon configuration for insight type
   */
  static getInsightIconConfig(type: SpendingInsight['type']) {
    const configs = {
      'subscription_alert': { icon: 'CreditCard', color: 'text-gray-600 dark:text-gray-500' },
      'spending_spike': { icon: 'TrendingUp', color: 'text-red-600 dark:text-red-400' },
      'new_merchant': { icon: 'Search', color: 'text-green-600 dark:text-green-400' },
      'category_trend': { icon: 'BarChart3', color: 'text-purple-600 dark:text-purple-400' },
      'duplicate_transaction': { icon: 'AlertCircle', color: 'text-orange-600 dark:text-orange-400' }
    };
    return configs[type] || { icon: 'Bell', color: 'text-gray-600 dark:text-gray-400' };
  }

  /**
   * Get severity styling
   */
  static getSeverityStyles(severity: SpendingInsight['severity']) {
    const styles = {
      high: {
        background: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
        border: 'border-l-red-500',
        badge: 'bg-red-500 text-white'
      },
      medium: {
        background: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
        border: 'border-l-yellow-500',
        badge: 'bg-yellow-500 text-white'
      },
      low: {
        background: 'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200',
        border: 'border-l-blue-500',
        badge: 'bg-blue-500 text-white'
      }
    };
    return styles[severity] || styles.low;
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format time for display
   */
  static formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Get relative time
   */
  static getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return this.formatDate(date);
  }

  /**
   * Filter insights
   */
  static filterInsights(
    insights: SpendingInsight[],
    filter: 'all' | 'high' | 'medium' | 'low',
    typeFilter: string,
    showDismissed: boolean
  ): SpendingInsight[] {
    let filtered = [...insights];

    // Filter by severity
    if (filter !== 'all') {
      filtered = filtered.filter(i => i.severity === filter);
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(i => i.type === typeFilter);
    }

    // Filter dismissed
    if (!showDismissed) {
      filtered = filtered.filter(i => !i.dismissed);
    }

    return filtered;
  }

  /**
   * Sort insights
   */
  static sortInsights(
    insights: SpendingInsight[],
    sortBy: 'createdAt' | 'severity' | 'category'
  ): SpendingInsight[] {
    const sorted = [...insights];
    
    switch (sortBy) {
      case 'createdAt':
        return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      case 'severity':
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return sorted.sort((a, b) => 
          severityOrder[a.severity] - severityOrder[b.severity]
        );
      
      case 'category':
        return sorted.sort((a, b) => 
          (a.category || '').localeCompare(b.category || '')
        );
      
      default:
        return sorted;
    }
  }

  /**
   * Group insights by date
   */
  static groupInsightsByDate(insights: SpendingInsight[]) {
    const groups: Record<string, SpendingInsight[]> = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    insights.forEach(insight => {
      const date = insight.createdAt;
      let key: string;

      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = this.formatDate(date);
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(insight);
    });

    return groups;
  }

  /**
   * Get insight type labels
   */
  static getInsightTypeLabel(type: SpendingInsight['type']): string {
    const labels = {
      'subscription_alert': 'Subscription',
      'spending_spike': 'Spending Spike',
      'new_merchant': 'New Merchant',
      'category_trend': 'Category Trend',
      'duplicate_transaction': 'Duplicate'
    };
    return labels[type] || 'Other';
  }

  /**
   * Get available insight types
   */
  static getAvailableTypes(): Array<{ value: string; label: string }> {
    return [
      { value: 'all', label: 'All Types' },
      { value: 'subscription_alert', label: 'Subscriptions' },
      { value: 'spending_spike', label: 'Spending Spikes' },
      { value: 'new_merchant', label: 'New Merchants' },
      { value: 'category_trend', label: 'Category Trends' },
      { value: 'duplicate_transaction', label: 'Duplicates' }
    ];
  }

  /**
   * Get stats from insights
   */
  static getInsightStats(insights: SpendingInsight[]) {
    const active = insights.filter(i => !i.dismissed);
    const high = active.filter(i => i.severity === 'high');
    const medium = active.filter(i => i.severity === 'medium');
    const low = active.filter(i => i.severity === 'low');

    return {
      total: insights.length,
      active: active.length,
      dismissed: insights.length - active.length,
      high: high.length,
      medium: medium.length,
      low: low.length
    };
  }
}