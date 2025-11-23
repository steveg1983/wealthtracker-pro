import { storageAdapter } from '../storageAdapter';
import type { JsonValue } from '../../types/common';
import { createScopedLogger, type ScopedLogger } from '../../loggers/scopedLogger';

/**
 * Base service class providing common functionality for all services
 */
export abstract class BaseService {
  protected serviceName: string;
  private readonly logger: ScopedLogger;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = createScopedLogger(serviceName);
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
  protected log(message: string, data?: JsonValue): void {
    this.logger.info(message, data);
  }

  /**
   * Handle service errors consistently
   */
  protected handleError(operation: string, error: unknown): void {
    this.logger.error(`Error in ${operation}`, error);
    // Could integrate with error tracking service here
  }
}
