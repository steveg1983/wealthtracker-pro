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

const createNamespacedLogger = (namespace?: string): LoggingServiceContract => {
  if (!namespace) {
    return logger;
  }

  const resolveSource = (source?: string): string | undefined => source ?? namespace;

  return {
    debug: (message: string, data?: any, source?: string) => logger.debug(message, data, resolveSource(source)),
    info: (message: string, data?: any, source?: string) => logger.info(message, data, resolveSource(source)),
    warn: (message: string, data?: any, source?: string) => logger.warn(message, data, resolveSource(source)),
    error: (message: string, error?: any, source?: string) => logger.error(message, error, resolveSource(source)),
    getHistory: () => logger.getHistory(),
    clearHistory: () => logger.clearHistory()
  };
};

const getLogger = (namespace?: string): LoggingServiceContract => createNamespacedLogger(namespace);

export const serviceFactory = {
  createService<T>(ServiceClass: ServiceConstructor<T>, ...args: any[]): T {
    return new ServiceClass(getLogger(), ...args);
  },

  getLogger,

  createLazyLogger(): LazyLogger {
    return {
      debug: (...args) => logger.debug(...args),
      info: (...args) => logger.info(...args),
      warn: (...args) => logger.warn(...args),
      error: (...args) => logger.error(...args),
      getHistory: () => logger.getHistory(),
      clearHistory: () => logger.clearHistory(),
      getLogger
    };
  }
};

export const lazyLogger = serviceFactory.createLazyLogger();
