/**
 * Correlation Analyzer Module
 * Analyzes relationships between financial metrics
 */

import * as ss from 'simple-statistics';
import { format, parseISO } from 'date-fns';
import type { Transaction } from '../../types';
import type { CorrelationResult } from './types';
import { timeIntelligence } from './timeIntelligence';

export class CorrelationAnalyzer {
  /**
   * Calculate correlations between metrics
   */
  calculateCorrelations(
    transactions: Transaction[],
    metrics: Array<'income' | 'expenses' | 'savings' | 'categories'>
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const monthlyData = new Map<string, Map<string, number>>();

    // Aggregate data by month for each metric
    const months = timeIntelligence.getUniqueMonths(transactions);
    
    months.forEach(month => {
      const monthTransactions = transactions.filter(t => 
        format(typeof t.date === 'string' ? parseISO(t.date) : t.date, 'yyyy-MM') === month
      );
      
      const monthMetrics = new Map<string, number>();
      
      if (metrics.includes('income')) {
        monthMetrics.set('income', this.calculateMetric(monthTransactions, 'income'));
      }
      if (metrics.includes('expenses')) {
        monthMetrics.set('expenses', this.calculateMetric(monthTransactions, 'expenses'));
      }
      if (metrics.includes('savings')) {
        const income = this.calculateMetric(monthTransactions, 'income');
        const expenses = this.calculateMetric(monthTransactions, 'expenses');
        monthMetrics.set('savings', income - expenses);
      }
      if (metrics.includes('categories')) {
        const categories = this.countUniqueCategories(monthTransactions);
        monthMetrics.set('categories', categories);
      }
      
      monthlyData.set(month, monthMetrics);
    });

    // Calculate pairwise correlations
    const metricNames = Array.from(
      new Set(Array.from(monthlyData.values()).flatMap(m => Array.from(m.keys())))
    );
    
    for (let i = 0; i < metricNames.length; i++) {
      for (let j = i + 1; j < metricNames.length; j++) {
        const metric1 = metricNames[i];
        const metric2 = metricNames[j];
        
        const values1: number[] = [];
        const values2: number[] = [];
        
        monthlyData.forEach(monthMetrics => {
          const v1 = monthMetrics.get(metric1);
          const v2 = monthMetrics.get(metric2);
          if (v1 !== undefined && v2 !== undefined) {
            values1.push(v1);
            values2.push(v2);
          }
        });
        
        if (values1.length >= 3) {
          const correlation = ss.sampleCorrelation(values1, values2);
          const absCorr = Math.abs(correlation);
          
          results.push({
            variable1: metric1,
            variable2: metric2,
            correlation,
            pValue: this.calculatePValue(correlation, values1.length),
            strength: absCorr > 0.7 ? 'strong' : 
                     absCorr > 0.4 ? 'moderate' : 
                     absCorr > 0.2 ? 'weak' : 'none',
            direction: correlation > 0 ? 'positive' : 
                      correlation < 0 ? 'negative' : 'none'
          });
        }
      }
    }

    return results;
  }

  /**
   * Analyze correlation between categories and spending
   */
  analyzeCategoryCorrelations(transactions: Transaction[]): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const categories = this.getUniqueCategories(transactions);
    const months = timeIntelligence.getUniqueMonths(transactions);
    
    // Build time series for each category
    const categoryData = new Map<string, number[]>();
    
    categories.forEach(category => {
      const values: number[] = [];
      
      months.forEach(month => {
        const monthTransactions = transactions.filter(t => 
          t.category === category && 
          format(typeof t.date === 'string' ? parseISO(t.date) : t.date, 'yyyy-MM') === month
        );
        
        const spending = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
        values.push(spending);
      });
      
      categoryData.set(category, values);
    });
    
    // Calculate correlations between categories
    const categoryList = Array.from(categoryData.keys());
    
    for (let i = 0; i < categoryList.length; i++) {
      for (let j = i + 1; j < categoryList.length; j++) {
        const cat1 = categoryList[i];
        const cat2 = categoryList[j];
        const values1 = categoryData.get(cat1)!;
        const values2 = categoryData.get(cat2)!;
        
        if (values1.some(v => v > 0) && values2.some(v => v > 0)) {
          const correlation = ss.sampleCorrelation(values1, values2);
          const absCorr = Math.abs(correlation);
          
          results.push({
            variable1: cat1,
            variable2: cat2,
            correlation,
            pValue: this.calculatePValue(correlation, values1.length),
            strength: absCorr > 0.7 ? 'strong' : 
                     absCorr > 0.4 ? 'moderate' : 
                     absCorr > 0.2 ? 'weak' : 'none',
            direction: correlation > 0 ? 'positive' : 
                      correlation < 0 ? 'negative' : 'none'
          });
        }
      }
    }
    
    return results;
  }

  // Helper methods
  
  private calculateMetric(
    transactions: Transaction[],
    metric: 'income' | 'expenses'
  ): number {
    return transactions
      .filter(t => t.type === metric.slice(0, -1) as 'income' | 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  private countUniqueCategories(transactions: Transaction[]): number {
    const categories = new Set(transactions.map(t => t.category).filter(Boolean));
    return categories.size;
  }

  private getUniqueCategories(transactions: Transaction[]): string[] {
    const categories = new Set<string>();
    transactions.forEach(t => {
      if (t.category) categories.add(t.category);
    });
    return Array.from(categories);
  }

  private calculatePValue(correlation: number, n: number): number {
    // Fisher's z-transformation for correlation p-value
    const z = 0.5 * Math.log((1 + correlation) / (1 - correlation));
    const se = 1 / Math.sqrt(n - 3);
    const zScore = z / se;
    
    // Approximate p-value using normal distribution
    return 2 * (1 - this.normalCDF(Math.abs(zScore)));
  }

  private normalCDF(x: number): number {
    // Approximation of the cumulative distribution function for standard normal
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const y = 1 - ((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
  }
}

export const correlationAnalyzer = new CorrelationAnalyzer();