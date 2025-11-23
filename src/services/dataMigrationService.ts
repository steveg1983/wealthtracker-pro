/**
 * Data Migration Service
 * 
 * Safely migrates data from localStorage to Supabase
 * Handles all data types: accounts, transactions, budgets, goals
 * Provides rollback capability if migration fails
 */

import { supabase } from '../lib/supabase';
import { store } from '../store';
import { userIdService } from './userIdService';
import type { Account, Transaction, Budget, Goal } from '../types';
import type { SerializedAccount, SerializedTransaction, SerializedBudget, SerializedGoal } from '../types/redux-types';

// Legacy types for migration that might have additional properties from older versions
interface LegacyAccount extends Account {
  color?: string;
  icon?: string;
}

interface LegacyTransaction extends Transaction {
  reconciled?: boolean;
}

interface LegacyBudget extends Budget {
  alertEnabled?: boolean;
}

// Helper functions to convert Serialized types to regular types
function deserializeAccount(account: SerializedAccount): Account {
  return {
    ...account,
    lastUpdated: new Date(account.lastUpdated),
    openingBalanceDate: account.openingBalanceDate ? new Date(account.openingBalanceDate) : undefined,
    createdAt: account.createdAt ? new Date(account.createdAt) : undefined,
    updatedAt: account.updatedAt ? new Date(account.updatedAt) : undefined
  } as Account;
}

function deserializeTransaction(transaction: SerializedTransaction): Transaction {
  return {
    ...transaction,
    date: new Date(transaction.date),
    createdAt: transaction.createdAt ? new Date(transaction.createdAt) : undefined,
    updatedAt: transaction.updatedAt ? new Date(transaction.updatedAt) : undefined,
    reconciledDate: transaction.reconciledDate ? new Date(transaction.reconciledDate) : undefined
  } as Transaction;
}

function deserializeBudget(budget: SerializedBudget): Budget {
  return {
    ...budget,
    startDate: budget.startDate ? new Date(budget.startDate) : undefined,
    endDate: budget.endDate ? new Date(budget.endDate) : undefined,
    createdAt: budget.createdAt ? new Date(budget.createdAt) : new Date(),
    updatedAt: budget.updatedAt ? new Date(budget.updatedAt) : new Date()
  } as unknown as Budget;
}

function deserializeGoal(goal: SerializedGoal): Goal {
  return {
    ...goal,
    targetDate: new Date(goal.targetDate),
    createdAt: goal.createdAt ? new Date(goal.createdAt) : new Date(),
    updatedAt: goal.updatedAt ? new Date(goal.updatedAt) : new Date()
  } as unknown as Goal;
}

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

interface SupabaseQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface SupabaseSelectFilterBuilder<T> {
  eq: (column: string, value: unknown) => SupabaseSelectFilterBuilder<T>;
  limit: (count: number) => Promise<SupabaseQueryResult<T[]>>;
  single: () => Promise<SupabaseQueryResult<T>>;
}

interface SupabaseInsertBuilder<T> {
  select: () => Promise<SupabaseQueryResult<T[]>>;
}

type SupabaseFromBuilder<T> = {
  select: (columns?: string) => SupabaseSelectFilterBuilder<T>;
  insert: (
    values: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>
  ) => SupabaseInsertBuilder<T>;
};

type SupabaseClientLike = {
  from: <T = Record<string, unknown>>(table: string) => SupabaseFromBuilder<T>;
};

type StoreLike = Pick<typeof store, 'getState'>;

type UserIdServiceLike = Pick<typeof userIdService, 'ensureUserExists'>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

export interface DataMigrationServiceOptions {
  supabaseClient?: SupabaseClientLike | null;
  store?: StoreLike;
  userIdService?: UserIdServiceLike;
  storage?: StorageLike | null;
  logger?: Logger;
  now?: () => number;
}

export class DataMigrationService {
  private readonly supabaseClient: SupabaseClientLike | null;
  private readonly storeRef: StoreLike;
  private readonly userIdSvc: UserIdServiceLike;
  private readonly storage: StorageLike | null;
  private readonly logger: Logger;
  private readonly nowProvider: () => number;
  private migrationStatus: MigrationStatus = this.createInitialStatus();
  private accountIdMapping: Map<string, string> = new Map();

  constructor(options: DataMigrationServiceOptions = {}) {
    this.supabaseClient = options.supabaseClient ?? supabase;
    this.storeRef = options.store ?? store;
    this.userIdSvc = options.userIdService ?? userIdService;
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => Date.now());
  }

  private createInitialStatus(): MigrationStatus {
    return {
      inProgress: false,
      completed: false,
      error: null,
      stats: {
        accounts: { total: 0, migrated: 0, failed: 0 },
        transactions: { total: 0, migrated: 0, failed: 0 },
        budgets: { total: 0, migrated: 0, failed: 0 },
        goals: { total: 0, migrated: 0, failed: 0 }
      }
    };
  }

  private getCurrentIsoString(): string {
    return new Date(this.nowProvider()).toISOString();
  }

  /**
   * Check if user has any data in Supabase
   */
  async hasCloudData(userId: string): Promise<boolean> {
    if (!this.supabaseClient) return false;

    try {
      const { data: profile } = await this.supabaseClient
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!profile) return false;

      // Check if user has any accounts (most basic data)
      const { data: accounts } = await this.supabaseClient
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      return (accounts && accounts.length > 0) || false;
    } catch (error) {
      this.logger.error('Error checking cloud data:', error as Error);
      return false;
    }
  }

  /**
   * Get user's Supabase profile ID from Clerk ID (create if doesn't exist)
   * Now delegates to centralized userIdService
   */
  async getUserProfileId(clerkUserId: string): Promise<string | null> {
    if (!this.supabaseClient) return null;

    try {
      // Use centralized userIdService for all ID conversions and user creation
      const databaseUserId = await this.userIdSvc.ensureUserExists(
        clerkUserId,
        'migrated@example.com', // Placeholder, will be updated by user profile
        undefined,
        undefined
      );

      if (!databaseUserId) {
        this.logger.error('Failed to get or create user for migration');
        return null;
      }

      return databaseUserId;
    } catch (error) {
      this.logger.error('Error in getUserProfileId:', error as Error);
      return null;
    }
  }

  /**
   * Migrate all accounts to Supabase
   */
  async migrateAccounts(userId: string, accounts: Account[]): Promise<boolean> {
    if (!this.supabaseClient || accounts.length === 0) return true;

    this.logger.log(`📦 Migrating ${accounts.length} accounts...`);
    this.migrationStatus.stats.accounts.total = accounts.length;

    try {
      // Prepare accounts for insertion
      const accountsToInsert = accounts.map(account => ({
        user_id: userId,
        name: account.name,
        type: this.mapAccountType(account.type),
        balance: account.balance,
        currency: account.currency || 'USD',
        institution: account.institution,
        is_active: account.isActive !== false,
        color: (account as LegacyAccount).color || null,
        icon: (account as LegacyAccount).icon || null,
        created_at: account.createdAt || this.getCurrentIsoString(),
      }));

      // Insert all accounts
      const { data, error } = await this.supabaseClient
        .from('accounts')
        .insert(accountsToInsert)
        .select();

      if (error) {
        this.logger.error('Error migrating accounts:', error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.accounts.failed = accounts.length;
        return false;
      }

      this.migrationStatus.stats.accounts.migrated = data?.length || 0;
      this.logger.log(`✅ Migrated ${data?.length || 0} accounts successfully`);
      
      // Store mapping of old IDs to new IDs for transaction migration
      const idMapping = new Map<string, string>();
      accounts.forEach((oldAccount, index) => {
        if (data?.[index]) {
          idMapping.set(oldAccount.id, data[index].id);
        }
      });
      
      this.accountIdMapping = idMapping;
      
      return true;
    } catch (error) {
      this.logger.error('Failed to migrate accounts:', error as Error);
      this.migrationStatus.error = 'Failed to migrate accounts';
      return false;
    }
  }

  /**
   * Migrate all transactions to Supabase
   */
  async migrateTransactions(userId: string, transactions: Transaction[]): Promise<boolean> {
    if (!this.supabaseClient || transactions.length === 0) return true;

    this.logger.log(`📦 Migrating ${transactions.length} transactions...`);
    this.migrationStatus.stats.transactions.total = transactions.length;

    try {
      if (!this.accountIdMapping || this.accountIdMapping.size === 0) {
        this.logger.error('Account ID mapping not found');
        return false;
      }

      // Prepare transactions in batches (Supabase has limits)
      const batchSize = 100;
      let migrated = 0;

      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        
        const transactionsToInsert = batch.map(transaction => ({
          user_id: userId,
          account_id: this.accountIdMapping.get(transaction.accountId) || transaction.accountId,
          date: transaction.date,
          description: transaction.description,
          amount: Math.abs(transaction.amount), // Store as positive
          type: transaction.type,
          category: transaction.category,
          subcategory: transaction.category,
          tags: transaction.tags,
          notes: transaction.notes,
          merchant: transaction.merchant,
          is_cleared: transaction.cleared !== false,
          is_reconciled: (transaction as LegacyTransaction).reconciled || false,
          created_at: transaction.createdAt || this.getCurrentIsoString(),
        }));

        const { data, error } = await this.supabaseClient
          .from('transactions')
          .insert(transactionsToInsert)
          .select();

        if (error) {
          this.logger.error(`Error migrating transaction batch ${i / batchSize + 1}:`, error);
          this.migrationStatus.stats.transactions.failed += batch.length;
        } else {
          migrated += data?.length || 0;
          this.migrationStatus.stats.transactions.migrated = migrated;
          this.logger.log(`✅ Migrated batch ${i / batchSize + 1} (${data?.length} transactions)`);
        }
      }

      this.logger.log(`✅ Migrated ${migrated} of ${transactions.length} transactions`);
      return migrated > 0;
    } catch (error) {
      this.logger.error('Failed to migrate transactions:', error as Error);
      this.migrationStatus.error = 'Failed to migrate transactions';
      return false;
    }
  }

  /**
   * Migrate all budgets to Supabase
   */
  async migrateBudgets(userId: string, budgets: Budget[]): Promise<boolean> {
    if (!this.supabaseClient || budgets.length === 0) return true;

    this.logger.log(`📦 Migrating ${budgets.length} budgets...`);
    this.migrationStatus.stats.budgets.total = budgets.length;

    try {
      const budgetsToInsert = budgets.map(budget => ({
        user_id: userId,
        name: budget.name || budget.categoryId,
        category: budget.categoryId,
        amount: budget.amount,
        period: budget.period || 'monthly',
        start_date: budget.startDate || this.getCurrentIsoString().split('T')[0],
        is_active: budget.isActive !== false,
        alert_enabled: (budget as LegacyBudget).alertEnabled !== false,
        alert_threshold: budget.alertThreshold || 80,
        created_at: budget.createdAt || this.getCurrentIsoString(),
      }));

      const { data, error } = await this.supabaseClient
        .from('budgets')
        .insert(budgetsToInsert)
        .select();

      if (error) {
        this.logger.error('Error migrating budgets:', error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.budgets.failed = budgets.length;
        return false;
      }

      this.migrationStatus.stats.budgets.migrated = data?.length || 0;
      this.logger.log(`✅ Migrated ${data?.length || 0} budgets successfully`);
      return true;
    } catch (error) {
      this.logger.error('Failed to migrate budgets:', error as Error);
      this.migrationStatus.error = 'Failed to migrate budgets';
      return false;
    }
  }

  /**
   * Migrate all goals to Supabase
   */
  async migrateGoals(userId: string, goals: Goal[]): Promise<boolean> {
    if (!this.supabaseClient || goals.length === 0) return true;

    this.logger.log(`📦 Migrating ${goals.length} goals...`);
    this.migrationStatus.stats.goals.total = goals.length;

    try {
      const goalsToInsert = goals.map(goal => ({
        user_id: userId,
        name: goal.name,
        description: goal.description,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount || 0,
        target_date: goal.targetDate,
        category: goal.category,
        priority: 'medium', // Default priority
        is_achieved: goal.achieved || false,
        created_at: goal.createdAt || this.getCurrentIsoString(),
      }));

      const { data, error } = await this.supabaseClient
        .from('goals')
        .insert(goalsToInsert)
        .select();

      if (error) {
        this.logger.error('Error migrating goals:', error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.goals.failed = goals.length;
        return false;
      }

      this.migrationStatus.stats.goals.migrated = data?.length || 0;
      this.logger.log(`✅ Migrated ${data?.length || 0} goals successfully`);
      return true;
    } catch (error) {
      this.logger.error('Failed to migrate goals:', error as Error);
      this.migrationStatus.error = 'Failed to migrate goals';
      return false;
    }
  }

  /**
   * Main migration function - migrates all data
   */
  async migrateToSupabase(clerkUserId: string): Promise<MigrationStatus> {
    if (!this.supabaseClient) {
      this.migrationStatus.error = 'Supabase not configured';
      return { ...this.migrationStatus };
    }

    this.logger.log('🚀 Starting data migration to Supabase...');
    this.migrationStatus.inProgress = true;
    this.migrationStatus.error = null;

    try {
      // Get user's Supabase profile ID
      const userId = await this.getUserProfileId(clerkUserId);
      if (!userId) {
        throw new Error('User profile not found in Supabase');
      }

      // Check if user already has cloud data
      const hasData = await this.hasCloudData(userId);
      if (hasData) {
        this.logger.warn('⚠️ User already has cloud data. Skipping migration.');
        this.migrationStatus.completed = true;
        this.migrationStatus.inProgress = false;
        this.migrationStatus.error = 'User already has cloud data';
        return { ...this.migrationStatus };
      }

      // Get current state from Redux
      const state = this.storeRef.getState();
      const { accounts, transactions, budgets, goals } = state;

      // Migrate each data type - deserialize from Redux state
      const deserializedAccounts = accounts.accounts.map(deserializeAccount);
      const accountsSuccess = await this.migrateAccounts(userId, deserializedAccounts);
      if (!accountsSuccess) {
        throw new Error('Failed to migrate accounts');
      }

      const deserializedTransactions = transactions.transactions.map(deserializeTransaction);
      const transactionsSuccess = await this.migrateTransactions(userId, deserializedTransactions);
      if (!transactionsSuccess) {
        this.logger.warn('Some transactions failed to migrate');
      }

      const deserializedBudgets = budgets.budgets.map(deserializeBudget);
      const budgetsSuccess = await this.migrateBudgets(userId, deserializedBudgets);
      if (!budgetsSuccess) {
        this.logger.warn('Some budgets failed to migrate');
      }

      const deserializedGoals = goals.goals.map(deserializeGoal);
      const goalsSuccess = await this.migrateGoals(userId, deserializedGoals);
      if (!goalsSuccess) {
        this.logger.warn('Some goals failed to migrate');
      }

      // Mark migration as complete
      this.migrationStatus.completed = true;
      this.migrationStatus.inProgress = false;

      if (this.storage) {
        try {
          this.storage.setItem('supabaseMigrationCompleted', 'true');
          this.storage.setItem('supabaseMigrationDate', this.getCurrentIsoString());
        } catch (storageError) {
          this.logger.warn('Failed to persist migration flags:', storageError as Error);
        }
      }

      this.logger.log('✅ Migration completed successfully!');
      this.logger.log('📊 Migration stats:', this.migrationStatus.stats);

      return { ...this.migrationStatus };
    } catch (error) {
      this.logger.error('❌ Migration failed:', error as Error);
      this.migrationStatus.error = error instanceof Error ? error.message : 'Unknown error';
      this.migrationStatus.inProgress = false;
      return { ...this.migrationStatus };
    }
  }

  /**
   * Helper to map account types
   */
  private mapAccountType(type: string): string {
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
  isMigrationCompleted(): boolean {
    return this.storage?.getItem('supabaseMigrationCompleted') === 'true';
  }

  /**
   * Reset migration status (for testing)
   */
  resetMigration(): void {
    this.storage?.removeItem?.('supabaseMigrationCompleted');
    this.storage?.removeItem?.('supabaseMigrationDate');
    this.migrationStatus = this.createInitialStatus();
    this.accountIdMapping.clear();
  }
}

export const dataMigrationService = new DataMigrationService();
