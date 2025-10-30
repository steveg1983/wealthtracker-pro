import { logger } from '../services/loggingService';
// Safari compatibility utilities

export const isSafari = () => {
  const ua = navigator.userAgent;
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
};

// Fix for import.meta.env in Safari
export const getEnvVar = (key: string, defaultValue: string = '') => {
  // Safari might have issues with import.meta.env
  try {
    // Safari compatibility fix for import.meta
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {
    logger.warn(`Failed to access import.meta.env.${key}:`, e);
  }
  
  // Fallback for Safari
  if (key === 'BASE_URL') {
    return defaultValue || '/';
  }
  
  return defaultValue;
};

// Check if IndexedDB is available and working
export const checkIndexedDBSupport = async (): Promise<boolean> => {
  if (!('indexedDB' in window)) {
    logger.warn('IndexedDB not supported');
    return false;
  }
  
  try {
    // Safari might have IndexedDB but it could be broken in private mode
    const testDB = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('_test_db_', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    testDB.close();
    await new Promise<void>((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase('_test_db_');
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => reject(deleteReq.error);
    });
    
    return true;
  } catch (e) {
    logger.warn('IndexedDB test failed:', e);
    return false;
  }
};

// Safari-compatible storage fallback
export class SafariStorageFallback {
  private prefix = 'wt_fallback_';
  
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      logger.error('Safari storage fallback failed:', e);
    }
  }
  
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? (JSON.parse(item) as T) : null;
    } catch (e) {
      logger.error('Safari storage fallback failed:', e);
      return null;
    }
  }
  
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (e) {
      logger.error('Safari storage fallback failed:', e);
    }
  }
  
  async clear(): Promise<void> {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      logger.error('Safari storage fallback failed:', e);
    }
  }
}

// Fix for Safari's strict mode with service workers
export const registerServiceWorkerSafari = async () => {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service Workers not supported');
    return null;
  }
  
  try {
    // Safari might need a different approach
    const swUrl = `${window.location.origin}/service-worker.js`;
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/'
    });
    
    logger.info('Service Worker registered for Safari');
    return registration;
  } catch (error) {
    logger.warn('Service Worker registration failed in Safari:', error);
    return null;
  }
};

// Polyfill for crypto.randomUUID if not available (older Safari)
export const ensureRandomUUID = () => {
  if (!crypto.randomUUID) {
    const fallback = (): `${string}-${string}-${string}-${string}-${string}` => {
      const template = '10000000-1000-4000-8000-100000000000';
      const getRandomValues = typeof crypto.getRandomValues === 'function'
        ? crypto.getRandomValues.bind(crypto)
        : undefined;

      const uuid = template.replace(/[018]/g, (char) => {
        const buffer = new Uint8Array(1);
        if (getRandomValues) {
          getRandomValues(buffer);
        } else {
          buffer[0] = Math.floor(Math.random() * 256);
        }
        const random = buffer[0] ?? 0;
        const value = Number(char) ^ (random & 15 >> Number(char) / 4);
        return value.toString(16);
      });

      return uuid as `${string}-${string}-${string}-${string}-${string}`;
    };

    crypto.randomUUID = fallback;
  }
};

// Initialize Safari compatibility fixes
export const initSafariCompat = async () => {
  if (!isSafari()) {
    return { safari: false, indexedDB: true };
  }
  
  logger.info('Safari detected, applying compatibility fixes...');
  
  // Apply polyfills
  ensureRandomUUID();
  
  // Check IndexedDB support
  const hasIndexedDB = await checkIndexedDBSupport();
  
  // Check if we're in private browsing mode
  const isPrivate = !hasIndexedDB && localStorage.length === 0;
  
  if (isPrivate) {
    logger.warn('Safari private browsing mode detected - some features may be limited');
  }
  
  return {
    safari: true,
    indexedDB: hasIndexedDB,
    privateMode: isPrivate
  };
};
