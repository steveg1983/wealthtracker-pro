/**
 * WealthTracker Service Worker
 * Provides offline functionality, caching, and background sync
 */

// Cache versions - INCREMENT THIS to bust cache
const CACHE_VERSION = 'v5-professional-icons';
const CACHE_NAMES = {
  static: `wealthtracker-static-${CACHE_VERSION}`,
  dynamic: `wealthtracker-dynamic-${CACHE_VERSION}`,
  api: `wealthtracker-api-${CACHE_VERSION}`,
  images: `wealthtracker-images-${CACHE_VERSION}`,
  critical: `wealthtracker-critical-${CACHE_VERSION}`
};

// Cache limits
const CACHE_LIMITS = {
  dynamic: 50,
  api: 100,
  images: 30
};

// Files to cache immediately for instant loading
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/dashboard',
  '/transactions',
  '/accounts'
];

// Critical assets to pre-cache after install
const CRITICAL_ASSETS = [
  '/assets/index.css',
  '/assets/vendor.js',
  '/assets/index.js'
];

// API routes that can be cached
const CACHEABLE_API_ROUTES = [
  '/api/accounts',
  '/api/categories',
  '/api/transactions',
  '/api/budgets',
  '/api/goals'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v4-dev-fix...');
  
  // Log if we're in development mode
  if (self.location.hostname === 'localhost' && self.location.port === '5173') {
    console.log('[SW] Running in development mode - limited caching enabled');
  }
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAMES.static)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v4-dev-fix...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!Object.values(CACHE_NAMES).includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // DEVELOPMENT MODE: Skip Vite dev server requests
  const isDevelopment = url.hostname === 'localhost' && url.port === '5173';
  if (isDevelopment) {
    // Skip all Vite-specific requests
    if (
      url.pathname.includes('@vite') ||
      url.pathname.includes('@react-refresh') ||
      url.pathname.startsWith('/src/') ||
      url.pathname.includes('node_modules') ||
      url.search.includes('t=') || // Vite HMR timestamps
      url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.jsx')
    ) {
      // Let Vite dev server handle these directly
      return;
    }
    
    // In development, also skip navigation requests (app routes)
    // These should be handled by Vite's dev server, not the service worker
    if (request.mode === 'navigate' && !url.pathname.startsWith('/api/')) {
      return;
    }
  }

  // Do not intercept same-origin API requests; the app talks directly to Supabase.
  // Let the network handle `/api/*` or any backend proxies without SW interference.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle static assets (but not in development for source files)
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
  }
});

// (API handler removed — SW no longer caches `/api/*` routes.)

// Handle static assets with appropriate strategy
async function handleStaticRequest(request) {
  const url = new URL(request.url);
  
  // Don't handle navigation requests as static assets
  if (request.mode === 'navigate' && url.pathname !== '/' && url.pathname !== '/index.html') {
    return fetch(request);
  }
  
  // In development, be more selective about what we cache
  const isDevelopment = url.hostname === 'localhost' && url.port === '5173';
  if (isDevelopment) {
    // Only cache essential static files in development
    const shouldCache = 
      url.pathname === '/' ||
      url.pathname === '/index.html' ||
      url.pathname === '/manifest.json' ||
      url.pathname.includes('/icon-') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.svg');
    
    if (!shouldCache) {
      // For non-cacheable development files, just fetch from network
      return fetch(request);
    }
  }
  
  // Use network-first for JavaScript modules to avoid stale cache issues
  if (url.pathname.includes('/assets/') && url.pathname.endsWith('.js')) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        // Update cache with fresh version
        const dynamicCache = await caches.open(CACHE_NAMES.dynamic);
        await dynamicCache.put(request, networkResponse.clone());
        return networkResponse;
      }
    } catch (error) {
      // Fall back to cache if network fails
      const dynamicCache = await caches.open(CACHE_NAMES.dynamic);
      const cachedResponse = await dynamicCache.match(request);
      if (cachedResponse) {
        console.log('[SW] Serving JS from cache (offline):', request.url);
        return cachedResponse;
      }
    }
  }
  
  // Cache-first for other static assets
  const staticCache = await caches.open(CACHE_NAMES.static);
  let response = await staticCache.match(request);
  
  if (response) {
    return response;
  }
  
  // Check dynamic cache
  const dynamicCache = await caches.open(CACHE_NAMES.dynamic);
  response = await dynamicCache.match(request);
  
  if (response) {
    return response;
  }
  
  // Try network
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cacheName = request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) 
        ? CACHE_NAMES.images 
        : CACHE_NAMES.dynamic;
      
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      
      // Trim cache if needed
      if (cacheName === CACHE_NAMES.images) {
        await trimCache(cacheName, CACHE_LIMITS.images);
      } else if (cacheName === CACHE_NAMES.dynamic) {
        await trimCache(cacheName, CACHE_LIMITS.dynamic);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network request failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await staticCache.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Return 404 for other requests
    return new Response('Not found', { status: 404 });
  }
}

// Trim cache to limit
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(
      keysToDelete.map(key => cache.delete(key))
    );
    console.log(`[SW] Trimmed ${keysToDelete.length} items from ${cacheName}`);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys()
          .then(cacheNames => Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          ))
          .then(() => event.ports[0].postMessage({ success: true }))
      );
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(
        cacheUrls(data.urls)
          .then(() => event.ports[0].postMessage({ success: true }))
          .catch(error => event.ports[0].postMessage({ 
            success: false, 
            error: error.message 
          }))
      );
      break;
  }
});

// Cache specific URLs on demand
async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAMES.dynamic);
  await cache.addAll(urls);
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  } else if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  } else if (event.tag === 'sync-accounts') {
    event.waitUntil(syncAccounts());
  }
});

// Sync all offline data
async function syncOfflineData() {
  try {
    console.log('[SW] Starting offline data sync...');
    
    // Notify all clients to perform sync
    const clients = await self.clients.matchAll();
    
    let syncCompleted = false;
    for (const client of clients) {
      client.postMessage({
        type: 'perform-sync'
      });
      syncCompleted = true;
    }
    
    if (!syncCompleted) {
      // No clients available, perform basic sync from service worker
      console.log('[SW] No active clients, performing basic sync...');
      
      // Try to sync cached API data
      const cache = await caches.open(CACHE_NAMES.api);
      const requests = await cache.keys();
      
      for (const request of requests) {
        if (request.method === 'GET') continue;
        
        try {
          const response = await fetch(request);
          if (response.ok) {
            console.log('[SW] Successfully synced:', request.url);
          }
        } catch (error) {
          console.error('[SW] Failed to sync:', request.url, error);
        }
      }
    }
    
    // Notify clients of sync completion
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        data: { timestamp: Date.now() }
      });
    });
    
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Sync offline transactions
async function syncTransactions() {
  try {
    // Get pending transactions from IndexedDB
    const db = await openDB();
    const tx = db.transaction('pending_transactions', 'readonly');
    const store = tx.objectStore('pending_transactions');
    const pendingTransactions = await store.getAll();
    
    // Send to server
    for (const transaction of pendingTransactions) {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      });
      
      if (response.ok) {
        // Remove from pending
        const deleteTx = db.transaction('pending_transactions', 'readwrite');
        await deleteTx.objectStore('pending_transactions').delete(transaction.id);
      }
    }
    
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        data: { synced: pendingTransactions.length }
      });
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Sync accounts data
async function syncAccounts() {
  try {
    const response = await fetch('/api/accounts');
    if (response.ok) {
      const accounts = await response.json();
      
      // Update cache
      const cache = await caches.open(CACHE_NAMES.api);
      await cache.put('/api/accounts', new Response(JSON.stringify(accounts)));
      
      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'accounts-updated',
          data: accounts
        });
      });
    }
  } catch (error) {
    console.error('[SW] Account sync failed:', error);
  }
}

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WealthTrackerDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pending_transactions')) {
        db.createObjectStore('pending_transactions', { keyPath: 'id' });
      }
    };
  });
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-accounts') {
    event.waitUntil(syncAccounts());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from WealthTracker',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/images/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('WealthTracker', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
