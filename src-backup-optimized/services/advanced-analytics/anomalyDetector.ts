import { toDecimal } from '../../utils/decimal';
import { subMonths } from 'date-fns';
import type { Transaction } from '../../types';
import type { SpendingAnomaly, CategoryStatistics } from './types';
import type { DecimalInstance } from '../../types/decimal-types';

/**
 * Anomaly detection for spending patterns
 * Uses statistical methods to identify unusual transactions
 */
export class AnomalyDetector {
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
      
      const amount = toDecimal(Math.abs(transaction.amount));
      const threshold = stats.mean.plus(stats.stdDev.times(2)); // 2 standard deviations
      
      if (amount.greaterThan(threshold)) {
        const percentageAbove = amount.minus(stats.mean).div(stats.mean).times(100).toNumber();
        
        anomalies.push({
          id: transaction.id,
          date: new Date(transaction.date),
          description: transaction.description,
          amount,
          category: transaction.category || 'Uncategorized',
          severity: this.calculateSeverity(percentageAbove),
          reason: `Amount is ${percentageAbove.toFixed(0)}% above average for ${transaction.category}`,
          percentageAboveNormal: percentageAbove
        });
      }
    });
    
    return anomalies.sort((a, b) => b.percentageAboveNormal - a.percentageAboveNormal);
  }

  /**
   * Calculate statistics for each category
   */
  private calculateCategoryStatistics(transactions: Transaction[]): Map<string, CategoryStatistics> {
    const categoryGroups = new Map<string, DecimalInstance[]>();
    
    // Group transactions by category
    transactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(toDecimal(Math.abs(t.amount)));
    });
    
    // Calculate statistics for each category
    const categoryStats = new Map<string, CategoryStatistics>();
    
    categoryGroups.forEach((amounts, category) => {
      if (amounts.length === 0) return;
      
      const sorted = [...amounts].sort((a, b) => a.minus(b).toNumber());
      const total = amounts.reduce((sum, a) => sum.plus(a), toDecimal(0));
      const mean = total.div(amounts.length);
      
      // Calculate median
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0
        ? sorted[mid - 1].plus(sorted[mid]).div(2)
        : sorted[mid];
      
      // Calculate standard deviation
      const variance = amounts.reduce(
        (sum, amount) => sum.plus(amount.minus(mean).pow(2)),
        toDecimal(0)
      ).div(amounts.length);
      const stdDev = toDecimal(Math.sqrt(variance.toNumber()));
      
      categoryStats.set(category, {
        category,
        mean,
        median,
        stdDev,
        max: sorted[sorted.length - 1],
        min: sorted[0],
        count: amounts.length,
        total
      });
    });
    
    return categoryStats;
  }

  /**
   * Calculate anomaly severity
   */
  private calculateSeverity(percentageAboveNormal: number): 'low' | 'medium' | 'high' {
    if (percentageAboveNormal > 200) return 'high';
    if (percentageAboveNormal > 100) return 'medium';
    return 'low';
  }

  /**
   * Detect unusual patterns in transaction timing
   */
  detectTimingAnomalies(transactions: Transaction[]): SpendingAnomaly[] {
    const anomalies: SpendingAnomaly[] = [];
    
    // Group transactions by merchant
    const merchantGroups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      const merchant = t.description.split(' ')[0]; // Simple merchant extraction
      if (!merchantGroups.has(merchant)) {
        merchantGroups.set(merchant, []);
      }
      merchantGroups.get(merchant)!.push(t);
    });
    
    // Check for unusual timing patterns
    merchantGroups.forEach((txns, merchant) => {
      if (txns.length < 3) return;
      
      // Calculate average days between transactions
      const dates = txns.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
      const intervals: number[] = [];
      
      for (let i = 1; i < dates.length; i++) {
        intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      }
      
      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      
      // Check recent transactions for timing anomalies
      const lastInterval = intervals[intervals.length - 1];
      if (lastInterval < avgInterval * 0.5) {
        const lastTxn = txns[txns.length - 1];
        anomalies.push({
          id: lastTxn.id,
          date: new Date(lastTxn.date),
          description: lastTxn.description,
          amount: toDecimal(Math.abs(lastTxn.amount)),
          category: lastTxn.category || 'Uncategorized',
          severity: 'medium',
          reason: `Unusually frequent transaction for ${merchant}`,
          percentageAboveNormal: 0
        });
      }
    });
    
    return anomalies;
  }
}

export const anomalyDetector = new AnomalyDetector();