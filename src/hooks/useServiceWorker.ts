import { useState, useEffect, useCallback } from 'react';
import { 
  getRegistration, 
  checkForUpdates, 
  getSyncStatus,
  forceSyncData,
  enableOfflineMode 
} from '../utils/serviceWorkerRegistration';

interface ServiceWorkerState {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  isOffline: boolean;
  syncStatus: {
    pendingRequests: number;
    lastSync: number;
  } | null;
}

type Logger = Pick<Console, 'error'>;
const serviceWorkerLogger: Logger = typeof console !== 'undefined' ? console : { error: () => {} };

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    registration: null,
    updateAvailable: false,
    isOffline: !navigator.onLine,
    syncStatus: null
  });

  useEffect(() => {
    // Get initial registration
    const registration = getRegistration() || (window as any).swRegistration;
    if (registration) {
      setState(prev => ({ ...prev, registration }));
      
      // Check if update is already waiting
      if (registration.waiting) {
        setState(prev => ({ ...prev, updateAvailable: true }));
      }
    }

    // Listen for update events
    const handleUpdateAvailable = (event: CustomEvent) => {
      setState(prev => ({ 
        ...prev, 
        registration: event.detail.registration,
        updateAvailable: true 
      }));
    };

    // Listen for online/offline events
    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }));
    };

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }));
      // Try to sync data when coming back online
      forceSyncData();
    };

    // Listen for sync status updates from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'sync-status') {
        setState(prev => ({ 
          ...prev, 
          syncStatus: {
            pendingRequests: event.data.pendingRequests,
            lastSync: event.data.lastSync
          }
        }));
      }
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable as EventListener);
    window.addEventListener('app-offline', handleOffline);
    window.addEventListener('app-online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Get initial sync status
    getSyncStatus().then(status => {
      setState(prev => ({ ...prev, syncStatus: status }));
    }).catch(() => {
      // Service worker not ready yet
    });

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable as EventListener);
      window.removeEventListener('app-offline', handleOffline);
      window.removeEventListener('app-online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const checkUpdates = useCallback(async () => {
    try {
      await checkForUpdates();
    } catch (error) {
      serviceWorkerLogger.error('Failed to check for updates:', error as Error);
    }
  }, []);

  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setState(prev => ({ ...prev, syncStatus: status }));
    } catch (error) {
      serviceWorkerLogger.error('Failed to get sync status:', error as Error);
    }
  }, []);

  const forceSync = useCallback(() => {
    forceSyncData();
  }, []);

  const enableOffline = useCallback(() => {
    enableOfflineMode();
  }, []);

  return {
    ...state,
    checkUpdates,
    refreshSyncStatus,
    forceSync,
    enableOffline
  };
}
