/**
 * Professional Logging Service
 *
 * Provides centralized logging with different levels and environments.
 * In production, logs are suppressed except for errors.
 * In development, all logs are shown with proper formatting.
 *
 * This follows the principle: "Professional-grade, zero compromises"
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: Date;
  source?: string;
}

type ConsoleLike = Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface LoggingDependencies {
  env?: {
    isDevelopment?: boolean;
    isTest?: boolean;
  };
  console?: ConsoleLike;
  captureException?: typeof captureException;
  captureMessage?: typeof captureMessage;
  storage?: StorageLike | null;
  userAgentProvider?: () => string;
  urlProvider?: () => string;
  dateFactory?: () => Date;
  maxHistorySize?: number;
}

import { captureException, captureMessage } from '../lib/sentry';

class LoggingService {
  private readonly isDevelopment: boolean;
  private readonly isTest: boolean;
  private readonly console: ConsoleLike;
  private readonly captureExceptionFn: typeof captureException;
  private readonly captureMessageFn: typeof captureMessage;
  private readonly storage: StorageLike | null;
  private readonly userAgentProvider: () => string;
  private readonly urlProvider: () => string;
  private readonly dateFactory: () => Date;
  private logHistory: LogEntry[] = [];
  private readonly maxHistorySize: number;

  constructor(dependencies: LoggingDependencies = {}) {
    const envIsDev = typeof import.meta !== 'undefined'
      ? import.meta.env?.DEV
      : (typeof process !== 'undefined' ? process.env?.NODE_ENV !== 'production' : false);
    const envMode = typeof import.meta !== 'undefined'
      ? import.meta.env?.MODE
      : (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined);
    const defaultConsole: ConsoleLike = typeof console !== 'undefined'
      ?console 
      : { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    this.isDevelopment = dependencies.env?.isDevelopment ?? !!envIsDev;
    this.isTest = dependencies.env?.isTest ?? envMode === 'test';
    this.console = dependencies.console ?? defaultConsole;
    this.captureExceptionFn = dependencies.captureException ?? captureException;
    this.captureMessageFn = dependencies.captureMessage ?? captureMessage;
    this.storage = dependencies.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    this.userAgentProvider = dependencies.userAgentProvider ?? (() => (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'));
    this.urlProvider = dependencies.urlProvider ?? (() => (typeof window !== 'undefined' ? window.location.href : 'unknown'));
    this.dateFactory = dependencies.dateFactory ?? (() => new Date());
    this.maxHistorySize = dependencies.maxHistorySize ?? 100;
  }

  /**
   * Log debug information (development only)
   */
  debug(message: string, data?: unknown, source?: string): void {
    if (this.isDevelopment && !this.isTest) {
      this.log('debug', message, data, source);
    }
  }

  /**
   * Log general information (development only)
   */
  info(message: string, data?: unknown, source?: string): void {
    if (this.isDevelopment && !this.isTest) {
      this.log('info', message, data, source);
    }
  }

  /**
   * Log warnings (development and production)
   */
  warn(message: string, data?: unknown, source?: string): void {
    if (!this.isTest) {
      this.log('warn', message, data, source);
    }
  }

  /**
   * Log errors (always logged unless in test)
   */
  error(message: string, error?: unknown, source?: string): void {
    if (!this.isTest) {
      this.log('error', message, error, source);

      // In production, also send to error tracking service
      if (!this.isDevelopment) {
        this.sendToErrorTracking(message, error, source);
      }
    }
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, data?: unknown, source?: string): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: this.dateFactory()
    };

    if (data !== undefined) {
      entry.data = data;
    }

    if (source !== undefined) {
      entry.source = source;
    }

    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Output to console in development
    if (this.isDevelopment || level === 'warn' || level === 'error') {
      const prefix = source ? `[${source}]` : '';
      const isoTimestamp = entry.timestamp.toISOString();
      const timeSection = isoTimestamp.split('T')[1] ?? '';
      const timestamp = timeSection.split('.')[0] ?? timeSection;

      switch (level) {
        case 'debug':
          this.console.debug(`🔍 ${timestamp} ${prefix}`, message, data ?? '');
          break;
        case 'info':
          this.console.info(`ℹ️ ${timestamp} ${prefix}`, message, data ?? '');
          break;
        case 'warn':
          this.console.warn(`⚠️ ${timestamp} ${prefix}`, message, data ?? '');
          break;
        case 'error':
          this.console.error(`❌ ${timestamp} ${prefix}`, message, data ?? '');
          break;
      }
    }
  }

  /**
   * Send errors to tracking service (e.g., Sentry, LogRocket)
   */
  private sendToErrorTracking(message: string, error?: unknown, source?: string): void {
    try {
      this.captureWithTracking(message, error, source);
      this.persistErrorLog(message, error, source);
    } catch (trackingError) {
      if (this.isDevelopment) {
        this.console.warn('Failed to send error to tracking service', trackingError);
      }
    }
  }

  private captureWithTracking(message: string, error: unknown, source?: string): void {
    if (error instanceof Error) {
      this.captureExceptionFn(error, { source, message });
      return;
    }

    const serializedError = this.serializeError(error);
    this.captureMessageFn(message, 'error', {
      source,
      error: serializedError,
    });
  }

  private persistErrorLog(message: string, error: unknown, source?: string): void {
    try {
      if (!this.storage) {
        return;
      }
      const errorLog = {
        message,
        error: this.serializeError(error),
        stack: error instanceof Error ? error.stack : undefined,
        source,
        timestamp: this.dateFactory().toISOString(),
        userAgent: this.userAgentProvider(),
        url: this.urlProvider(),
      };

      const existing = this.storage.getItem('app_errors');
      const errors: typeof errorLog[] = existing ? JSON.parse(existing) : [];
      errors.push(errorLog);
      if (errors.length > 10) errors.shift();
      this.storage.setItem('app_errors', JSON.stringify(errors));
    } catch {
      // Ignore storage failures
    }
  }

  private serializeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error ?? null);
    } catch {
      return '[unserializable error]';
    }
  }

  /**
   * Get log history for debugging
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

export const createLoggingService = (deps?: LoggingDependencies) => new LoggingService(deps);

// Export singleton instance
export const logger = new LoggingService();

export type LoggingServiceContract = Pick<
  LoggingService,
  'debug' | 'info' | 'warn' | 'error' | 'getHistory' | 'clearHistory'
>;

export type { LogLevel, LogEntry, LoggingDependencies };
