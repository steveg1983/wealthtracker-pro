import type { Transaction, Category } from '../../types';
import { merchantEnricher } from './merchantEnricher';
import { subscriptionDetector } from './subscriptionDetector';
import { patternAnalyzer } from './patternAnalyzer';
import { smartCategorizer } from './smartCategorizer';
import { insightEngine } from './insightEngine';
import type {
  MerchantData,
  MerchantEnrichment,
  Subscription,
  SpendingPattern,
  SpendingInsight,
  SmartCategory,
  PatternDetectionOptions,
  EnrichmentOptions
} from './types';

/**
 * Data Intelligence Service
 * Orchestrates AI-powered financial data analysis
 */
class DataIntelligenceService {
  /**
   * Initialize the service
   */
  initialize(): void {
    // Services auto-initialize on construction
    // This method is for explicit initialization if needed
  }

  /**
   * Enrich merchant information
   */
  enrichMerchant(transactionDescription: string): MerchantEnrichment {
    return merchantEnricher.enrichMerchant(transactionDescription);
  }

  /**
   * Learn from transaction
   */
  learnMerchantFromTransaction(transaction: Transaction): MerchantData | null {
    return merchantEnricher.learnMerchantFromTransaction(transaction);
  }

  /**
   * Detect subscriptions
   */
  detectSubscriptions(transactions: Transaction[]): Subscription[] {
    return subscriptionDetector.detectSubscriptions(transactions);
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): Subscription[] {
    return subscriptionDetector.getActiveSubscriptions();
  }

  /**
   * Calculate monthly subscription cost
   */
  calculateMonthlySubscriptionCost() {
    return subscriptionDetector.calculateMonthlyCost();
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(id: string): void {
    subscriptionDetector.cancelSubscription(id);
  }

  /**
   * Detect spending patterns
   */
  detectPatterns(
    transactions: Transaction[],
    options?: PatternDetectionOptions
  ): SpendingPattern[] {
    return patternAnalyzer.detectPatterns(transactions, options);
  }

  /**
   * Get active patterns
   */
  getActivePatterns(): SpendingPattern[] {
    return patternAnalyzer.getActivePatterns();
  }

  /**
   * Suggest category for transaction
   */
  suggestCategory(transaction: Transaction): { category: string; confidence: number } | null {
    return smartCategorizer.suggestCategory(transaction);
  }

  /**
   * Train categorizer from feedback
   */
  trainCategorizer(
    transaction: Transaction,
    actualCategory: string,
    wasCorrect: boolean
  ): void {
    smartCategorizer.trainFromFeedback(transaction, actualCategory, wasCorrect);
  }

  /**
   * Get smart categories
   */
  getSmartCategories(): SmartCategory[] {
    return smartCategorizer.getCategories();
  }

  /**
   * Generate insights
   */
  generateInsights(transactions: Transaction[]): SpendingInsight[] {
    const subscriptions = this.detectSubscriptions(transactions);
    const patterns = this.detectPatterns(transactions);
    
    return insightEngine.generateInsights(
      transactions,
      subscriptions,
      patterns
    );
  }

  /**
   * Get active insights
   */
  getActiveInsights(): SpendingInsight[] {
    return insightEngine.getActiveInsights();
  }

  /**
   * Dismiss insight
   */
  dismissInsight(id: string): void {
    insightEngine.dismissInsight(id);
  }

  /**
   * Perform comprehensive analysis
   */
  performComprehensiveAnalysis(transactions: Transaction[]) {
    const merchants = transactions.map(t => this.enrichMerchant(t.description));
    const subscriptions = this.detectSubscriptions(transactions);
    const patterns = this.detectPatterns(transactions);
    const insights = this.generateInsights(transactions);
    
    return {
      merchants,
      subscriptions,
      patterns,
      insights,
      monthlySubscriptionCost: this.calculateMonthlySubscriptionCost(),
      activeSubscriptions: this.getActiveSubscriptions().length,
      detectedPatterns: patterns.length,
      generatedInsights: insights.length
    };
  }

  /**
   * Export data for backup
   */
  exportData() {
    return {
      merchants: merchantEnricher.getMerchants(),
      subscriptions: subscriptionDetector.getSubscriptions(),
      patterns: patternAnalyzer.getPatterns(),
      categories: smartCategorizer.getCategories(),
      insights: insightEngine.getActiveInsights()
    };
  }

  // Expose sub-services for direct access if needed
  merchants = merchantEnricher;
  subscriptions = subscriptionDetector;
  patterns = patternAnalyzer;
  categorizer = smartCategorizer;
  insights = insightEngine;
}

export const dataIntelligenceService = new DataIntelligenceService();