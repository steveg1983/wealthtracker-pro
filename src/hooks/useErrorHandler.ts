import { useCallback } from 'react';
import { captureException } from '../lib/sentry';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';

export function useErrorHandler(): {
  handleError: (error: Error, context?: Record<string, unknown>) => void;
  handleAsyncError: <T>(promise: Promise<T>, context?: Record<string, unknown>) => Promise<T | null>;
} {
  const logger = useMemoizedLogger('useErrorHandler');
  const handleError = useCallback((error: Error, context?: Record<string, unknown>) => {
    captureException(error, context);
    logger.error?.('Error handled', { error, context });
  }, [logger]);

  const handleAsyncError = useCallback(async <T,>(
    promise: Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), context);
      return null;
    }
  }, [handleError]);

  return { handleError, handleAsyncError };
}
