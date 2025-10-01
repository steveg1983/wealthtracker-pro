/**
 * Vitest Setup
 * Global test configuration for REAL testing
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 */

import './test-env'; // Must be first to set environment variables
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import './mock-indexeddb';
// NO MORE MOCKS - Using real Supabase and Clerk connections
// import '../mocks/supabase'; // REMOVED - Using real database
// import '../mocks/clerk';    // REMOVED - Using real auth

const supabaseMode = process.env.VITEST_SUPABASE_MODE ?? 'mock';

if (supabaseMode !== 'real') {
  vi.doMock('@supabase/supabase-js', () => import('../../__mocks__/@supabase/supabase-js'));
}

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Clear all mocks after each test
  vi.clearAllMocks();
  // Clear localStorage
  localStorage.clear();
  // Clear sessionStorage
  sessionStorage.clear();
});

// Setup before all tests
beforeAll(() => {
  // Mock console methods to reduce noise in tests
  // Note: Individual tests can spy on these if needed
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Mock window.matchMedia for responsive tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver for lazy loading tests
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
    takeRecords: () => [],
  }));

  // Mock ResizeObserver for responsive tests
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock scrollTo for navigation tests
  window.scrollTo = vi.fn();
  
  // Mock crypto for UUID generation
  if (!global.crypto) {
    const mockCrypto: Partial<Crypto> = {
      randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2, 11)}`,
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < view.length; i += 1) {
          view[i] = Math.floor(Math.random() * 256);
        }
        return array;
      }
    };

    global.crypto = mockCrypto as Crypto;
  }
});

// Cleanup after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
