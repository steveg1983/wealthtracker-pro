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
  data?: any;
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
  debug(message: string, data?: any, source?: string): void {
    if (this.isDevelopment && !this.isTest) {
      this.log('debug', message, data, source);
    }
  }

  /**
   * Log general information (development only)
   */
  info(message: string, data?: any, source?: string): void {
    if (this.isDevelopment && !this.isTest) {
      this.log('info', message, data, source);
    }
  }

  /**
   * Log warnings (development and production)
   */
  warn(message: string, data?: any, source?: string): void {
    if (!this.isTest) {
      this.log('warn', message, data, source);
    }
  }

  /**
   * Log errors (always logged unless in test)
   */
  error(message: string, error?: any, source?: string): void {
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
  private log(level: LogLevel, message: string, data?: any, source?: string): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      source
    };

    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Output to console in development
    if (this.isDevelopment) {
      const prefix = source ? `[${source}]` : '';
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      
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
  private sendToErrorTracking(message: string, error?: any, source?: string): void {
    try {
      // Prefer structured error reporting via Sentry wrapper
      if (error instanceof Error) {
        captureException(error, { source, message });
      } else {
        // Fall back to message-level reporting
        captureMessage(message, 'error', {
          source,
          error: typeof error === 'string' ? error : JSON.stringify(error ?? null)
        });
      }

      // Also retain a very small rolling local history for quick client debugging
      try {
        const errorLog = {
          message,
          error: error?.message || error,
          stack: error?.stack,
          source,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        };
        const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
        errors.push(errorLog);
        if (errors.length > 10) errors.shift();
        localStorage.setItem('app_errors', JSON.stringify(errors));
      } catch {
        // Ignore storage failures
      }
    } catch {
      // Fail silently if tracking is unavailable
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

// Export type for use in other files
export type { LogLevel, LogEntry };
