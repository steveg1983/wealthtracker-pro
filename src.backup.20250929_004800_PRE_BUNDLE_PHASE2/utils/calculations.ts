/**
 * @deprecated These calculation functions are deprecated. Use calculations-decimal.ts instead.
 * 
 * Backward-compatible calculation functions that work with number types
 * These wrap the decimal calculation functions for components not yet migrated
 * 
 * Migration guide:
 * 1. Import from './calculations-decimal' instead of './calculations'
 * 2. Use getDecimalAccounts(), getDecimalTransactions() etc. from AppContext
 * 3. Use useCurrencyDecimal() hook instead of useCurrency()
 */

import { 
  toDecimalAccount, toDecimalTransaction, toDecimalBudget, toDecimalGoal 
} from './decimal-converters';
import { toNumber } from './decimal';
import * as decimalCalcs from './calculations-decimal';
import { toDecimal } from './decimal';
import type { Account, Transaction, Budget, Goal } from '../types';

/**
 * Calculate total income from transactions
 */
export function calculateTotalIncome(transactions: Transaction[]): number {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(decimalCalcs.calculateTotalIncome(decimalTransactions));
}

/**
 * Calculate total expenses from transactions
 */
export function calculateTotalExpenses(transactions: Transaction[]): number {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(decimalCalcs.calculateTotalExpenses(decimalTransactions));
}

/**
 * Calculate net income (income - expenses)
 */
export function calculateNetIncome(transactions: Transaction[]): number {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(decimalCalcs.calculateNetIncome(decimalTransactions));
}

/**
 * Calculate account balance including all transactions
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[]
): number {
  const decimalAccount = toDecimalAccount(account);
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(decimalCalcs.calculateAccountBalance(decimalAccount, decimalTransactions));
}

/**
 * Calculate total balance across all accounts
 */
export function calculateTotalBalance(accounts: Account[]): number {
  const decimalAccounts = accounts.map(toDecimalAccount);
  return toNumber(decimalCalcs.calculateTotalBalance(decimalAccounts));
}

/**
 * Calculate net worth (assets - liabilities)
 */
export function calculateNetWorth(accounts: Account[]): number {
  const decimalAccounts = accounts.map(toDecimalAccount);
  return toNumber(decimalCalcs.calculateNetWorth(decimalAccounts));
}

/**
 * Calculate savings rate from income and expenses
 */
export function calculateSavingsRateFromAmounts(
  income: number,
  expenses: number
): number {
  const incomeDecimal = toDecimal(income);
  const expensesDecimal = toDecimal(expenses);
  return decimalCalcs.calculateSavingsRateFromAmounts(incomeDecimal, expensesDecimal);
}

/**
 * Calculate debt to income ratio
 */
export function calculateDebtToIncomeRatio(
  monthlyDebtPayments: number,
  monthlyIncome: number
): number {
  const debtDecimal = toDecimal(monthlyDebtPayments);
  const incomeDecimal = toDecimal(monthlyIncome);
  return decimalCalcs.calculateDebtToIncomeRatio(debtDecimal, incomeDecimal);
}

/**
 * Calculate budget percentage
 */
export function calculateBudgetPercentage(
  budget: Budget,
  spent: number
): number {
  const decimalBudget = toDecimalBudget(budget);
  const spentDecimal = toDecimal(spent);
  return decimalCalcs.calculateBudgetPercentage(decimalBudget, spentDecimal);
}

/**
 * Calculate goal progress with detailed information
 */
export function calculateGoalProgress(goal: Goal): {
  percentage: number;
  remaining: number;
  isCompleted: boolean;
} {
  const percentage = goal.targetAmount === 0 ? 100 : (goal.currentAmount / goal.targetAmount) * 100;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isCompleted = goal.currentAmount >= goal.targetAmount;
  
  return {
    percentage: Math.min(100, percentage),
    remaining,
    isCompleted
  };
}

/**
 * Calculate amount needed to reach goal
 */
export function calculateGoalRemaining(goal: Goal): number {
  const decimalGoal = toDecimalGoal(goal);
  return toNumber(decimalCalcs.calculateGoalRemaining(decimalGoal));
}

/**
 * Calculate monthly amount needed to reach goal by target date
 */
export function calculateGoalMonthlyTarget(goal: Goal): number {
  const decimalGoal = toDecimalGoal(goal);
  return toNumber(decimalCalcs.calculateGoalMonthlyTarget(decimalGoal));
}

/**
 * Calculate category spending
 */
export function calculateCategorySpending(
  category: string,
  transactions: Transaction[],
  startDate?: Date,
  endDate?: Date
): number {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(decimalCalcs.calculateCategorySpending(
    category,
    decimalTransactions,
    startDate,
    endDate
  ));
}

/**
 * Calculate spending by category
 */
export function calculateSpendingByCategory(
  transactions: Transaction[],
  startDate?: Date,
  endDate?: Date
): Record<string, number> {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  const decimalSpending = decimalCalcs.calculateSpendingByCategory(
    decimalTransactions,
    startDate,
    endDate
  );
  
  const spending: Record<string, number> = {};
  for (const [category, amount] of Object.entries(decimalSpending)) {
    spending[category] = toNumber(amount);
  }
  return spending;
}

/**
 * Calculate average transaction amount
 */
export function calculateAverageTransaction(transactions: Transaction[]): number {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(decimalCalcs.calculateAverageTransaction(decimalTransactions));
}

/**
 * Calculate investment return
 */
export function calculateInvestmentReturn(
  currentValue: number,
  investedAmount: number
): { amount: number; percentage: number } {
  const currentDecimal = toDecimal(currentValue);
  const investedDecimal = toDecimal(investedAmount);
  const result = decimalCalcs.calculateInvestmentReturn(currentDecimal, investedDecimal);
  
  return {
    amount: toNumber(result.amount),
    percentage: result.percentage
  };
}

/**
 * Calculate compound interest
 */
export function calculateCompoundInterest(
  principal: number,
  rate: number,
  timeYears: number,
  compoundingPerYear: number = 12
): number {
  const principalDecimal = toDecimal(principal);
  return toNumber(decimalCalcs.calculateCompoundInterest(
    principalDecimal,
    rate,
    timeYears,
    compoundingPerYear
  ));
}

// Add missing functions that tests are looking for

/**
 * Calculate budget spending for a category within a date range
 */
export function calculateBudgetSpending(
  budget: Budget,
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): number {
  const categoryId = (budget as Budget & { category?: string }).category ?? budget.categoryId;
  const budgetTransactions = transactions.filter(t => 
    t.type === 'expense' &&
    t.category === categoryId &&
    new Date(t.date) >= startDate &&
    new Date(t.date) <= endDate
  );
  
  return budgetTransactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate budget remaining
 */
export function calculateBudgetRemaining(
  budget: Budget,
  spent: number
): number {
  const remaining = budget.amount - spent;
  return remaining < 0 ? 0 : remaining;
}

/**
 * Calculate budget usage amount
 */
export function calculateBudgetUsage(budget: Budget, transactions: Transaction[]): number {
  const categoryId = (budget as Budget & { category?: string }).category ?? budget.categoryId;
  const expenseTransactions = transactions.filter(t => 
    t.type === 'expense' && t.category === categoryId
  );
  return expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate budget progress with detailed information
 */
export function calculateBudgetProgress(budget: Budget, transactions?: Transaction[]): {
  percentage: number;
  remaining: number;
  status: 'good' | 'warning' | 'danger';
} {
  // If budget has a 'spent' property, use it directly
  const spent = budget.spent || (transactions ? calculateBudgetUsage(budget, transactions) : 0);
  const percentage = budget.amount === 0 ? 0 : (spent / budget.amount) * 100;
  const remaining = budget.amount - spent;
  
  let status: 'good' | 'warning' | 'danger';
  if (percentage >= 100) {
    status = 'danger';
  } else if (percentage >= 80) {
    status = 'warning';
  } else {
    status = 'good';
  }
  
  return {
    percentage,
    remaining,
    status
  };
}

/**
 * Get transactions by category
 */
export function getTransactionsByCategory(transactions: Transaction[], category: string): Transaction[] {
  return transactions.filter(t => t.category === category);
}

/**
 * Get transactions by date range
 */
export function getTransactionsByDateRange(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] {
  return transactions.filter(t => {
    const date = new Date(t.date);
    return date >= startDate && date <= endDate;
  });
}

/**
 * Calculate cash flow
 */
export function calculateCashFlow(transactions: Transaction[]): {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number;
} {
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
 * Calculate savings rate from transactions
 */
export function calculateSavingsRate(transactions: Transaction[]): number {
  const income = calculateTotalIncome(transactions);
  if (income === 0) return 0;
  const expenses = calculateTotalExpenses(transactions);
  const savings = income - expenses;
  return (savings / income) * 100;
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    groceries: '🛒',
    utilities: '💡',
    transport: '🚗',
    dining: '🍽️',
    entertainment: '🎬',
    healthcare: '🏥',
    shopping: '🛍️',
    education: '📚',
    housing: '🏠',
    insurance: '🛡️',
    salary: '💰',
    freelance: '💼',
    investment: '📈',
    other: '📌'
  };
  return icons[category] || '📌';
}

/**
 * Get account type icon
 */
export function getAccountTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    current: '💳',
    savings: '🏦',
    credit: '💳',
    investment: '📈',
    loan: '🏦',
    mortgage: '🏠',
    cash: '💵',
    assets: '🏢',
    other: '💰'
  };
  return icons[type] || '💰';
}

/**
 * Calculate average transaction amount
 */
export function calculateAverageTransactionAmount(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  return total / transactions.length;
}

/**
 * Calculate monthly average
 */
export function calculateMonthlyAverage(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  
  const dates = transactions.map(t => new Date(t.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  const monthsDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + 
                     (maxDate.getMonth() - minDate.getMonth()) + 1;
  
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  return total / monthsDiff;
}

/**
 * Group transactions by date
 */
export function groupTransactionsByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  
  transactions.forEach(transaction => {
    const iso = new Date(transaction.date).toISOString();
    const [date] = iso.split('T');
    if (!date) {
      return;
    }
    const bucket = groups[date] ?? (groups[date] = []);
    bucket.push(transaction);
  });

  return groups;
}

/**
 * Calculate account totals by type
 */
export function calculateAccountTotals(accounts: Account[]): Record<string, number> {
  const totals: Record<string, number> = {};
  
  accounts.forEach(account => {
    const key = account.type || 'other';
    const currentTotal = totals[key] ?? 0;
    totals[key] = currentTotal + account.balance;
  });
  
  return totals;
}

/**
 * Get recent transactions
 */
export function getRecentTransactions(transactions: Transaction[], days: number = 30): Transaction[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return transactions
    .filter(t => new Date(t.date) >= cutoffDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get top spending categories
 */
export function getTopCategories(transactions: Transaction[], limit: number = 5): Array<{
  category: string;
  amount: number;
  count: number;
}> {
  const categoryTotals: Record<string, { total: number; count: number }> = {};
  
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const key = t.category;
      const bucket = categoryTotals[key] ?? (categoryTotals[key] = { total: 0, count: 0 });
      bucket.total += t.amount;
      bucket.count += 1;
    });
  
  return Object.entries(categoryTotals)
    .map(([category, data]) => ({ 
      category, 
      amount: data.total,  // Changed from total to amount
      count: data.count 
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/**
 * Calculate daily balance history
 */
export function calculateDailyBalance(
  startBalance: number,
  transactions: Transaction[],
  days: number = 30
): Array<{ date: Date; balance: number }> {
  const balances: Array<{ date: Date; balance: number }> = [];
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
): Array<{
  month: string;
  income: number;
  expenses: number;
  netIncome: number;
}> {
  const trends: Array<{
    month: string;
    income: number;
    expenses: number;
    netIncome: number;
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
      netIncome: income - expenses  // Changed from net to netIncome
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
): Array<{ month: string; amount: number }> {
  const trends: Array<{ month: string; amount: number }> = [];
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
 * Get category display path (for hierarchical categories)
 */
export function getCategoryDisplayPath(category: string): string {
  // For now, just return the category name
  // This can be expanded to show full hierarchy path if needed
  return category;
}

/**
 * Calculate average spending for a given period
 */
export function calculateAverageSpending(transactions: Transaction[], days: number): number {
  if (days === 0) return 0;
  const totalSpending = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  return totalSpending / days;
}

/**
 * Calculate growth rate between two periods
 */
export function calculateGrowthRate(previousValue: number, currentValue: number): number {
  if (previousValue === 0) return currentValue === 0 ? 0 : Infinity;
  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * Calculate projected savings based on current amount and monthly contribution
 */
export function calculateProjectedSavings(
  currentAmount: number,
  monthlyContribution: number,
  targetDate: Date
): {
  projectedAmount: number;
  willMeetGoal: boolean;
  monthsToGoal: number;
} {
  const currentDate = new Date();
  const monthsDiff = (targetDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                     (targetDate.getMonth() - currentDate.getMonth());
  
  const projectedAmount = currentAmount + (monthlyContribution * monthsDiff);
  
  return {
    projectedAmount,
    willMeetGoal: true, // Can be enhanced with goal target comparison
    monthsToGoal: Math.max(0, monthsDiff)
  };
}

/**
 * Calculate emergency fund coverage in months
 */
export function calculateEmergencyFundCoverage(
  emergencyFund: number,
  monthlyExpenses: number
): {
  months: number;
  isAdequate: boolean;
} {
  if (monthlyExpenses === 0) {
    return {
      months: Infinity,
      isAdequate: true
    };
  }
  
  const months = emergencyFund / monthlyExpenses;
  const isAdequate = months >= 6; // 6 months is generally recommended
  
  return {
    months,
    isAdequate
  };
}
