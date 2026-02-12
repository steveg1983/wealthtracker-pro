import { describe, expect, it, vi } from 'vitest';
import {
  isAuthBypassRuntimeAllowed,
  isDemoModeRuntimeAllowed,
  persistRuntimeControlSanitizationSignal,
  isRuntimeBypassAllowed,
  sanitizeRuntimeControlSearch,
  sanitizeRuntimeControlSearchWithDetails,
  sanitizeRuntimeControlStorageWithDetails,
  sanitizeRuntimeControlStorage
} from './runtimeMode';

describe('runtimeMode guards', () => {
  it('enables bypasses for development runtime', () => {
    const env = { MODE: 'development', DEV: true, PROD: false };
    expect(isRuntimeBypassAllowed(env)).toBe(true);
    expect(isDemoModeRuntimeAllowed(env)).toBe(true);
    expect(isAuthBypassRuntimeAllowed(env)).toBe(true);
  });

  it('enables bypasses for test runtime', () => {
    const env = { MODE: 'test', DEV: false, PROD: false };
    expect(isRuntimeBypassAllowed(env)).toBe(true);
  });

  it('disables bypasses for production runtime', () => {
    const env = { MODE: 'production', DEV: false, PROD: true };
    expect(isRuntimeBypassAllowed(env)).toBe(false);
    expect(isDemoModeRuntimeAllowed(env)).toBe(false);
    expect(isAuthBypassRuntimeAllowed(env)).toBe(false);
  });
});

describe('sanitizeRuntimeControlSearch', () => {
  it('removes runtime control query params in production', () => {
    const env = { MODE: 'production', DEV: false, PROD: true };

    expect(sanitizeRuntimeControlSearch('?demo=true', env)).toBe('');
    expect(sanitizeRuntimeControlSearch('?testMode=true', env)).toBe('');
    expect(sanitizeRuntimeControlSearch('?foo=bar&demo=true&x=1', env)).toBe('?foo=bar&x=1');
    expect(sanitizeRuntimeControlSearch('?foo=bar&testMode=true&x=1', env)).toBe('?foo=bar&x=1');
    expect(sanitizeRuntimeControlSearch('?foo=bar&demo=true&testMode=true', env)).toBe('?foo=bar');
    expect(sanitizeRuntimeControlSearch('foo=bar&demo=true', env)).toBe('?foo=bar');
    expect(sanitizeRuntimeControlSearch('foo=bar&testMode=true', env)).toBe('?foo=bar');
  });

  it('preserves runtime control query params in non-production runtime', () => {
    const env = { MODE: 'development', DEV: true, PROD: false };

    expect(sanitizeRuntimeControlSearch('?demo=true', env)).toBe('?demo=true');
    expect(sanitizeRuntimeControlSearch('?testMode=true', env)).toBe('?testMode=true');
    expect(sanitizeRuntimeControlSearch('?foo=bar&demo=true', env)).toBe('?foo=bar&demo=true');
    expect(sanitizeRuntimeControlSearch('?foo=bar&testMode=true', env)).toBe('?foo=bar&testMode=true');
  });
});

describe('sanitizeRuntimeControlSearchWithDetails', () => {
  it('returns removed params metadata in production', () => {
    const env = { MODE: 'production', DEV: false, PROD: true };
    const result = sanitizeRuntimeControlSearchWithDetails('?foo=bar&demo=true&testMode=true', env);

    expect(result.sanitizedSearch).toBe('?foo=bar');
    expect(result.removedParams).toEqual(['demo', 'testMode']);
  });

  it('returns empty removed params in non-production runtime', () => {
    const env = { MODE: 'development', DEV: true, PROD: false };
    const result = sanitizeRuntimeControlSearchWithDetails('?foo=bar&demo=true', env);

    expect(result.sanitizedSearch).toBe('?foo=bar&demo=true');
    expect(result.removedParams).toEqual([]);
  });
});

describe('sanitizeRuntimeControlStorage', () => {
  it('removes runtime control storage keys in production runtime', () => {
    const env = { MODE: 'production', DEV: false, PROD: true };
    const store = new Map<string, string>([
      ['isTestMode', 'true'],
      ['demoMode', 'true'],
      ['unrelated', 'keep']
    ]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      }
    };

    const removedAny = sanitizeRuntimeControlStorage(env, storage);

    expect(removedAny).toBe(true);
    expect(store.has('isTestMode')).toBe(false);
    expect(store.has('demoMode')).toBe(false);
    expect(store.get('unrelated')).toBe('keep');
  });

  it('keeps runtime control storage keys in non-production runtime', () => {
    const env = { MODE: 'development', DEV: true, PROD: false };
    const store = new Map<string, string>([
      ['isTestMode', 'true'],
      ['demoMode', 'true']
    ]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      }
    };

    const removedAny = sanitizeRuntimeControlStorage(env, storage);

    expect(removedAny).toBe(false);
    expect(store.get('isTestMode')).toBe('true');
    expect(store.get('demoMode')).toBe('true');
  });

  it('returns false when storage is unavailable', () => {
    const env = { MODE: 'production', DEV: false, PROD: true };
    expect(sanitizeRuntimeControlStorage(env, null)).toBe(false);
    expect(sanitizeRuntimeControlStorage(env, undefined)).toBe(false);
  });
});

describe('sanitizeRuntimeControlStorageWithDetails', () => {
  it('returns removed storage keys in production runtime', () => {
    const env = { MODE: 'production', DEV: false, PROD: true };
    const store = new Map<string, string>([
      ['isTestMode', 'true'],
      ['demoMode', 'true']
    ]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      }
    };

    const result = sanitizeRuntimeControlStorageWithDetails(env, storage);

    expect(result.removedAny).toBe(true);
    expect(result.removedKeys).toEqual(['isTestMode', 'demoMode']);
  });

  it('returns no removals when storage is unavailable', () => {
    const env = { MODE: 'production', DEV: false, PROD: true };
    const result = sanitizeRuntimeControlStorageWithDetails(env, null);

    expect(result.removedAny).toBe(false);
    expect(result.removedKeys).toEqual([]);
  });
});

describe('persistRuntimeControlSanitizationSignal', () => {
  it('writes a signal payload to session storage', () => {
    const setItem = vi.fn();
    persistRuntimeControlSanitizationSignal(
      {
        removedQueryParams: ['demo'],
        removedStorageKeys: ['isTestMode'],
        path: '/banking'
      },
      { setItem }
    );

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0]?.[0]).toBe('wealthtracker.runtime_control_sanitization');
    const payload = JSON.parse(setItem.mock.calls[0]?.[1] ?? '{}') as {
      removedQueryParams: string[];
      removedStorageKeys: string[];
      path: string;
      timestamp: string;
    };
    expect(payload.removedQueryParams).toEqual(['demo']);
    expect(payload.removedStorageKeys).toEqual(['isTestMode']);
    expect(payload.path).toBe('/banking');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('does not throw when storage write fails', () => {
    expect(() => {
      persistRuntimeControlSanitizationSignal(
        {
          removedQueryParams: ['demo'],
          removedStorageKeys: ['isTestMode'],
          path: '/banking'
        },
        {
          setItem: () => {
            throw new Error('quota exceeded');
          }
        }
      );
    }).not.toThrow();
  });
});
