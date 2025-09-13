/**
 * Advanced Analytics Component Service
 * Business logic for analytics display and formatting
 */

import type { SpendingAnomaly, SpendingPrediction, SavingsOpportunity, FinancialInsight } from './advancedAnalyticsService';

export type TabType = 'anomalies' | 'predictions' | 'opportunities' | 'insights';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: any;
  count: number;
}

class AdvancedAnalyticsComponentService {
  /**
   * Get severity color class
   */
  getSeverityColor(severity: 'low' | 'medium' | 'high' | 'critical'): string {
    switch (severity) {
      case 'critical':
        return 'text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'text-gray-600 dark:text-gray-500 bg-blue-50 dark:bg-gray-900/20';
    }
  }

  /**
   * Get difficulty color class
   */
  getDifficultyColor(difficulty: 'easy' | 'medium' | 'hard'): string {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'hard':
        return 'text-red-600 dark:text-red-400';
    }
  }

  /**
   * Get confidence color class
   */
  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  /**
   * Get priority badge color
   */
  getPriorityColor(priority: 'low' | 'medium' | 'high'): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'low':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  }

  /**
   * Format confidence percentage
   */
  formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Get impact icon name
   */
  getImpactIconType(impact: 'positive' | 'negative' | 'neutral'): 'check' | 'alert' | 'info' {
    switch (impact) {
      case 'positive':
        return 'check';
      case 'negative':
        return 'alert';
      case 'neutral':
        return 'info';
    }
  }

  /**
   * Sort anomalies by severity and amount
   */
  sortAnomalies(anomalies: SpendingAnomaly[]): SpendingAnomaly[] {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...anomalies].sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return Math.abs(b.percentageAboveNormal) - Math.abs(a.percentageAboveNormal);
    });
  }

  /**
   * Sort predictions by confidence
   */
  sortPredictions(predictions: SpendingPrediction[]): SpendingPrediction[] {
    return [...predictions].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Sort opportunities by potential savings
   */
  sortOpportunities(opportunities: SavingsOpportunity[]): SavingsOpportunity[] {
    return [...opportunities].sort((a, b) => b.potentialSavings.toNumber() - a.potentialSavings.toNumber());
  }

  /**
   * Sort insights by priority
   */
  sortInsights(insights: FinancialInsight[]): FinancialInsight[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...insights].sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Get empty state message
   */
  getEmptyStateMessage(tabType: TabType): {
    title: string;
    description: string;
  } {
    switch (tabType) {
      case 'anomalies':
        return {
          title: 'No anomalies detected',
          description: 'Your spending patterns look normal. Keep up the good work!'
        };
      case 'predictions':
        return {
          title: 'No predictions available',
          description: 'We need more transaction data to make accurate predictions.'
        };
      case 'opportunities':
        return {
          title: 'No opportunities found',
          description: 'Your finances are well optimized. Check back later for new opportunities.'
        };
      case 'insights':
        return {
          title: 'No insights available',
          description: 'Add more transactions to get personalized financial insights.'
        };
    }
  }

  /**
   * Check if data is sufficient for analysis
   */
  hasMinimumData(transactionCount: number): boolean {
    return transactionCount >= 30; // Need at least 30 transactions for meaningful analysis
  }

  /**
   * Get analysis status message
   */
  getAnalysisStatus(isAnalyzing: boolean, hasData: boolean): string {
    if (isAnalyzing) return 'Analyzing your financial data...';
    if (!hasData) return 'Add more transactions to enable advanced analytics';
    return '';
  }
}

export const advancedAnalyticsComponentService = new AdvancedAnalyticsComponentService();