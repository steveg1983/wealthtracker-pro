// Enhanced Service Worker for WealthTracker with Offline Support
const CACHE_VERSION = '1.5.0';
const STATIC_CACHE = `wealthtracker-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `wealthtracker-dynamic-v${CACHE_VERSION}`;
const API_CACHE = `wealthtracker-api-v${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  // Add your static assets here
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/accounts$/,
  /\/api\/transactions\?/,
  /\/api\/categories$/,
  /\/api\/tags$/,
  /\/api\/budgets$/,
  /\/api\/goals$/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[ServiceWorker] Install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![STATIC_CACHE, DYNAMIC_CACHE, API_CACHE].includes(cacheName)) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    // For POST/PUT/DELETE requests, try network and queue if offline
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleMutationRequest(request));
    }
    return;
  }

  // Skip cross-origin requests except for CDNs
  if (!url.origin.match(self.location.origin) && 
      !url.origin.match(/unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com/)) {
    return;
  }

  // Determine caching strategy based on request type
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf)$/)) {
    // Images and fonts - cache first
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (url.pathname.match(/\.(css|js)$/) || url.pathname.includes('/assets/')) {
    // CSS, JS - stale while revalidate
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  } else if (url.pathname.startsWith('/api/')) {
    // API calls - network first with caching
    event.respondWith(networkFirstApi(request));
  } else {
    // HTML pages - network first
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Handle mutation requests (POST, PUT, DELETE)
async function handleMutationRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Queue the request for later sync
    await queueRequest(request);
    
    // Return a synthetic response
    return new Response(
      JSON.stringify({ 
        status: 'queued', 
        message: 'Request queued for sync when online' 
      }),
      { 
        status: 202, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Queue failed requests for background sync
async function queueRequest(request) {
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
  };

  // Store in IndexedDB for background sync
  const db = await openSyncDB();
  const tx = db.transaction(['sync-queue'], 'readwrite');
  await tx.objectStore('sync-queue').add(requestData);
  await tx.complete;

  // Register for background sync
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-offline-data');
  }
}

// Open sync database
async function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WealthTrackerSync', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || fetchPromise;
}

// Network first strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || caches.match('/index.html');
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Network first for API with intelligent caching
async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    const response = await fetch(request);
    
    // Cache successful responses for cacheable endpoints
    if (response && response.status === 200) {
      const url = new URL(request.url);
      const shouldCache = CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname + url.search));
      
      if (shouldCache) {
        cache.put(request, response.clone());
      }
    }
    
    return response;
  } catch (error) {
    // Try cache for GET requests
    const cached = await cache.match(request);
    if (cached) {
      // Add header to indicate cached response
      const headers = new Headers(cached.headers);
      headers.set('X-From-Cache', 'true');
      
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: headers,
      });
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ error: 'Offline and no cached data available' }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Background sync event
self.addEventListener('sync', async (event) => {
  console.log('[ServiceWorker] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data
async function syncOfflineData() {
  const db = await openSyncDB();
  const tx = db.transaction(['sync-queue'], 'readonly');
  const requests = await tx.objectStore('sync-queue').getAll();
  
  console.log(`[ServiceWorker] Syncing ${requests.length} queued requests`);
  
  for (const requestData of requests) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.method !== 'GET' ? requestData.body : undefined,
      });
      
      if (response.ok) {
        // Remove from queue on success
        const deleteTx = db.transaction(['sync-queue'], 'readwrite');
        await deleteTx.objectStore('sync-queue').delete(requestData.id);
      }
    } catch (error) {
      console.error('[ServiceWorker] Sync failed for request:', error);
    }
  }
  
  // Notify clients of sync completion
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'sync-complete',
      timestamp: Date.now(),
    });
  });
}

// Message event for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});