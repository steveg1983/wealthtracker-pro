import type {
  OfflineQueueItem,
  SyncData,
  SyncEntityType,
  SyncOperation,
} from '@wealthtracker/types/sync';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

type IntervalHandle = ReturnType<typeof setInterval>;

export interface AutoSyncLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

export interface AutoSyncEnvironment {
  onOnline?(handler: () => void): () => void;
  onOffline?(handler: () => void): () => void;
  isOnline?(): boolean;
  setInterval?(handler: () => void, intervalMs: number): IntervalHandle;
  clearInterval?(handle: IntervalHandle | null): void;
  generateId?(): string;
  now?(): Date;
}

export interface AutoSyncQueueConfig {
  processIntervalMs?: number;
  maxRetries?: number;
}

export interface AutoSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncErrors: string[];
}

export interface AutoSyncProcessContext<EntityMap extends Record<string, unknown>> {
  userId: string | null;
  logger: AutoSyncLogger;
  enqueueImmediateSync(): void;
}

export interface AutoSyncHooks<
  EntityMap extends Record<string, unknown>,
  LocalData,
> {
  loadLocalData(): Promise<LocalData>;
  hasLocalData(data: LocalData): boolean;
  checkCloudData(userId: string): Promise<boolean>;
  migrateToCloud(userId: string, localData: LocalData): Promise<void>;
  mergeData(userId: string, localData: LocalData): Promise<void>;
  convertLocalToCache(localData: LocalData): Promise<void>;
  processSyncItem?(
    item: OfflineQueueItem<EntityMap, SyncEntityType<EntityMap>>,
    context: AutoSyncProcessContext<EntityMap>,
  ): Promise<void>;
}

export interface CreateAutoSyncServiceOptions<
  EntityMap extends Record<string, unknown>,
  LocalData,
> {
  logger?: AutoSyncLogger;
  environment?: AutoSyncEnvironment;
  queue?: AutoSyncQueueConfig;
  hooks: AutoSyncHooks<EntityMap, LocalData>;
}

export interface AutoSyncService<
  EntityMap extends Record<string, unknown>,
  LocalData,
> {
  initialize(userId: string): Promise<void>;
  stopSync(): void;
  queueOperation<T extends SyncEntityType<EntityMap>>(
    type: SyncOperationType,
    entity: T,
    data: SyncData<EntityMap, T>,
  ): void;
  getSyncStatus(): AutoSyncStatus;
}

const noopLogger: AutoSyncLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const defaultGenerateId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Ignore crypto access errors (e.g., SSR without crypto)
  }
  return `autosync-${Math.random().toString(36).slice(2, 10)}`;
};

const defaultNow = (): Date => new Date();

const defaultSetInterval = (handler: () => void, intervalMs: number): IntervalHandle =>
  setInterval(handler, intervalMs);

const defaultClearInterval = (handle: IntervalHandle | null): void => {
  if (handle) {
    clearInterval(handle);
  }
};

const hasProcessHook = <
  EntityMap extends Record<string, unknown>,
  LocalData,
>(
  hooks: AutoSyncHooks<EntityMap, LocalData>,
): hooks is AutoSyncHooks<EntityMap, LocalData> & Required<Pick<AutoSyncHooks<EntityMap, LocalData>, 'processSyncItem'>> =>
  typeof hooks.processSyncItem === 'function';

export function createAutoSyncService<
  EntityMap extends Record<string, unknown>,
  LocalData,
>(options: CreateAutoSyncServiceOptions<EntityMap, LocalData>): AutoSyncService<EntityMap, LocalData> {
  const logger = options.logger ?? (typeof console !== 'undefined'
    ? {
        debug: console.debug?.bind(console) ?? noopLogger.debug,
        info: console.info?.bind(console) ?? noopLogger.info,
        warn: console.warn?.bind(console) ?? noopLogger.warn,
        error: console.error?.bind(console) ?? noopLogger.error,
      }
    : noopLogger);

  const environment = options.environment ?? {};
  const hooks = options.hooks;

  const processIntervalMs = options.queue?.processIntervalMs ?? 5000;
  const maxRetries = options.queue?.maxRetries ?? 3;

  const generateId = environment.generateId ?? defaultGenerateId;
  const now = environment.now ?? defaultNow;
  const scheduleInterval = environment.setInterval ?? defaultSetInterval;
  const cancelInterval = environment.clearInterval ?? defaultClearInterval;
  const resolveOnlineStatus = environment.isOnline ?? (() => true);

  let syncQueue: Array<OfflineQueueItem<EntityMap, SyncEntityType<EntityMap>>> = [];
  let syncStatus: AutoSyncStatus = {
    isOnline: resolveOnlineStatus(),
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    syncErrors: [],
  };
  let syncInterval: IntervalHandle | null = null;
  let currentUserId: string | null = null;
  let isInitialized = false;

  const processContext: AutoSyncProcessContext<EntityMap> = {
    userId: null,
    logger,
    enqueueImmediateSync: () => {
      if (syncStatus.isOnline) {
        void processSyncQueue();
      }
    },
  };

  const updatePendingCount = (): void => {
    syncStatus.pendingChanges = syncQueue.filter(item => item.status === 'pending').length;
  };

  const startContinuousSync = (): void => {
    if (syncInterval) {
      return;
    }
    syncInterval = scheduleInterval(() => {
      void processSyncQueue();
    }, processIntervalMs);
    logger.info('[AutoSync] Continuous sync started');
  };

  const stopContinuousSync = (): void => {
    if (!syncInterval) {
      return;
    }
    cancelInterval(syncInterval);
    syncInterval = null;
    logger.info('[AutoSync] Continuous sync stopped');
  };

  const handleOnline = (): void => {
    logger.info('[AutoSync] Connection restored');
    syncStatus.isOnline = true;
    void processSyncQueue();
  };

  const handleOffline = (): void => {
    logger.warn('[AutoSync] Connection lost - will sync when online');
    syncStatus.isOnline = false;
  };

  environment.onOnline?.(handleOnline);
  environment.onOffline?.(handleOffline);

  async function processSyncQueue(): Promise<void> {
    if (syncStatus.isSyncing || !syncStatus.isOnline) {
      return;
    }

    const pendingItems = syncQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      return;
    }

    syncStatus.isSyncing = true;

    for (const item of pendingItems) {
      item.status = 'syncing';

      try {
        if (hasProcessHook(hooks)) {
          await hooks.processSyncItem(item, processContext);
        } else {
          logger.info('[AutoSync] Skipping remote sync for item until typed pipeline is in place', {
            entity: item.operation.entity,
            operation: item.operation.type,
          });
        }

        item.status = 'completed';
        syncQueue = syncQueue.filter(queueItem => queueItem.id !== item.id);
      } catch (error) {
        logger.error('[AutoSync] Sync failed for item', { item, error });
        item.status = 'pending';
        item.retries += 1;

        if (item.retries > maxRetries) {
          item.status = 'failed';
          syncStatus.syncErrors.push(
            `Failed to sync ${String(item.operation.entity)}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          syncQueue = syncQueue.filter(queueItem => queueItem.id !== item.id);
        }
      }
    }

    syncStatus.isSyncing = false;
    syncStatus.lastSyncTime = now();
    updatePendingCount();
  }

  const queueOperation = <T extends SyncEntityType<EntityMap>>(
    type: SyncOperationType,
    entity: T,
    data: SyncData<EntityMap, T>,
  ): void => {
    const dataWithId = data as SyncData<EntityMap, T> & { id?: string };
    const operation: SyncOperation<EntityMap, T> = {
      id: generateId(),
      type,
      entity,
      entityId: dataWithId.id ?? generateId(),
      data,
      timestamp: Date.now(),
      clientId: currentUserId ?? 'unknown',
      version: 1,
    };

    const item: OfflineQueueItem<EntityMap, SyncEntityType<EntityMap>> = {
      id: generateId(),
      operation,
      timestamp: Date.now(),
      status: 'pending',
      retries: 0,
    };

    syncQueue.push(item);
    updatePendingCount();

    if (syncStatus.isOnline) {
      void processSyncQueue();
    }
  };

  const initialize = async (userId: string): Promise<void> => {
    if (isInitialized && currentUserId === userId) {
      logger.info('[AutoSync] Already initialized for user', { userId });
      return;
    }

    logger.info('[AutoSync] Initializing for user', { userId });
    currentUserId = userId;
    processContext.userId = userId;

    try {
      const localData = await hooks.loadLocalData();
      const hasLocalData = hooks.hasLocalData(localData);
      const hasCloudData = await hooks.checkCloudData(userId);

      if (!hasCloudData && hasLocalData) {
        logger.info('[AutoSync] Performing silent migration...');
        await hooks.migrateToCloud(userId, localData);
      } else if (hasCloudData && hasLocalData) {
        logger.info('[AutoSync] Merging local and cloud data...');
        await hooks.mergeData(userId, localData);
      }

      await hooks.convertLocalToCache(localData);
      startContinuousSync();

      isInitialized = true;
      logger.info('[AutoSync] Initialization complete');
    } catch (error) {
      logger.error('[AutoSync] Initialization failed:', error);
    }
  };

  const stopSync = (): void => {
    stopContinuousSync();
    syncStatus.isSyncing = false;
  };

  return {
    initialize,
    stopSync,
    queueOperation,
    getSyncStatus: () => ({ ...syncStatus }),
  };
}
