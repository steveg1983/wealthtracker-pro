import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, vi } from 'vitest';
import { preferences } from '../services/preferencesService';
import { forgetDeviceIdentity } from '../services/local/deviceIdentity';

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ signOut: vi.fn(), getToken: vi.fn() }),
  useSession: () => ({ session: null }),
}));

vi.mock('@/contexts/AuthContext', () => {
  const mockValue = {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    securityScore: 0,
    securityRecommendations: [],
    signOut: vi.fn(),
    refreshSession: vi.fn(),
  };

  const AuthContext = React.createContext(mockValue);

  const AuthProvider = ({ children }: { children: React.ReactNode }) =>
    React.createElement(AuthContext.Provider, { value: mockValue }, children);

  const useAuth = () => mockValue;

  const useRequireAuth = () => ({
    isAuthenticated: mockValue.isAuthenticated,
    isLoading: mockValue.isLoading,
  });

  const usePremiumFeatures = () => ({
    hasPasskey: false,
    hasMFA: false,
    hasEnhancedSecurity: false,
  });

  return {
    AuthProvider,
    useAuth,
    useRequireAuth,
    usePremiumFeatures,
  };
});

vi.mock('../contexts/AppContextSupabase', async () => {
  return await import('../test/mocks/AppContextSupabase');
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  // Empty the preferences document too.
  //
  // A tier of settings that used to live in `localStorage` — pinned accounts,
  // per-surface periods, grouping and sort choices, hidden register columns,
  // archive cutoffs — now lives in a module-level service so that it can travel
  // with the account (services/preferencesService). That service outlives an
  // individual test the way a page reload does not, so without this a value set
  // in one case would still be there in the next, and a suite's own
  // `localStorage.clear()` would no longer mean "start from nothing".
  //
  // `detach` is the app's own sign-out path, not a test-only hatch: it forgets
  // the signed-in user and everything held for them.
  preferences.detach();

  // And the device edition's own identity, for exactly the same reason one
  // paragraph up. `services/local/deviceIdentity` holds the owner of the open
  // ledger file in module scope — deliberately, because the callers are
  // `useState` initialisers scattered across the app — so a case that opened a
  // document would otherwise answer the NEXT case's "whose ledger is this?".
  // `forgetDeviceIdentity` is the app's own `close_ledger` path, not a hatch.
  forgetDeviceIdentity();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Provide noop scrollTo to silence jsdom warnings during modal transitions
window.scrollTo = vi.fn();

// Mock localStorage with proper implementation
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();

global.localStorage = localStorageMock as Storage;

// Expose React globally for legacy test files using classic runtime
(global as unknown as { React?: typeof React }).React = React;

// Mock sessionStorage with similar implementation
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

global.sessionStorage = sessionStorageMock as Storage;

// Mock IntersectionObserver
global.IntersectionObserver = class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(_callback: IntersectionObserverCallback) {}
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as typeof IntersectionObserver;

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock ResizeObserver
global.ResizeObserver = class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as typeof ResizeObserver;

// Mock crypto for tests that use encryption
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
    subtle: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      generateKey: vi.fn(),
      exportKey: vi.fn(),
      importKey: vi.fn(),
    },
  } as Crypto,
  writable: true,
});

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    timing: {
      navigationStart: 0,
      responseStart: 100,
    },
  },
  writable: true,
});

// Mock PerformanceObserver
global.PerformanceObserver = class MockPerformanceObserver implements PerformanceObserver {
  constructor(_callback: PerformanceObserverCallback) {}
  observe(): void {}
  disconnect(): void {}
  takeRecords(): PerformanceEntryList {
    return [];
  }
} as typeof PerformanceObserver;

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
};

// Mock Date.now for consistent testing
vi.setSystemTime(new Date('2025-01-20T10:00:00Z'));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16);
});
global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});
