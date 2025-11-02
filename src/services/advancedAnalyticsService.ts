import type { Transaction, Account, Budget, Category } from '../types';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { startOfMonth, subMonths, differenceInDays, format } from 'date-fns';
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
      if (!stats) return;
      
      const amount = toDecimal(transaction.amount);
      const zScore = stats.stdDev.greaterThan(0) 
        ? amount.minus(stats.mean).dividedBy(stats.stdDev).toNumber()
        : 0;
      
      // Detect anomalies based on z-score and other factors
      if (zScore > 2) {
        const percentageAbove = amount.minus(stats.mean).dividedBy(stats.mean).times(100).toNumber();
        
        anomalies.push({
          id: `anomaly-${transaction.id}`,
          date: new Date(transaction.date),
          description: transaction.description,
          amount,
          category: transaction.category || 'Uncategorized',
          severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
          reason: this.getAnomalyReason(transaction, stats, zScore),
          percentageAboveNormal: Math.round(percentageAbove)
        });
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
      if (sub.unusedMonths! > 2) {
        opportunities.push({
          id: `opp-sub-${sub.merchant}`,
          type: 'subscription',
          title: `Unused Subscription: ${sub.merchant}`,
          description: `You haven't used ${sub.merchant} in ${sub.unusedMonths!} months`,
          potentialSavings: sub.monthlyAmount!.times(12),
          difficulty: 'easy',
          actionRequired: 'Cancel subscription',
          relatedTransactions: sub.transactionIds
        });
      }
    });
    
    // 2. Identify high spending categories
    const categorySpending = this.analyzeCategorySpending(transactions);
    categorySpending.forEach((data, category) => {
      if (data.trend === 'increasing' && data.percentageOfIncome! > 15) {
        opportunities.push({
          id: `opp-cat-${category}`,
          type: 'category',
          title: `Reduce ${category} Spending`,
          description: `Your ${category} spending is ${data.percentageIncrease}% higher than 3 months ago`,
          potentialSavings: data.monthlyAverage!.times(0.2), // 20% reduction
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
      if (data.averageTransaction?.greaterThan(50) && data.frequency > 4) {
        opportunities.push({
          id: `opp-merchant-${merchant}`,
          type: 'merchant',
          title: `Optimize ${merchant} Spending`,
          description: `Consider bulk purchases or membership discounts`,
          potentialSavings: data.monthlyTotal?.times(0.1).toNumber() || 0, // 10% potential savings
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
      if (performance.consistentlyUnder && performance.averageUsage! < 80) {
        insights.push({
          id: `insight-budget-${budget.id}`,
          type: 'budget',
          title: `${budget.name} Budget Opportunity`,
          description: `You consistently use only ${performance.averageUsage!}% of this budget. Consider reducing it.`,
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
        description: pattern.description,
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
          lastTransactionDate: bill.lastDate
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
    
    transactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(toDecimal(t.amount));
    });
    
    const stats = new Map<string, { mean: DecimalInstance; stdDev: DecimalInstance }>();
    
    categoryGroups.forEach((amounts, category) => {
      const sum = amounts.reduce((a, b) => a.plus(b), toDecimal(0));
      const mean = sum.dividedBy(amounts.length);
      
      const squaredDiffs = amounts.map(a => a.minus(mean).pow(2));
      const variance = squaredDiffs.reduce((a, b) => a.plus(b), toDecimal(0))
        .dividedBy(amounts.length);
      const stdDev = variance.sqrt();
      
      stats.set(category, { mean, stdDev });
    });
    
    return stats;
  }

  private getAnomalyReason(
    transaction: Transaction,
    stats: { mean: DecimalInstance; stdDev: DecimalInstance },
    zScore: number
  ): string {
    const amount = toDecimal(transaction.amount);
    const percentageAbove = amount.minus(stats.mean).dividedBy(stats.mean).times(100).toNumber();
    
    if (zScore > 3) {
      return `This transaction is ${Math.round(percentageAbove)}% above your typical ${transaction.category} spending`;
    } else if (transaction.description.toLowerCase().includes('annual') || 
               transaction.description.toLowerCase().includes('yearly')) {
      return 'Annual payment detected - higher than usual but expected';
    } else {
      return `Unusually high amount for ${transaction.category}`;
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
    
    const recentAvg = values.slice(-3).reduce((a, b) => a.plus(b), toDecimal(0)).dividedBy(3);
    const olderAvg = values.slice(0, 3).reduce((a, b) => a.plus(b), toDecimal(0)).dividedBy(3);
    
    const change = recentAvg.minus(olderAvg).dividedBy(olderAvg).toNumber();
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
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
    const values = Array.from(monthlyTotals.values());
    const recentAvg = values.slice(-3).reduce((a, b) => a.plus(b), toDecimal(0)).dividedBy(3);
    
    let predictedAmount = recentAvg;
    let confidence = 0.8;
    
    if (trend === 'increasing') {
      predictedAmount = recentAvg.times(1.05);
      confidence = 0.7;
    } else if (trend === 'decreasing') {
      predictedAmount = recentAvg.times(0.95);
      confidence = 0.7;
    }
    
    return { amount: predictedAmount, confidence };
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
            merchant: trans[0].description,
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
    // Simplified implementation
    return new Map();
  }

  private findDuplicateServices(transactions: Transaction[]): DuplicateService[] {
    // Simplified implementation
    return [];
  }

  private analyzeMerchantSpending(transactions: Transaction[]): Map<string, MerchantSpendingStats> {
    // Simplified implementation
    return new Map();
  }

  private calculateSpendingVelocity(transactions: Transaction[]): SpendingVelocity {
    // Simplified implementation
    return { isAccelerating: false, percentageIncrease: 0 };
  }

  private analyzeSavingsBehavior(transactions: Transaction[], accounts: Account[]): SavingsBehavior {
    // Simplified implementation
    return { consistentSaving: false, averagePercentage: 0 };
  }

  private analyzeBudgetPerformance(budget: Budget, transactions: Transaction[]): BudgetPerformance {
    // Simplified implementation
    return { consistentlyUnder: false, averageUsage: 0 };
  }

  private analyzeIncomeStability(transactions: Transaction[]): IncomeStability {
    // Simplified implementation
    return { isIrregular: false };
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