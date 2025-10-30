import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

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

global.localStorage = localStorageMock as any;

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

global.sessionStorage = sessionStorageMock as any;

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as any;

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock crypto for tests that use encryption
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((array: any) => {
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
  },
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
global.PerformanceObserver = class PerformanceObserver {
  constructor(callback: PerformanceObserverCallback) {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as any;

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
