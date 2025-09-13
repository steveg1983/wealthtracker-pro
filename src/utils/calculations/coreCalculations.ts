/**
 * Core Calculations Module
 * Basic financial calculations using decimal wrapper functions
 */

import { 
  toDecimalAccount, 
  toDecimalTransaction, 
  toDecimalBudget, 
  toDecimalGoal 
} from '../decimal-converters';
import { toNumber, toDecimal } from '../decimal';
import * as decimalCalcs from '../calculations-decimal';
import type { Account, Transaction, Budget, Goal } from '../../types';
import type { InvestmentReturnResult } from './types';

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
 * Calculate investment return
 */
export function calculateInvestmentReturn(
  currentValue: number,
  investedAmount: number
): InvestmentReturnResult {
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

/**
 * Calculate average transaction amount
 */
export function calculateAverageTransactionAmount(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  return total / transactions.length;
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