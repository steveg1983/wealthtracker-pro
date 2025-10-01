/**
 * Service Factory for Dependency Injection
 * Provides services with injected dependencies to break static import cycles
 */

import { logger } from './loggingService';
import type { LoggingServiceContract } from './loggingService';

type ServiceConstructor<T> = new (logger: LoggingServiceContract, ...args: any[]) => T;

type LazyLogger = LoggingServiceContract & {
  getLogger: (namespace?: string) => LoggingServiceContract;
};

let loggerInstance: LoggingServiceContract | null = logger;

async function getLogger(): Promise<LoggingServiceContract> {
  if (!loggerInstance) {
    const module = await import('./loggingService');
    loggerInstance = module.logger;
  }
  return loggerInstance;
}

export const serviceFactory = {
  async createService<T>(ServiceClass: ServiceConstructor<T>, ...args: any[]): Promise<T> {
    const concreteLogger = await getLogger();
    return new ServiceClass(concreteLogger, ...args);
  },

  getLogger,

  createLazyLogger(): LazyLogger {
    const passthrough: LazyLogger = {
      debug: (...args) => logger.debug(...args),
      info: (...args) => logger.info(...args),
      warn: (...args) => logger.warn(...args),
      error: (...args) => logger.error(...args),
      getHistory: () => logger.getHistory(),
      clearHistory: () => logger.clearHistory(),
      getLogger: () => logger
    };

    return passthrough;
  }
};

export const lazyLogger = serviceFactory.createLazyLogger();
