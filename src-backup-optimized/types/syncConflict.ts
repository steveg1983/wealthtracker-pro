import type { Transaction, Account, Budget, Goal } from '.';

type ConflictEntityMap = {
  transaction: Transaction;
  account: Account;
  budget: Budget;
  goal: Goal;
};

export type ConflictEntity = keyof ConflictEntityMap;

type SyncConflictBase<TEntity extends ConflictEntity> = {
  id: string;
  operationId?: string;
  clientData: ConflictEntityMap[TEntity];
  serverData: ConflictEntityMap[TEntity];
  entity: TEntity;
  timestamp: number;
  resolved: boolean;
  clientTimestamp?: number;
  serverTimestamp?: number;
};

export type SyncConflict =
  | SyncConflictBase<'transaction'>
  | SyncConflictBase<'account'>
  | SyncConflictBase<'budget'>
  | SyncConflictBase<'goal'>;
