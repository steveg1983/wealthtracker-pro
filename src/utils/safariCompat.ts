import { lazyLogger as logger } from '../services/serviceFactory';
// Safari compatibility utilities

export const isSafari = () => {
  const ua = navigator.userAgent;
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
};

// Fix for import.meta.env in Safari
export const getEnvVar = (key: string, defaultValue: string = '') => {
  // Safari might have issues with import.meta.env
  try {
    // @ts-expect-error
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {
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
    return false;
  }
};

// Safari-compatible storage fallback
export class SafariStorageFallback {
  private prefix = 'wt_fallback_';
  
  async setItem(key: string, value: any): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
    }
  }
  
  async getItem(key: string): Promise<any> {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  }
  
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (e) {
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
    }
  }
}

// Fix for Safari's strict mode with service workers
export const registerServiceWorkerSafari = async () => {
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  
  try {
    // Safari might need a different approach
    const swUrl = `${window.location.origin}/service-worker.js`;
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/'
    });
    
    return registration;
  } catch (e) {
    return null;
  }
};

// Polyfill for crypto.randomUUID if not available (older Safari)
export const ensureRandomUUID = () => {
  if (!crypto.randomUUID) {
    crypto.randomUUID = function randomUUID() {
      return (
        '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        )
      );
    };
  }
};

// Initialize Safari compatibility fixes
export const initSafariCompat = async () => {
  if (!isSafari()) {
    return { safari: false, indexedDB: true };
  }
  
  
  // Apply polyfills
  ensureRandomUUID();
  
  // Check IndexedDB support
  const hasIndexedDB = await checkIndexedDBSupport();
  
  // Check if we're in private browsing mode
  const isPrivate = !hasIndexedDB && localStorage.length === 0;
  
  if (isPrivate) {
  }
  
  return {
    safari: true,
    indexedDB: hasIndexedDB,
    privateMode: isPrivate
  };
};
