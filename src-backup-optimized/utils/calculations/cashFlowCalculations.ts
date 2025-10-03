/**
 * Cash Flow Calculations Module
 * Cash flow analysis and trend calculations
 */

import type { Transaction } from '../../types';
import type { 
  CashFlowResult, 
  MonthlyTrendData, 
  CategoryTrendData, 
  BalanceHistoryData 
} from './types';
import { 
  calculateTotalIncome, 
  calculateTotalExpenses 
} from './coreCalculations';

/**
 * Calculate cash flow
 */
export function calculateCashFlow(transactions: Transaction[]): CashFlowResult {
  const totalIncome = calculateTotalIncome(transactions);
  const totalExpenses = calculateTotalExpenses(transactions);
  const netCashFlow = totalIncome - totalExpenses;
  const savingsRate = totalIncome === 0 ? 0 : (netCashFlow / totalIncome) * 100;
  
  return {
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate
  };
}

/**
 * Calculate balance history over time
 */
export function calculateBalanceHistory(
  transactions: Transaction[],
  startBalance: number,
  days: number = 30
): BalanceHistoryData[] {
  const balances: BalanceHistoryData[] = [];
  let currentBalance = startBalance;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const dayTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.toDateString() === date.toDateString();
    });
    
    dayTransactions.forEach(t => {
      if (t.type === 'income') {
        currentBalance += t.amount;
      } else if (t.type === 'expense') {
        currentBalance -= t.amount;
      }
    });
    
    balances.push({ date: new Date(date), balance: currentBalance });
  }
  
  return balances;
}

/**
 * Calculate monthly trends
 */
export function calculateMonthlyTrends(
  transactions: Transaction[],
  months: number = 6
): MonthlyTrendData[] {
  const trends: MonthlyTrendData[] = [];
  const today = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = date.toISOString().slice(0, 7);
    
    const monthTransactions = transactions.filter(t => {
      return new Date(t.date).toISOString().slice(0, 7) === monthStr;
    });
    
    const income = calculateTotalIncome(monthTransactions);
    const expenses = calculateTotalExpenses(monthTransactions);
    
    trends.push({
      month: monthStr,
      income,
      expenses,
      netIncome: income - expenses
    });
  }
  
  return trends;
}

/**
 * Calculate category trends
 */
export function calculateCategoryTrends(
  transactions: Transaction[],
  category: string,
  months: number = 6
): CategoryTrendData[] {
  const trends: CategoryTrendData[] = [];
  const today = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = date.toISOString().slice(0, 7);
    
    const monthTransactions = transactions.filter(t => {
      return new Date(t.date).toISOString().slice(0, 7) === monthStr &&
             t.category === category &&
             t.type === 'expense';
    });
    
    const amount = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    trends.push({ month: monthStr, amount });
  }
  
  return trends;
}

/**
 * Calculate burn rate (monthly expense rate)
 */
export function calculateBurnRate(
  transactions: Transaction[],
  months: number = 3
): number {
  const trends = calculateMonthlyTrends(transactions, months);
  if (trends.length === 0) return 0;
  
  const totalExpenses = trends.reduce((sum, trend) => sum + trend.expenses, 0);
  return totalExpenses / trends.length;
}

/**
 * Calculate runway (months until funds depleted)
 */
export function calculateRunway(
  currentBalance: number,
  burnRate: number
): number {
  if (burnRate <= 0) return Infinity;
  return currentBalance / burnRate;
}

/**
 * Calculate seasonal spending patterns
 */
export function calculateSeasonalPatterns(
  transactions: Transaction[]
): {
  month: string;
  averageSpending: number;
  variance: number;
}[] {
  const monthlySpending = new Map<string, number[]>();
  
  // Group spending by month name (Jan, Feb, etc.)
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const date = new Date(t.date);
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      if (!monthlySpending.has(monthName)) {
        monthlySpending.set(monthName, []);
      }
      monthlySpending.get(monthName)!.push(t.amount);
    });
  
  const patterns: { month: string; averageSpending: number; variance: number }[] = [];
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  monthOrder.forEach(month => {
    const amounts = monthlySpending.get(month) || [];
    if (amounts.length > 0) {
      const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const variance = amounts.reduce((sum, a) => sum + Math.pow(a - average, 2), 0) / amounts.length;
      
      patterns.push({
        month,
        averageSpending: average,
        variance: Math.sqrt(variance)
      });
    }
  });
  
  return patterns;
}