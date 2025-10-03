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
  transactionId?: string;
  date: Date;
  description: string;
  amount: DecimalInstance;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type?: 'unusual_amount' | 'unusual_frequency' | 'duplicate_charge' | 'new_merchant';
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
      
      predictions.push({
        category,
        predictedAmount: prediction.amount,
        confidence: prediction.confidence,
        trend,
        monthlyAverage: average,
        recommendation: this.getSpendingRecommendation(category, trend, prediction.amount, average)
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
      if (sub.unusedMonths !== undefined && sub.unusedMonths > 2 && sub.monthlyAmount !== undefined) {
        opportunities.push({
          id: `opp-sub-${sub.merchant}`,
          type: 'subscription',
          title: `Unused Subscription: ${sub.merchant}`,
          description: `You haven't used ${sub.merchant} in ${sub.unusedMonths} months`,
          potentialSavings: sub.monthlyAmount.times(12),
          difficulty: 'easy',
          actionRequired: 'Cancel subscription',
          relatedTransactions: sub.transactionIds
        });
      }
    });
    
    // 2. Identify high spending categories
    const categorySpending = this.analyzeCategorySpending(transactions);
    categorySpending.forEach((data, category) => {
      if (data.trend === 'increasing' && data.percentageOfIncome !== undefined && data.percentageOfIncome > 15 && data.monthlyAverage !== undefined) {
        opportunities.push({
          id: `opp-cat-${category}`,
          type: 'category',
          title: `Reduce ${category} Spending`,
          description: `Your ${category} spending is ${data.percentageIncrease}% higher than 3 months ago`,
          potentialSavings: data.monthlyAverage.times(0.2), // 20% reduction
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
        relatedTransactions: dup.transactionIds
      });
    });
    
    // 4. Merchant-specific opportunities
    const merchantAnalysis = this.analyzeMerchantSpending(transactions);
    merchantAnalysis.forEach((data, merchant) => {
      if (data.averageTransaction !== undefined && data.averageTransaction.greaterThan(50) && data.monthlyTotal !== undefined) {
        opportunities.push({
          id: `opp-merchant-${merchant}`,
          type: 'merchant',
          title: `Optimize ${merchant} Spending`,
          description: `Consider bulk purchases or membership discounts`,
          potentialSavings: data.monthlyTotal.times(0.1), // 10% potential savings
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
      if (performance.consistentlyUnder && performance.averageUsage !== undefined && performance.averageUsage < 80) {
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
        description: pattern.description || '',
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
      return {
        amount: forecast.value,
        confidence: forecast.confidence
      };
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
        const daysDiff = differenceInDays(dates[dates.length - 1], dates[0]) / (dates.length - 1);
        
        if (daysDiff >= 25 && daysDiff <= 35) {
          subscriptions.push({
            id: `sub-${trans[0].description.replace(/\s+/g, '-').toLowerCase()}`,
            merchant: trans[0].description,
            amount: toDecimal(trans[0].amount),
            frequency: 'monthly',
            category: trans[0].category,
            lastChargeDate: new Date(trans[trans.length - 1].date),
            isActive: true,
            monthlyAmount: toDecimal(trans[0].amount),
            unusedMonths: 0, // Would need more logic to detect usage
            transactionIds: trans.map(t => t.id)
          });
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
      
      const totalSpent = recentTrans.reduce((sum, t) => 
        sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0)
      );
      const averageTransaction = recentTrans.length > 0 
        ? totalSpent.dividedBy(recentTrans.length)
        : toDecimal(0);
      const percentageOfTotal = 100; // Will be calculated later when we have all categories
      
      categoryStats.set(category, {
        categoryId: category,
        categoryName: category, // Using category as name for now
        totalSpent,
        averageTransaction,
        transactionCount: recentTrans.length,
        trend,
        percentageOfTotal,
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
        // Create service objects with merchant details
        const merchantServices = Array.from(merchants.entries()).map(([merchant, transactions]) => {
          const sortedTransactions = transactions.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const lastTransaction = sortedTransactions[0];
          
          return {
            merchant,
            amount: toDecimal(Math.abs(lastTransaction.amount)),
            lastDate: new Date(lastTransaction.date)
          };
        });
        
        const totalMonthly = merchantServices
          .reduce((sum, service) => sum.plus(service.amount), toDecimal(0));
        
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
        
        duplicateServices.push({
          type: category.replace('_', ' '),
          services: merchantServices.slice(0, 3), // Limit to top 3
          potentialSavings: totalMonthly.times(0.5), // Assume 50% savings possible
          category: category,
          transactionIds: merchantServices.flatMap((s, idx) => 
            merchants.get(s.merchant)?.map(t => t.id) || []
          ).slice(0, 10) // Limit transaction IDs
        });
      }
    });
    
    return duplicateServices;
  }

  private analyzeMerchantSpending(transactions: Transaction[]): Map<string, MerchantSpendingStats> {
    // Simplified implementation
    return new Map();
  }

  private calculateSpendingVelocity(transactions: Transaction[]): SpendingVelocity {
    // Simplified implementation
    return { 
      isAccelerating: false, 
      percentageIncrease: 0,
      daily: new Decimal(0),
      weekly: new Decimal(0),
      monthly: new Decimal(0),
      trend: 'stable' as const,
      projectedMonthly: new Decimal(0)
    };
  }

  private analyzeSavingsBehavior(transactions: Transaction[], accounts: Account[]): SavingsBehavior {
    // Simplified implementation
    return { 
      consistentSaving: false, 
      averagePercentage: 0,
      monthlySavingsRate: 0,
      averageMonthlySavings: toDecimal(0),
      savingsStreak: 0,
      totalSaved: toDecimal(0),
      savingsTrend: 'stable' as const
    };
  }

  private analyzeBudgetPerformance(budget: Budget, transactions: Transaction[]): BudgetPerformance {
    // Simplified implementation
    return { 
      consistentlyUnder: false, 
      averageUsage: 0,
      budgetId: budget.id,
      adherenceRate: 0,
      overBudgetMonths: 0,
      underBudgetMonths: 0,
      averageUtilization: 0,
      trend: 'stable' as const
    };
  }

  private analyzeIncomeStability(transactions: Transaction[]): IncomeStability {
    // Simplified implementation
    return { 
      isIrregular: false,
      isStable: true,
      variabilityPercentage: 0,
      averageMonthlyIncome: toDecimal(0),
      incomeStreams: 1,
      primaryIncomePercentage: 100
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

  /**
   * Predict future spending based on historical data
   */
  predictSpending(transactions: Transaction[]): SpendingPrediction[] {
    const predictions: SpendingPrediction[] = [];
    const today = new Date();
    const lookbackDate = subMonths(today, 6);
    
    // Filter to recent expense transactions
    const expenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date) >= lookbackDate
    );
    
    // Group by category
    const categoryGroups = new Map<string, Transaction[]>();
    expenses.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(t);
    });
    
    // Generate predictions for each category
    categoryGroups.forEach((txns, category) => {
      if (txns.length < 3) return; // Need minimum data
      
      // Calculate monthly averages
      const monthlyTotals = new Map<string, number>();
      txns.forEach(t => {
        const monthKey = `${new Date(t.date).getFullYear()}-${new Date(t.date).getMonth()}`;
        const current = monthlyTotals.get(monthKey) || 0;
        monthlyTotals.set(monthKey, current + Math.abs(t.amount));
      });
      
      const monthlyValues = Array.from(monthlyTotals.values());
      const avgMonthly = monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length;
      
      // Simple trend calculation
      const recentAvg = monthlyValues.slice(-2).reduce((sum, val) => sum + val, 0) / 2;
      const trend = recentAvg > avgMonthly ? 'increasing' : recentAvg < avgMonthly ? 'decreasing' : 'stable';
      
      predictions.push({
        category,
        predictedAmount: new Decimal(avgMonthly * 1.05), // Simple 5% buffer
        confidence: Math.min(90, 50 + (txns.length * 2)), // Higher confidence with more data
        trend,
        monthlyAverage: new Decimal(avgMonthly),
        recommendation: trend === 'increasing' ? 'Consider setting a budget limit' : 'Maintain current spending'
      });
    });
    
    return predictions;
  }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();