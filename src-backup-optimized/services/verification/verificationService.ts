/**
 * Verification Service
 * World-class system verification with enterprise-grade monitoring
 * Implements patterns from AWS CloudWatch and DataDog
 */

import { dataIntelligenceService } from '../dataIntelligenceService';
import type { Transaction } from '../../types';

interface VerificationResult {
  component: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface VerificationStats {
  successCount: number;
  warningCount: number;
  errorCount: number;
  total: number;
}

interface DateRange {
  min: Date;
  max: Date;
  formatted: string;
}

/**
 * Enterprise-grade verification service with institutional monitoring
 */
class VerificationService {
  /**
   * Run comprehensive system verification
   */
  async runVerification(transactions: Transaction[]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    try {
      // Core data verification
      results.push(this.verifyTransactionData(transactions));
      
      if (transactions.length > 0) {
        results.push(...await this.verifyIntelligenceComponents(transactions));
      }
      
      // System health checks
      results.push(await this.verifyDataPersistence());
      
    } catch (error) {
      results.push({
        component: 'System Health',
        status: 'error',
        message: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  /**
   * Verify transaction data availability
   */
  private verifyTransactionData(transactions: Transaction[]): VerificationResult {
    if (!transactions || transactions.length === 0) {
      return {
        component: 'Transaction Data',
        status: 'warning',
        message: 'No transactions available',
        details: 'Add transactions to enable full data intelligence features'
      };
    }

    const dateRange = this.getDateRange(transactions);
    return {
      component: 'Transaction Data',
      status: 'success',
      message: `${transactions.length} transactions loaded`,
      details: `Data spans from ${dateRange.formatted}`
    };
  }

  /**
   * Verify all intelligence components
   */
  private async verifyIntelligenceComponents(transactions: Transaction[]): Promise<VerificationResult[]> {
    return [
      await this.verifyMerchantLearning(),
      this.verifySubscriptionDetection(transactions),
      this.verifySpendingPatterns(transactions),
      this.verifyInsightsGeneration(transactions),
      this.verifySmartCategories()
    ];
  }

  /**
   * Verify merchant learning system
   */
  private async verifyMerchantLearning(): Promise<VerificationResult> {
    try {
      const merchants = dataIntelligenceService.getMerchantData();
      
      if (merchants.length === 0) {
        return {
          component: 'Merchant Learning',
          status: 'warning',
          message: 'No merchants learned yet',
          details: 'System will learn from your transactions automatically'
        };
      }

      const avgConfidence = this.calculateAverageConfidence(merchants);
      return {
        component: 'Merchant Learning',
        status: 'success',
        message: `${merchants.length} merchants identified`,
        details: `Average confidence: ${avgConfidence}%`
      };
    } catch (error) {
      return {
        component: 'Merchant Learning',
        status: 'error',
        message: 'Merchant learning failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify subscription detection
   */
  private verifySubscriptionDetection(transactions: Transaction[]): VerificationResult {
    try {
      const subscriptions = dataIntelligenceService.detectSubscriptions(transactions);
      
      if (subscriptions.length === 0) {
        return {
          component: 'Subscription Detection',
          status: 'warning',
          message: 'No subscriptions detected',
          details: 'Add more transaction history for better detection'
        };
      }

      const monthlyTotal = this.calculateMonthlySubscriptionTotal(subscriptions);
      return {
        component: 'Subscription Detection',
        status: 'success',
        message: `${subscriptions.length} subscriptions found`,
        details: `Monthly total: $${monthlyTotal.toFixed(2)}`
      };
    } catch (error) {
      return {
        component: 'Subscription Detection',
        status: 'error',
        message: 'Subscription detection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify spending patterns analysis
   */
  private verifySpendingPatterns(transactions: Transaction[]): VerificationResult {
    try {
      const patterns = dataIntelligenceService.analyzeSpendingPatterns(transactions);
      
      if (patterns.length === 0) {
        return {
          component: 'Spending Patterns',
          status: 'warning',
          message: 'No patterns detected',
          details: 'Need at least 3 months of data for pattern detection'
        };
      }

      const activePatterns = patterns.filter(p => p.isActive).length;
      return {
        component: 'Spending Patterns',
        status: 'success',
        message: `${patterns.length} patterns identified`,
        details: `${activePatterns} active patterns`
      };
    } catch (error) {
      return {
        component: 'Spending Patterns',
        status: 'error',
        message: 'Pattern analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify insights generation
   */
  private verifyInsightsGeneration(transactions: Transaction[]): VerificationResult {
    try {
      const insights = dataIntelligenceService.generateInsights(transactions);
      
      if (insights.length === 0) {
        return {
          component: 'Insights Generation',
          status: 'warning',
          message: 'No insights generated',
          details: 'More transaction data needed for meaningful insights'
        };
      }

      const highPriority = insights.filter(i => i.severity === 'high').length;
      return {
        component: 'Insights Generation',
        status: 'success',
        message: `${insights.length} insights generated`,
        details: highPriority > 0 ? `${highPriority} high priority` : 'All insights reviewed'
      };
    } catch (error) {
      return {
        component: 'Insights Generation',
        status: 'error',
        message: 'Insights generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify smart categories
   */
  private verifySmartCategories(): VerificationResult {
    try {
      const categories = dataIntelligenceService.getSmartCategories();
      
      if (categories.length === 0) {
        return {
          component: 'Smart Categories',
          status: 'warning',
          message: 'No smart categories',
          details: 'System will create categories as it learns'
        };
      }

      return {
        component: 'Smart Categories',
        status: 'success',
        message: `${categories.length} smart categories`,
        details: 'Auto-categorization active'
      };
    } catch (error) {
      return {
        component: 'Smart Categories',
        status: 'error',
        message: 'Smart categories failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify data persistence
   */
  private async verifyDataPersistence(): Promise<VerificationResult> {
    try {
      const stats = dataIntelligenceService.getStats();
      return {
        component: 'Data Persistence',
        status: 'success',
        message: 'Data storage working',
        details: `Last updated: ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}`
      };
    } catch (error) {
      return {
        component: 'Data Persistence',
        status: 'error',
        message: 'Storage error',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate verification statistics
   */
  getVerificationStats(results: VerificationResult[]): VerificationStats {
    return {
      successCount: results.filter(r => r.status === 'success').length,
      warningCount: results.filter(r => r.status === 'warning').length,
      errorCount: results.filter(r => r.status === 'error').length,
      total: results.length
    };
  }

  /**
   * Get date range from transactions
   */
  private getDateRange(transactions: Transaction[]): DateRange {
    if (transactions.length === 0) {
      const now = new Date();
      return { min: now, max: now, formatted: 'No data' };
    }

    const dates = transactions.map(t => new Date(t.date).getTime());
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    
    return {
      min,
      max,
      formatted: `${min.toLocaleDateString()} to ${max.toLocaleDateString()}`
    };
  }

  /**
   * Calculate average confidence for merchants
   */
  private calculateAverageConfidence(merchants: any[]): number {
    if (merchants.length === 0) return 0;
    const sum = merchants.reduce((acc, m) => acc + (m.confidence || 0), 0);
    return Math.round((sum / merchants.length) * 100);
  }

  /**
   * Calculate monthly subscription total
   */
  private calculateMonthlySubscriptionTotal(subscriptions: any[]): number {
    return subscriptions
      .filter(s => s.frequency === 'monthly')
      .reduce((sum, s) => sum + s.amount, 0);
  }

  /**
   * Get recommendations based on verification results
   */
  getRecommendations(
    results: VerificationResult[], 
    transactions: Transaction[]
  ): string[] {
    const recommendations: string[] = [];
    const stats = this.getVerificationStats(results);

    if (!transactions || transactions.length === 0) {
      recommendations.push('Import or add transactions to enable data intelligence features');
    }

    if (transactions && transactions.length < 100) {
      recommendations.push('Add more transaction history for better pattern detection');
    }

    if (stats.warningCount > 2) {
      recommendations.push('Continue using the app to improve data intelligence accuracy');
    }

    if (stats.errorCount > 0) {
      recommendations.push('Check browser console for detailed error information');
    }

    return recommendations;
  }
}

export const verificationService = new VerificationService();
export type { VerificationResult, VerificationStats };