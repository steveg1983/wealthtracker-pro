import { toISOString, toDate } from '../utils/dateHelpers'
import type { Account, Transaction } from './index'
import type { AccountDTO, TransactionDTO, BudgetDTO, GoalDTO } from './dto'
import type { Budget, Goal } from './index'

// Account mappers
export function accountToDTO(a: Account): AccountDTO {
  return {
    ...a,
    lastUpdated: toISOString(a.lastUpdated),
    openingBalanceDate: toISOString(a.openingBalanceDate),
    updatedAt: toISOString(a.updatedAt),
    createdAt: toISOString(a.createdAt),
  }
}

export function accountFromDTO(a: AccountDTO): Account {
  return {
    ...a,
    lastUpdated: toDate(a.lastUpdated) || new Date(),
    openingBalanceDate: a.openingBalanceDate ? new Date(a.openingBalanceDate) : undefined,
    updatedAt: a.updatedAt ? new Date(a.updatedAt) : undefined,
    createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
  }
}

// Transaction mappers
export function transactionToDTO(t: Transaction): TransactionDTO {
  return {
    ...t,
    date: toISOString(t.date)!,
    reconciledDate: toISOString(t.reconciledDate),
    updatedAt: toISOString(t.updatedAt),
  }
}

export function transactionFromDTO(t: TransactionDTO): Transaction {
  return {
    ...t,
    date: toDate(t.date) || new Date(),
    reconciledDate: t.reconciledDate ? new Date(t.reconciledDate) : undefined,
    updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
  }
}

// Helpers for arrays
export const mapAccountsToDTO = (arr: Account[]) => arr.map(accountToDTO)
export const mapAccountsFromDTO = (arr: AccountDTO[]) => arr.map(accountFromDTO)
export const mapTransactionsToDTO = (arr: Transaction[]) => arr.map(transactionToDTO)
export const mapTransactionsFromDTO = (arr: TransactionDTO[]) => arr.map(transactionFromDTO)

// Budget mappers
export function budgetToDTO(b: Budget): BudgetDTO {
  return {
    ...b,
    createdAt: toISOString(b.createdAt)!,
    updatedAt: toISOString(b.updatedAt),
  }
}

export function budgetFromDTO(b: BudgetDTO): Budget {
  // Compatibility shim: Handle both 'category' and 'categoryId' fields
  // This resolves the DTO/Domain shape drift identified in quality audit
  const categoryId = (b as any).categoryId ?? (b as any).category;
  
  return {
    ...b,
    categoryId, // Ensure we always use categoryId in the domain model
    createdAt: toDate(b.createdAt) || new Date(),
    updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
  }
}

export const mapBudgetsToDTO = (arr: Budget[]) => arr.map(budgetToDTO)
export const mapBudgetsFromDTO = (arr: BudgetDTO[]) => arr.map(budgetFromDTO)

// Goal mappers
export function goalToDTO(g: Goal): GoalDTO {
  return {
    ...g,
    createdAt: toISOString(g.createdAt)!,
    updatedAt: toISOString(g.updatedAt),
    targetDate: toISOString(g.targetDate)!,
  }
}

export function goalFromDTO(g: GoalDTO): Goal {
  return {
    ...g,
    createdAt: toDate(g.createdAt) || new Date(),
    updatedAt: g.updatedAt ? new Date(g.updatedAt) : undefined,
    targetDate: toDate(g.targetDate) || new Date(),
  }
}

export const mapGoalsToDTO = (arr: Goal[]) => arr.map(goalToDTO)
export const mapGoalsFromDTO = (arr: GoalDTO[]) => arr.map(goalFromDTO)
