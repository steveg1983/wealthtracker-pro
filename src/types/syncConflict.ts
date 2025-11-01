export interface ConflictPayload<TData extends Record<string, unknown>, TEntity extends string = string> {
  id: string;
  entity: TEntity;
  clientData: TData;
  serverData: TData;
  clientTimestamp?: number;
  serverTimestamp?: number;
}

export interface TransactionConflictData extends Record<string, unknown> {
  amount: number;
  description: string;
  date: string;
  category: string;
}

export interface AccountConflictData extends Record<string, unknown> {
  balance: number;
  name?: string;
}

export interface BudgetConflictData extends Record<string, unknown> {
  amount: number;
  spent?: number;
}

export type TransactionConflict = ConflictPayload<TransactionConflictData, 'transaction'>;
export type AccountConflict = ConflictPayload<AccountConflictData, 'account'>;
export type BudgetConflict = ConflictPayload<BudgetConflictData, 'budget'>;
export type SyncConflict =
  | TransactionConflict
  | AccountConflict
  | BudgetConflict
  | ConflictPayload<Record<string, unknown>>;

export type ConflictData = SyncConflict['clientData'];

export const isTransactionConflict = (conflict: SyncConflict): conflict is TransactionConflict =>
  conflict.entity === 'transaction';

export const isAccountConflict = (conflict: SyncConflict): conflict is AccountConflict =>
  conflict.entity === 'account';

export const isBudgetConflict = (conflict: SyncConflict): conflict is BudgetConflict =>
  conflict.entity === 'budget';
