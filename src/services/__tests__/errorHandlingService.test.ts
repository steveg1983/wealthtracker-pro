import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCategory, ErrorHandlingService } from '../errorHandlingService';

const createStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => (map.has(key) ? map.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    dump: () => Object.fromEntries(map.entries())
  };
};

const createLogger = () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

describe('ErrorHandlingService', () => {
  let storage: ReturnType<typeof createStorage>;
  let logger: ReturnType<typeof createLogger>;
  let now = 0;

  const buildService = () =>
    new ErrorHandlingService({
      storage,
      window: null,
      logger,
      now: () => now,
      random: () => 0.42,
      environment: 'test'
    });

  beforeEach(() => {
    storage = createStorage();
    logger = createLogger();
    now = Date.UTC(2025, 0, 1);
  });

  it('records errors and persists them via injected storage', () => {
    const service = buildService();
    service.handleError(new Error('Network down'), { category: ErrorCategory.NETWORK });

    expect(storage.setItem).toHaveBeenCalledWith(
      'wealthtracker_error_log',
      expect.stringContaining('Network down')
    );
    expect(service.getErrorsByCategory(ErrorCategory.NETWORK)).toHaveLength(1);
  });

  it('invokes registered handlers when an error occurs', () => {
    const service = buildService();
    const handler = vi.fn();
    service.registerHandler(ErrorCategory.STORAGE, handler);

    service.handleError('storage full', { category: ErrorCategory.STORAGE });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ message: 'storage full' }));
  });

  it('retries operations with exponential backoff using injected timers', async () => {
    const service = buildService();
    const spy = vi.fn();
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const op = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('fail');
      }
      return 'ok';
    });

    const promise = service.retryWithBackoff(op, {
      maxRetries: 3,
      initialDelay: 100,
      factor: 2,
      onRetry: spy,
      sleep
    });

    const result = await promise;

    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('wrapAsync captures errors and returns fallback value', async () => {
    const service = buildService();
    const wrapped = service.wrapAsync(async () => {
      throw new Error('boom');
    }, { fallback: 'safe', category: ErrorCategory.UNKNOWN });

    await expect(wrapped()).resolves.toBe('safe');
    expect(service.getRecentErrors()).toHaveLength(1);
  });

  it('validate helper throws when rules fail', () => {
    const service = buildService();
    expect(() =>
      service.validate(
        5,
        [{ test: (val) => val > 10, message: 'too small' }]
      )
    ).toThrow('too small');
  });
});
