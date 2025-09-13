import type { Transaction } from '../../types';
import type { SpendingPattern, PatternDetectionOptions } from './types';
import { logger } from '../loggingService';

/**
 * Pattern analysis service
 * Detects spending patterns, trends, and anomalies
 */
export class PatternAnalyzer {
  private patterns: SpendingPattern[] = [];
  private readonly STORAGE_KEY = 'dataIntelligence_patterns';

  constructor() {
    this.loadPatterns();
  }

  /**
   * Load patterns from storage
   */
  private loadPatterns(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.patterns = JSON.parse(stored, (key, value) => {
          if (key === 'detectedAt') {
            return new Date(value);
          }
          return value;
        });
      }
    } catch (error) {
      logger.error('Failed to load patterns:', error);
    }
  }

  /**
   * Save patterns to storage
   */
  private savePatterns(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.patterns));
    } catch (error) {
      logger.error('Failed to save patterns:', error);
    }
  }

  /**
   * Detect spending patterns
   */
  detectPatterns(
    transactions: Transaction[],
    options: PatternDetectionOptions = {}
  ): SpendingPattern[] {
    const detectedPatterns: SpendingPattern[] = [];
    
    // Detect recurring patterns
    const recurring = this.detectRecurringPatterns(transactions, options);
    detectedPatterns.push(...recurring);
    
    // Detect seasonal patterns
    const seasonal = this.detectSeasonalPatterns(transactions, options);
    detectedPatterns.push(...seasonal);
    
    // Detect spending trends
    const trends = this.detectSpendingTrends(transactions, options);
    detectedPatterns.push(...trends);
    
    // Detect anomalies
    const anomalies = this.detectAnomalies(transactions, options);
    detectedPatterns.push(...anomalies);
    
    // Update stored patterns
    this.updatePatterns(detectedPatterns);
    
    return this.patterns;
  }

  /**
   * Detect recurring patterns
   */
  private detectRecurringPatterns(
    transactions: Transaction[],
    options: PatternDetectionOptions
  ): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    const minConfidence = options.minConfidence || 0.7;
    const minTransactions = options.minTransactions || 3;
    
    // Group by merchant and category
    const groups = this.groupTransactions(transactions);
    
    groups.forEach((txns, key) => {
      if (txns.length < minTransactions) return;
      
      // Check for regular intervals
      const intervals = this.calculateIntervals(txns);
      const isRecurring = this.isRecurring(intervals);
      
      if (isRecurring.confidence >= minConfidence) {
        patterns.push({
          id: `pattern-recurring-${key}-${Date.now()}`,
          patternType: 'recurring',
          category: txns[0].category || 'Uncategorized',
          merchant: this.extractMerchant(txns[0].description),
          frequency: isRecurring.frequency,
          amount: this.calculateAverageAmount(txns),
          variance: this.calculateVariance(txns),
          confidence: isRecurring.confidence,
          description: `Recurring ${isRecurring.frequency} pattern detected`,
          transactions: txns.map(t => t.id),
          detectedAt: new Date(),
          isActive: true
        });
      }
    });
    
    return patterns;
  }

  /**
   * Detect seasonal patterns
   */
  private detectSeasonalPatterns(
    transactions: Transaction[],
    options: PatternDetectionOptions
  ): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    const minConfidence = options.minConfidence || 0.6;
    
    // Group by category and month
    const monthlyGroups = this.groupByMonth(transactions);
    
    monthlyGroups.forEach((months, category) => {
      const seasonality = this.analyzeSeasonality(months);
      
      if (seasonality.confidence >= minConfidence) {
        patterns.push({
          id: `pattern-seasonal-${category}-${Date.now()}`,
          patternType: 'seasonal',
          category,
          frequency: seasonality.peakMonth,
          amount: seasonality.peakAmount,
          variance: seasonality.variance,
          confidence: seasonality.confidence,
          description: `Seasonal spending peaks in ${seasonality.peakMonth}`,
          transactions: [],
          detectedAt: new Date(),
          isActive: true
        });
      }
    });
    
    return patterns;
  }

  /**
   * Detect spending trends
   */
  private detectSpendingTrends(
    transactions: Transaction[],
    options: PatternDetectionOptions
  ): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    const lookbackDays = options.lookbackDays || 90;
    
    // Group by category
    const categoryGroups = this.groupByCategory(transactions);
    
    categoryGroups.forEach((txns, category) => {
      const trend = this.analyzeTrend(txns, lookbackDays);
      
      if (trend.isSignificant) {
        patterns.push({
          id: `pattern-trend-${category}-${Date.now()}`,
          patternType: 'trend',
          category,
          frequency: trend.direction,
          amount: trend.currentAverage,
          variance: trend.changeRate,
          confidence: trend.confidence,
          description: `Spending ${trend.direction} by ${Math.abs(trend.changeRate * 100).toFixed(1)}%`,
          transactions: txns.slice(-10).map(t => t.id), // Last 10 transactions
          detectedAt: new Date(),
          isActive: true
        });
      }
    });
    
    return patterns;
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(
    transactions: Transaction[],
    options: PatternDetectionOptions
  ): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    const minConfidence = options.minConfidence || 0.8;
    
    // Look for unusual transactions
    const recent = transactions.filter(t => 
      this.isRecent(new Date(t.date), 30)
    );
    
    recent.forEach(txn => {
      const isAnomaly = this.isAnomalous(txn, transactions);
      
      if (isAnomaly.confidence >= minConfidence) {
        patterns.push({
          id: `pattern-anomaly-${txn.id}`,
          patternType: 'anomaly',
          category: txn.category || 'Uncategorized',
          merchant: this.extractMerchant(txn.description),
          frequency: 'once',
          amount: Math.abs(txn.amount),
          variance: 0,
          confidence: isAnomaly.confidence,
          description: isAnomaly.reason,
          transactions: [txn.id],
          detectedAt: new Date(),
          isActive: true
        });
      }
    });
    
    return patterns;
  }

  /**
   * Helper methods
   */
  private groupTransactions(transactions: Transaction[]): Map<string, Transaction[]> {
    const groups = new Map<string, Transaction[]>();
    
    transactions.forEach(txn => {
      const key = `${this.extractMerchant(txn.description)}-${txn.category || 'none'}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(txn);
    });
    
    return groups;
  }

  private groupByMonth(transactions: Transaction[]): Map<string, Map<string, number>> {
    const groups = new Map<string, Map<string, number>>();
    
    transactions.forEach(txn => {
      const category = txn.category || 'Uncategorized';
      const month = new Date(txn.date).getMonth().toString();
      
      if (!groups.has(category)) {
        groups.set(category, new Map());
      }
      
      const monthMap = groups.get(category)!;
      const current = monthMap.get(month) || 0;
      monthMap.set(month, current + Math.abs(txn.amount));
    });
    
    return groups;
  }

  private groupByCategory(transactions: Transaction[]): Map<string, Transaction[]> {
    const groups = new Map<string, Transaction[]>();
    
    transactions.forEach(txn => {
      const category = txn.category || 'Uncategorized';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(txn);
    });
    
    return groups;
  }

  private calculateIntervals(transactions: Transaction[]): number[] {
    const sorted = transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round(
        (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }
    
    return intervals;
  }

  private isRecurring(intervals: number[]): { confidence: number; frequency: string } {
    if (intervals.length < 2) {
      return { confidence: 0, frequency: 'none' };
    }
    
    const avg = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const variance = this.calculateIntervalsVariance(intervals, avg);
    
    // Low variance indicates regular pattern
    if (variance < 0.3) {
      let frequency = 'irregular';
      if (avg >= 7 && avg <= 9) frequency = 'weekly';
      else if (avg >= 28 && avg <= 32) frequency = 'monthly';
      else if (avg >= 84 && avg <= 96) frequency = 'quarterly';
      else if (avg >= 358 && avg <= 372) frequency = 'yearly';
      
      return {
        confidence: 1 - variance,
        frequency
      };
    }
    
    return { confidence: 0, frequency: 'irregular' };
  }

  private calculateAverageAmount(transactions: Transaction[]): number {
    const sum = transactions.reduce((total, t) => total + Math.abs(t.amount), 0);
    return sum / transactions.length;
  }

  private calculateVariance(transactions: Transaction[]): number {
    const amounts = transactions.map(t => Math.abs(t.amount));
    const mean = this.calculateAverageAmount(transactions);
    const squaredDiffs = amounts.map(a => Math.pow(a - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / amounts.length;
    return Math.sqrt(avgSquaredDiff) / mean;
  }

  private calculateIntervalsVariance(intervals: number[], mean: number): number {
    const squaredDiffs = intervals.map(i => Math.pow(i - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / intervals.length;
    return Math.sqrt(avgSquaredDiff) / mean;
  }

  private analyzeSeasonality(monthlyAmounts: Map<string, number>) {
    // Simplified seasonality analysis
    let peakMonth = '';
    let peakAmount = 0;
    
    monthlyAmounts.forEach((amount, month) => {
      if (amount > peakAmount) {
        peakAmount = amount;
        peakMonth = this.getMonthName(parseInt(month));
      }
    });
    
    return {
      peakMonth,
      peakAmount,
      variance: 0.2,
      confidence: monthlyAmounts.size >= 3 ? 0.7 : 0.3
    };
  }

  private analyzeTrend(transactions: Transaction[], lookbackDays: number) {
    const recent = transactions.filter(t => 
      this.isRecent(new Date(t.date), lookbackDays)
    );
    
    const older = transactions.filter(t => 
      !this.isRecent(new Date(t.date), lookbackDays) &&
      this.isRecent(new Date(t.date), lookbackDays * 2)
    );
    
    if (recent.length === 0 || older.length === 0) {
      return { isSignificant: false, direction: 'stable', currentAverage: 0, changeRate: 0, confidence: 0 };
    }
    
    const recentAvg = this.calculateAverageAmount(recent);
    const olderAvg = this.calculateAverageAmount(older);
    const changeRate = (recentAvg - olderAvg) / olderAvg;
    
    return {
      isSignificant: Math.abs(changeRate) > 0.2,
      direction: changeRate > 0.1 ? 'increasing' : changeRate < -0.1 ? 'decreasing' : 'stable',
      currentAverage: recentAvg,
      changeRate,
      confidence: Math.min(recent.length / 10, 1) // More transactions = higher confidence
    };
  }

  private isAnomalous(transaction: Transaction, allTransactions: Transaction[]) {
    const categoryTxns = allTransactions.filter(t => 
      t.category === transaction.category && t.id !== transaction.id
    );
    
    if (categoryTxns.length < 5) {
      return { confidence: 0, reason: 'Insufficient data' };
    }
    
    const amounts = categoryTxns.map(t => Math.abs(t.amount));
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length
    );
    
    const txnAmount = Math.abs(transaction.amount);
    const zScore = (txnAmount - mean) / stdDev;
    
    if (Math.abs(zScore) > 2) {
      return {
        confidence: Math.min(Math.abs(zScore) / 3, 1),
        reason: `Amount is ${zScore > 0 ? 'unusually high' : 'unusually low'} for ${transaction.category}`
      };
    }
    
    return { confidence: 0, reason: '' };
  }

  private isRecent(date: Date, days: number): boolean {
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= days;
  }

  private extractMerchant(description: string): string {
    return description
      .replace(/\*\d+/, '')
      .replace(/#\d+/, '')
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .trim();
  }

  private getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
  }

  private updatePatterns(newPatterns: SpendingPattern[]): void {
    // Mark old patterns as inactive
    this.patterns.forEach(p => {
      if (!newPatterns.find(np => 
        np.patternType === p.patternType && 
        np.category === p.category &&
        np.merchant === p.merchant
      )) {
        p.isActive = false;
      }
    });
    
    // Add or update patterns
    newPatterns.forEach(pattern => {
      const existing = this.patterns.find(p => 
        p.patternType === pattern.patternType &&
        p.category === pattern.category &&
        p.merchant === pattern.merchant
      );
      
      if (existing) {
        Object.assign(existing, pattern);
      } else {
        this.patterns.push(pattern);
      }
    });
    
    this.savePatterns();
  }

  /**
   * Get all patterns
   */
  getPatterns(): SpendingPattern[] {
    return this.patterns;
  }

  /**
   * Get active patterns
   */
  getActivePatterns(): SpendingPattern[] {
    return this.patterns.filter(p => p.isActive);
  }
}

export const patternAnalyzer = new PatternAnalyzer();