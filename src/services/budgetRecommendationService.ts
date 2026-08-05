import type { Transaction, TransactionSplit, Category, Budget } from '../types';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { formatDecimal } from '../utils/decimal-format';
import { formatCurrency } from '../utils/currency-decimal';
import { calculateSpendingByCategory, type DatedDecimalTransaction } from '../utils/calculations-decimal';
import { calculateBudgetSpend, prepareBudgetTransactions } from '../utils/budgetSpending';
import { getEffectiveBudgetAmount } from '../utils/budgetAmounts';
import { sumDecimals, toDecimal } from '../utils/decimal';

/** Quoted currency when the caller does not say — the app's own default. */
const DEFAULT_CURRENCY = 'GBP';

/** One day, for turning a period window into "days left". */
const DAY_MS = 24 * 60 * 60 * 1000;

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
  /** Currency every figure above is quoted in — the export reads it back. */
  currency: string;
}

/**
 * What the caller knows about the spending behind an analysis.
 *
 * WHY: this service used to sum raw expense floats of its own — no split
 * expansion, no refund netting, dollar signs on sterling figures. It now takes
 * the same inputs the Budget page holds and runs the same calculation, so a
 * recommendation cannot contradict the card it is recommending against.
 */
export interface BudgetAnalysisOptions {
  /** Split lines, so a split parent counts against ITS lines' categories. */
  transactionSplits?: TransactionSplit[];
  /**
   * Accounts held in another currency. Their rows are left out entirely — no
   * rate is invented here — so every figure is in one currency.
   */
  foreignAccountIds?: ReadonlySet<string>;
  /** The currency to quote figures in. Defaults to GBP. */
  currency?: string;
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

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type Logger = Pick<Console, 'warn' | 'error'>;

export interface BudgetRecommendationServiceOptions {
  storage?: StorageLike | null;
  logger?: Logger;
  now?: () => number;
}

export class BudgetRecommendationService {
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

  private storage: StorageLike | null;
  private logger: Logger;
  private readonly nowProvider: () => number;

  constructor(options: BudgetRecommendationServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => Date.now());
  }

  private getCurrentDate(): Date {
    return new Date(this.nowProvider());
  }

  getConfig(): RecommendationConfig {
    try {
      const stored = this.storage?.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      this.logger.error('Failed to load recommendation config:', error as Error);
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
    if (!this.storage) return;
    const current = this.getConfig();
    const updated = { ...current, ...config };
    this.storage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  analyzeBudgets(
    transactions: Transaction[],
    categories: Category[],
    budgets: Budget[],
    options: BudgetAnalysisOptions = {}
  ): BudgetAnalysis {
    const config = this.getConfig();
    const currency = options.currency ?? DEFAULT_CURRENCY;
    const recommendations: BudgetRecommendation[] = [];
    const insights: BudgetInsight[] = [];

    // Split parents become their per-line rows, decimalised once; rows on
    // accounts in another currency drop out here so no figure below mixes two.
    const prepared = prepareBudgetTransactions(transactions, options.transactionSplits ?? []);
    const foreignAccountIds = options.foreignAccountIds;
    const rows = foreignAccountIds && foreignAccountIds.size > 0
      ? prepared.filter(row => !foreignAccountIds.has(row.accountId))
      : prepared;

    // Get historical spending by category
    const categorySpending = this.analyzeCategorySpending(rows, config.lookbackMonths);

    // Generate recommendations for each category
    categories.forEach(category => {
      const spending = categorySpending.get(category.id);
      if (!spending || spending.months.length < 3) return; // Need at least 3 months of data

      const currentBudget = budgets.find(b => b.categoryId === category.id);
      const recommendation = this.generateRecommendation(
        category,
        spending,
        currentBudget,
        config,
        currency
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
    insights.push(...this.generateInsights(rows, categories, budgets, recommendations, currency));

    // Calculate totals — summed in Decimal, like every other money total in
    // the app, so the reported figure carries no accumulated float drift.
    const totalCurrentBudget = sumDecimals(budgets.map(b => toDecimal(b.amount))).toNumber();
    const totalRecommendedBudget = sumDecimals(recommendations.map(r => toDecimal(r.recommendedBudget))).toNumber();
    const totalPotentialSavings = sumDecimals(recommendations.map(r => toDecimal(r.potentialSavings ?? 0))).toNumber();

    // Calculate budget health score
    const score = this.calculateBudgetHealthScore(budgets, rows, recommendations);

    return {
      totalCurrentBudget,
      totalRecommendedBudget,
      totalPotentialSavings,
      recommendations,
      insights,
      score,
      currency
    };
  }

  /**
   * Month-by-month spend per category, from the app's ONE category-spending
   * calculation: split lines count against their own categories and refunds
   * net off, exactly as the Budget cards read them.
   *
   * The monthly SUMS are Decimal; the statistics built from them below
   * (percentiles, standard deviation, a regression slope) are forecasting
   * heuristics and stay in floating point — no money is stored or displayed
   * from them without passing back through a Decimal sum first.
   */
  private analyzeCategorySpending(
    transactions: DatedDecimalTransaction[],
    lookbackMonths: number
  ): Map<string, CategorySpendingData> {
    const categoryData = new Map<string, CategorySpendingData>();
    const now = this.getCurrentDate();

    // Analyze spending for each month
    for (let i = 0; i < lookbackMonths; i++) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));

      const monthlySpending = calculateSpendingByCategory(transactions, monthStart, monthEnd);

      // Add to category data
      Object.entries(monthlySpending).forEach(([categoryId, spent]) => {
        const data = categoryData.get(categoryId) || {
          months: [],
          amounts: [],
          total: 0
        };

        const amount = spent.toNumber();
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
    config: RecommendationConfig,
    currency: string
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
        this.getCurrentDate()
      );
    }

    // Calculate trend
    const trend = this.calculateTrend(spending.amounts);
    
    // Adjust for trend
    if (trend.direction === 'increasing' && trend.percentage > 10) {
      recommendedBudget *= 1 + (trend.percentage / 200); // Adjust up to 50% of trend
    }

    // Round to nearest 5 or 10
    recommendedBudget = Math.ceil(recommendedBudget / 5) * 5;

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
      config,
      currency
    );

    return {
      categoryId: category.id,
      categoryName: category.name,
      currentBudget: currentAmount || undefined,
      recommendedBudget,
      averageSpending,
      spendingTrend: trend.direction,
      trendPercentage: trend.percentage,
      confidence,
      reasoning,
      priority,
      potentialSavings: potentialSavings > 0 ? potentialSavings : undefined
    };
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
    const sumXY = indices.reduce((sum, x, i) => sum + x * amounts[i], 0);
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

    return { direction, percentage: Math.round(trendPercentage) };
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
    config: RecommendationConfig,
    currency: string
  ): string {
    const parts: string[] = [];

    // Base reasoning
    if (currentBudget === 0) {
      parts.push(`Based on your average spending of ${formatCurrency(averageSpending, currency)} in ${categoryName}`);
    } else if (recommendedBudget > currentBudget) {
      parts.push(`Your current budget may be too restrictive`);
    } else if (recommendedBudget < currentBudget) {
      parts.push(`You have an opportunity to reduce this budget`);
    }

    // Trend reasoning
    if (trend.direction === 'increasing' && trend.percentage > 15) {
      parts.push(`spending has been increasing by ${trend.percentage}%`);
    } else if (trend.direction === 'decreasing' && trend.percentage > 15) {
      parts.push(`spending has been decreasing by ${trend.percentage}%`);
    }

    // Method reasoning
    parts.push(`using ${config.aggressiveness} analysis of ${config.lookbackMonths} months`);

    return parts.join(', ') + '.';
  }

  private generateInsights(
    transactions: DatedDecimalTransaction[],
    categories: Category[],
    budgets: Budget[],
    recommendations: BudgetRecommendation[],
    currency: string
  ): BudgetInsight[] {
    const insights: BudgetInsight[] = [];
    const now = this.getCurrentDate();

    // Check for categories with no budget but significant spending
    recommendations.forEach(rec => {
      if (!rec.currentBudget && rec.averageSpending > 100) {
        insights.push({
          type: 'unbudgeted',
          title: `Unbudgeted Spending in ${rec.categoryName}`,
          description: `You're spending an average of ${formatCurrency(rec.averageSpending, currency)} per month in ${rec.categoryName} without a budget.`,
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

      // The budget's OWN period, not "this month" for everything: a quarterly
      // budget compared against a month of spending flagged nothing.
      const { spent, window } = calculateBudgetSpend(budget, transactions, { now });
      const amount = getEffectiveBudgetAmount(budget);
      if (amount.isZero() || amount.isNegative()) return;

      const percentSpent = spent.dividedBy(amount).times(100).toNumber();
      const totalDays = Math.max(1, Math.round((window.end.getTime() - window.start.getTime()) / DAY_MS));
      const daysPassed = Math.min(
        totalDays,
        Math.max(1, Math.ceil((now.getTime() - window.start.getTime()) / DAY_MS))
      );
      const expectedPercent = (daysPassed / totalDays) * 100;

      if (percentSpent > expectedPercent + 20) {
        insights.push({
          type: 'overspend',
          title: `Overspending Alert: ${category.name}`,
          description: `You've spent ${formatDecimal(percentSpent, 0)}% of your budget with ${totalDays - daysPassed} days left in this ${window.label.toLowerCase()} period.`,
          impact: 'negative',
          actionable: true,
          categoryId: category.id,
          amount: spent.toNumber()
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
        description: `You could potentially save ${formatCurrency(totalSavings, currency)} per month by adjusting your budgets to match your actual spending patterns.`,
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
      insights.push({
        type: 'achievement',
        title: 'Excellent Budget Management',
        description: `${Math.round(wellManagedBudgets.length / budgets.length * 100)}% of your budgets are well-aligned with your spending patterns!`,
        impact: 'positive',
        actionable: false
      });
    }

    return insights;
  }

  private calculateBudgetHealthScore(
    budgets: Budget[],
    transactions: DatedDecimalTransaction[],
    recommendations: BudgetRecommendation[]
  ): number {
    let score = 100;
    const now = this.getCurrentDate();

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
    
    // Deduct points for current overspending — measured over each budget's own
    // period, with split lines counted and refunds netted off.
    budgets.forEach(budget => {
      const amount = getEffectiveBudgetAmount(budget);
      if (amount.isZero() || amount.isNegative()) return;

      const { spent } = calculateBudgetSpend(budget, transactions, { now });
      if (spent.greaterThan(amount)) {
        const overPercent = spent.minus(amount).dividedBy(amount).times(100).toNumber();
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
    // Every figure is quoted in the currency the analysis was run in — the
    // export used to stamp a dollar sign on sterling amounts.
    const currency = analysis.currency || DEFAULT_CURRENCY;
    const money = (amount: number): string => formatCurrency(amount, currency);
    const lines = [
      'Budget Recommendations Report',
      `Generated: ${format(this.getCurrentDate(), 'MMMM d, yyyy')}`,
      `Budget Health Score: ${analysis.score}/100`,
      '',
      `Total Current Budget: ${money(analysis.totalCurrentBudget)}`,
      `Total Recommended Budget: ${money(analysis.totalRecommendedBudget)}`,
      `Potential Savings: ${money(analysis.totalPotentialSavings)}`,
      '',
      'Recommendations:',
      ''
    ];

    analysis.recommendations.forEach(rec => {
      lines.push(`${rec.categoryName}:`);
      lines.push(`  Current Budget: ${money(rec.currentBudget ?? 0)}`);
      lines.push(`  Recommended: ${money(rec.recommendedBudget)}`);
      lines.push(`  Average Spending: ${money(rec.averageSpending)}`);
      lines.push(`  Trend: ${rec.spendingTrend} (${formatDecimal(rec.trendPercentage, 0)}%)`);
      lines.push(`  Confidence: ${formatDecimal(rec.confidence * 100, 0)}%`);
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
