// Production-only console routing to centralized logger
// Avoids mass edits while discouraging future console usage via ESLint

import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('ConsoleToLogger');

// Only activate in production builds
// In development, keep native console for DX
if (import.meta.env.PROD) {
  const native = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
    debug: console.debug.bind(console),
    trace: console.trace ? console.trace.bind(console) : undefined,
  } as const;

  let inRedirect = false;

  const toMessage = (args: unknown[]): { message: string; error?: Error } => {
    if (!args || args.length === 0) return { message: '' };
    const [first, second] = args;
    if (first instanceof Error) return { message: first.message, error: first };
    if (second instanceof Error && typeof first === 'string') return { message: first, error: second };
    // Best-effort stringify preserving first string arg as message
    if (typeof first === 'string') {
      const rest = args.slice(1).map(a => {
        try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
      });
      return { message: [first, ...rest].join(' ') };
    }
    try {
      return { message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') };
    } catch {
      return { message: args.map(a => String(a)).join(' ') };
    }
  };

  const safeCall = (fn: () => void, fallback: (...a: unknown[]) => void, rawArgs: unknown[]) => {
    if (inRedirect) { fallback(...rawArgs); return; }
    inRedirect = true;
    try { fn(); } catch { fallback(...rawArgs); } finally { inRedirect = false; }
  };

  console.error = ((...args: unknown[]) => {
    const { message, error } = toMessage(args);
    safeCall(() => logger.error(message || 'Console error', error), native.error, args);
  }) as typeof console.error;

  console.warn = ((...args: unknown[]) => {
    const { message } = toMessage(args);
    safeCall(() => logger.warn(message || 'Console warn'), native.warn, args);
  }) as typeof console.warn;

  console.info = ((...args: unknown[]) => {
    const { message } = toMessage(args);
    safeCall(() => logger.info(message || 'Console info'), native.info, args);
  }) as typeof console.info;

  console.log = ((...args: unknown[]) => {
    const { message } = toMessage(args);
    safeCall(() => logger.debug(message || 'Console log'), native.log, args);
  }) as typeof console.log;

  console.debug = ((...args: unknown[]) => {
    const { message } = toMessage(args);
    safeCall(() => logger.debug(message || 'Console debug'), native.debug, args);
  }) as typeof console.debug;

  if (native.trace) {
    console.trace = ((...args: unknown[]) => {
      const { message } = toMessage(args);
      safeCall(() => logger.debug(message || 'Console trace'), native.trace!, args);
    }) as typeof console.trace;
  }
}

