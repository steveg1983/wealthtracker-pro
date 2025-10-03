import { toDecimal } from '../../utils/decimal';
import { subMonths } from 'date-fns';
import type { Transaction, Account, Budget } from '../../types';
import type { FinancialInsight } from './types';
import type {
  SpendingVelocity,
  SavingsBehavior,
  BudgetPerformance,
  IncomeStability,
  SeasonalPattern
} from '../../types/analytics';

/**
 * Generates personalized financial insights
 */
export class InsightGenerator {
  /**
   * Generate comprehensive financial insights
   */
  generateInsights(
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[]
  ): FinancialInsight[] {
    const insights: FinancialInsight[] = [];
    
    // 1. Spending velocity insight
    const velocityInsight = this.generateSpendingVelocityInsight(transactions);
    if (velocityInsight) insights.push(velocityInsight);
    
    // 2. Positive saving behavior
    const savingsInsight = this.generateSavingsInsight(transactions, accounts);
    if (savingsInsight) insights.push(savingsInsight);
    
    // 3. Budget performance insights
    const budgetInsights = this.generateBudgetInsights(budgets, transactions);
    insights.push(...budgetInsights);
    
    // 4. Income stability insight
    const incomeInsight = this.generateIncomeInsight(transactions);
    if (incomeInsight) insights.push(incomeInsight);
    
    // 5. Seasonal spending patterns
    const seasonalInsights = this.generateSeasonalInsights(transactions);
    insights.push(...seasonalInsights);
    
    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Generate spending velocity insight
   */
  private generateSpendingVelocityInsight(transactions: Transaction[]): FinancialInsight | null {
    const velocity = this.calculateSpendingVelocity(transactions);
    
    if (velocity.isAccelerating) {
      return {
        id: 'insight-velocity',
        type: 'spending',
        title: 'Spending Acceleration Detected',
        description: `Your spending has increased ${velocity.percentageIncrease}% this month`,
        impact: 'negative',
        priority: 'high',
        actionable: true,
        relatedData: { velocity }
      };
    }
    
    return null;
  }

  /**
   * Generate savings behavior insight
   */
  private generateSavingsInsight(
    transactions: Transaction[],
    accounts: Account[]
  ): FinancialInsight | null {
    const savingsBehavior = this.analyzeSavingsBehavior(transactions, accounts);
    
    if (savingsBehavior.consistentSaving) {
      return {
        id: 'insight-savings',
        type: 'saving',
        title: 'Great Saving Habits!',
        description: `You've consistently saved ${savingsBehavior.averagePercentage}% of your income`,
        impact: 'positive',
        priority: 'medium',
        actionable: false
      };
    }
    
    if (savingsBehavior.averagePercentage !== undefined && savingsBehavior.averagePercentage < 5) {
      return {
        id: 'insight-low-savings',
        type: 'saving',
        title: 'Low Savings Rate',
        description: 'Consider increasing your savings to at least 10% of income',
        impact: 'negative',
        priority: 'high',
        actionable: true
      };
    }
    
    return null;
  }

  /**
   * Generate budget performance insights
   */
  private generateBudgetInsights(
    budgets: Budget[],
    transactions: Transaction[]
  ): FinancialInsight[] {
    const insights: FinancialInsight[] = [];
    
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
      
      if (performance.consistentlyOver) {
        insights.push({
          id: `insight-budget-over-${budget.id}`,
          type: 'budget',
          title: `${budget.name} Budget Exceeded`,
          description: `You consistently exceed this budget by ${performance.averageOverage}%`,
          impact: 'negative',
          priority: 'high',
          actionable: true,
          relatedData: { budgetId: budget.id, performance }
        });
      }
    });
    
    return insights;
  }

  /**
   * Generate income stability insight
   */
  private generateIncomeInsight(transactions: Transaction[]): FinancialInsight | null {
    const incomeAnalysis = this.analyzeIncomeStability(transactions);
    
    if (incomeAnalysis.isIrregular) {
      return {
        id: 'insight-income',
        type: 'income',
        title: 'Irregular Income Pattern',
        description: 'Your income varies significantly. Consider building a larger emergency fund.',
        impact: 'neutral',
        priority: 'high',
        actionable: true,
        relatedData: { incomeAnalysis }
      };
    }
    
    return null;
  }

  /**
   * Generate seasonal insights
   */
  private generateSeasonalInsights(transactions: Transaction[]): FinancialInsight[] {
    const insights: FinancialInsight[] = [];
    const patterns = this.detectSeasonalPatterns(transactions);
    
    patterns.forEach(pattern => {
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
    
    return insights;
  }

  /**
   * Calculate spending velocity
   */
  private calculateSpendingVelocity(transactions: Transaction[]): SpendingVelocity {
    const today = new Date();
    const thisMonth = subMonths(today, 0);
    const lastMonth = subMonths(today, 1);
    
    const thisMonthSpending = transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= thisMonth)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const lastMonthSpending = transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date) >= lastMonth &&
        new Date(t.date) < thisMonth
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const percentageIncrease = lastMonthSpending > 0
      ? ((thisMonthSpending - lastMonthSpending) / lastMonthSpending) * 100
      : 0;
    
    const dailyAvg = thisMonthSpending / 30;
    const weeklyAvg = thisMonthSpending / 4;
    
    return {
      daily: toDecimal(dailyAvg),
      weekly: toDecimal(weeklyAvg),
      monthly: toDecimal(thisMonthSpending),
      projectedMonthly: toDecimal(thisMonthSpending * 1.1),
      currentMonth: toDecimal(thisMonthSpending),
      previousMonth: toDecimal(lastMonthSpending),
      percentageIncrease,
      isAccelerating: percentageIncrease > 10,
      trend: percentageIncrease > 5 ? 'increasing' : 
             percentageIncrease < -5 ? 'decreasing' : 'stable'
    };
  }

  /**
   * Analyze savings behavior
   */
  private analyzeSavingsBehavior(
    transactions: Transaction[],
    accounts: Account[]
  ): SavingsBehavior {
    // Simplified implementation
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    
    return {
      monthlySavingsRate: savingsRate,
      averageMonthlySavings: toDecimal(savings / 12),
      savingsStreak: 3, // Simplified
      totalSaved: toDecimal(savings),
      savingsTrend: savingsRate > 15 ? 'improving' : savingsRate < 5 ? 'declining' : 'stable',
      monthlySavings: toDecimal(savings / 12),
      savingsRate: toDecimal(savingsRate),
      averagePercentage: savingsRate,
      consistentSaving: savingsRate > 10,
      trend: 'stable'
    };
  }

  /**
   * Analyze budget performance
   */
  private analyzeBudgetPerformance(
    budget: Budget,
    transactions: Transaction[]
  ): BudgetPerformance {
    // Simplified implementation
    const categoryTransactions = transactions.filter(t => 
      t.category === ((budget as any).categoryId || (budget as any).category) &&
      t.type === 'expense'
    );
    
    const spending = categoryTransactions.reduce((sum, t) => 
      sum + Math.abs(t.amount), 0
    );
    
    const budgetAmount = budget.amount || 0;
    const usage = budgetAmount > 0 ? (spending / budgetAmount) * 100 : 0;
    
    return {
      budgetId: budget.id,
      adherenceRate: usage < 100 ? 100 : 100 - (usage - 100),
      overBudgetMonths: usage > 100 ? 1 : 0,
      underBudgetMonths: usage <= 100 ? 1 : 0,
      averageUtilization: usage,
      trend: usage < 90 ? 'improving' : usage > 110 ? 'worsening' : 'stable',
      averageUsage: usage,
      consistentlyUnder: usage < 100,
      consistentlyOver: usage > 100,
      averageOverage: Math.max(0, usage - 100),
      monthsAnalyzed: 1
    };
  }

  /**
   * Analyze income stability
   */
  private analyzeIncomeStability(transactions: Transaction[]): IncomeStability {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const monthlyIncome = new Map<string, number>();
    
    incomeTransactions.forEach(t => {
      const month = new Date(t.date).toISOString().slice(0, 7);
      const current = monthlyIncome.get(month) || 0;
      monthlyIncome.set(month, current + t.amount);
    });
    
    const incomes = Array.from(monthlyIncome.values());
    const avgIncome = incomes.reduce((sum, i) => sum + i, 0) / incomes.length;
    const variance = incomes.reduce((sum, i) => sum + Math.pow(i - avgIncome, 2), 0) / incomes.length;
    const coefficientOfVariation = Math.sqrt(variance) / avgIncome;
    
    return {
      averageMonthlyIncome: toDecimal(avgIncome),
      standardDeviation: toDecimal(Math.sqrt(variance)),
      coefficientOfVariation,
      isIrregular: coefficientOfVariation > 0.3,
      trend: 'stable',
      isStable: coefficientOfVariation <= 0.3,
      variabilityPercentage: coefficientOfVariation * 100,
      incomeStreams: 1, // Simplified for now
      primaryIncomePercentage: 100 // Simplified for now
    };
  }

  /**
   * Detect seasonal patterns
   */
  private detectSeasonalPatterns(transactions: Transaction[]): SeasonalPattern[] {
    const patterns: SeasonalPattern[] = [];
    // Simplified implementation
    return patterns;
  }
}

export const insightGenerator = new InsightGenerator();
