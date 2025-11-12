import { describe, it, expect, vi } from 'vitest';
import { createLoggingService } from '../loggingService';

const createConsole = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const createStorage = () => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

describe('LoggingService (deterministic)', () => {
  it('emits debug/info logs only in development mode', () => {
    const consoleMocks = createConsole();
    const logger = createLoggingService({
      env: { isDevelopment: true, isTest: false },
      console: consoleMocks,
      dateFactory: () => new Date('2024-01-01T12:00:00Z')
    });

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleMocks.debug).toHaveBeenCalledWith('🔍 12:00:00 ', 'debug message', '');
    expect(consoleMocks.info).toHaveBeenCalledWith('ℹ️ 12:00:00 ', 'info message', '');
    expect(consoleMocks.warn).toHaveBeenCalled();
    expect(consoleMocks.error).toHaveBeenCalled();
  });

  it('suppresses debug/info logs in production while keeping warn/error', () => {
    const consoleMocks = createConsole();
    const logger = createLoggingService({
      env: { isDevelopment: false, isTest: false },
      console: consoleMocks
    });

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleMocks.debug).not.toHaveBeenCalled();
    expect(consoleMocks.info).not.toHaveBeenCalled();
    expect(consoleMocks.warn).toHaveBeenCalled();
    expect(consoleMocks.error).toHaveBeenCalled();
  });

  it('captures errors to storage and sentry when available', () => {
    const consoleMocks = createConsole();
    const storage = createStorage();
    const captureException = vi.fn();
    const captureMessage = vi.fn();
    const logger = createLoggingService({
      env: { isDevelopment: false, isTest: false },
      console: consoleMocks,
      storage,
      captureException,
      captureMessage,
      userAgentProvider: () => 'agent',
      urlProvider: () => 'http://app',
      dateFactory: () => new Date('2024-01-02T00:00:00Z')
    });

    const error = new Error('boom');
    logger.error('Something failed', error, 'TestSource');

    expect(captureException).toHaveBeenCalledWith(error, { source: 'TestSource', message: 'Something failed' });
    expect(storage.setItem).toHaveBeenCalledWith(
      'app_errors',
      expect.stringContaining('"message":"Something failed"')
    );
  });
});
