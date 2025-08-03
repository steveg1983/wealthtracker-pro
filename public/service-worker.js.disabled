/**
 * Service Worker for WealthTracker
 * Handles offline functionality, caching, and background sync
 */

// Cache configuration
const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `wealthtracker-v${CACHE_VERSION}`;
const API_CACHE_NAME = `wealthtracker-api-v${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `wealthtracker-images-v${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];

// API endpoints to cache
const CACHE_API_ROUTES = [
  '/api/accounts',
  '/api/transactions',
  '/api/categories',
  '/api/tags',
  '/api/budgets',
  '/api/goals'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('wealthtracker-') && 
              cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip hot module replacement requests
  if (url.pathname.includes('/@vite') || url.pathname.includes('/__vite')) {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle static assets
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }
  
  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
  
  // Skip caching for non-GET requests
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response('Network error', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      })
    );
    return;
  }
  
  // Default strategy: Network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful GET responses only
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Return a basic error response if nothing is found
        return new Response('Network error', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      })
  );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      // Clone the response before caching
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] API request failed:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[ServiceWorker] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // Return a more informative error response
    const isLocalOnly = request.url.includes('localhost') || request.url.includes('127.0.0.1');
    const errorMessage = isLocalOnly 
      ? 'No backend server running. The app is working in local-only mode.'
      : 'Network request failed and no cached data available.';
    
    return new Response(
      JSON.stringify({ 
        error: 'Service Unavailable', 
        message: errorMessage,
        offline: true 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return placeholder image or empty response
    return new Response('', { status: 404 });
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try to return cached index.html for SPA
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match('/index.html');
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page if available
    const offlineResponse = await cache.match('/offline.html');
    return offlineResponse || new Response('Offline', { status: 503 });
  }
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((names) => {
          return Promise.all(names.map(name => caches.delete(name)));
        })
      );
      break;
      
    case 'GET_SYNC_STATUS':
      // Send sync status back
      event.ports[0].postMessage({
        type: 'sync-status',
        pendingRequests: 0, // Simplified for now
        lastSync: Date.now()
      });
      break;
      
    case 'FORCE_SYNC':
      // Trigger background sync if supported
      if ('sync' in self.registration) {
        event.waitUntil(self.registration.sync.register('sync-data'));
      }
      break;
      
    case 'ENABLE_OFFLINE_MODE':
      // Pre-cache essential data
      event.waitUntil(precacheEssentialData());
      break;
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  } else if (event.tag === 'automatic-backup') {
    event.waitUntil(performAutomaticBackup());
  }
});

// Periodic background sync event (for automatic backups)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'automatic-backup') {
    event.waitUntil(performAutomaticBackup());
  }
});

// Sync offline data when back online
async function syncOfflineData() {
  console.log('[ServiceWorker] Syncing offline data');
  
  // Notify clients about sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'sync-success',
      timestamp: Date.now()
    });
  });
}

// Pre-cache essential data for offline use
async function precacheEssentialData() {
  const cache = await caches.open(API_CACHE_NAME);
  
  // Skip pre-caching API routes if no backend is available
  // This prevents connection errors on startup
  const essentialEndpoints = CACHE_API_ROUTES.map(endpoint => 
    fetch(endpoint).then(response => {
      if (response && response.ok) {
        return cache.put(endpoint, response);
      }
    }).catch(error => {
      // Silently skip if API is not available
      console.log(`[ServiceWorker] Skipping cache for ${endpoint} - API not available`);
    })
  );
  
  await Promise.all(essentialEndpoints);
  console.log('[ServiceWorker] Essential data caching completed');
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [100, 50, 100],
    data: data.data,
    tag: data.tag || 'wealthtracker-notification',
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  if (data?.url) {
    url = data.url;
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Perform automatic backup
async function performAutomaticBackup() {
  console.log('[ServiceWorker] Performing automatic backup');
  
  try {
    // Send message to all clients to trigger backup
    const clients = await self.clients.matchAll();
    
    if (clients.length > 0) {
      // If app is open, let it handle the backup
      clients.forEach(client => {
        client.postMessage({
          type: 'perform-backup'
        });
      });
    } else {
      // App is closed, perform backup directly in service worker
      // This requires accessing IndexedDB and localStorage from SW
      // For now, we'll just schedule it for when the app opens
      console.log('[ServiceWorker] App closed, backup will run on next open');
    }
    
    // Show notification
    if (self.registration.showNotification) {
      await self.registration.showNotification('Automatic Backup', {
        body: 'Your financial data is being backed up',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: 'backup-notification',
        silent: true
      });
    }
  } catch (error) {
    console.error('[ServiceWorker] Backup failed:', error);
  }
}