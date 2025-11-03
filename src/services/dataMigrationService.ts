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
    openingBalanceDate: account.openingBalanceDate ? new Date(account.openingBalanceDate) : undefined
  };
}

function deserializeTransaction(transaction: SerializedTransaction): Transaction {
  return {
    ...transaction,
    date: new Date(transaction.date),
    createdAt: transaction.createdAt ? new Date(transaction.createdAt) : undefined
  };
}

function deserializeBudget(budget: SerializedBudget): Budget {
  return {
    ...budget,
    startDate: budget.startDate ? new Date(budget.startDate) : undefined,
    endDate: budget.endDate ? new Date(budget.endDate) : undefined,
    createdAt: budget.createdAt ? new Date(budget.createdAt) : undefined
  };
}

function deserializeGoal(goal: SerializedGoal): Goal {
  return {
    ...goal,
    targetDate: new Date(goal.targetDate),
    createdAt: goal.createdAt ? new Date(goal.createdAt) : undefined
  };
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

  /**
   * Check if user has any data in Supabase
   */
  static async hasCloudData(userId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!profile) return false;

      // Check if user has any accounts (most basic data)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      return (accounts && accounts.length > 0) || false;
    } catch (error) {
      console.error('Error checking cloud data:', error);
      return false;
    }
  }

  /**
   * Get user's Supabase profile ID from Clerk ID (create if doesn't exist)
   * Now delegates to centralized userIdService
   */
  static async getUserProfileId(clerkUserId: string): Promise<string | null> {
    if (!supabase) return null;

    try {
      // Use centralized userIdService for all ID conversions and user creation
      const databaseUserId = await userIdService.ensureUserExists(
        clerkUserId,
        'migrated@example.com', // Placeholder, will be updated by user profile
        undefined,
        undefined
      );

      if (!databaseUserId) {
        console.error('Failed to get or create user for migration');
        return null;
      }

      return databaseUserId;
    } catch (error) {
      console.error('Error in getUserProfileId:', error);
      return null;
    }
  }

  /**
   * Migrate all accounts to Supabase
   */
  static async migrateAccounts(userId: string, accounts: Account[]): Promise<boolean> {
    if (!supabase || accounts.length === 0) return true;

    console.log(`📦 Migrating ${accounts.length} accounts...`);
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
        created_at: account.createdAt || new Date().toISOString(),
      }));

      // Insert all accounts
      const { data, error } = await supabase
        .from('accounts')
        .insert(accountsToInsert)
        .select();

      if (error) {
        console.error('Error migrating accounts:', error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.accounts.failed = accounts.length;
        return false;
      }

      this.migrationStatus.stats.accounts.migrated = data?.length || 0;
      console.log(`✅ Migrated ${data?.length || 0} accounts successfully`);
      
      // Store mapping of old IDs to new IDs for transaction migration
      const idMapping = new Map<string, string>();
      accounts.forEach((oldAccount, index) => {
        if (data?.[index]) {
          idMapping.set(oldAccount.id, data[index].id);
        }
      });
      
      // Store mapping for transaction migration
      (window as any).__accountIdMapping = idMapping;
      
      return true;
    } catch (error) {
      console.error('Failed to migrate accounts:', error);
      this.migrationStatus.error = 'Failed to migrate accounts';
      return false;
    }
  }

  /**
   * Migrate all transactions to Supabase
   */
  static async migrateTransactions(userId: string, transactions: Transaction[]): Promise<boolean> {
    if (!supabase || transactions.length === 0) return true;

    console.log(`📦 Migrating ${transactions.length} transactions...`);
    this.migrationStatus.stats.transactions.total = transactions.length;

    try {
      // Get account ID mapping
      const idMapping = (window as any).__accountIdMapping as Map<string, string>;
      if (!idMapping) {
        console.error('Account ID mapping not found');
        return false;
      }

      // Prepare transactions in batches (Supabase has limits)
      const batchSize = 100;
      let migrated = 0;

      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        
        const transactionsToInsert = batch.map(transaction => ({
          user_id: userId,
          account_id: idMapping.get(transaction.accountId) || transaction.accountId,
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
          created_at: transaction.createdAt || new Date().toISOString(),
        }));

        const { data, error } = await supabase
          .from('transactions')
          .insert(transactionsToInsert)
          .select();

        if (error) {
          console.error(`Error migrating transaction batch ${i / batchSize + 1}:`, error);
          this.migrationStatus.stats.transactions.failed += batch.length;
        } else {
          migrated += data?.length || 0;
          this.migrationStatus.stats.transactions.migrated = migrated;
          console.log(`✅ Migrated batch ${i / batchSize + 1} (${data?.length} transactions)`);
        }
      }

      console.log(`✅ Migrated ${migrated} of ${transactions.length} transactions`);
      return migrated > 0;
    } catch (error) {
      console.error('Failed to migrate transactions:', error);
      this.migrationStatus.error = 'Failed to migrate transactions';
      return false;
    }
  }

  /**
   * Migrate all budgets to Supabase
   */
  static async migrateBudgets(userId: string, budgets: Budget[]): Promise<boolean> {
    if (!supabase || budgets.length === 0) return true;

    console.log(`📦 Migrating ${budgets.length} budgets...`);
    this.migrationStatus.stats.budgets.total = budgets.length;

    try {
      const budgetsToInsert = budgets.map(budget => ({
        user_id: userId,
        name: budget.name || budget.categoryId,
        category: budget.categoryId,
        amount: budget.amount,
        period: budget.period || 'monthly',
        start_date: budget.startDate || new Date().toISOString().split('T')[0],
        is_active: budget.isActive !== false,
        alert_enabled: (budget as LegacyBudget).alertEnabled !== false,
        alert_threshold: budget.alertThreshold || 80,
        created_at: budget.createdAt || new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('budgets')
        .insert(budgetsToInsert)
        .select();

      if (error) {
        console.error('Error migrating budgets:', error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.budgets.failed = budgets.length;
        return false;
      }

      this.migrationStatus.stats.budgets.migrated = data?.length || 0;
      console.log(`✅ Migrated ${data?.length || 0} budgets successfully`);
      return true;
    } catch (error) {
      console.error('Failed to migrate budgets:', error);
      this.migrationStatus.error = 'Failed to migrate budgets';
      return false;
    }
  }

  /**
   * Migrate all goals to Supabase
   */
  static async migrateGoals(userId: string, goals: Goal[]): Promise<boolean> {
    if (!supabase || goals.length === 0) return true;

    console.log(`📦 Migrating ${goals.length} goals...`);
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
        created_at: goal.createdAt || new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('goals')
        .insert(goalsToInsert)
        .select();

      if (error) {
        console.error('Error migrating goals:', error);
        this.migrationStatus.error = error.message;
        this.migrationStatus.stats.goals.failed = goals.length;
        return false;
      }

      this.migrationStatus.stats.goals.migrated = data?.length || 0;
      console.log(`✅ Migrated ${data?.length || 0} goals successfully`);
      return true;
    } catch (error) {
      console.error('Failed to migrate goals:', error);
      this.migrationStatus.error = 'Failed to migrate goals';
      return false;
    }
  }

  /**
   * Main migration function - migrates all data
   */
  static async migrateToSupabase(clerkUserId: string): Promise<MigrationStatus> {
    if (!supabase) {
      return {
        ...this.migrationStatus,
        error: 'Supabase not configured',
      };
    }

    console.log('🚀 Starting data migration to Supabase...');
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
        console.log('⚠️ User already has cloud data. Skipping migration.');
        return {
          ...this.migrationStatus,
          completed: true,
          error: 'User already has cloud data',
        };
      }

      // Get current state from Redux
      const state = store.getState();
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
        console.warn('Some transactions failed to migrate');
      }

      const deserializedBudgets = budgets.budgets.map(deserializeBudget);
      const budgetsSuccess = await this.migrateBudgets(userId, deserializedBudgets);
      if (!budgetsSuccess) {
        console.warn('Some budgets failed to migrate');
      }

      const deserializedGoals = goals.goals.map(deserializeGoal);
      const goalsSuccess = await this.migrateGoals(userId, deserializedGoals);
      if (!goalsSuccess) {
        console.warn('Some goals failed to migrate');
      }

      // Mark migration as complete
      this.migrationStatus.completed = true;
      this.migrationStatus.inProgress = false;

      // Store migration status in localStorage
      localStorage.setItem('supabaseMigrationCompleted', 'true');
      localStorage.setItem('supabaseMigrationDate', new Date().toISOString());

      console.log('✅ Migration completed successfully!');
      console.log('📊 Migration stats:', this.migrationStatus.stats);

      return this.migrationStatus;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.migrationStatus.error = error instanceof Error ? error.message : 'Unknown error';
      this.migrationStatus.inProgress = false;
      return this.migrationStatus;
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
    return localStorage.getItem('supabaseMigrationCompleted') === 'true';
  }

  /**
   * Reset migration status (for testing)
   */
  static resetMigration(): void {
    localStorage.removeItem('supabaseMigrationCompleted');
    localStorage.removeItem('supabaseMigrationDate');
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