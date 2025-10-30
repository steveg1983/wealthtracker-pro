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

import { captureException, captureMessage } from '../lib/sentry';

class LoggingService {
  private isDevelopment = import.meta.env.DEV;
  private isTest = import.meta.env.MODE === 'test';
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 100;

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
      timestamp: new Date()
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
    if (this.isDevelopment) {
      const prefix = source ? `[${source}]` : '';
      const isoTimestamp = new Date().toISOString();
      const timeSection = isoTimestamp.split('T')[1] ?? '';
      const timestamp = timeSection.split('.')[0] ?? timeSection;
      
      switch (level) {
        case 'debug':
          console.debug(`🔍 ${timestamp} ${prefix}`, message, data || '');
          break;
        case 'info':
          console.info(`ℹ️ ${timestamp} ${prefix}`, message, data || '');
          break;
        case 'warn':
          console.warn(`⚠️ ${timestamp} ${prefix}`, message, data || '');
          break;
        case 'error':
          console.error(`❌ ${timestamp} ${prefix}`, message, data || '');
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
        console.warn('Failed to send error to tracking service', trackingError);
      }
    }
  }

  private captureWithTracking(message: string, error: unknown, source?: string): void {
    if (error instanceof Error) {
      captureException(error, { source, message });
      return;
    }

    const serializedError = this.serializeError(error);
    captureMessage(message, 'error', {
      source,
      error: serializedError
    });
  }

  private persistErrorLog(message: string, error: unknown, source?: string): void {
    try {
      const errorLog = {
        message,
        error: this.serializeError(error),
        stack: error instanceof Error ? error.stack : undefined,
        source,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown'
      };

      const existing = localStorage.getItem('app_errors');
      const errors: typeof errorLog[] = existing ? JSON.parse(existing) : [];
      errors.push(errorLog);
      if (errors.length > 10) errors.shift();
      localStorage.setItem('app_errors', JSON.stringify(errors));
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

// Export singleton instance
export const logger = new LoggingService();

export type LoggingServiceContract = Pick<LoggingService,
  'debug' | 'info' | 'warn' | 'error' | 'getHistory' | 'clearHistory'
>;

// Export type for use in other files
export type { LogLevel, LogEntry };
