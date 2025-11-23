/**
 * Advanced Service Worker for WealthTracker
 * Implements intelligent caching, background sync, and offline capabilities
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { Queue } from 'workbox-background-sync';
import { createScopedLogger } from '../loggers/scopedLogger';
import type { Transaction, Account, Budget } from '../types';

const swLogger = createScopedLogger('ServiceWorker');

// Types
type SyncEntity = Transaction | Account | Budget | Record<string, unknown>;
type ConflictResolutionResult = { resolved: boolean; resolvedData?: SyncEntity };
type QueueEntry = { request: Request; timestamp?: number };
interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}
interface StoredConflict {
  request: Request;
  serverData: SyncEntity;
  timestamp: number;
}
interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysUntilDue?: number;
}

// Cache names
const CACHE_VERSION = '2.0.0';
const _PRECACHE_NAME = `wealthtracker-precache-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `wealthtracker-runtime-v${CACHE_VERSION}`;
const API_CACHE = `wealthtracker-api-v${CACHE_VERSION}`;
const IMAGE_CACHE = `wealthtracker-images-v${CACHE_VERSION}`;

// Precache assets injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

// Queue for offline requests
const _syncQueue = new Queue('wealthtracker-sync', {
  onSync: async ({ queue }) => {
    let entry: { request: Request; timestamp?: number } | undefined;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok) {
          throw new Error(`Request failed with status: ${response.status}`);
        }
        
        // Notify clients of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'sync-success',
            url: entry?.request.url || '',
            timestamp: Date.now()
          });
        });
      } catch (error) {
        swLogger.error('Sync failed, will retry:', error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
  maxRetentionTime: 24 * 60 // Retry for 24 hours
});

// Background sync plugin for mutations
const bgSyncPlugin = new BackgroundSyncPlugin('wealthtracker-mutations', {
  maxRetentionTime: 24 * 60, // 24 hours
  onSync: async ({ queue }) => {
    // Custom sync logic for handling conflicts
    await handleSyncWithConflictResolution(queue);
  }
});

// Cache strategies

// HTML pages - Network first with offline fallback
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: RUNTIME_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      })
    ],
    networkTimeoutSeconds: 3
  })
);

// API GET requests - Network first with smart caching
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.search.includes('GET'),
  new NetworkFirst({
    cacheName: API_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes for fresh data
        purgeOnQuotaError: true
      })
    ],
    networkTimeoutSeconds: 5
  })
);

// API mutations - Network only with background sync
registerRoute(
  ({ url, request }) => 
    url.pathname.startsWith('/api/') && 
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method),
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  })
);

// Static assets - Cache first
registerRoute(
  ({ request }) => 
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: RUNTIME_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// Images - Cache first with expiration
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true
      })
    ]
  })
);

// Advanced sync with conflict resolution
async function handleSyncWithConflictResolution(queue: Queue) {
  const db = await openConflictDB();
  let entry: QueueEntry | undefined;
  
  while ((entry = await queue.shiftRequest())) {
    try {
      const response = await fetch(entry.request.clone());
      
      if (response.status === 409) {
        // Conflict detected
        const serverData = await response.json();
        const conflict = await handleConflict(entry.request, serverData, db);
        
        if (conflict.resolved) {
          // Retry with resolved data
          const resolvedRequest = new Request(entry.request.url, {
            method: entry.request.method,
            headers: entry.request.headers,
            body: JSON.stringify(conflict.resolvedData)
          });
          
          await fetch(resolvedRequest);
        } else {
          // Store for manual resolution
          await storeConflict(db, {
            request: entry.request,
            serverData,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      swLogger.error('Sync with conflict resolution failed:', error);
      await queue.unshiftRequest(entry);
      throw error;
    }
  }
}

// Handle conflicts based on type
async function handleConflict(
  request: Request,
  serverData: SyncEntity,
  _db: IDBDatabase
): Promise<ConflictResolutionResult> {
  const url = new URL(request.url);
  const clientData = (await request.json()) as SyncEntity;
  
  // Determine conflict resolution strategy based on endpoint
  if (url.pathname.includes('/transactions')) {
    return resolveTransactionConflict(
      clientData as Transaction,
      serverData as Transaction
    );
  } else if (url.pathname.includes('/accounts')) {
    return resolveAccountConflict(
      clientData as (Account & { originalBalance?: number }),
      serverData as Account
    );
  } else if (url.pathname.includes('/budgets')) {
    return resolveBudgetConflict(
      clientData as Budget,
      serverData as Budget
    );
  }
  
  // Default: server wins
  return { resolved: true, resolvedData: serverData };
}

// Conflict resolution strategies
function resolveTransactionConflict(client: Transaction, server: Transaction): ConflictResolutionResult {
  // For transactions, prefer the one with the latest timestamp
  if (client.updatedAt > server.updatedAt) {
    return { resolved: true, resolvedData: client };
  }
  return { resolved: true, resolvedData: server };
}

function resolveAccountConflict(
  client: Account & { originalBalance?: number },
  server: Account
): ConflictResolutionResult {
  // For accounts, merge balances (sum the differences)
  const merged = { ...server };
  const originalBalance = client.originalBalance ?? client.balance;
  const balanceDiff = client.balance - originalBalance;
  merged.balance = server.balance + balanceDiff;
  return { resolved: true, resolvedData: merged };
}

function resolveBudgetConflict(client: Budget, server: Budget): ConflictResolutionResult {
  // For budgets, use the most restrictive (lower) amount
  const merged = { ...server };
  merged.amount = Math.min(client.amount, server.amount);
  merged.spent = Math.max(client.spent, server.spent);
  return { resolved: true, resolvedData: merged };
}

// IndexedDB for conflict storage
async function openConflictDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WealthTrackerConflicts', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('conflicts')) {
        db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function storeConflict(db: IDBDatabase, conflict: StoredConflict) {
  const tx = db.transaction(['conflicts'], 'readwrite');
  await tx.objectStore('conflicts').add(conflict);
}

// Push notification handling
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options: NotificationOptions = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: data.data,
    tag: data.tag || 'wealthtracker-notification',
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  // Determine URL based on notification type
  if (data?.type === 'budget-alert') {
    url = '/budget';
  } else if (data?.type === 'bill-reminder') {
    url = `/transactions?filter=bills&date=${data.date}`;
  } else if (data?.type === 'goal-achieved') {
    url = `/goals/${data.goalId}`;
  } else if (data?.type === 'investment-alert') {
    url = '/investments';
  } else if (data?.url) {
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

// Periodic background sync for data freshness
self.addEventListener('periodicsync', (event: PeriodicSyncEvent) => {
  if (event.tag === 'update-accounts') {
    event.waitUntil(updateAccountBalances());
  } else if (event.tag === 'check-bills') {
    event.waitUntil(checkUpcomingBills());
  } else if (event.tag === 'update-investments') {
    event.waitUntil(updateInvestmentPrices());
  }
});

// Background tasks
async function updateAccountBalances() {
  try {
    const response = await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Cache the updated data
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/accounts', new Response(JSON.stringify(data)));
      
      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'accounts-updated',
          data,
          timestamp: Date.now()
        });
      });
    }
  } catch (error) {
    swLogger.error('Failed to update account balances', error);
  }
}

async function checkUpcomingBills() {
  try {
    const response = await fetch('/api/bills/upcoming');
    if (response.ok) {
      const bills: UpcomingBill[] = await response.json();
      
      // Check for bills due in next 3 days
      const upcomingBills = bills
        .map((bill) => {
          const dueDate = new Date(bill.dueDate);
          const daysUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return { ...bill, daysUntilDue };
        })
        .filter((bill) => {
          const daysUntilDue = bill.daysUntilDue ?? 0;
          return daysUntilDue <= 3 && daysUntilDue >= 0;
        });
      
      // Send notifications for upcoming bills
      for (const bill of upcomingBills) {
        await self.registration.showNotification('Bill Reminder', {
          body: `${bill.name} - $${bill.amount} due in ${Math.ceil(bill.daysUntilDue)} days`,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: `bill-${bill.id}`,
          data: {
            type: 'bill-reminder',
            billId: bill.id,
            date: bill.dueDate
          }
        });
      }
    }
  } catch (error) {
    swLogger.error('Failed to check upcoming bills', error);
  }
}

async function updateInvestmentPrices() {
  try {
    const response = await fetch('/api/investments/prices/update', {
      method: 'POST'
    });
    
    if (response.ok) {
      const data: { changes?: Array<{ percentChange: number }> } = await response.json();
      
      // Notify about significant price changes
      const significantChanges = data.changes?.filter((change) => 
        Math.abs(change.percentChange) >= 5
      );
      
      if (significantChanges?.length > 0) {
        await self.registration.showNotification('Investment Alert', {
          body: `Significant price changes detected in your portfolio`,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'investment-alert',
          data: {
            type: 'investment-alert',
            changes: significantChanges
          }
        });
      }
    }
  } catch (error) {
    swLogger.error('Failed to update investment prices', error);
}
}

// Message handling for client communication
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, data: _data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;
      
    case 'GET_SYNC_STATUS':
      event.waitUntil(getSyncStatus(event));
      break;
      
    case 'FORCE_SYNC':
      event.waitUntil(forceSyncData());
      break;
      
    case 'ENABLE_OFFLINE_MODE':
      event.waitUntil(enableOfflineMode());
      break;
  }
});

// Helper functions
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}

async function getSyncStatus(event: ExtendableMessageEvent) {
  const db = await openSyncDB();
  const tx = db.transaction(['sync-queue'], 'readonly');
  const count = await tx.objectStore('sync-queue').count();
  
  event.ports[0].postMessage({
    type: 'sync-status',
    pendingRequests: count,
    lastSync: await getLastSyncTime()
  });
}

async function forceSyncData() {
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-offline-data');
  }
}

async function enableOfflineMode() {
  // Pre-cache essential data for offline use
  const cache = await caches.open(API_CACHE);
  const essentialEndpoints = [
    '/api/accounts',
    '/api/transactions?limit=100',
    '/api/categories',
    '/api/budgets',
    '/api/tags'
  ];
  
  await Promise.all(
    essentialEndpoints.map(endpoint => 
      fetch(endpoint).then(response => 
        cache.put(endpoint, response)
      )
    )
  );
}

async function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WealthTrackerSync', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getLastSyncTime(): Promise<number> {
  // Implementation to get last successful sync timestamp
  return Date.now(); // Placeholder
}

// Export for TypeScript
export type {};
