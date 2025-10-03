import { logger } from '../services/loggingService';
import { captureMessage } from '../lib/sentry';
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

export function register(config?: Config): void {
  if ('serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    // Safari compatibility: use fallback for import.meta.env
    let baseUrl = '/';
    try {
      // @ts-expect-error - Safari might not support import.meta.env
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
        baseUrl = import.meta.env.BASE_URL;
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

    // Set up online/offline event listeners
    if (config?.onOffline) {
      window.addEventListener('offline', config.onOffline);
    }
    if (config?.onOnline) {
      window.addEventListener('online', config.onOnline);
    }
  }
}

function registerValidSW(swUrl: string, config?: Config): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      swRegistration = registration;
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour
      
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
              try { captureMessage('SW_UPDATE_AVAILABLE', 'info'); } catch {}
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              logger.info('Content is cached for offline use.');

              // Execute callback
              try { captureMessage('SW_CACHED_OFFLINE', 'info'); } catch {}
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
      
      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
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
      });
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
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
    
    // Reload the page when the new service worker is activated
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
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
export function getSyncStatus(): Promise<any> {
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
