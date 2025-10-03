import type { Account, Transaction, Budget, Goal, RecurringTransaction } from '../../types';

type NullableDate = Date | string | null | undefined;

const toDate = (value: NullableDate): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toDateOrNow = (value: NullableDate): Date => toDate(value) ?? new Date();

const normalizeTransferMetadata = (
  metadata: Transaction['transferMetadata']
): Transaction['transferMetadata'] => {
  if (!metadata) return metadata;

  return {
    ...metadata,
    initiatedDate: toDate(metadata.initiatedDate),
    settlementDate: toDate(metadata.settlementDate),
    approvalDate: toDate(metadata.approvalDate),
  };
};

export const normalizeAccount = (account: Account): Account => ({
  ...account,
  lastUpdated: toDateOrNow(account.lastUpdated),
  updatedAt: toDate(account.updatedAt) ?? new Date(),
  openingBalanceDate: toDate(account.openingBalanceDate),
  createdAt: toDate(account.createdAt),
});

export const normalizeAccounts = (accounts: Account[]): Account[] => accounts.map(normalizeAccount);

export const normalizeTransaction = (transaction: Transaction): Transaction => ({
  ...transaction,
  date: toDateOrNow(transaction.date),
  reconciledDate: toDate(transaction.reconciledDate),
  createdAt: toDate(transaction.createdAt),
  updatedAt: toDate(transaction.updatedAt),
  transferMetadata: normalizeTransferMetadata(transaction.transferMetadata),
});

export const normalizeTransactions = (transactions: Transaction[]): Transaction[] => transactions.map(normalizeTransaction);

export const normalizeBudget = (budget: Budget): Budget => ({
  ...budget,
  createdAt: toDateOrNow(budget.createdAt),
  updatedAt: toDate(budget.updatedAt) ?? new Date(),
});

export const normalizeBudgets = (budgets: Budget[]): Budget[] => budgets.map(normalizeBudget);

const calculateGoalProgress = (currentAmount: number, targetAmount: number): number => {
  if (!targetAmount) return 0;
  const progress = (currentAmount / targetAmount) * 100;
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, progress));
};

export const normalizeGoal = (goal: Goal): Goal => {
  const currentAmount = typeof goal.currentAmount === 'number' ? goal.currentAmount : 0;
  const targetAmount = typeof goal.targetAmount === 'number' ? goal.targetAmount : 0;

  return {
    ...goal,
    createdAt: toDateOrNow(goal.createdAt),
    updatedAt: toDate(goal.updatedAt) ?? new Date(),
    targetDate: toDateOrNow(goal.targetDate),
    progress: typeof goal.progress === 'number' && Number.isFinite(goal.progress)
      ? goal.progress
      : calculateGoalProgress(currentAmount, targetAmount),
  };
};

export const normalizeGoals = (goals: Goal[]): Goal[] => goals.map(normalizeGoal);

export const normalizeRecurringTransaction = (recurring: RecurringTransaction): RecurringTransaction => ({
  ...recurring,
  startDate: toDateOrNow(recurring.startDate),
  endDate: toDate(recurring.endDate),
  nextDate: toDateOrNow(recurring.nextDate),
  lastProcessed: toDate(recurring.lastProcessed),
  createdAt: toDateOrNow(recurring.createdAt),
  updatedAt: toDateOrNow(recurring.updatedAt),
});

export const normalizeRecurringTransactions = (recurringTransactions: RecurringTransaction[]): RecurringTransaction[] =>
  recurringTransactions.map(normalizeRecurringTransaction);

export const serializeRecurringTransaction = (recurring: RecurringTransaction): RecurringTransaction => ({
  ...recurring,
  startDate: new Date(recurring.startDate),
  endDate: recurring.endDate ? new Date(recurring.endDate) : undefined,
  nextDate: new Date(recurring.nextDate),
  lastProcessed: recurring.lastProcessed ? new Date(recurring.lastProcessed) : undefined,
  createdAt: new Date(recurring.createdAt),
  updatedAt: new Date(recurring.updatedAt),
});

export const serializeRecurringTransactions = (recurringTransactions: RecurringTransaction[]): RecurringTransaction[] =>
  recurringTransactions.map(serializeRecurringTransaction);

export const toDateOrUndefined = toDate;
export const toDateOrNowHelper = toDateOrNow;
