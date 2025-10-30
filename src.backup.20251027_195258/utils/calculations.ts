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
import { toNumber } from '@wealthtracker/utils';
import * as decimalCalcs from './calculations-decimal';
import { toDecimal } from '@wealthtracker/utils';
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
  const decimalGoal = toDecimalGoal(goal);
  const percentage = decimalCalcs.calculateGoalProgress(decimalGoal);
  const remainingDecimal = decimalCalcs.calculateGoalRemaining(decimalGoal);
  const remaining = toNumber(remainingDecimal);
  const isCompleted = remainingDecimal.isZero();

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
  const decimalBudget = toDecimalBudget(budget);
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(
    decimalCalcs.calculateBudgetSpending(decimalBudget, decimalTransactions, startDate, endDate)
  );
}

/**
 * Calculate budget remaining
 */
export function calculateBudgetRemaining(
  budget: Budget,
  spent: number
): number {
  const decimalBudget = toDecimalBudget(budget);
  const spentDecimal = toDecimal(spent);
  return toNumber(decimalCalcs.calculateBudgetRemaining(decimalBudget, spentDecimal));
}

/**
 * Calculate budget usage amount
 */
export function calculateBudgetUsage(budget: Budget, transactions: Transaction[]): number {
  const decimalBudget = toDecimalBudget(budget);
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return toNumber(decimalCalcs.calculateBudgetUsage(decimalBudget, decimalTransactions));
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
  const decimalBudget = toDecimalBudget(budget);
  const decimalTransactions = transactions ? transactions.map(toDecimalTransaction) : [];
  const spentDecimal = budget.spent !== undefined
    ? toDecimal(budget.spent)
    : decimalCalcs.calculateBudgetUsage(decimalBudget, decimalTransactions);

  const percentage = decimalCalcs.calculateBudgetPercentage(decimalBudget, spentDecimal);
  const remainingDecimal = decimalCalcs.calculateBudgetRemaining(decimalBudget, spentDecimal);
  const remaining = toNumber(remainingDecimal);

  const status: 'good' | 'warning' | 'danger' =
    percentage >= 100 ? 'danger' :
    percentage >= 80 ? 'warning' : 'good';

  return {
    percentage: Math.min(100, percentage),
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
  const decimalTransactions = transactions.map(toDecimalTransaction);
  const incomeDecimal = decimalCalcs.calculateTotalIncome(decimalTransactions);
  const expensesDecimal = decimalCalcs.calculateTotalExpenses(decimalTransactions);
  const netDecimal = incomeDecimal.minus(expensesDecimal);
  const savingsRate = decimalCalcs.calculateSavingsRateFromAmounts(incomeDecimal, expensesDecimal);

  return {
    totalIncome: toNumber(incomeDecimal),
    totalExpenses: toNumber(expensesDecimal),
    netCashFlow: toNumber(netDecimal),
    savingsRate
  };
}

/**
 * Calculate savings rate from transactions
 */
export function calculateSavingsRate(transactions: Transaction[]): number {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return decimalCalcs.calculateSavingsRate(decimalTransactions);
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
  const decimalTransactions = transactions.map(toDecimalTransaction);
  const averageDecimal = decimalCalcs.calculateAverageTransactionAmount(decimalTransactions);
  return toNumber(averageDecimal);
}

/**
 * Calculate monthly average
 */
export function calculateMonthlyAverage(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  const decimalTransactions = transactions.map(toDecimalTransaction);
  const averageDecimal = decimalCalcs.calculateMonthlyAverage(decimalTransactions);
  return toNumber(averageDecimal);
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
  const decimalAccounts = accounts.map(toDecimalAccount);
  const decimalTotals = decimalCalcs.calculateAccountTotals(decimalAccounts);
  const totals: Record<string, number> = {};
  for (const [key, value] of Object.entries(decimalTotals)) {
    totals[key] = toNumber(value);
  }
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
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return decimalCalcs.getTopCategories(decimalTransactions, limit).map(entry => ({
    category: entry.category,
    amount: toNumber(entry.total),
    count: entry.count
  }));
}

/**
 * Calculate daily balance history
 */
export function calculateDailyBalance(
  startBalance: number,
  transactions: Transaction[],
  days: number = 30
): Array<{ date: Date; balance: number }> {
  const startBalanceDecimal = toDecimal(startBalance);
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return decimalCalcs
    .calculateDailyBalance(startBalanceDecimal, decimalTransactions, days)
    .map(entry => ({
      date: entry.date,
      balance: toNumber(entry.balance)
    }));
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
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return decimalCalcs.calculateMonthlyTrends(decimalTransactions, months).map(entry => ({
    month: entry.month,
    income: toNumber(entry.income),
    expenses: toNumber(entry.expenses),
    netIncome: toNumber(entry.net)
  }));
}

/**
 * Calculate category trends
 */
export function calculateCategoryTrends(
  transactions: Transaction[],
  category: string,
  months: number = 6
): Array<{ month: string; amount: number }> {
  const decimalTransactions = transactions.map(toDecimalTransaction);
  return decimalCalcs.calculateCategoryTrends(decimalTransactions, category, months).map(entry => ({
    month: entry.month,
    amount: toNumber(entry.amount)
  }));
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
