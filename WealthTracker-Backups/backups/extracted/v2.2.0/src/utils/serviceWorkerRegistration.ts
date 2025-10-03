import { logger } from '../services/loggingService';
import { captureMessage } from '../lib/sentry';
import { TIME } from '../constants';
// Service Worker Registration with enhanced update handling

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
);

interface Config {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

// Store registration for external access
let swRegistration: ServiceWorkerRegistration | null = null;
// Store interval and event listeners for cleanup
let updateCheckInterval: NodeJS.Timeout | null = null;
let messageListener: ((event: MessageEvent) => void) | null = null;
let offlineListener: (() => void) | null = null;
let onlineListener: (() => void) | null = null;
let controllerChangeListener: (() => void) | null = null;

export function register(config?: Config): void {
  if ('serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    // Safari compatibility: use fallback for import.meta.env
    let baseUrl = '/';
    try {
      const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined);
      if (metaEnv?.BASE_URL) {
        baseUrl = String(metaEnv.BASE_URL);
      }
    } catch {
      logger.warn('Failed to access import.meta.env.BASE_URL, using default');
    }
    
    const publicUrl = new URL(baseUrl, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      return;
    }

    window.addEventListener('load', () => {
      // Use the new service worker
      const swUrl = `${baseUrl}sw.js`;

      if (isLocalhost) {
        // This is running on localhost. Check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Add some additional logging to localhost
        navigator.serviceWorker.ready.then(() => {
          logger.info('App is being served cache-first by a service worker.');
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });

    // Set up online/offline event listeners with cleanup references
    if (config?.onOffline) {
      offlineListener = config.onOffline;
      window.addEventListener('offline', offlineListener);
    }
    if (config?.onOnline) {
      onlineListener = config.onOnline;
      window.addEventListener('online', onlineListener);
    }
  }
}

function registerValidSW(swUrl: string, config?: Config): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      swRegistration = registration;
      
      // Clear any existing interval before setting new one
      if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
      }
      // Check for updates periodically
      updateCheckInterval = setInterval(() => {
        registration.update();
      }, TIME.HOUR); // Check every hour using enterprise constant
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              logger.info('New content is available and will be used when all tabs are closed.');

              // Execute callback
              try { 
                captureMessage('SW_UPDATE_AVAILABLE', 'info'); 
              } catch {
                // Sentry not available, continue without logging
              }
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              logger.info('Content is cached for offline use.');

              // Execute callback
              try { 
                captureMessage('SW_CACHED_OFFLINE', 'info'); 
              } catch {
                // Sentry not available, continue without logging
              }
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
      
      // Clear any existing message listener before adding new one
      if (messageListener) {
        navigator.serviceWorker.removeEventListener('message', messageListener);
      }
      // Handle messages from service worker
      messageListener = (event: MessageEvent) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'sync-success':
            logger.info('Data synced successfully:', data);
            break;
          case 'accounts-updated':
            logger.info('Accounts updated in background:', data);
            break;
          case 'sync-status':
            logger.info('Sync status:', data);
            break;
        }
      };
      navigator.serviceWorker.addEventListener('message', messageListener);
    })
    .catch((error) => {
      logger.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config): void {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      logger.warn('No internet connection found. App is running in offline mode.');
    });
}

export function unregister(): void {
  // Clean up all tracked resources
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  
  if (messageListener) {
    navigator.serviceWorker.removeEventListener('message', messageListener);
    messageListener = null;
  }
  
  if (offlineListener) {
    window.removeEventListener('offline', offlineListener);
    offlineListener = null;
  }
  
  if (onlineListener) {
    window.removeEventListener('online', onlineListener);
    onlineListener = null;
  }
  
  if (controllerChangeListener) {
    navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeListener);
    controllerChangeListener = null;
  }
  
  // Unregister the service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        swRegistration = null;
      })
      .catch((error) => {
        logger.error(error.message);
      });
  }
}

// Get the current service worker registration
export function getRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

// Manually check for updates
export function checkForUpdates(): Promise<void> {
  if (swRegistration) {
    return swRegistration.update();
  }
  return Promise.reject(new Error('No service worker registration found'));
}

// Skip waiting and activate new service worker
export function skipWaiting(): void {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    // Clear any existing controllerchange listener before adding new one
    if (controllerChangeListener) {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeListener);
    }
    
    // Reload the page when the new service worker is activated
    controllerChangeListener = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeListener);
  }
}

// Clear all caches
export function clearCaches(): Promise<void> {
  if ('caches' in window) {
    return caches.keys().then((names) => {
      return Promise.all(names.map(name => caches.delete(name)));
    }).then(() => {
      logger.info('All caches cleared');
    });
  }
  return Promise.resolve();
}

// Get sync status from service worker
export function getSyncStatus(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('No active service worker'));
      return;
    }
    
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data);
    };
    
    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_SYNC_STATUS' },
      [channel.port2]
    );
  });
}

// Force sync of offline data
export function forceSyncData(): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC' });
  }
}

// Enable offline mode (pre-cache essential data)
export function enableOfflineMode(): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'ENABLE_OFFLINE_MODE' });
  }
}
