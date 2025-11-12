import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../syncService';

const createStorage = () => ({
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

const createLogger = () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const createSocket = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn()
});

const baseOptions = () => ({
  socketFactory: vi.fn(() => createSocket()),
  setIntervalFn: vi.fn(),
  clearIntervalFn: vi.fn(),
  setTimeoutFn: vi.fn((handler: TimerHandler, timeout?: number) => {
    if (typeof handler === 'function') handler();
  }),
  clearTimeoutFn: vi.fn(),
  now: () => 0,
  syncUrl: null
});

describe('SyncService (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs offline mode when no sync URL is configured', () => {
    const storage = createStorage();
    const logger = createLogger();

    new SyncService({
      ...baseOptions(),
      storage,
      logger
    });

    expect(logger.log).toHaveBeenCalledWith(
      'Sync service: No backend URL configured, running in offline mode'
    );
  });

  it('logs errors when stored queue cannot be parsed', () => {
    const storage = createStorage();
    const logger = createLogger();
    storage.getItem.mockImplementation((key: string) =>
      key === 'syncQueue' ? 'not-json' : null
    );

    new SyncService({
      ...baseOptions(),
      storage,
      logger
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load sync queue:',
      expect.any(Error)
    );
  });
});
