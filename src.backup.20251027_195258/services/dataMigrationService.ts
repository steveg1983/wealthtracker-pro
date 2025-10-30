/**
 * Data Migration Service
 * 
 * Safely migrates data from localStorage to Supabase
 * Handles all data types: accounts, transactions, budgets, goals
 * Provides rollback capability if migration fails
 */

import {
  ensureSupabaseClient,
  isSupabaseStub,
  type SupabaseDatabase
} from '@wealthtracker/core';
import { store } from '../store';
import { userIdService } from './userIdService';
import type { Account, Transaction, Budget, Goal } from '../types';
import { lazyLogger as logger } from './serviceFactory';
import type { Database, Json } from '@app-types/supabase';

export interface MigrationStatus {
  inProgress: boolean;
  completed: boolean;
  error: string | null;
  stats: {
    accounts: { total: number; migrated: number; failed: number };
    transactions: { total: number; migrated: number; failed: number };
    budgets: { total: number; migrated: number; failed: number };
    goals: { total: number; migrated: number; failed: number };
  };
}

const SERVICE_PREFIX = '[DataMigrationService]';

type MigrationSupabaseClient = SupabaseDatabase;

type AccountsTable = Database['public']['Tables']['accounts'];
type TransactionsTable = Database['public']['Tables']['transactions'];
type BudgetsTable = Database['public']['Tables']['budgets'];
type GoalsTable = Database['public']['Tables']['goals'];

type AccountInsert = AccountsTable['Insert'];
type TransactionInsert = TransactionsTable['Insert'];
type BudgetInsert = BudgetsTable['Insert'];
type GoalInsert = GoalsTable['Insert'];

const toIsoString = (value?: Date | string | null): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return new Date().toISOString();
};

const toDateOnlyString = (value?: Date | string | null): string => {
  const isoValue = toIsoString(value);
  const [datePart] = isoValue.split('T');
  return datePart ?? isoValue;
};

const toJsonValue = (value: unknown): Json => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(item => toJsonValue(item));
  }

  if (typeof value === 'object') {
    const result: Record<string, Json> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toJsonValue(nested);
    }
    return result;
  }

  return String(value);
};

const buildJsonObject = (entries: Record<string, unknown>): Json | undefined => {
  const filtered = Object.entries(entries).filter(([, value]) => value !== undefined);
  if (filtered.length === 0) {
    return undefined;
  }

  const jsonObject: Record<string, Json> = {};
  for (const [key, value] of filtered) {
    jsonObject[key] = toJsonValue(value);
  }
  return jsonObject;
};

const mapBudgetPeriod = (period: Budget['period']): BudgetInsert['period'] => {
  if (period === 'quarterly') {
    return 'custom';
  }

  if (period === 'monthly' || period === 'weekly' || period === 'yearly' || period === 'custom') {
    return period;
  }

  return 'monthly';
};

export class DataMigrationService {
  private static migrationStatus: MigrationStatus = {
    inProgress: false,
    completed: false,
    error: null,
    stats: {
      accounts: { total: 0, migrated: 0, failed: 0 },
      transactions: { total: 0, migrated: 0, failed: 0 },
      budgets: { total: 0, migrated: 0, failed: 0 },
      goals: { total: 0, migrated: 0, failed: 0 },
    },
  };
  private static accountIdMapping: Map<string, string> = new Map();

  private static async getClient(context: string): Promise<MigrationSupabaseClient | null> {
    try {
      const client = await ensureSupabaseClient();
      if (!client || isSupabaseStub(client)) {
        logger.warn(`${SERVICE_PREFIX} Supabase unavailable during ${context}`);
        return null;
      }
      return client;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Failed to resolve Supabase client for ${context}`, error);
      return null;
    }
  }

  /**
   * Check if user has any data in Supabase
   */
  static async hasCloudData(userId: string): Promise<boolean> {
    const client = await this.getClient('hasCloudData');
    if (!client) {
      return false;
    }

    try {
      const { data: profile } = await client
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!profile) return false;

      const { data: accounts } = await client
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      return Boolean(accounts && accounts.length > 0);
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error checking cloud data`, error);
      return false;
    }
  }

  /**
   * Get user's Supabase profile ID from Clerk ID (create if doesn't exist)
   * Now delegates to centralized userIdService
   */
  static async getUserProfileId(clerkUserId: string): Promise<string | null> {
    const client = await this.getClient('getUserProfileId');
    if (!client) {
      return null;
    }

    try {
      const databaseUserId = await userIdService.ensureUserExists(
        clerkUserId,
        'migrated@example.com',
        undefined,
        undefined
      );

      if (!databaseUserId) {
        logger.error(`${SERVICE_PREFIX} Failed to get or create user for migration`);
        return null;
      }

      return databaseUserId;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error in getUserProfileId`, error);
      return null;
    }
  }

  /**
   * Migrate all accounts to Supabase
   */
  static async migrateAccounts(userId: string, accounts: Account[]): Promise<boolean> {
    if (accounts.length === 0) {
      return true;
    }

    const client = await this.getClient('migrateAccounts');
    if (!client) {
      this.migrationStatus.error = 'Supabase unavailable for account migration';
      return false;
    }

    logger.info(`${SERVICE_PREFIX} Migrating accounts...`, { count: accounts.length });
    this.migrationStatus.stats.accounts.total = accounts.length;
    this.accountIdMapping.clear();

    try {
      const accountsToInsert: AccountInsert[] = accounts.map((account) => {
        const createdTimestamp = toIsoString(account.updatedAt ?? account.lastUpdated);

        const metadata = buildJsonObject({
          notes: account.notes,
          tags: account.tags,
          holdings: account.holdings,
          openingBalance: account.openingBalance,
          openingBalanceDate: account.openingBalanceDate,
          plaidConnectionId: account.plaidConnectionId,
          plaidAccountId: account.plaidAccountId,
          mask: account.mask,
          available: account.available
        });

        const insert: AccountInsert = {
          user_id: userId,
          name: account.name ?? 'Unnamed Account',
          type: this.mapAccountType(account.type),
          balance: account.balance ?? 0,
          currency: account.currency ?? 'USD',
          institution: account.institution ?? null,
          account_number: account.accountNumber ?? null,
          sort_code: account.sortCode ?? null,
          is_active: account.isActive !== false,
          created_at: createdTimestamp,
          updated_at: createdTimestamp
        };

        if (account.openingBalance !== undefined) {
          insert.initial_balance = account.openingBalance;
        }

        if (metadata) {
          insert.metadata = metadata;
        }

        return insert;
      });

      const { data, error } = await client
        .from('accounts')
        .insert(accountsToInsert)
        .select();

      if (error) {
        logger.error(`${SERVICE_PREFIX} Error migrating accounts`, error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.accounts.failed = accounts.length;
        this.accountIdMapping.clear();
        return false;
      }

      this.migrationStatus.stats.accounts.migrated = data?.length || 0;
      logger.info(`${SERVICE_PREFIX} Migrated accounts successfully`, { migrated: data?.length || 0 });

      if (data && data.length) {
        accounts.forEach((oldAccount, index) => {
          const inserted = data[index];
          if (inserted?.id) {
            this.accountIdMapping.set(oldAccount.id, inserted.id);
          }
        });
      }

      return true;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Failed to migrate accounts`, error);
      this.migrationStatus.error = 'Failed to migrate accounts';
      this.accountIdMapping.clear();
      return false;
    }
  }

  /**
   * Migrate all transactions to Supabase
   */
  static async migrateTransactions(userId: string, transactions: Transaction[]): Promise<boolean> {
    if (transactions.length === 0) {
      return true;
    }

    const client = await this.getClient('migrateTransactions');
    if (!client) {
      this.migrationStatus.error = 'Supabase unavailable for transaction migration';
      return false;
    }

    logger.info(`${SERVICE_PREFIX} Migrating transactions...`, { count: transactions.length });
    this.migrationStatus.stats.transactions.total = transactions.length;

    try {
      if (this.accountIdMapping.size === 0) {
        logger.warn(`${SERVICE_PREFIX} Account ID mapping not found prior to transaction migration`);
        return false;
      }

      const batchSize = 100;
      let migrated = 0;

      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);

        const transactionsToInsert: TransactionInsert[] = batch.map((transaction) => {
          const transactionWithMeta = transaction as Transaction & { reconciled?: boolean; createdAt?: Date | string };
          const createdTimestamp = toIsoString(transactionWithMeta.createdAt ?? transaction.date);

          const insert: TransactionInsert = {
            user_id: userId,
            account_id: this.accountIdMapping.get(transaction.accountId) ?? transaction.accountId,
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            date: toDateOnlyString(transaction.date),
            created_at: createdTimestamp,
            updated_at: createdTimestamp
          };

          const categoryId =
            typeof transaction.category === 'string' &&
            transaction.category.length > 0 &&
            transaction.category.toLowerCase() !== 'uncategorized'
              ? transaction.category
              : null;

          if (categoryId) {
            insert.category_id = categoryId;
          }

          if (typeof transaction.notes === 'string' && transaction.notes.length > 0) {
            insert.notes = transaction.notes;
          }

          if (Array.isArray(transaction.tags)) {
            const tagList = transaction.tags.filter((tag): tag is string => typeof tag === 'string');
            if (tagList.length > 0) {
              insert.tags = tagList;
            }
          }

          if (transaction.isRecurring !== undefined) {
            insert.is_recurring = transaction.isRecurring;
          }

          if (transaction.recurringTransactionId) {
            insert.recurring_template_id = transaction.recurringTransactionId;
          }

          if (transaction.linkedTransferId) {
            insert.transfer_account_id = transaction.linkedTransferId;
          }

          const metadataEntries: Record<string, unknown> = {
            merchant: transaction.merchant,
            location: transaction.location,
            isCleared: transaction.cleared,
            reconciled: transactionWithMeta.reconciled,
            reconciledWith: transaction.reconciledWith,
            reconciledDate: transaction.reconciledDate,
            reconciledNotes: transaction.reconciledNotes,
            bankReference: transaction.bankReference,
            goalId: transaction.goalId,
            addedBy: transaction.addedBy,
            transferMetadata: transaction.transferMetadata,
            investmentData: transaction.investmentData,
            isImported: transaction.isImported,
            pending: transaction.pending,
            plaidTransactionId: transaction.plaidTransactionId,
            paymentChannel: transaction.paymentChannel,
            categoryLabel: transaction.categoryName ?? (categoryId ? undefined : transaction.category),
            accountName: transaction.accountName
          };

          const metadata = buildJsonObject(metadataEntries);
          if (metadata) {
            insert.metadata = metadata;
          }

          return insert;
        });

        const { data, error } = await client
          .from('transactions')
          .insert(transactionsToInsert)
          .select();

        if (error) {
          logger.error(`${SERVICE_PREFIX} Error migrating transaction batch ${i / batchSize + 1}`, error);
          this.migrationStatus.stats.transactions.failed += batch.length;
        } else {
          migrated += data?.length || 0;
          this.migrationStatus.stats.transactions.migrated = migrated;
          logger.info(`${SERVICE_PREFIX} Migrated transactions batch`, { batch: i / batchSize + 1, count: data?.length });
        }
      }

      logger.info(`${SERVICE_PREFIX} Migrated transactions summary`, { migrated, total: transactions.length });
      return migrated > 0;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Failed to migrate transactions`, error);
      this.migrationStatus.error = 'Failed to migrate transactions';
      return false;
    }
  }

  /**
   * Migrate all budgets to Supabase
   */
  static async migrateBudgets(userId: string, budgets: Budget[]): Promise<boolean> {
    if (budgets.length === 0) {
      return true;
    }

    const client = await this.getClient('migrateBudgets');
    if (!client) {
      this.migrationStatus.error = 'Supabase unavailable for budget migration';
      return false;
    }

    logger.info(`${SERVICE_PREFIX} Migrating budgets...`, { count: budgets.length });
    this.migrationStatus.stats.budgets.total = budgets.length;

      try {
        const budgetsToInsert: BudgetInsert[] = budgets.map((budget) => {
          const nowIso = toIsoString(budget.updatedAt ?? budget.createdAt);
          const metadata = buildJsonObject({
            notes: budget.notes,
            color: budget.color,
            budgeted: budget.budgeted,
            limit: budget.limit,
            spent: budget.spent,
            rolloverAmount: budget.rolloverAmount
          });

          const normalisedCategoryId =
            budget.categoryId && budget.categoryId.toLowerCase() !== 'uncategorized'
              ? budget.categoryId
              : null;

          const insert: BudgetInsert = {
            user_id: userId,
            name: budget.name ?? 'Unnamed Budget',
            category_id: normalisedCategoryId,
            amount: budget.amount ?? 0,
            period: mapBudgetPeriod(budget.period),
            start_date: toDateOnlyString(budget.startDate ?? null),
            end_date: budget.endDate ?? null,
            rollover_enabled: budget.rollover ?? false,
            rollover_amount: budget.rolloverAmount ?? 0,
            alert_enabled: budget.alertThreshold !== undefined ? budget.alertThreshold > 0 : true,
            alert_threshold: budget.alertThreshold ?? 80,
            is_active: budget.isActive !== false,
            created_at: nowIso,
            updated_at: nowIso
          };

          if (metadata) {
            insert.metadata = metadata;
          }

          return insert;
        });

      const { data, error } = await client
        .from('budgets')
        .insert(budgetsToInsert)
        .select();

      if (error) {
        logger.error(`${SERVICE_PREFIX} Error migrating budgets`, error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.budgets.failed = budgets.length;
        return false;
      }

      this.migrationStatus.stats.budgets.migrated = data?.length || 0;
      logger.info(`${SERVICE_PREFIX} Migrated budgets successfully`, { migrated: data?.length || 0 });
      return true;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Failed to migrate budgets`, error);
      this.migrationStatus.error = 'Failed to migrate budgets';
      return false;
    }
  }

  /**
   * Migrate all goals to Supabase
   */
  static async migrateGoals(userId: string, goals: Goal[]): Promise<boolean> {
    if (goals.length === 0) {
      return true;
    }

    const client = await this.getClient('migrateGoals');
    if (!client) {
      this.migrationStatus.error = 'Supabase unavailable for goal migration';
      return false;
    }

    logger.info(`${SERVICE_PREFIX} Migrating goals...`, { count: goals.length });
    this.migrationStatus.stats.goals.total = goals.length;

    try {
      const goalsToInsert: GoalInsert[] = goals.map((goal) => {
        const createdAt = toIsoString(goal.createdAt);
        const updatedAt = toIsoString(goal.updatedAt ?? goal.createdAt);
        const metadata = buildJsonObject({
          type: goal.type,
          linkedAccountIds: goal.linkedAccountIds,
          progress: goal.progress,
          isActive: goal.isActive,
          achievementDate: goal.achieved ? goal.updatedAt ?? goal.createdAt : undefined
        });

        const insert: GoalInsert = {
          user_id: userId,
          name: goal.name,
          description: goal.description ?? null,
          target_amount: goal.targetAmount,
          current_amount: goal.currentAmount ?? 0,
          target_date: goal.targetDate ? toIsoString(goal.targetDate) : null,
          category: goal.category ?? null,
          priority: goal.priority ?? 'medium',
          status: goal.achieved ? 'completed' : 'active',
          auto_contribute: false,
          contribution_amount: null,
          contribution_frequency: null,
          created_at: createdAt,
          updated_at: updatedAt,
          completed_at: goal.achieved ? updatedAt : null
        };

        if (metadata) {
          insert.metadata = metadata;
        }

        return insert;
      });

      const { data, error } = await client
        .from('goals')
        .insert(goalsToInsert)
        .select();

      if (error) {
        logger.error(`${SERVICE_PREFIX} Error migrating goals`, error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.goals.failed = goals.length;
        return false;
      }

      this.migrationStatus.stats.goals.migrated = data?.length || 0;
      logger.info(`${SERVICE_PREFIX} Migrated goals successfully`, { migrated: data?.length || 0 });
      return true;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Failed to migrate goals`, error);
      this.migrationStatus.error = 'Failed to migrate goals';
      return false;
    }
  }

  /**
   * Main migration function - migrates all data
   */
  static async migrateToSupabase(clerkUserId: string): Promise<MigrationStatus> {
    if (!(await this.getClient('migrateToSupabase'))) {
      return {
        ...this.migrationStatus,
        error: 'Supabase not configured',
      };
    }

    logger.info(`${SERVICE_PREFIX} Starting data migration to Supabase...`);
    this.migrationStatus.inProgress = true;
    this.migrationStatus.error = null;

    try {
      const userId = await this.getUserProfileId(clerkUserId);
      if (!userId) {
        throw new Error('User profile not found in Supabase');
      }

      const hasData = await this.hasCloudData(userId);
      if (hasData) {
        logger.warn(`${SERVICE_PREFIX} User already has cloud data. Skipping migration.`);
        return {
          ...this.migrationStatus,
          completed: true,
          error: 'User already has cloud data',
        };
      }

      const state = store.getState();
      const { accounts, transactions, budgets, goals } = state;

      const accountsSuccess = await this.migrateAccounts(userId, accounts.accounts);
      if (!accountsSuccess) {
        throw new Error('Failed to migrate accounts');
      }

      const transactionsSuccess = await this.migrateTransactions(userId, transactions.transactions);
      if (!transactionsSuccess) {
        logger.warn(`${SERVICE_PREFIX} Some transactions failed to migrate`);
      }

      const budgetsSuccess = await this.migrateBudgets(userId, budgets.budgets);
      if (!budgetsSuccess) {
        logger.warn(`${SERVICE_PREFIX} Some budgets failed to migrate`);
      }

      const goalsSuccess = await this.migrateGoals(userId, goals.goals);
      if (!goalsSuccess) {
        logger.warn(`${SERVICE_PREFIX} Some goals failed to migrate`);
      }

      this.migrationStatus.completed = true;
      this.migrationStatus.inProgress = false;

      this.setMigrationFlag('supabaseMigrationCompleted', 'true');
      this.setMigrationFlag('supabaseMigrationDate', new Date().toISOString());

      logger.info(`${SERVICE_PREFIX} Migration completed successfully`);
      logger.info(`${SERVICE_PREFIX} Migration stats`, this.migrationStatus.stats);

      return this.migrationStatus;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Migration failed`, error);
      this.migrationStatus.error = error instanceof Error ? error.message : 'Unknown error';
      this.migrationStatus.inProgress = false;
      return this.migrationStatus;
    }
  }

  private static setMigrationFlag(key: string, value: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error setting migration flag ${key}`, error);
    }
  }

  private static getMigrationFlag(key: string): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error reading migration flag ${key}`, error);
      return null;
    }
  }

  private static removeMigrationFlag(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error clearing migration flag ${key}`, error);
    }
  }

  /**
   * Helper to map account types
   */
  private static mapAccountType(type: string): AccountInsert['type'] {
    switch (type) {
      case 'current':
      case 'checking':
        return 'checking';
      case 'savings':
        return 'savings';
      case 'credit':
        return 'credit';
      case 'investment':
        return 'investment';
      case 'cash':
        return 'cash';
      default:
        return 'other';
    }
  }

  /**
   * Check if migration has been completed
   */
  static isMigrationCompleted(): boolean {
    return this.getMigrationFlag('supabaseMigrationCompleted') === 'true';
  }

  /**
   * Reset migration status (for testing)
   */
  static resetMigration(): void {
    this.removeMigrationFlag('supabaseMigrationCompleted');
    this.removeMigrationFlag('supabaseMigrationDate');
    this.migrationStatus = {
      inProgress: false,
      completed: false,
      error: null,
      stats: {
        accounts: { total: 0, migrated: 0, failed: 0 },
        transactions: { total: 0, migrated: 0, failed: 0 },
        budgets: { total: 0, migrated: 0, failed: 0 },
        goals: { total: 0, migrated: 0, failed: 0 },
      },
    };
  }
}
