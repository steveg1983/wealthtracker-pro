import { toISOString, toDate } from '../utils/dateHelpers';
import type { Account, Transaction, Budget, Goal } from './index';
import type { AccountDTO, TransactionDTO, BudgetDTO, GoalDTO } from './dto';

// Account mappers
type AccountBase = Omit<Account, 'lastUpdated' | 'openingBalanceDate' | 'updatedAt' | 'createdAt'>;
type TransactionBase = Omit<Transaction, 'date' | 'reconciledDate' | 'updatedAt'>;

export function accountToDTO(a: Account): AccountDTO {
  const { lastUpdated, openingBalanceDate, updatedAt, createdAt, ...rest } = a as Account & {
    updatedAt?: Date;
    createdAt?: Date;
  };

  const base = rest as AccountBase;
  const dto: AccountDTO = { ...base };

  const lastUpdatedIso = toISOString(lastUpdated);
  if (lastUpdatedIso) dto.lastUpdated = lastUpdatedIso;

  const openingBalanceIso = toISOString(openingBalanceDate as any);
  if (openingBalanceIso) dto.openingBalanceDate = openingBalanceIso;

  const updatedAtIso = toISOString(updatedAt);
  if (updatedAtIso) dto.updatedAt = updatedAtIso;

  const createdAtIso = toISOString(createdAt);
  if (createdAtIso) dto.createdAt = createdAtIso;

  return dto;
}

export function accountFromDTO(a: AccountDTO): Account {
  const { lastUpdated, openingBalanceDate, updatedAt, createdAt, ...rest } = a;

  return {
    ...rest,
    lastUpdated: toDate(lastUpdated) || new Date(),
    openingBalanceDate: openingBalanceDate ? new Date(openingBalanceDate) : undefined,
    updatedAt: updatedAt ? new Date(updatedAt) : undefined,
    createdAt: createdAt ? new Date(createdAt) : undefined,
  } as Account;
}

// Transaction mappers
export function transactionToDTO(t: Transaction): TransactionDTO {
  const { date, reconciledDate, updatedAt, ...rest } = t as Transaction & {
    updatedAt?: Date;
  };

  const base = rest as TransactionBase;
  const dateIso = toISOString(date) ?? new Date(date).toISOString();

  const dto: TransactionDTO = {
    ...base,
    date: dateIso
  };

  const reconciledIso = toISOString(reconciledDate as any);
  if (reconciledIso) dto.reconciledDate = reconciledIso;

  const updatedIso = toISOString(updatedAt);
  if (updatedIso) dto.updatedAt = updatedIso;

  return dto;
}

export function transactionFromDTO(t: TransactionDTO): Transaction {
  const { date, reconciledDate, updatedAt, ...rest } = t;

  return {
    ...rest,
    date: toDate(date) || new Date(date),
    reconciledDate: reconciledDate ? new Date(reconciledDate) : undefined,
    ...(updatedAt ? { updatedAt: new Date(updatedAt) } : {})
  } as Transaction;
}

// Helpers for arrays
export const mapAccountsToDTO = (arr: Account[]) => arr.map(accountToDTO)
export const mapAccountsFromDTO = (arr: AccountDTO[]) => arr.map(accountFromDTO)
export const mapTransactionsToDTO = (arr: Transaction[]) => arr.map(transactionToDTO)
export const mapTransactionsFromDTO = (arr: TransactionDTO[]) => arr.map(transactionFromDTO)

// Budget mappers
export function budgetToDTO(b: Budget): BudgetDTO {
  const { createdAt, updatedAt, ...rest } = b;

  const base = rest as Omit<Budget, 'createdAt' | 'updatedAt'>;
  const dto: BudgetDTO = {
    ...base,
    createdAt: toISOString(createdAt) || new Date().toISOString()
  };

  const updatedAtIso = toISOString(updatedAt as any);
  if (updatedAtIso) dto.updatedAt = updatedAtIso;

  return dto;
}

export function budgetFromDTO(b: BudgetDTO): Budget {
  const { createdAt, updatedAt, ...rest } = b;

  return {
    ...rest,
    createdAt: toDate(createdAt) || new Date(),
    updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
  } as Budget;
}

export const mapBudgetsToDTO = (arr: Budget[]) => arr.map(budgetToDTO)
export const mapBudgetsFromDTO = (arr: BudgetDTO[]) => arr.map(budgetFromDTO)

// Goal mappers
export function goalToDTO(g: Goal): GoalDTO {
  const { createdAt, updatedAt, targetDate, ...rest } = g;

  const base = rest as Omit<Goal, 'createdAt' | 'updatedAt' | 'targetDate'>;
  const dto: GoalDTO = {
    ...base,
    createdAt: toISOString(createdAt) || new Date().toISOString(),
    targetDate: toISOString(targetDate) || new Date().toISOString()
  };

  const updatedAtIso = toISOString(updatedAt as any);
  if (updatedAtIso) dto.updatedAt = updatedAtIso;

  return dto;
}

export function goalFromDTO(g: GoalDTO): Goal {
  const { createdAt, updatedAt, targetDate, ...rest } = g;

  return {
    ...rest,
    createdAt: toDate(createdAt) || new Date(),
    updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
    targetDate: toDate(targetDate) || new Date(),
  } as Goal;
}

export const mapGoalsToDTO = (arr: Goal[]) => arr.map(goalToDTO)
export const mapGoalsFromDTO = (arr: GoalDTO[]) => arr.map(goalFromDTO)
