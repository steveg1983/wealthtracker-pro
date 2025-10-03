import { toDecimal, toStorageNumber } from './decimal';
import type { 
  Account, Transaction, Budget, Goal, Holding,
} from '../types';
import type { 
  DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal, DecimalHolding 
} from '../types/decimal-types';

/**
 * Convert regular types to Decimal types
 */

export function toDecimalAccount(account: Account): DecimalAccount {
  return {
    ...account,
    balance: toDecimal(account.balance),
    openingBalance: account.openingBalance !== undefined ? toDecimal(account.openingBalance) : undefined,
    holdings: account.holdings?.map(toDecimalHolding)
  };
}

export function toDecimalTransaction(transaction: Transaction): DecimalTransaction {
  return {
    ...transaction,
    amount: toDecimal(transaction.amount)
  };
}

export function toDecimalBudget(budget: Budget): DecimalBudget {
  return {
    id: budget.id,
    category: budget.category ?? budget.categoryId,
    amount: toDecimal(budget.amount),
    period: budget.period,
    isActive: budget.isActive,
    createdAt: budget.createdAt
  };
}

export function toDecimalGoal(goal: Goal): DecimalGoal {
  return {
    ...goal,
    targetAmount: toDecimal(goal.targetAmount),
    currentAmount: toDecimal(goal.currentAmount)
  };
}

export function toDecimalHolding(holding: Holding): DecimalHolding {
  return {
    ...holding,
    shares: toDecimal(holding.shares),
    value: toDecimal(holding.value),
    averageCost: holding.averageCost !== undefined ? toDecimal(holding.averageCost) : undefined,
    currentPrice: holding.currentPrice !== undefined ? toDecimal(holding.currentPrice) : undefined,
    marketValue: holding.marketValue !== undefined ? toDecimal(holding.marketValue) : undefined,
    gain: holding.gain !== undefined ? toDecimal(holding.gain) : undefined,
    gainPercent: holding.gainPercent !== undefined ? toDecimal(holding.gainPercent) : undefined
  };
}

/**
 * Convert Decimal types back to regular types (for storage/API)
 */

export function fromDecimalAccount(account: DecimalAccount): Account {
  return {
    ...account,
    balance: toStorageNumber(account.balance),
    openingBalance: account.openingBalance ? toStorageNumber(account.openingBalance) : undefined,
    holdings: account.holdings?.map(fromDecimalHolding)
  };
}

export function fromDecimalTransaction(transaction: DecimalTransaction): Transaction {
  return {
    ...transaction,
    amount: toStorageNumber(transaction.amount)
  };
}

export function fromDecimalBudget(budget: DecimalBudget): Budget {
  return {
    id: budget.id,
    categoryId: budget.category,
    category: budget.category,
    amount: toStorageNumber(budget.amount),
    period: budget.period,
    isActive: budget.isActive,
    createdAt: budget.createdAt,
    // Provide required Budget fields with defaults
    spent: 0,
    updatedAt: new Date()
  };
}

export function fromDecimalGoal(goal: DecimalGoal): Goal {
  return {
    ...goal,
    targetAmount: toStorageNumber(goal.targetAmount),
    currentAmount: toStorageNumber(goal.currentAmount),
    // Provide required fields with sane defaults if missing
    progress: (goal.currentAmount as any)?.div ? Number((goal.currentAmount as any).div(goal.targetAmount as any)) : 0,
    updatedAt: new Date()
  };
}

export function fromDecimalHolding(holding: DecimalHolding): Holding {
  return {
    ...holding,
    shares: toStorageNumber(holding.shares),
    value: toStorageNumber(holding.value),
    averageCost: holding.averageCost ? toStorageNumber(holding.averageCost) : undefined,
    currentPrice: holding.currentPrice ? toStorageNumber(holding.currentPrice) : undefined,
    marketValue: holding.marketValue ? toStorageNumber(holding.marketValue) : undefined,
    gain: holding.gain ? toStorageNumber(holding.gain) : undefined,
    gainPercent: holding.gainPercent ? toStorageNumber(holding.gainPercent) : undefined
  };
}
