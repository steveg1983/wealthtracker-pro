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
    const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined);
    if (metaEnv && metaEnv[key]) {
      return metaEnv[key];
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
  
  async setItem(key: string, value: unknown): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      logger.error('Safari storage fallback failed:', e);
    }
  }
  
  async getItem(key: string): Promise<unknown> {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
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
  } catch (e) {
    logger.warn('Service Worker registration failed in Safari:', e);
    return null;
  }
};

// Polyfill for crypto.randomUUID if not available (older Safari)
export const ensureRandomUUID = () => {
  if (!crypto.randomUUID) {
    (crypto as any).randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      const uuid = `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}` as `${string}-${string}-${string}-${string}-${string}`;
      return uuid;
    };
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
