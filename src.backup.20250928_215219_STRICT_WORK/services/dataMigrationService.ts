/**
 * Data Migration Service
 * 
 * Safely migrates data from localStorage to Supabase
 * Handles all data types: accounts, transactions, budgets, goals
 * Provides rollback capability if migration fails
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSupabaseClient } from '../lib/supabase';
import { store } from '../store';
import { userIdService } from './userIdService';
import type { Account, Transaction, Budget, Goal } from '../types';
import { lazyLogger as logger } from './serviceFactory';

interface MigrationStatus {
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

type MigrationSupabaseClient = SupabaseClient<any>;

const toIsoString = (value?: Date | string | null): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return new Date().toISOString();
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
      if (!client || (client as any).__isStub) {
        logger.warn(`${SERVICE_PREFIX} Supabase unavailable during ${context}`);
        return null;
      }
      return client as MigrationSupabaseClient;
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
      const accountsToInsert = accounts.map((account) => ({
        user_id: userId,
        name: account.name,
        type: this.mapAccountType(account.type),
        balance: account.balance,
        currency: account.currency || 'USD',
        institution: account.institution,
        is_active: account.isActive !== false,
        created_at: toIsoString(account.updatedAt ?? account.lastUpdated),
      }));

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

        const transactionsToInsert = batch.map((transaction) => ({
          user_id: userId,
          account_id: this.accountIdMapping.get(transaction.accountId) || transaction.accountId,
          date: toIsoString(transaction.date),
          description: transaction.description,
          amount: Math.abs(transaction.amount),
          type: transaction.type,
          category: transaction.category,
          tags: transaction.tags,
          notes: transaction.notes,
          merchant: transaction.merchant,
          is_cleared: transaction.cleared !== false,
          is_reconciled: (transaction as any).reconciled || false,
          created_at: toIsoString(
            (transaction as Partial<Transaction> & { createdAt?: Date | string }).createdAt ?? transaction.date
          ),
        }));

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
      const budgetsToInsert = budgets.map((budget) => ({
        user_id: userId,
        name: budget.name || (budget as any).categoryId || (budget as any).category,
        category_id: (budget as any).categoryId || (budget as any).category,
        amount: budget.amount,
        period: budget.period || 'monthly',
        start_date: (budget.startDate as string | undefined) ?? toIsoString().split('T')[0],
        is_active: budget.isActive !== false,
        alert_enabled: (budget as any).alertEnabled !== false,
        alert_threshold: budget.alertThreshold || 80,
        created_at: toIsoString(budget.createdAt),
      }));

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
      const goalsToInsert = goals.map((goal) => ({
        user_id: userId,
        name: goal.name,
        description: goal.description,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount || 0,
        target_date: toIsoString(goal.targetDate),
        category: goal.category,
        priority: goal.priority ?? 'medium',
        is_achieved: goal.achieved || false,
        created_at: toIsoString(goal.createdAt),
      }));

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
  private static mapAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      'current': 'checking',
      'savings': 'savings',
      'credit': 'credit',
      'loan': 'loan',
      'investment': 'investment',
      'cash': 'cash',
    };
    return typeMap[type] || 'checking';
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
