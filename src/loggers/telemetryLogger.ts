import { createScopedLogger, type ScopedLogger } from './scopedLogger';
import type { LoggingServiceContract } from '../services/loggingService';

export type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

export interface TelemetryDetail {
  level: TelemetryLevel;
  message: string;
  data?: unknown;
  source: string;
  timestamp: number;
}

export type TelemetryEmitter = (detail: TelemetryDetail) => void | Promise<void>;

export interface TelemetryLoggerOptions {
  emitter: TelemetryEmitter;
  levels?: TelemetryLevel[];
  baseLogger?: LoggingServiceContract;
}

const DEFAULT_LEVELS: TelemetryLevel[] = ['warn', 'error'];

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof (value as Promise<unknown>)?.then === 'function';

export function createTelemetryLogger(
  scope: string,
  { emitter, levels = DEFAULT_LEVELS, baseLogger }: TelemetryLoggerOptions
): ScopedLogger {
  const scopedLogger = createScopedLogger(scope, baseLogger);
  const enabledLevels = new Set(levels);

  const maybeEmit = (level: TelemetryLevel, message: string, data?: unknown) => {
    if (!enabledLevels.has(level)) {
      return;
    }

    const detail: TelemetryDetail = {
      level,
      message,
      data,
      source: scope,
      timestamp: Date.now()
    };

    try {
      const result = emitter(detail);
      if (isPromise(result)) {
        result.catch(() => {
          // swallow transmission errors so logging never throws
        });
      }
    } catch {
      // ignore emitter failures entirely
    }
  };

  return {
    debug: (message, data) => {
      scopedLogger.debug(message, data);
      maybeEmit('debug', message, data);
    },
    info: (message, data) => {
      scopedLogger.info(message, data);
      maybeEmit('info', message, data);
    },
    warn: (message, data) => {
      scopedLogger.warn(message, data);
      maybeEmit('warn', message, data);
    },
    error: (message, error) => {
      scopedLogger.error(message, error);
      maybeEmit('error', message, error);
    }
  };
}
