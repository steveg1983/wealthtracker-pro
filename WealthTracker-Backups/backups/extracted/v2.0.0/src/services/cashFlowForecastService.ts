import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import type { Transaction, Account } from '../types';
import { addDays, addWeeks, addMonths, addYears, isAfter, isBefore, isSameDay, startOfMonth, endOfMonth, format } from 'date-fns';

export interface RecurringPattern {
  id: string;
  description: string;
  amount: DecimalInstance;
  type: 'income' | 'expense';
  category: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  confidence: number; // 0-100
  lastOccurrence: Date;
  nextOccurrence: Date;
  accountId?: string;
}

export interface CashFlowProjection {
  date: Date;
  projectedBalance: DecimalInstance;
  projectedIncome: DecimalInstance;
  projectedExpenses: DecimalInstance;
  recurringTransactions: RecurringPattern[];
  confidence: number;
}

export interface ForecastResult {
  projections: CashFlowProjection[];
  recurringPatterns: RecurringPattern[];
  summary: {
    averageMonthlyIncome: DecimalInstance;
    averageMonthlyExpenses: DecimalInstance;
    averageMonthlySavings: DecimalInstance;
    projectedEndBalance: DecimalInstance;
    lowestProjectedBalance: DecimalInstance;
    lowestBalanceDate: Date;
  };
}

class CashFlowForecastService {
  /**
   * Detect recurring patterns in transactions
   */
  detectRecurringPatterns(transactions: Transaction[]): RecurringPattern[] {
    const patterns: RecurringPattern[] = [];
    const grouped = this.groupSimilarTransactions(transactions);
    
    grouped.forEach((group) => {
      const pattern = this.analyzeTransactionGroup(group);
      if (pattern && pattern.confidence >= 70) {
        patterns.push(pattern);
      }
    });
    
    return patterns;
  }

  /**
   * Group similar transactions by description and amount
   */
  private groupSimilarTransactions(transactions: Transaction[]): Transaction[][] {
    const groups = new Map<string, Transaction[]>();
    
    transactions.forEach(transaction => {
      // Create a key based on normalized description and amount range
      const normalizedDesc = this.normalizeDescription(transaction.description);
      const amountRange = Math.floor(transaction.amount / 10) * 10; // Group by 10s
      const key = `${normalizedDesc}:${amountRange}:${transaction.type}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(transaction);
    });
    
    // Filter out groups with less than 3 occurrences
    return Array.from(groups.values()).filter(group => group.length >= 3);
  }

  /**
   * Normalize transaction description for grouping
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/[0-9]/g, '') // Remove numbers
      .replace(/[^a-z\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .split(' ')
      .slice(0, 3) // Take first 3 words
      .join(' ');
  }

  /**
   * Analyze a group of similar transactions to detect patterns
   */
  private analyzeTransactionGroup(transactions: Transaction[]): RecurringPattern | null {
    if (transactions.length < 3) return null;
    
    // Sort by date
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round(
        (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }
    
    // Detect frequency pattern
    const frequency = this.detectFrequency(intervals);
    if (!frequency) return null;
    
    // Calculate average amount
    const avgAmount = sorted.reduce((sum, t) => sum + t.amount, 0) / sorted.length;
    
    // Calculate confidence based on consistency
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, i) => 
      sum + Math.pow(i - avgInterval, 2), 0
    ) / intervals.length;
    const intervalStdDev = Math.sqrt(intervalVariance);
    
    // Confidence is higher when intervals are more consistent
    const confidence = Math.max(0, Math.min(100, 100 - (intervalStdDev / avgInterval * 100)));
    
    const lastTransaction = sorted[sorted.length - 1];
    const nextOccurrence = this.calculateNextOccurrence(
      new Date(lastTransaction.date), 
      frequency
    );
    
    return {
      id: `pattern-${Date.now()}-${Math.random()}`,
      description: lastTransaction.description,
      amount: toDecimal(avgAmount),
      type: lastTransaction.type as 'income' | 'expense',
      category: lastTransaction.category,
      frequency,
      confidence: Math.round(confidence),
      lastOccurrence: new Date(lastTransaction.date),
      nextOccurrence,
      accountId: lastTransaction.accountId,
      dayOfMonth: frequency === 'monthly' ? new Date(lastTransaction.date).getDate() : undefined,
      dayOfWeek: frequency === 'weekly' ? new Date(lastTransaction.date).getDay() : undefined
    };
  }

  /**
   * Detect frequency from intervals
   */
  private detectFrequency(intervals: number[]): RecurringPattern['frequency'] | null {
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    
    // Define frequency ranges (in days)
    const frequencies: Array<[RecurringPattern['frequency'], number, number]> = [
      ['daily', 1, 2],
      ['weekly', 6, 8],
      ['biweekly', 13, 15],
      ['monthly', 28, 32],
      ['quarterly', 88, 92],
      ['yearly', 360, 370]
    ];
    
    for (const [freq, min, max] of frequencies) {
      if (avgInterval >= min && avgInterval <= max) {
        return freq;
      }
    }
    
    return null;
  }

  /**
   * Calculate next occurrence based on frequency
   */
  private calculateNextOccurrence(lastDate: Date, frequency: RecurringPattern['frequency']): Date {
    switch (frequency) {
      case 'daily':
        return addDays(lastDate, 1);
      case 'weekly':
        return addWeeks(lastDate, 1);
      case 'biweekly':
        return addWeeks(lastDate, 2);
      case 'monthly':
        return addMonths(lastDate, 1);
      case 'quarterly':
        return addMonths(lastDate, 3);
      case 'yearly':
        return addYears(lastDate, 1);
    }
  }

  /**
   * Generate cash flow projections
   */
  generateProjections(
    accounts: Account[],
    transactions: Transaction[],
    recurringPatterns: RecurringPattern[],
    startDate: Date,
    endDate: Date
  ): CashFlowProjection[] {
    const projections: CashFlowProjection[] = [];
    let currentDate = new Date(startDate);
    
    // Calculate starting balance
    let currentBalance = accounts.reduce((sum, acc) => 
      sum.plus(toDecimal(acc.balance)), 
      toDecimal(0)
    );
    
    while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
      const dayPatterns = this.getPatternsForDate(recurringPatterns, currentDate);
      
      const projectedIncome = dayPatterns
        .filter(p => p.type === 'income')
        .reduce((sum, p) => sum.plus(p.amount), toDecimal(0));
        
      const projectedExpenses = dayPatterns
        .filter(p => p.type === 'expense')
        .reduce((sum, p) => sum.plus(p.amount), toDecimal(0));
      
      currentBalance = currentBalance.plus(projectedIncome).minus(projectedExpenses);
      
      // Calculate confidence as average of pattern confidences
      const confidence = dayPatterns.length > 0
        ? dayPatterns.reduce((sum, p) => sum + p.confidence, 0) / dayPatterns.length
        : 100; // 100% confidence for days with no patterns
      
      projections.push({
        date: new Date(currentDate),
        projectedBalance: currentBalance,
        projectedIncome,
        projectedExpenses,
        recurringTransactions: dayPatterns,
        confidence: Math.round(confidence)
      });
      
      currentDate = addDays(currentDate, 1);
    }
    
    return projections;
  }

  /**
   * Get patterns that occur on a specific date
   */
  private getPatternsForDate(patterns: RecurringPattern[], date: Date): RecurringPattern[] {
    return patterns.filter(pattern => {
      let checkDate = new Date(pattern.lastOccurrence);
      
      while (isBefore(checkDate, date) || isSameDay(checkDate, date)) {
        if (isSameDay(checkDate, date)) {
          return true;
        }
        checkDate = this.calculateNextOccurrence(checkDate, pattern.frequency);
      }
      
      return false;
    });
  }

  /**
   * Generate a complete forecast
   */
  forecast(
    accounts: Account[],
    transactions: Transaction[],
    months: number = 6
  ): ForecastResult {
    // Filter to recent transactions (last 12 months for pattern detection)
    const twelveMonthsAgo = addMonths(new Date(), -12);
    const recentTransactions = transactions.filter(t => 
      isAfter(new Date(t.date), twelveMonthsAgo)
    );
    
    // Detect patterns
    const recurringPatterns = this.detectRecurringPatterns(recentTransactions);
    
    // Generate projections
    const startDate = new Date();
    const endDate = addMonths(startDate, months);
    const projections = this.generateProjections(
      accounts,
      transactions,
      recurringPatterns,
      startDate,
      endDate
    );
    
    // Calculate summary statistics
    const monthlyIncome: DecimalInstance[] = [];
    const monthlyExpenses: DecimalInstance[] = [];
    
    // Group projections by month
    const monthlyGroups = new Map<string, CashFlowProjection[]>();
    projections.forEach(proj => {
      const monthKey = format(proj.date, 'yyyy-MM');
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, []);
      }
      monthlyGroups.get(monthKey)!.push(proj);
    });
    
    // Calculate monthly totals
    monthlyGroups.forEach((monthProjections) => {
      const income = monthProjections.reduce((sum, p) => 
        sum.plus(p.projectedIncome), toDecimal(0)
      );
      const expenses = monthProjections.reduce((sum, p) => 
        sum.plus(p.projectedExpenses), toDecimal(0)
      );
      
      monthlyIncome.push(income);
      monthlyExpenses.push(expenses);
    });
    
    // Find lowest balance
    let lowestBalance = projections[0]?.projectedBalance || toDecimal(0);
    let lowestBalanceDate = projections[0]?.date || new Date();
    
    projections.forEach(proj => {
      if (proj.projectedBalance.lessThan(lowestBalance)) {
        lowestBalance = proj.projectedBalance;
        lowestBalanceDate = proj.date;
      }
    });
    
    // Calculate averages
    const avgMonthlyIncome = monthlyIncome.length > 0
      ? monthlyIncome.reduce((sum, i) => sum.plus(i), toDecimal(0))
          .dividedBy(toDecimal(monthlyIncome.length))
      : toDecimal(0);
      
    const avgMonthlyExpenses = monthlyExpenses.length > 0
      ? monthlyExpenses.reduce((sum, e) => sum.plus(e), toDecimal(0))
          .dividedBy(toDecimal(monthlyExpenses.length))
      : toDecimal(0);
    
    return {
      projections,
      recurringPatterns,
      summary: {
        averageMonthlyIncome: avgMonthlyIncome,
        averageMonthlyExpenses: avgMonthlyExpenses,
        averageMonthlySavings: avgMonthlyIncome.minus(avgMonthlyExpenses),
        projectedEndBalance: projections[projections.length - 1]?.projectedBalance || toDecimal(0),
        lowestProjectedBalance: lowestBalance,
        lowestBalanceDate: lowestBalanceDate
      }
    };
  }

  /**
   * Analyze seasonal trends
   */
  analyzeSeasonalTrends(transactions: Transaction[]): Map<number, { income: DecimalInstance; expenses: DecimalInstance }> {
    const monthlyTrends = new Map<number, { income: DecimalInstance; expenses: DecimalInstance }>();
    
    // Initialize all months
    for (let month = 0; month < 12; month++) {
      monthlyTrends.set(month, { 
        income: toDecimal(0), 
        expenses: toDecimal(0) 
      });
    }
    
    // Group by month
    const monthCounts = new Map<number, number>();
    
    transactions.forEach(transaction => {
      const month = new Date(transaction.date).getMonth();
      const current = monthlyTrends.get(month)!;
      
      if (transaction.type === 'income') {
        current.income = current.income.plus(toDecimal(transaction.amount));
      } else if (transaction.type === 'expense') {
        current.expenses = current.expenses.plus(toDecimal(transaction.amount));
      }
      
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    });
    
    // Calculate averages
    monthlyTrends.forEach((trend, month) => {
      const count = monthCounts.get(month) || 1;
      const years = Math.max(1, count / 30); // Approximate years
      
      monthlyTrends.set(month, {
        income: trend.income.dividedBy(toDecimal(years)),
        expenses: trend.expenses.dividedBy(toDecimal(years))
      });
    });
    
    return monthlyTrends;
  }
}

export const cashFlowForecastService = new CashFlowForecastService();