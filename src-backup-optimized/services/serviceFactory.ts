/**
 * Service Factory for Dependency Injection
 * Provides services with injected dependencies to break static import cycles
 */

import type { ILoggingService } from './interfaces/ILoggingService';

// Lazy load the actual logger implementation
let loggerInstance: ILoggingService | null = null;

async function getLogger(): Promise<ILoggingService> {
  if (!loggerInstance) {
    // Dynamically import the logger to break the static dependency
    const { logger } = await import('./loggingService');
    loggerInstance = logger;
  }
  return loggerInstance;
}

// Service factory that provides logger injection
export const serviceFactory = {
  /**
   * Create a service instance with injected logger
   */
  async createService<T>(
    ServiceClass: new (logger: ILoggingService, ...args: any[]) => T,
    ...args: any[]
  ): Promise<T> {
    const logger = await getLogger();
    return new ServiceClass(logger, ...args);
  },

  /**
   * Get logger for direct use (for migration purposes)
   */
  getLogger,

  /**
   * Create a logger getter for services that can't be easily refactored
   * This returns a proxy logger that lazily loads the real logger
   */
  createLazyLogger(): ILoggingService {
    let cachedLogger: ILoggingService | null = null;

    const lazyHandler = {
      get(_target: any, prop: keyof ILoggingService) {
        // Return a function that will load the logger when called
        return (...args: any[]) => {
          if (cachedLogger) {
            return (cachedLogger[prop] as any)(...args);
          }

          // If logger not loaded, queue the log for later
          getLogger().then(logger => {
            cachedLogger = logger;
            (logger[prop] as any)(...args);
          });
        };
      }
    };

    return new Proxy({} as ILoggingService, lazyHandler);
  }
};

// Export a lazy logger for services that can't be easily refactored yet
export const lazyLogger = serviceFactory.createLazyLogger();