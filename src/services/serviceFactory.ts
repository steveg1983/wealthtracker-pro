/**
 * Service Factory for lazy-loaded services
 * This provides backwards compatibility during migration
 */

// Lazy logger implementation that creates no-op functions when not needed
export const lazyLogger = {
  info: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug(...args);
    }
  }
};