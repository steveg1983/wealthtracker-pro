import { logger as defaultLogger, type LoggingServiceContract } from '../services/loggingService';

export interface ScopedLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
}

export type ConsoleBridgeLogger = Pick<Console, 'log' | 'warn' | 'error'>;

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

interface NormalizedPayload {
  message: string;
  data?: unknown;
}

const normalizePayload = (defaultMessage: string, args: unknown[]): NormalizedPayload => {
  if (args.length === 0) {
    return { message: defaultMessage };
  }

  const [first, ...rest] = args;

  if (typeof first === 'string') {
    if (rest.length === 0) {
      return { message: first };
    }
    return { message: first, data: rest.length === 1 ? rest[0] : rest };
  }

  if (first instanceof Error) {
    if (rest.length === 0) {
      return { message: first.message || defaultMessage, data: first };
    }
    return {
      message: first.message || defaultMessage,
      data: rest.length === 1 ? [first, rest[0]] : [first, ...rest],
    };
  }

  const data = [first, ...rest];
  return { message: defaultMessage, data: data.length === 1 ? data[0] : data };
};

export function createConsoleBridgeLogger(
  scope: string,
  baseLogger?: LoggingServiceContract
): ConsoleBridgeLogger {
  const scopedLogger = createScopedLogger(scope, baseLogger);

  return {
    log: (...args: unknown[]) => {
      const { message, data } = normalizePayload('log', args);
      scopedLogger.info(message, data);
    },
    warn: (...args: unknown[]) => {
      const { message, data } = normalizePayload('warn', args);
      scopedLogger.warn(message, data);
    },
    error: (...args: unknown[]) => {
      const { message, data } = normalizePayload('error', args);
      scopedLogger.error(message, data);
    },
  };
}
