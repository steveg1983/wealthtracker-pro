import type {
  AutoSyncProcessContext,
  SupabaseDatabase,
} from '@wealthtracker/core';
import type {
  OfflineQueueItem,
  SyncEntityType,
} from '@wealthtracker/types/sync';
import {
  buildAccountInsert,
  buildAccountUpdate,
  buildTransactionInsert,
  buildTransactionUpdate,
  buildBudgetInsert,
  buildBudgetUpdate,
  buildGoalInsert,
  buildGoalUpdate,
  buildCategoryInsert,
  buildCategoryUpdate,
  type BudgetRow,
  type GoalRow,
  type CategoryRow,
  mapBudgetRowToDomain,
  applyBudgetPatch,
  diffBudget,
  mapGoalRowToDomain,
  applyGoalPatch,
  diffGoal,
  mapCategoryRowToDomain,
  applyCategoryPatch,
  diffCategory,
  toDate,
} from './autoSyncMappers';
import { storageAdapter, STORAGE_KEYS } from './storageAdapter';
import { analyticsEngine } from './analyticsEngine';
import type { EntityDataMap } from '../types/sync-types';
import { ConflictResolutionService } from '../services/conflictResolutionService';
import type { Account, Budget, Goal, Category, Transaction } from '../types';
import type { ConflictAnalysis } from '../services/conflictResolutionService';

const dispatchConflictEvent = (
  entity: string,
  clientData: unknown,
  serverData: unknown,
  analysis: ConflictAnalysis,
) => {
  const conflictId =
    (clientData as { id?: string })?.id ??
    (serverData as { id?: string })?.id;

  window.dispatchEvent(
    new CustomEvent('open-conflict-resolver', {
      detail: {
        conflict: {
          entity,
          clientData,
          serverData,
          id: conflictId,
        },
        analysis,
        source: 'auto-sync' as const,
      },
    }),
  );

  analyticsEngine.track('conflict_detected', {
    entity,
    conflictId,
    strategy: analysis.suggestedResolution,
    autoResolvable: analysis.canAutoResolve,
    fields: analysis.conflictingFields,
  });
};

const TEMP_ID_PREFIX = 'temp-';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ACCOUNT_ID_MAP_KEY = 'auto_sync_account_id_map';

type AccountIdMap = Record<string, string>;

type IdReconciledEventDetail = {
  entity: 'account';
  tempId: string;
  permanentId: string;
  account: Account;
};

let accountIdMapCache: AccountIdMap | null = null;

export const __autoSyncTestUtils = {
  resetAccountIdCache(): void {
    accountIdMapCache = null;
  },
  dispatchConflictEvent,
};

const isLikelyUuid = (value: string): boolean => UUID_PATTERN.test(value);

const isTemporaryId = (value: unknown): value is string =>
  typeof value === 'string' && (value.startsWith(TEMP_ID_PREFIX) || !isLikelyUuid(value));

const loadAccountIdMap = async (): Promise<AccountIdMap> => {
  if (accountIdMapCache) {
    return accountIdMapCache;
  }

  try {
    const stored = await storageAdapter.get<AccountIdMap>(ACCOUNT_ID_MAP_KEY);
    accountIdMapCache = stored ?? {};
  } catch {
    accountIdMapCache = {};
  }

  return accountIdMapCache;
};

const persistAccountIdMap = async (map: AccountIdMap): Promise<void> => {
  accountIdMapCache = map;
  try {
    await storageAdapter.set(ACCOUNT_ID_MAP_KEY, map);
  } catch {
    // Ignore persistence failures
  }
};

const toEntityRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const updateStorageArray = async <T>(
  key: string,
  mutate: (items: T[]) => { changed: boolean; value: T[] },
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => {
  try {
    const existing = await storageAdapter.get<T[]>(key);
    if (!existing || existing.length === 0) {
      return;
    }

    const { changed, value } = mutate(existing);
    if (!changed) {
      return;
    }

    await storageAdapter.set(key, value);
  } catch (error) {
    logger.warn('[AutoSync] Failed to update storage during ID reconciliation', {
      key,
      error,
    });
  }
};

const replaceAccountInStorage = async (
  key: string,
  tempId: string,
  updatedAccount: Account,
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => updateStorageArray<Account>(
  key,
  (items) => {
    let changed = false;
    const value = items.map((existing) => {
      if (existing.id === tempId) {
        changed = true;
        return { ...existing, ...updatedAccount };
      }
      return existing;
    });
    return { changed, value };
  },
  logger,
);

const removeAccountFromStorage = async (
  key: string,
  tempId: string,
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => updateStorageArray<Account>(
  key,
  (items) => {
    const filtered = items.filter(account => account.id !== tempId);
    return {
      changed: filtered.length !== items.length,
      value: filtered,
    };
  },
  logger,
);

const replaceAccountIdInTransactions = async (
  key: string,
  tempId: string,
  permanentId: string,
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => updateStorageArray<Transaction>(
  key,
  (items) => {
    let changed = false;
    const value = items.map((transaction) => {
      if (transaction.accountId === tempId) {
        changed = true;
        return { ...transaction, accountId: permanentId };
      }
      return transaction;
    });
    return { changed, value };
  },
  logger,
);

type OfflineAccountUpdate = { id: string; updates: Partial<Account> };
type OfflineTransactionUpdate = { id: string; updates: Partial<Transaction> };

const updateOfflineAccountUpdates = async (
  tempId: string,
  permanentId: string,
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => updateStorageArray<OfflineAccountUpdate>(
  'offline_account_updates',
  (items) => {
    let changed = false;

    const value = items.map((entry) => {
      if (entry.id === tempId) {
        changed = true;
        return { ...entry, id: permanentId };
      }
      return entry;
    });

    return { changed, value };
  },
  logger,
);

const updateOfflineAccountDeletes = async (
  tempId: string,
  permanentId: string,
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => updateStorageArray<string>(
  'offline_account_deletes',
  (items) => {
    let changed = false;
    const value = items.map((id) => {
      if (id === tempId) {
        changed = true;
        return permanentId;
      }
      return id;
    });
    return { changed, value };
  },
  logger,
);

const updateOfflineTransactionReferences = async (
  tempId: string,
  permanentId: string,
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => {
  await replaceAccountIdInTransactions('offline_transactions', tempId, permanentId, logger);
  await updateStorageArray<OfflineTransactionUpdate>(
    'offline_transaction_updates',
    (items) => {
      let changed = false;
      const value = items.map((entry) => {
        if (entry.updates?.accountId === tempId) {
          changed = true;
          return {
            ...entry,
            updates: {
              ...entry.updates,
              accountId: permanentId,
            },
          };
        }
        return entry;
      });
      return { changed, value };
    },
    logger,
  );

  await updateStorageArray<string>(
    'offline_transaction_deletes',
    (items) => {
      let changed = false;
      const value = items.map((id) => {
        if (id === tempId) {
          changed = true;
          return permanentId;
        }
        return id;
      });
      return { changed, value };
    },
    logger,
  );
};

const dispatchIdReconciledEvent = (detail: IdReconciledEventDetail): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent<IdReconciledEventDetail>('auto-sync-id-reconciled', { detail }));
  } catch {
    // Ignore window dispatch failures (e.g., SSR)
  }
};

const reconcileAccountIdLocally = async (
  tempId: string,
  permanentId: string,
  account: Account,
  logger: AutoSyncProcessContext<EntityDataMap>['logger'],
): Promise<void> => {
  const map = await loadAccountIdMap();
  if (map[tempId] !== permanentId) {
    map[tempId] = permanentId;
    await persistAccountIdMap(map);
  }

  const updatedAccount: Account = { ...account, id: permanentId };

  await replaceAccountInStorage(STORAGE_KEYS.ACCOUNTS, tempId, updatedAccount, logger);
  await removeAccountFromStorage('offline_accounts', tempId, logger);
  await replaceAccountIdInTransactions(STORAGE_KEYS.TRANSACTIONS, tempId, permanentId, logger);
  await updateOfflineTransactionReferences(tempId, permanentId, logger);
  await updateOfflineAccountUpdates(tempId, permanentId, logger);
  await updateOfflineAccountDeletes(tempId, permanentId, logger);

  dispatchIdReconciledEvent({
    entity: 'account',
    tempId,
    permanentId,
    account: updatedAccount,
  });
};

const resolveAccountId = async (
  accountId: string | undefined,
): Promise<string | null> => {
  if (!accountId) {
    return null;
  }

  if (!isTemporaryId(accountId)) {
    return accountId;
  }

  const map = await loadAccountIdMap();
  return map[accountId] ?? null;
};

type AutoSyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

interface SupabaseProcessorDeps {
  resolveClient(): Promise<SupabaseDatabase | null>;
  resolveDatabaseUserId(userId: string): Promise<string | null>;
  ensureDatabaseUser?(userId: string): Promise<string | null>;
}

interface ProcessArgs<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap>,
> {
  item: OfflineQueueItem<EntityMap, T>;
  context: AutoSyncProcessContext<EntityMap>;
  client: SupabaseDatabase;
  databaseUserId: string;
}

type EntityHandler<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap>,
> = Partial<Record<Lowercase<AutoSyncOperationType>, (args: ProcessArgs<EntityMap, T>) => Promise<void>>>;

export type SupabaseSyncHandlers<
  EntityMap extends Record<string, unknown>,
> = {
  [T in SyncEntityType<EntityMap>]?: EntityHandler<EntityMap, T>;
};

const METHOD_MAP: Record<AutoSyncOperationType, Lowercase<AutoSyncOperationType>> = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

export function createSupabaseSyncProcessor<
  EntityMap extends Record<string, unknown>,
>(
  deps: SupabaseProcessorDeps,
  handlers: SupabaseSyncHandlers<EntityMap>,
) {
  return async function processSyncItem(
    item: OfflineQueueItem<EntityMap, SyncEntityType<EntityMap>>,
    context: AutoSyncProcessContext<EntityMap>,
  ): Promise<void> {
    const { operation } = item;
    const handler = handlers[operation.entity];

    if (!handler) {
      context.logger.info('[AutoSync] No Supabase handler configured for entity; skipping sync', {
        entity: String(operation.entity),
        operation: operation.type,
      });
      return;
    }

    const methodKey = METHOD_MAP[operation.type];
    const method = handler[methodKey];

    if (!method) {
      context.logger.info('[AutoSync] No Supabase handler configured for operation; skipping sync', {
        entity: String(operation.entity),
        operation: operation.type,
      });
      return;
    }

    if (!context.userId) {
      context.logger.warn('[AutoSync] Cannot process sync item without an active user', {
        entity: String(operation.entity),
        operation: operation.type,
      });
      return;
    }

    const client = await deps.resolveClient();
    if (!client) {
      context.logger.warn('[AutoSync] Supabase client unavailable; deferring sync', {
        entity: String(operation.entity),
        operation: operation.type,
      });
      return;
    }

    let databaseUserId = await deps.resolveDatabaseUserId(context.userId);
    if (!databaseUserId && deps.ensureDatabaseUser) {
      databaseUserId = await deps.ensureDatabaseUser(context.userId);
    }

    if (!databaseUserId) {
      context.logger.error('[AutoSync] Unable to resolve database user id; skipping sync', {
        entity: String(operation.entity),
        operation: operation.type,
      });
      return;
    }

    const result = await method({
      item,
      context,
      client,
      databaseUserId,
    });
    void result;
  };
}

const createAccountHandlers = (): EntityHandler<EntityDataMap, 'account'> => ({
  create: async ({ item, context, client, databaseUserId }) => {
    const account = item.operation.data;
    if (!account?.id) {
      context.logger.error('[AutoSync] Account sync skipped: missing account id');
      return;
    }

    const originalId = account.id;
    if (isTemporaryId(originalId)) {
      const insertPayload = buildAccountInsert(account, databaseUserId);
      delete insertPayload.id;

      const { data, error } = await client
        .from('accounts')
        .insert([insertPayload])
        .select('id')
        .single();

      if (error) {
        throw new Error(`[AutoSync] Failed to insert account with temporary id: ${error.message}`);
      }

      const permanentId = data?.id;
      if (!permanentId) {
        throw new Error('[AutoSync] Supabase did not return an account id during reconciliation');
      }

      account.id = permanentId;
      item.operation.entityId = permanentId;

      await reconcileAccountIdLocally(originalId, permanentId, account, context.logger);

      context.logger.info('[AutoSync] Account synced (temporary id reconciled)', {
        tempId: originalId,
        accountId: permanentId,
        operation: item.operation.type,
      });

      context.enqueueImmediateSync();
      return;
    }

    const insert = buildAccountInsert(account, databaseUserId);
    const { error } = await client
      .from('accounts')
      .upsert([insert], { onConflict: 'id' });

    if (error) {
      throw new Error(`[AutoSync] Failed to upsert account: ${error.message}`);
    }

    context.logger.info('[AutoSync] Account synced', { accountId: account.id, operation: item.operation.type });
  },
  update: async ({ item, context, client, databaseUserId }) => {
    const account = item.operation.data;
    if (!account) {
      context.logger.error('[AutoSync] Account update skipped: missing account payload');
      return;
    }

    const rawAccountId = account.id ?? item.operation.entityId;
    if (!rawAccountId) {
      context.logger.error('[AutoSync] Account update skipped: missing account id');
      return;
    }

    const resolvedAccountId = await resolveAccountId(rawAccountId);
    if (!resolvedAccountId) {
      context.logger.warn('[AutoSync] Account update deferred until id reconciliation completes', {
        accountId: rawAccountId,
      });
      throw new Error('Account id pending reconciliation');
    }

    if (account.id !== resolvedAccountId) {
      account.id = resolvedAccountId;
      item.operation.entityId = resolvedAccountId;
    }

    const update = buildAccountUpdate(account, databaseUserId);
    const { error } = await client
      .from('accounts')
      .update(update)
      .eq('id', resolvedAccountId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to update account: ${error.message}`);
    }

    context.logger.info('[AutoSync] Account updated', { accountId: resolvedAccountId });
  },
  delete: async ({ item, context, client, databaseUserId }) => {
    const account = item.operation.data;
    const accountId = account?.id ?? item.operation.entityId;
    if (!accountId) {
      context.logger.error('[AutoSync] Account delete skipped: missing account id');
      return;
    }

    const resolvedAccountId = await resolveAccountId(accountId);
    if (!resolvedAccountId) {
      context.logger.warn('[AutoSync] Account delete deferred until id reconciliation completes', {
        accountId,
      });
      throw new Error('Account id pending reconciliation');
    }

    const { error } = await client
      .from('accounts')
      .delete()
      .eq('id', resolvedAccountId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to delete account: ${error.message}`);
    }

    context.logger.info('[AutoSync] Account deleted', { accountId: resolvedAccountId });
  },
});

const createTransactionHandlers = (): EntityHandler<EntityDataMap, 'transaction'> => ({
  create: async ({ item, context, client, databaseUserId }) => {
    const transaction = item.operation.data;
    if (!transaction?.id) {
      context.logger.error('[AutoSync] Transaction sync skipped: missing transaction id');
      return;
    }
    if (!transaction.accountId) {
      context.logger.error('[AutoSync] Transaction sync skipped: missing account reference', { transactionId: transaction.id });
      return;
    }

    const resolvedAccountId = await resolveAccountId(transaction.accountId);
    if (!resolvedAccountId) {
      context.logger.warn('[AutoSync] Transaction sync deferred until account id reconciles', {
        transactionId: transaction.id,
        accountId: transaction.accountId,
      });
      throw new Error('Account id pending reconciliation');
    }

    if (transaction.accountId !== resolvedAccountId) {
      transaction.accountId = resolvedAccountId;
    }

    const insert = buildTransactionInsert(transaction, databaseUserId, resolvedAccountId);
    const { error } = await client
      .from('transactions')
      .upsert([insert], { onConflict: 'id' });

    if (error) {
      throw new Error(`[AutoSync] Failed to upsert transaction: ${error.message}`);
    }

    context.logger.info('[AutoSync] Transaction synced', { transactionId: transaction.id, operation: item.operation.type });
  },
  update: async ({ item, context, client, databaseUserId }) => {
    const transaction = item.operation.data;
    if (!transaction?.id) {
      context.logger.error('[AutoSync] Transaction update skipped: missing transaction id');
      return;
    }
    if (!transaction.accountId) {
      context.logger.error('[AutoSync] Transaction update skipped: missing account reference', { transactionId: transaction.id });
      return;
    }

    const resolvedAccountId = await resolveAccountId(transaction.accountId);
    if (!resolvedAccountId) {
      context.logger.warn('[AutoSync] Transaction update deferred until account id reconciles', {
        transactionId: transaction.id,
        accountId: transaction.accountId,
      });
      throw new Error('Account id pending reconciliation');
    }

    if (transaction.accountId !== resolvedAccountId) {
      transaction.accountId = resolvedAccountId;
    }

    const update = buildTransactionUpdate(transaction, databaseUserId, resolvedAccountId);
    const { error } = await client
      .from('transactions')
      .update(update)
      .eq('id', transaction.id)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to update transaction: ${error.message}`);
    }

    context.logger.info('[AutoSync] Transaction updated', { transactionId: transaction.id });
  },
  delete: async ({ item, context, client, databaseUserId }) => {
    const transaction = item.operation.data;
    const transactionId = transaction?.id ?? item.operation.entityId;
    if (!transactionId) {
      context.logger.error('[AutoSync] Transaction delete skipped: missing transaction id');
      return;
    }

    const { error } = await client
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to delete transaction: ${error.message}`);
    }

    context.logger.info('[AutoSync] Transaction deleted', { transactionId });
  },
});

const createBudgetHandlers = (): EntityHandler<EntityDataMap, 'budget'> => ({
  create: async ({ item, context, client, databaseUserId }) => {
    const budget = item.operation.data;
    if (!budget?.id) {
      context.logger.error('[AutoSync] Budget sync skipped: missing budget id');
      return;
    }

    const insert = buildBudgetInsert(budget, databaseUserId);
    const { error } = await client
      .from('budgets')
      .upsert([insert], { onConflict: 'id' });

    if (error) {
      throw new Error(`[AutoSync] Failed to upsert budget: ${error.message}`);
    }

    context.logger.info('[AutoSync] Budget synced', { budgetId: budget.id, operation: item.operation.type });
  },
  update: async ({ item, context, client, databaseUserId }) => {
    const updates = item.operation.data;
    const budgetId = updates?.id ?? item.operation.entityId;
    if (!budgetId) {
      context.logger.error('[AutoSync] Budget update skipped: missing budget id');
      return;
    }

    const { data: existingRow, error: fetchError } = await client
      .from('budgets')
      .select('*')
      .eq('id', budgetId)
      .eq('user_id', databaseUserId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`[AutoSync] Failed to load existing budget for update: ${fetchError.message}`);
    }

    if (!updates || Object.keys(updates).length === 0) {
      context.logger.info('[AutoSync] Budget update skipped: empty payload', { budgetId });
      return;
    }

    const existingDomain = existingRow ? mapBudgetRowToDomain(existingRow as BudgetRow) : null;

    if (!existingDomain) {
      context.logger.warn('[AutoSync] Budget update skipped: existing record not found', { budgetId });
      return;
    }

    const clientDomain = applyBudgetPatch(existingDomain, updates as Partial<Budget>);
    const analysis = ConflictResolutionService.analyzeConflict(
      'budget',
      toEntityRecord(clientDomain),
      toEntityRecord(existingDomain),
      Date.now(),
      toDate(existingRow?.updated_at ?? new Date()).getTime(),
    );

    if (analysis.hasConflict && !analysis.canAutoResolve) {
      context.logger.warn('[AutoSync] Budget update conflict requires manual resolution; skipping', {
        budgetId,
        fields: analysis.conflictingFields,
      });
      dispatchConflictEvent('budget', clientDomain, existingDomain, analysis);
      return;
    }

    const mergedDomain = analysis.canAutoResolve && analysis.mergedData
      ? applyBudgetPatch(existingDomain, analysis.mergedData as Partial<Budget>)
      : clientDomain;

    const diff = diffBudget(existingDomain, mergedDomain);
    if (Object.keys(diff).length === 0) {
      context.logger.info('[AutoSync] Budget update skipped: no effective changes after merge', { budgetId });
      return;
    }

    const payload = buildBudgetUpdate(diff, existingRow as BudgetRow);
    if (!payload) {
      context.logger.info('[AutoSync] Budget update skipped: no material changes derived', { budgetId });
      return;
    }

    const { error } = await client
      .from('budgets')
      .update(payload)
      .eq('id', budgetId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to update budget: ${error.message}`);
    }

    context.logger.info('[AutoSync] Budget updated', {
      budgetId,
      conflictResolved: analysis.hasConflict,
      strategy: analysis.suggestedResolution,
    });

    if (analysis.hasConflict && ConflictResolutionService.requiresUserIntervention(analysis)) {
      dispatchConflictEvent('budget', mergedDomain, existingDomain, analysis);
    }
  },
  delete: async ({ item, context, client, databaseUserId }) => {
    const budget = item.operation.data;
    const budgetId = budget?.id ?? item.operation.entityId;
    if (!budgetId) {
      context.logger.error('[AutoSync] Budget delete skipped: missing budget id');
      return;
    }

    const { error } = await client
      .from('budgets')
      .delete()
      .eq('id', budgetId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to delete budget: ${error.message}`);
    }

    context.logger.info('[AutoSync] Budget deleted', { budgetId });
  },
});

const createGoalHandlers = (): EntityHandler<EntityDataMap, 'goal'> => ({
  create: async ({ item, context, client, databaseUserId }) => {
    const goal = item.operation.data;
    if (!goal?.id) {
      context.logger.error('[AutoSync] Goal sync skipped: missing goal id');
      return;
    }

    const insert = buildGoalInsert(goal, databaseUserId);
    const { error } = await client
      .from('goals')
      .upsert([insert], { onConflict: 'id' });

    if (error) {
      throw new Error(`[AutoSync] Failed to upsert goal: ${error.message}`);
    }

    context.logger.info('[AutoSync] Goal synced', { goalId: goal.id, operation: item.operation.type });
  },
  update: async ({ item, context, client, databaseUserId }) => {
    const updates = item.operation.data;
    const goalId = updates?.id ?? item.operation.entityId;
    if (!goalId) {
      context.logger.error('[AutoSync] Goal update skipped: missing goal id');
      return;
    }

    const { data: existingRow, error: fetchError } = await client
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', databaseUserId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`[AutoSync] Failed to load existing goal for update: ${fetchError.message}`);
    }

    if (!updates || Object.keys(updates).length === 0) {
      context.logger.info('[AutoSync] Goal update skipped: empty payload', { goalId });
      return;
    }

    const existingDomain = existingRow ? mapGoalRowToDomain(existingRow as GoalRow) : null;
    if (!existingDomain) {
      context.logger.warn('[AutoSync] Goal update skipped: existing record not found', { goalId });
      return;
    }

    const clientDomain = applyGoalPatch(existingDomain, updates as Partial<Goal>);
    const analysis = ConflictResolutionService.analyzeConflict(
      'goal',
      toEntityRecord(clientDomain),
      toEntityRecord(existingDomain),
      Date.now(),
      toDate(existingRow?.updated_at ?? new Date()).getTime(),
    );

    if (analysis.hasConflict && !analysis.canAutoResolve) {
      context.logger.warn('[AutoSync] Goal update conflict requires manual resolution; skipping', {
        goalId,
        fields: analysis.conflictingFields,
      });
      dispatchConflictEvent('goal', clientDomain, existingDomain, analysis);
      return;
    }

    const mergedDomain = analysis.canAutoResolve && analysis.mergedData
      ? applyGoalPatch(existingDomain, analysis.mergedData as Partial<Goal>)
      : clientDomain;

    const diff = diffGoal(existingDomain, mergedDomain);
    if (Object.keys(diff).length === 0) {
      context.logger.info('[AutoSync] Goal update skipped: no effective changes after merge', { goalId });
      return;
    }

    const payload = buildGoalUpdate(diff, existingRow as GoalRow);
    if (!payload) {
      context.logger.info('[AutoSync] Goal update skipped: no material changes derived', { goalId });
      return;
    }

    const { error } = await client
      .from('goals')
      .update(payload)
      .eq('id', goalId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to update goal: ${error.message}`);
    }

    context.logger.info('[AutoSync] Goal updated', {
      goalId,
      conflictResolved: analysis.hasConflict,
      strategy: analysis.suggestedResolution,
    });

    if (analysis.hasConflict && ConflictResolutionService.requiresUserIntervention(analysis)) {
      dispatchConflictEvent('goal', mergedDomain, existingDomain, analysis);
    }
  },
  delete: async ({ item, context, client, databaseUserId }) => {
    const goal = item.operation.data;
    const goalId = goal?.id ?? item.operation.entityId;
    if (!goalId) {
      context.logger.error('[AutoSync] Goal delete skipped: missing goal id');
      return;
    }

    const { error } = await client
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to delete goal: ${error.message}`);
    }

    context.logger.info('[AutoSync] Goal deleted', { goalId });
  },
});

const createCategoryHandlers = (): EntityHandler<EntityDataMap, 'category'> => ({
  create: async ({ item, context, client, databaseUserId }) => {
    const category = item.operation.data;
    if (!category?.id) {
      context.logger.error('[AutoSync] Category sync skipped: missing category id');
      return;
    }

    const insert = buildCategoryInsert(category, databaseUserId);
    const { error } = await client
      .from('categories')
      .upsert([insert], { onConflict: 'id' });

    if (error) {
      throw new Error(`[AutoSync] Failed to upsert category: ${error.message}`);
    }

    context.logger.info('[AutoSync] Category synced', { categoryId: category.id, operation: item.operation.type });
  },
  update: async ({ item, context, client, databaseUserId }) => {
    const updates = item.operation.data;
    const categoryId = updates?.id ?? item.operation.entityId;
    if (!categoryId) {
      context.logger.error('[AutoSync] Category update skipped: missing category id');
      return;
    }

    if (!updates || Object.keys(updates).length === 0) {
      context.logger.info('[AutoSync] Category update skipped: empty payload', { categoryId });
      return;
    }

    const { data: existingRow, error: fetchError } = await client
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .eq('user_id', databaseUserId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`[AutoSync] Failed to load existing category for update: ${fetchError.message}`);
    }

    if (!existingRow) {
      context.logger.warn('[AutoSync] Category update skipped: existing record not found', { categoryId });
      return;
    }

    const existingDomain = mapCategoryRowToDomain(existingRow as CategoryRow);
    const clientDomain = applyCategoryPatch(existingDomain, updates as Partial<Category>);
    const analysis = ConflictResolutionService.analyzeConflict(
      'category',
      toEntityRecord(clientDomain),
      toEntityRecord(existingDomain),
      Date.now(),
      toDate(existingRow.updated_at ?? new Date()).getTime(),
    );

    if (analysis.hasConflict && !analysis.canAutoResolve) {
      context.logger.warn('[AutoSync] Category update conflict requires manual resolution; skipping', {
        categoryId,
        fields: analysis.conflictingFields,
      });
      dispatchConflictEvent('category', clientDomain, existingDomain, analysis);
      return;
    }

    const mergedDomain = analysis.canAutoResolve && analysis.mergedData
      ? applyCategoryPatch(existingDomain, analysis.mergedData as Partial<Category>)
      : clientDomain;

    const diff = diffCategory(existingDomain, mergedDomain);
    if (Object.keys(diff).length === 0) {
      context.logger.info('[AutoSync] Category update skipped: no effective changes after merge', { categoryId });
      return;
    }

    const payload = buildCategoryUpdate(diff);
    if (!payload) {
      context.logger.info('[AutoSync] Category update skipped: no material changes derived', { categoryId });
      return;
    }

    const { error } = await client
      .from('categories')
      .update(payload)
      .eq('id', categoryId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to update category: ${error.message}`);
    }

    context.logger.info('[AutoSync] Category updated', {
      categoryId,
      conflictResolved: analysis.hasConflict,
      strategy: analysis.suggestedResolution,
    });

    if (analysis.hasConflict && ConflictResolutionService.requiresUserIntervention(analysis)) {
      dispatchConflictEvent('category', mergedDomain, existingDomain, analysis);
    }
  },
  delete: async ({ item, context, client, databaseUserId }) => {
    const category = item.operation.data;
    const categoryId = category?.id ?? item.operation.entityId;
    if (!categoryId) {
      context.logger.error('[AutoSync] Category delete skipped: missing category id');
      return;
    }

    const { error } = await client
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', databaseUserId);

    if (error) {
      throw new Error(`[AutoSync] Failed to delete category: ${error.message}`);
    }

    context.logger.info('[AutoSync] Category deleted', { categoryId });
  },
});

export type WebSupabaseProcessorDeps = SupabaseProcessorDeps;

export const createWebSupabaseProcessor = (deps: WebSupabaseProcessorDeps) =>
  createSupabaseSyncProcessor<EntityDataMap>(deps, {
    account: createAccountHandlers(),
    transaction: createTransactionHandlers(),
    budget: createBudgetHandlers(),
    goal: createGoalHandlers(),
    category: createCategoryHandlers(),
  });
