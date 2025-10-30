import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import './mock-indexeddb';
import { getSupabaseTestClient } from './supabaseClient';
import { setSupabaseClient } from '@wealthtracker/core';

interface ConfigureOptions {
  cleanup: () => void;
}

export function configureVitestEnvironment({ cleanup }: ConfigureOptions) {
  const supabaseMode = process.env.VITEST_SUPABASE_MODE ?? 'mock';
  const viAny = vi as any;

  const createMock = () => {
    if (typeof viAny.fn === 'function') {
      return viAny.fn();
    }

    const fallback = ((..._args: unknown[]) => {}) as any;
    const chain = (returnValue?: unknown) => {
      fallback._value = returnValue;
      return fallback;
    };

    fallback.mockImplementation = () => fallback;
    fallback.mockReturnValue = () => fallback;
    fallback.mockResolvedValue = () => fallback;
    fallback.mockImplementationOnce = chain;
    fallback.mockReturnValueOnce = chain;
    fallback.mockResolvedValueOnce = chain;
    return fallback;
  };

  const callFn = () => createMock();
  const callMock = (method: string, ...args: unknown[]) => {
    const fn = viAny[method];
    return typeof fn === 'function' ? fn(...args) : undefined;
  };

  if (supabaseMode !== 'real') {
    callMock('doMock', '@supabase/supabase-js', async () => {
      try {
        return await import('@/__mocks__/@supabase/supabase-js');
      } catch (error) {
        console.warn('[vitest-setup] Could not load @/__mocks__/@supabase/supabase-js. Falling back to original module.', error);
        return await callMock('importActual', '@supabase/supabase-js');
      }
    });
  } else {
    try {
      const serviceRoleAvailable =
        Boolean(process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) || Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
      const sharedClient = getSupabaseTestClient({
        mode: serviceRoleAvailable ? 'service' : 'anon',
        fallbackToAnon: true,
      });
      setSupabaseClient(sharedClient);
    } catch (error) {
      console.error('[vitest-setup] Failed to initialise shared Supabase client for real tests', error);
      throw error;
    }
  }

  afterEach(() => {
    cleanup();
    callMock('clearAllMocks');
    localStorage.clear();
    sessionStorage.clear();
  });

  beforeAll(() => {
    const errorSpy = callMock('spyOn', console, 'error');
    errorSpy?.mockImplementation?.(() => {});
    const warnSpy = callMock('spyOn', console, 'warn');
    warnSpy?.mockImplementation?.(() => {});

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (() => {
        const matcher = callFn();
        matcher.mockImplementation?.((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: callFn(),
          removeListener: callFn(),
          addEventListener: callFn(),
          removeEventListener: callFn(),
          dispatchEvent: callFn(),
        }));
        return matcher;
      })(),
    });

    const intersectionObserverMock = callFn();
    intersectionObserverMock.mockImplementation?.(() => ({
      observe: callFn(),
      unobserve: callFn(),
      disconnect: callFn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: () => [],
    }));
    global.IntersectionObserver = intersectionObserverMock as unknown as typeof IntersectionObserver;

    const resizeObserverMock = callFn();
    resizeObserverMock.mockImplementation?.(() => ({
      observe: callFn(),
      unobserve: callFn(),
      disconnect: callFn(),
    }));
    global.ResizeObserver = resizeObserverMock as unknown as typeof ResizeObserver;

    window.scrollTo = (callFn() as unknown) as typeof window.scrollTo;

    if (!global.crypto) {
      const mockCrypto: Partial<Crypto> = {
        randomUUID: () => '00000000-0000-0000-0000-000000000000',
        getRandomValues: <T extends ArrayBufferView>(array: T): T => {
          const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          for (let i = 0; i < view.length; i += 1) {
            view[i] = Math.floor(Math.random() * 256);
          }
          return array;
        },
      };

      global.crypto = mockCrypto as Crypto;
    }
  });

  afterAll(() => {
    callMock('restoreAllMocks');
  });
}
