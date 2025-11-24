import { useMemo } from 'react';
import { createScopedLogger, type ScopedLogger } from './scopedLogger';

/**
 * React hook that creates a memoized scoped logger instance
 * The logger is stable across re-renders, making it safe to use in dependency arrays
 *
 * @param scope - The scope name for this logger (e.g., component name, hook name)
 * @returns A stable scoped logger instance
 */
export function useMemoizedLogger(scope: string): ScopedLogger {
  return useMemo(() => createScopedLogger(scope), [scope]);
}
