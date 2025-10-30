import { createStorageAdapter, type StorageAdapter as CoreStorageAdapter } from '@wealthtracker/core';
import { encryptedStorage, STORAGE_KEYS } from './encryptedStorageService';
import { indexedDBService } from './indexedDBService';
import { logger } from './loggingService';

const storageAdapter: CoreStorageAdapter = createStorageAdapter({
  storageKeys: STORAGE_KEYS,
  encryptedStorage,
  indexedDb: indexedDBService,
  logger,
  sessionStorage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
  localStorage: typeof window !== 'undefined' ? window.localStorage : undefined,
});

export { storageAdapter, STORAGE_KEYS };
export type StorageAdapter = CoreStorageAdapter;
