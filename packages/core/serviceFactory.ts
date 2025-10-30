export interface StructuredLogger<LogEntry = unknown> {
  debug(message: string, data?: unknown, source?: string): void;
  info(message: string, data?: unknown, source?: string): void;
  warn(message: string, data?: unknown, source?: string): void;
  error(message: string, error?: unknown, source?: string): void;
  getHistory?(): LogEntry[];
  clearHistory?(): void;
}

export interface LazyLogger<LogEntry = unknown> extends StructuredLogger<LogEntry> {
  getLogger(namespace?: string): StructuredLogger<LogEntry>;
}

export interface ServiceFactory<LogEntry = unknown> {
  createService<T>(ServiceClass: new (logger: StructuredLogger<LogEntry>, ...args: any[]) => T, ...args: any[]): T;
  getLogger(namespace?: string): StructuredLogger<LogEntry>;
  createLazyLogger(): LazyLogger<LogEntry>;
}

const noop = (): void => {
  // Intentionally blank
};

function wrapOptionalMethod<LogEntry>(
  logger: StructuredLogger<LogEntry>,
  method: keyof Pick<StructuredLogger<LogEntry>, 'getHistory' | 'clearHistory'>,
): (() => LogEntry[]) | (() => void) {
  const target = logger[method];
  if (typeof target === 'function') {
    return target.bind(logger) as () => LogEntry[] | (() => void);
  }

  if (method === 'getHistory') {
    return (() => []) as () => LogEntry[];
  }

  return noop;
}

function createNamespacedLogger<LogEntry>(
  baseLogger: StructuredLogger<LogEntry>,
  namespace?: string,
): StructuredLogger<LogEntry> {
  if (!namespace) {
    return baseLogger;
  }

  const resolveSource = (source?: string): string | undefined => source ?? namespace;

  return {
    debug: (message, data, source) => baseLogger.debug(message, data, resolveSource(source)),
    info: (message, data, source) => baseLogger.info(message, data, resolveSource(source)),
    warn: (message, data, source) => baseLogger.warn(message, data, resolveSource(source)),
    error: (message, error, source) => baseLogger.error(message, error, resolveSource(source)),
    getHistory: wrapOptionalMethod(baseLogger, 'getHistory') as () => LogEntry[],
    clearHistory: wrapOptionalMethod(baseLogger, 'clearHistory') as () => void,
  };
}

export function createServiceFactory<LogEntry = unknown>(
  logger: StructuredLogger<LogEntry>,
): ServiceFactory<LogEntry> {
  const getLogger = (namespace?: string): StructuredLogger<LogEntry> =>
    createNamespacedLogger(logger, namespace);

  const createLazyLogger = (): LazyLogger<LogEntry> => {
    const boundGetHistory = wrapOptionalMethod(logger, 'getHistory') as () => LogEntry[];
    const boundClearHistory = wrapOptionalMethod(logger, 'clearHistory') as () => void;

    return {
      debug: (message, data, source) => logger.debug(message, data, source),
      info: (message, data, source) => logger.info(message, data, source),
      warn: (message, data, source) => logger.warn(message, data, source),
      error: (message, error, source) => logger.error(message, error, source),
      getHistory: boundGetHistory,
      clearHistory: boundClearHistory,
      getLogger,
    };
  };

  return {
    createService<T>(
      ServiceClass: new (logger: StructuredLogger<LogEntry>, ...args: any[]) => T,
      ...args: any[]
    ): T {
      return new ServiceClass(getLogger(), ...args);
    },
    getLogger,
    createLazyLogger,
  };
}
