/**
 * Decimal-based calculation functions for precise financial calculations
 */

import Decimal from 'decimal.js';
import type { 
  DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal 
} from '../types/decimal-types';
import { sumDecimals } from './decimal';

// Type alias for cleaner code
type DecimalInstance = InstanceType<typeof Decimal>;

/**
 * Calculate total income from transactions
 */
export function calculateTotalIncome(transactions: DecimalTransaction[]): DecimalInstance {
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  return sumDecimals(incomeTransactions.map(t => t.amount));
}

/**
 * Calculate total expenses from transactions
 */
export function calculateTotalExpenses(transactions: DecimalTransaction[]): DecimalInstance {
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  return sumDecimals(expenseTransactions.map(t => t.amount));
}

/**
 * Calculate net income (income - expenses)
 */
export function calculateNetIncome(transactions: DecimalTransaction[]): DecimalInstance {
  const income = calculateTotalIncome(transactions);
  const expenses = calculateTotalExpenses(transactions);
  return income.minus(expenses);
}

/**
 * Calculate account balance including all transactions
 */
export function calculateAccountBalance(
  account: DecimalAccount,
  transactions: DecimalTransaction[]
): DecimalInstance {
  const accountTransactions = transactions.filter(t => t.accountId === account.id);
  const transactionSum = sumDecimals(accountTransactions.map(t => 
    t.type === 'income' ? t.amount : t.amount.negated()
  ));
  return account.balance.plus(transactionSum);
}

/**
 * Calculate total balance across all accounts
 */
export function calculateTotalBalance(accounts: DecimalAccount[]): DecimalInstance {
  return sumDecimals(accounts.map(a => a.balance));
}

/**
 * Calculate net worth (assets - liabilities)
 */
export function calculateNetWorth(accounts: DecimalAccount[]): DecimalInstance {
  // Simply sum all balances - liabilities should have negative balances
  return sumDecimals(accounts.map(a => a.balance));
}

/**
 * Calculate budget spending for a category
 */
export function calculateBudgetSpending(
  budget: DecimalBudget,
  transactions: DecimalTransaction[],
  startDate: Date,
  endDate: Date
): DecimalInstance {
  const budgetTransactions = transactions.filter(t => 
    t.type === 'expense' &&
    t.category === budget.categoryId &&
    t.date >= startDate &&
    t.date <= endDate
  );
  
  return sumDecimals(budgetTransactions.map(t => t.amount));
}

/**
 * Calculate budget remaining
 */
export function calculateBudgetRemaining(
  budget: DecimalBudget,
  spent: DecimalInstance
): DecimalInstance {
  const remaining = budget.amount.minus(spent);
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

/**
 * Calculate budget percentage
 */
export function calculateBudgetPercentage(
  budget: DecimalBudget,
  spent: DecimalInstance
): number {
  if (budget.amount.isZero()) return 0;
  return spent.dividedBy(budget.amount).times(100).toNumber();
}

/**
 * Calculate goal progress percentage
 */
export function calculateGoalProgress(goal: DecimalGoal): number {
  if (goal.targetAmount.isZero()) return 0;
  return goal.currentAmount.dividedBy(goal.targetAmount).times(100).toNumber();
}

/**
 * Calculate amount needed to reach goal
 */
export function calculateGoalRemaining(goal: DecimalGoal): DecimalInstance {
  const remaining = goal.targetAmount.minus(goal.currentAmount);
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

/**
 * Calculate monthly amount needed to reach goal by target date
 */
export function calculateGoalMonthlyTarget(goal: DecimalGoal): DecimalInstance {
  const remaining = calculateGoalRemaining(goal);
  if (remaining.isZero()) return new Decimal(0);
  
  const now = new Date();
  const monthsRemaining = Math.max(1, 
    (goal.targetDate.getFullYear() - now.getFullYear()) * 12 +
    (goal.targetDate.getMonth() - now.getMonth())
  );
  
  return remaining.dividedBy(monthsRemaining);
}

/**
 * Calculate savings rate from income and expenses
 */
export function calculateSavingsRateFromAmounts(
  income: DecimalInstance,
  expenses: DecimalInstance
): number {
  if (income.isZero()) return 0;
  const savings = income.minus(expenses);
  return savings.dividedBy(income).times(100).toNumber();
}

/**
 * Calculate debt to income ratio
 */
export function calculateDebtToIncomeRatio(
  monthlyDebt: DecimalInstance,
  monthlyIncome: DecimalInstance
): number {
  if (monthlyIncome.isZero()) return 0;
  return monthlyDebt.dividedBy(monthlyIncome).times(100).toNumber();
}

/**
 * Calculate category spending
 */
export function calculateCategorySpending(
  category: string,
  transactions: DecimalTransaction[],
  startDate?: Date,
  endDate?: Date
): DecimalInstance {
  let filtered = transactions.filter(t => 
    t.type === 'expense' && t.category === category
  );
  
  if (startDate) {
    filtered = filtered.filter(t => t.date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(t => t.date <= endDate);
  }
  
  return sumDecimals(filtered.map(t => t.amount));
}

/**
 * Calculate budget usage amount
 */
export function calculateBudgetUsage(
  budget: DecimalBudget,
  transactions: DecimalTransaction[]
): DecimalInstance {
  const expenseTransactions = transactions.filter(t => 
    t.type === 'expense' && t.category === budget.categoryId
  );
  return sumDecimals(expenseTransactions.map(t => t.amount));
}

/**
 * Calculate budget progress as percentage
 */
export function calculateBudgetProgress(
  budget: DecimalBudget,
  transactions: DecimalTransaction[]
): number {
  if (budget.amount.isZero()) return 0;
  const usage = calculateBudgetUsage(budget, transactions);
  return usage.dividedBy(budget.amount).times(100).toNumber();
}

/**
 * Calculate spending by category
 */
export function calculateSpendingByCategory(
  transactions: DecimalTransaction[],
  startDate?: Date,
  endDate?: Date
): Record<string, DecimalInstance> {
  let filtered = transactions.filter(t => t.type === 'expense');
  
  if (startDate) {
    filtered = filtered.filter(t => t.date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(t => t.date <= endDate);
  }
  
  const spending: Record<string, DecimalInstance> = {};
  
  filtered.forEach(t => {
    if (!spending[t.category]) {
      spending[t.category] = new Decimal(0);
    }
    spending[t.category] = spending[t.category].plus(t.amount);
  });
  
  return spending;
}

/**
 * Calculate average transaction amount
 */
export function calculateAverageTransaction(transactions: DecimalTransaction[]): DecimalInstance {
  if (transactions.length === 0) return new Decimal(0);
  const total = sumDecimals(transactions.map(t => t.amount));
  return total.dividedBy(transactions.length);
}

/**
 * Calculate investment return
 */
export function calculateInvestmentReturn(
  currentValue: DecimalInstance,
  investedAmount: DecimalInstance
): { amount: DecimalInstance; percentage: number } {
  const returnAmount = currentValue.minus(investedAmount);
  const percentage = investedAmount.isZero() ? 0 : 
    returnAmount.dividedBy(investedAmount).times(100).toNumber();
  
  return {
    amount: returnAmount,
    percentage
  };
}

/**
 * Calculate compound interest
 */
export function calculateCompoundInterest(
  principal: DecimalInstance,
  annualRate: number,
  years: number,
  compoundingPerYear: number = 12
): DecimalInstance {
  const rate = new Decimal(1 + annualRate / compoundingPerYear);
  const periods = compoundingPerYear * years;
  return principal.times(rate.pow(periods));
}

// Additional functions for tests

/**
 * Get transactions by category
 */
export function getTransactionsByCategory(
  transactions: DecimalTransaction[],
  category: string
): DecimalTransaction[] {
  return transactions.filter(t => t.category === category);
}

/**
 * Get transactions by date range
 */
export function getTransactionsByDateRange(
  transactions: DecimalTransaction[],
  startDate: Date,
  endDate: Date
): DecimalTransaction[] {
  return transactions.filter(t => {
    const date = new Date(t.date);
    return date >= startDate && date <= endDate;
  });
}

/**
 * Calculate average transaction amount (same as calculateAverageTransaction for compatibility)
 */
export function calculateAverageTransactionAmount(transactions: DecimalTransaction[]): DecimalInstance {
  return calculateAverageTransaction(transactions);
}

/**
 * Calculate monthly average
 */
export function calculateMonthlyAverage(transactions: DecimalTransaction[]): DecimalInstance {
  if (transactions.length === 0) return new Decimal(0);
  
  const dates = transactions.map(t => new Date(t.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  const monthsDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + 
                     (maxDate.getMonth() - minDate.getMonth()) + 1;
  
  const total = sumDecimals(transactions.map(t => t.amount));
  return total.dividedBy(monthsDiff);
}

/**
 * Calculate account totals by type
 */
export function calculateAccountTotals(accounts: DecimalAccount[]): Record<string, DecimalInstance> {
  const totals: Record<string, DecimalInstance> = {};
  
  accounts.forEach(account => {
    if (!totals[account.type]) {
      totals[account.type] = new Decimal(0);
    }
    totals[account.type] = totals[account.type].plus(account.balance);
  });
  
  return totals;
}

/**
 * Calculate cash flow
 */
export function calculateCashFlow(transactions: DecimalTransaction[]): {
  income: DecimalInstance;
  expenses: DecimalInstance;
  net: DecimalInstance;
} {
  const income = calculateTotalIncome(transactions);
  const expenses = calculateTotalExpenses(transactions);
  return {
    income,
    expenses,
    net: income.minus(expenses)
  };
}

/**
 * Calculate savings rate from transactions
 */
export function calculateSavingsRate(transactions: DecimalTransaction[]): number {
  const income = calculateTotalIncome(transactions);
  if (income.isZero()) return 0;
  const expenses = calculateTotalExpenses(transactions);
  const savings = income.minus(expenses);
  return savings.dividedBy(income).times(100).toNumber();
}

/**
 * Get recent transactions
 */
export function getRecentTransactions(
  transactions: DecimalTransaction[],
  days: number = 30
): DecimalTransaction[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return transactions
    .filter(t => new Date(t.date) >= cutoffDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get top spending categories
 */
export function getTopCategories(
  transactions: DecimalTransaction[],
  limit: number = 5
): Array<{
  category: string;
  total: DecimalInstance;
  count: number;
}> {
  const categoryTotals: Record<string, { total: DecimalInstance; count: number }> = {};
  
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      if (!categoryTotals[t.category]) {
        categoryTotals[t.category] = { total: new Decimal(0), count: 0 };
      }
      categoryTotals[t.category].total = categoryTotals[t.category].total.plus(t.amount);
      categoryTotals[t.category].count += 1;
    });
  
  return Object.entries(categoryTotals)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total.comparedTo(a.total))
    .slice(0, limit);
}

/**
 * Calculate daily balance history
 */
export function calculateDailyBalance(
  startBalance: DecimalInstance,
  transactions: DecimalTransaction[],
  days: number = 30
): Array<{ date: Date; balance: DecimalInstance }> {
  const balances: Array<{ date: Date; balance: DecimalInstance }> = [];
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
        currentBalance = currentBalance.plus(t.amount);
      } else if (t.type === 'expense') {
        currentBalance = currentBalance.minus(t.amount);
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
  transactions: DecimalTransaction[],
  months: number = 6
): Array<{
  month: string;
  income: DecimalInstance;
  expenses: DecimalInstance;
  net: DecimalInstance;
}> {
  const trends: Array<{
    month: string;
    income: DecimalInstance;
    expenses: DecimalInstance;
    net: DecimalInstance;
  }> = [];
  
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
      net: income.minus(expenses)
    });
  }
  
  return trends;
}

/**
 * Calculate category trends
 */
export function calculateCategoryTrends(
  transactions: DecimalTransaction[],
  category: string,
  months: number = 6
): Array<{ month: string; amount: DecimalInstance }> {
  const trends: Array<{ month: string; amount: DecimalInstance }> = [];
  const today = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = date.toISOString().slice(0, 7);
    
    const monthTransactions = transactions.filter(t => {
      return new Date(t.date).toISOString().slice(0, 7) === monthStr &&
             t.category === category &&
             t.type === 'expense';
    });
    
    const amount = sumDecimals(monthTransactions.map(t => t.amount));
    
    trends.push({ month: monthStr, amount });
  }
  
  return trends;
}