import type { Transaction, Category, Budget } from '../types';
import type { DecimalInstance } from '../types/decimal-types';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { logger } from './loggingService';
import { formatDecimalFixed, formatPercentageValue, toDecimal } from '@wealthtracker/utils';

export interface BudgetRecommendation {
  categoryId: string;
  categoryName: string;
  currentBudget?: number;
  recommendedBudget: number;
  averageSpending: number;
  spendingTrend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  confidence: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  potentialSavings?: number;
}

export interface BudgetAnalysis {
  totalCurrentBudget: number;
  totalRecommendedBudget: number;
  totalPotentialSavings: number;
  recommendations: BudgetRecommendation[];
  insights: BudgetInsight[];
  score: number; // 0-100 budget health score
}

export interface BudgetInsight {
  type: 'overspend' | 'underspend' | 'unbudgeted' | 'opportunity' | 'achievement';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  actionable: boolean;
  categoryId?: string;
  amount?: number;
}

export interface RecommendationConfig {
  lookbackMonths: number;
  includeSeasonality: boolean;
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  minConfidence: number;
  considerGoals: boolean;
}

const roundToInt = (value: number | DecimalInstance): number =>
  toDecimal(value).toDecimalPlaces(0).toNumber();

const roundUpToNearest = (value: number, step: number): number =>
  toDecimal(value).dividedBy(step).ceil().times(step).toNumber();

const formatUsdValue = (value: number | DecimalInstance, decimals: number = 0): string => {
  const decimal = toDecimal(value);
  const absValue = formatDecimalFixed(decimal.abs(), decimals);
  const prefix = decimal.isNegative() ? '-$' : '$';
  return `${prefix}${absValue}`;
};

const formatPercentValue = (value: number | DecimalInstance, decimals: number = 0): string =>
  formatPercentageValue(value, decimals);

class BudgetRecommendationService {
  private readonly STORAGE_KEY = 'budget_recommendation_config';
  
  // Default percentiles for different aggressiveness levels
  private readonly PERCENTILES = {
    conservative: 0.75, // 75th percentile
    moderate: 0.65,     // 65th percentile
    aggressive: 0.50    // 50th percentile (median)
  };

  // Seasonal adjustment factors by category
  private readonly SEASONAL_FACTORS: Record<string, Record<number, number>> = {
    'Gifts': { 11: 2.5, 0: 2.0 }, // November & December
    'Travel': { 5: 1.3, 6: 1.5, 7: 1.5 }, // Summer months
    'Utilities': { 0: 1.3, 1: 1.3, 6: 1.2, 7: 1.2 }, // Winter & Summer
    'Entertainment': { 11: 1.2 }, // December
  };

  getConfig(): RecommendationConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load recommendation config:', error);
    }
    
    return {
      lookbackMonths: 6,
      includeSeasonality: true,
      aggressiveness: 'moderate',
      minConfidence: 0.7,
      considerGoals: true
    };
  }

  saveConfig(config: Partial<RecommendationConfig>): void {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  analyzeBudgets(
    transactions: Transaction[],
    categories: Category[],
    budgets: Budget[]
  ): BudgetAnalysis {
    const config = this.getConfig();
    const recommendations: BudgetRecommendation[] = [];
    const insights: BudgetInsight[] = [];
    
    // Get historical spending by category
    const categorySpending = this.analyzeCategorySpending(transactions, config.lookbackMonths);
    
    // Generate recommendations for each category
    categories.forEach(category => {
      const spending = categorySpending.get(category.id);
      if (!spending || spending.months.length < 3) return; // Need at least 3 months of data
      
      const currentBudget = budgets.find(b => b.categoryId === category.id);
      const recommendation = this.generateRecommendation(
        category,
        spending,
        currentBudget,
        config
      );
      
      if (recommendation.confidence >= config.minConfidence) {
        recommendations.push(recommendation);
      }
    });

    // Sort by priority and potential savings
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return (b.potentialSavings || 0) - (a.potentialSavings || 0);
    });

    // Generate insights
    insights.push(...this.generateInsights(transactions, categories, budgets, recommendations));

    // Calculate totals
    const totalCurrentBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalRecommendedBudget = recommendations.reduce((sum, r) => sum + r.recommendedBudget, 0);
    const totalPotentialSavings = recommendations.reduce((sum, r) => sum + (r.potentialSavings || 0), 0);

    // Calculate budget health score
    const score = this.calculateBudgetHealthScore(budgets, transactions, recommendations);

    return {
      totalCurrentBudget,
      totalRecommendedBudget,
      totalPotentialSavings,
      recommendations,
      insights,
      score
    };
  }

  private analyzeCategorySpending(
    transactions: Transaction[],
    lookbackMonths: number
  ): Map<string, CategorySpendingData> {
    const categoryData = new Map<string, CategorySpendingData>();
    const now = new Date();
    
    // Analyze spending for each month
    for (let i = 0; i < lookbackMonths; i++) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      
      const monthTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return t.type === 'expense' && 
               date >= monthStart && 
               date <= monthEnd;
      });

      // Group by category
      const monthlySpending = new Map<string, number>();
      monthTransactions.forEach(t => {
        const current = monthlySpending.get(t.category) || 0;
        monthlySpending.set(t.category, current + Math.abs(t.amount));
      });

      // Add to category data
      monthlySpending.forEach((amount, categoryId) => {
        const data = categoryData.get(categoryId) || {
          months: [],
          amounts: [],
          total: 0
        };
        
        data.months.push(monthStart);
        data.amounts.push(amount);
        data.total += amount;
        
        categoryData.set(categoryId, data);
      });
    }

    return categoryData;
  }

  private generateRecommendation(
    category: Category,
    spending: CategorySpendingData,
    currentBudget: Budget | undefined,
    config: RecommendationConfig
  ): BudgetRecommendation {
    const amounts = [...spending.amounts].sort((a, b) => a - b);
    const averageSpending = spending.total / spending.amounts.length;
    
    // Calculate percentile-based recommendation
    const percentile = this.PERCENTILES[config.aggressiveness];
    const percentileIndex = Math.floor(amounts.length * percentile);
    let recommendedBudget = amounts[percentileIndex] || averageSpending;

    // Apply seasonal adjustments if enabled
    if (config.includeSeasonality) {
      recommendedBudget = this.applySeasonalAdjustment(
        category.name,
        recommendedBudget,
        new Date()
      );
    }

    // Calculate trend
    const trend = this.calculateTrend(spending.amounts);
    
    // Adjust for trend
    if (trend.direction === 'increasing' && trend.percentage > 10) {
      recommendedBudget *= 1 + (trend.percentage / 200); // Adjust up to 50% of trend
    }

    // Round to nearest 5
    recommendedBudget = roundUpToNearest(recommendedBudget, 5);

    // Calculate confidence based on data consistency
    const stdDev = this.calculateStdDev(amounts);
    const coefficientOfVariation = stdDev / averageSpending;
    const confidence = Math.max(0.5, Math.min(1, 1 - coefficientOfVariation));

    // Determine priority
    let priority: BudgetRecommendation['priority'] = 'medium';
    const currentAmount = currentBudget?.amount || 0;
    const difference = Math.abs(recommendedBudget - currentAmount);
    const percentDifference = currentAmount > 0 ? (difference / currentAmount) * 100 : 100;
    
    if (percentDifference > 30 || (currentAmount === 0 && averageSpending > 100)) {
      priority = 'high';
    } else if (percentDifference < 10) {
      priority = 'low';
    }

    // Calculate potential savings
    const potentialSavings = currentAmount > recommendedBudget ? 
      currentAmount - recommendedBudget : 0;

    // Generate reasoning
    const reasoning = this.generateReasoning(
      category.name,
      currentAmount,
      recommendedBudget,
      averageSpending,
      trend,
      config
    );

    const recommendation: BudgetRecommendation = {
      categoryId: category.id,
      categoryName: category.name,
      recommendedBudget,
      averageSpending,
      spendingTrend: trend.direction,
      trendPercentage: trend.percentage,
      confidence,
      reasoning,
      priority,
    };

    if (currentAmount > 0) {
      recommendation.currentBudget = currentAmount;
    }

    if (potentialSavings > 0) {
      recommendation.potentialSavings = potentialSavings;
    }

    return recommendation;
  }

  private calculateTrend(amounts: number[]): { 
    direction: 'increasing' | 'decreasing' | 'stable'; 
    percentage: number 
  } {
    if (amounts.length < 2) {
      return { direction: 'stable', percentage: 0 };
    }

    // Simple linear regression
    const n = amounts.length;
    const indices = amounts.map((_, i) => i);
    
    const sumX = indices.reduce((sum, x) => sum + x, 0);
    const sumY = amounts.reduce((sum, y) => sum + y, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * (amounts[i] || 0), 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgAmount = sumY / n;
    const trendPercentage = Math.abs((slope / avgAmount) * 100 * n);
    
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (slope > avgAmount * 0.05) {
      direction = 'increasing';
    } else if (slope < -avgAmount * 0.05) {
      direction = 'decreasing';
    } else {
      direction = 'stable';
    }

    return { direction, percentage: roundToInt(trendPercentage) };
  }

  private calculateStdDev(amounts: number[]): number {
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
    return Math.sqrt(variance);
  }

  private applySeasonalAdjustment(
    categoryName: string,
    amount: number,
    date: Date
  ): number {
    const month = date.getMonth();
    const factors = this.SEASONAL_FACTORS[categoryName];
    
    if (factors && factors[month]) {
      return amount * factors[month];
    }
    
    return amount;
  }

  private generateReasoning(
    categoryName: string,
    currentBudget: number,
    recommendedBudget: number,
    averageSpending: number,
    trend: { direction: string; percentage: number },
    config: RecommendationConfig
  ): string {
    const parts: string[] = [];
    
    // Base reasoning
    if (currentBudget === 0) {
      parts.push(`Based on your average spending of ${formatUsdValue(averageSpending, 0)} in ${categoryName}`);
    } else if (recommendedBudget > currentBudget) {
      parts.push(`Your current budget may be too restrictive`);
    } else if (recommendedBudget < currentBudget) {
      parts.push(`You have an opportunity to reduce this budget`);
    }

    // Trend reasoning
    if (trend.direction === 'increasing' && trend.percentage > 15) {
      parts.push(`spending has been increasing by ${formatPercentValue(trend.percentage, 0)}`);
    } else if (trend.direction === 'decreasing' && trend.percentage > 15) {
      parts.push(`spending has been decreasing by ${formatPercentValue(trend.percentage, 0)}`);
    }

    // Method reasoning
    parts.push(`using ${config.aggressiveness} analysis of ${config.lookbackMonths} months`);

    return parts.join(', ') + '.';
  }

  private generateInsights(
    transactions: Transaction[],
    categories: Category[],
    budgets: Budget[],
    recommendations: BudgetRecommendation[]
  ): BudgetInsight[] {
    const insights: BudgetInsight[] = [];
    const now = new Date();
    const currentMonth = startOfMonth(now);
    
    // Check for categories with no budget but significant spending
    recommendations.forEach(rec => {
      if (!rec.currentBudget && rec.averageSpending > 100) {
        insights.push({
          type: 'unbudgeted',
          title: `Unbudgeted Spending in ${rec.categoryName}`,
          description: `You're spending an average of ${formatUsdValue(rec.averageSpending, 0)} per month in ${rec.categoryName} without a budget.`,
          impact: 'negative',
          actionable: true,
          categoryId: rec.categoryId,
          amount: rec.averageSpending
        });
      }
    });

    // Check for significant overspending
    budgets.forEach(budget => {
      const category = categories.find(c => c.id === budget.categoryId);
      if (!category) return;
      
      const currentMonthSpending = transactions
        .filter(t => 
          t.category === budget.categoryId &&
          t.type === 'expense' &&
          new Date(t.date) >= currentMonth
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const percentSpent = (currentMonthSpending / budget.amount) * 100;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const expectedPercent = (daysPassed / daysInMonth) * 100;
      
      if (percentSpent > expectedPercent + 20) {
        insights.push({
          type: 'overspend',
          title: `Overspending Alert: ${category.name}`,
          description: `You've spent ${formatPercentValue(percentSpent, 0)} of your budget with ${daysInMonth - daysPassed} days left in the month.`,
          impact: 'negative',
          actionable: true,
          categoryId: category.id,
          amount: currentMonthSpending
        });
      }
    });

    // Check for optimization opportunities
    const totalSavings = recommendations
      .filter(r => r.potentialSavings)
      .reduce((sum, r) => sum + (r.potentialSavings || 0), 0);
    
    if (totalSavings > 100) {
      insights.push({
        type: 'opportunity',
        title: 'Budget Optimization Available',
        description: `You could potentially save ${formatUsdValue(totalSavings, 0)} per month by adjusting your budgets to match your actual spending patterns.`,
        impact: 'positive',
        actionable: true,
        amount: totalSavings
      });
    }

    // Check for good budget adherence
    const wellManagedBudgets = budgets.filter(budget => {
      const rec = recommendations.find(r => r.categoryId === budget.categoryId);
      return rec && Math.abs(rec.recommendedBudget - budget.amount) / budget.amount < 0.1;
    });
    
    if (wellManagedBudgets.length >= budgets.length * 0.7) {
      const alignmentPercentage = budgets.length > 0
        ? toDecimal(wellManagedBudgets.length).dividedBy(budgets.length).times(100)
        : toDecimal(0);
      insights.push({
        type: 'achievement',
        title: 'Excellent Budget Management',
        description: `${formatPercentValue(alignmentPercentage, 0)} of your budgets are well-aligned with your spending patterns!`,
        impact: 'positive',
        actionable: false
      });
    }

    return insights;
  }

  private calculateBudgetHealthScore(
    budgets: Budget[],
    transactions: Transaction[],
    recommendations: BudgetRecommendation[]
  ): number {
    let score = 100;
    const now = new Date();
    const currentMonth = startOfMonth(now);
    
    // Deduct points for unbudgeted categories with significant spending
    const unbudgetedPenalty = recommendations
      .filter(r => !r.currentBudget && r.averageSpending > 50)
      .length * 5;
    score -= Math.min(25, unbudgetedPenalty);
    
    // Deduct points for poorly aligned budgets
    budgets.forEach(budget => {
      const rec = recommendations.find(r => r.categoryId === budget.categoryId);
      if (rec) {
        const difference = Math.abs(rec.recommendedBudget - budget.amount) / budget.amount;
        if (difference > 0.3) {
          score -= 5;
        } else if (difference > 0.2) {
          score -= 3;
        }
      }
    });
    
    // Deduct points for current overspending
    budgets.forEach(budget => {
      const currentSpending = transactions
        .filter(t => 
          t.category === budget.categoryId &&
          t.type === 'expense' &&
          new Date(t.date) >= currentMonth
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      if (currentSpending > budget.amount) {
        const overPercent = ((currentSpending - budget.amount) / budget.amount) * 100;
        score -= Math.min(10, Math.floor(overPercent / 10));
      }
    });
    
    // Add points for consistent spending patterns
    const consistentCategories = recommendations.filter(r => r.confidence > 0.8).length;
    score += Math.min(10, consistentCategories * 2);
    
    return Math.max(0, Math.min(100, score));
  }

  // Apply recommendations to budgets
  applyRecommendations(
    recommendations: BudgetRecommendation[],
    categoryIds?: string[]
  ): { categoryId: string; amount: number }[] {
    const toApply = categoryIds 
      ? recommendations.filter(r => categoryIds.includes(r.categoryId))
      : recommendations;
    
    return toApply.map(r => ({
      categoryId: r.categoryId,
      amount: r.recommendedBudget
    }));
  }

  // Export recommendations
  exportRecommendations(analysis: BudgetAnalysis): string {
    const lines = [
      'Budget Recommendations Report',
      `Generated: ${format(new Date(), 'MMMM d, yyyy')}`,
      `Budget Health Score: ${analysis.score}/100`,
      '',
      `Total Current Budget: ${formatUsdValue(analysis.totalCurrentBudget, 2)}`,
      `Total Recommended Budget: ${formatUsdValue(analysis.totalRecommendedBudget, 2)}`,
      `Potential Savings: ${formatUsdValue(analysis.totalPotentialSavings, 2)}`,
      '',
      'Recommendations:',
      ''
    ];

    analysis.recommendations.forEach(rec => {
      lines.push(`${rec.categoryName}:`);
      const currentBudgetDisplay = rec.currentBudget !== undefined
        ? formatUsdValue(rec.currentBudget, 2)
        : '$0.00';
      lines.push(`  Current Budget: ${currentBudgetDisplay}`);
      lines.push(`  Recommended: ${formatUsdValue(rec.recommendedBudget, 2)}`);
      lines.push(`  Average Spending: ${formatUsdValue(rec.averageSpending, 2)}`);
      lines.push(`  Trend: ${rec.spendingTrend} (${formatPercentValue(rec.trendPercentage, 0)})`);
      const confidencePercentage = toDecimal(rec.confidence).times(100);
      lines.push(`  Confidence: ${formatPercentValue(confidencePercentage, 0)}`);
      lines.push(`  ${rec.reasoning}`);
      lines.push('');
    });

    lines.push('Insights:');
    lines.push('');
    
    analysis.insights.forEach(insight => {
      lines.push(`• ${insight.title}`);
      lines.push(`  ${insight.description}`);
      lines.push('');
    });

    return lines.join('\n');
  }
}

interface CategorySpendingData {
  months: Date[];
  amounts: number[];
  total: number;
}

export const budgetRecommendationService = new BudgetRecommendationService();
