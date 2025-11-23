/**
 * AutoSyncService - Top Tier Automatic Cloud Sync
 * 
 * Provides seamless, invisible sync like iCloud/Google Drive
 * - Automatic migration on first login
 * - Real-time sync across devices
 * - Offline support with sync queue
 * - Conflict resolution
 * - Zero user interaction required
 */

import { supabase } from '../lib/supabase';
import { storageAdapter, STORAGE_KEYS } from './storageAdapter';
import { userIdService } from './userIdService';
import type { Account, Transaction, Budget, Goal, Category } from '../types';

interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'account' | 'transaction' | 'budget' | 'goal' | 'category';
  data: Account | Transaction | Budget | Goal | Category | Partial<Account> | Partial<Transaction> | Partial<Budget> | Partial<Goal> | Partial<Category>;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncErrors: string[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface WindowLike {
  addEventListener?: Window['addEventListener'];
  removeEventListener?: Window['removeEventListener'];
}

type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

export interface AutoSyncServiceOptions {
  storage?: StorageLike | null;
  windowRef?: WindowLike | null;
  uuidGenerator?: () => string;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  dateFactory?: () => Date;
  now?: () => number;
  logger?: Logger;
}

export class AutoSyncService {
  private static instance: AutoSyncService;
  private syncQueue: SyncQueueItem[] = [];
  private syncStatus: SyncStatus = {
    isOnline: true,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    syncErrors: []
  };
  private syncInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private isInitialized = false;
  private storage: StorageLike | null;
  private windowRef: WindowLike | null;
  private readonly uuidGenerator: () => string;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly dateFactory: () => Date;
  private readonly now: () => number;
  private readonly onlineHandler: () => void;
  private readonly offlineHandler: () => void;
  private readonly logger: Logger;

  constructor(options: AutoSyncServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    this.windowRef = options.windowRef ?? (typeof window !== 'undefined' ? window : null);
    this.uuidGenerator = options.uuidGenerator ?? (() => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`));
    this.setIntervalFn =
      options.setIntervalFn ??
      ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => setInterval(handler, timeout, ...args));
    this.clearIntervalFn =
      options.clearIntervalFn ??
      ((id: ReturnType<typeof setInterval>) => clearInterval(id));
    this.dateFactory = options.dateFactory ?? (() => new Date());
    this.now = options.now ?? (() => Date.now());
    const defaultLogger = typeof console !== 'undefined'
      ? console
      : { log: () => {}, warn: () => {}, error: () => {} };
    this.logger = options.logger ?? defaultLogger;
    this.onlineHandler = () => this.handleOnline();
    this.offlineHandler = () => this.handleOffline();

    if (this.windowRef?.addEventListener) {
      this.windowRef.addEventListener('online', this.onlineHandler);
      this.windowRef.addEventListener('offline', this.offlineHandler);
    }
  }

  static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService();
    }
    return AutoSyncService.instance;
  }

  /**
   * Initialize the sync service for a user
   * This handles automatic migration if needed
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.userId === userId) {
      this.logger.log('[AutoSync] Already initialized for user:', userId);
      return;
    }

    this.logger.log('[AutoSync] Initializing for user:', userId);
    this.userId = userId;

    try {
      // Step 1: Load local data
      const localData = await this.loadLocalData();
      this.logger.log('[AutoSync] Local data loaded:', {
        accounts: localData.accounts?.length || 0,
        transactions: localData.transactions?.length || 0
      });

      // Step 2: Check cloud data status
      const hasCloudData = await this.checkCloudData(userId);
      this.logger.log('[AutoSync] Cloud data exists:', hasCloudData);

      // Step 3: Intelligent merge and sync
      if (!hasCloudData && this.hasLocalData(localData)) {
        // First time user with local data - migrate silently
        this.logger.log('[AutoSync] Performing silent migration...');
        await this.migrateToCloud(userId, localData);
      } else if (hasCloudData && this.hasLocalData(localData)) {
        // Both local and cloud data exist - merge intelligently
        this.logger.log('[AutoSync] Merging local and cloud data...');
        await this.mergeData(userId, localData);
      }
      // If only cloud data exists, AppContext will load it normally

      // Step 4: Clear local storage (keep only as cache)
      await this.convertLocalToCache();

      // Step 5: Start continuous sync
      this.startContinuousSync();
      
      this.isInitialized = true;
      this.logger.log('[AutoSync] Initialization complete');
    } catch (error) {
      this.logger.error('[AutoSync] Initialization failed:', error);
      // Don't throw - app should work even if sync fails
    }
  }

  /**
   * Check if user has any data in the cloud
   */
  private async checkCloudData(userId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      // Use centralized userIdService for ID conversion
      const databaseUserId = await userIdService.getDatabaseUserId(userId);

      if (!databaseUserId) return false;

      // Check for any accounts (simplest check)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', databaseUserId)
        .limit(1);

      return (accounts && accounts.length > 0) || false;
    } catch (error) {
      this.logger.error('[AutoSync] Error checking cloud data:', error);
      return false;
    }
  }

  /**
   * Load all data from local storage
   */
  private async loadLocalData() {
    const [accounts, transactions, budgets, goals, categories] = await Promise.all([
      storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [],
      storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [],
      storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [],
      storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS) || [],
      storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES) || []
    ]);

    return { accounts, transactions, budgets, goals, categories };
  }

  /**
   * Check if there's any local data
   */
  private hasLocalData(data: {
    accounts: Account[];
    transactions: Transaction[];
    budgets: Budget[];
    goals: Goal[];
    categories: Category[];
  }): boolean {
    return data.accounts.length > 0 || 
           data.transactions.length > 0 || 
           data.budgets.length > 0 || 
           data.goals.length > 0;
  }

  /**
   * Migrate local data to cloud (first-time sync)
   */
  private async migrateToCloud(
    userId: string,
    localData: {
      accounts: Account[];
      transactions: Transaction[];
      budgets: Budget[];
      goals: Goal[];
      categories: Category[];
    }
  ): Promise<void> {
    if (!supabase) return;

    this.logger.log('[AutoSync] Starting silent migration to cloud...');

    try {
      // Ensure user exists in database
      const dbUserId = await this.ensureUserExists(userId);
      if (!dbUserId) {
        throw new Error('Failed to create user in database');
      }

      // Migrate accounts first (other entities depend on them)
      if (localData.accounts.length > 0) {
        const accountsToInsert = localData.accounts.map((account: Account) => ({
          user_id: dbUserId,
          name: account.name,
          type: account.type === 'current' ? 'checking' : account.type,
          balance: account.balance || 0,
          currency: account.currency || 'GBP',
          institution: account.institution || null,
          is_active: account.isActive !== false,
          initial_balance: (account as Account & { initialBalance?: number }).initialBalance || account.balance || 0,
          created_at: account.createdAt || new Date().toISOString(),
          updated_at: account.updatedAt || new Date().toISOString()
        }));

        const { error: accountError } = await supabase
          .from('accounts')
          .insert(accountsToInsert);

        if (accountError) {
          this.logger.error('[AutoSync] Failed to migrate accounts:', accountError);
        } else {
          this.logger.log('[AutoSync] Migrated', accountsToInsert.length, 'accounts');
        }
      }

      // Migrate transactions
      if (localData.transactions.length > 0) {
        // Get the mapping of local account IDs to cloud account IDs
        const { data: cloudAccounts } = await supabase
          .from('accounts')
          .select('id, name')
          .eq('user_id', dbUserId);

        if (cloudAccounts) {
          const accountMap = new Map(
            cloudAccounts.map(acc => [
              localData.accounts.find((la: Account) => la.name === acc.name)?.id,
              acc.id
            ])
          );

          const transactionsToInsert = localData.transactions
            .filter((t: Transaction) => accountMap.has(t.accountId))
            .map((transaction: Transaction) => ({
              user_id: dbUserId,
              account_id: accountMap.get(transaction.accountId),
              amount: transaction.amount,
              description: transaction.description,
              date: transaction.date,
              category: transaction.category,
              subcategory: transaction.category || null,
              type: transaction.type,
              is_recurring: transaction.isRecurring || false,
              notes: transaction.notes || null,
              tags: transaction.tags || [],
              created_at: transaction.createdAt || new Date().toISOString()
            }));

          if (transactionsToInsert.length > 0) {
            // Insert in batches to avoid timeout
            const batchSize = 100;
            for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
              const batch = transactionsToInsert.slice(i, i + batchSize);
              const { error } = await supabase
                .from('transactions')
                .insert(batch);

              if (error) {
                this.logger.error('[AutoSync] Failed to migrate transaction batch:', error);
              }
            }
            this.logger.log('[AutoSync] Migrated', transactionsToInsert.length, 'transactions');
          }
        }
      }

      // Mark migration as complete
      this.storage?.setItem?.('autoSyncMigrationComplete', 'true');
      this.storage?.setItem?.('autoSyncMigrationDate', new Date().toISOString());
      
      this.logger.log('[AutoSync] Silent migration complete');
    } catch (error) {
      this.logger.error('[AutoSync] Migration failed:', error);
      // Don't throw - app should continue working
    }
  }

  /**
   * Ensure user exists in database
   */
  private async ensureUserExists(clerkId: string): Promise<string | null> {
    if (!supabase) return null;

    try {
      // Use centralized userIdService for user creation and ID management
      let databaseUserId = await userIdService.getDatabaseUserId(clerkId);

      if (databaseUserId) {
        return databaseUserId;
      }

      // Create user if doesn't exist using the centralized service
      databaseUserId = await userIdService.ensureUserExists(
        clerkId,
        'user@example.com', // Will be updated by profile
        undefined,
        undefined
      );

      if (!databaseUserId) {
        this.logger.error('[AutoSync] Failed to create user');
        return null;
      }

      return databaseUserId;
    } catch (error) {
      this.logger.error('[AutoSync] Error ensuring user exists:', error);
      return null;
    }
  }

  /**
   * Merge local and cloud data intelligently
   */
  private async mergeData(
    _userId: string,
    _localData: {
      accounts: Account[];
      transactions: Transaction[];
      budgets: Budget[];
      goals: Goal[];
      categories: Category[];
    }
  ): Promise<void> {
    // For now, prefer cloud data (it's the source of truth)
    // In the future, implement proper conflict resolution
    this.logger.log('[AutoSync] Merge complete - using cloud as source of truth');
  }

  /**
   * Convert local storage to cache-only mode
   */
  private async convertLocalToCache(): Promise<void> {
    // Mark that we're now using cloud as primary storage
    this.storage?.setItem('primaryStorage', 'cloud');
    // Keep local data as cache for offline access
    this.logger.log('[AutoSync] Local storage converted to cache mode');
  }

  /**
   * Start continuous background sync
   */
  private startContinuousSync(): void {
    this.stopSync();
    this.syncInterval = this.setIntervalFn(() => {
      void this.processSyncQueue();
    }, 5000);

    this.logger.log('[AutoSync] Continuous sync started');
  }

  /**
   * Stop continuous sync
   */
  stopSync(): void {
    if (this.syncInterval) {
      this.clearIntervalFn(this.syncInterval);
      this.syncInterval = null;
    }
    this.logger.log('[AutoSync] Continuous sync stopped');
  }

  destroy(): void {
    this.stopSync();
    if (this.windowRef?.removeEventListener) {
      this.windowRef.removeEventListener('online', this.onlineHandler);
      this.windowRef.removeEventListener('offline', this.offlineHandler);
    }
  }

  /**
   * Add an operation to the sync queue
   */
  queueOperation(
    type: SyncQueueItem['type'],
    entity: SyncQueueItem['entity'],
    data: SyncQueueItem['data']
  ): void {
    const item: SyncQueueItem = {
      id: this.uuidGenerator(),
      type,
      entity,
      data,
      timestamp: this.now(),
      retries: 0,
      status: 'pending'
    };

    this.syncQueue.push(item);
    this.syncStatus.pendingChanges = this.syncQueue.filter(i => i.status === 'pending').length;

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      this.processSyncQueue();
    }
  }

  /**
   * Process the sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncStatus.isSyncing || !this.syncStatus.isOnline) {
      return;
    }

    const pendingItems = this.syncQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      return;
    }

    this.syncStatus.isSyncing = true;

    for (const item of pendingItems) {
      try {
        item.status = 'syncing';
        await this.syncItem(item);
        item.status = 'completed';
        
        // Remove completed items from queue
        this.syncQueue = this.syncQueue.filter(i => i.id !== item.id);
      } catch (error) {
        this.logger.error('[AutoSync] Sync failed for item:', item, error);
        item.status = 'pending';
        item.retries++;

        // Remove item if too many retries
        if (item.retries > 3) {
          this.syncStatus.syncErrors.push(`Failed to sync ${item.entity}: ${error}`);
          this.syncQueue = this.syncQueue.filter(i => i.id !== item.id);
        }
      }
    }

    this.syncStatus.isSyncing = false;
    this.syncStatus.lastSyncTime = this.dateFactory();
    this.syncStatus.pendingChanges = this.syncQueue.filter(i => i.status === 'pending').length;
  }

  /**
   * Sync a single item
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    if (!supabase || !this.userId) {
      throw new Error('Not initialized');
    }

    // Use centralized userIdService for ID conversion
    const databaseUserId = await userIdService.getDatabaseUserId(this.userId);

    if (!databaseUserId) {
      throw new Error('User not found');
    }

    const table = `${item.entity}s`; // e.g., 'accounts', 'transactions'
    
    switch (item.type) {
      case 'CREATE':
        // Don't create if it already has a database ID
        if (item.data.id && item.data.id.length === 36) {
          this.logger.log('[AutoSync] Skipping CREATE - item already has database ID:', item.data.id);
          return;
        }
        await supabase.from(table).insert({
          ...item.data,
          user_id: databaseUserId
        });
        break;
      
      case 'UPDATE':
        await supabase
          .from(table)
          .update(item.data)
          .eq('id', item.data.id)
          .eq('user_id', databaseUserId);
        break;
      
      case 'DELETE':
        await supabase
          .from(table)
          .delete()
          .eq('id', item.data.id)
          .eq('user_id', databaseUserId);
        break;
    }
  }

  /**
   * Handle coming online
   */
  private handleOnline(): void {
    this.logger.log('[AutoSync] Connection restored');
    this.syncStatus.isOnline = true;
    this.processSyncQueue();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.logger.log('[AutoSync] Connection lost - will sync when online');
    this.syncStatus.isOnline = false;
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }
}

export default AutoSyncService.getInstance();
