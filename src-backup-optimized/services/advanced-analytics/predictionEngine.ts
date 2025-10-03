import { toDecimal } from '../../utils/decimal';
import { subMonths, startOfMonth } from 'date-fns';
import { TimeSeriesAnalysis } from '../timeSeriesAnalysis';
import type { Transaction } from '../../types';
import type { SpendingPrediction, PredictionResult } from './types';
import type { TimeSeriesData } from '../timeSeriesAnalysis';
import Decimal from 'decimal.js';

type DecimalInstance = InstanceType<typeof Decimal>;

/**
 * Prediction engine for future spending
 * Uses time series analysis and machine learning techniques
 */
export class PredictionEngine {

  /**
   * Predict future spending by category
   */
  predictSpending(
    transactions: Transaction[],
    monthsToPredict: number = 3
  ): PredictionResult {
    const predictions: SpendingPrediction[] = [];
    const today = new Date();
    const lookbackDate = subMonths(today, 12); // Use 12 months of history
    
    // Filter to expense transactions
    const expenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date) >= lookbackDate
    );
    
    // Group by category
    const categoryGroups = this.groupByCategory(expenses);
    
    categoryGroups.forEach((txns, category) => {
      if (txns.length < 6) return; // Need minimum data points
      
      // Prepare time series data
      const timeSeriesData = this.prepareTimeSeriesData(txns);
      
      // Perform time series analysis
      const forecast = TimeSeriesAnalysis.forecast(
        timeSeriesData,
        monthsToPredict
      );
      
      // Calculate statistics
      const amounts = txns.map(t => toDecimal(Math.abs(t.amount)));
      const monthlyAverage = amounts.reduce((sum, a) => sum.plus(a), toDecimal(0))
        .div(amounts.length);
      
      // Determine trend
      const trend = this.determineTrend(timeSeriesData);
      
      // Create prediction
      const latestForecast = forecast[forecast.length - 1];
      predictions.push({
        category,
        predictedAmount: latestForecast ? toDecimal(latestForecast.value) : toDecimal(0),
        confidence: latestForecast ? latestForecast.confidence : 0,
        trend,
        monthlyAverage,
        recommendation: this.generateRecommendation(trend, latestForecast ? latestForecast.confidence : 0)
      });
    });
    
    return {
      predictions: predictions.sort((a, b) => 
        b.predictedAmount.minus(a.predictedAmount).toNumber()
      ),
      confidence: this.calculateOverallConfidence(predictions),
      methodology: 'ARIMA time series analysis',
      dataPoints: expenses.length
    };
  }

  /**
   * Group transactions by category
   */
  private groupByCategory(transactions: Transaction[]): Map<string, Transaction[]> {
    const groups = new Map<string, Transaction[]>();
    
    transactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(t);
    });
    
    return groups;
  }

  /**
   * Prepare time series data from transactions
   */
  private prepareTimeSeriesData(transactions: Transaction[]): TimeSeriesData[] {
    // Group by month
    const monthlyTotals = new Map<string, number>();
    
    transactions.forEach(t => {
      const month = startOfMonth(new Date(t.date)).toISOString();
      const current = monthlyTotals.get(month) || 0;
      monthlyTotals.set(month, current + Math.abs(t.amount));
    });
    
    // Convert to time series format
    const dates = Array.from(monthlyTotals.keys()).sort();
    
    return dates.map(d => ({
      date: new Date(d),
      value: toDecimal(monthlyTotals.get(d) || 0)
    }));
  }

  /**
   * Determine spending trend
   */
  private determineTrend(data: TimeSeriesData[]): 'increasing' | 'stable' | 'decreasing' {
    if (data.length < 3) return 'stable';
    
    // Calculate linear regression slope
    const n = data.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const values = data.map(d => d.value.toNumber());
    
    const sumX = indices.reduce((sum, x) => sum + x, 0);
    const sumY = values.reduce((sum, y) => sum + y, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;
    const slopePercentage = (slope / avgValue) * 100;
    
    if (slopePercentage > 5) return 'increasing';
    if (slopePercentage < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate recommendation based on prediction
   */
  private generateRecommendation(
    trend: 'increasing' | 'stable' | 'decreasing',
    confidence: number
  ): string {
    if (confidence < 60) {
      return 'Insufficient data for reliable prediction';
    }
    
    switch (trend) {
      case 'increasing':
        return 'Consider setting a budget limit for this category';
      case 'decreasing':
        return 'Great job reducing spending in this category';
      case 'stable':
        return 'Spending is consistent - maintain current habits';
    }
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(predictions: SpendingPrediction[]): number {
    if (predictions.length === 0) return 0;
    
    const totalConfidence = predictions.reduce(
      (sum, p) => sum + p.confidence,
      0
    );
    
    return totalConfidence / predictions.length;
  }

  /**
   * Predict cash flow
   */
  predictCashFlow(
    transactions: Transaction[],
    startingBalance: number,
    daysToPredict: number = 30
  ): Array<{ date: Date; predictedBalance: number; confidence: number }> {
    const predictions: Array<{ date: Date; predictedBalance: number; confidence: number }> = [];
    let currentBalance = toDecimal(startingBalance);
    const today = new Date();
    
    // Get historical patterns
    const patterns = this.analyzeHistoricalPatterns(transactions);
    
    for (let day = 1; day <= daysToPredict; day++) {
      const predictedDate = new Date(today);
      predictedDate.setDate(today.getDate() + day);
      
      // Predict transactions for this day
      const predictedTransactions = this.predictDailyTransactions(
        predictedDate,
        patterns
      );
      
      // Update balance
      const dailyNet = predictedTransactions.reduce(
        (sum, t) => sum.plus(t.amount),
        toDecimal(0)
      );
      currentBalance = currentBalance.plus(dailyNet);
      
      predictions.push({
        date: predictedDate,
        predictedBalance: currentBalance.toNumber(),
        confidence: this.calculateDayConfidence(day)
      });
    }
    
    return predictions;
  }

  /**
   * Analyze historical patterns
   */
  private analyzeHistoricalPatterns(transactions: Transaction[]) {
    // Simplified pattern analysis
    const dayOfWeekPatterns = new Map<number, number[]>();
    const dayOfMonthPatterns = new Map<number, number[]>();
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      const dayOfWeek = date.getDay();
      const dayOfMonth = date.getDate();
      
      if (!dayOfWeekPatterns.has(dayOfWeek)) {
        dayOfWeekPatterns.set(dayOfWeek, []);
      }
      dayOfWeekPatterns.get(dayOfWeek)!.push(t.amount);
      
      if (!dayOfMonthPatterns.has(dayOfMonth)) {
        dayOfMonthPatterns.set(dayOfMonth, []);
      }
      dayOfMonthPatterns.get(dayOfMonth)!.push(t.amount);
    });
    
    return { dayOfWeekPatterns, dayOfMonthPatterns };
  }

  /**
   * Predict transactions for a specific day
   */
  private predictDailyTransactions(
    date: Date,
    patterns: ReturnType<typeof this.analyzeHistoricalPatterns>
  ) {
    const predictions: Array<{ amount: DecimalInstance }> = [];
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    
    // Get patterns for this day
    const weekPatterns = patterns.dayOfWeekPatterns.get(dayOfWeek) || [];
    const monthPatterns = patterns.dayOfMonthPatterns.get(dayOfMonth) || [];
    
    // Simple average prediction
    if (weekPatterns.length > 0) {
      const avg = weekPatterns.reduce((sum, a) => sum + a, 0) / weekPatterns.length;
      predictions.push({ amount: toDecimal(avg) });
    }
    
    return predictions;
  }

  /**
   * Calculate confidence based on prediction distance
   */
  private calculateDayConfidence(daysAhead: number): number {
    // Confidence decreases with time
    const baseConfidence = 95;
    const decayRate = 2; // 2% per day
    return Math.max(50, baseConfidence - (daysAhead * decayRate));
  }
}

export const predictionEngine = new PredictionEngine();