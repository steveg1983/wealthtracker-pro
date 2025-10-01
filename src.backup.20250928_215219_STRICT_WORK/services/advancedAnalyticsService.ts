import type { Transaction, Account, Budget, Category } from '../types';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { startOfMonth, subMonths, differenceInDays, format } from 'date-fns';
import { TimeSeriesAnalysis } from './timeSeriesAnalysis';
import type { TimeSeriesData, Forecast } from './timeSeriesAnalysis';
import type {
  Subscription,
  CategorySpendingStats,
  DuplicateService,
  MerchantSpendingStats,
  SpendingVelocity,
  SavingsBehavior,
  BudgetPerformance,
  IncomeStability,
  SeasonalPattern,
  RecurringBill
} from '../types/analytics';

export interface SpendingAnomaly {
  id: string;
  date: Date;
  description: string;
  amount: DecimalInstance;
  category: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  percentageAboveNormal: number;
}

export interface SpendingPrediction {
  category: string;
  predictedAmount: DecimalInstance;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  monthlyAverage: DecimalInstance;
  recommendation?: string;
}

export interface SavingsOpportunity {
  id: string;
  type: 'subscription' | 'recurring' | 'category' | 'merchant';
  title: string;
  description: string;
  potentialSavings: DecimalInstance;
  difficulty: 'easy' | 'medium' | 'hard';
  actionRequired: string;
  relatedTransactions?: string[];
}

export interface FinancialInsight {
  id: string;
  type: 'spending' | 'saving' | 'income' | 'budget' | 'goal';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  relatedData?: Record<string, unknown>;
}

export interface BillNegotiationSuggestion {
  merchant: string;
  currentAmount: DecimalInstance;
  potentialSavings: DecimalInstance;
  category: string;
  negotiationTips: string[];
  successRate: number;
  lastTransactionDate: Date;
}

class AdvancedAnalyticsService {
  /**
   * Detect anomalies in spending patterns
   */
  detectSpendingAnomalies(
    transactions: Transaction[],
    lookbackMonths: number = 6
  ): SpendingAnomaly[] {
    const anomalies: SpendingAnomaly[] = [];
    const today = new Date();
    const lookbackDate = subMonths(today, lookbackMonths);
    
    // Filter to expense transactions in the lookback period
    const expenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date) >= lookbackDate
    );
    
    // Group by category
    const categoryStats = this.calculateCategoryStatistics(expenses);
    
    // Check recent transactions for anomalies
    const recentDate = subMonths(today, 1);
    const recentTransactions = expenses.filter(t => new Date(t.date) >= recentDate);
    
    recentTransactions.forEach(transaction => {
      const stats = categoryStats.get(transaction.category || 'Uncategorized');
      if (!stats || stats.count < 3) return; // Skip if insufficient data
      
      const amount = toDecimal(Math.abs(transaction.amount)); // Use absolute value for consistency
      const zScore = stats.stdDev.greaterThan(0) 
        ? amount.minus(stats.mean).dividedBy(stats.stdDev).toNumber()
        : 0;
      
      // Adjust z-score thresholds based on sample size for better statistical validity
      const getThreshold = (sampleSize: number) => {
        if (sampleSize < 5) return 3.0;   // More conservative with small samples
        if (sampleSize < 10) return 2.5;  // Moderate threshold
        if (sampleSize < 20) return 2.0;  // Standard threshold
        return 1.8;                       // More sensitive with large samples
      };
      
      const threshold = getThreshold(stats.count);
      
      // Detect anomalies based on adjusted z-score thresholds
      if (Math.abs(zScore) > threshold && amount.greaterThan(stats.mean)) {
        const percentageAbove = stats.mean.greaterThan(0)
          ? amount.minus(stats.mean).dividedBy(stats.mean).times(100).toNumber()
          : 0;
        
        // Additional validation: ensure the anomaly is significant in absolute terms
        const minimumAnomalyAmount = toDecimal(20); // Minimum $20 to be considered anomalous
        if (amount.greaterThan(stats.mean.plus(minimumAnomalyAmount))) {
          anomalies.push({
            id: `anomaly-${transaction.id}`,
            date: new Date(transaction.date),
            description: transaction.description,
            amount,
            category: transaction.category || 'Uncategorized',
            severity: this.determineSeverity(zScore, percentageAbove, amount.toNumber()),
            reason: this.getAnomalyReason(transaction, stats, zScore),
            percentageAboveNormal: Math.round(Math.max(0, percentageAbove))
          });
        }
      }
    });
    
    return anomalies.sort((a, b) => b.severity.localeCompare(a.severity));
  }

  /**
   * Predict future spending based on historical patterns
   */
  predictFutureSpending(
    transactions: Transaction[],
    categories: Category[],
    monthsToPredict: number = 1
  ): SpendingPrediction[] {
    const predictions: SpendingPrediction[] = [];
    const today = new Date();
    const historicalMonths = 6;
    const historicalDate = subMonths(today, historicalMonths);
    
    // Filter to historical expense transactions
    const historicalExpenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date) >= historicalDate &&
      new Date(t.date) < today
    );
    
    // Group by category and analyze
    const categoryData = new Map<string, Transaction[]>();
    historicalExpenses.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryData.has(category)) {
        categoryData.set(category, []);
      }
      categoryData.get(category)!.push(t);
    });
    
    categoryData.forEach((transactions, category) => {
      const monthlyTotals = this.calculateMonthlyTotals(transactions);
      const trend = this.detectTrend(monthlyTotals);
      const average = this.calculateAverage(monthlyTotals);
      const prediction = this.makePrediction(monthlyTotals, trend, monthsToPredict);
      
      const recommendation = this.getSpendingRecommendation(category, trend, prediction.amount, average);
      predictions.push({
        category,
        predictedAmount: prediction.amount,
        confidence: prediction.confidence,
        trend,
        monthlyAverage: average,
        ...(recommendation ? { recommendation } : {})
      });
    });
    
    return predictions.sort((a, b) => b.predictedAmount.minus(a.predictedAmount).toNumber());
  }

  /**
   * Identify savings opportunities
   */
  identifySavingsOpportunities(
    transactions: Transaction[],
    accounts: Account[]
  ): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];
    
    // 1. Identify unused subscriptions
    const subscriptions = this.detectSubscriptions(transactions);
    subscriptions.forEach(sub => {
      const unusedMonths = sub.unusedMonths || 0;
      const monthlyAmount = sub.monthlyAmount;
      if (unusedMonths > 2 && monthlyAmount) {
        opportunities.push({
          id: `opp-sub-${sub.merchant}`,
          type: 'subscription',
          title: `Unused Subscription: ${sub.merchant}`,
          description: `You haven't used ${sub.merchant} in ${unusedMonths} months`,
          potentialSavings: monthlyAmount.times(12),
          difficulty: 'easy',
          actionRequired: 'Cancel subscription',
          ...(sub.transactionIds ? { relatedTransactions: sub.transactionIds } : {})
        });
      }
    });
    
    // 2. Identify high spending categories
    const categorySpending = this.analyzeCategorySpending(transactions);
    categorySpending.forEach((data, category) => {
      const percentageOfIncome = data.percentageOfIncome || 0;
      const monthlyAverage = data.monthlyAverage;
      if (data.trend === 'increasing' && percentageOfIncome > 15 && monthlyAverage) {
        opportunities.push({
          id: `opp-cat-${category}`,
          type: 'category',
          title: `Reduce ${category} Spending`,
          description: `Your ${category} spending is ${data.percentageIncrease}% higher than 3 months ago`,
          potentialSavings: monthlyAverage.times(0.2), // 20% reduction
          difficulty: 'medium',
          actionRequired: `Review and reduce ${category} expenses`
        });
      }
    });
    
    // 3. Identify duplicate services
    const duplicates = this.findDuplicateServices(transactions);
    duplicates.forEach(dup => {
      opportunities.push({
        id: `opp-dup-${dup.category}`,
        type: 'recurring',
        title: `Duplicate ${dup.category} Services`,
        description: `You're paying for multiple ${dup.category} services`,
        potentialSavings: dup.potentialSavings,
        difficulty: 'easy',
        actionRequired: 'Consolidate or cancel duplicate services',
        ...(dup.transactionIds && { relatedTransactions: dup.transactionIds })
      });
    });
    
    // 4. Merchant-specific opportunities
    const merchantAnalysis = this.analyzeMerchantSpending(transactions);
    merchantAnalysis.forEach((data, merchant) => {
      const averageTransaction = data.averageTransaction;
      if (averageTransaction && averageTransaction.greaterThan(50) && (data.frequency === 'daily' || data.frequency === 'weekly')) {
        opportunities.push({
          id: `opp-merchant-${merchant}`,
          type: 'merchant',
          title: `Optimize ${merchant} Spending`,
          description: `Consider bulk purchases or membership discounts`,
          potentialSavings: (data.monthlyTotal || toDecimal(0)).times(0.1), // 10% potential savings
          difficulty: 'medium',
          actionRequired: 'Look for discounts or alternative options'
        });
      }
    });
    
    return opportunities.sort((a, b) => b.potentialSavings.minus(a.potentialSavings).toNumber());
  }

  /**
   * Generate personalized financial insights
   */
  generateInsights(
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[]
  ): FinancialInsight[] {
    const insights: FinancialInsight[] = [];
    const today = new Date();
    
    // 1. Spending velocity insight
    const spendingVelocity = this.calculateSpendingVelocity(transactions);
    if (spendingVelocity.isAccelerating) {
      insights.push({
        id: 'insight-velocity',
        type: 'spending',
        title: 'Spending Acceleration Detected',
        description: `Your spending has increased ${spendingVelocity.percentageIncrease}% this month`,
        impact: 'negative',
        priority: 'high',
        actionable: true,
        relatedData: { velocity: spendingVelocity }
      });
    }
    
    // 2. Positive saving behavior
    const savingsBehavior = this.analyzeSavingsBehavior(transactions, accounts);
    if (savingsBehavior.consistentSaving) {
      insights.push({
        id: 'insight-savings',
        type: 'saving',
        title: 'Great Saving Habits!',
        description: `You've consistently saved ${savingsBehavior.averagePercentage}% of your income`,
        impact: 'positive',
        priority: 'medium',
        actionable: false
      });
    }
    
    // 3. Budget performance
    budgets.forEach(budget => {
      const performance = this.analyzeBudgetPerformance(budget, transactions);
      if (performance.consistentlyUnder && performance.averageUsage && performance.averageUsage < 80) {
        insights.push({
          id: `insight-budget-${budget.id}`,
          type: 'budget',
          title: `${budget.name} Budget Opportunity`,
          description: `You consistently use only ${performance.averageUsage}% of this budget. Consider reducing it.`,
          impact: 'neutral',
          priority: 'low',
          actionable: true,
          relatedData: { budgetId: budget.id, performance }
        });
      }
    });
    
    // 4. Income stability
    const incomeAnalysis = this.analyzeIncomeStability(transactions);
    if (incomeAnalysis.isIrregular) {
      insights.push({
        id: 'insight-income',
        type: 'income',
        title: 'Irregular Income Pattern',
        description: 'Your income varies significantly. Consider building a larger emergency fund.',
        impact: 'neutral',
        priority: 'high',
        actionable: true,
        relatedData: { incomeAnalysis }
      });
    }
    
    // 5. Seasonal spending patterns
    const seasonalPatterns = this.detectSeasonalPatterns(transactions);
    seasonalPatterns.forEach(pattern => {
      insights.push({
        id: `insight-seasonal-${pattern.category}`,
        type: 'spending',
        title: `${pattern.category} Seasonal Pattern`,
        description: pattern.description || 'Seasonal spending pattern detected',
        impact: 'neutral',
        priority: 'low',
        actionable: true,
        relatedData: { pattern }
      });
    });
    
    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Suggest bills that could be negotiated
   */
  suggestBillNegotiations(transactions: Transaction[]): BillNegotiationSuggestion[] {
    const suggestions: BillNegotiationSuggestion[] = [];
    const negotiableCategories = [
      'Internet', 'Mobile Phone', 'Insurance', 'Utilities', 
      'Cable/Streaming', 'Gym', 'Subscriptions'
    ];
    
    // Find recurring bills
    const recurringBills = this.findRecurringBills(transactions);
    
    recurringBills.forEach(bill => {
      if (negotiableCategories.includes(bill.category)) {
        const suggestion: BillNegotiationSuggestion = {
          merchant: bill.merchant,
          currentAmount: bill.amount,
          potentialSavings: bill.amount.times(0.2), // Assume 20% potential savings
          category: bill.category,
          negotiationTips: this.getNegotiationTips(bill.category),
          successRate: this.getSuccessRate(bill.category),
          lastTransactionDate: bill.lastDate || new Date()
        };
        
        suggestions.push(suggestion);
      }
    });
    
    return suggestions.sort((a, b) => 
      b.potentialSavings.minus(a.potentialSavings).toNumber()
    );
  }

  // Helper methods
  private calculateCategoryStatistics(transactions: Transaction[]) {
    const categoryGroups = new Map<string, DecimalInstance[]>();
    
    // Group transactions by category and take absolute amounts for consistency
    transactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      // Use absolute value to normalize expense amounts
      categoryGroups.get(category)!.push(toDecimal(Math.abs(t.amount)));
    });
    
    const stats = new Map<string, { mean: DecimalInstance; stdDev: DecimalInstance; count: number }>();
    
    categoryGroups.forEach((amounts, category) => {
      const n = amounts.length;
      
      // Skip categories with insufficient data points
      if (n < 3) {
        stats.set(category, { 
          mean: toDecimal(0), 
          stdDev: toDecimal(0),
          count: n 
        });
        return;
      }
      
      // Calculate basic statistics
      const sum = amounts.reduce((a, b) => a.plus(b), toDecimal(0));
      const mean = sum.dividedBy(n);
      
      // Use sample variance (divide by n-1) for better estimation
      const squaredDiffs = amounts.map(a => a.minus(mean).pow(2));
      const sampleVariance = squaredDiffs.reduce((a, b) => a.plus(b), toDecimal(0))
        .dividedBy(Math.max(1, n - 1)); // Avoid division by zero
      const stdDev = sampleVariance.sqrt();
      
      // Apply robust statistics: remove outliers and recalculate if we have enough data
      if (n >= 10) {
        const robustStats = this.calculateRobustStatistics(amounts);
        stats.set(category, {
          mean: robustStats.mean,
          stdDev: robustStats.stdDev,
          count: robustStats.count
        });
      } else {
        stats.set(category, { mean, stdDev, count: n });
      }
    });
    
    return stats;
  }

  /**
   * Calculate robust statistics by removing outliers using IQR method
   */
  private calculateRobustStatistics(amounts: DecimalInstance[]) {
    // Sort amounts for quartile calculation
    const sorted = [...amounts].sort((a, b) => a.minus(b).toNumber());
    const n = sorted.length;
    
    // Calculate quartiles
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];

    if (!q1 || !q3) {
      // Fallback to basic statistics if quartiles can't be calculated
      const sum = amounts.reduce((a, b) => a.plus(b), toDecimal(0));
      const mean = sum.dividedBy(n);
      const squaredDiffs = amounts.map(a => a.minus(mean).pow(2));
      const variance = squaredDiffs.reduce((a, b) => a.plus(b), toDecimal(0))
        .dividedBy(Math.max(1, n - 1));

      return {
        mean,
        stdDev: variance.sqrt(),
        count: n
      };
    }

    const iqr = q3.minus(q1);
    
    // Define outlier boundaries (1.5 * IQR method)
    const lowerBound = q1.minus(iqr.times(1.5));
    const upperBound = q3.plus(iqr.times(1.5));
    
    // Filter out outliers
    const filtered = sorted.filter(amount => 
      amount.greaterThanOrEqualTo(lowerBound) && 
      amount.lessThanOrEqualTo(upperBound)
    );
    
    // If we filtered out too much data, use original data
    if (filtered.length < n * 0.5) {
      const sum = amounts.reduce((a, b) => a.plus(b), toDecimal(0));
      const mean = sum.dividedBy(n);
      const squaredDiffs = amounts.map(a => a.minus(mean).pow(2));
      const variance = squaredDiffs.reduce((a, b) => a.plus(b), toDecimal(0))
        .dividedBy(Math.max(1, n - 1));
      
      return {
        mean,
        stdDev: variance.sqrt(),
        count: n
      };
    }
    
    // Calculate statistics on filtered data
    const filteredSum = filtered.reduce((a, b) => a.plus(b), toDecimal(0));
    const filteredMean = filteredSum.dividedBy(filtered.length);
    const filteredSquaredDiffs = filtered.map(a => a.minus(filteredMean).pow(2));
    const filteredVariance = filteredSquaredDiffs.reduce((a, b) => a.plus(b), toDecimal(0))
      .dividedBy(Math.max(1, filtered.length - 1));
    
    return {
      mean: filteredMean,
      stdDev: filteredVariance.sqrt(),
      count: filtered.length
    };
  }

  /**
   * Determine anomaly severity based on multiple factors
   */
  private determineSeverity(
    zScore: number, 
    percentageAbove: number, 
    absoluteAmount: number
  ): 'low' | 'medium' | 'high' {
    // High severity: extreme statistical deviation OR very large absolute amount
    if (Math.abs(zScore) > 3.5 || percentageAbove > 200 || absoluteAmount > 1000) {
      return 'high';
    }
    
    // Medium severity: significant deviation AND moderate amount
    if (Math.abs(zScore) > 2.5 || (percentageAbove > 100 && absoluteAmount > 100)) {
      return 'medium';
    }
    
    // Low severity: everything else that passed the threshold
    return 'low';
  }

  private getAnomalyReason(
    transaction: Transaction,
    stats: { mean: DecimalInstance; stdDev: DecimalInstance; count: number },
    zScore: number
  ): string {
    const amount = toDecimal(Math.abs(transaction.amount));
    const percentageAbove = stats.mean.greaterThan(0)
      ? amount.minus(stats.mean).dividedBy(stats.mean).times(100).toNumber()
      : 0;
    
    // Provide context-aware reasons
    const category = transaction.category || 'Uncategorized';
    const description = transaction.description.toLowerCase();
    
    // Check for specific patterns
    if (description.includes('annual') || description.includes('yearly') || description.includes('subscription')) {
      return `Annual or subscription payment - ${Math.round(percentageAbove)}% above typical ${category} spending`;
    }
    
    if (description.includes('emergency') || description.includes('repair') || description.includes('medical')) {
      return `Emergency or unexpected expense - significantly higher than usual`;
    }
    
    if (zScore > 3.5) {
      return `Extremely high ${category} expense - ${Math.round(percentageAbove)}% above your typical spending pattern`;
    } else if (zScore > 2.5) {
      return `Significantly above average ${category} spending - worth reviewing for accuracy`;
    } else {
      return `Higher than typical ${category} expense - ${Math.round(percentageAbove)}% above your average`;
    }
  }

  private calculateMonthlyTotals(transactions: Transaction[]): Map<string, DecimalInstance> {
    const monthlyTotals = new Map<string, DecimalInstance>();
    
    transactions.forEach(t => {
      const monthKey = format(new Date(t.date), 'yyyy-MM');
      const current = monthlyTotals.get(monthKey) || toDecimal(0);
      monthlyTotals.set(monthKey, current.plus(toDecimal(t.amount)));
    });
    
    return monthlyTotals;
  }

  private detectTrend(monthlyTotals: Map<string, DecimalInstance>): 'increasing' | 'stable' | 'decreasing' {
    const values = Array.from(monthlyTotals.values());
    if (values.length < 3) return 'stable';
    
    // Use linear regression for more accurate trend detection
    const { slope, rSquared } = TimeSeriesAnalysis.linearRegression(values);
    
    // Only consider it a trend if R-squared is reasonably high
    if (rSquared < 0.3) return 'stable';
    
    // Calculate percentage change based on slope relative to mean
    const mean = values.reduce((a, b) => a.plus(b), toDecimal(0)).dividedBy(values.length);
    const slopePercentage = mean.greaterThan(0) 
      ? slope.dividedBy(mean).toNumber() 
      : 0;
    
    // Determine trend based on slope magnitude
    if (slopePercentage > 0.05) return 'increasing';
    if (slopePercentage < -0.05) return 'decreasing';
    
    return 'stable';
  }

  private calculateAverage(monthlyTotals: Map<string, DecimalInstance>): DecimalInstance {
    const values = Array.from(monthlyTotals.values());
    const sum = values.reduce((a, b) => a.plus(b), toDecimal(0));
    return sum.dividedBy(values.length);
  }

  private makePrediction(
    monthlyTotals: Map<string, DecimalInstance>,
    trend: 'increasing' | 'stable' | 'decreasing',
    monthsToPredict: number
  ): { amount: DecimalInstance; confidence: number } {
    const entries = Array.from(monthlyTotals.entries());
    
    // Convert to time series data
    const timeSeriesData: TimeSeriesData[] = entries.map(([dateStr, value]) => ({
      date: new Date(dateStr),
      value
    }));
    
    // Sort by date
    timeSeriesData.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Use advanced time series forecasting
    const forecasts = TimeSeriesAnalysis.forecast(
      timeSeriesData,
      monthsToPredict,
      {
        detectSeasonality: timeSeriesData.length >= 12,
        confidenceLevel: 0.95
      }
    );
    
    if (forecasts.length > 0) {
      const forecast = forecasts[0];
      if (forecast) {
        return {
          amount: forecast.value,
          confidence: forecast.confidence
        };
      }
    }
    
    // Fallback to simple average if forecasting fails
    const values = Array.from(monthlyTotals.values());
    const recentAvg = values.slice(-3).reduce((a, b) => a.plus(b), toDecimal(0)).dividedBy(3);
    
    return { amount: recentAvg, confidence: 0.5 };
  }

  private getSpendingRecommendation(
    category: string,
    trend: 'increasing' | 'stable' | 'decreasing',
    predicted: DecimalInstance,
    average: DecimalInstance
  ): string | undefined {
    if (trend === 'increasing' && predicted.greaterThan(average.times(1.2))) {
      return `Consider setting a budget limit for ${category} to control spending growth`;
    }
    if (trend === 'decreasing') {
      return `Great job reducing ${category} spending! Keep it up!`;
    }
    return undefined;
  }

  private detectSubscriptions(transactions: Transaction[]): Subscription[] {
    // Simplified subscription detection
    const recurring = new Map<string, Transaction[]>();
    
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const key = `${t.description}-${t.amount}`;
        if (!recurring.has(key)) {
          recurring.set(key, []);
        }
        recurring.get(key)!.push(t);
      }
    });
    
    const subscriptions: Subscription[] = [];
    recurring.forEach((trans, key) => {
      if (trans.length >= 3) {
        // Check if transactions are roughly monthly
        const dates = trans.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        const firstTransaction = trans[0];

        if (firstDate && lastDate && firstTransaction && dates.length > 1) {
          const daysDiff = differenceInDays(lastDate, firstDate) / (dates.length - 1);

          if (daysDiff >= 25 && daysDiff <= 35) {
            // Note: This creates a simplified subscription object - may need proper Subscription interface implementation
            subscriptions.push({
              id: `sub-${Date.now()}-${Math.random()}`,
              merchantId: key.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              merchantName: firstTransaction.description,
              amount: Math.abs(firstTransaction.amount),
              frequency: 'monthly',
              nextPaymentDate: new Date(),
              category: firstTransaction.category || 'Other',
              status: 'active',
              startDate: firstDate,
              renewalType: 'auto',
              paymentMethod: 'Unknown',
              transactionIds: trans.map(t => t.id),
              createdAt: new Date(),
              lastUpdated: new Date()
            } as any); // TODO: Fix Subscription interface mismatch
          }
        }
      }
    });
    
    return subscriptions;
  }

  private analyzeCategorySpending(transactions: Transaction[]): Map<string, CategorySpendingStats> {
    const categoryStats = new Map<string, CategorySpendingStats>();
    const today = new Date();
    const threeMonthsAgo = subMonths(today, 3);
    const sixMonthsAgo = subMonths(today, 6);
    
    // Group transactions by category
    const categoryGroups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const category = t.category || 'Uncategorized';
        if (!categoryGroups.has(category)) {
          categoryGroups.set(category, []);
        }
        categoryGroups.get(category)!.push(t);
      }
    });
    
    // Calculate income for percentage calculations
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const monthlyIncome = incomeTransactions.length > 0
      ? incomeTransactions
          .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0))
          .dividedBy(6) // 6 months average
      : toDecimal(100); // Default to avoid division by zero
    
    // Analyze each category
    categoryGroups.forEach((categoryTrans, category) => {
      // Recent vs older spending
      const recentTrans = categoryTrans.filter(t => new Date(t.date) >= threeMonthsAgo);
      const olderTrans = categoryTrans.filter(t => 
        new Date(t.date) >= sixMonthsAgo && new Date(t.date) < threeMonthsAgo
      );
      
      const recentTotal = recentTrans.reduce(
        (sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), 
        toDecimal(0)
      );
      
      const olderTotal = olderTrans.reduce(
        (sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), 
        toDecimal(0)
      );
      
      const recentMonthlyAvg = recentTotal.dividedBy(3);
      const olderMonthlyAvg = olderTotal.dividedBy(3);
      
      // Calculate trend
      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
      let percentageIncrease = 0;
      
      if (olderMonthlyAvg.greaterThan(0)) {
        const change = recentMonthlyAvg.minus(olderMonthlyAvg)
          .dividedBy(olderMonthlyAvg)
          .toNumber();
        
        if (change > 0.1) {
          trend = 'increasing';
          percentageIncrease = Math.round(change * 100);
        } else if (change < -0.1) {
          trend = 'decreasing';
          percentageIncrease = Math.round(change * 100);
        }
      }
      
      // Calculate percentage of income
      const percentageOfIncome = monthlyIncome.greaterThan(0)
        ? recentMonthlyAvg.dividedBy(monthlyIncome).times(100).toNumber()
        : 0;
      
      categoryStats.set(category, {
        categoryId: category,
        categoryName: category,
        totalSpent: recentTotal,
        averageTransaction: recentTotal.dividedBy(Math.max(1, recentTrans.length)),
        transactionCount: recentTrans.length,
        trend,
        percentageOfTotal: 0, // Would need total calculation
        percentageOfIncome,
        percentageIncrease,
        monthlyAverage: recentMonthlyAvg
      });
    });
    
    return categoryStats;
  }

  private findDuplicateServices(transactions: Transaction[]): DuplicateService[] {
    const duplicateServices: DuplicateService[] = [];
    const serviceCategories = new Map<string, Transaction[]>();
    
    // Define service types that might have duplicates
    const serviceTypes = [
      { category: 'streaming', keywords: ['netflix', 'hulu', 'disney', 'hbo', 'amazon prime', 'youtube', 'spotify', 'apple music'] },
      { category: 'cloud_storage', keywords: ['dropbox', 'google drive', 'icloud', 'onedrive', 'box'] },
      { category: 'software', keywords: ['adobe', 'microsoft', 'zoom', 'slack', 'notion', 'evernote'] },
      { category: 'fitness', keywords: ['gym', 'fitness', 'peloton', 'crossfit', 'yoga', 'pilates'] },
      { category: 'meal_delivery', keywords: ['hellofresh', 'blue apron', 'doordash', 'uber eats', 'grubhub'] },
      { category: 'news', keywords: ['times', 'journal', 'post', 'news', 'magazine'] }
    ];
    
    // Group transactions by service type
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const desc = t.description.toLowerCase();
        
        serviceTypes.forEach(serviceType => {
          const matchedKeyword = serviceType.keywords.find(keyword => 
            desc.includes(keyword)
          );
          
          if (matchedKeyword) {
            if (!serviceCategories.has(serviceType.category)) {
              serviceCategories.set(serviceType.category, []);
            }
            serviceCategories.get(serviceType.category)!.push(t);
          }
        });
      }
    });
    
    // Find duplicates within each service category
    serviceCategories.forEach((services, category) => {
      // Group by unique merchants
      const merchants = new Map<string, Transaction[]>();
      services.forEach(t => {
        const merchant = t.description.toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 20); // Normalize merchant name
        
        if (!merchants.has(merchant)) {
          merchants.set(merchant, []);
        }
        merchants.get(merchant)!.push(t);
      });
      
      // If we have multiple different merchants in the same category
      if (merchants.size >= 2) {
        const merchantList = Array.from(merchants.keys());
        const totalMonthly = Array.from(merchants.values())
          .reduce((sum, trans) => {
            const monthlyAmount = trans.length > 0 && trans[0]
              ? toDecimal(Math.abs(trans[0].amount))
              : toDecimal(0);
            return sum.plus(monthlyAmount);
          }, toDecimal(0));
        
        // Create recommendations based on service type
        let recommendation = '';
        switch (category) {
          case 'streaming':
            recommendation = 'Consider choosing one primary streaming service or rotating subscriptions monthly';
            break;
          case 'cloud_storage':
            recommendation = 'Consolidate to one cloud storage provider with sufficient space';
            break;
          case 'software':
            recommendation = 'Review if you need all software subscriptions or can use free alternatives';
            break;
          case 'fitness':
            recommendation = 'Choose one primary fitness membership that best fits your routine';
            break;
          case 'meal_delivery':
            recommendation = 'Stick to one meal delivery service or cook more meals at home';
            break;
          case 'news':
            recommendation = 'Many news sites offer free content or bundle subscriptions';
            break;
          default:
            recommendation = 'Review if you need multiple services in this category';
        }
        
        const serviceEntries: DuplicateService['services'] = merchantList.slice(0, 3).map((merchant) => {
          const merchantTransactions = merchants.get(merchant) ?? [];
          const merchantTotal = merchantTransactions.reduce(
            (sum, txn) => sum.plus(toDecimal(Math.abs(txn.amount))),
            toDecimal(0)
          );
          const monthCount = this.countDistinctMonths(merchantTransactions);
          const averageMonthlyCost = monthCount > 0
            ? merchantTotal.dividedBy(monthCount)
            : toDecimal(0);

          const lastDate = merchantTransactions.reduce((latest, txn) => {
            const txnDate = new Date(txn.date);
            return txnDate > latest ? txnDate : latest;
          }, new Date(0));

          return {
            merchant,
            amount: averageMonthlyCost,
            lastDate
          };
        });

        duplicateServices.push({
          type: category,
          category: category.replace('_', ' '),
          services: serviceEntries,
          potentialSavings: totalMonthly.times(0.5)
        });
      }
    });
    
    return duplicateServices;
  }

  private countDistinctMonths(transactions: Transaction[]): number {
    if (transactions.length === 0) {
      return 0;
    }

    const months = new Set<string>();
    transactions.forEach((txn) => {
      months.add(format(new Date(txn.date), 'yyyy-MM'));
    });

    return months.size;
  }

  private analyzeMerchantSpending(transactions: Transaction[]): Map<string, MerchantSpendingStats> {
    // Simplified implementation
    return new Map();
  }

  private calculateSpendingVelocity(transactions: Transaction[]): SpendingVelocity {
    const expenses = transactions.filter((txn) => txn.type === 'expense');
    if (expenses.length === 0) {
      const zero = toDecimal(0);
      return {
        daily: zero,
        weekly: zero,
        monthly: zero,
        projectedMonthly: zero,
        trend: 'stable',
        isAccelerating: false,
        percentageIncrease: 0
      };
    }

    const now = new Date();
    const thirtyDaysAgo = subMonths(now, 1);
    const sixtyDaysAgo = subMonths(now, 2);

    const sumAmounts = (items: Transaction[]): DecimalInstance =>
      items.reduce((total, txn) => total.plus(toDecimal(Math.abs(txn.amount))), toDecimal(0));

    const recentExpenses = expenses.filter((txn) => new Date(txn.date) >= thirtyDaysAgo);
    const previousExpenses = expenses.filter((txn) => {
      const txnDate = new Date(txn.date);
      return txnDate >= sixtyDaysAgo && txnDate < thirtyDaysAgo;
    });

    const recentTotal = sumAmounts(recentExpenses);
    const previousTotal = sumAmounts(previousExpenses);

    const daysInRecentWindow = Math.max(1, differenceInDays(now, thirtyDaysAgo));
    const dailyAverage = recentTotal.dividedBy(daysInRecentWindow);
    const weeklyAverage = dailyAverage.times(7);

    const monthlyProjection = recentTotal;
    const percentageIncrease = previousTotal.greaterThan(0)
      ? recentTotal.minus(previousTotal).dividedBy(previousTotal).times(100).toNumber()
      : recentTotal.greaterThan(0) ? 100 : 0;

    let trend: SpendingVelocity['trend'] = 'stable';
    if (percentageIncrease > 10) {
      trend = 'accelerating';
    } else if (percentageIncrease < -10) {
      trend = 'decelerating';
    }

    return {
      daily: dailyAverage,
      weekly: weeklyAverage,
      monthly: recentTotal,
      projectedMonthly: monthlyProjection,
      trend,
      isAccelerating: percentageIncrease > 5,
      percentageIncrease: Math.round(percentageIncrease)
    };
  }

  private analyzeSavingsBehavior(transactions: Transaction[], accounts: Account[]): SavingsBehavior {
    const monthsToReview = 6;
    const cutoff = subMonths(new Date(), monthsToReview);
    const monthlyTotals = new Map<string, { income: DecimalInstance; expense: DecimalInstance }>();

    transactions.forEach((txn) => {
      const txnDate = new Date(txn.date);
      if (txnDate < cutoff) return;

      const key = format(txnDate, 'yyyy-MM');
      if (!monthlyTotals.has(key)) {
        monthlyTotals.set(key, {
          income: toDecimal(0),
          expense: toDecimal(0)
        });
      }

      const bucket = monthlyTotals.get(key)!;
      const amount = toDecimal(Math.abs(txn.amount));
      if (txn.type === 'income') {
        bucket.income = bucket.income.plus(amount);
      } else if (txn.type === 'expense') {
        bucket.expense = bucket.expense.plus(amount);
      }
    });

    if (monthlyTotals.size === 0) {
      const zero = toDecimal(0);
      return {
        monthlySavingsRate: 0,
        averageMonthlySavings: zero,
        savingsStreak: 0,
        totalSaved: zero,
        savingsTrend: 'stable',
        consistentSaving: false,
        averagePercentage: 0
      };
    }

    const sortedKeys = Array.from(monthlyTotals.keys()).sort();
    const monthlySavings = sortedKeys.map((key) => {
      const bucket = monthlyTotals.get(key)!;
      return bucket.income.minus(bucket.expense);
    });

    const monthlyRates = sortedKeys.map((key, index) => {
      const bucket = monthlyTotals.get(key)!;
      return bucket.income.greaterThan(0)
        ? bucket.income.minus(bucket.expense).dividedBy(bucket.income).times(100).toNumber()
        : 0;
    });

    const totalSavings = monthlySavings.reduce((sum, value) => sum.plus(value), toDecimal(0));
    const averageMonthlySavings = totalSavings.dividedBy(Math.max(1, monthlySavings.length));
    const averagePercentage = monthlyRates.length
      ? monthlyRates.reduce((sum, rate) => sum + rate, 0) / monthlyRates.length
      : 0;

    const latestSavings = monthlySavings[monthlySavings.length - 1] ?? toDecimal(0);
    const previousSavings = monthlySavings.length > 1
      ? monthlySavings[monthlySavings.length - 2] ?? toDecimal(0)
      : toDecimal(0);

    let savingsTrend: SavingsBehavior['savingsTrend'] = 'stable';
    const trendDelta = latestSavings.minus(previousSavings);
    if (trendDelta.greaterThan(averageMonthlySavings.times(0.1))) {
      savingsTrend = 'improving';
    } else if (trendDelta.lessThan(averageMonthlySavings.times(-0.1))) {
      savingsTrend = 'declining';
    }

    const consecutivePositive = monthlySavings.reduce((streak, value) => {
      if (value.greaterThan(0)) {
        return streak + 1;
      }
      return 0;
    }, 0);

    const consistentSaving = monthlySavings.length >= 3 && monthlySavings.slice(-3).every((value) => value.greaterThan(0));

    const currentSavingsRate = monthlyRates[monthlyRates.length - 1] ?? 0;

    return {
      monthlySavingsRate: Math.max(0, Math.round(currentSavingsRate)),
      averageMonthlySavings,
      savingsStreak: consecutivePositive,
      totalSaved: totalSavings.greaterThan(0) ? totalSavings : toDecimal(0),
      savingsTrend,
      consistentSaving,
      averagePercentage: Math.max(0, Math.round(averagePercentage))
    };
  }

  private analyzeBudgetPerformance(budget: Budget, transactions: Transaction[]): BudgetPerformance {
    const relevantTransactions = transactions.filter((txn) =>
      txn.type === 'expense' && txn.category === budget.categoryId
    );

    if (relevantTransactions.length === 0) {
      return {
        budgetId: budget.id,
        adherenceRate: 100,
        overBudgetMonths: 0,
        underBudgetMonths: 0,
        averageUtilization: 0,
        trend: 'stable',
        consistentlyUnder: false,
        averageUsage: 0,
        ...(budget.name ? { name: budget.name } : {})
      };
    }

    const monthlySpend = new Map<string, DecimalInstance>();
    relevantTransactions.forEach((txn) => {
      const key = format(new Date(txn.date), 'yyyy-MM');
      if (!monthlySpend.has(key)) {
        monthlySpend.set(key, toDecimal(0));
      }
      monthlySpend.set(key, monthlySpend.get(key)!.plus(toDecimal(Math.abs(txn.amount))));
    });

    const budgetAmount = toDecimal(Math.max(0, budget.amount));
    const monthEntries = Array.from(monthlySpend.entries()).sort(([a], [b]) => a.localeCompare(b));
    const monthsTracked = monthEntries.length;

    const totalSpent = monthEntries.reduce((sum, [, value]) => sum.plus(value), toDecimal(0));

    const overBudgetMonths = monthEntries.filter(([, value]) => value.greaterThan(budgetAmount)).length;
    const underBudgetMonths = monthEntries.filter(([, value]) => value.lessThan(budgetAmount)).length;

    const averageUtilization = budgetAmount.greaterThan(0)
      ? totalSpent.dividedBy(budgetAmount.times(Math.max(1, monthsTracked))).times(100).toNumber()
      : 0;

    const adherenceRate = monthsTracked > 0
      ? Math.max(0, Math.round(((monthsTracked - overBudgetMonths) / monthsTracked) * 100))
      : 100;

    const lastMonthSpend = monthEntries[monthEntries.length - 1]?.[1] ?? toDecimal(0);
    const previousMonthSpend = monthEntries.length > 1
      ? monthEntries[monthEntries.length - 2]?.[1] ?? toDecimal(0)
      : toDecimal(0);
    const monthDelta = lastMonthSpend.minus(previousMonthSpend);

    let trend: BudgetPerformance['trend'] = 'stable';
    if (monthDelta.greaterThan(budgetAmount.times(0.1))) {
      trend = 'worsening';
    } else if (monthDelta.lessThan(budgetAmount.times(-0.1))) {
      trend = 'improving';
    }

    const utilizationThreshold = budgetAmount.times(0.9);
    const consistentlyUnder = monthsTracked >= 3 && monthEntries.every(([, value]) =>
      value.lessThan(utilizationThreshold) || value.equals(utilizationThreshold)
    );
    const averageUsage = budgetAmount.greaterThan(0)
      ? totalSpent.dividedBy(budgetAmount.times(Math.max(1, monthsTracked))).times(100).toNumber()
      : 0;

    return {
      budgetId: budget.id,
      adherenceRate,
      overBudgetMonths,
      underBudgetMonths,
      averageUtilization: Math.max(0, Math.round(averageUtilization)),
      trend,
      consistentlyUnder,
      averageUsage: Math.max(0, Math.round(averageUsage)),
      ...(budget.name ? { name: budget.name } : {})
    };
  }

  private analyzeIncomeStability(transactions: Transaction[]): IncomeStability {
    const zero = toDecimal(0);
    return {
      isStable: true,
      variabilityPercentage: 0,
      averageMonthlyIncome: zero,
      incomeStreams: 0,
      primaryIncomePercentage: 0,
      isIrregular: false
    };
  }

  private detectSeasonalPatterns(transactions: Transaction[]): SeasonalPattern[] {
    // Simplified implementation
    return [];
  }

  private findRecurringBills(transactions: Transaction[]): RecurringBill[] {
    // Simplified implementation
    return [];
  }

  private getNegotiationTips(category: string): string[] {
    const tips: Record<string, string[]> = {
      'Internet': [
        'Research competitor prices in your area',
        'Mention you\'re considering switching providers',
        'Ask about promotional rates for existing customers',
        'Bundle services for additional discounts'
      ],
      'Mobile Phone': [
        'Review your data usage - you might need less',
        'Ask about loyalty discounts',
        'Consider switching to a prepaid plan',
        'Negotiate for free add-ons instead of price reduction'
      ],
      'Insurance': [
        'Get quotes from multiple providers',
        'Increase deductibles to lower premiums',
        'Bundle multiple policies',
        'Ask about discounts (safe driver, home security, etc.)'
      ]
    };
    
    return tips[category] || ['Call and ask for retention department', 'Be prepared to switch providers'];
  }

  private getSuccessRate(category: string): number {
    const rates: Record<string, number> = {
      'Internet': 75,
      'Mobile Phone': 80,
      'Insurance': 65,
      'Cable/Streaming': 70,
      'Gym': 60
    };
    
    return rates[category] || 50;
  }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();
