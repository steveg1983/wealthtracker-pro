import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartCacheService } from '../smartCacheService';

const fixedNow = 1_700_000_000_000;

const createStorage = () => {
  const data = new Map<string, string>();
  const storage = {
    get length() {
      return data.size;
    },
    clear: vi.fn(() => {
      data.clear();
    }),
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(data.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
  return { storage, data };
};

const createLogger = () => ({
  warn: vi.fn(),
  error: vi.fn()
});

const createService = (overrides: {
  storage?: ReturnType<typeof createStorage>;
  logger?: ReturnType<typeof createLogger>;
} = {}) => {
  const storageWrapper = overrides.storage ?? createStorage();
  const logger = overrides.logger ?? createLogger();
  const service = new SmartCacheService({
    storage: storageWrapper.storage as Storage,
    now: () => fixedNow,
    logger
  });
  return { service, storage: storageWrapper.storage, data: storageWrapper.data, logger };
};

describe('SmartCacheService (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists cached preferences via injected storage', () => {
    const { service, storage } = createService();
    service.cachePreference('currency', 'USD');
    expect(storage.setItem).toHaveBeenCalledWith('pref:currency', JSON.stringify('USD'));
  });

  it('logs warning when preference persistence fails', () => {
    const storageWrapper = createStorage();
    const error = new Error('boom');
    storageWrapper.storage.setItem = vi.fn(() => {
      throw error;
    });
    const logger = createLogger();
    const { service } = createService({ storage: storageWrapper, logger });

    service.cachePreference('currency', 'USD');
    expect(logger.warn).toHaveBeenCalledWith('Failed to persist preference:', error);
  });

  it('loads preferences from injected storage when not in memory', async () => {
    const storageWrapper = createStorage();
    storageWrapper.data.set('pref:currency', JSON.stringify('CHF'));
    const { service } = createService({ storage: storageWrapper });

    const result = await service.getPreference('currency');
    expect(result).toBe('CHF');
  });

  it('hydrates memory cache from storage on init', async () => {
    const storageWrapper = createStorage();
    storageWrapper.data.set('pref:theme', JSON.stringify('dark'));
    const { service } = createService({ storage: storageWrapper });

    const result = await service.getPreference('theme');
    expect(result).toBe('dark');
  });
});
