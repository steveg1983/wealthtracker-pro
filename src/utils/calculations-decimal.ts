/**
 * Decimal-based calculation functions for precise financial calculations
 *
 * SIGNED CONVENTION: transactions store SIGNED amounts (expenses negative,
 * income positive, transfers signed by direction). Aggregate "spending"
 * figures are reported as POSITIVE magnitudes (abs at the summation point —
 * robust to any legacy positive-magnitude rows), and balances are a single
 * signed sum with no per-type add/subtract.
 */

import Decimal from 'decimal.js';
import type {
  DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal
} from '../types/decimal-types';
import { sumDecimals } from './decimal';
import { toDateMs } from './dateBoundary';

// Type alias for cleaner code
type DecimalInstance = InstanceType<typeof Decimal>;

/**
 * What the period filters below accept.
 *
 * App state now holds a real Date on every transaction (converted once at the
 * service boundary — see utils/dateBoundary), but these helpers are pure and
 * get handed rows straight off a wire or a JSON blob too, where `date` is the
 * string Postgres sent: "2026-08-15". `"2026-08-15" >= new Date(...)` is always
 * false, so that shape reported £0 spent on every budget and fired no alerts.
 * The input type therefore says what the runtime genuinely tolerates, and
 * every comparison goes through toDateMs instead of comparing the raw values.
 */
export type DatedDecimalTransaction = Omit<DecimalTransaction, 'date'> & { date: Date | string };

/** Sum of |amount| — displayed magnitude for income/expense aggregates. */
function sumMagnitudes(transactions: DecimalTransaction[]): DecimalInstance {
  return sumDecimals(transactions.map(t => t.amount.abs()));
}

/**
 * Calculate total income from transactions (positive magnitude)
 */
export function calculateTotalIncome(transactions: DecimalTransaction[]): DecimalInstance {
  return sumMagnitudes(transactions.filter(t => t.type === 'income'));
}

/**
 * Calculate total expenses from transactions (positive magnitude)
 */
export function calculateTotalExpenses(transactions: DecimalTransaction[]): DecimalInstance {
  return sumMagnitudes(transactions.filter(t => t.type === 'expense'));
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
  // Amounts are signed — a single signed sum is the balance delta. The old
  // per-type negation double-negated (added) expenses and flipped transfers.
  const transactionSum = sumDecimals(accountTransactions.map(t => t.amount));
  return account.balance.plus(transactionSum);
}

/**
 * Calculate total balance across all accounts
 * Uses openingBalance + sum(transactions) for accuracy
 */
export function calculateTotalBalance(accounts: DecimalAccount[], transactions?: DecimalTransaction[]): DecimalInstance {
  return sumDecimals(accounts.map(a => {
    const opening = a.openingBalance ?? new Decimal(0);
    if (transactions) {
      const txnTotal = sumDecimals(
        transactions.filter(t => t.accountId === a.id).map(t => t.amount)
      );
      return opening.plus(txnTotal);
    }
    return opening.plus(a.balance);
  }));
}

/**
 * Calculate net worth (assets - liabilities)
 * Uses openingBalance + sum(transactions) for accuracy
 */
export function calculateNetWorth(accounts: DecimalAccount[], transactions?: DecimalTransaction[]): DecimalInstance {
  return calculateTotalBalance(accounts, transactions);
}

/**
 * Optional refinements to which rows count towards a budget.
 */
export interface BudgetSpendingFilter {
  /**
   * Match these category ids INSTEAD of the budget's own single id — the
   * budget's category and every descendant of it, so a GROUP-level budget
   * ("Food") counts what its detail categories spend. Omitted for a detail
   * budget, which keeps the plain equality it has always used.
   */
  categoryIds?: ReadonlySet<string>;
  /**
   * Accounts whose rows must NOT be counted — the ones held in a currency
   * other than the one being displayed. Adding £ and $ figures together would
   * report a number that is true in no currency at all, so those rows are set
   * aside and reported (see `excluded`) for the caller to disclose, never
   * silently dropped.
   */
  excludeAccountIds?: ReadonlySet<string>;
}

export interface BudgetSpendingBreakdown {
  /** Net spend over the period: positive magnitude, refunds deducted. */
  spent: DecimalInstance;
  /** The rows that made up `spent`. */
  counted: DatedDecimalTransaction[];
  /** In-period, in-category rows left out by `excludeAccountIds`. */
  excluded: DatedDecimalTransaction[];
}

function matchesBudgetCategory(
  transaction: DatedDecimalTransaction,
  budget: Pick<DecimalBudget, 'categoryId'>,
  categoryIds: ReadonlySet<string> | undefined
): boolean {
  return categoryIds ? categoryIds.has(transaction.category) : transaction.category === budget.categoryId;
}

/**
 * Budget spending, and what was left out of it.
 *
 * Money-style netting: income filed under the budget's category (e.g. a refund
 * on a purchase) reduces the spend instead of counting as income. Dates are
 * compared as instants — see DatedDecimalTransaction; an unreadable date yields
 * NaN, which excludes the row rather than filing it in an arbitrary period.
 */
export function calculateBudgetSpendingBreakdown(
  budget: Pick<DecimalBudget, 'categoryId'>,
  transactions: DatedDecimalTransaction[],
  startDate: Date,
  endDate: Date,
  filter: BudgetSpendingFilter = {}
): BudgetSpendingBreakdown {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const counted: DatedDecimalTransaction[] = [];
  const excluded: DatedDecimalTransaction[] = [];

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' && transaction.type !== 'income') continue;
    if (!matchesBudgetCategory(transaction, budget, filter.categoryIds)) continue;
    const ms = toDateMs(transaction.date);
    if (!(ms >= startMs && ms <= endMs)) continue;
    if (filter.excludeAccountIds?.has(transaction.accountId)) {
      excluded.push(transaction);
      continue;
    }
    counted.push(transaction);
  }

  // Signed convention: spending is negative, so net spend is the negated
  // signed sum. Clamped at zero if refunds exceed spending in the period.
  const netSigned = counted.reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
  const spent = netSigned.negated();

  return {
    spent: spent.isNegative() ? new Decimal(0) : spent,
    counted,
    excluded
  };
}

/**
 * Calculate budget spending for a category
 */
export function calculateBudgetSpending(
  budget: Pick<DecimalBudget, 'categoryId'>,
  transactions: DatedDecimalTransaction[],
  startDate: Date,
  endDate: Date,
  filter?: BudgetSpendingFilter
): DecimalInstance {
  return calculateBudgetSpendingBreakdown(budget, transactions, startDate, endDate, filter).spent;
}

/**
 * Headroom left in a budget, FLOORED AT ZERO.
 *
 * The floor is for callers that fund something out of what is left (envelopes,
 * "safe to spend"), where a negative would hand out money that is not there.
 * Anything DISPLAYING the state of a budget wants the signed figure —
 * `amount.minus(spent)` — or an overspent budget reads "£0.00 remaining" while
 * the page total, which nets honestly, says otherwise. The Budget page does
 * exactly that; see its `remaining`.
 */
export function calculateBudgetRemaining(
  budget: Pick<DecimalBudget, 'amount'>,
  spent: DecimalInstance
): DecimalInstance {
  const remaining = budget.amount.minus(spent);
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

/**
 * Calculate budget percentage
 */
export function calculateBudgetPercentage(
  budget: Pick<DecimalBudget, 'amount'>,
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
  transactions: DatedDecimalTransaction[],
  startDate?: Date,
  endDate?: Date
): DecimalInstance {
  // Money-style netting (same semantics as calculateBudgetSpending): income
  // filed under the category — a refund — reduces the spend.
  let filtered = transactions.filter(t =>
    (t.type === 'expense' || t.type === 'income') && t.category === category
  );

  if (startDate) {
    const startMs = startDate.getTime();
    filtered = filtered.filter(t => toDateMs(t.date) >= startMs);
  }
  if (endDate) {
    const endMs = endDate.getTime();
    filtered = filtered.filter(t => toDateMs(t.date) <= endMs);
  }

  const netSigned = filtered.reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
  const spent = netSigned.negated();
  return spent.isNegative() ? new Decimal(0) : spent;
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
  return sumMagnitudes(expenseTransactions);
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
  transactions: DatedDecimalTransaction[],
  startDate?: Date,
  endDate?: Date
): Record<string, DecimalInstance> {
  // Money-style netting: include income rows so refunds filed under a
  // category reduce its spend; categories netting ≤ 0 are dropped.
  let filtered = transactions.filter(t => t.type === 'expense' || t.type === 'income');

  if (startDate) {
    const startMs = startDate.getTime();
    filtered = filtered.filter(t => toDateMs(t.date) >= startMs);
  }
  if (endDate) {
    const endMs = endDate.getTime();
    filtered = filtered.filter(t => toDateMs(t.date) <= endMs);
  }

  const netSigned: Record<string, DecimalInstance> = {};

  filtered.forEach(t => {
    if (!netSigned[t.category]) {
      netSigned[t.category] = new Decimal(0);
    }
    netSigned[t.category] = netSigned[t.category].plus(t.amount);
  });

  const spending: Record<string, DecimalInstance> = {};
  for (const [category, net] of Object.entries(netSigned)) {
    const spent = net.negated();
    if (spent.gt(0)) {
      spending[category] = spent;
    }
  }

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
      // Positive magnitudes so the descending sort ranks the LARGEST spend first.
      categoryTotals[t.category].total = categoryTotals[t.category].total.plus(t.amount.abs());
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
      // Amounts are signed — one signed sum covers income, expenses AND
      // transfers (the old per-type minus double-negated expenses and
      // silently dropped transfers from the balance history).
      currentBalance = currentBalance.plus(t.amount);
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
    
    const amount = sumMagnitudes(monthTransactions);

    trends.push({ month: monthStr, amount });
  }
  
  return trends;
}