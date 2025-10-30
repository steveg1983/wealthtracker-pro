import {
  createAutoSyncService,
  ensureSupabaseClient,
  isSupabaseStub,
  type AutoSyncEnvironment,
  type AutoSyncHooks,
  type SupabaseDatabase,
} from '@wealthtracker/core';
import { storageAdapter, STORAGE_KEYS } from './storageAdapter';
import { userIdService } from './userIdService';
import { lazyLogger } from './serviceFactory';
import { createWebSupabaseProcessor } from './autoSyncSupabaseProcessor';
import {
  buildAccountInsert,
  buildTransactionInsert,
  type TransactionInsert,
} from './autoSyncMappers';
import type { Account, Transaction, Budget, Goal, Category } from '../types';
import type { EntityDataMap } from '../types/sync-types';

interface LocalData {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
}

const logger = lazyLogger.getLogger('AutoSync');

const safelySetLocalStorage = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore persistence failures
  }
};

const getSupabaseClient = async (): Promise<SupabaseDatabase | null> => {
  const client = await ensureSupabaseClient();
  if (!client || isSupabaseStub(client)) {
    return null;
  }
  return client;
};

const ensureDatabaseUser = async (clerkId: string): Promise<string | null> => {
  try {
    const databaseUserId = await userIdService.getDatabaseUserId(clerkId);
    if (databaseUserId) {
      return databaseUserId;
    }

    return await userIdService.ensureUserExists(
      clerkId,
      'user@example.com',
      undefined,
      undefined,
    );
  } catch (error) {
    logger.error('[AutoSync] Error ensuring user exists:', error);
    return null;
  }
};

const environment: AutoSyncEnvironment = {
  onOnline: (handler) => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  },
  onOffline: (handler) => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
    window.addEventListener('offline', handler);
    return () => window.removeEventListener('offline', handler);
  },
  isOnline: () => (typeof navigator !== 'undefined' ? navigator.onLine : true),
  setInterval: (handler, intervalMs) => globalThis.setInterval(handler, intervalMs),
  clearInterval: (handle) => {
    if (handle) {
      globalThis.clearInterval(handle);
    }
  },
  now: () => new Date(),
};

const hooks: AutoSyncHooks<EntityDataMap, LocalData> = {
  async loadLocalData() {
    const [
      accountsRaw,
      transactionsRaw,
      budgetsRaw,
      goalsRaw,
      categoriesRaw,
    ] = await Promise.all([
      storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS),
      storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS),
      storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS),
      storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS),
      storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES),
    ]);

    const data: LocalData = {
      accounts: accountsRaw ?? [],
      transactions: transactionsRaw ?? [],
      budgets: budgetsRaw ?? [],
      goals: goalsRaw ?? [],
      categories: categoriesRaw ?? [],
    };

    logger.debug('[AutoSync] Local data loaded', {
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      budgets: data.budgets.length,
      goals: data.goals.length,
      categories: data.categories.length,
    });

    return data;
  },

  hasLocalData(data) {
    return data.accounts.length > 0 ||
      data.transactions.length > 0 ||
      data.budgets.length > 0 ||
      data.goals.length > 0;
  },

  async checkCloudData(userId) {
    const client = await getSupabaseClient();
    if (!client) return false;

    try {
      const databaseUserId = await userIdService.getDatabaseUserId(userId);
      if (!databaseUserId) return false;

      const { data: accounts } = await client
        .from('accounts')
        .select('id')
        .eq('user_id', databaseUserId)
        .limit(1);

      const hasCloudData = !!(accounts && accounts.length > 0);
      logger.info('[AutoSync] Cloud data exists', { hasCloudData });
      return hasCloudData;
    } catch (error) {
      logger.error('[AutoSync] Error checking cloud data:', error);
      return false;
    }
  },

  async migrateToCloud(userId, localData) {
    const client = await getSupabaseClient();
    if (!client) return;

    logger.info('[AutoSync] Starting silent migration to cloud...');

    try {
      const dbUserId = await ensureDatabaseUser(userId);
      if (!dbUserId) {
        throw new Error('Failed to create user in database');
      }

      if (localData.accounts.length > 0) {
        const accountsToInsert = localData.accounts.map((account) =>
          buildAccountInsert(account, dbUserId),
        );

        const { error } = await client.from('accounts').insert(accountsToInsert);
        if (error) {
          logger.error('[AutoSync] Failed to migrate accounts:', error);
        } else {
          logger.info('[AutoSync] Migrated accounts', { count: accountsToInsert.length });
        }
      }

      if (localData.transactions.length > 0) {
        const accountIds = localData.accounts.map(account => account.id);
        if (accountIds.length === 0) {
          logger.warn('[AutoSync] Skipping transaction migration; no accounts available for mapping');
        } else {
          const { data: cloudAccounts } = await client
            .from('accounts')
            .select('id')
            .eq('user_id', dbUserId)
            .in('id', accountIds);

          const accountIdSet = new Set(cloudAccounts?.map(acc => acc.id) ?? []);

          const transactionsToInsert = localData.transactions.reduce<TransactionInsert[]>((accumulator, transaction) => {
            if (!transaction.accountId || !accountIdSet.has(transaction.accountId)) {
              logger.warn('[AutoSync] Skipping transaction migration; account missing in Supabase', {
                transactionId: transaction.id,
                accountId: transaction.accountId,
              });
              return accumulator;
            }

            accumulator.push(buildTransactionInsert(transaction, dbUserId, transaction.accountId));
            return accumulator;
          }, []);

          if (transactionsToInsert.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
              const batch = transactionsToInsert.slice(i, i + batchSize);
              const { error } = await client.from('transactions').insert(batch);
              if (error) {
                logger.error('[AutoSync] Failed to migrate transaction batch:', error);
              }
            }
            logger.info('[AutoSync] Migrated transactions', { count: transactionsToInsert.length });
          }
        }
      }

      safelySetLocalStorage('autoSyncMigrationComplete', 'true');
      safelySetLocalStorage('autoSyncMigrationDate', new Date().toISOString());

      logger.info('[AutoSync] Silent migration complete');
    } catch (error) {
      logger.error('[AutoSync] Migration failed:', error);
    }
  },

  async mergeData() {
    logger.info('[AutoSync] Merge complete - using cloud as source of truth');
  },

  async convertLocalToCache() {
    safelySetLocalStorage('primaryStorage', 'cloud');
    logger.info('[AutoSync] Local storage converted to cache mode');
  },

  processSyncItem: createWebSupabaseProcessor({
    resolveClient: getSupabaseClient,
    resolveDatabaseUserId: (userIdentifier: string) => userIdService.getDatabaseUserId(userIdentifier),
    ensureDatabaseUser,
  }),
};

const autoSyncService = createAutoSyncService<EntityDataMap, LocalData>({
  logger,
  environment,
  hooks,
});

export default autoSyncService;
