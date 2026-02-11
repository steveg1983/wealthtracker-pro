/**
 * Redux State Types
 *
 * Redux requires serializable data, so dates are stored as ISO strings.
 * These types represent the actual shape of data in Redux state.
 */

import type { Account, Transaction, Budget, Goal, RecurringTransaction } from './index';

// Helper type to convert Date fields to strings
type Serialized<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | undefined
    ? string | undefined
    : T[K];
};

// Serialized versions for Redux state
export type SerializedAccount = Serialized<Account>;
export type SerializedTransaction = Serialized<Transaction>;
export type SerializedBudget = Serialized<Budget>;
export type SerializedGoal = Serialized<Goal>;
export type SerializedRecurringTransaction = Serialized<RecurringTransaction>;

// Redux state shape with serialized types
export interface ReduxState {
  accounts: SerializedAccount[];
  transactions: SerializedTransaction[];
  budgets: SerializedBudget[];
  goals: SerializedGoal[];
  recurringTransactions: SerializedRecurringTransaction[];
}

// Helper to convert Date | undefined to string | undefined
function serializeDate(date: Date | string | undefined): string | undefined {
  if (date === undefined) return undefined;
  if (typeof date === 'string') return date;
  return date.toISOString();
}

// Helper to convert required Date to string
function serializeDateRequired(date: Date | string): string {
  if (typeof date === 'string') return date;
  return date.toISOString();
}

// Serializer functions for converting domain types to Redux-safe serialized types
export function serializeAccount(account: Account): SerializedAccount {
  return {
    ...account,
    lastUpdated: serializeDateRequired(account.lastUpdated),
    openingBalanceDate: serializeDate(account.openingBalanceDate),
    updatedAt: serializeDate(account.updatedAt),
    createdAt: serializeDate(account.createdAt),
  };
}

export function serializeAccounts(accounts: Account[]): SerializedAccount[] {
  return accounts.map(serializeAccount);
}

export function serializeTransaction(transaction: Transaction): SerializedTransaction {
  return {
    ...transaction,
    date: serializeDateRequired(transaction.date),
    reconciledDate: serializeDate(transaction.reconciledDate),
    createdAt: serializeDate(transaction.createdAt),
    updatedAt: serializeDate(transaction.updatedAt),
  };
}

export function serializeTransactions(transactions: Transaction[]): SerializedTransaction[] {
  return transactions.map(serializeTransaction);
}

export function serializeBudget(budget: Budget): SerializedBudget {
  return {
    ...budget,
    createdAt: serializeDateRequired(budget.createdAt),
    updatedAt: serializeDateRequired(budget.updatedAt),
    // startDate is already a string in Budget type, no conversion needed
  };
}

export function serializeBudgets(budgets: Budget[]): SerializedBudget[] {
  return budgets.map(serializeBudget);
}

export function serializeGoal(goal: Goal): SerializedGoal {
  return {
    ...goal,
    targetDate: serializeDateRequired(goal.targetDate),
    createdAt: serializeDateRequired(goal.createdAt),
    updatedAt: serializeDateRequired(goal.updatedAt),
  };
}

export function serializeGoals(goals: Goal[]): SerializedGoal[] {
  return goals.map(serializeGoal);
}

export function serializeRecurringTransaction(rt: RecurringTransaction): SerializedRecurringTransaction {
  return {
    ...rt,
    startDate: serializeDateRequired(rt.startDate),
    endDate: serializeDate(rt.endDate),
    nextDate: serializeDateRequired(rt.nextDate),
    lastProcessed: serializeDate(rt.lastProcessed),
    createdAt: serializeDateRequired(rt.createdAt),
    updatedAt: serializeDateRequired(rt.updatedAt),
  };
}

export function serializeRecurringTransactions(rts: RecurringTransaction[]): SerializedRecurringTransaction[] {
  return rts.map(serializeRecurringTransaction);
}
