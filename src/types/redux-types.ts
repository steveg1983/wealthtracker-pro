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
