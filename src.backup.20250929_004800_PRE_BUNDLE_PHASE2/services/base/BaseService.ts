import { storageAdapter } from '../storageAdapter';
import type { JsonValue } from '../../types/common';
import { logger } from '../loggingService';

/**
 * Base service class providing common functionality for all services
 */
export abstract class BaseService {
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Save data to storage with service-specific key
   */
  protected async saveToStorage<T>(key: string, data: T): Promise<void> {
    const storageKey = `${this.serviceName}_${key}`;
    await storageAdapter.set(storageKey, data);
  }

  /**
   * Load data from storage with service-specific key
   */
  protected async loadFromStorage<T>(key: string, defaultValue: T): Promise<T> {
    const storageKey = `${this.serviceName}_${key}`;
    const data = await storageAdapter.get<T>(storageKey);
    return data ?? defaultValue;
  }

  /**
   * Clear service-specific data from storage
   */
  protected async clearStorage(key: string): Promise<void> {
    const storageKey = `${this.serviceName}_${key}`;
    await storageAdapter.remove(storageKey);
  }

  /**
   * Log service activities for debugging
   */
  protected async log(message: string, data?: JsonValue): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[${this.serviceName}] ${message}`, data || '');
    }
  }

  /**
   * Handle service errors consistently
   */
  protected handleError(operation: string, error: unknown): void {
    logger.error(`[${this.serviceName}] Error in ${operation}:`, error);
    // Could integrate with error tracking service here
  }
}
