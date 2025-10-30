import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

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
const createMockStorage = (): Storage => {
  const store = new Map<string, string>();

  const storage = {
    clear: vi.fn(() => {
      store.clear();
    }),
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    }),
    get length() {
      return store.size;
    },
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  } satisfies Storage;

  return storage;
};

global.localStorage = createMockStorage();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? '';
    const threshold = options.threshold;
    this.thresholds = Array.isArray(threshold)
      ? threshold
      : typeof threshold === 'number'
        ? [threshold]
        : [];
  }

  disconnect(): void {}

  observe(): void {
    this.callback([], this);
  }

  unobserve(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

// Mock IntersectionObserver
global.IntersectionObserver = MockIntersectionObserver;

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock ResizeObserver
class MockResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  disconnect(): void {}

  observe(_target: Element, _options?: ResizeObserverOptions): void {
    this.callback([], this);
  }

  unobserve(): void {}
}

global.ResizeObserver = MockResizeObserver;

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
class MockPerformanceObserver implements PerformanceObserver {
  static readonly supportedEntryTypes: string[] = [];

  constructor(private readonly callback: PerformanceObserverCallback) {}

  disconnect(): void {}

  observe(_options: PerformanceObserverInit): void {
    this.callback([], this);
  }

  takeRecords(): PerformanceEntryList {
    return [];
  }
}

global.PerformanceObserver = MockPerformanceObserver;

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
