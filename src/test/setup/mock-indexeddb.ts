/**
 * Mock IndexedDB for testing
 */

import { vi } from 'vitest';

// Mock IndexedDB globally
global.indexedDB = {
  open: vi.fn(() => ({
    onsuccess: null,
    onerror: null,
    result: {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          get: vi.fn(() => ({
            onsuccess: null,
            onerror: null,
            result: null
          })),
          put: vi.fn(() => ({
            onsuccess: null,
            onerror: null
          })),
          delete: vi.fn(() => ({
            onsuccess: null,
            onerror: null
          })),
          clear: vi.fn(() => ({
            onsuccess: null,
            onerror: null
          })),
          getAll: vi.fn(() => ({
            onsuccess: null,
            onerror: null,
            result: []
          }))
        }))
      })),
      createObjectStore: vi.fn(),
      deleteObjectStore: vi.fn(),
      close: vi.fn()
    }
  })),
  deleteDatabase: vi.fn(() => ({
    onsuccess: null,
    onerror: null
  }))
} as any;

export {};