import type { Transaction, Account, Budget } from '../../types';
import { anomalyDetector } from './anomalyDetector';
import { predictionEngine } from './predictionEngine';
import { opportunityFinder } from './opportunityFinder';
import { insightGenerator } from './insightGenerator';
import { billNegotiator } from './billNegotiator';
import type {
  SpendingAnomaly,
  SpendingPrediction,
  SavingsOpportunity,
  FinancialInsight,
  BillNegotiationSuggestion,
  PredictionResult,
  AnalysisOptions
} from './types';

/**
 * Advanced analytics service
 * Orchestrates various analytics modules for comprehensive financial analysis
 */
class AdvancedAnalyticsService {
  /**
   * Detect anomalies in spending patterns
   */
  detectSpendingAnomalies(
    transactions: Transaction[],
    options: AnalysisOptions = {}
  ): SpendingAnomaly[] {
    const lookbackMonths = options.lookbackMonths || 6;
    
    // Get anomalies from detector
    const anomalies = anomalyDetector.detectSpendingAnomalies(
      transactions,
      lookbackMonths
    );
    
    // Add timing anomalies
    const timingAnomalies = anomalyDetector.detectTimingAnomalies(transactions);
    
    return [...anomalies, ...timingAnomalies]
      .sort((a, b) => b.percentageAboveNormal - a.percentageAboveNormal);
  }

  /**
   * Predict future spending patterns
   */
  predictSpending(
    transactions: Transaction[],
    monthsToPredict: number = 3
  ): PredictionResult {
    return predictionEngine.predictSpending(transactions, monthsToPredict);
  }

  /**
   * Predict cash flow
   */
  predictCashFlow(
    transactions: Transaction[],
    startingBalance: number,
    daysToPredict: number = 30
  ): Array<{ date: Date; predictedBalance: number; confidence: number }> {
    return predictionEngine.predictCashFlow(
      transactions,
      startingBalance,
      daysToPredict
    );
  }

  /**
   * Find savings opportunities
   */
  findSavingsOpportunities(transactions: Transaction[]): SavingsOpportunity[] {
    return opportunityFinder.findSavingsOpportunities(transactions);
  }

  /**
   * Generate personalized financial insights
   */
  generateInsights(
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[]
  ): FinancialInsight[] {
    return insightGenerator.generateInsights(transactions, accounts, budgets);
  }

  /**
   * Suggest bills that could be negotiated
   */
  suggestBillNegotiations(transactions: Transaction[]): BillNegotiationSuggestion[] {
    return billNegotiator.suggestBillNegotiations(transactions);
  }

  /**
   * Comprehensive financial analysis
   */
  performComprehensiveAnalysis(
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    options: AnalysisOptions = {}
  ) {
    return {
      anomalies: this.detectSpendingAnomalies(transactions, options),
      predictions: this.predictSpending(transactions),
      opportunities: this.findSavingsOpportunities(transactions),
      insights: this.generateInsights(transactions, accounts, budgets),
      billNegotiations: this.suggestBillNegotiations(transactions),
      cashFlow: this.predictCashFlow(
        transactions,
        accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      )
    };
  }

  // Expose sub-services for direct access if needed
  anomalies = anomalyDetector;
  predictions = predictionEngine;
  opportunities = opportunityFinder;
  insights = insightGenerator;
  bills = billNegotiator;
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();