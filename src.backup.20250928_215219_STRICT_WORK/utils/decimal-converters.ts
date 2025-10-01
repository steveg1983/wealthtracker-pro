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
  const { openingBalance, holdings, ...rest } = account;

  const decimalAccount: DecimalAccount = {
    ...rest,
    balance: toDecimal(account.balance)
  };

  if (openingBalance !== undefined) {
    decimalAccount.openingBalance = toDecimal(openingBalance);
  }

  if (holdings && holdings.length > 0) {
    decimalAccount.holdings = holdings.map(toDecimalHolding);
  }

  return decimalAccount;
}

export function toDecimalTransaction(transaction: Transaction): DecimalTransaction {
  return {
    ...transaction,
    amount: toDecimal(transaction.amount)
  };
}

export function toDecimalBudget(budget: Budget): DecimalBudget {
  const category = (budget as Budget & { category?: string }).category ?? budget.categoryId;
  return {
    ...budget,
    category,
    amount: toDecimal(budget.amount)
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
  const {
    averageCost,
    currentPrice,
    marketValue,
    gain,
    gainPercent,
    ...rest
  } = holding;

  const decimalHolding: DecimalHolding = {
    ...rest,
    shares: toDecimal(holding.shares),
    value: toDecimal(holding.value)
  };

  if (averageCost !== undefined) {
    decimalHolding.averageCost = toDecimal(averageCost);
  }
  if (currentPrice !== undefined) {
    decimalHolding.currentPrice = toDecimal(currentPrice);
  }
  if (marketValue !== undefined) {
    decimalHolding.marketValue = toDecimal(marketValue);
  }
  if (gain !== undefined) {
    decimalHolding.gain = toDecimal(gain);
  }
  if (gainPercent !== undefined) {
    decimalHolding.gainPercent = toDecimal(gainPercent);
  }

  return decimalHolding;
}

/**
 * Convert Decimal types back to regular types (for storage/API)
 */

export function fromDecimalAccount(account: DecimalAccount): Account {
  const { openingBalance, holdings, balance, ...rest } = account;

  const baseAccount: Account = {
    ...rest,
    balance: toStorageNumber(balance)
  };

  if (openingBalance !== undefined) {
    baseAccount.openingBalance = toStorageNumber(openingBalance);
  }

  if (holdings && holdings.length > 0) {
    baseAccount.holdings = holdings.map(fromDecimalHolding);
  }

  return baseAccount;
}

export function fromDecimalTransaction(transaction: DecimalTransaction): Transaction {
  return {
    ...transaction,
    amount: toStorageNumber(transaction.amount)
  };
}

export function fromDecimalBudget(budget: DecimalBudget): Budget {
  const { category: _legacyCategory, ...rest } = budget;
  return {
    ...rest,
    amount: toStorageNumber(budget.amount)
  };
}

export function fromDecimalGoal(goal: DecimalGoal): Goal {
  const { targetAmount, currentAmount, ...rest } = goal;
  const goalWithMeta = rest as Partial<Goal>;

  return {
    ...rest,
    targetAmount: toStorageNumber(targetAmount),
    currentAmount: toStorageNumber(currentAmount),
    progress: goalWithMeta.progress ?? 0,
    updatedAt: goalWithMeta.updatedAt ?? new Date()
  } as Goal;
}

export function fromDecimalHolding(holding: DecimalHolding): Holding {
  const {
    averageCost,
    currentPrice,
    marketValue,
    gain,
    gainPercent,
    shares,
    value,
    ...rest
  } = holding;

  const baseHolding: Holding = {
    ...rest,
    shares: toStorageNumber(shares),
    value: toStorageNumber(value)
  };

  if (averageCost !== undefined) {
    baseHolding.averageCost = toStorageNumber(averageCost);
  }
  if (currentPrice !== undefined) {
    baseHolding.currentPrice = toStorageNumber(currentPrice);
  }
  if (marketValue !== undefined) {
    baseHolding.marketValue = toStorageNumber(marketValue);
  }
  if (gain !== undefined) {
    baseHolding.gain = toStorageNumber(gain);
  }
  if (gainPercent !== undefined) {
    baseHolding.gainPercent = toStorageNumber(gainPercent);
  }

  return baseHolding;
}
