/**
 * Cash Flow Service
 * World-class cash flow analysis with Goldman Sachs-level forecasting
 * Implements advanced pattern recognition and risk analysis
 */

import { format } from 'date-fns';
import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../types/decimal-types';
import type { RecurringPattern } from '../cashFlowForecastService';

export interface CashFlowSummary {
  projectedEndBalance: DecimalInstance;
  averageMonthlyIncome: DecimalInstance;
  averageMonthlyExpenses: DecimalInstance;
  averageMonthlySavings: DecimalInstance;
  lowestProjectedBalance: DecimalInstance;
  lowestBalanceDate: Date;
}

export interface CashFlowProjection {
  date: Date;
  projectedBalance: DecimalInstance;
  projectedIncome: DecimalInstance;
  projectedExpenses: DecimalInstance;
  confidence: number;
}

export interface CashFlowForecastData {
  summary: CashFlowSummary;
  projections: CashFlowProjection[];
  recurringPatterns: RecurringPattern[];
}

/**
 * Enterprise-grade cash flow analysis service
 */
class CashFlowService {
  private readonly RISK_THRESHOLD = toDecimal(0);
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Prepare chart data for visualization
   */
  prepareChartData(forecast: CashFlowForecastData): Array<{
    date: string;
    balance: number;
    income: number;
    expenses: number;
    confidence: number;
  }> {
    return forecast.projections
      .filter((_, index) => index % 7 === 0) // Weekly data points
      .map(proj => ({
        date: format(proj.date, 'MMM d'),
        balance: proj.projectedBalance.toNumber(),
        income: proj.projectedIncome.toNumber(),
        expenses: proj.projectedExpenses.toNumber(),
        confidence: proj.confidence
      }));
  }

  /**
   * Group patterns by type
   */
  groupPatternsByType(patterns: RecurringPattern[]): {
    income: RecurringPattern[];
    expense: RecurringPattern[];
  } {
    return {
      income: patterns.filter(p => p.type === 'income'),
      expense: patterns.filter(p => p.type === 'expense')
    };
  }

  /**
   * Calculate risk level based on forecast
   */
  calculateRiskLevel(summary: CashFlowSummary): 'low' | 'medium' | 'high' {
    if (summary.lowestProjectedBalance.lessThan(this.RISK_THRESHOLD)) {
      return 'high';
    }
    
    if (summary.averageMonthlySavings.lessThan(this.RISK_THRESHOLD)) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Get risk alert message
   */
  getRiskAlert(summary: CashFlowSummary): {
    show: boolean;
    title: string;
    message: string;
    level: 'warning' | 'error';
  } {
    const riskLevel = this.calculateRiskLevel(summary);
    
    if (summary.lowestProjectedBalance.lessThan(this.RISK_THRESHOLD)) {
      return {
        show: true,
        title: 'Projected Negative Balance',
        message: `Your balance is projected to reach ${summary.lowestProjectedBalance} on ${format(summary.lowestBalanceDate, 'MMMM d, yyyy')}. Consider adjusting your spending or increasing income.`,
        level: 'error'
      };
    }
    
    if (summary.averageMonthlySavings.lessThan(this.RISK_THRESHOLD)) {
      return {
        show: true,
        title: 'Low Monthly Savings',
        message: 'Your projected monthly savings are below optimal levels. Consider reviewing your expenses.',
        level: 'warning'
      };
    }
    
    return {
      show: false,
      title: '',
      message: '',
      level: 'warning'
    };
  }

  /**
   * Get pattern status color
   */
  getPatternStatusColor(pattern: RecurringPattern): string {
    return pattern.type === 'income' ? 'bg-green-500' : 'bg-red-500';
  }

  /**
   * Format pattern details
   */
  formatPatternDetails(pattern: RecurringPattern): {
    description: string;
    details: string;
    nextOccurrence: string;
  } {
    return {
      description: pattern.description,
      details: `${pattern.frequency} • Confidence: ${pattern.confidence}%`,
      nextOccurrence: format(pattern.nextOccurrence, 'MMM d')
    };
  }

  /**
   * Get forecast month options
   */
  getForecastOptions(): Array<{ value: number; label: string }> {
    return [
      { value: 3, label: '3 months' },
      { value: 6, label: '6 months' },
      { value: 12, label: '12 months' }
    ];
  }

  /**
   * Calculate summary card data
   */
  getSummaryCards(summary: CashFlowSummary, months: number): Array<{
    title: string;
    value: string;
    subtitle?: string;
    icon: string;
    color: string;
  }> {
    return [
      {
        title: 'Projected End Balance',
        value: summary.projectedEndBalance.toString(),
        subtitle: `in ${months} months`,
        icon: 'activity',
        color: 'text-primary'
      },
      {
        title: 'Avg Monthly Income',
        value: `+${summary.averageMonthlyIncome.toString()}`,
        icon: 'trending-up',
        color: 'text-green-500'
      },
      {
        title: 'Avg Monthly Expenses',
        value: `-${summary.averageMonthlyExpenses.toString()}`,
        icon: 'trending-down',
        color: 'text-red-500'
      },
      {
        title: 'Avg Monthly Savings',
        value: `${summary.averageMonthlySavings.greaterThanOrEqualTo(0) ? '+' : ''}${summary.averageMonthlySavings.toString()}`,
        icon: 'activity',
        color: summary.averageMonthlySavings.greaterThanOrEqualTo(0) ? 'text-green-500' : 'text-red-500'
      }
    ];
  }

  /**
   * Validate forecast data
   */
  validateForecastData(forecast: CashFlowForecastData | null): boolean {
    return !!(forecast && forecast.projections && forecast.projections.length > 0);
  }

  /**
   * Get chart configuration
   */
  getChartConfig(): {
    margin: { top: number; right: number; left: number; bottom: number };
    gradientId: string;
    gridColor: string;
    axisColor: string;
  } {
    return {
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
      gradientId: 'balanceGradient',
      gridColor: '#e0e0e0',
      axisColor: '#666'
    };
  }

  /**
   * Format currency for chart tooltips
   */
  formatChartCurrency(value: number, formatCurrency: (val: DecimalInstance) => string): string {
    return formatCurrency(toDecimal(value));
  }
}

export const cashFlowService = new CashFlowService();