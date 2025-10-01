import type { Account, Transaction } from './index'

// DTOs are JSON-friendly shapes used for Redux/network storage
// Dates are ISO strings; numbers remain numbers.

export type AccountDTO = Omit<Account,
  'lastUpdated' | 'openingBalanceDate' | 'updatedAt' | 'createdAt'
> & {
  lastUpdated?: string
  openingBalanceDate?: string
  updatedAt?: string
  createdAt?: string
}

export type TransactionDTO = Omit<Transaction,
  'date' | 'reconciledDate' | 'updatedAt'
> & {
  date: string
  reconciledDate?: string
  updatedAt?: string
}

// Budgets
export type BudgetDTO = Omit<import('./index').Budget, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt?: string
}

// Goals
export type GoalDTO = Omit<import('./index').Goal, 'createdAt' | 'updatedAt' | 'targetDate'> & {
  createdAt: string
  updatedAt?: string
  targetDate: string
}
