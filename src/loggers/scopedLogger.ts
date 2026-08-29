import { logger as defaultLogger, type LoggingServiceContract } from '../services/loggingService';

export interface ScopedLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
}

const getLogger = (baseLogger?: LoggingServiceContract): LoggingServiceContract =>
  baseLogger ?? defaultLogger;

export function createScopedLogger(
  scope: string,
  baseLogger?: LoggingServiceContract
): ScopedLogger {
  const logger = getLogger(baseLogger);

  return {
    debug: (message, data) => logger.debug(message, data, scope),
    info: (message, data) => logger.info(message, data, scope),
    warn: (message, data) => logger.warn(message, data, scope),
    error: (message, error) => logger.error(message, error, scope),
  };
}
