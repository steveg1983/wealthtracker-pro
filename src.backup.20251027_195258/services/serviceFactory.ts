import {
  createServiceFactory,
  type LazyLogger as CoreLazyLogger,
  type StructuredLogger,
} from '@wealthtracker/core';
import { logger, type LogEntry, type LoggingServiceContract } from './loggingService';

const noop = (): void => {
  // Intentionally blank
};

const fallbackLogger: LoggingServiceContract = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  getHistory: () => [],
  clearHistory: noop,
};

const resolveLogger = (): LoggingServiceContract =>
  ((logger as LoggingServiceContract | undefined) ?? fallbackLogger);

const proxiedLogger: StructuredLogger<LogEntry> = {
  debug: (message, data, source) => resolveLogger().debug(message, data, source),
  info: (message, data, source) => resolveLogger().info(message, data, source),
  warn: (message, data, source) => resolveLogger().warn(message, data, source),
  error: (message, error, source) => resolveLogger().error(message, error, source),
  getHistory: () => resolveLogger().getHistory(),
  clearHistory: () => resolveLogger().clearHistory(),
};

const factory = createServiceFactory<LogEntry>(proxiedLogger);

export const serviceFactory = {
  createService: factory.createService,
  getLogger: factory.getLogger,
  createLazyLogger: factory.createLazyLogger,
};

export const lazyLogger = factory.createLazyLogger();

export type LazyLogger = CoreLazyLogger<LogEntry>;
